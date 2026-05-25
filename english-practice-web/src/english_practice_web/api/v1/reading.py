from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Request

from ...data import lookup_phrase
from ...models import ReadingRequest
from ...ollama import call_ollama

router = APIRouter()

_SECTION_RE = re.compile(r"^(TITLE|ARTICLE|PASSAGE|VOCABULARY|QUESTION|ANSWER)\s*:\s*", re.IGNORECASE | re.MULTILINE)


@router.post("/reading")
def generate_reading(payload: ReadingRequest, request: Request) -> dict[str, object]:
    phrases = _reading_phrases(payload)
    if not phrases:
        raise HTTPException(status_code=400, detail="Choose at least one phrasal verb.")
    if len(phrases) > 8:
        raise HTTPException(status_code=400, detail="Choose 8 or fewer phrasal verbs.")

    details = [(phrase, lookup_phrase(phrase)) for phrase in phrases]
    phrase_lines = "\n".join(
        f"- {phrase}: {item['meaning']} Example: {item['example']}"
        for phrase, item in details
    )
    topic = payload.topic.strip() or "a practical IELTS-style topic about work, study, or daily life"
    prompt = (
        "You are an IELTS reading tutor.\n"
        f"Topic: {topic}\n"
        "Use every target phrasal verb naturally and accurately in one coherent article.\n"
        "Target phrasal verbs:\n"
        f"{phrase_lines}\n\n"
        "Write an engaging article of 2-4 short paragraphs. "
        "Then include a concise vocabulary note that lists each target phrasal verb and its contextual meaning. "
        "Finally write one comprehension question and its answer. "
        "Format your response exactly as:\n\n"
        "TITLE:\n<title>\n\n"
        "ARTICLE:\n<article>\n\n"
        "VOCABULARY:\n<one line per phrasal verb>\n\n"
        "QUESTION:\n<question>\n\n"
        "ANSWER:\n<answer>"
    )

    raw = call_ollama(prompt, timeout=30, model=request.headers.get("x-llm-model"))
    if raw.startswith("Connection error:"):
        return {
            "title": "Connection error",
            "article": raw,
            "passage": raw,
            "vocabulary": "",
            "question": "",
            "answer": "",
            "phrases": phrases,
        }

    parts = _SECTION_RE.split(raw)
    result: dict[str, object] = {
        "title": "",
        "article": "",
        "passage": "",
        "vocabulary": "",
        "question": "",
        "answer": "",
        "phrases": phrases,
    }
    for i in range(1, len(parts), 2):
        key = parts[i].lower()
        val = parts[i + 1].strip() if i + 1 < len(parts) else ""
        if key == "passage":
            result["article"] = val
            result["passage"] = val
        else:
            result[key] = val

    if not result["article"]:
        result["article"] = raw.strip()
    if not result["passage"]:
        result["passage"] = result["article"]

    return result


def _reading_phrases(payload: ReadingRequest) -> list[str]:
    phrases: list[str] = []
    if payload.phrase:
        phrases.append(payload.phrase.strip())
    phrases.extend(item.strip() for item in payload.phrases if item.strip())
    return list(dict.fromkeys(phrases))
