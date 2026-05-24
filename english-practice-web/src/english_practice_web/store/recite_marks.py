from __future__ import annotations

from .base import connect

TABLE = "mark_history"


def _init_marks_table() -> None:
    with connect() as conn:
        conn.execute(
            f"CREATE TABLE IF NOT EXISTS {TABLE} ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  phrase TEXT NOT NULL,"
            "  status TEXT NOT NULL,"
            "  created_at TEXT NOT NULL DEFAULT (datetime('now'))"
            ")"
        )
        conn.execute(f"CREATE INDEX IF NOT EXISTS idx_mh_phrase ON {TABLE}(phrase)")
        conn.commit()


def get_all() -> dict[str, dict]:
    """Return all phrases with their full mark history."""
    with connect() as conn:
        rows = conn.execute(
            f"SELECT phrase, status, created_at FROM {TABLE} ORDER BY phrase, id ASC"
        ).fetchall()
    result: dict[str, dict] = {}
    for phrase, status, created_at in rows:
        if phrase not in result:
            result[phrase] = {"history": [], "latest": None, "forget_count": 0}
        result[phrase]["history"].append({"status": status, "created_at": created_at})
        result[phrase]["latest"] = status
        if status == "unknown":
            result[phrase]["forget_count"] += 1
    return result


def get(phrase: str) -> dict | None:
    """Return mark history for a single phrase."""
    with connect() as conn:
        rows = conn.execute(
            f"SELECT status, created_at FROM {TABLE} WHERE phrase = ? ORDER BY id ASC",
            (phrase,),
        ).fetchall()
    if not rows:
        return None
    history = [{"status": r[0], "created_at": r[1]} for r in rows]
    forget_count = sum(1 for h in history if h["status"] == "unknown")
    return {
        "history": history,
        "latest": history[-1]["status"],
        "forget_count": forget_count,
    }


def save(phrase: str, status: str) -> dict:
    """Append a mark event and return the updated history."""
    with connect() as conn:
        conn.execute(
            f"INSERT INTO {TABLE} (phrase, status, created_at) VALUES (?, ?, datetime('now'))",
            (phrase, status),
        )
        conn.commit()
    return get(phrase)


def delete(phrase: str) -> None:
    with connect() as conn:
        conn.execute(f"DELETE FROM {TABLE} WHERE phrase = ?", (phrase,))
        conn.commit()
