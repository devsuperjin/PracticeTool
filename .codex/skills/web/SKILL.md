---
name: web
description: "Frontend development for this project's English Practice web app. Use when building, modifying, or debugging the current vanilla JS v2 UI at /v2/: DOM rendering, CSS tokens, auth-aware fetch calls, dashboard/practice/recite/review/reading/select/settings views, notes modals, plans, and light/dark appearance."
---

# Frontend UI

Use this skill for frontend work in `english-practice-web/src/english_practice_web/ui_v2/`. This is the current UI served at `/v2/`. There is also an older Vue/Vite UI under `ui/`; only work there when the user explicitly asks for the Vue app.

## File Layout

```text
english-practice-web/src/english_practice_web/ui_v2/
|-- index.html    # Static shell and all view markup
|-- style.css     # Design tokens, layout, light/dark themes
`-- app.js        # Single IIFE with state, API calls, events, renderers
```

FastAPI mounts this folder as static HTML at `/v2/` from `english_practice_web/__init__.py`.

## UI Structure

- Topbar: brand, dashboard/reading buttons, Learning and Settings menus, status, logout.
- Sidebar: alphabet shortcuts, grouped word list, current plan badge, note/mark dots.
- Main shell: seven pages controlled by hash/view state: `dashboard`, `practice`, `recite`, `review`, `reading`, `select`, `settings`.
- Notes panel/modal: shared note CRUD for the selected phrase.
- Login overlay: shown when no bearer token exists or an API returns 401.
- Toast: short error/status messages.

## CSS Conventions

- Keep design tokens in `:root` and dark overrides in `html[data-theme="dark"]`.
- Reuse existing variables such as `--blue-6`, `--gray-*`, `--surface-*`, `--sidebar-w`, `--header-h`, `--radius`, and `--shadow-*`.
- Prefer existing utility/component classes: `surface`, `btn`, `btn-primary`, `icon-btn`, `input`, `text-area`, `feedback`, `empty-state`, `dot`, `page`, and view-specific classes.
- Maintain the fixed app shell: topbar plus sidebar plus scrollable main area.
- Keep responsive text and controls inside their containers. Do not add oversized hero or marketing layouts to the tool UI.

## JavaScript Architecture

All current UI logic lives in one IIFE in `app.js`:

```javascript
(function () {
  "use strict";

  const API_BASE = "/api/v1";
  const state = { /* app state */ };
  const refs = {};

  window.addEventListener("DOMContentLoaded", init);
})();
```

Follow the existing pattern:

- Add DOM references in `cacheRefs()`.
- Wire event handlers in `bindEvents()`.
- Store client state in the module-level `state` object.
- Render through focused functions such as `renderDashboard()`, `renderPractice()`, `renderReview()`, `renderReading()`, `renderSelect()`, and `renderSettings()`.
- Use `setView()` for page switching and hash updates.
- Use helper functions like `el()`, `clear()`, `$()`, and `$all()` for DOM construction.
- Prefer `textContent` and `document.createElement` through `el()`. Avoid raw `innerHTML` for user or API data.

## API Calls

Use the `api` object in `app.js`, backed by `fetchJson()`:

- `fetchJson()` adds `Authorization: Bearer <token>` for protected calls.
- It adds `X-LLM-Model` when the user selected a non-default model.
- It parses JSON errors and clears auth on 401.
- Login uses `{ auth: false }`.

When adding endpoints, add a method to `api` first, then call it from handlers:

```javascript
newAction: (payload) =>
  fetchJson(`${API_BASE}/resource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),
```

## State Rules

Core state lives in `state`:

- `phrases`, `notesCache`, `marksCache`, `reviewItems`, `reviewSummary`
- `plans`, `activePlan`, `currentPhrase`, `selectedSet`
- `view`, `selectFilter`, `reviewFilter`, `reviewMode`, `reviewMinutes`
- `readingWords`, `readingResult`
- `llmSettings`, modal state, feedback text, reveal flags

When state changes, re-render the smallest useful area. Use `renderAll()` after broad changes such as login, plan changes, reset, or review refresh.

## Feature Conventions

- Phrase navigation should respect `navList()`, which filters by the active plan.
- Plans are saved through `/api/v1/plans`; sanitize names with `sanitizePlanName()`.
- Selection chips treat active-plan words as locked.
- Notes update `notesCache`, then re-render notes/sidebar/select indicators.
- Marks use `markKey()` for multi-meaning phrases: `phrase::meaning_index`.
- Review settings persist in `localStorage` and refresh `/api/v1/review`.
- Appearance uses `englishPracticeAppearance` plus `html[data-theme]` and `html[data-appearance]`.
- LLM model choice is stored in `englishPracticeLlmModel`.

## Legacy Vue UI

The `ui/` directory contains a Vue 3/Vite/Pinia/Arco source app and a built `dist/` fallback served by the FastAPI catch-all route. Treat it as legacy unless requested. If touching it, use its package scripts from `english-practice-web/src/english_practice_web/ui/`.

## Useful Checks

Run from `english-practice-web/`:

```bash
node --check src/english_practice_web/ui_v2/app.js
uv run python -m english_practice_web.server
```
