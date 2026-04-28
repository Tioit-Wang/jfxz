"""Billing service: pre-check balance, deduct points, grant/expire points."""

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AiModel, PointAccount, PointTransaction

ZERO = Decimal("0")
MIN_COST = Decimal("0.01")


async def _ensure_point_account(session: AsyncSession, user_id: str) -> PointAccount:
    result = await session.execute(select(PointAccount).where(PointAccount.user_id == user_id))
    account = result.scalar_one_or_none()
    if account is None:
        account = PointAccount(user_id=user_id)
        session.add(account)
        await session.flush()
    return account


_ONE_MILLION = Decimal("1000000")
_HUNDRED = Decimal("100")
_CENTS = Decimal("0.01")


def _calculate_cost(
    cache_hit_tokens: int,
    cache_miss_tokens: int,
    completion_tokens: int,
    cache_hit_multiplier: Decimal,
    cache_miss_multiplier: Decimal,
    output_multiplier: Decimal,
) -> Decimal:
    hit_cost = (Decimal(cache_hit_tokens) / _ONE_MILLION) * _HUNDRED * cache_hit_multiplier
    miss_cost = (Decimal(cache_miss_tokens) / _ONE_MILLION) * _HUNDRED * cache_miss_multiplier
    out_cost = (Decimal(completion_tokens) / _ONE_MILLION) * _HUNDRED * output_multiplier
    raw_cost = hit_cost + miss_cost + out_cost
    return raw_cost.quantize(_CENTS, rounding="ROUND_CEILING")


def _cost_to_deduct(cost: Decimal) -> Decimal:
    return max(cost, MIN_COST)


PRE_CHECK_OUTPUT_RATIO = Decimal("0.20")  # 预估输出为模型最大输出的 20%


async def pre_check_balance(
    session: AsyncSession,
    user_id: str,
    model: AiModel,
    estimated_input_tokens: int,
) -> None:
    account = await _ensure_point_account(session, user_id)

    estimated_output = int(model.max_output_tokens * PRE_CHECK_OUTPUT_RATIO)
    max_cost = _calculate_cost(
        cache_hit_tokens=0,
        cache_miss_tokens=estimated_input_tokens,
        completion_tokens=estimated_output,
        cache_hit_multiplier=model.cache_hit_input_multiplier,
        cache_miss_multiplier=model.cache_miss_input_multiplier,
        output_multiplier=model.output_multiplier,
    )

    total_balance = account.vip_daily_points_balance + account.credit_pack_points_balance
    if total_balance < max_cost:
        raise HTTPException(status_code=402, detail="insufficient balance")


async def _get_total_balance(session: AsyncSession, user_id: str) -> Decimal:
    account = await _ensure_point_account(session, user_id)
    return account.vip_daily_points_balance + account.credit_pack_points_balance


async def _lock_point_account(session: AsyncSession, user_id: str) -> PointAccount:
    """Acquire a row lock on the user's point account to prevent concurrent deductions."""

    result = await session.execute(
        select(PointAccount).where(PointAccount.user_id == user_id).with_for_update()
    )
    account = result.scalar_one_or_none()
    if account is None:
        account = PointAccount(user_id=user_id)
        session.add(account)
        await session.flush()
        result = await session.execute(
            select(PointAccount).where(PointAccount.user_id == user_id).with_for_update()
        )
        account = result.scalar_one()
    return account


async def deduct_by_usage(
    session: AsyncSession,
    user_id: str,
    model: AiModel,
    usage: dict,
    work_id: str,
    source_id: str,
    source_type: str = "ai_chat",
) -> None:
    """Deduct points based on actual token usage.

    Creates separate PointTransaction rows per bucket (vip_daily then credit_pack),
    each with a balance_after snapshot.
    Uses row-level locking to prevent race conditions.
    """
    account = await _lock_point_account(session, user_id)

    # prompt_tokens is total input (includes cache hit); subtract cached to get miss
    cache_hit_tokens = int(usage.get("cached_tokens", 0))
    prompt_tokens = int(usage.get("prompt_tokens", 0))
    completion_tokens = int(usage.get("completion_tokens", 0))
    cache_miss_tokens = max(0, prompt_tokens - cache_hit_tokens)

    cost = _cost_to_deduct(
        _calculate_cost(
            cache_hit_tokens=cache_hit_tokens,
            cache_miss_tokens=cache_miss_tokens,
            completion_tokens=completion_tokens,
            cache_hit_multiplier=model.cache_hit_input_multiplier,
            cache_miss_multiplier=model.cache_miss_input_multiplier,
            output_multiplier=model.output_multiplier,
        )
    )

    total_balance = account.vip_daily_points_balance + account.credit_pack_points_balance
    if total_balance < cost:
        raise HTTPException(status_code=402, detail="insufficient balance")

    vip_available = account.vip_daily_points_balance
    vip_deduction = ZERO
    pack_deduction = ZERO

    if vip_available >= cost:
        vip_deduction = cost
    elif vip_available > ZERO:
        vip_deduction = vip_available
        pack_deduction = cost - vip_deduction
    else:
        pack_deduction = cost

    common_fields = dict(
        change_type="consume",
        source_type=source_type,
        source_id=source_id,
        work_id=work_id,
        model_id=model.id,
        model_name_snapshot=model.display_name,
        provider_model_id_snapshot=model.provider_model_id,
        prompt_cache_hit_tokens=cache_hit_tokens,
        prompt_cache_miss_tokens=cache_miss_tokens,
        completion_tokens=completion_tokens,
        cache_hit_input_multiplier_snapshot=model.cache_hit_input_multiplier,
        cache_miss_input_multiplier_snapshot=model.cache_miss_input_multiplier,
        output_multiplier_snapshot=model.output_multiplier,
    )

    if vip_deduction > ZERO:
        account.vip_daily_points_balance -= vip_deduction
        await session.flush()

        balance_after = account.vip_daily_points_balance + account.credit_pack_points_balance
        session.add(PointTransaction(
            user_id=user_id,
            bucket_type="vip_daily",
            points_delta=-vip_deduction,
            balance_after=balance_after,
            **common_fields,
        ))

    if pack_deduction > ZERO:
        account.credit_pack_points_balance -= pack_deduction
        await session.flush()

        balance_after = account.vip_daily_points_balance + account.credit_pack_points_balance
        session.add(PointTransaction(
            user_id=user_id,
            bucket_type="credit_pack",
            points_delta=-pack_deduction,
            balance_after=balance_after,
            **common_fields,
        ))


async def grant_vip_daily_points(
    session: AsyncSession,
    user_id: str,
    points: int,
    source_id: str | None = None,
) -> None:
    """Grant daily VIP points (from scheduler or first purchase)."""
    account = await _ensure_point_account(session, user_id)
    account.vip_daily_points_balance += Decimal(str(points))
    await session.flush()

    balance_after = await _get_total_balance(session, user_id)
    session.add(PointTransaction(
        user_id=user_id,
        bucket_type="vip_daily",
        change_type="grant",
        source_type="plan_vip_daily",
        source_id=source_id,
        points_delta=Decimal(str(points)),
        balance_after=balance_after,
    ))


async def expire_vip_daily_points(
    session: AsyncSession,
    user_id: str,
    remaining: Decimal,
    source_id: str | None = None,
) -> None:
    """Expire unused VIP daily points (daily cleanup at 5:00)."""
    if remaining <= ZERO:
        return
    account = await _ensure_point_account(session, user_id)
    actual = min(account.vip_daily_points_balance, remaining)
    if actual <= ZERO:
        return
    account.vip_daily_points_balance -= actual
    await session.flush()

    balance_after = await _get_total_balance(session, user_id)
    session.add(PointTransaction(
        user_id=user_id,
        bucket_type="vip_daily",
        change_type="expire",
        source_type="vip_daily_expire",
        source_id=source_id,
        points_delta=-actual,
        balance_after=balance_after,
    ))


async def grant_credit_pack_points(
    session: AsyncSession,
    user_id: str,
    points: int,
    source_id: str | None = None,
) -> None:
    """Grant credit pack points (purchase). Permanently valid, no expire_at."""
    account = await _ensure_point_account(session, user_id)
    account.credit_pack_points_balance += Decimal(str(points))
    await session.flush()

    balance_after = await _get_total_balance(session, user_id)
    session.add(PointTransaction(
        user_id=user_id,
        bucket_type="credit_pack",
        change_type="grant",
        source_type="credit_pack",
        source_id=source_id,
        points_delta=Decimal(str(points)),
        balance_after=balance_after,
    ))


async def admin_adjust_points(
    session: AsyncSession,
    user_id: str,
    bucket_type: str,
    change_type: str,
    amount: Decimal,
    reason: str | None = None,
) -> PointTransaction:
    """Admin balance adjustment: grant (recharge) or deduct points."""
    account = await _ensure_point_account(session, user_id)

    if change_type == "grant":
        delta = amount
        if bucket_type == "vip_daily":
            account.vip_daily_points_balance += amount
        else:
            account.credit_pack_points_balance += amount
        await session.flush()
    else:
        delta = -amount
        balance_col = (
            PointAccount.vip_daily_points_balance
            if bucket_type == "vip_daily"
            else PointAccount.credit_pack_points_balance
        )
        result = await session.execute(
            update(PointAccount)
            .where(
                PointAccount.user_id == user_id,
                balance_col >= amount,
            )
            .values(**{
                ("vip_daily_points_balance" if bucket_type == "vip_daily"
                 else "credit_pack_points_balance"): balance_col - amount,
            })
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=422, detail="insufficient balance")
        await session.flush()

    balance_after = await _get_total_balance(session, user_id)
    tx = PointTransaction(
        user_id=user_id,
        bucket_type=bucket_type,
        change_type="adjust",
        source_type="admin_adjust",
        points_delta=delta,
        balance_after=balance_after,
        description=reason,
    )
    session.add(tx)
    return tx
