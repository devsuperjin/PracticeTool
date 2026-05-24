from __future__ import annotations

import json

from .base import connect


def _init_plans_table() -> None:
    with connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS plans ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  name TEXT UNIQUE NOT NULL,"
            "  words TEXT NOT NULL DEFAULT '[]',"
            "  created_at TEXT NOT NULL DEFAULT (datetime('now')),"
            "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))"
            ")"
        )
        conn.commit()


def _plan_row(row) -> dict:
    return {"id": row[0], "name": row[1], "words": json.loads(row[2]),
            "created_at": row[3], "updated_at": row[4]}


def list_plans() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT id, name, words, created_at, updated_at FROM plans ORDER BY id ASC").fetchall()
    return [_plan_row(r) for r in rows]


def get_plan(name: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT id, name, words, created_at, updated_at FROM plans WHERE name = ?", (name,)).fetchone()
    return _plan_row(row) if row else None


def save_plan(name: str, words: list[str]) -> dict:
    words_json = json.dumps(words, ensure_ascii=False)
    with connect() as conn:
        conn.execute(
            "INSERT INTO plans (name, words, updated_at) VALUES (?, ?, datetime('now'))"
            " ON CONFLICT(name) DO UPDATE SET words=excluded.words, updated_at=datetime('now')",
            (name, words_json),
        )
        conn.commit()
        row = conn.execute("SELECT id, name, words, created_at, updated_at FROM plans WHERE name = ?", (name,)).fetchone()
    return _plan_row(row)


def delete_plan(name: str) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM plans WHERE name = ?", (name,))
        conn.commit()
        return cur.rowcount > 0
