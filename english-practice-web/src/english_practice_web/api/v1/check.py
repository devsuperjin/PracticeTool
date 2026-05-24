from __future__ import annotations

from fastapi import APIRouter

from ...data import lookup_phrase
from ...models import CheckRequest, ReciteCheckRequest
from ...ollama import call_ollama

router = APIRouter()


@router.post("/check")
def check_sentence(payload: CheckRequest) -> dict[str, str]:
    details = lookup_phrase(payload.phrase)
    prompt = (
        "I am practicing IELTS phrasal verbs.\n"
        f"Target phrase: {payload.phrase}\n"
        f"Meaning: {details['meaning']}\n"
        f"Example provided: {details['example']}\n\n"
        f"My sentence: '{payload.sentence}'\n\n"
        "Please check if I used the phrasal verb correctly. Provide the response as plain text."
    )
    return {"feedback": call_ollama(prompt)}


@router.post("/check-recite")
def check_recite(payload: ReciteCheckRequest) -> dict[str, str]:
    details = lookup_phrase(payload.phrase)
    prompt = (
        "You are an IELTS English-Chinese bilingual tutor.\n"
        f"English phrasal verb: {payload.phrase}\n"
        f"Actual English meaning: {details['meaning']}\n"
        f"My Chinese translation: '{payload.chinese_input}'\n\n"
        "Please check if my Chinese translation correctly captures the meaning. "
        "If correct, say 'Correct!' and briefly explain why. "
        "If incorrect, gently point out what is missing and give the correct Chinese meaning. "
        "Reply in Chinese."
    )
    return {"feedback": call_ollama(prompt)}
