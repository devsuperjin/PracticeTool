from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import ADMIN_PASSWORD, ADMIN_USERNAME, JWT_EXPIRES_MINUTES, JWT_SECRET

_ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)


def authenticate_user(username: str, password: str) -> bool:
    return hmac.compare_digest(username, ADMIN_USERNAME) and hmac.compare_digest(password, ADMIN_PASSWORD)


def create_access_token(username: str) -> tuple[str, int]:
    now = int(time.time())
    expires_in = JWT_EXPIRES_MINUTES * 60
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + expires_in,
        "type": "access",
    }
    return _encode_jwt(payload), expires_in


def require_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, str]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _auth_error("Missing bearer token")
    payload = _decode_jwt(credentials.credentials)
    username = payload.get("sub")
    if not isinstance(username, str) or not username:
        raise _auth_error("Invalid token subject")
    return {"username": username}


def _encode_jwt(payload: dict[str, Any]) -> str:
    header = {"alg": _ALGORITHM, "typ": "JWT"}
    signing_input = f"{_json_b64(header)}.{_json_b64(payload)}"
    signature = _sign(signing_input)
    return f"{signing_input}.{signature}"


def _decode_jwt(token: str) -> dict[str, Any]:
    try:
        header_part, payload_part, signature = token.split(".", 2)
    except ValueError:
        raise _auth_error("Malformed token") from None

    signing_input = f"{header_part}.{payload_part}"
    if not hmac.compare_digest(signature, _sign(signing_input)):
        raise _auth_error("Invalid token signature")

    try:
        header = _json_unb64(header_part)
        payload = _json_unb64(payload_part)
    except (ValueError, json.JSONDecodeError):
        raise _auth_error("Invalid token payload") from None

    if header.get("alg") != _ALGORITHM or payload.get("type") != "access":
        raise _auth_error("Unsupported token")

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise _auth_error("Token expired")

    return payload


def _json_b64(value: dict[str, Any]) -> str:
    data = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return _b64encode(data)


def _json_unb64(value: str) -> dict[str, Any]:
    decoded = base64.urlsafe_b64decode(_pad_b64(value)).decode("utf-8")
    data = json.loads(decoded)
    if not isinstance(data, dict):
        raise ValueError("JWT segment is not an object")
    return data


def _sign(value: str) -> str:
    digest = hmac.new(JWT_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).digest()
    return _b64encode(digest)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _pad_b64(value: str) -> bytes:
    return (value + "=" * (-len(value) % 4)).encode("ascii")


def _auth_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )
