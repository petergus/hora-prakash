# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173/hora-prakash/)
npm run build     # Production build → dist/
npm test          # Node smoke test (tests/export-payload.test.mjs) — no browser/WASM needed
npm run preview   # Preview the production build locally
```

No linter is configured. `npm test` runs five Node suites (no browser/WASM):
- `tests/export-payload.test.mjs` — divisional transforms, dasha tree, sandhi, yogas, Export-tab payload
- `tests/jhora-golden.test.mjs` — golden fixtures against JHora reference output in `jhora/Indira_Gandhi.md` (D1/D9 placements, nakshatra/pada, Vimshottari balance)
- `tests/lunar-birthday.test.mjs` — Purnimanta lunar-date logic (tithi, sankranti month naming, Adhika detection, birthday finder) against a synthetic ephemeris
- `tests/timezone-dst.test.mjs` — birth-instant UTC offset resolution, incl. historical/abolished DST (Moscow 1985, São Paulo)
- `tests/places-timezone.test.mjs` — the bundled city DB (`public/places.json`) carries a valid IANA zone per city so DST is applied at the birth instant

`npm run test:ephemeris` runs `tests/lunar-birthday.ephemeris.test.mjs`, which loads the real Swiss Ephemeris WASM (Node-native) and checks the lunar-date/Adhika logic against documented festival dates. It's kept out of `npm test` because it loads the 12 MB ephemeris; run it after touching `src/core/lunar-birthday.js`.

Run after touching `src/core/divisional.js`, `src/core/dasha.js`, `src/core/yogas.js`, or `src/tabs/export.js`. The deploy workflow runs `npm test` before build.

**Build gotchas (CI / fresh containers):** Vite 8 uses rolldown + lightningcss with platform-native bindings that npm sometimes skips. If `vite build` fails with `MODULE_NOT_FOUND` in rolldown/lightningcss, run:
`npm install --no-save @rolldown/binding-linux-x64-gnu lightningcss-linux-x64-gnu` (both in ONE command — separate `--no-save` installs prune each other).

**Browser E2E is blocked by auth:** `main.js` gates the entire app behind Firebase email/password sign-in (`requireAuth()` in `src/auth-ui.js`) with no dev bypass. Without credentials you cannot drive the UI with Playwright — verify logic via `npm test` and `npm run build` instead.

## Architecture

**Hora Prakash** is a Vedic astrology web app built with Vite + Vanilla JS (no framework, no backend server; Firebase for auth + Firestore profile sync). Deployed to GitHub Pages and optionally Firebase Hosting (`npm run deploy:firebase`). Note: `vite.config.js` sets `base: '/'` (custom domain / root deploy), not `/hora-prakash/`. Routing is hash-based (`#/p/<sid>/<page>`) so it is base-path-agnostic regardless.

### Startup sequence (`src/main.js`)

1. `loadSettings()` + theme; `loadBranding()`
2. `await requireAuth()` — Firebase login gate (blocks everything)
3. `fetchProfiles()` — mirrors Firestore profiles into localStorage (`hora-prakash-profiles`) so existing sync read paths work
4. `initTabs()`, `initShell(user)` (sidebar/drawer + settings gear + account row), create + switch sessions, `renderSidebar()`, then `initRouter()` (the hash route drives the first render)
5. `initSwissEph()` preloads WASM in background; form submit awaits it

**SwissEph must be initialized before calculation calls.** `getSwe()` throws before init.

### State (`src/state.js`)

Single mutable object shared across tabs:
```js
{ birth, planets, lagna, houses, sripatiHouses, dasha, panchang, strength,
  transitDate, transitTime, transitPlanets, transitFilter, transitView, transitAspectSource }
```
- `strength = { bhinna, sarva, shadbala }` (computed in input.js on submit/recalc)
- Transit tab actually keeps its state in per-session `uiState.transit`, not in these top-level transit fields (legacy)

Planet object shape: `{ id, name, abbr, lon, sign, degree, house, nakshatra, nakshatraLord, nakshatraIndex, pada, retrograde, combust, speed }`

### Sessions (`src/sessions.js`) — multi-profile tabs

Each session = chart-state snapshot + per-tab UI state (`defaultDashaUI/ChartUI/TransitUI`). Snapshots are in-memory, but labels + birth inputs persist to sessionStorage (`persistSessions`/`loadPersistedSessions`); `main.js#restoreSessionData` recalculates each restored session after reload once SwissEph is ready.

⚠️ **When adding a field to `state.js`, you MUST add it to both `emptySnap()` and `saveActiveSnapshot()` in sessions.js.** Missing fields leak data between profile tabs (this happened with `strength` — one profile's Shadbala showed under another profile).

### App shell, navigation & routing (SaaS layout)

The UI is a **left sidebar + person workspace** shell (`index.html` → `#app-shell` > `aside#app-sidebar` + `#workspace`). On <900px the sidebar becomes an off-canvas **drawer** (`#mobile-topbar` hamburger + `#drawer-scrim`). CSS: `src/styles/tokens.css` (design tokens: spacing/type/radius/z-index/shadow/semantic colors + the 6 `[data-theme]` accents), `src/styles/components.css` (`.btn`/`.seg-btn`/`.modal-*`/`.auth-*`), `src/styles/shell.css` (grid + drawer); all `@import`ed at the top of `src/style.css` (inlined at build by lightningcss). Light-only — no dark mode.

**Pages are a single registry, not a triplicated dispatch.** `src/ui/nav-registry.js` `PAGE_MAP` is the one source of truth: each page id (keeps legacy names `input`/`chart`/… so `#tab-<id>` panels and `data-tab` attrs are unchanged) declares `{ scope: 'person'|'global', requiresData, render }`. `PERSON_PAGES` is the swipe/nav order; `ROUTE_ALIAS`/`SEGMENT_FOR` map `edit ↔ input`.

**Hash router** (`src/ui/router.js`) owns navigation:
- Routes: `#/p/<sid>/<page>` (person workspace), `#/people`, `#/compare`. `navigate(routeFor(page, sid))` / `refresh()` / `markRoute(page)` (record a route without re-dispatching, for the edit-form flow).
- `handleRoute()` parses the hash → switches session → data-guards (`requiresData && !state.planets` → the person's `edit` page, unless the session is mid-`restoring` after reload, which shows a placeholder) → `_setCurrent()` → `syncPageNav()` + `switchTab()` (DOM class toggles only) → `app-shell.setActive()` → `renderPage()`. Back/forward and cross-person history all funnel through `hashchange`.
- **Current page/session live in `src/ui/nav-state.js`** (`getCurrentPage()`), a DOM-free module. `sessions.js` reads it (not the DOM) when snapshotting `innerTab`; keep nav-state Node-safe (sessions.js → nav-state is in the test import graph via export.js).
- Session ids persist across reload (`persistSessions` stores `id`; `createSession(label, id)` reuses it) so deep links survive.

**Adding a page** = one `PAGE_MAP` entry + a `<button data-tab>` in `#tab-nav` (person pages) or a `.side-item[data-nav]` in the sidebar (global pages) + a `<section id="tab-<id>">` panel. No `TAB_ORDER`, no `enableTab` fan-out, no `activateInnerTab` — those were removed. The sidebar people list is `renderSidebar()` in `src/ui/app-shell.js` (replaced the old `profile-tabs.js`). The workspace person header (avatar/name/pills + privacy toggle + Edit) is `src/ui/person-header.js`, rendered by the router; `isPrivacyOn()` there is the single privacy-mask source (chart.js reads it).

### Data flow on form submit (`src/tabs/input.js` → `onFormSubmit`)

1. `toJulianDay(dob, tob, tz)` → UTC Julian Day
2. `calcBirthChart(jd, lat, lon, settings)` → `{ planets, lagna, houses, sripatiHouses }`
3. `calcDasha(moon, dob, { settings, swe, jd })` → async; **eagerly builds only 2 levels (maha → antar); deeper levels lazy via `ensureChildren(node, swe, flags)`**
4. `calcPanchang(jd, lat, lon, { dateStr, timezone })`
5. Ashtakavarga + Shadbala → `state.strength`
6. Cloud save (`saveHoroscope`), tabs rendered, `syncPageNav()` + `navigate(routeFor('chart'))`

`recalcAll()` (same file) repeats this on settings change — keep both code paths in sync.

### Divisional Charts (`src/core/divisional.js`)

`calcDivisional(planets, lagna, key, options)` — keys: D1–D12, D16, D20, D24, D27, D30, D40, D45, D60, Chalit (see `DIVISIONAL_OPTIONS`).
- Explicit rules: D2 (Hora), D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, **D60 (own-sign seeded — must NOT use parivritti since 60 ≡ 0 mod 12, which degenerates to counting from Aries)**
- D5/D6/D8/D11 fall through to Parivritti Cyclic (see Pending below)
- Degrees are stretched to the full 0–30° range: `deg(lon,n) = ((lon % 30) * n) % 30`
- Chalit: `options = { chalitMethod: 'equal'|'placidus'|'sripati', houses, sripatiHouses }`; replaces `planet.sign` with the sign of its bhava. Divisional house is always computed by callers as `((p.sign - dLagna.sign + 12) % 12) + 1`.

### Export tab (`src/tabs/export.js`) — configurable JSON export

- Presets stored in localStorage (`hora-prakash-export-presets`); built-ins Full/Lite.
- ⚠️ **When adding config keys, extend `normalizeConfig()`** — it backfills presets saved by older versions. A missing `decimals` key once made `roundNum` produce NaN → every number serialized as `null`.
- `buildPayload(cfg)` is **async**: dasha depth 3 requires expanding the lazy pratyantar level first (`expandDashaForExport` → `ensureChildren`); otherwise antars serialize with empty `children`.
- `deepRound()` handles Date → ISO string conversion and decimal rounding recursively.
- `filterStrength('totals')`: `sarva` is a plain number array and `shadbala` is an object keyed by planet — don't treat either as an array of row objects.
- Exported functions `buildPayload`, `normalizeConfig`, `defaultConfig` are consumed by `tests/export-payload.test.mjs`.

Chart tab also has a per-table "Copy positions as JSON" button (`buildPlanetJSON` in `src/tabs/chart.js`), which includes birth info + division metadata.

### Chart image export (`src/ui/chart-export.js`)

`showExportModal()` → PNG (canvas), SVG, PDF (jspdf, dynamic import). Up to 6 divisional charts + natal/transit tables.
- ⚠️ `renderChartSVG` output has only a `viewBox` — rasterizing needs `withExplicitSize()` to inject width/height or Firefox draws blank canvases.
- SVG export prefixes element ids per chart to avoid collisions when embedding multiple charts.

### Yogas (`src/core/yogas.js`)

`detectYogas(planets, lagna)` → `[{ key, name, category: 'benefic'|'challenging'|'neutral', description }]`. Whole-sign rules (conjunction = same sign; aspects via `getAspectedSigns`). Rendered as a Strength sub-tab and exported as the `yogas` section of the Export payload. Covered by unit tests — extend both when adding yogas.

### Compare tab (`src/tabs/compare.js`)

Synastry between open profile tabs: side-by-side D1 charts, whole-sign house overlays both directions, inter-chart sign aspects. Reads other sessions' data from `session.snap` (active session reads `state`).

### Strength (`src/core/shadbala.js`, `src/core/ashtakavarga.js`)

- `calcShadbala(...)` → **object keyed by planet name** (Sun–Saturn): `{ sthanaBala, digBala, kalaBala, chestaBala, naisargikaBala, drikBala, total, required, ratio }` in shashtiamsas (virupas)
- `calcBhinnashtakavarga(planets, lagna)` → `{ [planet|Lagna]: number[12] }` (per-sign scores, Aries=index 0)
- `calcSarvashtakavarga(bhinna)` → `number[12]` (sums, excludes Lagna row)

### Transit (`src/tabs/transit.js`, `src/core/transit.js`, `src/components/Transit*.js`)

Dual (natal + transit side by side) or overlay view; per-session UI state in `uiState.transit`; forecast events in `src/core/transitForecast.js`. Transit export goes through the same `showExportModal` with `context: 'transit'` and an `extraSvgFn`.
- `TransitToolbar` has a date scrubber (±day/week/month/year + play animation); the play timer lives on the toolbar instance — `destroy()` must clear it.
- `TransitTable` shows a SAV column (natal Sarvashtakavarga points of the transit planet's sign, D1 only, from `state.strength.sarva`).

### Dasha extras (`src/core/dasha.js`)

- `getDashaSandhi(dasha)` — flags running maha/antar within 5% of a junction; rendered as a banner in `dasha-panel.js`.
- `buildDashaExportRows(dasha)` in chart-export.js feeds the optional Vimshottari table in PNG/SVG/PDF exports (modal checkbox).

### Utilities

- `src/utils/clipboard.js` — `copyText(text)`: navigator.clipboard with textarea/execCommand fallback (clipboard API only exists in secure contexts). Use this for all copy buttons.
- `src/utils/jhd.js` — Jagannatha Hora `.jhd` import; `src/utils/paste-parse.js` — free-text birth-details paste parsing
- `src/utils/time.js` — `toJulianDay`, `localToUTC`, `jdToDate`; `src/utils/format.js` — DMS/decimal/timezone formatting

### Key implementation details

**swisseph-wasm v0.0.5 quirks:**
- `calc_ut(jd, bodyId, flags)` returns `Float64Array`: `[lon, lat, dist, lonSpeed, ...]`
- Flags: SIDEREAL=65536, SPEED=256, TRUEPOS=512, TOPOCTR=32768 (`buildCalcFlags` in settings.js)
- Ketu = Rahu longitude + 180° (same body ID 10)
- The wrapper's `rise_trans` is broken; `calcPanchang` bypasses it with a direct `ccall('swe_rise_trans', ...)` using malloc'd geopos (disc-center + no-refraction = Hindu sunrise, matches JHora)
- `vite.config.js` must exclude `swisseph-wasm` from `optimizeDeps`; dev server needs COOP/COEP headers
- The module is lazily imported inside `initSwissEph()` — core modules are safe to import in Node (that's how `npm test` works)

**Settings (`src/core/settings.js`):** localStorage `hora-prakash-settings`; ayanamsa (Lahiri default), yearMethod (sidereal default; 'true-solar' triggers async solar-return dasha), customYearDays, planetPositions, observerType, theme. Changing settings calls `recalcAll()`. The settings modal (`src/ui/settings-modal.js`, opened from the sidebar footer via `openSettingsModal()`) exposes all of these including Year Method + Custom Year Days.

**Modals (`src/ui/modal.js`):** one primitive — `openModal({title, content, actions, width})`, plus `confirmModal()` / `promptModal()` (Esc + scrim close, focus mgmt, `.modal-*` classes). Used by settings, export preset save/rename/delete, and profile-deletion confirms (replaced `window.prompt/confirm`). ⚠️ `modal.js` touches `document` only inside functions — safe to import into modules in the Node test graph (e.g. `export.js`). The auth screen (`src/auth-ui.js`) is a light `.auth-*` overlay matching the app theme.

**Charts (`src/ui/chart-svg.js`):**
- `renderChartSVG(planets, lagna, style, signLabels, centerLabel, activeAspects, activePlanetColors, isTransit)`
- North Indian: 12 polygons, houses counter-clockwise from top; South Indian: fixed 4×4 sign grid
- 480×480 viewBox, **no width/height attribute** (see chart-export note above)
- Interactive: `[data-planet]` click toggles aspect lines; `[data-sign]` right-click/long-press → context menu (view from house / aspects to house)

**Combustion:** Parashari orbs — Moon 12°, Mars 17°, Mercury 14°, Jupiter 11°, Venus 10°, Saturn 15°; Sun/Rahu/Ketu immune.

**Saved profiles:** `src/tabs/profile-store.js` — localStorage `hora-prakash-profiles`, mirrored to Firestore via `src/cloud-store.js` (upsert/delete/bulk), plus JSON/JHD import-export. `input.js` owns only the form/rendering and passes `renderSavedProfiles` as the import-done callback.

**External APIs (no keys):** Nominatim geocoding; timeapi.io timezone lookup (only the ⟳ "auto-detect" button and the Nominatim fallback path — bundled cities already carry their zone).

**City database (`public/places.json`, `src/utils/geocoding.js`):** ~13k cities, schema `{ n, a: lat, o: lon, t: IANA_zone }` (rare `z: "+HH:MM"` fallback where no zone resolves). ⚠️ **`t` is an IANA name, not an offset** — resolved offline from coordinates at build time by `geo-tz` (a *build-only* dependency; **never import it into `src/`** — it bundles huge boundary data). Regenerate with `npm run enrich-places` (enriches the existing JSON in place) or `npm run parse-places` (from `places.txt`). This is what lets a bundled-city selection get a DST-correct, birth-instant offset like an online lookup does — earlier the file stored one fixed offset per city (baked to summer for DST zones), so winter births in DST regions were an hour off and the ⟳ button "changed" the number by re-resolving via IANA. `geocoding.js#searchPlaces` reads `entry.t || entry.z`.

**Timezone / DST (`src/utils/time.js`, `src/utils/format.js`, `src/tabs/input.js`):** A birth record's `timezone` is either an **IANA name** (`America/New_York`) or a **fixed numeric offset** (`-05:00`). The two are treated differently on purpose:
- IANA → the offset is derived **at the birth instant** via `getTZOffsetMinutes`/`localToUTC`, which honours DST including *historical* DST that has since been abolished (Moscow +04 in 1985, São Paulo pre-2019, wartime double summer time, etc.). Always prefer storing IANA names so DST is applied.
- Numeric offset → used verbatim. This is correct for manual entry, paste, and `.jhd` imports (JHora already bakes the birth-day DST into the offset it stores). Never re-derive DST on top of a numeric offset.
- ⚠️ `offsetParts(iana)` / `ianaToOffset(iana)` / `parseTzInfo(iana)` take an optional **`refDate`** — pass the birth instant, or the displayed offset defaults to *today's* (wrong across a DST boundary). `offsetPartsAtBirth(tz, dob, tob)` in `input.js` returns exactly what `toJulianDay` will use, and the form's UTC-offset field auto-updates as you edit the date (`refreshTzForDate`). Bundled-city selections now supply an IANA name (see City database above) so this all applies to them too. Regression coverage: `tests/timezone-dst.test.mjs`, `tests/places-timezone.test.mjs`.

**Deployment:** GitHub Actions deploys to GitHub Pages on push to `main`. Current version: see `package.json` (1.5.x). Export payload `APP_VERSION` in `src/tabs/export.js` is tracked separately.

## Pending / Known Issues

### Divisional Charts — Rules to Verify
D5/D6/D8/D11 use generic **Parivritti Cyclic**. Traditional rules vary by source. Verify against JHora before changing (comparison notes in `JHORA_COMPARISON_*.md`).

| Chart | Current | Traditional (to verify) |
|-------|---------|------------------------|
| D5 – Panchamsha | Parivritti | Movable→Aries, Fixed→Sag, Dual→Leo (JHora) |
| D6 – Shashthamsha | Parivritti | Likely correct — sequential from own sign |
| D8 – Ashtamsha | Parivritti | Movable→Aries, Fixed→Sag, Dual→Leo (disputed) |
| D11 – Rudramsha | Parivritti | Likely correct — sequential Parivritti accepted |

### Misc
- `state.js` top-level transit fields are legacy; transit tab uses per-session `uiState.transit`.
- `src/tabs/input.js` is still ~1100 lines and both statically and dynamically imported (build warning `INEFFECTIVE_DYNAMIC_IMPORT`); profile storage already extracted to `profile-store.js` — geocoding/paste-modal/form concerns could follow.
