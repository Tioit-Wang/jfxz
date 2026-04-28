import json
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from agno.agent import Agent
from agno.db.base import BaseDb
from agno.models.deepseek import DeepSeek
from agno.models.openai import OpenAIChat
from agno.tools import Toolkit

from app.core.config import get_settings
from app.models import Character, Chapter, SettingItem, Work

_db: BaseDb | None = None


def _create_agent_db(db_url: str) -> BaseDb:  # pragma: no cover
    """Create the appropriate Agno session storage based on database URL."""
    if db_url.startswith("sqlite"):
        from agno.db.sqlite.async_sqlite import AsyncSqliteDb
        return AsyncSqliteDb(db_url=db_url, session_table="agent_sessions")
    stripped = db_url.replace("+asyncpg", "")
    from agno.db.postgres.postgres import PostgresDb
    return PostgresDb(db_url=stripped, session_table="agent_sessions")


def get_agent_db(db_url: str) -> BaseDb:
    global _db
    if _db is None:
        _db = _create_agent_db(db_url)
    return _db


def build_system_prompt(work: Work, refs: list[dict]) -> str:
    parts = [
        f"你是一位专业的小说创作助手，正在协助用户创作《{work.title}》。",
        "",
        "## 作品信息",
        f"- 标题：{work.title}",
        f"- 简介：{work.short_intro or '（无）'}",
        f"- 类型标签：{', '.join(work.genre_tags) if work.genre_tags else '（无）'}",
        f"- 背景/规则：{work.background_rules or '（无）'}",
        f"- 梗概：{work.synopsis or '（无）'}",
        f"- 创作重点：{work.focus_requirements or '（无）'}",
        f"- 禁忌要求：{work.forbidden_requirements or '（无）'}",
    ]
    if refs:
        parts.append("")
        parts.append("## 参考资料上下文")
        for ref in refs:
            ref_type = ref.get("type", "")
            name = ref.get("name", "")
            summary = ref.get("summary", "")
            detail = ref.get("detail", "")
            parts.append(f"### [{ref_type}] {name}")
            if summary:
                parts.append(f"摘要：{summary}")
            if detail:
                parts.append(f"详情：{detail}")
    parts.append("")
    parts.append("## 工具使用指引")
    parts.append("你可以使用以下工具来管理作品数据：")
    parts.append("- 使用 get_character / list_characters 查看角色信息")
    parts.append("- 使用 create_or_update_character 创建或更新角色")
    parts.append("- 使用 delete_character 删除角色")
    parts.append("- 使用 get_setting / list_settings 查看设定信息")
    parts.append("- 使用 create_or_update_setting 创建或更新设定")
    parts.append("- 使用 delete_setting 删除设定")
    parts.append("- 使用 get_chapter / list_chapters 查看章节信息")
    parts.append("- 使用 update_chapter_summary 更新章节摘要")
    parts.append("- 使用 get_work_info 查看作品详情")
    parts.append("- 使用 update_work_info 更新作品信息（field 可选：short_intro / synopsis / background_rules）")
    parts.append("请根据用户需求主动使用工具获取或更新数据，确保创作建议与已有设定一致。")
    return "\n".join(parts)


def _serialize(model) -> dict:
    result = {}
    for column in model.__table__.columns:
        value = getattr(model, column.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        elif isinstance(value, Decimal):
            value = float(value)
        result[column.name] = value
    return result


class JfxzTools(Toolkit):
    def __init__(self, db: AsyncSession, work_id: str):
        super().__init__(name="jfxz_tools")
        self.db = db
        self.work_id = work_id
        self.register(self.get_character)
        self.register(self.list_characters)
        self.register(self.create_or_update_character)
        self.register(self.delete_character)
        self.register(self.get_setting)
        self.register(self.list_settings)
        self.register(self.create_or_update_setting)
        self.register(self.delete_setting)
        self.register(self.get_chapter)
        self.register(self.list_chapters)
        self.register(self.update_chapter_summary)
        self.register(self.get_work_info)
        self.register(self.update_work_info)

    async def get_character(self, character_id: str) -> str:
        """根据角色 ID 获取角色详情。"""
        result = await self.db.execute(
            select(Character).where(Character.id == character_id, Character.work_id == self.work_id)
        )
        character = result.scalar_one_or_none()
        if character is None:
            return json.dumps({"error": "character not found"}, ensure_ascii=False)
        return json.dumps(_serialize(character), ensure_ascii=False)

    async def list_characters(self) -> str:
        """列出当前作品的所有角色。"""
        result = await self.db.execute(
            select(Character).where(Character.work_id == self.work_id).order_by(Character.updated_at.desc())
        )
        items = [_serialize(c) for c in result.scalars()]
        return json.dumps(items, ensure_ascii=False)

    async def create_or_update_character(
        self, name: str, summary: str, detail: str = "", character_id: str | None = None
    ) -> str:
        """创建新角色或更新已有角色。提供 character_id 则更新，否则创建新角色。"""
        if character_id:
            result = await self.db.execute(
                select(Character).where(Character.id == character_id, Character.work_id == self.work_id)
            )
            character = result.scalar_one_or_none()
            if character is None:
                return json.dumps({"error": "character not found"}, ensure_ascii=False)
            character.name = name
            character.summary = summary
            character.detail = detail
        else:
            character = Character(work_id=self.work_id, name=name, summary=summary, detail=detail)
            self.db.add(character)
        await self.db.flush()
        return json.dumps(_serialize(character), ensure_ascii=False)

    async def delete_character(self, character_id: str) -> str:
        """删除指定角色。"""
        result = await self.db.execute(
            select(Character).where(Character.id == character_id, Character.work_id == self.work_id)
        )
        character = result.scalar_one_or_none()
        if character is None:
            return json.dumps({"error": f"未找到角色 {character_id}"}, ensure_ascii=False)
        name = character.name
        await self.db.delete(character)
        await self.db.flush()
        return json.dumps({"success": True, "message": f"已删除角色 {name}"}, ensure_ascii=False)

    async def get_setting(self, setting_id: str) -> str:
        """根据设定 ID 获取设定详情。"""
        result = await self.db.execute(
            select(SettingItem).where(SettingItem.id == setting_id, SettingItem.work_id == self.work_id)
        )
        setting = result.scalar_one_or_none()
        if setting is None:
            return json.dumps({"error": "setting not found"}, ensure_ascii=False)
        return json.dumps(_serialize(setting), ensure_ascii=False)

    async def list_settings(self, setting_type: str | None = None) -> str:
        """列出当前作品的所有设定，可选按类型过滤。"""
        statement = select(SettingItem).where(SettingItem.work_id == self.work_id)
        if setting_type:
            statement = statement.where(SettingItem.type == setting_type)
        statement = statement.order_by(SettingItem.updated_at.desc())
        result = await self.db.execute(statement)
        items = [_serialize(s) for s in result.scalars()]
        return json.dumps(items, ensure_ascii=False)

    async def create_or_update_setting(
        self,
        name: str,
        summary: str,
        detail: str = "",
        setting_type: str = "other",
        setting_id: str | None = None,
    ) -> str:
        """创建新设定或更新已有设定。提供 setting_id 则更新，否则创建新设定。"""
        if setting_id:
            result = await self.db.execute(
                select(SettingItem).where(SettingItem.id == setting_id, SettingItem.work_id == self.work_id)
            )
            setting = result.scalar_one_or_none()
            if setting is None:
                return json.dumps({"error": "setting not found"}, ensure_ascii=False)
            setting.name = name
            setting.summary = summary
            setting.detail = detail
            setting.type = setting_type
        else:
            setting = SettingItem(work_id=self.work_id, type=setting_type, name=name, summary=summary, detail=detail)
            self.db.add(setting)
        await self.db.flush()
        return json.dumps(_serialize(setting), ensure_ascii=False)

    async def delete_setting(self, setting_id: str) -> str:
        """删除指定设定。"""
        result = await self.db.execute(
            select(SettingItem).where(SettingItem.id == setting_id, SettingItem.work_id == self.work_id)
        )
        setting = result.scalar_one_or_none()
        if setting is None:
            return json.dumps({"error": f"未找到设定 {setting_id}"}, ensure_ascii=False)
        name = setting.name
        await self.db.delete(setting)
        await self.db.flush()
        return json.dumps({"success": True, "message": f"已删除设定 {name}"}, ensure_ascii=False)

    async def get_chapter(self, chapter_id: str) -> str:
        """根据章节 ID 获取章节详情，包括正文内容。"""
        result = await self.db.execute(
            select(Chapter).where(Chapter.id == chapter_id, Chapter.work_id == self.work_id)
        )
        chapter = result.scalar_one_or_none()
        if chapter is None:
            return json.dumps({"error": "chapter not found"}, ensure_ascii=False)
        return json.dumps(_serialize(chapter), ensure_ascii=False)

    async def list_chapters(self) -> str:
        """列出当前作品的所有章节，按章节顺序排列。"""
        result = await self.db.execute(
            select(Chapter).where(Chapter.work_id == self.work_id).order_by(Chapter.order_index)
        )
        items = [_serialize(c) for c in result.scalars()]
        return json.dumps(items, ensure_ascii=False)

    async def update_chapter_summary(self, chapter_id: str, summary: str) -> str:
        """更新指定章节的摘要。"""
        result = await self.db.execute(
            select(Chapter).where(Chapter.id == chapter_id, Chapter.work_id == self.work_id)
        )
        chapter = result.scalar_one_or_none()
        if chapter is None:
            return json.dumps({"error": "chapter not found"}, ensure_ascii=False)
        chapter.summary = summary
        await self.db.flush()
        return json.dumps(_serialize(chapter), ensure_ascii=False)

    async def get_work_info(self) -> str:
        """获取当前作品的详细信息。"""
        result = await self.db.execute(select(Work).where(Work.id == self.work_id))
        work = result.scalar_one_or_none()
        if work is None:
            return json.dumps({"error": "work not found"}, ensure_ascii=False)
        return json.dumps(_serialize(work), ensure_ascii=False)

    async def update_work_info(self, field: str, content: str) -> str:
        """更新当前作品的基本信息。field 可选：short_intro / synopsis / background_rules。"""
        valid_fields = {"short_intro", "synopsis", "background_rules"}
        if field not in valid_fields:
            return json.dumps(
                {"error": f"不支持的字段 {field}，可选：{', '.join(sorted(valid_fields))}"},
                ensure_ascii=False,
            )
        result = await self.db.execute(select(Work).where(Work.id == self.work_id))
        work = result.scalar_one_or_none()
        if work is None:
            return json.dumps({"error": "work not found"}, ensure_ascii=False)
        setattr(work, field, content)
        await self.db.flush()
        return json.dumps(_serialize(work), ensure_ascii=False)


def create_agent(
    model,
    work: Work,
    refs: list[dict],
    db_session: AsyncSession,
    work_id: str,
    agno_session_id: str,
) -> Agent:
    settings = get_settings()
    toolkit = JfxzTools(db=db_session, work_id=work_id)
    prompt = build_system_prompt(work, refs)
    model_cls = DeepSeek if "deepseek" in model.provider_model_id.lower() else OpenAIChat
    return Agent(
        model=model_cls(
            id=model.provider_model_id,
            base_url=settings.ai_provider_base_url,
            api_key=settings.ai_provider_api_key,
            temperature=float(model.temperature),
            max_tokens=model.max_output_tokens,
            role_map={"system": "system", "user": "user", "assistant": "assistant", "tool": "tool"},
        ),
        tools=[toolkit],
        instructions=prompt,
        db=get_agent_db(settings.database_url),
        session_id=agno_session_id,
    )
