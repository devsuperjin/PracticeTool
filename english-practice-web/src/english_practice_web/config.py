from __future__ import annotations

import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
LLM_MODEL_OPTIONS = [
    item.strip()
    for item in os.getenv("OLLAMA_MODELS", MODEL_NAME).split(",")
    if item.strip()
]
if MODEL_NAME not in LLM_MODEL_OPTIONS:
    LLM_MODEL_OPTIONS.insert(0, MODEL_NAME)
PORT = int(os.getenv("PORT", "8080"))
JWT_SECRET = os.getenv("JWT_SECRET", "practice-tool-local-secret")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "720"))
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
