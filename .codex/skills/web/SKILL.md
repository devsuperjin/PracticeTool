---
name: web
description: This document defines the technical capabilities and execution boundaries for a full-stack web development environment.

---

# Web Development Skills (Agent Spec)

This document defines the technical capabilities and execution boundaries for a full-stack web development environment.

It is optimized for AI coding agents, ensuring consistent architecture decisions, implementation patterns, and tooling preferences.

---

## 1. Core Web Stack

### Frontend
- HTML5 (semantic structure, accessibility-first design)
- CSS3 (Flexbox, Grid, responsive layouts, mobile-first)
- JavaScript (ES6+, async/await, modules)
- TypeScript (strict typing preferred)

### Frameworks
- Vue 3 (Composition API preferred)
- React (functional components, hooks)
- Vue Router / React Router
- Pinia / Redux (state management)

### UI Layer
- Component-based architecture
- Reusable design system patterns
- UI frameworks:
  - Element Plus
  - Arco Design
- Responsive UI across desktop/mobile

---

## 2. Backend Systems

### Languages
- Python (primary backend language)

### Frameworks
- FastAPI (preferred for APIs)
- Flask (lightweight services)
- Django (full-stack monolithic apps if required)

### API Design
- RESTful API (strict resource-based design)
- JSON as standard payload format
- Versioned APIs (/api/v1/)

### Authentication & Security
- JWT-based authentication
- Role-Based Access Control (RBAC)
- Password hashing (bcrypt/argon2)
- Input validation and sanitization

---

## 3. Data Layer

### Databases
- MySQL / MariaDB (primary relational DB)
- Redis (cache / session / queue support)

### Data Modeling
- Normalized schema design (3NF preferred unless performance requires denormalization)
- Indexing strategy for query optimization
- Transaction-safe operations

---

## 4. System Architecture

- Frontend / Backend separation (decoupled architecture)
- Service-oriented design (modular services)
- Layered backend architecture:
  - Controller → Service → Repository → DB
- Stateless API design where possible

---

## 5. DevOps & Deployment

### Operating Environment
- Linux (Ubuntu preferred)

### Infrastructure
- Nginx (reverse proxy / load balancing)
- Docker (containerized deployment)

### Deployment Patterns
- Environment-based config (.env)
- Production vs development separation
- Log-based debugging (structured logs preferred)

---

## 6. Networking & Protocols

- HTTP/HTTPS fundamentals
- TCP/IP basic understanding
- CORS handling strategy
- WebSocket (real-time communication)
- REST API conventions compliance

---

## 7. Engineering Standards (Agent Rules)

### Code Quality
- Clean, modular, and reusable code
- Strict separation of concerns
- Avoid business logic in controllers
- Prefer explicit over implicit behavior

### Error Handling
- Centralized error handling strategy
- Consistent API error response format:
  ```json
  {
    "code": "ERROR_CODE",
    "message": "human readable message"
  }
---
name: web
description: Vanilla JS single-page frontend for the English Practice web app. Use when building, modifying, or debugging the UI layer: DOM manipulation, CSS with Arco Design tokens, fetch-based API calls, modal dialogs, and sidebar/header layout patterns. Covers the actual frontend stack — no frameworks.
---

# Frontend UI

Single-page vanilla JS app with three views: Select, Practice, Recite. Served as static files by FastAPI at `/ui/`. The index route returns `index.html` directly.

## File layout

```
src/english_practice_web/ui/
├── index.html    # Structure: sidebar, header tabs, three page sections, modal
├── style.css     # Arco Design-inspired CSS variables and layout
└── app.js        # All JS logic in one IIFE module
```

## HTML structure

Fixed layout with three zones:

- **Sidebar** (`.arco-sider`): Fixed left, 280px. Contains word list grouped by first letter, collapsible letter groups, and an A-Z alpha bar.
- **Header** (`.arco-header`): Fixed top, starting after sidebar. Three tab buttons for Select / Practice / Recite.
- **Main** (`.arco-main`): Scrollable content area with three `.page` sections, only one active.
- **Modal** (`.modal-overlay`): Notes editor, shared across Practice and Recite views.

## CSS conventions

All design tokens live in CSS custom properties under `:root`:

```css
:root {
  --arcoblue-6: #165DFF;
  --green-6: #00B42A;
  --orange-6: #FF7D00;
  --red-6: #F53F3F;
  --purple-6: #722ED1;
  --gray-1 through --gray-10;
  --sidebar-w: 280px;
  --header-h: 48px;
  --radius-sm: 2px; --radius: 4px; --radius-lg: 8px;
  --shadow-card: 0 2px 5px rgba(0,0,0,.06);
  --shadow-modal: 0 4px 20px rgba(0,0,0,.12);
}
```

When adding new UI elements, use existing CSS variables. Prefix custom component classes with `arco-` for visual consistency. Follow the existing class naming: `.arco-btn`, `.arco-btn-primary`, `.arco-card`, `.arco-input`, `.arco-textarea`, `.arco-select`, `.arco-feedback`.

## JavaScript architecture

All logic in one IIFE inside `app.js`:

```javascript
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  // ... all state, DOM refs, and functions
  window.addEventListener('DOMContentLoaded', init);
})();
```

### State management

Module-level variables hold all state:

- `phrases` — full word list from `/api/v1/list`
- `groups`, `letters` — derived grouping by first letter
- `notesCache` — notes from `/api/v1/notes`
- `plans`, `activePlan`, `planWords` — plan management
- `currentPhrase` — the currently selected phrase
- `selectedSet`, `selectFilter` — selection grid state

No framework state management — just reassign variables and re-render the affected DOM.

### API calls

All API calls use `fetch()` with async/await. No shared client wrapper — call fetch directly:

```javascript
const res = await fetch('/api/v1/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phrase: currentPhrase.phrase, sentence: s })
});
const data = await res.json();
```

### DOM patterns

- Use `$()` and `$$()` helpers for queries
- Re-render functions: `renderSidebar()`, `renderSelectGrid()`, `renderAlphaBar()`
- Build DOM with `document.createElement()`, not innerHTML (except for simple text)
- Toggle visibility with `element.hidden` or `.classList.toggle()`
- Modal: `modalOverlay.classList.add('open')` / `remove('open')`
- Page switching: `pageSelect.classList.add('active')` / `remove('active')`

### Navigation

Three views controlled by header tabs. `switchPage(page)` toggles `.active` on page sections and header tabs. Practice and Recite share the same `selectPhrase()` flow — selecting a word from the sidebar populates both cards.

Prev/next navigation uses `getNavList()` which respects the active plan filter:

```javascript
function getNavList() { return planWords.length ? planWords : phrases; }
```

## Selection grid

The Select page shows all phrases organized by first letter. Each word is a clickable span with a checkbox indicator. Words locked by the active plan cannot be deselected. Filter buttons (All / Selected / Unselected) control which words are shown.

When building selection UI, keep the `selectedSet` in sync with DOM classes — toggle both together.

## Notes

Notes are saved incrementally: 600ms debounce on textarea input, plus explicit Save/Delete buttons. The note dot indicator appears on sidebar items and selection grid items via `.dot.visible`. Both Practice and Recite cards show a note button that opens the shared modal.

## Plans

Plans are named word lists stored via `/api/v1/plans`. Auto Create generates day-based plans from the full word list. Manual plans are built from selected words. The active plan filters the sidebar and navigation. Plan badge shows in the sidebar header.
