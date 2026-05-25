from __future__ import annotations

from .base import connect


def _init_notes_table() -> None:
    with connect() as conn:
        # Check if we need migration from old schema (no id column)
        cols = [c[1] for c in conn.execute("PRAGMA table_info(notes)").fetchall()]
        if cols and "id" not in cols:
            conn.execute("ALTER TABLE notes RENAME TO notes_old")
            conn.execute(
                "CREATE TABLE notes ("
                "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
                "  phrase TEXT NOT NULL,"
                "  content TEXT NOT NULL DEFAULT '',"
                "  created_at TEXT NOT NULL DEFAULT (datetime('now')),"
                "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))"
                ")"
            )
            conn.execute(
                "INSERT INTO notes (phrase, content, created_at, updated_at) "
                "SELECT phrase, content, updated_at, updated_at FROM notes_old"
            )
            conn.execute("DROP TABLE notes_old")
        else:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS notes ("
                "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
                "  phrase TEXT NOT NULL,"
                "  content TEXT NOT NULL DEFAULT '',"
                "  created_at TEXT NOT NULL DEFAULT (datetime('now')),"
                "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))"
                ")"
            )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_phrase ON notes(phrase)")
        _canonicalize_note_phrases(conn)
        conn.commit()


def _canonicalize_note_phrases(conn) -> None:
    """Keep note phrase keys aligned to the canonical word list spelling."""
    try:
        from ..data import find_canonical_phrase
    except Exception:
        return

    rows = conn.execute("SELECT id, phrase FROM notes").fetchall()
    for note_id, phrase in rows:
        canonical = find_canonical_phrase(phrase)
        if canonical and canonical != phrase:
            conn.execute(
                "UPDATE notes SET phrase = ?, updated_at = datetime('now') WHERE id = ?",
                (canonical, note_id),
            )


def _row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "phrase": row[1],
        "content": row[2],
        "created_at": row[3],
        "updated_at": row[4],
    }


def get_all() -> dict[str, list[dict]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, phrase, content, created_at, updated_at FROM notes ORDER BY phrase, created_at ASC"
        ).fetchall()
    result: dict[str, list[dict]] = {}
    for row in rows:
        phrase = row[1]
        if phrase not in result:
            result[phrase] = []
        result[phrase].append(_row_to_dict(row))
    return result


def get(phrase: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, phrase, content, created_at, updated_at FROM notes WHERE phrase = ? ORDER BY created_at ASC",
            (phrase,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def save(phrase: str, content: str) -> dict:
    """Create a new note for a phrase."""
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO notes (phrase, content) VALUES (?, ?)",
            (phrase, content),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, phrase, content, created_at, updated_at FROM notes WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return _row_to_dict(row)


def update(note_id: int, content: str) -> dict | None:
    with connect() as conn:
        conn.execute(
            "UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?",
            (content, note_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, phrase, content, created_at, updated_at FROM notes WHERE id = ?",
            (note_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def delete(note_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
        return cur.rowcount > 0
