from __future__ import annotations

import time
from urllib.parse import urlparse, urlunparse

import requests

from .config import LLM_MODEL_OPTIONS, MODEL_NAME, OLLAMA_URL

_model_cache: list[str] | None = None
_model_cache_at = 0.0


def call_ollama(prompt: str, timeout: int = 15, model: str | None = None) -> str:
    """Send a prompt to Ollama and return the response text.

    Returns a user-friendly error string on connection failure.
    """
    selected_model = normalize_model(model)
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": selected_model, "prompt": prompt, "stream": False},
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json().get("response", "No response from AI.")
    except requests.RequestException as exc:
        return f"Connection error: {exc}. Is Ollama running?"


def normalize_model(model: str | None) -> str:
    if model and model in available_models():
        return model
    return MODEL_NAME


def llm_settings() -> dict[str, object]:
    options = available_models()
    return {"default_model": MODEL_NAME, "model_options": options}


def available_models() -> list[str]:
    global _model_cache, _model_cache_at
    if _model_cache is not None and time.time() - _model_cache_at < 60:
        return _model_cache

    models = list(LLM_MODEL_OPTIONS)
    try:
        resp = requests.get(_ollama_tags_url(), timeout=3)
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("models", []):
            name = item.get("name") if isinstance(item, dict) else None
            if name and name not in models:
                models.append(name)
    except requests.RequestException:
        pass
    _model_cache = models
    _model_cache_at = time.time()
    return models


def _ollama_tags_url() -> str:
    parsed = urlparse(OLLAMA_URL)
    return urlunparse((parsed.scheme, parsed.netloc, "/api/tags", "", "", ""))
