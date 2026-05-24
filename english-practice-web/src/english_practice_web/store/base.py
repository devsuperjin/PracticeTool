from __future__ import annotations

import json
import sqlite3
from pathlib import Path

_DB_DIR = Path(__file__).resolve().parents[3] / "data"
_DB_PATH = _DB_DIR / "notes.db"
_JSON_PATH = Path(__file__).resolve().parents[3] / "notes.json"


def connect() -> sqlite3.Connection:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    from .notes import _init_notes_table
    from .plans import _init_plans_table
    from .recite_marks import _init_marks_table

    _init_notes_table()
    _init_plans_table()
    _init_marks_table()
    _migrate_json()
    _migrate_mark_keys()


def reset_db() -> None:
    """Drop all tables and reinitialize."""
    with connect() as conn:
        conn.execute("DROP TABLE IF EXISTS notes")
        conn.execute("DROP TABLE IF EXISTS plans")
        conn.execute("DROP TABLE IF EXISTS mark_history")
        conn.execute("DROP TABLE IF EXISTS recite_marks")
        conn.commit()
    init_db()


def _migrate_json() -> None:
    if not _JSON_PATH.exists():
        return
    try:
        with _JSON_PATH.open("r", encoding="utf-8") as f:
            legacy = json.load(f)
    except Exception:
        return
    if not isinstance(legacy, dict) or not legacy:
        return
    with connect() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO notes (phrase, content, updated_at) VALUES (?, ?, datetime('now'))",
            [(k, v) for k, v in legacy.items()],
        )
        conn.commit()
    _JSON_PATH.rename(_JSON_PATH.with_suffix(".json.bak"))


def _migrate_mark_keys() -> None:
    """Migrate old mark keys (phrase only) to compound keys (phrase::index)
    for phrases that now have multiple meanings."""
    try:
        from ...data import _phrase_index
    except Exception:
        return

    multi_phrases = {p for p, meanings in _phrase_index.items() if len(meanings) > 1}
    if not multi_phrases:
        return

    with connect() as conn:
        for phrase in multi_phrases:
            # Check if there are marks at the old key
            old = conn.execute(
                "SELECT COUNT(*) FROM mark_history WHERE phrase = ?", (phrase,)
            ).fetchone()[0]
            if old == 0:
                continue
            new_key = f"{phrase}::0"
            existing = conn.execute(
                "SELECT COUNT(*) FROM mark_history WHERE phrase = ?", (new_key,)
            ).fetchone()[0]
            if existing > 0:
                # New key already has data, delete old
                conn.execute("DELETE FROM mark_history WHERE phrase = ?", (phrase,))
            else:
                # Migrate old key to new key
                conn.execute(
                    "UPDATE mark_history SET phrase = ? WHERE phrase = ?",
                    (new_key, phrase),
                )
        conn.commit()
