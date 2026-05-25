# English Practice Web

FastAPI + SQLite web app for practicing IELTS-style phrasal verbs. The current UI is the vanilla HTML/CSS/JavaScript v2 app served at `/v2/`.

## Run

```bash
uv run python -m english_practice_web.server
```

Then open:

```text
http://localhost:8080/v2/
```

Default local login:

```text
username: admin
password: admin
```

## Main Features

- Dashboard for study progress
- Reading generation using selected phrasal verbs
- Practice, recite, and spaced review flows
- Word selection and plans
- Notes linked to canonical phrasal verbs
- SQLite persistence
- JWT-protected API
- Ollama-backed AI feedback
- Light and dark mode

## Configuration

Environment variables:

```text
PORT=8080
JWT_SECRET=practice-tool-local-secret
JWT_EXPIRES_MINUTES=720
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3.2:latest
OLLAMA_MODELS=llama3.2:latest
```

## Data

SQLite data is stored in:

```text
data/notes.db
```

## Useful Checks

```bash
uv run python -m compileall -q src/english_practice_web
node --check src/english_practice_web/ui_v2/app.js
```
