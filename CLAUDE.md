# website-merge

Saket's personal game arcade site.

## Architecture

- Static site, no backend, no build step, no framework. `index.html` is a thin shell for **ArcadeOS**, a desktop-style UI: menu bar with clock, dock, draggable/resizable windows (red/yellow/green buttons = close/minimize/zoom), folders, widgets, and Spotlight (Ctrl/Cmd+K). The code is plain scripts under `os/`, loaded in this order by `index.html`:
  - `brain.js` — original rule-based AI engine, unchanged.
  - `agent-mascot.js` — the `<agent-mascot>` web component extracted verbatim from the Blob Atelier mascot maker by Victoria Wu (MIT; keep the license header; the original file was removed, see git history). Used as the AI's sprite.
  - `cursor.js` — liquid-blob + neon-paint WebGL cursor, derived from the original `coursor2.html` demo (removed, see git history; physics/shader kept, made a transparent overlay with start/stop/suspend/resume). Exposes `window.OSCursor`.
  - `core.js` — game/system-app catalog, persisted state, folder/app model, link→app helpers, fuzzy app search.
  - `ui.js` — context menus, form dialogs, toasts, Spotlight.
  - `wm.js` — settings→CSS, wallpapers, menu bar/clock, window manager, dock, desktop (folder tiles + widgets).
  - `widgets.js` — 16 widget types (incl. AI Buddy and Custom Text), weather service, safe calculator.
  - `apps.js` — Finder, Browser, Search, Settings.
  - `ai.js` — OS-aware AI layer + chat UI.
  - `os.css` — all styles (themed via CSS variables).
- The old tabbed UI (`classic.html`, earlier `index.html`/`official-site.html`) was removed once ArcadeOS replaced it; it is recoverable from git history if ever needed.
- `games/` holds each game as its own standalone HTML file, loaded into an iframe inside a window. `games/exports/` holds games ported in from elsewhere (UGS portal, etc.).
- Games are **not auto-discovered**. To add one, add a `G(id, name, emoji, color, tag, path, defaultFolder)` row to `OS.BUILTIN` in `os/core.js`. It then shows up in its folder, Spotlight, and the AI automatically. New built-ins are adopted into their default folder for existing users (`OS.reconcile`).
- Any link (or a `games/*.html` path) can be turned into an app by the user; it opens in an iframe window. Only `http(s)` links and `games/` paths are accepted (`OS.normUrl`). Sites that send X-Frame-Options / CSP `frame-ancestors` won't load in a frame, so link windows show an "open in new tab" fallback.
- **Persistence:** everything lives in `localStorage` (`arcadeos.v1`; wallpaper image in `arcadeos.wall`), so it is per browser/computer, **not per IP** (there is no server). Settings → Data & Sync offers a backup file and a copy/paste settings code to move to another computer. Imports go through a guarded `OS.merge` (blocks `__proto__` etc.).
- Default to solutions that need no backend/build step. When a feature could go either "call an external API" or "do it client-side," prefer client-side/offline first and note the tradeoff, rather than defaulting to a backend.
- External calls ArcadeOS can make (all optional, all CORS/no-key): Open-Meteo (weather widget/AI), Wikipedia + dictionaryapi.dev (AI look-ups and Instant search; toggle in Settings → AI), Google favicon service (off by default), plus whatever sites the user opens.

## Audience / performance

The site's own running joke is a terms gate asking "are you in school right now" — a chunk of the real audience is likely school-age kids on low-end/school-issued devices (Chromebooks), not gaming PCs. Keep this in mind before recommending always-on heavy effects (animated canvas backgrounds, custom cursors, stacked `backdrop-filter: blur()`, large in-browser ML models) — flag the performance tradeoff rather than assuming a beefy device.

- ArcadeOS's own effects are `backdrop-filter` blur on glass surfaces and an animated "Blobs" wallpaper (CSS only).
- **Custom cursor** (`os/cursor.js`): a full-screen fragment shader that runs every frame while active (it self-throttles resolution, but is still the heaviest thing here). Setting `settings.cursor` = auto/on/off (Settings → Appearance → Custom cursor). Auto = on only for capable, non-touch devices that aren't in Reduced effects (`OS.cursorWanted` in `wm.js`). Mouse events don't reach the page while the pointer is over a game iframe, so `OS.cursorCheck`/a capture-phase `pointerover` suspends the blob and shows the native cursor there.
- The AI mascot is frozen (`still`) in Reduced effects; 3D animal mascots are disabled (flat sprites) on low-end devices / Reduced effects.
- Settings → Appearance → **Visual effects** (Auto / Reduced / Full) removes blur and all animations. Auto picks Reduced when the device reports ≤4 CPU cores or ≤4 GB RAM (`OS.lowEnd`). This is the "Performance / Reduced Effects" toggle that was previously planned.

## AI (AR.OS AI)

Fully offline by design — a deliberate choice over a real LLM API, to avoid needing a backend/API key for a static site.

- `AROS_BRAIN` (`os/brain.js`) is a rule-based engine: regex/keyword dispatch for live game stats, tactics, weapons, maps, codes, math, coding/school topics, facts. When no rule matches, a semantic fallback embeds the message with a small local model (`Xenova/all-MiniLM-L6-v2` via Transformers.js, lazy-loaded once from a CDN and cached by the browser) and matches by cosine similarity against `SEMANTIC_EXAMPLES`/`TOPIC_REPLIES`.
- `os/ai.js` wraps it with OS-aware intents (first match wins; order matters): open/close apps, recommend games from play time, change theme/wallpaper/accent/dock/effects, add/remove widgets, create/move/delete folders, turn links into apps, timers and reminders (only while the tab is open), notes/todos, unit conversion and math, weather, time in other cities, jokes/dice/coin, a small name/facts memory, and optional Wikipedia/dictionary look-ups. Anything unmatched falls through to the brain. The AI has a mascot (`OS.mascot` in `ai.js`: 8 blob shapes + 8 animals, colors, materials; saved in `S.ai.mascot`; customised in Settings → AI). It appears in the chat header (reacts: typing→listening, thinking, replying→talking, result→happy/error), the dock/menu-bar icon and the "AI Buddy" widget. Animals render in 3D by loading three.js from a CDN only when chosen. Extra intents: change mascot ("be a bunny", "mascot color mint"), turn the cursor on/off. The brain's live-game stats don't apply inside the OS (games run in iframes), so `ctx` is a neutral stub.
