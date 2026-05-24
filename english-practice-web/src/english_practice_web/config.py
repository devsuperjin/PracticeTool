from __future__ import annotations

import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
PORT = int(os.getenv("PORT", "8080"))
