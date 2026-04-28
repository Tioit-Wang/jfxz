"""VIP daily points scheduler: grant at 5:00 CST, expire previous day's remainder."""

import logging
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointAccount, UserSubscription

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def _get_beijing_offset() -> timedelta:
    """CST is UTC+8."""
    return timedelta(hours=8)


async def daily_vip_grant_task(session: AsyncSession) -> None:
    """Run at 5:00 CST every day.

    For each active subscription:
    1. Expire unused VIP daily points from the previous day.
    2. Grant today's VIP daily points.
    3. Check for expired subscriptions.
    """
    now_utc = datetime.now(UTC)

    # Find all active subscriptions that haven't ended yet
    result = await session.execute(
        select(UserSubscription).where(
            UserSubscription.status == "active",
        )
    )
    subscriptions = result.scalars().all()

    for sub in subscriptions:
        account_result = await session.execute(
            select(PointAccount).where(PointAccount.user_id == sub.user_id)
        )
        account = account_result.scalar_one_or_none()
        if account is None:
            continue

        # Check if subscription has expired (end_at has passed)
        if sub.end_at <= now_utc:
            # Expire remaining VIP daily points
            remaining = account.vip_daily_points_balance
            if remaining > 0:
                from app.services.billing_service import expire_vip_daily_points
                await expire_vip_daily_points(session, sub.user_id, remaining, source_id=sub.id)

            # Mark subscription as expired
            sub.status = "expired"
            logger.info("Subscription %s expired for user %s", sub.id, sub.user_id)
            continue

        # Expire unused VIP daily points from yesterday
        remaining = account.vip_daily_points_balance
        if remaining > 0:
            from app.services.billing_service import expire_vip_daily_points
            await expire_vip_daily_points(session, sub.user_id, remaining, source_id=sub.id)

        # Grant today's VIP daily points
        daily_points = sub.daily_vip_points_snapshot
        if daily_points and daily_points > 0:
            from app.services.billing_service import grant_vip_daily_points
            await grant_vip_daily_points(session, sub.user_id, daily_points, source_id=sub.id)
            logger.info(
                "Granted %d VIP daily points to user %s (sub %s)",
                daily_points, sub.user_id, sub.id,
            )

    await session.commit()


def start_scheduler(session_factory) -> AsyncIOScheduler:
    """Initialize and start the APScheduler with the daily VIP grant task."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")

    async def _run_daily_grant():
        async with session_factory() as session:
            await daily_vip_grant_task(session)

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
