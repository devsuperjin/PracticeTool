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
    note: str


class NoteUpdateRequest(BaseModel):
    note: str


class ReadingRequest(BaseModel):
    phrase: str = Field(min_length=1)


class MarkRequest(BaseModel):
    status: str = Field(pattern="^(known|unknown)$")


class PlanRequest(BaseModel):
    name: str = Field(min_length=1)
    words: list[str] = Field(default_factory=list)
