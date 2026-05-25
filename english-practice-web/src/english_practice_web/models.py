from __future__ import annotations

from pydantic import BaseModel, Field


class CheckRequest(BaseModel):
    phrase: str = Field(min_length=1)
    sentence: str = Field(min_length=1)


class ReciteCheckRequest(BaseModel):
    phrase: str = Field(min_length=1)
    chinese_input: str = Field(min_length=1)


class NoteRequest(BaseModel):
    phrase: str = Field(min_length=1)
    note: str = Field(min_length=1)


class NoteUpdateRequest(BaseModel):
    note: str = Field(min_length=1)


class ReadingRequest(BaseModel):
    phrase: str | None = Field(default=None, min_length=1)
    phrases: list[str] = Field(default_factory=list)
    topic: str = ""


class MarkRequest(BaseModel):
    status: str = Field(pattern="^(known|unknown)$")


class PlanRequest(BaseModel):
    name: str = Field(min_length=1)
    words: list[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AuthUser(BaseModel):
    username: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser
