"""VIP daily points scheduler: grant at 5:00 CST, expire previous day's remainder.

Processes each subscription in its own transaction so a single failure
does not roll back all other subscriptions.
"""

import logging
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointAccount, UserSubscription

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _process_subscription(session: AsyncSession, sub_id: str) -> None:
    """Process a single subscription: expire old points, grant new, or mark expired."""
    from app.services.billing_service import expire_vip_daily_points, grant_vip_daily_points

    now_utc = datetime.now(UTC)

    sub = await session.get(UserSubscription, sub_id)
    if sub is None or sub.status != "active":
        return

    account_result = await session.execute(
        select(PointAccount).where(PointAccount.user_id == sub.user_id)
    )
    account = account_result.scalar_one_or_none()
    if account is None:
        return

    # Check if subscription has expired
    if sub.end_at <= now_utc:
        remaining = account.vip_daily_points_balance
        if remaining > 0:
            await expire_vip_daily_points(session, sub.user_id, remaining, source_id=sub.id)
        sub.status = "expired"
        logger.info("Subscription %s expired for user %s", sub.id, sub.user_id)
        return

    # Expire unused VIP daily points from yesterday
    remaining = account.vip_daily_points_balance
    if remaining > 0:
        await expire_vip_daily_points(session, sub.user_id, remaining, source_id=sub.id)

    # Grant today's VIP daily points
    daily_points = sub.daily_vip_points_snapshot
    if daily_points and daily_points > 0:
        await grant_vip_daily_points(session, sub.user_id, daily_points, source_id=sub.id)
        logger.info(
            "Granted %d VIP daily points to user %s (sub %s)",
            daily_points,
            sub.user_id,
            sub.id,
        )


async def daily_vip_grant_task(session_factory) -> None:
    """Run at 5:00 CST every day.

    Queries all active subscription IDs first, then processes each in its own
    session + transaction. One failing subscription does not affect others.
    """
    # Collect all active subscription IDs in a read-only pass
    async with session_factory() as read_session:
        result = await read_session.execute(
            select(UserSubscription.id).where(UserSubscription.status == "active")
        )
        sub_ids = [row[0] for row in result.all()]

    if not sub_ids:
        logger.info("No active subscriptions to process")
        return

    logger.info("Processing %d active subscriptions", len(sub_ids))
    failed = 0

    for sub_id in sub_ids:
        async with session_factory() as session:
            try:
                await _process_subscription(session, sub_id)
                await session.commit()
            except Exception:
                await session.rollback()
                failed += 1
                logger.error("Failed to process subscription %s", sub_id, exc_info=True)

    if failed:
        logger.warning("Scheduler finished: %d/%d subscriptions failed", failed, len(sub_ids))
    else:
        logger.info("Scheduler finished: all %d subscriptions processed", len(sub_ids))


def start_scheduler(session_factory) -> AsyncIOScheduler:
    """Initialize and start the APScheduler with the daily VIP grant task."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")

    async def _run_daily_grant():
        await daily_vip_grant_task(session_factory)

    # Run at 5:00 AM Beijing time every day
    _scheduler.add_job(
        _run_daily_grant,
        trigger=CronTrigger(hour=5, minute=0, timezone="Asia/Shanghai"),
        id="daily_vip_grant",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("VIP daily points scheduler started (5:00 CST daily)")
    return _scheduler


def stop_scheduler() -> None:
    """Shutdown the scheduler."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
