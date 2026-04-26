import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

_password_hasher = PasswordHasher()


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_legacy_sha256(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def is_legacy_password_hash(password_hash: str) -> bool:
    return len(password_hash) == 64 and all(char in "0123456789abcdef" for char in password_hash)


def verify_password(password: str, password_hash: str) -> bool:
    if is_legacy_password_hash(password_hash):
        return hmac.compare_digest(hash_legacy_sha256(password), password_hash)
    try:
        return _password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerifyMismatchError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    if is_legacy_password_hash(password_hash):
        return True
    try:
        return _password_hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def issue_token(user_id: str, role: str, secret: str, token_type: str = "user", ttl_seconds: int = 86400) -> str:
    issued_at = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "role": role,
        "typ": token_type,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(seconds=ttl_seconds)).timestamp()),
        "jti": str(uuid4()),
    }
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = _b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}"
    signature = hmac.new(secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64encode(signature)}"


def read_token(token: str, secret: str, token_type: str | None = None) -> tuple[str, str, dict[str, Any]] | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    encoded_header, encoded_payload, signature = parts
    signing_input = f"{encoded_header}.{encoded_payload}"
    expected = _b64encode(hmac.new(secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        payload = json.loads(_b64decode(encoded_payload))
    except (json.JSONDecodeError, ValueError):
        return None
    if token_type is not None and payload.get("typ") != token_type:
        return None
    expires_at = payload.get("exp")
    if not isinstance(expires_at, int) or expires_at <= int(datetime.now(UTC).timestamp()):
        return None
    user_id = payload.get("sub")
    role = payload.get("role")
    if not isinstance(user_id, str) or not isinstance(role, str):
        return None
    return user_id, role, payload
