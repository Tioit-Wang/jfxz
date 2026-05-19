import asyncio
import hashlib
import json
import time
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from agno.agent import Agent
from agno.db.base import BaseDb
from agno.models.deepseek import DeepSeek
from agno.models.openai import OpenAIChat
from agno.tools import Toolkit
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    Chapter,
    Character,
    DailyWordProgress,
    SettingItem,
    Volume,
    Work,
    WritingPrompt,
    WritingPromptCategory,
)
from app.prompts import SYSTEM_PROMPT
from app.services.workspace_structure import move_volume_to_order, ordered_chapters_statement

_db: BaseDb | None = None
_work_db_locks: dict[tuple[int, str], asyncio.Lock] = {}
SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")

# Session-scoped read state for chapter edit guard (R1-R7)
_read_sessions: dict[str, dict] = {}
_READ_SESSION_TTL = 7200  # 2 hours


def _content_hash(content: str) -> str:
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def _get_read_chapters(session_id: str) -> dict[str, str]:
    now = time.time()
    expired = [sid for sid, e in _read_sessions.items() if now - e["last_access"] > _READ_SESSION_TTL]
    for sid in expired:
        del _read_sessions[sid]
    if session_id not in _read_sessions:
        _read_sessions[session_id] = {"chapters": {}, "last_access": now}
    entry = _read_sessions[session_id]
    entry["last_access"] = now
    return entry["chapters"]


def _work_db_lock(work_id: str) -> asyncio.Lock:
    try:
        loop_id = id(asyncio.get_running_loop())
    except RuntimeError:
        loop_id = 0
    key = (loop_id, work_id)
    lock = _work_db_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _work_db_locks[key] = lock
    return lock


def _create_agent_db(db_url: str) -> BaseDb:  # pragma: no cover
    """Create the appropriate Agno session storage based on database URL."""
    if db_url.startswith("sqlite"):
        from agno.db.sqlite.async_sqlite import AsyncSqliteDb

        return AsyncSqliteDb(db_url=db_url, session_table="agent_sessions")
    if db_url.startswith("mysql"):
        from agno.db.mysql.async_mysql import AsyncMySQLDb

        db = AsyncMySQLDb(
            db_url=db_url,
            db_schema=_mysql_database_name(db_url),
            session_table="agent_sessions",
            create_schema=False,
        )
        _disable_mysql_agent_db_auto_create(db)
        return db
    stripped = db_url.replace("+asyncpg", "")
    from agno.db.postgres.postgres import PostgresDb

    return PostgresDb(db_url=stripped, session_table="agent_sessions")


def _mysql_database_name(db_url: str) -> str:
    database = make_url(db_url).database
    if not database:
        raise ValueError("MySQL database URL must include a database name")
    return database


def _disable_mysql_agent_db_auto_create(db: BaseDb) -> None:
    async def _create_table_disabled(*args, **kwargs):
        raise RuntimeError(
            "agent_sessions table is managed by manual SQL migrations; "
            "execute backend/migrations/versions/*.sql before starting production services"
        )

    db._create_table = _create_table_disabled  # type: ignore[attr-defined]


def get_agent_db(db_url: str) -> BaseDb:
    global _db
    if _db is None:
        _db = _create_agent_db(db_url)
    return _db


def build_system_prompt(work: Work) -> str:
    return (
        SYSTEM_PROMPT.replace("{{ title }}", work.title)
        .replace("{{ short_intro }}", work.short_intro or "（无）")
        .replace(
            "{{ genre_tags }}",
            ", ".join(work.genre_tags) if work.genre_tags else "（无）",
        )
        .replace("{{ background_rules }}", work.background_rules or "（无）")
        .replace("{{ synopsis }}", work.synopsis or "（无）")
        .replace("{{ focus_requirements }}", work.focus_requirements or "（无）")
        .replace("{{ forbidden_requirements }}", work.forbidden_requirements or "（无）")
    )


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


def _serialize_lite(model, fields: list[str]) -> dict:
    """只序列化指定字段，用于列表和写操作返回，节省 token。"""
    result = {}
    for name in fields:
        value = getattr(model, name)
        if isinstance(value, datetime):
            value = value.isoformat()
        elif isinstance(value, Decimal):
            value = float(value)
        result[name] = value
    return result


def _add_line_numbers(text: str) -> tuple[str, int]:
    """为正文每段添加段落编号，返回 (带编号的文本, 总段落数)。"""
    if not text:
        return "", 0
    paragraphs = text.split("\n")
    if paragraphs and paragraphs[-1] == "":
        paragraphs = paragraphs[:-1]
    total = len(paragraphs)
    numbered = "\n".join(f"{i + 1} {p}" for i, p in enumerate(paragraphs))
    return numbered, total


def _content_to_lines(text: str) -> list[str]:
    """将正文拆分为行列表，去除末尾空行。"""
    if not text:
        return []
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]
    return lines


def _lines_to_content(lines: list[str]) -> str:
    """将行列表合并回正文，末尾加换行。"""
    if not lines:
        return ""
    return "\n".join(lines) + "\n"


def _normalize_list_limit(limit: int, default: int = 20, maximum: int = 100) -> int:
    if not isinstance(limit, int):
        return default
    return max(1, min(limit, maximum))


def _count_words(value: str) -> int:
    return len("".join(value.split()))


async def _add_daily_words(db: AsyncSession, work_id: str, words: int) -> None:
    if words <= 0:
        return
    today = datetime.now(SHANGHAI_TZ).date()
    result = await db.execute(
        select(DailyWordProgress).where(
            DailyWordProgress.work_id == work_id,
            DailyWordProgress.date == today,
        )
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        progress = DailyWordProgress(work_id=work_id, date=today, words_added=0)
        db.add(progress)
    progress.words_added += words


async def _ensure_default_volume(db: AsyncSession, work_id: str) -> Volume:
    result = await db.execute(
        select(Volume).where(Volume.work_id == work_id).order_by(Volume.order_index)
    )
    volume = result.scalars().first()
    if volume is None:
        volume = Volume(work_id=work_id, order_index=1, title="默认卷")
        db.add(volume)
        await db.flush()
    for chapter in (
        await db.execute(select(Chapter).where(Chapter.work_id == work_id, Chapter.volume_id.is_(None)))
    ).scalars():
        chapter.volume_id = volume.id
    return volume


class GoodguaTools(Toolkit):
    def __init__(self, db: AsyncSession, work_id: str, session_id: str):
        super().__init__(name="goodgua_tools")
        self.db = db
        self.work_id = work_id
        self._db_lock = _work_db_lock(work_id)
        self._session_id = session_id
        self.register(self.get_character)
        self.register(self.list_characters)
        self.register(self.create_or_update_character)
        self.register(self.delete_character)
        self.register(self.get_setting)
        self.register(self.list_settings)
        self.register(self.create_or_update_setting)
        self.register(self.delete_setting)
        self.register(self.list_volumes)
        self.register(self.create_volume)
        self.register(self.update_volume)
        self.register(self.get_chapter)
        self.register(self.list_chapters)
        self.register(self.create_chapter)
        self.register(self.update_chapter)
        self.register(self.get_work_info)
        self.register(self.update_work_info)
        self.register(self.list_prompt_categories)
        self.register(self.list_prompts_by_category)
        self.register(self.get_prompt_detail)

    async def get_character(self, character_id: str) -> str:
        """获取指定角色的完整信息，包含名称、摘要、详细设定等所有字段。角色不存在时返回 error。与 list_characters 的区别：本工具返回完整 detail 字段，list_characters 只返回概览（仅 id/name/summary），浏览角色列表时优先使用 list_characters。"""
        async with self._db_lock:
            result = await self.db.execute(
                select(Character).where(Character.id == character_id, Character.work_id == self.work_id)
            )
            character = result.scalar_one_or_none()
            if character is None:
                return json.dumps({"error": "character not found"}, ensure_ascii=False)
            return json.dumps(_serialize(character), ensure_ascii=False)

    async def list_characters(self, limit: int = 20, offset: int = 0) -> str:
        """列出当前作品角色概览，按更新时间倒序排列。仅返回 id/name/summary 三个字段，不包含 detail。返回结果包含分页元数据：items、total、returned、limit、offset、has_more。当 has_more 为 true 时，应使用 offset + limit 作为下一次调用的 offset 继续翻页获取剩余数据，而不是增大 limit 重新请求。需查看角色详细设定时使用 get_character。"""
        limit = _normalize_list_limit(limit)
        offset = max(0, offset)
        async with self._db_lock:
            total = (await self.db.execute(
                select(func.count(Character.id)).where(Character.work_id == self.work_id)
            )).scalar() or 0
            result = await self.db.execute(
                select(Character)
                .where(Character.work_id == self.work_id)
                .order_by(Character.updated_at.desc())
                .offset(offset)
                .limit(limit)
            )
            items = [_serialize_lite(c, ["id", "name", "summary"]) for c in result.scalars()]
            return json.dumps({
                "items": items,
                "total": total,
                "returned": len(items),
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(items) < total,
            }, ensure_ascii=False)

    async def create_or_update_character(
        self, name: str, summary: str, detail: str = "", character_id: str | None = None
    ) -> str:
        """创建新角色或更新已有角色。不传 character_id 则创建新角色，传入 character_id 则更新该角色（name 和 summary 会覆盖原有值）。操作成功后返回角色基本信息（id/name/summary/detail/时间戳），用一句话确认结果即可，不要重复输出已保存的全部内容。"""
        async with self._db_lock:
            try:
                if character_id:
                    result = await self.db.execute(
                        select(Character).where(
                            Character.id == character_id, Character.work_id == self.work_id
                        )
                    )
                    character = result.scalar_one_or_none()
                    if character is None:
                        return json.dumps({"error": "character not found"}, ensure_ascii=False)
                    character.name = name
                    character.summary = summary
                    character.detail = detail
                else:
                    character = Character(
                        work_id=self.work_id, name=name, summary=summary, detail=detail
                    )
                    self.db.add(character)
                await self.db.commit()
                return json.dumps(
                    _serialize_lite(
                        character, ["id", "name", "summary", "detail", "created_at", "updated_at"]
                    ),
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def delete_character(self, character_id: str) -> str:
        """删除指定角色。不可逆操作，仅在用户明确要求删除时执行。返回包含 success/character_id/name/message 的确认 JSON。"""
        async with self._db_lock:
            try:
                result = await self.db.execute(
                    select(Character).where(
                        Character.id == character_id, Character.work_id == self.work_id
                    )
                )
                character = result.scalar_one_or_none()
                if character is None:
                    return json.dumps({"error": f"未找到角色 {character_id}"}, ensure_ascii=False)
                name = character.name
                await self.db.delete(character)
                await self.db.commit()
                return json.dumps(
                    {
                        "success": True,
                        "character_id": character_id,
                        "name": name,
                        "message": f"已删除角色 {name}",
                    },
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def get_setting(self, setting_id: str) -> str:
        """获取指定设定的完整信息，包含名称、类型、摘要、详细设定等所有字段。设定不存在时返回 error。与 list_settings 的区别：本工具返回完整 detail 字段，list_settings 只返回概览（仅 id/type/name/summary），浏览设定列表时优先使用 list_settings。"""
        async with self._db_lock:
            result = await self.db.execute(
                select(SettingItem).where(
                    SettingItem.id == setting_id, SettingItem.work_id == self.work_id
                )
            )
            setting = result.scalar_one_or_none()
            if setting is None:
                return json.dumps({"error": "setting not found"}, ensure_ascii=False)
            return json.dumps(_serialize(setting), ensure_ascii=False)

    async def list_settings(self, setting_type: str | None = None, limit: int = 20, offset: int = 0) -> str:
        """列出当前作品设定概览，可选按 setting_type 过滤。仅返回 id/type/name/summary 四个字段，不包含 detail。返回结果包含分页元数据：items、total、returned、limit、offset、has_more。当 has_more 为 true 时，应使用 offset + limit 作为下一次调用的 offset 继续翻页获取剩余数据，而不是增大 limit 重新请求。需查看详细设定时使用 get_setting。"""
        limit = _normalize_list_limit(limit)
        offset = max(0, offset)
        async with self._db_lock:
            count_stmt = select(func.count(SettingItem.id)).where(SettingItem.work_id == self.work_id)
            data_stmt = select(SettingItem).where(SettingItem.work_id == self.work_id)
            if setting_type:
                count_stmt = count_stmt.where(SettingItem.type == setting_type)
                data_stmt = data_stmt.where(SettingItem.type == setting_type)
            total = (await self.db.execute(count_stmt)).scalar() or 0
            result = await self.db.execute(data_stmt.order_by(SettingItem.updated_at.desc()).offset(offset).limit(limit))
            items = [_serialize_lite(s, ["id", "type", "name", "summary"]) for s in result.scalars()]
            return json.dumps({
                "items": items,
                "total": total,
                "returned": len(items),
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(items) < total,
            }, ensure_ascii=False)

    async def create_or_update_setting(
        self,
        name: str,
        summary: str,
        detail: str = "",
        setting_type: str = "other",
        setting_id: str | None = None,
    ) -> str:
        """创建新设定或更新已有设定。不传 setting_id 则创建新设定（setting_type 默认为 "other"），传入 setting_id 则更新该设定。操作成功后返回设定基本信息，用一句话确认结果即可。"""
        async with self._db_lock:
            try:
                if setting_id:
                    result = await self.db.execute(
                        select(SettingItem).where(
                            SettingItem.id == setting_id, SettingItem.work_id == self.work_id
                        )
                    )
                    setting = result.scalar_one_or_none()
                    if setting is None:
                        return json.dumps({"error": "setting not found"}, ensure_ascii=False)
                    setting.name = name
                    setting.summary = summary
                    setting.detail = detail
                    setting.type = setting_type
                else:
                    setting = SettingItem(
                        work_id=self.work_id,
                        type=setting_type,
                        name=name,
                        summary=summary,
                        detail=detail,
                    )
                    self.db.add(setting)
                await self.db.commit()
                return json.dumps(
                    _serialize_lite(
                        setting,
                        ["id", "type", "name", "summary", "detail", "created_at", "updated_at"],
                    ),
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def delete_setting(self, setting_id: str) -> str:
        """删除指定设定。不可逆操作，仅在用户明确要求删除时执行。返回包含 success/setting_id/name/message 的确认 JSON。"""
        async with self._db_lock:
            try:
                result = await self.db.execute(
                    select(SettingItem).where(
                        SettingItem.id == setting_id, SettingItem.work_id == self.work_id
                    )
                )
                setting = result.scalar_one_or_none()
                if setting is None:
                    return json.dumps({"error": f"未找到设定 {setting_id}"}, ensure_ascii=False)
                name = setting.name
                await self.db.delete(setting)
                await self.db.commit()
                return json.dumps(
                    {
                        "success": True,
                        "setting_id": setting_id,
                        "name": name,
                        "message": f"已删除设定 {name}",
                    },
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def list_volumes(self, limit: int = 20, offset: int = 0) -> str:
        """列出当前作品卷概览，按卷顺序排列。返回 id/order_index/title。返回结果包含分页元数据：items、total、returned、limit、offset、has_more。当 has_more 为 true 时，应使用 offset + limit 作为下一次调用的 offset 继续翻页获取剩余数据，而不是增大 limit 重新请求。创建章节时如需指定所属卷，先用本工具确认 volume_id。"""
        limit = _normalize_list_limit(limit)
        offset = max(0, offset)
        async with self._db_lock:
            await _ensure_default_volume(self.db, self.work_id)
            total = (await self.db.execute(
                select(func.count(Volume.id)).where(Volume.work_id == self.work_id)
            )).scalar() or 0
            result = await self.db.execute(
                select(Volume)
                .where(Volume.work_id == self.work_id)
                .order_by(Volume.order_index)
                .offset(offset)
                .limit(limit)
            )
            items = [_serialize_lite(v, ["id", "order_index", "title"]) for v in result.scalars()]
            return json.dumps({
                "items": items,
                "total": total,
                "returned": len(items),
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(items) < total,
            }, ensure_ascii=False)

    async def create_volume(self, title: str) -> str:
        """创建新卷，自动追加到最后一卷之后。title 为必填卷名。创建成功后返回 id/order_index/title/时间戳。"""
        async with self._db_lock:
            try:
                await _ensure_default_volume(self.db, self.work_id)
                count_result = await self.db.execute(
                    select(func.count(Volume.id)).where(Volume.work_id == self.work_id)
                )
                order_index = int(count_result.scalar() or 0) + 1
                volume = Volume(
                    work_id=self.work_id,
                    order_index=order_index,
                    title=title.strip() or f"第 {order_index} 卷",
                )
                self.db.add(volume)
                await self.db.commit()
                await self.db.refresh(volume)
                return json.dumps(
                    _serialize_lite(
                        volume, ["id", "order_index", "title", "created_at", "updated_at"]
                    ),
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def update_volume(
        self, volume_id: str, title: str, order_index: int | None = None
    ) -> str:
        """修改指定卷。title 覆盖原卷名；order_index 可选，仅在需要调整卷顺序时传入。返回更新后的 id/order_index/title/updated_at。"""
        async with self._db_lock:
            try:
                result = await self.db.execute(
                    select(Volume).where(Volume.id == volume_id, Volume.work_id == self.work_id)
                )
                volume = result.scalar_one_or_none()
                if volume is None:
                    return json.dumps({"error": "volume not found"}, ensure_ascii=False)
                volume.title = title.strip() or volume.title
                if order_index is not None:
                    await move_volume_to_order(self.db, self.work_id, volume, order_index)
                await self.db.commit()
                return json.dumps(
                    _serialize_lite(volume, ["id", "order_index", "title", "updated_at"]),
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def get_chapter(self, chapter_id: str) -> str:
        """获取指定章节完整信息，含带段落编号的正文（content 字段）和字数（word_count 字段）。正文每段以行号开头（如 "1 正文内容"），total_lines 字段为总段落数。当用户引用了特定段落范围（如 L5-L8），请重点关注第 5 到 8 段的内容。章节不存在时返回 error。"""
        async with self._db_lock:
            result = await self.db.execute(
                select(Chapter).where(Chapter.id == chapter_id, Chapter.work_id == self.work_id)
            )
            chapter = result.scalar_one_or_none()
            if chapter is None:
                return json.dumps({"error": "chapter not found"}, ensure_ascii=False)

            read_map = _get_read_chapters(self._session_id)
            current_hash = _content_hash(chapter.content or "")

            if chapter_id in read_map and read_map[chapter_id] == current_hash:
                return json.dumps({
                    "chapter_id": chapter_id,
                    "title": chapter.title,
                    "status": "unchanged",
                    "message": "章节内容与上次读取一致，无需重新获取。请参考之前的读取结果进行操作。",
                }, ensure_ascii=False)

            data = _serialize(chapter)
            numbered, total_lines = _add_line_numbers(chapter.content or "")
            data["content"] = numbered
            data["total_lines"] = total_lines
            data["word_count"] = _count_words(chapter.content or "")
            read_map[chapter_id] = current_hash
            return json.dumps(data, ensure_ascii=False)

    async def list_chapters(self, limit: int = 20, offset: int = 0) -> str:
        """列出当前作品章节目录概览，按章节顺序排列。仅返回 id/volume_id/order_index/title/summary/word_count，不包含正文（content）。返回结果包含分页元数据：items、total、returned、limit、offset、has_more。当 has_more 为 true 时，应使用 offset + limit 作为下一次调用的 offset 继续翻页获取剩余数据，而不是增大 limit 重新请求。需查看正文内容时使用 get_chapter。"""
        limit = _normalize_list_limit(limit)
        offset = max(0, offset)
        async with self._db_lock:
            await _ensure_default_volume(self.db, self.work_id)
            total = (await self.db.execute(
                select(func.count(Chapter.id)).where(Chapter.work_id == self.work_id)
            )).scalar() or 0
            result = await self.db.execute(ordered_chapters_statement(self.work_id).offset(offset).limit(limit))
            chapters = list(result.scalars())
            items = [
                {
                    **_serialize_lite(c, ["id", "volume_id", "order_index", "title", "summary"]),
                    "display_order": offset + idx + 1,
                    "word_count": _count_words(c.content or ""),
                }
                for idx, c in enumerate(chapters)
            ]
            return json.dumps({
                "items": items,
                "total": total,
                "returned": len(items),
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(items) < total,
            }, ensure_ascii=False)

    async def create_chapter(
        self, title: str, summary: str = "", volume_id: str | None = None, target_chapter_id: str | None = None
    ) -> str:
        """创建新章节。章节标题必须给出，命名时不要带"第x章"前缀，只写章节名；若用户未指定标题则用"未命名"占位。

定位规则：
- 未传 target_chapter_id：自动追加到指定卷最后一章之后。未传 volume_id 时使用默认第一卷。
- 传入 target_chapter_id：在目标章节**之后**插入新章，自动将目标章后面的所有章节排序号 +1。

创建成功后返回新章节的 id/volume_id/order_index/title/summary/word_count/时间戳。"""
        async with self._db_lock:
            try:
                if volume_id:
                    volume_result = await self.db.execute(
                        select(Volume).where(Volume.id == volume_id, Volume.work_id == self.work_id)
                    )
                    volume = volume_result.scalar_one_or_none()
                    if volume is None:
                        return json.dumps({"error": "volume not found"}, ensure_ascii=False)
                else:
                    volume = await _ensure_default_volume(self.db, self.work_id)

                if target_chapter_id:
                    target_result = await self.db.execute(
                        select(Chapter).where(
                            Chapter.id == target_chapter_id, Chapter.work_id == self.work_id
                        )
                    )
                    target = target_result.scalar_one_or_none()
                    if target is None:
                        return json.dumps({"error": "target chapter not found"}, ensure_ascii=False)
                    insert_volume = volume if volume_id else (
                        await self.db.get(Volume, target.volume_id) if target.volume_id else volume
                    )
                    insert_order = target.order_index + 1
                    # Shift subsequent chapters in the same volume down by 1.
                    # Process in descending order and flush one-by-one to avoid
                    # UNIQUE(volume_id, order_index) collisions.
                    subsequent = (
                        await self.db.execute(
                            select(Chapter).where(
                                Chapter.work_id == self.work_id,
                                Chapter.volume_id == insert_volume.id,
                                Chapter.order_index >= insert_order,
                            ).order_by(Chapter.order_index.desc())
                        )
                    ).scalars().all()
                    for ch in subsequent:
                        ch.order_index += 1
                        await self.db.flush()
                    chapter = Chapter(
                        work_id=self.work_id,
                        volume_id=insert_volume.id,
                        order_index=insert_order,
                        title=title,
                        content="",
                        summary=summary or None,
                    )
                else:
                    max_result = await self.db.execute(
                        select(func.max(Chapter.order_index)).where(Chapter.volume_id == volume.id)
                    )
                    max_order = max_result.scalar() or 0
                    chapter = Chapter(
                        work_id=self.work_id,
                        volume_id=volume.id,
                        order_index=max_order + 1,
                        title=title,
                        content="",
                        summary=summary or None,
                    )

                self.db.add(chapter)
                await self.db.commit()
                await self.db.refresh(chapter)
                _get_read_chapters(self._session_id)[chapter.id] = _content_hash("")
                return json.dumps(
                    {
                        **_serialize_lite(
                            chapter,
                            ["id", "volume_id", "order_index", "title", "summary", "created_at", "updated_at"],
                        ),
                        "word_count": 0,
                    },
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def update_chapter(
        self,
        chapter_id: str,
        title: str | None = None,
        summary: str | None = None,
        content: str | None = None,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> str:
        """更新指定章节的标题、摘要和/或正文。只传需要修改的字段，未传的字段保持不变。可同时修改多个字段。content 变更时系统自动展示新旧 diff，**不要**先输出修改内容到对话中——直接调用工具即可。

支持部分更新：传入 start_line 和 end_line 时，只替换指定行范围，大幅节省 token。
- start_line <= end_line：替换 [start_line, end_line] 行
- end_line < start_line（或 end_line 缺省时传 start_line - 1）：在 start_line 之前插入新内容
- 不传 start_line：全量替换（默认行为）"""
        async with self._db_lock:
            try:
                result = await self.db.execute(
                    select(Chapter).where(Chapter.id == chapter_id, Chapter.work_id == self.work_id)
                )
                chapter = result.scalar_one_or_none()
                if chapter is None:
                    return json.dumps({"error": "chapter not found"}, ensure_ascii=False)

                response: dict = {"chapter_id": chapter.id}

                if title is not None:
                    chapter.title = title
                response["title"] = chapter.title

                if summary is not None:
                    chapter.summary = summary
                response["summary"] = chapter.summary

                if content is not None:
                    read_map = _get_read_chapters(self._session_id)
                    if chapter_id not in read_map:
                        return json.dumps(
                            {"error": "必须先读取本章节内容才能修改正文，请先调用 get_chapter 查看当前内容"},
                            ensure_ascii=False,
                        )
                    current_hash = _content_hash(chapter.content or "")
                    if current_hash != read_map[chapter_id]:
                        return json.dumps(
                            {"error": "章节内容在读取后被修改过（可能是你在网页端编辑或恢复了历史版本），请重新调用 get_chapter 查看最新内容后再修改"},
                            ensure_ascii=False,
                        )

                if content is not None and start_line is not None:
                    # --- 部分更新模式 ---
                    old_content = chapter.content or ""
                    old_lines = _content_to_lines(old_content)
                    total_old = len(old_lines)

                    effective_end = end_line if end_line is not None else start_line

                    if start_line < 1 or start_line > total_old + 1:
                        return json.dumps(
                            {"error": f"start_line {start_line} 超出范围（1-{total_old + 1}）"},
                            ensure_ascii=False,
                        )
                    if effective_end > total_old:
                        return json.dumps(
                            {"error": f"end_line {effective_end} 超出范围（最多 {total_old}）"},
                            ensure_ascii=False,
                        )

                    new_lines = _content_to_lines(content)

                    if effective_end >= start_line:
                        # 替换模式：替换 [start_line, end_line]
                        before = old_lines[: start_line - 1]
                        after = old_lines[effective_end:]
                        merged = before + new_lines + after
                    else:
                        # 插入模式：在 start_line 之前插入，不删已有行
                        before = old_lines[: start_line - 1]
                        after = old_lines[start_line - 1 :]
                        merged = before + new_lines + after

                    new_content = _lines_to_content(merged)
                    chapter.content = new_content
                    word_delta = _count_words(new_content) - _count_words(old_content)
                    await _add_daily_words(self.db, self.work_id, word_delta)

                    # 生成变更区域的上下文预览（变更行 ± 3 行）
                    ctx = 3
                    changed_start = max(0, start_line - 1 - ctx)
                    changed_end = min(len(merged), (effective_end if effective_end >= start_line else start_line - 1) + len(new_lines) + ctx)
                    old_ctx_start = max(0, start_line - 1 - ctx)
                    old_ctx_end = min(len(old_lines), effective_end + ctx) if effective_end >= start_line else min(len(old_lines), start_line - 1 + ctx)
                    old_preview = "\n".join(old_lines[old_ctx_start:old_ctx_end])
                    new_preview = "\n".join(merged[changed_start:changed_end])

                    response["old_content_preview"] = old_preview
                    response["new_content_preview"] = new_preview
                    response["old_content_length"] = len(old_content)
                    response["new_content_length"] = len(new_content)
                    response["preview_truncated"] = len(old_preview) > 500 or len(new_preview) > 500
                    response["content_changed"] = old_content != new_content
                    response["changed_range"] = {"start": start_line, "end": effective_end}
                    _get_read_chapters(self._session_id)[chapter_id] = _content_hash(new_content)

                elif content is not None:
                    # --- 全量替换模式 ---
                    old_content = chapter.content or ""
                    chapter.content = content
                    word_delta = _count_words(content) - _count_words(old_content)
                    await _add_daily_words(self.db, self.work_id, word_delta)
                    response["old_content_preview"] = old_content[:200]
                    response["new_content_preview"] = content[:200]
                    response["old_content_length"] = len(old_content)
                    response["new_content_length"] = len(content)
                    response["preview_truncated"] = len(old_content) > 200 or len(content) > 200
                    response["content_changed"] = old_content != content
                    _get_read_chapters(self._session_id)[chapter_id] = _content_hash(content)

                response["status"] = "updated"
                if response.get("content_changed", True):
                    from app.services.version_service import create_version_snapshot
                    await create_version_snapshot(
                        self.db, chapter.id, chapter.title, chapter.content,
                        chapter.summary, source="ai", source_detail="agno-session",
                    )
                await self.db.commit()
                return json.dumps(response, ensure_ascii=False)
            except Exception:
                await self.db.rollback()
                raise

    async def get_work_info(self) -> str:
        """获取当前作品的完整信息，包含标题、简介、类型标签、背景规则、梗概、创作重点、禁忌要求等全部字段。数据量较大，仅在需要确认整体设定或查询多个作品级字段时调用。"""
        async with self._db_lock:
            result = await self.db.execute(select(Work).where(Work.id == self.work_id))
            work = result.scalar_one_or_none()
            if work is None:
                return json.dumps({"error": "work not found"}, ensure_ascii=False)
            return json.dumps(_serialize(work), ensure_ascii=False)

    async def update_work_info(self, field: str, content: str) -> str:
        """更新当前作品的基本信息字段。field 可选值：short_intro / synopsis / background_rules / focus_requirements / forbidden_requirements。content 覆盖原有内容（非追加）。传入无效 field 会返回 error 和可选值列表。"""
        valid_fields = {
            "short_intro",
            "synopsis",
            "background_rules",
            "focus_requirements",
            "forbidden_requirements",
        }
        if field not in valid_fields:
            return json.dumps(
                {"error": f"不支持的字段 {field}，可选：{', '.join(sorted(valid_fields))}"},
                ensure_ascii=False,
            )
        async with self._db_lock:
            try:
                result = await self.db.execute(select(Work).where(Work.id == self.work_id))
                work = result.scalar_one_or_none()
                if work is None:
                    return json.dumps({"error": "work not found"}, ensure_ascii=False)
                setattr(work, field, content)
                await self.db.commit()
                return json.dumps(
                    {"field": field, "value": content, "updated_at": work.updated_at.isoformat()},
                    ensure_ascii=False,
                )
            except Exception:
                await self.db.rollback()
                raise

    async def list_prompt_categories(self) -> str:
        """列出所有可用的写作提示词分类。返回每个分类的 id、名称、包含的激活提示词数量。当用户正在进行特定类型/题材的创作，或需要写作技巧指导时，先调用此工具了解有哪些分类可用。"""
        categories = (await self.db.execute(
            select(WritingPromptCategory)
            .where(WritingPromptCategory.is_active.is_(True))
            .order_by(WritingPromptCategory.sort_order, WritingPromptCategory.created_at)
        )).scalars().all()
        count_rows = (await self.db.execute(
            select(WritingPrompt.category_id, func.count())
            .where(WritingPrompt.is_active.is_(True))
            .group_by(WritingPrompt.category_id)
        )).all()
        counts = {cid: c for cid, c in count_rows}
        items = [{"id": cat.id, "name": cat.name, "prompt_count": counts.get(cat.id, 0)} for cat in categories]
        return json.dumps(items, ensure_ascii=False)

    async def list_prompts_by_category(self, category_id: str) -> str:
        """获取指定分类下的写作提示词列表。返回每个提示词的 id、标题、简要描述。浏览分类后，根据创作需求选择合适的提示词，再用 get_prompt_detail 获取完整内容。"""
        cat = await self.db.get(WritingPromptCategory, category_id)
        if cat is None or not cat.is_active:
            return json.dumps({"error": "category not found or inactive"}, ensure_ascii=False)
        result = await self.db.execute(
            select(WritingPrompt)
            .where(
                WritingPrompt.category_id == category_id,
                WritingPrompt.is_active.is_(True),
            )
            .order_by(WritingPrompt.created_at)
        )
        prompts = result.scalars().all()
        items = [{"id": p.id, "title": p.title, "description": p.description} for p in prompts]
        return json.dumps(items, ensure_ascii=False)

    async def get_prompt_detail(self, prompt_id: str) -> str:
        """获取指定写作提示词的完整详细内容。获取后请认真阅读并按照其中的指导进行创作。返回完整 Markdown 格式的写作提示文本。"""
        result = await self.db.execute(
            select(WritingPrompt)
            .join(WritingPromptCategory, WritingPrompt.category_id == WritingPromptCategory.id)
            .where(
                WritingPrompt.id == prompt_id,
                WritingPrompt.is_active.is_(True),
                WritingPromptCategory.is_active.is_(True),
            )
        )
        prompt = result.scalar_one_or_none()
        if prompt is None:
            return json.dumps({"error": "prompt not found or inactive"}, ensure_ascii=False)
        return json.dumps(
            {"title": prompt.title, "detail_prompt": prompt.detail_prompt}, ensure_ascii=False
        )


def create_agent(
    model,
    work: Work,
    db_session: AsyncSession,
    work_id: str,
    agno_session_id: str,
    tool_db_session: AsyncSession | None = None,
    thinking_intensity: float | None = None,
) -> Agent:
    settings = get_settings()
    toolkit = GoodguaTools(db=tool_db_session or db_session, work_id=work_id, session_id=agno_session_id)
    prompt = build_system_prompt(work)
    model_cls = DeepSeek if "deepseek" in model.provider_model_id.lower() else OpenAIChat
    model_kwargs: dict = dict(
        id=model.provider_model_id,
        base_url=settings.ai_provider_base_url,
        api_key=settings.ai_provider_api_key,
        temperature=float(model.temperature),
        max_tokens=model.max_output_tokens,
        role_map={"system": "system", "user": "user", "assistant": "assistant", "tool": "tool"},
    )
    if thinking_intensity is not None and thinking_intensity > 0:
        reasoning_effort = "max" if thinking_intensity > 0.66 else "high"
        model_kwargs["reasoning_effort"] = reasoning_effort
        model_kwargs["extra_body"] = {"thinking": {"type": "enabled"}}
    return Agent(
        model=model_cls(**model_kwargs),
        tools=[toolkit],
        instructions=prompt,
        db=get_agent_db(settings.database_url),
        session_id=agno_session_id,
        add_history_to_context=True,
        num_history_runs=10,
    )
