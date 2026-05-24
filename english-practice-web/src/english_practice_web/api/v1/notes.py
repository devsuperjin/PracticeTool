from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...models import NoteRequest, NoteUpdateRequest
from ...store import note_delete, note_get, note_get_all, note_save, note_update

router = APIRouter()


@router.get("/notes")
def list_notes() -> dict[str, list[dict]]:
    return note_get_all()


@router.get("/notes/{phrase:path}")
def get_phrase_notes(phrase: str) -> list[dict]:
    return note_get(phrase)


@router.post("/notes")
def create_note(payload: NoteRequest) -> dict:
    return note_save(payload.phrase, payload.note)


@router.put("/notes/{note_id}")
def update_note(note_id: int, payload: NoteUpdateRequest) -> dict:
    result = note_update(note_id, payload.note)
    if result is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return result


@router.delete("/notes/{note_id}")
def delete_note(note_id: int) -> dict[str, str]:
    if not note_delete(note_id):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"status": "deleted"}
