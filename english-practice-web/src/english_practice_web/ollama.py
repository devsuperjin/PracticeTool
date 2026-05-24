from __future__ import annotations

import requests

from .config import MODEL_NAME, OLLAMA_URL


def call_ollama(prompt: str, timeout: int = 15) -> str:
    """Send a prompt to Ollama and return the response text.

    Returns a user-friendly error string on connection failure.
    """
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": MODEL_NAME, "prompt": prompt, "stream": False},
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json().get("response", "No response from AI.")
    except requests.RequestException as exc:
        return f"Connection error: {exc}. Is Ollama running?"

