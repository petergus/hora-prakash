# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173/hora-prakash/)
npm run build     # Production build → dist/
npm test          # Node smoke test (tests/export-payload.test.mjs) — no browser/WASM needed
npm run preview   # Preview the production build locally
```

`npm run test:functions` runs `tests/admin-handlers.test.mjs` (the `/buro` Cloud Functions handlers, against in-memory fakes). Kept out of `npm test` because it needs `functions/`' own dependencies — a normal `npm install` at the repo root does **not** install them (`functions/` is a separate CommonJS package, not an npm workspace). One-time setup: `cd functions && npm install`. After that, `npm run test:functions` works from the repo root (Node resolves `require('firebase-admin')` from the requiring file's own directory, not `cwd`).

No linter is configured. `npm test` runs eighteen Node suites (no browser/WASM — core modules take an injectable `swe`, so tests pass a synthetic ephemeris; follow that pattern in new core modules):
- `tests/export-payload.test.mjs` — divisional transforms, dasha tree, sandhi, yogas, Export-tab payload
- `tests/jhora-golden.test.mjs` — golden fixtures against JHora reference output in `jhora/Indira_Gandhi.md` (D1/D9 placements, nakshatra/pada, Vimshottari balance)
- `tests/lunar-birthday.test.mjs` — Purnimanta lunar-date logic (tithi, sankranti month naming, Adhika detection, birthday finder) against a synthetic ephemeris
- `tests/timezone-dst.test.mjs` — birth-instant UTC offset resolution, incl. historical/abolished DST (Moscow 1985, São Paulo)
- `tests/places-timezone.test.mjs` — the bundled city DB (`public/places.json`) carries a valid IANA zone per city; exact coordinate→zone boundary lookup (`tz-resolve.js`, incl. countries the DB doesn't cover, e.g. Yerevan 1982 USSR DST) and stale location-cache reconciliation
- `tests/moon-info.test.mjs` — Moon phase / elongation / tithi maths
- `tests/sadesati.test.mjs` — Saturn phase classification + the sign scanner (incl. a synthetic retrograde bounce)
- `tests/activation.test.mjs` — dasha-lord lookup at a date + forecast-event activation flagging
- `tests/avastha.test.mjs` — Baladi bands/even-sign reversal, panchadha friendship, Deeptadi precedence
- `tests/upagraha.test.mjs` — special-lagna formulas + Gulika/Mandi portion timing vs JHora
- `tests/gunamilan.test.mjs` — Ashta Koota scoring (incl. the classic 28/36 identical-Moon result) + Mangal dosha
- `tests/ics.test.mjs` — the iCalendar writer: RFC 5545 escaping, octet-based folding, all-day DTEND exclusivity
- `tests/muhurta.test.mjs` — tarabala/chandrabala counting, tithi classes, the veto rules, sweep window merging
- `tests/calendar-events.test.mjs` — event collectors, timezone day-bucketing, and the iCal UID-collision regression
- `tests/interpret.test.mjs` — corpus exhaustiveness (all 108 placements, 144 house-lord pairs, every yoga key the **real** detector emits), the A6 strength layer, the depth dial, and a 144-combination render sweep
- `tests/ai.test.mjs` — AI config gating (BYOK key stored apart from the synced settings), the chart-context grounding builder, tool definitions, prompt builders (no SDK/network/Firebase — those are browser-only)
- `tests/reading-tools.test.mjs` — the chat tool executor's dispatch + data-shaping for the ephemeris-free tools, and graceful degradation when the WASM ephemeris isn't up
- `tests/authz.test.mjs` — claims→access parsing (role/plan/status defaults, never-invent-privileges) + the per-account local-cache hygiene in `user-scope.js` (sign-out vs account-switch wipes)

`npm run test:ephemeris` runs the four suites that load the real Swiss Ephemeris WASM (Node-native) and check against documented real-world values. Kept out of `npm test` because of the 12 MB ephemeris load:
- `tests/lunar-birthday.ephemeris.test.mjs` — lunar-date/Adhika logic vs documented festival dates. Run after touching `src/core/lunar-birthday.js`.
- `tests/upagraha.ephemeris.test.mjs` — the full Gulika/Mandi/special-lagna pipeline vs JHora's Indira Gandhi values (all 7 points land within ~1.7 arcmin; the residual is our sunrise sitting ~2 s from JHora's, which Ghati Lagna's 1.25°/min rate amplifies). Run after touching `src/core/upagraha.js` or the sunrise code in `panchang.js`.
- `tests/sadesati.ephemeris.test.mjs` — Saturn's Lahiri ingress dates 2020–2025, the 7.5-year window shape, and the scan-step resolution guarantee. Run after touching `src/core/sadesati.js`.
- `tests/calendar.ephemeris.test.mjs` — the Calendar pipeline end to end (real chart → forecast + dasha + Sade Sati + birthdays → merged events → valid .ics), and the **only** coverage of `findNextEvents` itself. Run after touching `transitForecast.js`, `calendar-events.js` or `ics.js`.

Run after touching `src/core/divisional.js`, `src/core/dasha.js`, `src/core/yogas.js`, or `src/tabs/export.js`. The deploy workflow runs `npm test` before build.

**Build gotchas (CI / fresh containers):** Vite 8 uses rolldown + lightningcss with platform-native bindings that npm sometimes skips. If `vite build` fails with `MODULE_NOT_FOUND` in rolldown/lightningcss, run:
`npm install --no-save @rolldown/binding-linux-x64-gnu lightningcss-linux-x64-gnu` (both in ONE command — separate `--no-save` installs prune each other).

**Browser E2E is blocked by auth:** `main.js` gates the entire app behind Firebase email/password sign-in (`requireAuth()` in `src/auth-ui.js`) with no dev bypass. Without credentials you cannot drive the UI with Playwright — verify logic via `npm test` and `npm run build` instead.

## Architecture

**Hora Prakash** is a Vedic astrology web app built with Vite + Vanilla JS (no framework, no backend server; Firebase for auth + Firestore profile sync). Deployed to Firebase Hosting (`npm run deploy:firebase`). Note: `vite.config.js` sets `base: '/'` (custom domain / root deploy), not `/hora-prakash/`. Routing is hash-based (`#/p/<sid>/<page>`) so it is base-path-agnostic regardless.

### Startup sequence (`src/main.js`)

1. `loadSettings()` + theme; `loadBranding()`
2. `await requireAuth()` — login/sign-up gate (blocks everything; rejects `status:'disabled'` claims), then `reconcileUserScope(uid)` wipes another account's local caches (re-loads settings/theme when it does), `initAuthz(user)` starts claims tracking, verify-email banner for unverified accounts
3. `fetchProfiles()` — mirrors Firestore profiles into localStorage (`hora-prakash-profiles`) so existing sync read paths work
4. `initTabs()`, `initShell(user)` (sidebar/drawer + settings gear + account row), create + switch sessions, `renderSidebar()`, then `initRouter()` (the hash route drives the first render)
5. `initSwissEph()` preloads WASM in background; form submit awaits it

**SwissEph must be initialized before calculation calls.** `getSwe()` throws before init.

### Accounts, roles & access (`src/core/authz.js`, `src/user-scope.js`, `src/auth-ui.js`, `functions/`)

Multi-user foundation (full roadmap: `docs/USER_INTEGRATION_PLAN.md`; Phases 1–3 implemented):

- **`users/{uid}` is the authority doc** — `role` (`user`|`superadmin`), `plan` (`free`|…), `status` (`active`|`disabled`), `planSource`, `email`, `createdAt`, `claimsSyncedAt`. Written **only by Cloud Functions**: `functions/index.js#onUserCreated` provisions it on sign-up (`.create()`, so pre-provisioned docs win) and `functions/claims.js#syncClaims` mirrors it into **custom claims**. `syncClaims({db, auth}, uid)` takes injected Admin SDK instances (not the global `admin` app) so it — and everything that calls it — runs against a fake in `tests/admin-handlers.test.mjs`. ⚠️ Never add a client-side write of `role`/`plan`/`status` — rules block them, and the design depends on it.
- **`authz.js`**: pure `accessFrom(claims)` (Node-tested; unknown roles/statuses fold to `user`/`active`, never upward) + `initAuthz(user)`, which watches `users/{uid}.claimsSyncedAt` and force-refreshes the ID token when a function bumps it — access changes reach live sessions in seconds instead of the ~1 h token lifetime. `onAccessChanged` → main.js signs out on a mid-session disable; `app-shell.js` separately subscribes to show/hide the Admin nav item and bounce a demoted user off `/buro`. Firebase is lazily imported (same pattern as ai.js) so the module stays in the Node test graph.
- **Auth overlay** (`auth-ui.js`): sign-in AND sign-up (min-8 password, optional display name, verification email) + `showVerifyBanner` (soft gate — app usable, AI/paid features will require verification server-side). `requireAuth()` signs out `status:'disabled'` claims; the native Auth `disabled` flag only blocks *new* sign-ins.
- **Cache hygiene** (`user-scope.js`): localStorage is per-browser, accounts aren't. A different-uid sign-in wipes ALL user-scoped keys (`hora-prakash-last-uid` marker); sign-out wipes personal data + the BYOK key but keeps preferences. ⚠️ **When adding a user-scoped localStorage key, add it to `PERSONAL_KEYS` or `PREFERENCE_KEYS`** or it leaks to the next account on a shared browser.
- **Rules v2** (`firestore.rules`): owner-only CRUD on own subtree; superadmin (`request.auth.token.role`) reads everything but has **no rules-write** — admin mutations go through audited callables (below); `usage`/`billing`/`auditLogs`/`config` are function-write-only. Missing claims fold to `user/free/active` so pre-claims tokens keep working.
- **`/buro` admin backend** (`src/tabs/buro.js`, `src/admin-api.js`, `functions/handlers/admin.js`): a `PAGE_MAP` entry with `adminOnly: true` — `router.js#handleRoute` redirects non-admins to `people` before rendering, and `app-shell.js` hides the sidebar item for non-admins, but **neither is the security boundary**: every callable (`adminDashboardStats`/`adminListUsers`/`adminGetUser`/`adminCreateUser`/`adminSetAccess`/`adminSendReset`/`adminDeleteUser`) re-verifies `role == 'superadmin'` against the Firestore doc itself (`assertSuperAdmin`, not the token claim, which can lag a demotion). Every mutation writes an `auditLogs` entry (`functions/lib/audit.js`); the `/buro` UI reads that collection directly via Firestore (rules already grant superadmin read) rather than through a callable. Admin-created accounts get no password — `adminCreateUser` returns a `generatePasswordResetLink` for the admin to send manually (no transactional email wired up yet, see Phase 6). `setAccess` refuses to let a superadmin demote or disable **themselves** (a real lockout risk — recovery would need re-running the backfill script). Client-side plan IDs (`PLAN_IDS` in both `buro.js` and `handlers/admin.js`) are a provisional hardcoded list pending Phase 4's real entitlements config. Composite Firestore indexes for the users list (`plan`/`status`/`role` × `createdAt`) are declared in `firestore.indexes.json` — **must be deployed** (`firebase deploy --only firestore:indexes`) before the users table/search works; the client and server both restrict filtering to one dimension at a time to avoid needing 3-way composites.
- **Ops**: `firebase deploy --only functions,firestore:rules,firestore:indexes`, then once: `cd functions && node scripts/backfill-users.js --super <email>` (service-account creds; idempotent) to provision docs for pre-existing users and grant superadmin. Superadmin bootstrap lives only in that script.

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
- **Current page/session live in `src/ui/nav-state.js`** (`getCurrentPage()`), a DOM-free module. Keep nav-state and nav-registry Node-safe — `sessions.js` → `nav-registry` is in the test import graph via export.js.
- ⚠️ **The router owns each session's `innerTab`** (its sidebar re-entry page): `handleRoute`/`markRoute` call `setSessionInnerTab(sid, page)`, which **ignores global pages**. Don't derive `innerTab` from `getCurrentPage()` at snapshot time — `saveActiveSnapshot()` runs on switch, so it lags a page behind and, worse, would store `people`/`compare` on a person; `routeFor()` then sends a sidebar click to `#/people` and the sidebar highlights the person *and* the global item at once.
- Session ids persist across reload (`persistSessions` stores `id`; `createSession(label, id)` reuses it) so deep links survive.

**Adding a page** = one `PAGE_MAP` entry + `PERSON_PAGES` order + a `<button data-tab>` in `#tab-nav` (person pages) or a `.side-item[data-nav]` in the sidebar (global pages) + a `<section id="tab-<id>">` panel + (if it holds UI state) a `default<Name>UI()` in sessions.js wired into `createSession`. The `calendar` page is the worked example. No `TAB_ORDER`, no `enableTab` fan-out, no `activateInnerTab` — those were removed. The sidebar people list is `renderSidebar()` in `src/ui/app-shell.js` (replaced the old `profile-tabs.js`). The workspace person header (avatar/name/pills + privacy toggle + Edit) is `src/ui/person-header.js`, rendered by the router; `isPrivacyOn()` there is the single privacy-mask source (chart.js reads it).

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

Synastry between two **saved profiles** (selectors, not open sessions): side-by-side D1 charts, a Guna Milan card, whole-sign house overlays both directions, inter-chart sign aspects. Charts are computed on demand from the profile record and memoised in a module-level `compareCache` keyed by profile+ayanamsa+observer.

### Guna Milan (`src/core/gunamilan.js`)

`calcGunaMilan(girl, boy)` (each `{ moonLon }`) → `{ total, max: 36, kootas: [{ key, name, max, points, girl, boy, note }], verdict }`. `calcMangalDosha(planets, lagnaSign)` → `{ present, afflictions, cancellations, effective }`; `mangalDoshaMatch(a, b)` handles the both-Manglik mutual cancellation.
- ⚠️ **Several kootas are directional** — Varna, Vashya, Tara and Gana score differently by role, so argument order (girl, boy) matters. The Compare card exposes a ⇄ swap button rather than guessing gender.
- Lookup tables (yoni 14×14, gana 3×3, vashya 5×5 incl. the Sagittarius/Capricorn half-sign splits) are transcribed from the Saravali/Muhurta tradition; sources are cited in the module header. Sanity anchor: two identical Moons score **28/36** (everything full except Nadi).

### Sade Sati (`src/core/sadesati.js`)

`calcSadeSati(moonSign, { fromJd, toJd, swe, now })` → `{ segments, windows, current }`. Scans Saturn's sign occupancy, classifies each stay relative to the natal Moon (Sade Sati 12th/1st/2nd, Kantaka 4th, Ashtama 8th), and groups runs into windows. Rendered as a Dasha-tab card (`_sadesatiHtml`), cached per chart+ayanamsa in `dasha-panel.js`.
- ⚠️ **The fixed scan step only resolves stays longer than `stepDays`.** Real Saturn dips back across a boundary for as little as ~9.5 days (Libra, Feb 2041), so the 5-day default keeps ~2× margin — don't raise it casually. A 90-year scan costs ~150 ms, hence the cache.
- Retrograde bounces intentionally stay **inside one window** and surface as repeated phases (`rising,peak,rising,peak,setting`).

### Dasha activations (`src/core/activation.js`)

`annotateActivations(events, dasha, transitPlanetName)` tags `findNextEvents` output with `activation = { planet, levels: ['MD'|'AD'|'PD'], kind }` when an event touches a running dasha lord — either the transit hits a lord's natal position (`transit-to-lord`) or the transiting planet *is* a lord (`lord-transit`). Rendered as ⚡ badges in `TransitTable`/`TransitTooltip`. `dashaLordsAt` reads only already-computed tree levels, so PD is `null` until `ensureChildren` has run — that's deliberate, not a bug.

### Upagrahas & special lagnas (`src/core/upagraha.js`)

`calcUpagrahas(birth, lagna, planets, swe?)` → `{ points: [Gulika, Mandi, Bhava/Hora/Ghati/Sree/Indu Lagna], meta }`, rendered in the chart's Further-Information panel and included in the per-table copy-JSON.
- The **Vedic day runs sunrise→sunrise**: a pre-dawn birth belongs to the previous day's span *and weekday* (the module shifts both). Gulika/Mandi = the ascendant at the start/middle of Saturn's eighth-portion of the day (from the weekday lord) or night (from the 5th lord after it).
- Sunrise comes from `calcRiseSet` (exported from `panchang.js` — the Hindu disc-center/no-refraction `swe_rise_trans` call). Ghati Lagna moves 1.25°/min, so it amplifies any sunrise error ~30× — that's the whole tolerance story in the ephemeris test.

### Avasthas (`src/core/avastha.js`)

`calcAvasthas(planets)` → per planet `{ baladi, jagradadi, deeptadi, dispositor, relation }` (nodes → `null`). Baladi runs on the degree and **reverses in even signs**; Deeptadi precedence is dignity → combustion → residence, where residence uses the compound (natural + temporal) relation with the sign lord. Also exports the shared `SIGN_LORDS`, `EXALT_SIGN`/`DEBIL_SIGN` and the friendship helpers (`compoundRelation` etc.) that `upagraha.js` reuses. Surfaced as a positions-table column + a Further-Info subsection.

### Strength (`src/core/shadbala.js`, `src/core/ashtakavarga.js`)

- `calcShadbala(...)` → **object keyed by planet name** (Sun–Saturn): `{ sthanaBala, digBala, kalaBala, chestaBala, naisargikaBala, drikBala, total, required, ratio }` in shashtiamsas (virupas)
- `calcBhinnashtakavarga(planets, lagna)` → `{ [planet|Lagna]: number[12] }` (per-sign scores, Aries=index 0)
- `calcSarvashtakavarga(bhinna)` → `number[12]` (sums, excludes Lagna row)

### Transit (`src/tabs/transit.js`, `src/core/transit.js`, `src/components/Transit*.js`)

Dual (natal + transit side by side) or overlay view; per-session UI state in `uiState.transit`; forecast events in `src/core/transitForecast.js`. Transit export goes through the same `showExportModal` with `context: 'transit'` and an `extraSvgFn`.
- `TransitToolbar` has a date scrubber (±day/week/month/year + play animation); the play timer lives on the toolbar instance — `destroy()` must clear it.
- `TransitTable` shows a SAV column (natal Sarvashtakavarga points of the transit planet's sign, D1 only, from `state.strength.sarva`).

### Interpretation layer (`src/core/interpret.js`, `src/content/interpretation/`)

`buildReading(chart, { depth, now })` → `{ depth, corpusVersion, sections: [{ key, title, subtitle, paragraphs: [{ text, factors }] }] }`. Rendered by the **Reading** page (`src/tabs/reading.js`). Deterministic: it selects and composes corpus text, it does not generate.

- ⚠️ **The corpus is Claude-authored and NOT expert-reviewed.** Every file in `src/content/interpretation/` carries that banner, and the Reading page shows it to the user. Keep both if you extend the corpus.
- **Every paragraph carries `factors`** — the evidence it rests on. The Reading page renders them as chips; clicking one sets `uiState.chart.activePlanets` and routes to the chart, so any sentence can be audited against the geometry. Don't emit a paragraph without factors.
- **Exhaustiveness is enforced, not hoped for.** A missing corpus key would render an empty paragraph, so `tests/interpret.test.mjs` asserts all 108 planet-in-house entries, 12 houses/signs, 27 nakshatras, 9 dasha lords, and drives the **real `detectYogas`** over 144 synthetic charts to prove every key it can emit has a meaning. Add a yoga to `yogas.js` without content and the test fails.
- ⚠️ **Yoga meanings key by FAMILY, not by key** — `yogas.js` templates keys (`raj-${pair}`, `mahapurusha-${planet}`, `dhana-${pair}`…), so an exact-key map silently misses most of them. Use `yogaFamily()`/`yogaMeaning()`.
- **A6 (strength weighting) lives in `qualifiers.js`, not in the 108 entries.** Baking strong/weak/neutral variants into each placement would have tripled the corpus and hidden the reasoning; instead a placement always reads the same and a qualifier states the Shadbala ratio, avastha and SAV bindus plainly. No strength data → **no qualifier at all**, never an invented one.
- **`house-lords.js` is composed, not hand-written** (144 combos), because the tradition itself states the rule compositionally ("A's matters arrive through B"). The classically-named cases (lord in own house; 6th/8th/12th from itself) are hand-written overrides.
- ⚠️ **`buildReading` de-duplicates via an internal `ctx`**: a planet's placement paragraph and its strength qualifier are each emitted **once per reading**, with later sections emitting a short pointer instead. Without this, Saturn's paragraph repeated verbatim in two sections and the Moon was called weak three times. If you add a section, thread `ctx` through it.
- `state` holds no `yogas`/`avasthas` — reading.js derives both on demand (as strength.js and export.js do).

### AI layer (`src/core/ai.js`, `functions/`, Reading page AI + Ask sub-tabs)

The Reading page has three sub-tabs: **Overview** (deterministic, always offline), **AI Reading** (A2, streamed), **Ask** (A3, chat with tools). Per-session UI in `uiState.reading` (`subTab`, in-session `aiText` cache, `chat`/`chatApi` history).

- **Two transports, one abstraction** (`src/core/ai.js`): `byok` (user's own Anthropic key, direct browser → Anthropic with `dangerouslyAllowBrowser`) and `proxy` (Firebase Cloud Function holds the key; browser sends its Firebase ID token). `makeClient()` builds the right SDK client; the proxy path overrides `fetch` to attach a **fresh** ID token per request (tokens expire ~1h — never bake one into a header at construction).
- ⚠️ **The `@anthropic-ai/sdk` is lazily imported** inside `loadSDK()` so it stays in its own ~150 kB chunk (`dist/assets/sdk-*.js`), fetched only on first AI use — same rule as swisseph-wasm. Don't add a top-level `import` of it anywhere.
- ⚠️ **The BYOK key is stored under its own localStorage slot** (`hora-prakash-ai-key`), never in the settings blob, so a future settings-sync can't carry it to the cloud. `getAIKey`/`setAIKey` in ai.js; the settings modal writes it only when actually changed (it shows `••••` as a placeholder).
- **Grounding**: `buildChartContext(chart)` (pure, tested) is a terse factual snapshot; `buildReadingRequest` adds the deterministic reading's factors so the AI and offline readings rest on the same evidence. Uses `claude-opus-4-8` by default (settings-overridable), adaptive thinking, streaming.
- **A3 tools are the point** — `CHART_TOOLS` (pure defs in ai.js) let Claude call the app's own compute; `executeChartTool` (`src/tabs/reading-tools.js`, browser-side, needs `state`+`swe`) dispatches to `calcDivisional`/`dashaLordsAt`/`findNextEvents`/`findMuhurta`/strength. So "when does my dasha end?" is **computed, not guessed**. The executor never throws into the chat loop — any failure (incl. uninitialised ephemeris) returns `{ error }`.
- **Cloud Function** (`functions/index.js`, `aiProxy`): verifies the Firebase ID token, forwards **only** `POST /v1/messages` to Anthropic with the server-held key (a Functions secret `ANTHROPIC_API_KEY`), streams the response back. Needs the **Blaze plan**; deploy with `firebase deploy --only functions`. `functions/` is its own CommonJS package, untouched by the Vite build or `npm test`. See `functions/README.md`.
- ⚠️ **The interpretive corpus AND the AI output are both un-reviewed by a professional** — every AI surface shows a disclaimer and refuses medical/legal/financial advice in the system prompt. Keep those.

### Calendar page (`src/tabs/calendar.js`, `src/core/calendar-events.js`)

Month grid of everything the app can date for a person + an iCal export + the Muhurta finder. `buildCalendarEvents` merges four sources into one chronological stream: the transit forecast (`findNextEvents`, annotated with `activation.js`), Vimshottari period starts, Sade Sati phase boundaries, and lunar birthdays. Per-session UI in `uiState.calendar` (month, selected day, filter Set, muhurta inputs).
- ⚠️ **Transit reach is per-planet** — `findNextEvents` scans a fixed window (Moon 30 d … Saturn 730 d), so a range longer than a month silently loses Moon events at the far end. The Calendar drives it one month at a time, which sits inside every planet's window.
- ⚠️ **iCal UIDs must discriminate on `label`.** A sign ingress emits several `natal_aspect` events at the *same instant* for the *same planet*; a UID of type+time+planet collides, and clients then treat them as one event and drop the rest on import. UIDs are built from semantic parts only, so they stay stable across re-exports (a subscription updates in place instead of duplicating).
- Sade Sati + lunar birthday are lifetime-scale, so they're cached per chart — the key includes the **ayanamsa**, or a settings change would keep serving the old Saturn dates.
- `src/utils/ics.js` is a dependency-free RFC 5545 writer. Folding is measured in **octets, not characters** (multi-byte sequences must never split), and all-day `DTEND` is **exclusive** (a single-day event ends the next day).

### Muhurta finder (`src/core/muhurta.js`, `src/content/muhurta-activities.js`)

`findMuhurta({ activity, from, to, lat, lon, timezone, natal, … })` → ranked `windows`, each carrying the full per-factor breakdown the UI renders (a verdict is never a bare number). Scores tithi class, vara, nakshatra, yoga, karana, Tarabala, Chandra bala, Rahu/Gulika kalam and lagna.
- **Cost model — do not collapse this.** The sweep splits work by how fast each factor changes: per **day** one `calcPanchang` (sunrise, kalams, vara); per **slot** `calcPanchangAngles` + one `houses_ex`. A 30-day sweep at 30-min steps is ~1440 slots ≈ 230 ms warm; running a full `calcPanchang` per slot would be ~4× that. `calcPanchangAngles` is the extracted seam that makes this possible — reuse it, don't re-derive tithi/yoga/karana anywhere.
- `veto: true` factors (Rikta tithi, Amavasya, Vishti karana, Rahu/Gulika kalam, Chandrashtama, Vadha tara) disqualify a slot outright regardless of score — verified in practice by windows breaking exactly at the Rahu/Gulika kalam boundaries.
- **Score is a fraction of what was judged**: omitting `natal` drops Tara/Chandra bala from both score *and* max, so a chart-less search isn't silently penalised.
- Activity presets lean on the classical **nakshatra nature** classification (dhruva/chara/kshipra/mridu/ugra/tikshna/mishra) rather than opaque per-activity lists, with explicit `prefer`/`avoid` where tradition names stars directly.
- The **Vedic day runs sunrise→sunrise**, so a pre-dawn slot scores against the *previous* weekday — `calcPanchang`'s `vara` is civil-date based, and muhurta.js corrects it per slot.

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

**External APIs (no keys):** Nominatim geocoding; timeapi.io timezone lookup (last-resort only — coordinate→zone now resolves offline, see below; timeapi has mislabelled zones before, e.g. Perm as Europe/Moscow).

**Coordinate → timezone (`src/utils/tz-resolve.js`):** `zoneFromCoords(lat, lon)` does an **exact offline tz-boundary lookup** via `@photostructure/tz-lookup` (lazily imported → its packed boundary data is a separate ~72 kB chunk, loaded on first use; Node-safe, so tests import it directly). `getTimezone` in geocoding.js chains: boundary lookup → `nearestZone` (bundled-city heuristic, only if the chunk failed to load) → timeapi.io. ⚠️ **Never use `nearestZone` as a primary resolver** — the city DB covers only ~49 countries (no Armenia/Georgia/Ukraine/Ireland/Iran/NZ/…), so "nearest city" crosses borders where coverage is missing: Yerevan's nearest bundled city is Vladikavkaz, Russia (~300 km) → Europe/Moscow, when a July 1982 Yerevan birth must be Asia/Yerevan +5 (USSR DST), not Moscow's +4. `zoneFromCoords` also validates the zone name against the runtime's Intl before returning it.

**City database (`public/places.json`, `src/utils/geocoding.js`):** ~13k cities, schema `{ n, a: lat, o: lon, t: IANA_zone }` (rare `z: "+HH:MM"` fallback where no zone resolves). ⚠️ **`t` is an IANA name, not an offset** — resolved offline from coordinates at build time by `geo-tz` (a *build-only* dependency; **never import it into `src/`** — it bundles huge boundary data). Regenerate with `npm run enrich-places` (enriches the existing JSON in place) or `npm run parse-places` (from `places.txt`). This is what lets a bundled-city selection get a DST-correct, birth-instant offset like an online lookup does — earlier the file stored one fixed offset per city (baked to summer for DST zones), so winter births in DST regions were an hour off and the ⟳ button "changed" the number by re-resolving via IANA. `geocoding.js#searchPlaces` reads `entry.t || entry.z`. ⚠️ **The localStorage location cache (`hora-prakash-location-cache`) outlives data fixes** — cache hits rank above places.json in `searchLocation` and once served stale zones saved before the IANA migration (Perm as Europe/Moscow +3 instead of Asia/Yekaterinburg +5, while ⟳ said +5). `searchLocation` therefore re-resolves every cache hit's `tz` via `reconcileCachedZones` (`src/utils/tz-resolve.js`); entries only keep their cached zone when the boundary lookup can't resolve.

**Timezone / DST (`src/utils/time.js`, `src/utils/format.js`, `src/tabs/input.js`):** A birth record's `timezone` is either an **IANA name** (`America/New_York`) or a **fixed numeric offset** (`-05:00`). The two are treated differently on purpose:
- IANA → the offset is derived **at the birth instant** via `getTZOffsetMinutes`/`localToUTC`, which honours DST including *historical* DST that has since been abolished (Moscow +04 in 1985, São Paulo pre-2019, wartime double summer time, etc.). Always prefer storing IANA names so DST is applied.
- Numeric offset → used verbatim. This is correct for manual entry, paste, and `.jhd` imports (JHora already bakes the birth-day DST into the offset it stores). Never re-derive DST on top of a numeric offset.
- ⚠️ `offsetParts(iana)` / `ianaToOffset(iana)` / `parseTzInfo(iana)` take an optional **`refDate`** — pass the birth instant, or the displayed offset defaults to *today's* (wrong across a DST boundary). `offsetPartsAtBirth(tz, dob, tob)` in `input.js` returns exactly what `toJulianDay` will use, and the form's UTC-offset field auto-updates as you edit the date (`refreshTzForDate`). Bundled-city selections now supply an IANA name (see City database above) so this all applies to them too. Regression coverage: `tests/timezone-dst.test.mjs`, `tests/places-timezone.test.mjs`.

**Deployment:** Deployed to Firebase Hosting (`npm run deploy:firebase`). Current version: see `package.json` (1.5.x). Export payload `APP_VERSION` in `src/tabs/export.js` is tracked separately.

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
