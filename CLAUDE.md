# website-merge

Saket's personal game arcade site.

## Architecture

- Static site, no backend, no build step, no framework. `official-site.html` is a single large file with embedded CSS/JS — the whole app shell (nav, home/landing page, games grid, exports grid, experiments/ports grid, AI sidebar, settings, terms modal).
- `games/` holds each game as its own standalone HTML file, loaded on demand into a shared `<iframe id="eg-frame">` overlay (`launchEmbeddedGame`/`launchGame`/`launchExportGame`/`openPort`). `games/exports/` holds games ported in from elsewhere (UGS portal, etc.).
- Games are **not auto-discovered**. Adding a new game/export requires registering it in three places in `official-site.html`: `GAME_PATHS`, `GAME_TITLES`, and a `.gc` card in the relevant grid (`#game-grid` or `#exports-grid`). The home-page search (`SEARCH_INDEX`) derives from `GAME_PATHS`, so it updates automatically once a game is registered there.
- Default to solutions that need no backend/build step — that matches the existing architecture. When a feature could go either "call an external API" or "do it client-side," prefer client-side/offline first and note the tradeoff, rather than defaulting to a backend.

## Audience / performance

The site's own running joke is a terms gate asking "are you in school right now" — a chunk of the real audience is likely school-age kids on low-end/school-issued devices (Chromebooks), not gaming PCs. Keep this in mind before recommending always-on heavy effects (animated canvas backgrounds, custom cursors, stacked `backdrop-filter: blur()`, large in-browser ML models) — flag the performance tradeoff rather than assuming a beefy device.

A known unresolved perf issue: a full-screen canvas fluid-ripple background + custom liquid metaball cursor run every frame, forever, on every page (`renderBgGrid`/`renderLiquidCursor` in `official-site.html`), stacked with ~11 `backdrop-filter: blur()` layers and ~18 concurrent infinite CSS animations. Planned fix (not yet built): a "Performance / Reduced Effects" toggle in Settings to disable the canvas background + custom cursor.

## AI sidebar (AR.OS AI)

Fully offline by design — this was a deliberate choice over hooking up a real LLM API, specifically to avoid needing a backend/API key for a static site.

- `AROS_BRAIN` (inside `official-site.html`) is a rule-based engine: regex/keyword dispatch for live game stats, tactics, weapons, maps, codes, math, coding/school topics, facts.
- When no keyword rule matches, a semantic fallback kicks in: the message is embedded with a small local model (`Xenova/all-MiniLM-L6-v2` via Transformers.js, loaded lazily from a CDN once and cached by the browser after that — no server involved) and matched by cosine similarity against topic examples in `SEMANTIC_EXAMPLES`/`TOPIC_REPLIES`.

## Session continuity

Task-level progress and to-dos across sessions are kept in `.claude/PROGRESS.md` — check it when resuming work on this repo, and update it when wrapping up a substantive session.
