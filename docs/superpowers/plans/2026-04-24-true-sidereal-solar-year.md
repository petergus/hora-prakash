# True Sidereal Solar Year Fix & Calculation Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix TSSY dasha sub-period boundaries (antardasha and below) to use true ephemeris-based solar year boundaries instead of linear time interpolation, fix the ~1hr MD offset, and add configurable planet position type (Apparent/True) and observer type (Geocentric/Topocentric) settings.

**Architecture:** `buildCalcFlags(settings)` in `settings.js` is the single source of SwissEph flags, consumed by both `calculations.js` (birth chart) and `dasha.js` (TSSY). TSSY sub-periods use a new async `calcSubPeriodsTSSY` that calls `advanceTSSY` per boundary. Lazy expansion in the dasha UI becomes async.

**Tech Stack:** Vanilla JS, swisseph-wasm (WASM SwissEph), Vite dev server at http://localhost:5173/hora-prakash/

---

## File Map

| File | Change |
|------|--------|
| `src/core/settings.js` | Add `planetPositions`/`observerType` defaults, option arrays, `buildCalcFlags` |
| `src/core/calculations.js` | Accept `settings` param, use `buildCalcFlags`, call `set_topo` for topocentric |
| `src/ui/settings-modal.js` | Add two new `<select>` dropdowns, wire save/restore |
| `src/tabs/input.js` | Pass `getSettings()` to both `calcBirthChart` call sites |
| `src/core/dasha.js` | Add `advanceTSSY`, `calcSubPeriodsTSSY`; update `findSolarReturn`, `calcDashaSolarReturn`, `ensureChildren` |
| `src/tabs/dasha.js` | Make `insertChildRows` async; import `getSwe`/`buildCalcFlags`/`getSettings` |

---

### Task 1: Add `buildCalcFlags` and new defaults to `settings.js`

**Files:**
- Modify: `src/core/settings.js`

- [ ] **Step 1: Update `DEFAULTS`, add option arrays, add `buildCalcFlags`**

Replace the entire file content of `src/core/settings.js` with:

```js
// src/core/settings.js
import { getSwe } from './swisseph.js'

const STORAGE_KEY = 'hora-prakash-settings'

const DEFAULTS = {
  ayanamsa:        1,
  yearMethod:      'sidereal',
  customYearDays:  365.25,
  planetPositions: 'apparent',   // 'apparent' | 'true'
  observerType:    'geocentric', // 'geocentric' | 'topocentric'
}

let _settings = { ...DEFAULTS }

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    _settings = { ...DEFAULTS, ...raw }
  } catch {
    _settings = { ...DEFAULTS }
  }
}

export function getSettings() {
  return { ..._settings }
}

export function saveSettings(patch) {
  _settings = { ..._settings, ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings))
}

/** Must be called after initSwissEph() has resolved. */
export function applyAyanamsa() {
  getSwe().set_sid_mode(_settings.ayanamsa, 0, 0)
}

/**
 * Build SwissEph calculation flags from settings.
 * SEFLG_SIDEREAL=65536, SEFLG_SPEED=256, SEFLG_TRUEPOS=512, SEFLG_TOPOCTR=32768
 */
export function buildCalcFlags(settings) {
  let flags = 65536 | 256  // SEFLG_SIDEREAL | SEFLG_SPEED
  if (settings?.planetPositions === 'true')        flags |= 512    // SEFLG_TRUEPOS
  if (settings?.observerType    === 'topocentric') flags |= 32768  // SEFLG_TOPOCTR
  return flags
}

export const AYANAMSA_OPTIONS = [
  { label: 'Lahiri',                  value: 1  },
  { label: 'Raman',                   value: 3  },
  { label: 'Krishnamurti (KP)',       value: 5  },
  { label: 'Yukteshwar',              value: 7  },
  { label: 'Fagan-Bradley',           value: 0  },
  { label: 'Djwhal Khul',             value: 6  },
  { label: 'De Luce',                 value: 2  },
  { label: 'JN Bhasin',              value: 8  },
  { label: 'True Citra',              value: 27 },
  { label: 'Babylonian (Kugler 1)',   value: 9  },
  { label: 'Suryasiddhanta',          value: 21 },
  { label: 'Aryabhata',               value: 23 },
]

export const YEAR_METHOD_OPTIONS = [
  { label: 'Mean Sidereal (365.2564)', value: 'sidereal'   },
  { label: 'Tropical (365.2422)',      value: 'tropical'   },
  { label: 'Savana (360)',             value: 'savana'     },
  { label: 'True Solar Return',        value: 'true-solar' },
  { label: 'Custom',                   value: 'custom'     },
]

export const PLANET_POSITION_OPTIONS = [
  { label: 'Apparent',         value: 'apparent' },
  { label: 'True (Geometric)', value: 'true'     },
]

export const OBSERVER_TYPE_OPTIONS = [
  { label: 'Geocentric (default)', value: 'geocentric'  },
  { label: 'Topocentric',          value: 'topocentric' },
]
```

- [ ] **Step 2: Verify dev server still loads**

```bash
npm run dev
```
Open http://localhost:5173/hora-prakash/ — app should load, ⚙ settings modal should open with Ayanamsa dropdown working.

- [ ] **Step 3: Commit**

```bash
git add src/core/settings.js
git commit -m "feat: add planetPositions/observerType settings and buildCalcFlags"
```

---

### Task 2: Update `calcBirthChart` to use `buildCalcFlags` and support topocentric

**Files:**
- Modify: `src/core/calculations.js`

- [ ] **Step 1: Replace `calcBirthChart` signature and flag usage**

Replace the entire file content of `src/core/calculations.js` with:

```js
// src/core/calculations.js
import { getSwe, PLANETS } from './swisseph.js'
import { buildCalcFlags } from './settings.js'

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta',
  'Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'
]

const NAKSHATRA_LORDS = [
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury',
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury',
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury',
]

export function getNakshatraInfo(lon) {
  const normLon = ((lon % 360) + 360) % 360
  const nakshatraIndex = Math.floor(normLon / (360 / 27))
  const pada = Math.floor((normLon % (360 / 27)) / (360 / 108)) + 1
  return {
    index: nakshatraIndex,
    name: NAKSHATRAS[nakshatraIndex],
    lord: NAKSHATRA_LORDS[nakshatraIndex],
    pada,
  }
}

// Parashari combustion orbs in degrees (planets not listed are immune: Sun, Rahu, Ketu)
const COMBUST_ORBS = {
  Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15,
}

function angularDist(a, b) {
  const d = Math.abs(((a - b + 540) % 360) - 180)
  return d
}

/**
 * Calculate all planet positions, lagna, and house cusps.
 * @param {number} jd        Julian Day (UT)
 * @param {number} lat       Latitude
 * @param {number} lon       Longitude
 * @param {object} [settings] Calculation settings from getSettings()
 * @returns {{ planets: object[], lagna: object, houses: number[] }}
 */
export function calcBirthChart(jd, lat, lon, settings) {
  const swe   = getSwe()
  const flags = buildCalcFlags(settings)

  if (settings?.observerType === 'topocentric') {
    swe.set_topo(lon, lat, 0)
  }

  // Use houses_ex with SEFLG_SIDEREAL (65536) to get sidereal ascendant
  const housesResult = swe.houses_ex(jd, 65536, lat, lon, 'P')
  const lagnaLon = ((housesResult.ascmc[0] % 360) + 360) % 360
  const lagnaSign = Math.floor(lagnaLon / 30) + 1
  const houseCusps = Array.from(housesResult.cusps).slice(1, 13)

  const rawPlanets = PLANETS.map(p => {
    const result = swe.calc_ut(jd, p.id, flags)
    let pLon = result[0]
    if (p.isKetu) pLon = (pLon + 180) % 360
    const speed = result[3]
    const planetSign = Math.floor(pLon / 30) + 1
    const house = ((planetSign - lagnaSign + 12) % 12) + 1
    const nak = getNakshatraInfo(pLon)
    return {
      id: p.id,
      name: p.name,
      abbr: p.abbr,
      lon: pLon,
      sign: planetSign,
      degree: pLon % 30,
      house,
      nakshatra: nak.name,
      nakshatraLord: nak.lord,
      nakshatraIndex: nak.index,
      pada: nak.pada,
      retrograde: speed < 0,
    }
  })

  const sunLon = rawPlanets.find(p => p.name === 'Sun')?.lon ?? 0
  const planets = rawPlanets.map(p => {
    const orb = COMBUST_ORBS[p.name]
    const combust = orb !== undefined && angularDist(p.lon, sunLon) <= orb
    return { ...p, combust }
  })

  const lagnaLonNorm = ((lagnaLon % 360) + 360) % 360
  const lagnaInfo = getNakshatraInfo(lagnaLonNorm)
  const lagna = {
    lon: lagnaLonNorm,
    sign: Math.floor(lagnaLonNorm / 30) + 1,
    degree: lagnaLonNorm % 30,
    house: 1,
    nakshatra: lagnaInfo.name,
    nakshatraLord: lagnaInfo.lord,
    pada: lagnaInfo.pada,
  }

  return { planets, lagna, houses: houseCusps }
}
```

- [ ] **Step 2: Verify chart still renders**

Load a birth chart in the browser — Chart tab should show all 9 planets in correct signs.

- [ ] **Step 3: Commit**

```bash
git add src/core/calculations.js
git commit -m "feat: pass settings flags to calcBirthChart, support topocentric set_topo"
```

---

### Task 3: Add planet position and observer dropdowns to the settings modal

**Files:**
- Modify: `src/ui/settings-modal.js`

- [ ] **Step 1: Replace settings-modal.js with version including new dropdowns**

Replace the entire file content of `src/ui/settings-modal.js` with:

```js
// src/ui/settings-modal.js
import {
  getSettings, saveSettings, applyAyanamsa,
  AYANAMSA_OPTIONS, PLANET_POSITION_OPTIONS, OBSERVER_TYPE_OPTIONS,
} from '../core/settings.js'

export function initSettingsModal() {
  const nav = document.getElementById('tab-nav')
  const gearBtn = document.createElement('button')
  gearBtn.id = 'settings-btn'
  gearBtn.type = 'button'
  gearBtn.title = 'Calculation Settings'
  gearBtn.textContent = '⚙'
  gearBtn.style.cssText = 'margin-left:auto;background:none;border:none;cursor:pointer;font-size:1.15rem;padding:0.3rem 0.6rem;color:var(--muted);line-height:1;'
  nav.appendChild(gearBtn)

  const overlay = document.createElement('div')
  overlay.id = 'settings-modal'
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;align-items:center;justify-content:center;'
  overlay.innerHTML = `
    <div style="background:var(--card-bg,#1e1e2e);border:1px solid var(--border,#333);border-radius:8px;padding:1.5rem;min-width:280px;max-width:360px;width:90%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem">
        <h3 style="margin:0;font-size:0.9rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">⚙ Calculation Settings</h3>
        <button id="settings-close" type="button" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--muted);padding:0 0.3rem">✕</button>
      </div>
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Ayanamsa</label>
        <select id="settings-ayanamsa" style="width:100%">
          ${AYANAMSA_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Planet Positions</label>
        <select id="settings-planet-positions" style="width:100%">
          ${PLANET_POSITION_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:1.2rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Observer</label>
        <select id="settings-observer-type" style="width:100%">
          ${OBSERVER_TYPE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button id="settings-apply" type="button" class="btn-primary" style="flex:1">Apply</button>
        <button id="settings-cancel" type="button" class="btn-secondary" style="flex:1">Cancel</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const close = () => { overlay.style.display = 'none' }

  gearBtn.addEventListener('click', () => {
    const s = getSettings()
    overlay.style.display = 'flex'
    document.getElementById('settings-ayanamsa').value        = String(s.ayanamsa)
    document.getElementById('settings-planet-positions').value = s.planetPositions
    document.getElementById('settings-observer-type').value   = s.observerType
  })

  document.getElementById('settings-close').addEventListener('click', close)
  document.getElementById('settings-cancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  document.getElementById('settings-apply').addEventListener('click', async () => {
    const ayanamsa        = parseInt(document.getElementById('settings-ayanamsa').value, 10)
    const planetPositions = document.getElementById('settings-planet-positions').value
    const observerType    = document.getElementById('settings-observer-type').value
    saveSettings({ ayanamsa, planetPositions, observerType })
    close()
    const { recalcAll } = await import('../tabs/input.js')
    await recalcAll()
  })
}
```

- [ ] **Step 2: Verify modal shows all three dropdowns**

Open the ⚙ settings modal — should show Ayanamsa, Planet Positions (Apparent/True), Observer (Geocentric/Topocentric). Apply should trigger recalculation.

- [ ] **Step 3: Commit**

```bash
git add src/ui/settings-modal.js
git commit -m "feat: add planet positions and observer type dropdowns to settings modal"
```

---

### Task 4: Pass `settings` to `calcBirthChart` call sites

**Files:**
- Modify: `src/tabs/input.js`

- [ ] **Step 1: Find the two `calcBirthChart` calls and add `getSettings()`**

In `src/tabs/input.js`, find line ~449:
```js
const { planets, lagna, houses } = calcBirthChart(jd, lat, lon)
```
Change to:
```js
const { planets, lagna, houses } = calcBirthChart(jd, lat, lon, settings)
```
(The `settings` variable is already assigned a few lines above via `const settings = getSettings()`)

Find line ~542 (inside `recalcAll`):
```js
const { planets, lagna, houses } = calcBirthChart(jd, state.birth.lat, state.birth.lon)
```
Change to:
```js
const { planets, lagna, houses } = calcBirthChart(jd, state.birth.lat, state.birth.lon, settings)
```
(The `settings` variable is already assigned a few lines above in `recalcAll` via `const settings = getSettings()`)

- [ ] **Step 2: Verify planet positions still render after a birth chart submission**

Submit a birth chart — planets should appear in Chart tab as before. Toggle Planet Positions to True in settings → Apply → planets may shift slightly (sub-arcsecond for most planets; visible for Sun by ~20 arcsec).

- [ ] **Step 3: Commit**

```bash
git add src/tabs/input.js
git commit -m "feat: pass settings to calcBirthChart for flag-aware planet calculations"
```

---

### Task 5: Fix TSSY in `dasha.js` — `advanceTSSY`, `calcSubPeriodsTSSY`, async `ensureChildren`

**Files:**
- Modify: `src/core/dasha.js`

This is the core fix. Replace the TSSY-related functions in `src/core/dasha.js`.

- [ ] **Step 1: Update `findSolarReturn` to accept `flags` parameter**

In `src/core/dasha.js`, replace:
```js
async function findSolarReturn(targetLon, seedJd, swe) {
  const SIDEREAL_SPEED = 65536 | 256  // SEFLG_SIDEREAL | SEFLG_SPEED
  let jd = seedJd
  for (let i = 0; i < 6; i++) {
    const lon = swe.calc_ut(jd, 0, SIDEREAL_SPEED)[0]
    let diff = targetLon - lon
    while (diff > 180)  diff -= 360
    while (diff < -180) diff += 360
    jd += diff  // Sun ~1°/day, so degree diff ≈ day correction
  }
  return jd
}
```
With:
```js
async function findSolarReturn(targetLon, seedJd, swe, flags) {
  let jd = seedJd
  for (let i = 0; i < 10; i++) {
    const lon = swe.calc_ut(jd, 0, flags)[0]
    let diff = targetLon - lon
    while (diff > 180)  diff -= 360
    while (diff < -180) diff += 360
    if (Math.abs(diff) < 1e-9) break
    jd += diff  // Sun ~1°/day, so degree diff ≈ day correction
  }
  return jd
}
```

- [ ] **Step 2: Add `advanceTSSY` after `findSolarReturn`**

Insert this new function immediately after `findSolarReturn`:
```js
/**
 * Advance jdStart by exactly `years` true sidereal years.
 * One true sidereal year = Sun sweeps 360° of sidereal longitude.
 * Handles fractional years (e.g. 3.5 years → target lon = start + 1260° mod 360°).
 */
async function advanceTSSY(jdStart, years, swe, flags) {
  const startLon  = swe.calc_ut(jdStart, 0, flags)[0]
  const targetLon = ((startLon + years * 360) % 360 + 360) % 360
  const seedJd    = jdStart + years * 365.256363004
  return findSolarReturn(targetLon, seedJd, swe, flags)
}
```

- [ ] **Step 3: Add `calcSubPeriodsTSSY` after `advanceTSSY`**

Insert this new async function immediately after `advanceTSSY`:
```js
/**
 * Compute sub-periods using True Sidereal Solar Year boundaries.
 * Each boundary is computed independently via ephemeris, not by linear interpolation.
 * depth=1 → direct children only; depth=2 → children + grandchildren; etc.
 */
async function calcSubPeriodsTSSY(startIdx, startJd, parentYears, depth, swe, flags) {
  if (depth <= 0) return []
  const result = []
  let curJd = startJd
  for (let i = 0; i < 9; i++) {
    const idx     = (startIdx + i) % 9
    const seq     = DASHA_SEQUENCE[idx]
    const adYears = parentYears * seq.years / TOTAL_YEARS
    const endJd   = await advanceTSSY(curJd, adYears, swe, flags)
    result.push({
      planet:        seq.name,
      start:         new Date(jdToMs(curJd)),
      end:           new Date(jdToMs(endJd)),
      seqIndex:      idx,
      durationYears: adYears,
      tssy:          true,
      children:      depth > 1
        ? await calcSubPeriodsTSSY(idx, curJd, adYears, depth - 1, swe, flags)
        : [],
    })
    curJd = endJd
  }
  return result
}
```

- [ ] **Step 4: Update `calcDashaSolarReturn` to use new functions and pass flags**

Replace the existing `calcDashaSolarReturn` function:
```js
async function calcDashaSolarReturn(jd, swe, flags, dashaStartIndex, balanceYears, fractionElapsed) {
  const sidSunLon = swe.calc_ut(jd, 0, flags)[0]

  const targetLon = ((sidSunLon + balanceYears * 360) % 360 + 360) % 360

  const elapsedYears = DASHA_SEQUENCE[dashaStartIndex].years * fractionElapsed
  const cycleStartJd = await findSolarReturn(targetLon, jd - elapsedYears * 365.256363004, swe, flags)

  const tree = []
  let cumulativeYears = 0

  for (let i = 0; i < 9; i++) {
    const idx  = (dashaStartIndex + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const startJd = await findSolarReturn(targetLon, cycleStartJd + cumulativeYears * 365.256363004, swe, flags)
    cumulativeYears += seq.years
    const endJd   = await findSolarReturn(targetLon, cycleStartJd + cumulativeYears * 365.256363004, swe, flags)

    const start       = new Date(jdToMs(startJd))
    const end         = new Date(jdToMs(endJd))
    const displayYrs  = i === 0 ? balanceYears : seq.years

    tree.push({
      planet:        seq.name,
      start,
      end,
      seqIndex:      idx,
      durationYears: displayYrs,
      tssy:          true,
      children:      await calcSubPeriodsTSSY(idx, startJd, seq.years, 1, swe, flags),
    })
  }

  return tree
}
```

- [ ] **Step 5: Update `calcDasha` to pass `flags` to `calcDashaSolarReturn`**

In `calcDasha`, find:
```js
  if (settings?.yearMethod === 'true-solar') {
    if (swe && jd) {
      return calcDashaSolarReturn(jd, swe, dashaStartIndex, balanceYears, fractionElapsed)
    }
```
Replace with:
```js
  if (settings?.yearMethod === 'true-solar') {
    if (swe && jd) {
      const { buildCalcFlags } = await import('./settings.js')
      const flags = buildCalcFlags(settings)
      return calcDashaSolarReturn(jd, swe, flags, dashaStartIndex, balanceYears, fractionElapsed)
    }
```

- [ ] **Step 6: Make `ensureChildren` async and TSSY-aware**

Replace the existing `ensureChildren` export:
```js
export async function ensureChildren(node, swe, flags) {
  if (node.children.length > 0) return
  if (node.tssy && swe && flags) {
    node.children = await calcSubPeriodsTSSY(node.seqIndex, new Date(node.start).getTime() / 86400000 + 2440587.5, node.durationYears, 1, swe, flags)
  } else {
    node.children = calcSubPeriods(node.seqIndex, node.start, node.durationYears, 1)
  }
}
```

Wait — `node.start` is already a `Date`. To convert `Date → JD`: `jd = date.getTime() / 86400000 + 2440587.5`. Replace the above with the cleaner version:

```js
function msToJd(ms) {
  return ms / 86400000 + 2440587.5
}

export async function ensureChildren(node, swe, flags) {
  if (node.children.length > 0) return
  if (node.tssy && swe && flags) {
    node.children = await calcSubPeriodsTSSY(
      node.seqIndex,
      msToJd(node.start.getTime()),
      node.durationYears,
      1,
      swe,
      flags,
    )
  } else {
    node.children = calcSubPeriods(node.seqIndex, node.start, node.durationYears, 1)
  }
}
```

Add `msToJd` just above `ensureChildren` (after `jdToMs`).

- [ ] **Step 7: Verify TSSY Mahadasha dates match JHora**

In the browser: set Year Method = True Solar Return, open Dasha tab. Compare the first 2-3 MD start/end dates against JHora with the same birth chart. MD boundaries should match within ~1 minute.

- [ ] **Step 8: Commit**

```bash
git add src/core/dasha.js
git commit -m "fix: TSSY antardasha boundaries use ephemeris per-boundary, fix ~1hr MD offset via flags"
```

---

### Task 6: Make `insertChildRows` async in `dasha.js` UI

**Files:**
- Modify: `src/tabs/dasha.js`

- [ ] **Step 1: Update imports at the top of `dasha.js`**

Find the existing import line:
```js
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, calcAgeComponents, DASHA_YEARS, LEVEL_NAMES, ensureChildren } from '../core/dasha.js'
```
Add two more imports after it:
```js
import { getSwe } from '../core/swisseph.js'
import { buildCalcFlags, getSettings } from '../core/settings.js'
```

- [ ] **Step 2: Make `insertChildRows` async and pass `swe`/`flags` to `ensureChildren`**

Replace:
```js
function insertChildRows(parentRow, node, depth) {
  ensureChildren(node)
```
With:
```js
async function insertChildRows(parentRow, node, depth) {
  await ensureChildren(node, getSwe(), buildCalcFlags(getSettings()))
```

- [ ] **Step 3: Update the click handler that calls `insertChildRows` to await it**

Find the event listener that calls `insertChildRows`. It will look roughly like:
```js
insertChildRows(row, node, depth)
```
Change to:
```js
insertChildRows(row, node, depth).catch(console.error)
```
(Fire-and-forget with error logging — the re-render after async completion is handled by the rows being inserted into the DOM directly in `insertChildRows`.)

- [ ] **Step 4: Verify AD/PD/SD/PrD/Deha dates match JHora**

In the browser with Year Method = True Solar Return: expand an MD to see AD rows. Expand an AD to see PD rows. Compare a few AD boundaries against JHora — they should match within ~1 second. The deeper levels (PD, SD, PrD, Deha) should also match.

- [ ] **Step 5: Verify non-TSSY year methods still work**

Switch Year Method to Mean Sidereal. Expand MD → AD → PD — all should still show correctly (using the old proportional `calcSubPeriods` path via the `node.tssy` check in `ensureChildren`).

- [ ] **Step 6: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "fix: make insertChildRows async for TSSY sub-period lazy expansion"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `buildCalcFlags` helper | Task 1 |
| `planetPositions` + `observerType` defaults | Task 1 |
| `PLANET_POSITION_OPTIONS` + `OBSERVER_TYPE_OPTIONS` | Task 1 |
| `calcBirthChart` accepts settings, uses flags | Task 2 |
| Topocentric `set_topo` call | Task 2 |
| Settings modal two new dropdowns | Task 3 |
| Save/restore new settings in modal | Task 3 |
| `calcBirthChart` call sites pass settings | Task 4 |
| `findSolarReturn` accepts flags | Task 5 Step 1 |
| `advanceTSSY` function | Task 5 Step 2 |
| `calcSubPeriodsTSSY` function | Task 5 Step 3 |
| `calcDashaSolarReturn` uses new functions + flags | Task 5 Step 4 |
| `calcDasha` passes flags | Task 5 Step 5 |
| `ensureChildren` async + TSSY-aware | Task 5 Step 6 |
| `msToJd` helper | Task 5 Step 6 |
| `insertChildRows` async | Task 6 Step 2 |
| Click handler awaits `insertChildRows` | Task 6 Step 3 |

All spec sections covered. ✓

**Type/signature consistency check:**

- `findSolarReturn(targetLon, seedJd, swe, flags)` — called consistently in `advanceTSSY` and `calcDashaSolarReturn` ✓
- `advanceTSSY(jdStart, years, swe, flags)` — called in `calcSubPeriodsTSSY` and could be called from `calcDashaSolarReturn` for the balance end, but `calcDashaSolarReturn` uses `findSolarReturn` directly with `targetLon` (that's intentional — it needs the same targetLon for all MD boundaries) ✓
- `calcSubPeriodsTSSY(startIdx, startJd, parentYears, depth, swe, flags)` — `startJd` is a JD number (not a Date). Called from `calcDashaSolarReturn` with `startJd` (JD), and from `ensureChildren` with `msToJd(node.start.getTime())` ✓
- `ensureChildren(node, swe, flags)` — called in `insertChildRows` with `getSwe()` and `buildCalcFlags(getSettings())` ✓
- `tssy: true` — set on nodes in both `calcSubPeriodsTSSY` and `calcDashaSolarReturn`, checked in `ensureChildren` ✓
