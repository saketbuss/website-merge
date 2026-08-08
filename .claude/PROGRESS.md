# Session Progress — 2026-07-10

## Done today

### 1. New Home / Landing page (`official-site.html`)
- Added a real landing page (`#landing-view`), separate from the Games grid. Nav now has a `HOME` tab (`tab-landing` / `goLanding()`) that's active by default; clicking the logo also goes here.
- Landing page includes:
  - Title banner ("SAKET'S SITE // GAME ARCADE") in the existing liquid-glass style.
  - "⚠ ARE YOU IN SCHOOL RIGHT NOW?" kicker/message (echoes the terms-modal joke, now visible on the page itself, not just the gate).
  - Center search bar (`#landing-search-input`) — live dropdown, searches across **every** embedded game/export via `SEARCH_INDEX` (built from `GAME_PATHS`/`GAME_TITLES`, so it auto-includes new games). Enter launches top match; click launches directly.
  - Floating animated "AI blob" (bottom-right) — opens the existing AI sidebar via `window.openAIChat(true)`.
  - Quick-link pills to Games / Experiments / Exports.
- Existing `GAMES` tab (`#home-view`) is unchanged/untouched — still shows the full grid.
- All game/port/export launch functions (`launchGame`, `launchExportGame`, `openPort`, `_switchView`) updated to also hide/show `#landing-view` and `#tab-landing` correctly.
- Removed emoji icons from all Games-grid and Exports-grid card thumbnails (`.gc-thumb`) — they're now plain glass squares (glow + sheen only), per request. Ports/Experiments grid (`.port-card-thumb`) emoji were **left as-is** (different component, wasn't asked to change).

### 2. Offline "AI" upgrade (AR.OS AI sidebar)
- The existing `AROS_BRAIN` engine (rule-based/regex, already handled live game stats, tactics, weapons, codes, math, coding/school topics, facts) is unchanged for all fast/deterministic paths.
- Added a **fully offline semantic fallback**: when no keyword rule matches, the message is embedded with a small local sentence-embedding model (`Xenova/all-MiniLM-L6-v2` via Transformers.js, ~25MB quantized, loaded lazily from jsDelivr CDN on first use, cached by the browser after that — **no backend/API endpoint**) and matched by cosine similarity against ~30 example phrasings (school topics, coding topics, "tell me a fact"). Threshold `SEMANTIC_MATCH_THRESHOLD = 0.5` — **not yet tuned against real usage**, may need adjustment.
- Refactored `codingReply`/`schoolReply` canned text into a shared `TOPIC_REPLIES` object (used by both the keyword path and the semantic path, no duplication).
- `process()` is now `async` (was sync) — required to await the embedding call; `callAPI`/`ask()` already awaited it correctly, no other callers affected.

### 3. Registered 3 new Exports games
- User dropped `minecraft.html`, `retro-bowl.html`, `solar-smash.html` into `games/exports/`.
- **Confirmed: nothing here is auto-discovered.** Wired up manually in three places: `GAME_PATHS`, `GAME_TITLES`, and new `.gc` cards in `#exports-grid`. Bumped the "3 → 6 TITLES" counters. Added CSS stagger-animation delays for cards 4–6.
- Display titles were inferred (files' own `<title>` tags were messy/generic) — confirm `MINECRAFT` / `RETRO BOWL` / `SOLAR SMASH` are the names wanted.

## Diagnosed but NOT yet fixed: site feels slow

Root causes identified (ranked by likely impact), see chat for full detail:
1. `renderBgGrid()` (~official-site.html:2526) — full-screen canvas fluid-ripple simulation, runs every frame **forever** on every page (not just boot), iterates ~1,300 grid cells + redraws ~75 stroked paths per frame.
2. `renderLiquidCursor()` (~line 2645) — custom canvas "liquid metaball" cursor replacing the OS cursor, spawns spark particles w/ `ctx.shadowBlur` (expensive) on ~35% of mousemoves, runs forever.
3. 11× `backdrop-filter: blur()` layers stacked/animating at once (nav, sidebar, cards, hero, + the new landing page's aurora blobs).
4. 18 concurrent `infinite` CSS animations (aurora glows, grid pans, AI-blob morph, bar pulses).
5. `games/exports/minecraft.html` is **15MB** — fine (loads on demand only), but that game will be slow to open.

This is a real "looks great on a gaming laptop, chugs on a school Chromebook" issue — matches the target audience implied by the "are you in school" bit.

## To-dos / next session

- [ ] **Performance fix** (agreed direction, not yet built): add a "Performance / Reduced Effects" toggle in Settings (alongside the existing `Animated Hero Grid` / `Card Hover Glow` toggles) that disables the fluid canvas background + custom liquid cursor entirely. Consider auto-detecting a weak device (e.g. `navigator.hardwareConcurrency`, `prefers-reduced-motion`, or a simple FPS probe) and defaulting it off there.
- [ ] Visually verify the new landing page, search dropdown, and AI blob in an actual browser (I opened the file via `Start-Process` but have no screenshot/browser-automation tool to confirm rendering myself — user should eyeball it).
- [ ] Test the offline semantic AI fallback with real oddly-phrased questions; tune `SEMANTIC_MATCH_THRESHOLD` (currently 0.5) up/down based on false-positive vs. false-negative feel.
- [ ] Confirm display names for the 3 new export games (`MINECRAFT`, `RETRO BOWL`, `SOLAR SMASH`) and their tags/accent colors are what's wanted.
- [ ] Note: `git status` shows `games/` and `official-site.html` are still **untracked** — nothing from today's work is committed yet.
- [ ] Repo also shows deleted-tracked root files `minecraft`, `retro-bowl`, `solar-smash` (no extension) — leftover from before these were moved into `games/exports/*.html`. Not touched; worth a `git add`/cleanup pass whenever committing.
