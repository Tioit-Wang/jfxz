from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChapterVersion


def _count_words(value: str) -> int:
    return len("".join(value.split()))


async def _next_version_number(session: AsyncSession, chapter_id: str) -> int:
    result = await session.execute(
        select(func.coalesce(func.max(ChapterVersion.version_number), 0)).where(
            ChapterVersion.chapter_id == chapter_id
        )
    )
    return result.scalar_one() + 1


async def create_version_snapshot(
    session: AsyncSession,
    chapter_id: str,
    title: str,
    content: str,
    summary: str | None,
    source: str,
    source_detail: str | None = None,
) -> ChapterVersion:
    num = await _next_version_number(session, chapter_id)
    version = ChapterVersion(
        chapter_id=chapter_id,
        version_number=num,
        title=title,
        content=content,
        summary=summary,
        source=source,
        source_detail=source_detail,
        word_count=_count_words(content),
    )
    session.add(version)
    await session.flush()
    return version


_MERGE_WINDOW_SECONDS = 300  # 5 minutes


async def get_or_create_human_version(
    session: AsyncSession,
    chapter_id: str,
    title: str,
    content: str,
    summary: str | None,
) -> ChapterVersion:
    result = await session.execute(
        select(ChapterVersion)
        .where(
            ChapterVersion.chapter_id == chapter_id,
            ChapterVersion.source == "human",
        )
        .order_by(ChapterVersion.version_number.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        ai_after = await session.execute(
            select(func.count()).select_from(ChapterVersion).where(
                ChapterVersion.chapter_id == chapter_id,
                ChapterVersion.source == "ai",
                ChapterVersion.version_number > existing.version_number,
            )
        )
        has_ai_insertion = ai_after.scalar_one() > 0

        now_utc = datetime.now(UTC)
        should_merge = False

        if has_ai_insertion:
            pass
        elif existing.created_at.tzinfo is None:
            elapsed = (datetime.utcnow() - existing.created_at).total_seconds()
            if elapsed <= _MERGE_WINDOW_SECONDS:
                should_merge = True
        else:
            elapsed = (now_utc - existing.created_at).total_seconds()
            if elapsed <= _MERGE_WINDOW_SECONDS:
                should_merge = True

        if should_merge:
            existing.title = title
            existing.content = content
            existing.summary = summary
            existing.word_count = _count_words(content)
            existing.updated_at = now_utc if existing.created_at.tzinfo else datetime.utcnow()
            await session.flush()
            return existing

    return await create_version_snapshot(
        session, chapter_id, title, content, summary, source="human"
    )


async def get_max_version_number(session: AsyncSession, chapter_id: str) -> int:
    result = await session.execute(
        select(func.coalesce(func.max(ChapterVersion.version_number), 0)).where(
            ChapterVersion.chapter_id == chapter_id
        )
    )
    return result.scalar_one()


async def get_chapter_versions(
    session: AsyncSession,
    chapter_id: str,
    limit: int = 20,
    cursor: int | None = None,
) -> tuple[list[ChapterVersion], int, bool]:
    total_result = await session.execute(
        select(func.count()).select_from(ChapterVersion).where(
            ChapterVersion.chapter_id == chapter_id
        )
    )
    total = total_result.scalar_one()

    q = (
        select(ChapterVersion)
        .where(ChapterVersion.chapter_id == chapter_id)
        .order_by(ChapterVersion.version_number.desc())
    )
    if cursor is not None:
        q = q.where(ChapterVersion.version_number < cursor)
    q = q.limit(limit + 1)

    result = await session.execute(q)
    rows = list(result.scalars().all())
    has_more = len(rows) > limit
    items = rows[:limit]

    return items, total, has_more


async def get_version_content(
    session: AsyncSession, version_id: str
) -> ChapterVersion | None:
    result = await session.execute(
        select(ChapterVersion).where(ChapterVersion.id == version_id)
    )
    return result.scalar_one_or_none()


async def restore_version(
    session: AsyncSession,
    chapter_id: str,
    version_id: str,
) -> ChapterVersion | None:
    from app.models import Chapter

    version = await get_version_content(session, version_id)
    if version is None or version.chapter_id != chapter_id:
        return None

    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id)
    )
    chapter = chapter_result.scalar_one_or_none()
    if chapter is None:
        return None

    chapter.title = version.title
    chapter.content = version.content
    chapter.summary = version.summary
    await session.flush()

    new_version = await create_version_snapshot(
        session,
        chapter_id,
        version.title,
        version.content,
        version.summary,
        source="human",
        source_detail=f"restored from v{version.version_number}",
    )
    return new_version
