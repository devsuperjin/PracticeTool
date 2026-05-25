from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ...auth import authenticate_user, create_access_token, require_current_user
from ...models import AuthUser, LoginRequest, TokenResponse

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    if not authenticate_user(payload.username, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token, expires_in = create_access_token(payload.username)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=AuthUser(username=payload.username),
    )


@router.get("/auth/me", response_model=AuthUser)
def me(current_user: dict[str, str] = Depends(require_current_user)) -> AuthUser:
    return AuthUser(username=current_user["username"])
