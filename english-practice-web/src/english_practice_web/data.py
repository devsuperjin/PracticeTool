from __future__ import annotations

import json
from pathlib import Path

from fastapi import HTTPException

_BASE_DIR = Path(__file__).resolve().parents[2]
_PROJECT_FILE = _BASE_DIR / "phrasal_verbs.json"
_CWD_FILE = Path.cwd() / "phrasal_verbs.json"


def _load_raw() -> list[dict]:
    path = _PROJECT_FILE if _PROJECT_FILE.exists() else _CWD_FILE
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        print(f"Error loading {path}: {exc}")
        return []
    if not isinstance(data, list):
        print(f"Error: {path} is not a list of records")
        return []
    result = []
    for r in data:
        if not (isinstance(r, dict) and r.get("phrase") and r.get("meaning") and r.get("example")):
            continue
        entry = {
            "phrase": str(r["phrase"]).strip(),
            "meaning": str(r["meaning"]).strip(),
            "example": str(r["example"]).strip(),
            "meaning_index": int(r.get("meaning_index", 0)),
            "total_meanings": int(r.get("total_meanings", 1)),
        }
        result.append(entry)
    return result


phrasal_data: list[dict] = _load_raw()

# Index: phrase -> list of meaning entries (sorted by meaning_index)
_phrase_index: dict[str, list[dict]] = {}
for entry in phrasal_data:
    _phrase_index.setdefault(entry["phrase"], []).append(entry)
for entries in _phrase_index.values():
    entries.sort(key=lambda e: e["meaning_index"])

_phrase_lookup: dict[str, str] = {phrase.casefold(): phrase for phrase in _phrase_index}


def find_canonical_phrase(phrase: str) -> str | None:
    """Return the phrase exactly as stored in the word list."""
    normalized = phrase.strip()
    if normalized in _phrase_index:
        return normalized
    return _phrase_lookup.get(normalized.casefold())


def require_canonical_phrase(phrase: str) -> str:
    canonical = find_canonical_phrase(phrase)
    if not canonical:
        raise HTTPException(status_code=400, detail="Unknown phrasal verb: " + phrase.strip())
    return canonical


def get_phrase_meanings(phrase: str) -> list[dict]:
    """Return all meanings for a phrase, each with meaning_index."""
    if not phrasal_data:
        raise HTTPException(status_code=500, detail="Phrasal data unavailable")
    canonical = require_canonical_phrase(phrase)
    meanings = _phrase_index.get(canonical)
    if not meanings:
        raise HTTPException(status_code=400, detail="Unknown phrasal verb: " + phrase.strip())
    return meanings


def lookup_phrase(phrase: str) -> dict:
    """Return the first meaning entry (backward compat)."""
    meanings = get_phrase_meanings(phrase)
    return meanings[0]


def get_all_phrases() -> list[str]:
    """Return list of unique phrases."""
    return sorted(_phrase_index.keys())
