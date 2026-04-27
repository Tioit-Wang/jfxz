import hashlib
import hmac
import json
import secrets
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, EmailStr, Field, ValidationError
from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import (
    hash_password,
    issue_token,
    password_needs_rehash,
    read_token,
    verify_password,
)
from app.models import (
    AgentSession,
    BillingOrder,
    Chapter,
    Character,
    ChatSession,
    GlobalConfig,
    LoginAudit,
    PaymentNotifyLog,
    PaymentRecord,
    Plan,
    PointAccount,
    PointTransaction,
    SettingItem,
    TopupPack,
    User,
    UserSubscription,
    Work,
    now,
)

router = APIRouter()
REFERENCE_LIMIT = 20
USER_COOKIE = "jfxz_session"
ADMIN_COOKIE = "jfxz_admin_session"
CSRF_COOKIE = "jfxz_csrf"
SECRET_MASK = "******"
MAX_LOGIN_FAILURES = 5
LOGIN_LOCK_SECONDS = 15 * 60
UNSAFE_METHODS = {"POST", "PATCH", "DELETE"}
_login_failures: dict[tuple[str, str, str], list[datetime]] = {}


class RegisterIn(BaseModel):
    email: EmailStr
    nickname: str | None = None
    password: str = Field(min_length=8, max_length=128)


class EmailLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class WorkIn(BaseModel):
    title: str = Field(default="", max_length=200)
    short_intro: str = Field(default="", max_length=2000)
    synopsis: str = Field(default="", max_length=20000)
    genre_tags: list[str] = Field(default_factory=list, max_length=20)
    background_rules: str = Field(default="", max_length=20000)
    focus_requirements: str | None = Field(default=None, max_length=10000)
    forbidden_requirements: str | None = Field(default=None, max_length=10000)


class NamedContentIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    summary: str = Field(min_length=1, max_length=4000)
    detail: str | None = Field(default=None, max_length=20000)
    type: str | None = Field(default=None, max_length=50)


class ChapterIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=200000)
    summary: str | None = Field(default=None, max_length=4000)
    order_index: int | None = None


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    mentions: list[dict[str, Any]] = Field(default_factory=list, max_length=REFERENCE_LIMIT)
    references: list[dict[str, Any]] = Field(default_factory=list, max_length=REFERENCE_LIMIT)


class AnalyzeIn(BaseModel):
    content: str = Field(default="", max_length=200000)


class AnalyzeSuggestion(BaseModel):
    quote: str = Field(min_length=1, max_length=2000)
    issue: str = Field(min_length=1, max_length=2000)
    options: list[str] = Field(default_factory=list, max_length=5)


class AnalyzeOut(BaseModel):
    suggestions: list[AnalyzeSuggestion] = Field(default_factory=list, max_length=20)


class ChatSessionIn(BaseModel):
    title: str = Field(default="新的对话", min_length=1, max_length=200)
    source_type: str = Field(default="manual", max_length=30)


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price_amount: Decimal
    monthly_points: int = 0
    bundled_topup_points: int = 0
    points: int = 0
    expire_days: int = 30
    status: str = "active"
    sort_order: int | None = None


class OrderIn(BaseModel):
    product_type: str
    product_id: str


class ConfigValueIn(BaseModel):
    string_value: str | None = None
    integer_value: int | None = None
    decimal_value: Decimal | None = None
    boolean_value: bool | None = None
    json_value: dict[str, Any] | None = None


class UserPatch(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=100)
    status: str | None = Field(default=None, max_length=20)


async def paginated(
    session: AsyncSession,
    statement: Select[tuple[Any, ...]],
    page: int,
    page_size: int,
) -> tuple[list[Any], int]:
    total = await session.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    result = await session.execute(statement.limit(page_size).offset((page - 1) * page_size))
    return result.all(), int(total or 0)


def page_response(items: list[dict[str, Any]], total: int, page: int, page_size: int) -> dict[str, Any]:
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def public(model: Any) -> dict[str, Any]:
    data = {column.name: getattr(model, column.name) for column in model.__table__.columns}
    if "password_hash" in data:
        del data["password_hash"]
    return data


def public_config(config: GlobalConfig) -> dict[str, Any]:
    data = public(config)
    if data["value_type"] == "secret" and data["string_value"]:
        data["string_value"] = SECRET_MASK
    return data


def csrf_signature(nonce: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), nonce.encode("ascii"), hashlib.sha256).hexdigest()


def issue_csrf_token() -> str:
    nonce = secrets.token_urlsafe(32)
    return f"{nonce}.{csrf_signature(nonce, get_settings().jwt_secret)}"


def valid_csrf_token(token: str) -> bool:
    parts = token.split(".")
    if len(parts) != 2:
        return False
    nonce, signature = parts
    if not nonce or not signature:
        return False
    expected = csrf_signature(nonce, get_settings().jwt_secret)
    return hmac.compare_digest(signature, expected)


def set_csrf_cookie(response: Response) -> str:
    token = issue_csrf_token()
    response.set_cookie(
        CSRF_COOKIE,
        token,
        max_age=get_settings().user_session_seconds,
        httponly=False,
        secure=get_settings().is_production,
        samesite="lax",
        path="/",
    )
    return token


def clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(CSRF_COOKIE, path="/", httponly=False, samesite="lax", secure=get_settings().is_production)


def request_origin_allowed(request: Request) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return True
    return origin in get_settings().cors_origin_list


def request_needs_csrf(request: Request) -> bool:
    if request.method not in UNSAFE_METHODS:
        return False
    if request.url.path == "/csrf":
        return False
    authorization = request.headers.get("authorization", "")
    if authorization.startswith("Bearer ") and not get_settings().is_production:
        return False
    return bool(request.headers.get("origin"))


async def csrf_protect(request: Request, call_next: Any) -> Response:
    if request.method in UNSAFE_METHODS and not request_origin_allowed(request):
        return JSONResponse(status_code=403, content={"detail": "origin not allowed"})
    if request_needs_csrf(request):
        header_token = request.headers.get("x-csrf-token")
        cookie_token = request.cookies.get(CSRF_COOKIE)
        if not header_token or not cookie_token or not hmac.compare_digest(header_token, cookie_token):
            return JSONResponse(status_code=403, content={"detail": "invalid csrf token"})
        if not valid_csrf_token(header_token):
            return JSONResponse(status_code=403, content={"detail": "invalid csrf token"})
    return await call_next(request)


async def one(session: AsyncSession, statement: Select[Any]) -> Any:
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def must_get(session: AsyncSession, model: type[Any], item_id: str) -> Any:
    item = await session.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="not found")
    return item


async def must_get_in_work(session: AsyncSession, model: type[Any], item_id: str, work_id: str) -> Any:
    item = await one(session, select(model).where(model.id == item_id, model.work_id == work_id))
    if item is None:
        raise HTTPException(status_code=404, detail="not found")
    return item


def client_ip(request: Request) -> str:
    remote_host = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for and remote_host in get_settings().trusted_proxy_ip_set:
        return forwarded_for.split(",")[0].strip()
    return remote_host


def login_key(request: Request, email: str, scope: str) -> tuple[str, str, str]:
    return scope, email.lower(), client_ip(request)


def assert_login_not_locked(request: Request, email: str, scope: str) -> None:
    key = login_key(request, email, scope)
    cutoff = now() - timedelta(seconds=LOGIN_LOCK_SECONDS)
    attempts = [attempt for attempt in _login_failures.get(key, []) if attempt > cutoff]
    _login_failures[key] = attempts
    if len(attempts) >= MAX_LOGIN_FAILURES:
        raise HTTPException(status_code=429, detail="too many login attempts")


def remember_login_failure(request: Request, email: str, scope: str) -> None:
    key = login_key(request, email, scope)
    _login_failures.setdefault(key, []).append(now())


def clear_login_failures(request: Request, email: str, scope: str) -> None:
    _login_failures.pop(login_key(request, email, scope), None)


async def record_login_audit(
    session: AsyncSession,
    request: Request,
    email: str,
    role: str,
    success: bool,
    reason: str,
    user: User | None = None,
) -> None:
    session.add(
        LoginAudit(
            email=email,
            user_id=user.id if user else None,
            role=role,
            success=success,
            reason=reason,
            ip_address=client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )


async def create_user_account(
    session: AsyncSession,
    email: str,
    password: str,
    nickname: str | None = None,
    role: str = "user",
) -> User:
    user = User(
        email=email,
        nickname=nickname or email.split("@")[0],
        role=role,
        password_hash=hash_password(password),
        last_login_at=None,
    )
    session.add(user)
    await session.flush()
    await ensure_point_account(session, user.id)
    return user


def set_session_cookie(response: Response, name: str, token: str, max_age: int) -> None:
    settings = get_settings()
    response.set_cookie(
        name,
        token,
        max_age=max_age,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, name: str) -> None:
    response.delete_cookie(name, path="/", httponly=True, samesite="lax", secure=get_settings().is_production)


async def user_from_token(session: AsyncSession, token: str | None, token_type: str) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="missing token")
    token_data = read_token(token, get_settings().jwt_secret, token_type)
    if token_data is None:
        raise HTTPException(status_code=401, detail="invalid token")
    user = await session.get(User, token_data[0])
    if user is None or user.status != "active":
        raise HTTPException(status_code=403, detail="inactive user")
    return user


async def current_user(
    jfxz_session: Annotated[str | None, Cookie(alias=USER_COOKIE)] = None,
    jfxz_admin_session: Annotated[str | None, Cookie(alias=ADMIN_COOKIE)] = None,
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    if authorization and authorization.startswith("Bearer ") and not get_settings().is_production:
        return await user_from_token(session, authorization.removeprefix("Bearer "), "user")
    return await user_from_token(session, jfxz_session or jfxz_admin_session, "user" if jfxz_session else "admin")


async def current_admin(
    jfxz_admin_session: Annotated[str | None, Cookie(alias=ADMIN_COOKIE)] = None,
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    if authorization and authorization.startswith("Bearer ") and not get_settings().is_production:
        user = await user_from_token(session, authorization.removeprefix("Bearer "), "admin")
    else:
        user = await user_from_token(session, jfxz_admin_session, "admin")
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="admin required")
    return user


async def ensure_point_account(session: AsyncSession, user_id: str) -> PointAccount:
    account = await one(session, select(PointAccount).where(PointAccount.user_id == user_id))
    if account is None:
        account = PointAccount(user_id=user_id, monthly_points_balance=0, topup_points_balance=0)
        session.add(account)
        await session.flush()
    return account


async def consume_point(session: AsyncSession, user_id: str) -> str:
    await ensure_point_account(session, user_id)
    monthly = await session.execute(
        update(PointAccount)
        .where(PointAccount.user_id == user_id, PointAccount.monthly_points_balance >= 1)
        .values(monthly_points_balance=PointAccount.monthly_points_balance - 1)
    )
    if monthly.rowcount:
        return "monthly"
    topup = await session.execute(
        update(PointAccount)
        .where(PointAccount.user_id == user_id, PointAccount.topup_points_balance >= 1)
        .values(topup_points_balance=PointAccount.topup_points_balance - 1)
    )
    if topup.rowcount:
        return "topup"
    raise HTTPException(status_code=402, detail="points not enough")


async def owned_work(session: AsyncSession, user_id: str, work_id: str) -> Work:
    work = await session.get(Work, work_id)
    if work is None or work.user_id != user_id:
        raise HTTPException(status_code=404, detail="work not found")
    return work


async def seed_defaults(session: AsyncSession) -> None:
    settings = get_settings()
    existing_plans = await one(session, select(func.count(Plan.id)))
    if not existing_plans:
        session.add_all(
            [
                Plan(
                    name="创作月卡",
                    price_amount=Decimal("29.00"),
                    monthly_points=1000,
                    bundled_topup_points=200,
                    sort_order=1,
                ),
                Plan(
                    name="专业月卡",
                    price_amount=Decimal("69.00"),
                    monthly_points=3000,
                    bundled_topup_points=800,
                    sort_order=2,
                ),
            ]
        )

    existing_topups = await one(session, select(func.count(TopupPack.id)))
    if not existing_topups:
        session.add(
            TopupPack(
                name="灵感加油包",
                price_amount=Decimal("19.00"),
                points=1200,
                expire_days=90,
                sort_order=1,
            )
        )

    keys = [
        ("enabled", "boolean"),
        ("app_id", "string"),
        ("app_private_key", "secret"),
        ("alipay_public_key", "secret"),
        ("notify_url", "string"),
        ("seller_id", "string"),
        ("timeout_express", "string"),
        ("extra_options", "json"),
    ]
    existing_configs = await one(session, select(func.count(GlobalConfig.id)))
    if not existing_configs:
        session.add_all(
            [
            GlobalConfig(
                config_group="payment.alipay_f2f",
                config_key=key,
                value_type=value_type,
                is_required=key != "enabled",
                description=f"alipay f2f {key}",
            )
            for key, value_type in keys
            ]
        )
    if (
        not settings.is_production
        and settings.bootstrap_admin_email
        and settings.bootstrap_admin_password
    ):
        email = str(settings.bootstrap_admin_email).lower()
        admin = await one(session, select(User).where(User.email == email))
        if admin is None:
            await create_user_account(
                session,
                email,
                settings.bootstrap_admin_password,
                nickname=email.split("@")[0],
                role="admin",
            )
        else:
            admin.role = "admin"
            admin.status = "active"
            admin.password_hash = hash_password(settings.bootstrap_admin_password)
    await session.commit()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "jfxz"}


def auth_response(response: Response, user: User, token_type: str) -> dict[str, Any]:
    settings = get_settings()
    ttl = settings.admin_session_seconds if token_type == "admin" else settings.user_session_seconds
    cookie_name = ADMIN_COOKIE if token_type == "admin" else USER_COOKIE
    clear_session_cookie(response, USER_COOKIE if token_type == "admin" else ADMIN_COOKIE)
    token = issue_token(user.id, user.role, settings.jwt_secret, token_type=token_type, ttl_seconds=ttl)
    set_session_cookie(response, cookie_name, token, ttl)
    set_csrf_cookie(response)
    return {"user": public(user)}


@router.get("/csrf")
async def csrf(response: Response) -> dict[str, str]:
    return {"csrf_token": set_csrf_cookie(response)}


@router.post("/auth/register")
async def register_email(
    payload: RegisterIn,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    email = str(payload.email)
    assert_login_not_locked(request, email, "user")
    existing = await one(session, select(User).where(User.email == email))
    if existing is not None:
        await record_login_audit(session, request, email, "user", False, "email_exists", existing)
        await session.commit()
        raise HTTPException(status_code=409, detail="email already registered")
    user = User(
        email=email,
        nickname=payload.nickname or payload.email.split("@")[0],
        password_hash=hash_password(payload.password),
        last_login_at=now(),
    )
    try:
        session.add(user)
        await session.flush()
        await ensure_point_account(session, user.id)
        await record_login_audit(session, request, email, "user", True, "registered", user)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        remember_login_failure(request, email, "user")
        raise HTTPException(status_code=409, detail="email already registered") from None
    clear_login_failures(request, email, "user")
    return auth_response(response, user, "user")


async def authenticate_user(
    payload: EmailLogin | AdminLogin,
    request: Request,
    session: AsyncSession,
    role: str,
) -> User:
    email = str(payload.email)
    assert_login_not_locked(request, email, role)
    statement = select(User).where(User.email == email)
    if role == "admin":
        statement = statement.where(User.role == "admin")
    user = await one(session, statement)
    if user is None or user.status != "active" or not verify_password(payload.password, user.password_hash):
        remember_login_failure(request, email, role)
        await record_login_audit(session, request, email, role, False, "bad_credentials", user)
        await session.commit()
        raise HTTPException(status_code=401, detail="bad credentials")
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    user.last_login_at = now()
    clear_login_failures(request, email, role)
    await record_login_audit(session, request, email, role, True, "login", user)
    await session.commit()
    return user


@router.post("/auth/login")
async def login_email(
    payload: EmailLogin,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    user = await authenticate_user(payload, request, session, "user")
    return auth_response(response, user, "user")


@router.post("/auth/email")
async def auth_email() -> JSONResponse:
    return JSONResponse(status_code=410, content={"detail": "use /auth/register or /auth/login"})


@router.post("/admin/login")
async def admin_login(
    payload: AdminLogin,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    user = await authenticate_user(payload, request, session, "admin")
    return auth_response(response, user, "admin")


@router.post("/auth/logout")
async def logout(response: Response) -> dict[str, bool]:
    clear_session_cookie(response, USER_COOKIE)
    clear_session_cookie(response, ADMIN_COOKIE)
    clear_csrf_cookie(response)
    return {"ok": True}


@router.get("/me")
async def get_me(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    return await profile_payload(session, user)


async def profile_payload(session: AsyncSession, user: User) -> dict[str, Any]:
    account = await ensure_point_account(session, user.id)
    subscription = await one(
        session,
        select(UserSubscription).where(UserSubscription.user_id == user.id).order_by(UserSubscription.created_at.desc()),
    )
    return {"user": public(user), "points": public(account), "subscription": public(subscription) if subscription else None}


@router.patch("/me")
async def patch_me(
    payload: UserPatch, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    if payload.nickname is not None:
        user.nickname = payload.nickname
    await session.commit()
    return public(user)


@router.get("/works")
async def list_works(
    user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> list[dict[str, Any]]:
    result = await session.execute(select(Work).where(Work.user_id == user.id).order_by(Work.updated_at.desc()))
    return [public(item) for item in result.scalars()]


@router.post("/works")
async def create_work(
    payload: WorkIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    values = payload.model_dump()
    values["title"] = values["title"].strip() or "未命名作品"
    work = Work(user_id=user.id, **values)
    session.add(work)
    await session.flush()
    session.add(Chapter(work_id=work.id, order_index=1, title="第一章", content="", summary=""))
    await session.commit()
    return public(work)


@router.get("/works/{work_id}")
async def get_work(
    work_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    work = await owned_work(session, user.id, work_id)
    return public(work)


@router.post("/works/{work_id}/workspace-bootstrap")
async def workspace_bootstrap(
    work_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    session_limit: Annotated[int, Query(ge=1, le=50)] = 20,
    message_limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> dict[str, Any]:
    work = await owned_work(session, user.id, work_id)
    profile = await profile_payload(session, user)

    chapters_result = await session.execute(select(Chapter).where(Chapter.work_id == work_id).order_by(Chapter.order_index))
    characters_result = await session.execute(
        select(Character).where(Character.work_id == work_id).order_by(Character.updated_at.desc())
    )
    settings_result = await session.execute(
        select(SettingItem).where(SettingItem.work_id == work_id).order_by(SettingItem.updated_at.desc())
    )
    sessions_result = await session.execute(
        select(ChatSession)
        .where(ChatSession.work_id == work_id)
        .order_by(ChatSession.last_active_at.desc())
        .limit(session_limit)
    )
    chapters = list(chapters_result.scalars())
    characters = list(characters_result.scalars())
    settings = list(settings_result.scalars())
    chat_sessions = list(sessions_result.scalars())
    active_session = chat_sessions[0] if chat_sessions else None
    if active_session is None:
        agno_session_id = f"agno-{uuid4()}"
        active_session = ChatSession(
            work_id=work_id,
            user_id=user.id,
            agno_session_id=agno_session_id,
            title="新的对话",
            source_type="manual",
            last_active_at=now(),
        )
        agent = AgentSession(session_id=agno_session_id, user_id=user.id, runs=[])
        session.add_all([active_session, agent])
        await session.flush()
        chat_sessions = [active_session]
    else:
        agent = await session.get(AgentSession, active_session.agno_session_id)

    await session.commit()
    return {
        "work": public(work),
        "chapters": [public(item) for item in chapters],
        "characters": [public(item) for item in characters],
        "settings": [public(item) for item in settings],
        "sessions": [public(item) for item in chat_sessions],
        "active_session": public(active_session),
        "messages": message_page(agent.runs if agent else [], message_limit),
        "profile": profile,
    }


@router.patch("/works/{work_id}")
async def update_work(
    work_id: str,
    payload: WorkIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    work = await owned_work(session, user.id, work_id)
    values = payload.model_dump()
    values["title"] = values["title"].strip() or "未命名作品"
    for key, value in values.items():
        setattr(work, key, value)
    await session.commit()
    return public(work)


@router.delete("/works/{work_id}")
async def delete_work(
    work_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, bool]:
    await session.delete(await owned_work(session, user.id, work_id))
    await session.commit()
    return {"ok": True}


async def list_by_work(
    session: AsyncSession, model: type[Any], work_id: str, search: str | None = None
) -> list[dict[str, Any]]:
    statement = select(model).where(model.work_id == work_id)
    if search:
        statement = statement.where(model.name.ilike(f"%{search}%"))
    result = await session.execute(statement.order_by(model.updated_at.desc()))
    return [public(item) for item in result.scalars()]


@router.get("/works/{work_id}/characters")
async def list_characters(
    work_id: str,
    q: str | None = Query(None, max_length=100),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    await owned_work(session, user.id, work_id)
    return await list_by_work(session, Character, work_id, q)


@router.post("/works/{work_id}/characters")
async def create_character(
    work_id: str,
    payload: NamedContentIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    item = Character(work_id=work_id, name=payload.name, summary=payload.summary, detail=payload.detail)
    session.add(item)
    await session.commit()
    return public(item)


@router.patch("/works/{work_id}/characters/{item_id}")
async def update_character(
    work_id: str,
    item_id: str,
    payload: NamedContentIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    item = await must_get_in_work(session, Character, item_id, work_id)
    item.name, item.summary, item.detail = payload.name, payload.summary, payload.detail
    await session.commit()
    return public(item)


@router.delete("/works/{work_id}/characters/{item_id}")
async def delete_character(
    work_id: str,
    item_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await owned_work(session, user.id, work_id)
    await session.delete(await must_get_in_work(session, Character, item_id, work_id))
    await session.commit()
    return {"ok": True}


@router.get("/works/{work_id}/settings")
async def list_settings(
    work_id: str,
    q: str | None = Query(None, max_length=100),
    type: str | None = Query(None, max_length=50),  # noqa: A002
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    await owned_work(session, user.id, work_id)
    statement = select(SettingItem).where(SettingItem.work_id == work_id)
    if q:
        statement = statement.where(SettingItem.name.ilike(f"%{q}%"))
    if type:
        statement = statement.where(SettingItem.type == type)
    result = await session.execute(statement.order_by(SettingItem.updated_at.desc()))
    return [public(item) for item in result.scalars()]


@router.post("/works/{work_id}/settings")
async def create_setting(
    work_id: str,
    payload: NamedContentIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    item = SettingItem(
        work_id=work_id, type=payload.type or "other", name=payload.name, summary=payload.summary, detail=payload.detail
    )
    session.add(item)
    await session.commit()
    return public(item)


@router.patch("/works/{work_id}/settings/{item_id}")
async def update_setting(
    work_id: str,
    item_id: str,
    payload: NamedContentIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    item = await must_get_in_work(session, SettingItem, item_id, work_id)
    item.type = payload.type or item.type
    item.name, item.summary, item.detail = payload.name, payload.summary, payload.detail
    await session.commit()
    return public(item)


@router.delete("/works/{work_id}/settings/{item_id}")
async def delete_setting(
    work_id: str,
    item_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await owned_work(session, user.id, work_id)
    await session.delete(await must_get_in_work(session, SettingItem, item_id, work_id))
    await session.commit()
    return {"ok": True}


@router.get("/works/{work_id}/chapters")
async def list_chapters(
    work_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> list[dict[str, Any]]:
    await owned_work(session, user.id, work_id)
    result = await session.execute(select(Chapter).where(Chapter.work_id == work_id).order_by(Chapter.order_index))
    return [public(item) for item in result.scalars()]


@router.post("/works/{work_id}/chapters")
async def create_chapter(
    work_id: str,
    payload: ChapterIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    order_index = payload.order_index
    if order_index is None:
        count = await one(session, select(func.count(Chapter.id)).where(Chapter.work_id == work_id))
        order_index = int(count) + 1
    chapter = Chapter(work_id=work_id, order_index=order_index, **payload.model_dump(exclude={"order_index"}))
    session.add(chapter)
    await session.commit()
    return public(chapter)


@router.patch("/works/{work_id}/chapters/{chapter_id}")
async def update_chapter(
    work_id: str,
    chapter_id: str,
    payload: ChapterIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    chapter = await must_get_in_work(session, Chapter, chapter_id, work_id)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(chapter, key, value)
    await session.commit()
    return public(chapter)


@router.delete("/works/{work_id}/chapters/{chapter_id}")
async def delete_chapter(
    work_id: str,
    chapter_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    await owned_work(session, user.id, work_id)
    await session.delete(await must_get_in_work(session, Chapter, chapter_id, work_id))
    await session.commit()
    return {"ok": True}


def strip_json_fence(value: str) -> str:
    text = value.strip()
    if text.startswith("```"):
        lines = text.splitlines()[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def parse_analysis_output(value: str, source_text: str) -> list[dict[str, Any]]:
    try:
        payload = json.loads(strip_json_fence(value))
        parsed = AnalyzeOut.model_validate(payload)
    except (json.JSONDecodeError, ValidationError) as error:
        raise HTTPException(status_code=502, detail="analysis response parse failed") from error
    suggestions: list[dict[str, Any]] = []
    for suggestion in parsed.suggestions:
        quote = suggestion.quote.strip()
        options = [option.strip() for option in suggestion.options if option.strip()]
        if not quote or quote not in source_text or not options:
            continue
        suggestions.append({"quote": quote, "issue": suggestion.issue.strip(), "options": options})
    return suggestions


def fake_deepseek_analysis(text: str) -> list[dict[str, Any]]:
    if "无明显问题" in text:
        return []
    quote = next((line.strip() for line in text.splitlines() if line.strip()), text.strip()[:120])
    return [
        {
            "quote": quote,
            "issue": "测试环境检测到可能存在错别字、标点或语句不通顺问题。",
            "options": [f"建议修改：{quote}"],
        }
    ]


async def request_deepseek_analysis(text: str) -> list[dict[str, Any]]:
    settings = get_settings()
    if settings.env == "test":
        return fake_deepseek_analysis(text)
    if not settings.deepseek_api_key:
        raise HTTPException(status_code=503, detail="deepseek api key not configured")
    prompt = (
        "你是中文长篇小说编辑器的基础校对助手。只检查错别字、错误标点符号、明显病句或不通顺表达。"
        "不要检查人物设定、世界观设定、剧情节奏或文风。"
        "必须只返回 JSON，不要返回 Markdown，不要解释。"
        '返回结构必须严格为：{"suggestions":[{"quote":"原文片段","issue":"问题说明","options":["修改方案"]}]}。'
        "quote 必须逐字来自用户正文，options 至少一个。没有问题时返回 {\"suggestions\":[]}。"
    )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.deepseek_base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.deepseek_model,
                    "messages": [
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0,
                },
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="deepseek request failed") from error
    content = str(data.get("choices", [{}])[0].get("message", {}).get("content", ""))
    return parse_analysis_output(content, text)


@router.post("/works/{work_id}/analyze")
async def analyze_chapter(
    work_id: str,
    payload: AnalyzeIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    text = payload.content
    if not text.strip():
        return {"suggestions": []}
    account = await ensure_point_account(session, user.id)
    if account.monthly_points_balance + account.topup_points_balance < 1:
        raise HTTPException(status_code=402, detail="points not enough")
    suggestions = await request_deepseek_analysis(text)
    bucket = await consume_point(session, user.id)
    session.add(
        PointTransaction(
            user_id=user.id,
            bucket_type=bucket,
            change_type="consume",
            source_type="analyze",
            source_id=work_id,
            points_delta=-1,
        )
    )
    await session.commit()
    return {"suggestions": suggestions}


@router.get("/works/{work_id}/chat-sessions")
async def list_chat_sessions(
    work_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[dict[str, Any]]:
    await owned_work(session, user.id, work_id)
    result = await session.execute(
        select(ChatSession).where(ChatSession.work_id == work_id).order_by(ChatSession.last_active_at.desc()).limit(limit)
    )
    return [public(item) for item in result.scalars()]


@router.post("/works/{work_id}/chat-sessions")
async def create_chat_session(
    work_id: str,
    payload: ChatSessionIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await owned_work(session, user.id, work_id)
    agno_session_id = f"agno-{uuid4()}"
    chat = ChatSession(
        work_id=work_id,
        user_id=user.id,
        agno_session_id=agno_session_id,
        title=payload.title,
        source_type=payload.source_type,
        last_active_at=now(),
    )
    session.add_all([chat, AgentSession(session_id=agno_session_id, user_id=user.id, runs=[])])
    await session.commit()
    return public(chat)


def normalized_run(run: dict[str, Any], index: int) -> dict[str, Any]:
    message_id = str(run.get("id") or f"legacy-{index}")
    created_at = str(run.get("created_at") or f"legacy-{index:06d}")
    role = str(run.get("role") or "user")
    if role == "ai":
        role = "assistant"
    return {
        "id": message_id,
        "role": role,
        "content": str(run.get("content", "")),
        "mentions": run.get("mentions") or [],
        "references": run.get("references") or [],
        "actions": run.get("actions") or [],
        "created_at": created_at,
    }


def message_page(runs: list[dict[str, Any]], limit: int, before: str | None = None) -> dict[str, Any]:
    messages = [normalized_run(run, index) for index, run in enumerate(runs)]
    end = len(messages)
    if before:
        end = next((index for index, message in enumerate(messages) if message["id"] == before), end)
    start = max(0, end - limit)
    page = messages[start:end]
    return {"messages": page, "has_more": start > 0, "next_before": page[0]["id"] if start > 0 and page else None}


def normalize_mentions(mentions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for mention in mentions[:REFERENCE_LIMIT]:
        ref_type = str(mention.get("type", ""))
        ref_id = str(mention.get("id", ""))
        label = str(mention.get("label", ""))
        start = mention.get("start")
        end = mention.get("end")
        if ref_type not in {"chapter", "character", "setting"} or not ref_id or not label:
            continue
        if not isinstance(start, int) or not isinstance(end, int) or start < 0 or end <= start:
            continue
        normalized.append({"type": ref_type, "id": ref_id, "label": label, "start": start, "end": end})
    return normalized


def normalize_references(references: list[dict[str, Any]], mentions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    def add(ref: dict[str, Any]) -> None:
        ref_type = str(ref.get("type", ""))
        ref_id = str(ref.get("id", ""))
        if not ref_type or not ref_id:
            return
        key = (ref_type, ref_id)
        if key in seen:
            return
        seen.add(key)
        item = {"type": ref_type, "id": ref_id}
        for field in ["name", "summary", "quote", "issue", "replacement", "detail"]:
            if ref.get(field):
                item[field] = str(ref.get(field))
        normalized.append(item)

    for mention in mentions:
        add({"type": mention["type"], "id": mention["id"], "name": mention["label"]})
    for ref in references[:REFERENCE_LIMIT]:
        add(ref)
    return normalized[:REFERENCE_LIMIT]


async def reference_context(session: AsyncSession, work_id: str, references: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected_refs: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    ids_by_type = {"chapter": set(), "character": set(), "setting": set()}
    for ref in references[:REFERENCE_LIMIT]:
        ref_type = str(ref.get("type", ""))
        ref_id = str(ref.get("id", ""))
        if ref_type in ids_by_type:
            if not ref_id:
                continue
            key = (ref_type, ref_id)
            if key in seen:
                continue
            seen.add(key)
            selected_refs.append({"type": ref_type, "id": ref_id})
            ids_by_type[ref_type].add(ref_id)
        elif ref_type == "suggestion":
            selected_refs.append(
                {
                    "type": "suggestion",
                    "id": ref_id,
                    "name": str(ref.get("name", "")),
                    "summary": str(ref.get("summary") or ref.get("issue") or ""),
                    "detail": str(ref.get("quote") or ref.get("replacement") or ref.get("detail") or ""),
                }
            )

    async def fetch_by_ids(model: type[Any], ids: set[str]) -> dict[str, Any]:
        if not ids:
            return {}
        result = await session.execute(select(model).where(model.work_id == work_id, model.id.in_(ids)))
        return {item.id: item for item in result.scalars()}

    chapters = await fetch_by_ids(Chapter, ids_by_type["chapter"])
    characters = await fetch_by_ids(Character, ids_by_type["character"])
    settings = await fetch_by_ids(SettingItem, ids_by_type["setting"])

    contexts: list[dict[str, Any]] = []
    for ref in selected_refs:
        ref_type = ref["type"]
        ref_id = ref.get("id", "")
        if ref_type == "chapter":
            item = chapters.get(ref_id)
            if item is not None:
                contexts.append(
                    {
                        "type": "chapter",
                        "id": item.id,
                        "name": item.title,
                        "summary": item.summary or "",
                        "detail": item.content[:500],
                    }
                )
        elif ref_type == "character":
            item = characters.get(ref_id)
            if item is not None:
                contexts.append(
                    {
                        "type": "character",
                        "id": item.id,
                        "name": item.name,
                        "summary": item.summary,
                        "detail": item.detail or "",
                    }
                )
        elif ref_type == "setting":
            item = settings.get(ref_id)
            if item is not None:
                contexts.append(
                    {
                        "type": "setting",
                        "id": item.id,
                        "name": item.name,
                        "summary": item.summary,
                        "detail": item.detail or "",
                    }
                )
        else:
            contexts.append(
                {
                    "type": "suggestion",
                    "id": ref_id or f"suggestion-{len(contexts) + 1}",
                    "name": ref.get("name") or "AI 建议",
                    "summary": ref.get("summary") or "",
                    "detail": ref.get("detail") or "",
                }
            )
    return contexts


def assistant_actions(message: str) -> list[dict[str, str]]:
    actions: list[dict[str, str]] = []
    if any(word in message for word in ["角色", "人物", "主角", "配角"]):
        actions.append({"type": "save_character", "label": "保存为角色"})
    if any(word in message for word in ["设定", "世界观", "地点", "规则"]):
        actions.append({"type": "save_setting", "label": "保存为设定"})
    if any(word in message for word in ["章节", "提要", "摘要", "情节"]):
        actions.append({"type": "update_chapter_summary", "label": "更新章节提要"})
    if any(word in message for word in ["作品", "简介", "梗概", "背景"]):
        actions.append({"type": "update_work_info", "label": "更新作品信息"})
    if not actions:
        actions.append({"type": "update_chapter_summary", "label": "更新章节提要"})
    return actions


def build_reply(work: Work, message: str, refs: list[dict[str, Any]], history: list[dict[str, Any]]) -> str:
    ref_names = "、".join(ref["name"] for ref in refs) if refs else "当前作品与当前章节"
    history_hint = f"我也参考了最近 {len(history)} 条对话。" if history else "这是这个会话的新一轮讨论。"
    return (
        f"我已读取《{work.title}》的上下文，并结合{ref_names}来处理。"
        f"{history_hint}"
        f"针对“{message[:80]}”，建议先明确冲突目标，再补足人物动机与设定约束。"
    )


def encode_sse(event: str | None, data: Any) -> bytes:
    prefix = f"event: {event}\n" if event else ""
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"{prefix}data: {payload}\n\n".encode()


@router.get("/chat-sessions/{session_id}/messages")
async def list_chat_messages(
    session_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    before: str | None = None,
) -> dict[str, Any]:
    chat = await must_get(session, ChatSession, session_id)
    if chat.user_id != user.id:
        raise HTTPException(status_code=404, detail="session not found")
    agent = await session.get(AgentSession, chat.agno_session_id)
    return message_page(agent.runs if agent else [], limit, before)


@router.post("/chat-sessions/{session_id}/messages")
async def send_chat_message(
    session_id: str,
    payload: ChatIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    chat = await must_get(session, ChatSession, session_id)
    if chat.user_id != user.id:
        raise HTTPException(status_code=404, detail="session not found")
    bucket = await consume_point(session, user.id)
    session.add(
        PointTransaction(
            user_id=user.id,
            bucket_type=bucket,
            change_type="consume",
            source_type="ai_chat",
            source_id=chat.id,
            points_delta=-1,
        )
    )
    work = await owned_work(session, user.id, chat.work_id)
    mentions = normalize_mentions(payload.mentions)
    references = normalize_references(payload.references, mentions)
    refs = await reference_context(session, chat.work_id, references)
    chat.last_message_preview = payload.message[:120]
    chat.last_active_at = now()
    agent = await session.get(AgentSession, chat.agno_session_id)
    if agent is None:
        agent = AgentSession(session_id=chat.agno_session_id, user_id=user.id, runs=[])
        session.add(agent)
        await session.flush()
    current_runs = agent.runs or []
    if not current_runs and chat.title == "新的对话":
        chat.title = payload.message[:24] or "新的对话"
    created_at = now().isoformat()
    user_message = {
        "id": str(uuid4()),
        "role": "user",
        "content": payload.message,
        "mentions": mentions,
        "references": references,
        "created_at": created_at,
    }
    history = [normalized_run(run, index) for index, run in enumerate(current_runs)][-20:]
    agent.runs = [*current_runs, user_message]
    await session.commit()

    reply = build_reply(work, payload.message, refs, history)
    chunks = [reply[index : index + 18] for index in range(0, len(reply), 18)]
    assistant_message = {
        "id": str(uuid4()),
        "role": "assistant",
        "content": reply,
        "mentions": [],
        "references": references,
        "actions": assistant_actions(payload.message),
        "created_at": now().isoformat(),
    }

    async def stream_reply() -> AsyncIterator[bytes]:
        for chunk in chunks:
            yield encode_sse(None, chunk)
        fresh_agent = await session.get(AgentSession, chat.agno_session_id)
        if fresh_agent is not None:
            fresh_agent.runs = [*(fresh_agent.runs or []), assistant_message]
            chat.last_message_preview = reply[:120]
            chat.last_active_at = now()
            await session.commit()
        yield encode_sse("done", assistant_message)

    return StreamingResponse(stream_reply(), media_type="text/event-stream")


@router.get("/billing/products")
async def billing_products(session: AsyncSession = Depends(get_session)) -> dict[str, list[dict[str, Any]]]:
    plans = await session.execute(select(Plan).where(Plan.status == "active").order_by(Plan.sort_order))
    topups = await session.execute(select(TopupPack).where(TopupPack.status == "active").order_by(TopupPack.sort_order))
    return {"plans": [public(item) for item in plans.scalars()], "topup_packs": [public(item) for item in topups.scalars()]}


async def product_snapshot(
    session: AsyncSession, product_type: str, product_id: str
) -> tuple[str, Decimal, int, int, str | None]:
    if product_type == "plan":
        product = await must_get(session, Plan, product_id)
        return product.name, product.price_amount, product.monthly_points, product.bundled_topup_points, None
    if product_type == "topup_pack":
        product = await must_get(session, TopupPack, product_id)
        return product.name, product.price_amount, 0, product.points, str(product.expire_days)
    raise HTTPException(status_code=400, detail="bad product type")


@router.post("/billing/orders")
async def create_order(
    payload: OrderIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    name, amount, *_ = await product_snapshot(session, payload.product_type, payload.product_id)
    order_no = f"JF{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}{uuid4().hex[:8]}"
    order = BillingOrder(
        order_no=order_no,
        user_id=user.id,
        product_type=payload.product_type,
        product_id=payload.product_id,
        product_name_snapshot=name,
        pay_channel="alipay_f2f",
        amount=amount,
        status="qr_created",
    )
    session.add(order)
    await session.flush()
    session.add(
        PaymentRecord(
            order_id=order.id,
            user_id=user.id,
            out_trade_no=order_no,
            channel_status="WAIT_BUYER_PAY",
            qr_code=f"alipay://qr/{order_no}",
        )
    )
    await session.commit()
    data = public(order)
    data["qr_code"] = f"alipay://qr/{order_no}"
    return data


async def grant_order(session: AsyncSession, order: BillingOrder) -> None:
    paid_at = now()
    marked_paid = await session.execute(
        update(BillingOrder)
        .where(BillingOrder.id == order.id, BillingOrder.status != "paid")
        .values(status="paid", paid_at=paid_at)
    )
    if not marked_paid.rowcount:
        await session.refresh(order)
        return
    _name, _amount, monthly, topup, expire_days = await product_snapshot(session, order.product_type, order.product_id)
    account = await ensure_point_account(session, order.user_id)
    order.status = "paid"
    order.paid_at = paid_at
    if monthly:
        account.monthly_points_balance += monthly
        session.add(
            PointTransaction(
                user_id=order.user_id,
                bucket_type="monthly",
                change_type="grant",
                source_type="plan_monthly",
                source_id=order.id,
                points_delta=monthly,
                expire_at=now() + timedelta(days=31),
            )
        )
    if topup:
        account.topup_points_balance += topup
        session.add(
            PointTransaction(
                user_id=order.user_id,
                bucket_type="topup",
                change_type="grant",
                source_type="topup_pack" if expire_days else "plan_bundled_topup",
                source_id=order.id,
                points_delta=topup,
                expire_at=now() + timedelta(days=int(expire_days or 31)),
            )
        )
    if order.product_type == "plan":
        session.add(
            UserSubscription(
                user_id=order.user_id,
                plan_id=order.product_id,
                order_id=order.id,
                start_at=now(),
                end_at=now() + timedelta(days=31),
                next_renew_at=now() + timedelta(days=31),
            )
        )


async def confirm_verified_payment(
    session: AsyncSession,
    payment: PaymentRecord,
    notify_body: dict[str, Any],
    trade_no: str,
    expected_amount: Decimal | None = None,
) -> BillingOrder:
    order = await must_get(session, BillingOrder, payment.order_id)
    if payment.out_trade_no != order.order_no:
        raise HTTPException(status_code=400, detail="order number mismatch")
    if expected_amount is not None and Decimal(str(expected_amount)) != Decimal(str(order.amount)):
        raise HTTPException(status_code=400, detail="amount mismatch")
    trade_status = str(notify_body.get("trade_status", ""))
    if trade_status not in {"TRADE_SUCCESS", "TRADE_FINISHED"}:
        raise HTTPException(status_code=400, detail="payment not successful")
    payment.channel_status = trade_status
    payment.trade_no = trade_no
    payment.notify_verified = True
    payment.raw_notify_payload = notify_body
    payment.last_notify_at = now()
    await grant_order(session, order)
    session.add(
        PaymentNotifyLog(
            payment_record_id=payment.id,
            out_trade_no=payment.out_trade_no,
            trade_no=trade_no,
            notify_body=notify_body,
            verify_result="success",
            process_result="processed",
        )
    )
    return order


@router.get("/billing/orders/{order_id}")
async def get_order(
    order_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    order = await must_get(session, BillingOrder, order_id)
    if order.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=404, detail="order not found")
    data = public(order)
    payment = await one(session, select(PaymentRecord).where(PaymentRecord.order_id == order.id))
    data["qr_code"] = payment.qr_code if payment else ""
    return data


@router.post("/billing/orders/{order_id}/simulate-paid")
async def simulate_paid(
    order_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    settings = get_settings()
    if settings.is_production or not settings.enable_payment_simulator:
        raise HTTPException(status_code=404, detail="not found")
    order = await must_get(session, BillingOrder, order_id)
    if order.user_id != user.id:
        raise HTTPException(status_code=404, detail="order not found")
    payment = await one(session, select(PaymentRecord).where(PaymentRecord.order_id == order.id))
    if payment is None:
        raise HTTPException(status_code=404, detail="payment not found")
    order = await confirm_verified_payment(
        session,
        payment,
        {"trade_status": "TRADE_SUCCESS", "out_trade_no": order.order_no, "total_amount": str(order.amount)},
        f"ALI{uuid4().hex[:16]}",
        Decimal(str(order.amount)),
    )
    await session.commit()
    return public(order)


@router.get("/admin/users")
async def admin_users(
    q: Annotated[str | None, Query(max_length=100)] = None,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    statement = select(User)
    if q:
        statement = statement.where(User.email.ilike(f"%{q}%") | User.nickname.ilike(f"%{q}%"))
    rows, total = await paginated(session, statement.order_by(User.created_at.desc()), page, page_size)
    return page_response([public(row[0]) for row in rows], total, page, page_size)


@router.get("/admin/users/{user_id}")
async def admin_user_detail(
    user_id: str, _admin: User = Depends(current_admin), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    user = await must_get(session, User, user_id)
    account = await ensure_point_account(session, user.id)
    sub = await one(
        session,
        select(UserSubscription).where(UserSubscription.user_id == user.id).order_by(UserSubscription.created_at.desc()),
    )
    return {"user": public(user), "points": public(account), "subscription": public(sub) if sub else None}


@router.patch("/admin/users/{user_id}")
async def admin_patch_user(
    user_id: str,
    payload: UserPatch,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    user = await must_get(session, User, user_id)
    if payload.status is not None:
        VALID_STATUSES = {"active", "disabled"}
        if payload.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="status must be active or disabled")
        user.status = payload.status
    if payload.nickname is not None:
        user.nickname = payload.nickname
    await session.commit()
    return public(user)


@router.get("/admin/products")
async def admin_products(
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    kind: Annotated[str | None, Query(max_length=30)] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Annotated[str | None, Query(max_length=20)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    if kind:
        model = Plan if kind == "plans" else TopupPack if kind == "topup-packs" else None
        if model is None:
            raise HTTPException(status_code=400, detail="bad product kind")
        statement = select(model)
        if q:
            statement = statement.where(model.name.ilike(f"%{q}%"))
        if status:
            statement = statement.where(model.status == status)
        rows, total = await paginated(session, statement.order_by(model.sort_order, model.created_at.desc()), page, page_size)
        return page_response([public(row[0]) for row in rows], total, page, page_size)

    plans = await session.execute(select(Plan).order_by(Plan.sort_order))
    topups = await session.execute(select(TopupPack).order_by(TopupPack.sort_order))
    return {"plans": [public(item) for item in plans.scalars()], "topup_packs": [public(item) for item in topups.scalars()]}


@router.post("/admin/products/{kind}")
async def admin_create_product(
    kind: str,
    payload: ProductIn,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if kind == "plans":
        item = Plan(
            name=payload.name,
            price_amount=payload.price_amount,
            monthly_points=payload.monthly_points,
            bundled_topup_points=payload.bundled_topup_points,
            status=payload.status,
            sort_order=payload.sort_order,
        )
    elif kind == "topup-packs":
        item = TopupPack(
            name=payload.name,
            price_amount=payload.price_amount,
            points=payload.points,
            expire_days=payload.expire_days,
            status=payload.status,
            sort_order=payload.sort_order,
        )
    else:
        raise HTTPException(status_code=400, detail="bad product kind")
    session.add(item)
    await session.commit()
    return public(item)


@router.patch("/admin/products/{kind}/{item_id}")
async def admin_update_product(
    kind: str,
    item_id: str,
    payload: ProductIn,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    model = Plan if kind == "plans" else TopupPack if kind == "topup-packs" else None
    if model is None:
        raise HTTPException(status_code=400, detail="bad product kind")
    item = await must_get(session, model, item_id)
    for key, value in payload.model_dump().items():
        if hasattr(item, key):
            setattr(item, key, value)
    await session.commit()
    return public(item)


@router.delete("/admin/products/{kind}/{item_id}")
async def admin_delete_product(
    kind: str,
    item_id: str,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    model = Plan if kind == "plans" else TopupPack if kind == "topup-packs" else None
    if model is None:
        raise HTTPException(status_code=400, detail="bad product kind")
    item = await must_get(session, model, item_id)
    item.status = "inactive"
    await session.commit()
    return {"ok": True}


@router.get("/admin/orders")
async def admin_orders(
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Annotated[str | None, Query(max_length=20)] = None,
    product_type: Annotated[str | None, Query(max_length=30)] = None,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    statement = select(BillingOrder, User.email).join(User, User.id == BillingOrder.user_id)
    if q:
        like = f"%{q}%"
        statement = statement.where(
            or_(
                BillingOrder.order_no.ilike(like),
                BillingOrder.product_name_snapshot.ilike(like),
                User.email.ilike(like),
                User.nickname.ilike(like),
            )
        )
    if status:
        statement = statement.where(BillingOrder.status == status)
    if product_type:
        statement = statement.where(BillingOrder.product_type == product_type)
    rows_result, total = await paginated(session, statement.order_by(BillingOrder.created_at.desc()), page, page_size)
    rows = []
    for order, email in rows_result:
        data = public(order)
        data["user_email"] = email
        rows.append(data)
    return page_response(rows, total, page, page_size)


@router.get("/admin/orders/{order_id}")
async def admin_order_detail(
    order_id: str, _admin: User = Depends(current_admin), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    order = await must_get(session, BillingOrder, order_id)
    payments = await session.execute(select(PaymentRecord).where(PaymentRecord.order_id == order.id))
    grants = await session.execute(select(PointTransaction).where(PointTransaction.source_id == order.id))
    return {
        "order": public(order),
        "payments": [public(item) for item in payments.scalars()],
        "grants": [public(item) for item in grants.scalars()],
    }


@router.get("/admin/subscriptions")
async def admin_subscriptions(
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Annotated[str | None, Query(max_length=20)] = None,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    statement = (
        select(UserSubscription, User.email, Plan.name, BillingOrder.order_no)
        .join(User, User.id == UserSubscription.user_id)
        .join(Plan, Plan.id == UserSubscription.plan_id)
        .outerjoin(BillingOrder, BillingOrder.id == UserSubscription.order_id)
    )
    if q:
        like = f"%{q}%"
        statement = statement.where(or_(User.email.ilike(like), User.nickname.ilike(like), Plan.name.ilike(like)))
    if status:
        statement = statement.where(UserSubscription.status == status)
    rows_result, total = await paginated(session, statement.order_by(UserSubscription.created_at.desc()), page, page_size)
    rows = []
    for subscription, email, plan_name, order_no in rows_result:
        data = public(subscription)
        data["user_email"] = email
        data["plan_name"] = plan_name
        data["order_no"] = order_no
        rows.append(data)
    return page_response(rows, total, page, page_size)


@router.get("/admin/subscriptions/{subscription_id}")
async def admin_subscription_detail(
    subscription_id: str, _admin: User = Depends(current_admin), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    subscription = await must_get(session, UserSubscription, subscription_id)
    user = await must_get(session, User, subscription.user_id)
    plan = await must_get(session, Plan, subscription.plan_id)
    order = await session.get(BillingOrder, subscription.order_id) if subscription.order_id else None
    return {
        "subscription": public(subscription),
        "user": public(user),
        "plan": public(plan),
        "order": public(order) if order else None,
    }


@router.get("/admin/sessions")
async def admin_sessions(
    q: Annotated[str | None, Query(max_length=100)] = None,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    statement = (
        select(ChatSession, User.email, Work.title)
        .outerjoin(User, User.id == ChatSession.user_id)
        .outerjoin(Work, Work.id == ChatSession.work_id)
    )
    if q:
        like = f"%{q}%"
        statement = statement.where(
            or_(ChatSession.title.ilike(like), User.email.ilike(like), User.nickname.ilike(like), Work.title.ilike(like))
        )
    rows_result, total = await paginated(session, statement.order_by(ChatSession.last_active_at.desc()), page, page_size)
    rows = []
    for chat, email, work_title in rows_result:
        data = public(chat)
        data["user_email"] = email
        data["work_title"] = work_title
        rows.append(data)
    return page_response(rows, total, page, page_size)


@router.get("/admin/sessions/{session_id}")
async def admin_session_detail(
    session_id: str, _admin: User = Depends(current_admin), session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    chat = await must_get(session, ChatSession, session_id)
    agent = await session.get(AgentSession, chat.agno_session_id)
    return {"session": public(chat), "agent": public(agent)}


@router.get("/admin/configs")
async def admin_configs(
    group: Annotated[str | None, Query(max_length=100)] = None,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    statement = select(GlobalConfig)
    if group:
        statement = statement.where(GlobalConfig.config_group == group)
    rows_result, total = await paginated(session, statement.order_by(GlobalConfig.config_group, GlobalConfig.config_key), page, page_size)
    rows = []
    for item, in rows_result:
        rows.append(public_config(item))
    return page_response(rows, total, page, page_size)


@router.patch("/admin/configs/{config_id}")
async def admin_patch_config(
    config_id: str,
    payload: ConfigValueIn,
    _admin: User = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    config = await must_get(session, GlobalConfig, config_id)
    for key, value in payload.model_dump().items():
        if config.value_type == "secret" and key == "string_value" and value == SECRET_MASK:
            continue
        setattr(config, key, value)
    await session.commit()
    return public_config(config)
