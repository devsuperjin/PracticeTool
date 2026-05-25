from __future__ import annotations

from datetime import datetime, timedelta
from math import ceil
from typing import Iterable

BALANCED_INTERVALS = [1, 3, 7, 14, 30, 60, 120]
AGGRESSIVE_INTERVALS = [1, 2, 4, 7, 14, 30, 60]
AGGRESSIVE_LOOKAHEAD_DAYS = 2


def build_review_queue(
    phrase_index: dict[str, list[dict]],
    marks: dict[str, dict],
    *,
    limit: int = 80,
    include_new: bool = True,
    include_later: bool = False,
    mode: str = "balanced",
    minutes: int = 0,
) -> dict:
    now = datetime.utcnow()
    normalized_mode = _normalize_mode(mode)
    target_limit = _target_limit(limit, minutes, normalized_mode)
    all_items = []

    for phrase, meanings in sorted(phrase_index.items()):
        for meaning in meanings:
            key = _mark_key(phrase, meaning)
            item = _review_item(phrase, meaning, key, marks.get(key), now, normalized_mode)
            all_items.append(item)

    items = []
    for item in all_items:
        if item["bucket"] == "new" and not include_new:
            continue
        if item["bucket"] == "later" and not include_later:
            continue
        items.append(item)

    items.sort(key=lambda item: (-item["priority"], item["due_at"] or "", item["phrase"]))
    selected = items[:target_limit]
    summary = _summary(all_items, selected, normalized_mode, minutes, target_limit)
    return {
        "settings": {
            "mode": normalized_mode,
            "minutes": minutes,
            "limit": target_limit,
            "items_per_minute": _items_per_minute(normalized_mode),
        },
        "summary": summary,
        "items": selected,
    }


def _review_item(phrase: str, meaning: dict, key: str, mark: dict | None, now: datetime, mode: str) -> dict:
    history = list((mark or {}).get("history") or [])
    forget_count = int((mark or {}).get("forget_count") or 0)

    if not history:
        return {
            **_base_item(phrase, meaning, key),
            "bucket": "new",
            "due": True,
            "priority": 48 if mode == "aggressive" else 35,
            "interval_days": 0,
            "due_at": None,
            "last_reviewed_at": None,
            "latest": None,
            "review_count": 0,
            "forget_count": 0,
            "known_streak": 0,
            "overdue_days": 0,
            "next_action": "learn",
        }

    latest = history[-1].get("status")
    last_reviewed = _parse_dt(history[-1].get("created_at")) or now
    known_streak = _known_streak(history)

    if latest == "unknown":
        return {
            **_base_item(phrase, meaning, key),
            "bucket": "again",
            "due": True,
            "priority": 135 + forget_count * 14 if mode == "aggressive" else 120 + forget_count * 12,
            "interval_days": 0,
            "due_at": _iso(last_reviewed),
            "last_reviewed_at": _iso(last_reviewed),
            "latest": latest,
            "review_count": len(history),
            "forget_count": forget_count,
            "known_streak": known_streak,
            "overdue_days": 0,
            "next_action": "retry",
        }

    interval = _interval_days(known_streak, forget_count, mode)
    due_at = last_reviewed + timedelta(days=interval)
    overdue_days = max(0, ceil((now - due_at).total_seconds() / 86400))
    is_due = now >= due_at
    soon = mode == "aggressive" and not is_due and due_at <= now + timedelta(days=AGGRESSIVE_LOOKAHEAD_DAYS)
    priority = (92 if is_due else 68 if soon else 10) + overdue_days * 8 + forget_count * 9 - known_streak

    return {
        **_base_item(phrase, meaning, key),
        "bucket": "due" if is_due else "soon" if soon else "later",
        "due": is_due or soon,
        "priority": priority,
        "interval_days": interval,
        "due_at": _iso(due_at),
        "last_reviewed_at": _iso(last_reviewed),
        "latest": latest,
        "review_count": len(history),
        "forget_count": forget_count,
        "known_streak": known_streak,
        "overdue_days": overdue_days,
        "next_action": "review" if is_due else "early_review" if soon else "wait",
    }


def _summary(
    all_items: list[dict],
    selected: list[dict],
    mode: str,
    minutes: int,
    target_limit: int,
) -> dict[str, int | str]:
    return {
        "total": len(all_items),
        "shown": len(selected),
        "due": sum(1 for item in all_items if item["bucket"] in {"due", "again", "soon"}),
        "new": sum(1 for item in all_items if item["bucket"] == "new"),
        "weak": sum(1 for item in all_items if item["bucket"] == "again" or item["forget_count"] > 0),
        "soon": sum(1 for item in all_items if item["bucket"] == "soon"),
        "later": sum(1 for item in all_items if item["bucket"] == "later"),
        "mode": mode,
        "minutes": minutes,
        "target_limit": target_limit,
    }


def _base_item(phrase: str, meaning: dict, key: str) -> dict:
    return {
        "key": key,
        "phrase": phrase,
        "meaning": meaning.get("meaning", ""),
        "example": meaning.get("example", ""),
        "meaning_index": int(meaning.get("meaning_index", 0)),
        "total_meanings": int(meaning.get("total_meanings", 1)),
    }


def _mark_key(phrase: str, meaning: dict) -> str:
    return f"{phrase}::{meaning.get('meaning_index', 0)}" if int(meaning.get("total_meanings", 1)) > 1 else phrase


def _known_streak(history: Iterable[dict]) -> int:
    streak = 0
    for item in reversed(list(history)):
        if item.get("status") != "known":
            break
        streak += 1
    return streak


def _interval_days(known_streak: int, forget_count: int, mode: str) -> int:
    intervals = AGGRESSIVE_INTERVALS if mode == "aggressive" else BALANCED_INTERVALS
    base = intervals[min(max(known_streak, 1) - 1, len(intervals) - 1)]
    penalty = 1 + min(forget_count, 4) * (0.45 if mode == "aggressive" else 0.35)
    return max(1, round(base / penalty))


def _normalize_mode(mode: str) -> str:
    return "aggressive" if mode == "aggressive" else "balanced"


def _items_per_minute(mode: str) -> int:
    return 3 if mode == "aggressive" else 2


def _target_limit(limit: int, minutes: int, mode: str) -> int:
    if minutes <= 0:
        return limit
    return min(limit, max(5, minutes * _items_per_minute(mode)))


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat(timespec="seconds") if value else None
