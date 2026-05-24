from __future__ import annotations

import re

from fastapi import APIRouter

from ...data import lookup_phrase
from ...models import ReadingRequest
from ...ollama import call_ollama

router = APIRouter()

_SECTION_RE = re.compile(r"^(PASSAGE|QUESTION|ANSWER)\s*:\s*", re.IGNORECASE | re.MULTILINE)


@router.post("/reading")
def generate_reading(payload: ReadingRequest) -> dict[str, str]:
    details = lookup_phrase(payload.phrase)
    prompt = (
        "You are an IELTS reading tutor. "
        f"Write a short paragraph (4-6 sentences) on an IELTS-relevant topic "
        f"that naturally uses the phrasal verb '{payload.phrase}' "
        f"(meaning: {details['meaning']}). "
        "Make the paragraph engaging and academic in tone. "
        "Then, write ONE comprehension question about the paragraph "
        "that tests understanding of the phrasal verb in context. "
        "Format your response exactly as:\n\n"
        "PASSAGE:\n<paragraph>\n\nQUESTION:\n<question>\n\nANSWER:\n<answer>"
    )

    raw = call_ollama(prompt, timeout=30)
    if raw.startswith("Connection error:"):
        return {"passage": raw, "question": "", "answer": ""}

    parts = _SECTION_RE.split(raw)
    result: dict[str, str] = {"passage": "", "question": "", "answer": ""}
    for i in range(1, len(parts), 2):
        key = parts[i].lower()
        val = parts[i + 1].strip() if i + 1 < len(parts) else ""
        result[key] = val

    return result
