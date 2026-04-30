from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="user", index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    point_account: Mapped["PointAccount"] = relationship(cascade="all, delete-orphan")


class LoginAudit(Base):
    __tablename__ = "login_audits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(200), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    role: Mapped[str | None] = mapped_column(String(20), index=True)
    success: Mapped[bool] = mapped_column(Boolean, index=True)
    reason: Mapped[str] = mapped_column(String(100))
    ip_address: Mapped[str | None] = mapped_column(String(100), index=True)
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class Work(Base, TimestampMixin):
    __tablename__ = "works"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    short_intro: Mapped[str] = mapped_column(Text, default="")
    synopsis: Mapped[str] = mapped_column(Text, default="")
    genre_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    background_rules: Mapped[str] = mapped_column(Text, default="")
    focus_requirements: Mapped[str | None] = mapped_column(Text)
    forbidden_requirements: Mapped[str | None] = mapped_column(Text)

    chapters: Mapped[list["Chapter"]] = relationship(cascade="all, delete-orphan")


class Character(Base, TimestampMixin):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    work_id: Mapped[str] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    summary: Mapped[str] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text)


class SettingItem(Base, TimestampMixin):
    __tablename__ = "settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    work_id: Mapped[str] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    summary: Mapped[str] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text)


class Chapter(Base, TimestampMixin):
    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("work_id", "order_index"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    work_id: Mapped[str] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), index=True)
    order_index: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str | None] = mapped_column(Text)


class ChatSession(Base, TimestampMixin):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    work_id: Mapped[str] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    agno_session_id: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    source_type: Mapped[str] = mapped_column(String(30), default="manual")
    last_message_preview: Mapped[str | None] = mapped_column(Text)
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, index=True
    )


class AgentRunStore(Base):
    __tablename__ = "agent_run_store"

    session_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36))
    runs: Mapped[list[dict]] = mapped_column(JSON, default=list)


class AiModel(Base, TimestampMixin):
    __tablename__ = "ai_models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    display_name: Mapped[str] = mapped_column(String(100))
    provider_model_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    logic_score: Mapped[int] = mapped_column(Integer)
    prose_score: Mapped[int] = mapped_column(Integer)
    knowledge_score: Mapped[int] = mapped_column(Integer)
    max_context_tokens: Mapped[int] = mapped_column(Integer)
    max_output_tokens: Mapped[int] = mapped_column(Integer)
    temperature: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0.70"))
    input_cost_per_million: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    cache_hit_input_cost_per_million: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    output_cost_per_million: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    profit_multiplier: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("1.10"))
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    sort_order: Mapped[int | None] = mapped_column(Integer, index=True)


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(100))
    price_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(10), default="CNY")
    billing_cycle_months: Mapped[int] = mapped_column(Integer, default=1)
    daily_vip_points: Mapped[int] = mapped_column(Integer)
    bundled_credit_pack_points: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    sort_order: Mapped[int | None] = mapped_column(Integer)


class CreditPack(Base, TimestampMixin):
    __tablename__ = "credit_packs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(100))
    price_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(10), default="CNY")
    points: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    sort_order: Mapped[int | None] = mapped_column(Integer)


class BillingOrder(Base, TimestampMixin):
    __tablename__ = "billing_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    order_no: Mapped[str] = mapped_column(String(50), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_type: Mapped[str] = mapped_column(String(30))
    product_id: Mapped[str] = mapped_column(String(36))
    product_name_snapshot: Mapped[str] = mapped_column(String(200))
    daily_vip_points_snapshot: Mapped[int | None] = mapped_column(Integer)
    bundled_credit_pack_points_snapshot: Mapped[int | None] = mapped_column(Integer)
    credit_pack_points_snapshot: Mapped[int | None] = mapped_column(Integer)
    duration_days_snapshot: Mapped[int | None] = mapped_column(Integer)
    pay_channel: Mapped[str | None] = mapped_column(String(30))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(10), default="CNY")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PaymentRecord(Base, TimestampMixin):
    __tablename__ = "payment_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    order_id: Mapped[str] = mapped_column(
        ForeignKey("billing_orders.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(30), default="alipay_f2f", index=True)
    out_trade_no: Mapped[str] = mapped_column(String(50), unique=True)
    trade_no: Mapped[str | None] = mapped_column(String(100), index=True)
    channel_status: Mapped[str | None] = mapped_column(String(30), index=True)
    qr_code: Mapped[str | None] = mapped_column(Text)
    notify_verified: Mapped[bool | None] = mapped_column(Boolean)
    last_notify_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_notify_payload: Mapped[dict | None] = mapped_column(JSON)


class PaymentNotifyLog(Base):
    __tablename__ = "payment_notify_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    payment_record_id: Mapped[str | None] = mapped_column(ForeignKey("payment_records.id"))
    channel: Mapped[str] = mapped_column(String(30), default="alipay_f2f")
    out_trade_no: Mapped[str | None] = mapped_column(String(50), index=True)
    trade_no: Mapped[str | None] = mapped_column(String(100), index=True)
    notify_body: Mapped[dict] = mapped_column(JSON)
    verify_result: Mapped[str] = mapped_column(String(20))
    process_result: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class UserSubscription(Base, TimestampMixin):
    __tablename__ = "user_subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"), index=True)
    order_id: Mapped[str | None] = mapped_column(ForeignKey("billing_orders.id"))
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_renew_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    daily_vip_points_snapshot: Mapped[int] = mapped_column(Integer)
    duration_days_snapshot: Mapped[int] = mapped_column(Integer)


class PointAccount(Base):
    __tablename__ = "point_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    vip_daily_points_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    credit_pack_points_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0")
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    bucket_type: Mapped[str] = mapped_column(String(20), index=True)
    change_type: Mapped[str] = mapped_column(String(20))
    source_type: Mapped[str] = mapped_column(String(50))
    source_id: Mapped[str | None] = mapped_column(String(36))
    points_delta: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    work_id: Mapped[str | None] = mapped_column(String(36))
    model_id: Mapped[str | None] = mapped_column(String(36))
    model_name_snapshot: Mapped[str | None] = mapped_column(String(100))
    provider_model_id_snapshot: Mapped[str | None] = mapped_column(String(100))
    prompt_cache_hit_tokens: Mapped[int | None] = mapped_column(Integer)
    prompt_cache_miss_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    input_cost_per_million_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    cache_hit_input_cost_per_million_snapshot: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4)
    )
    output_cost_per_million_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    profit_multiplier_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    points_per_cny_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    balance_after: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    description: Mapped[str | None] = mapped_column(String(500))
    expire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class GlobalConfig(Base, TimestampMixin):
    __tablename__ = "global_configs"
    __table_args__ = (UniqueConstraint("config_group", "config_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    config_group: Mapped[str] = mapped_column(String(100), index=True)
    config_key: Mapped[str] = mapped_column(String(100))
    value_type: Mapped[str] = mapped_column(String(30), index=True)
    string_value: Mapped[str | None] = mapped_column(Text)
    integer_value: Mapped[int | None] = mapped_column(Integer)
    decimal_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    boolean_value: Mapped[bool | None] = mapped_column(Boolean)
    json_value: Mapped[dict | None] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
