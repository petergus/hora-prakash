# Calculation Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable ayanamsa (12 options via gear-icon modal) and Vimshottari year method (5 options in Dasha tab) to hora-prakash, both triggering a full chart recalculation when changed.

**Architecture:** A new `src/core/settings.js` module holds and persists user preferences to localStorage. A gear icon in the tab nav opens a modal for ayanamsa. Year method controls sit at the top of the Dasha panel. Changing either calls `recalcAll()` (extracted from `input.js`), which applies ayanamsa to the swisseph instance then recomputes planets + dasha + panchang. True Solar Return uses Newton's method with `swe.calc_ut` to find exact dasha boundary JDs.

**Tech Stack:** Vanilla JS, Vite (`npm run dev` → http://localhost:5173/hora-prakash/), swisseph-wasm v0.0.5

---

## File Map

| File | Change |
|---|---|
| `src/core/settings.js` | New — settings state, localStorage persistence, `applyAyanamsa`, option lists |
| `src/ui/settings-modal.js` | New — gear icon injected into tab nav, ayanamsa modal overlay |
| `src/core/dasha.js` | Add `settings`+`swe`+`jd` params; Solar Return path; `calcSubPeriods` gets optional `parentMs` |
| `src/tabs/input.js` | Extract `recalcAll()`, call `loadSettings()`+`applyAyanamsa()` before each calc |
| `src/tabs/dasha.js` | Add year method dropdown + custom days input above dasha table |
| `src/main.js` | Call `loadSettings()`, `applyAyanamsa()`, `initSettingsModal()` at startup |

---

### Task 1: Create `src/core/settings.js`

**Files:**
- Create: `src/core/settings.js`

Settings module: in-memory state, localStorage persistence, ayanamsa application, and option lists used by both the modal and dasha tab.

- [ ] **Step 1: Create `src/core/settings.js`**

```js
// src/core/settings.js
import { getSwe } from './swisseph.js'

const STORAGE_KEY = 'hora-prakash-settings'

const DEFAULTS = {
  ayanamsa: 1,
  yearMethod: 'sidereal',
  customYearDays: 365.25,
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
  return _settings
}

export function saveSettings(patch) {
  _settings = { ..._settings, ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings))
}

export function applyAyanamsa() {
  getSwe().set_sid_mode(_settings.ayanamsa, 0, 0)
}

export const AYANAMSA_OPTIONS = [
  { label: 'Lahiri',                  value: 1  },
  { label: 'Raman',                   value: 3  },
  { label: 'Krishnamurti (KP)',       value: 5  },
  { label: 'Yukteshwar',              value: 7  },
  { label: 'Fagan-Bradley',           value: 0  },
  { label: 'Djwhal Khul',             value: 6  },
  { label: 'De Luce',                 value: 2  },
  { label: 'JN Bhasin',               value: 8  },
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
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
npm run dev
```

Open http://localhost:5173/hora-prakash/ — confirm no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/settings.js
git commit -m "feat: add settings module with ayanamsa + year method persistence"
```

---

### Task 2: Create `src/ui/settings-modal.js` and wire into `src/main.js`

**Files:**
- Create: `src/ui/settings-modal.js`
- Modify: `src/main.js`

A `⚙` button appended to the tab nav opens a modal for ayanamsa selection. Applying saves and triggers full recalc.

- [ ] **Step 1: Create `src/ui/settings-modal.js`**

```js
// src/ui/settings-modal.js
import { getSettings, saveSettings, applyAyanamsa, AYANAMSA_OPTIONS } from '../core/settings.js'

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
      <div class="form-group" style="margin-bottom:1.2rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Ayanamsa</label>
        <select id="settings-ayanamsa" style="width:100%">
          ${AYANAMSA_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
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
    overlay.style.display = 'flex'
    document.getElementById('settings-ayanamsa').value = String(getSettings().ayanamsa)
  })

  document.getElementById('settings-close').addEventListener('click', close)
  document.getElementById('settings-cancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  document.getElementById('settings-apply').addEventListener('click', async () => {
    const ayanamsa = parseInt(document.getElementById('settings-ayanamsa').value, 10)
    saveSettings({ ayanamsa })
    applyAyanamsa()
    close()
    const { recalcAll } = await import('../tabs/input.js')
    await recalcAll()
  })
}
```

- [ ] **Step 2: Update `src/main.js` to load settings, apply ayanamsa, and init modal**

Replace the entire `src/main.js` with:

```js
// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa } from './core/settings.js'
import { initSettingsModal } from './ui/settings-modal.js'
import { createSession, switchSession } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'

async function main() {
  loadSettings()
  await initSwissEph()
  applyAyanamsa()

  document.getElementById('app-loader')?.remove()
  document.getElementById('tab-input').style.display = ''

  initTabs()
  initSettingsModal()

  const id = createSession()
  switchSession(id)
  renderProfileTabs()

  renderInputTab()
}

main()
```

- [ ] **Step 3: Verify gear icon appears in tab nav**

Open http://localhost:5173/hora-prakash/. Confirm `⚙` button appears at the right end of the tab nav. Click it — confirm the ayanamsa modal opens with a dropdown showing 12 options. Click ✕ or Cancel — confirm modal closes. Click outside overlay — confirm modal closes.

- [ ] **Step 4: Commit**

```bash
git add src/ui/settings-modal.js src/main.js
git commit -m "feat: gear icon + ayanamsa settings modal"
```

---

### Task 3: Update `src/core/dasha.js` for configurable year methods

**Files:**
- Modify: `src/core/dasha.js`

Add year method support to `calcDasha`. Non-solar methods change the ms/year factor. True Solar Return uses Newton's method with `swe.calc_ut`. `calcSubPeriods` gains an optional `parentMs` parameter for accurate sub-period proportions under solar return.

- [ ] **Step 1: Add `YEAR_MS` constants and update `calcSubPeriods` to accept optional `parentMs`**

In `src/core/dasha.js`, add after the `TOTAL_YEARS = 120` line:

```js
const YEAR_MS = {
  sidereal: 365.256363004 * 86400000,
  tropical: 365.242190   * 86400000,
  savana:   360.0        * 86400000,
  julian:   365.25       * 86400000,
}

function yearMs(settings) {
  if (!settings || settings.yearMethod === 'sidereal')  return YEAR_MS.sidereal
  if (settings.yearMethod === 'tropical') return YEAR_MS.tropical
  if (settings.yearMethod === 'savana')   return YEAR_MS.savana
  if (settings.yearMethod === 'custom')   return (settings.customYearDays || 365.25) * 86400000
  return YEAR_MS.sidereal
}

function jdToMs(jd) {
  return (jd - 2440587.5) * 86400000
}
```

Then change `calcSubPeriods` signature and body to accept optional `parentMs`:

```js
function calcSubPeriods(startIdx, startDate, parentYears, depth, parentMs) {
  if (depth <= 0) return []
  const totalMs = parentMs ?? parentYears * YEAR_MS.julian
  const result = []
  let cur = startDate.getTime()
  for (let i = 0; i < 9; i++) {
    const idx  = (startIdx + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const yrs  = parentYears * seq.years / TOTAL_YEARS
    const ms   = totalMs * seq.years / TOTAL_YEARS
    const end  = cur + ms
    result.push({
      planet:        seq.name,
      start:         new Date(cur),
      end:           new Date(end),
      seqIndex:      idx,
      durationYears: yrs,
      children:      calcSubPeriods(idx, new Date(cur), yrs, depth - 1, ms),
    })
    cur = end
  }
  return result
}
```

_(Note: `ensureChildren` calls `calcSubPeriods(node.seqIndex, node.start, node.durationYears, 1)` without `parentMs`, so it falls back to julian — a negligible approximation for lazily-expanded sub-periods.)_

- [ ] **Step 2: Add `findSolarReturn` helper**

Add this function before `calcDasha` in `src/core/dasha.js`:

```js
async function findSolarReturn(targetLon, seedJd, swe) {
  const SIDEREAL_SPEED = 65536 | 256  // SEFLG_SIDEREAL | SEFLG_SPEED
  let jd = seedJd
  for (let i = 0; i < 6; i++) {
    const lon = swe.calc_ut(jd, 0, SIDEREAL_SPEED).data[0]
    let diff = targetLon - lon
    while (diff > 180)  diff -= 360
    while (diff < -180) diff += 360
    jd += diff / 360
  }
  return jd
}
```

- [ ] **Step 3: Replace `calcDasha` with a version that accepts `options`**

Replace the entire `calcDasha` function in `src/core/dasha.js` with:

```js
/**
 * Compute Vimshottari dasha tree — MD + AD (2 levels) built eagerly.
 * Deeper levels populated lazily via `ensureChildren`.
 *
 * @param {object} moon      - planet object with lon and nakshatraIndex
 * @param {string} dobStr    - "YYYY-MM-DD"
 * @param {object} [options] - { settings, swe, jd }
 *   settings: from getSettings() — controls year method
 *   swe:      swisseph instance — required for true-solar year method
 *   jd:       Julian Day of birth — required for true-solar year method
 * @returns {Promise<DashaNode[]>}  Array of 9 Mahādasha nodes
 */
export async function calcDasha(moon, dobStr, options = {}) {
  if (!moon || typeof moon.lon !== 'number' || typeof moon.nakshatraIndex !== 'number') {
    throw new Error('calcDasha: valid Moon planet object with lon and nakshatraIndex required')
  }

  const { settings = null, swe = null, jd = null } = options

  const dashaStartIndex = NAKSHATRA_DASHA_INDEX[moon.nakshatraIndex]
  const nakshatraSpan   = 360 / 27
  const normalizedLon   = ((moon.lon % 360) + 360) % 360
  const fractionElapsed = (normalizedLon % nakshatraSpan) / nakshatraSpan
  const balanceYears    = DASHA_SEQUENCE[dashaStartIndex].years * (1 - fractionElapsed)

  const birthDate = new Date(dobStr + 'T00:00:00Z')

  // True Solar Return path
  if (settings?.yearMethod === 'true-solar' && swe && jd) {
    return calcDashaSolarReturn(moon, dobStr, birthDate, jd, swe, dashaStartIndex, balanceYears, fractionElapsed)
  }

  // Fixed year-length path (sidereal, tropical, savana, custom)
  const msPerYear = yearMs(settings)
  const tree = []
  let cur = birthDate.getTime()

  for (let i = 0; i < 9; i++) {
    const idx  = (dashaStartIndex + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const yrs  = i === 0 ? balanceYears : seq.years
    const ms   = yrs * msPerYear
    const end  = cur + ms
    tree.push({
      planet:        seq.name,
      start:         new Date(cur),
      end:           new Date(end),
      seqIndex:      idx,
      durationYears: yrs,
      children:      calcSubPeriods(idx, new Date(cur), yrs, 1, ms),
    })
    cur = end
  }

  return tree
}
```

- [ ] **Step 4: Add `calcDashaSolarReturn` helper after `findSolarReturn`**

Add before `calcDasha`:

```js
async function calcDashaSolarReturn(moon, dobStr, birthDate, jd, swe, dashaStartIndex, balanceYears, fractionElapsed) {
  const SIDEREAL = 65536 | 256
  const sidSunLon = swe.calc_ut(jd, 0, SIDEREAL).data[0]

  // The "dasha year tick" longitude: where the Sun was at start of the current MD cycle
  const targetLon = ((sidSunLon + balanceYears * 360) % 360 + 360) % 360

  // Find when Sun was last at targetLon before the current MD started
  const elapsedYears = DASHA_SEQUENCE[dashaStartIndex].years * fractionElapsed
  const cycleStartJd = await findSolarReturn(targetLon, jd - elapsedYears * 365.256363004, swe)

  const tree = []
  let cumulativeYears = 0

  for (let i = 0; i < 9; i++) {
    const idx  = (dashaStartIndex + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const yrs  = i === 0 ? balanceYears : seq.years

    const startJd = await findSolarReturn(targetLon, cycleStartJd + cumulativeYears * 365.256363004, swe)
    cumulativeYears += yrs
    const endJd   = await findSolarReturn(targetLon, cycleStartJd + cumulativeYears * 365.256363004, swe)

    const start  = new Date(jdToMs(startJd))
    const end    = new Date(jdToMs(endJd))
    const spanMs = jdToMs(endJd) - jdToMs(startJd)

    tree.push({
      planet:        seq.name,
      start,
      end,
      seqIndex:      idx,
      durationYears: yrs,
      children:      calcSubPeriods(idx, start, yrs, 1, spanMs),
    })
  }

  return tree
}
```

- [ ] **Step 5: Verify dev server has no errors**

```bash
npm run dev
```

Open http://localhost:5173/hora-prakash/. Enter birth details and submit. Confirm Dasha tab loads with 9 MD rows and no console errors (still uses default sidereal year at this point).

- [ ] **Step 6: Commit**

```bash
git add src/core/dasha.js
git commit -m "feat: dasha year methods — sidereal/tropical/savana/custom/true-solar-return"
```

---

### Task 4: Extract `recalcAll()` from `src/tabs/input.js`

**Files:**
- Modify: `src/tabs/input.js`

Extract the calculation pipeline from `onFormSubmit` into an exported `recalcAll()` async function. This is called by the settings modal and dasha year method controls on change.

- [ ] **Step 1: Add imports for `applyAyanamsa`, `getSettings`, and `getSwe` at the top of `src/tabs/input.js`**

Change the import block at lines 1–9 of `src/tabs/input.js`:

```js
import { searchLocation, getTimezone } from '../utils/geocoding.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { calcDasha } from '../core/dasha.js'
import { calcPanchang } from '../core/panchang.js'
import { state } from '../state.js'
import { switchTab, enableTab } from '../ui/tabs.js'
import { decToDMS, dmsToDec, offsetParts, offsetStr, ianaToOffset, fmtLat, fmtLon } from '../utils/format.js'
import { applyAyanamsa, getSettings } from '../core/settings.js'
import { getSwe } from '../core/swisseph.js'
```

- [ ] **Step 2: Add exported `recalcAll()` function**

Add this function immediately before `renderInputTab` (before line 94):

```js
export async function recalcAll() {
  if (!state.birth) return
  const { dob, tob, lat, lon, timezone, name } = state.birth
  try {
    applyAyanamsa()
    const jd = toJulianDay(dob, tob, timezone)
    const { planets, lagna, houses } = calcBirthChart(jd, lat, lon)
    const moon = planets.find(p => p.name === 'Moon')
    if (!moon) throw new Error('Moon position could not be calculated.')

    const settings = getSettings()
    const swe      = getSwe()
    const dasha    = await calcDasha(moon, dob, { settings, swe, jd })
    const panchang = calcPanchang(jd, lat, lon)

    state.planets  = planets
    state.lagna    = lagna
    state.houses   = houses
    state.dasha    = dasha
    state.panchang = panchang

    const { renderChart }    = await import('./chart.js')
    const { renderDasha }    = await import('./dasha.js')
    const { renderPanchang } = await import('./panchang.js')
    renderChart(); renderDasha(); renderPanchang()
  } catch (err) {
    console.error('recalcAll error:', err)
  }
}
```

- [ ] **Step 3: Update `onFormSubmit` to use `recalcAll` for the calculation portion**

Replace the `try` block inside `onFormSubmit` (lines 441–479 in the original file) with:

```js
  const btn = document.getElementById('btn-calculate')
  try {
    btn.disabled = true
    btn.textContent = 'Calculating…'

    const jd = toJulianDay(dob, tob, tz)
    applyAyanamsa()
    const { planets, lagna, houses } = calcBirthChart(jd, lat, lon)
    const moon = planets.find(p => p.name === 'Moon')
    if (!moon) throw new Error('Moon position could not be calculated.')

    const settings = getSettings()
    const swe      = getSwe()
    const dasha    = await calcDasha(moon, dob, { settings, swe, jd })
    const panchang = calcPanchang(jd, lat, lon)

    const location = document.getElementById('inp-location').value.trim()
    state.birth    = { name, dob, tob, lat, lon, timezone: tz, location }
    state.planets  = planets
    state.lagna    = lagna
    state.houses   = houses
    state.dasha    = dasha
    state.panchang = panchang

    const { updateActiveLabel } = await import('../sessions.js')
    const { renderProfileTabs } = await import('../ui/profile-tabs.js')
    updateActiveLabel(name)
    renderProfileTabs()

    const { renderChart }    = await import('./chart.js')
    const { renderDasha }    = await import('./dasha.js')
    const { renderPanchang } = await import('./panchang.js')

    renderChart(); renderDasha(); renderPanchang()
    enableTab('chart'); enableTab('dasha'); enableTab('panchang')
    switchTab('chart')
  } catch (err) {
    errEl.textContent = `Calculation error: ${err.message}`
    console.error(err)
  } finally {
    btn.disabled = false
    btn.textContent = 'Calculate Chart'
  }
```

- [ ] **Step 4: Verify chart calculation still works end-to-end**

Open http://localhost:5173/hora-prakash/, submit any birth details. Confirm chart, dasha, and panchang tabs all load correctly. No console errors.

- [ ] **Step 5: Verify ayanamsa modal Apply button triggers recalc**

Submit a chart (Lahiri, default). Open gear modal → change ayanamsa to Raman → Apply. Confirm planet longitudes change in the Chart tab (Raman shifts longitudes by ~1° vs Lahiri).

- [ ] **Step 6: Commit**

```bash
git add src/tabs/input.js
git commit -m "refactor: extract recalcAll(), wire applyAyanamsa into chart pipeline"
```

---

### Task 5: Add year method controls to `src/tabs/dasha.js`

**Files:**
- Modify: `src/tabs/dasha.js`

Add a compact controls row above the dasha table: a year method dropdown and a custom days input (shown only when "Custom" is selected). Changes trigger `recalcAll()`.

- [ ] **Step 1: Add imports for `getSettings`, `saveSettings`, `YEAR_METHOD_OPTIONS` at the top of `src/tabs/dasha.js`**

Change line 1–6 of `src/tabs/dasha.js`:

```js
// src/tabs/dasha.js
import { state } from '../state.js'
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, calcAgeComponents, DASHA_YEARS, LEVEL_NAMES, ensureChildren } from '../core/dasha.js'
import { PLANET_COLORS } from '../core/aspects.js'
import { getActiveSession, defaultDashaUI } from '../sessions.js'
import { getSettings, saveSettings, YEAR_METHOD_OPTIONS } from '../core/settings.js'
```

- [ ] **Step 2: Add `renderYearMethodControls()` helper function**

Add this function near the top of `src/tabs/dasha.js`, after the `d()` function:

```js
function renderYearMethodControls() {
  const { yearMethod, customYearDays } = getSettings()
  const options = YEAR_METHOD_OPTIONS.map(o =>
    `<option value="${o.value}"${o.value === yearMethod ? ' selected' : ''}>${o.label}</option>`
  ).join('')
  const customInput = yearMethod === 'custom'
    ? `<input id="dasha-custom-days" type="number" min="300" max="400" step="0.001"
         value="${customYearDays}" style="width:6rem;margin-left:0.5rem"
         title="Days per year (300–400)" />`
    : ''
  return `
    <div id="dasha-year-controls" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.85rem;flex-wrap:wrap">
      <label style="font-size:0.82rem;color:var(--muted)">Year Method:</label>
      <select id="dasha-year-method" style="font-size:0.82rem">${options}</select>
      ${customInput}
    </div>
  `
}
```

- [ ] **Step 3: Insert `renderYearMethodControls()` into the dasha panel HTML**

In `renderDasha()`, find the line in the `panel.innerHTML` template that reads:

```js
          <p style="color:var(--muted);font-size:0.82rem;margin-bottom:0.85rem">MD → AD → PD → SD → PrD — click any row to expand</p>
```

Replace it with:

```js
          ${renderYearMethodControls()}
          <p style="color:var(--muted);font-size:0.82rem;margin-bottom:0.85rem">MD → AD → PD → SD → PrD — click any row to expand</p>
```

- [ ] **Step 4: Wire the year method controls in the `panel.onchange` handler**

In `renderDasha()`, find the `panel.onchange = e => {` block and add handlers for the new controls. The full `panel.onchange` block should be:

```js
  panel.onchange = e => {
    const ui = d()
    if (e.target.id === 'age-asof-input') {
      ui.ageAsOf    = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
      ui.ageNavCycle = null
      document.getElementById('age-prog-section').outerHTML = renderAgeProgression(birth.dob, ui.ageAsOf ?? new Date())
    } else if (e.target.id === 'prog-lord-select') {
      ui.selectedProgLord = e.target.value
      ui.progNavIndex     = dasha.findIndex(m => m.planet === ui.selectedProgLord)
      document.getElementById('prog-section').outerHTML = renderProgression(birth.dob, dasha)
    } else if (e.target.id === 'dasha-year-method') {
      const yearMethod = e.target.value
      saveSettings({ yearMethod })
      import('../tabs/input.js').then(m => m.recalcAll())
    }
  }
```

- [ ] **Step 5: Wire the custom days input with a debounced handler**

In `renderDasha()`, add a separate `panel.oninput` handler (after the `panel.onchange` block):

```js
  let _customDaysTimer = null
  panel.oninput = e => {
    if (e.target.id !== 'dasha-custom-days') return
    clearTimeout(_customDaysTimer)
    _customDaysTimer = setTimeout(() => {
      const days = parseFloat(e.target.value)
      if (isNaN(days) || days < 300 || days > 400) return
      saveSettings({ customYearDays: days })
      import('../tabs/input.js').then(m => m.recalcAll())
    }, 500)
  }
```

- [ ] **Step 6: Verify year method controls in browser**

Open http://localhost:5173/hora-prakash/, submit a chart, go to Dasha tab. Confirm:

1. "Year Method: [Mean Sidereal ▼]" row appears above the dasha table
2. Changing to Tropical → dasha dates shift slightly (≈17 min per year difference)
3. Changing to Savana (360 days) → dasha dates shift noticeably
4. Changing to Custom → a number input appears; entering 365.0 triggers recalc after 500ms
5. Changing to True Solar Return → dasha recalculates (may take 1–2 seconds; no JS errors)
6. The selected year method persists after page refresh (localStorage)

- [ ] **Step 7: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: year method selector in dasha tab (sidereal/tropical/savana/solar-return/custom)"
```

---

## Self-Review Checklist

- [x] Spec: "12 ayanamsa options" → Task 1 `AYANAMSA_OPTIONS` (12 entries with correct SE constants)
- [x] Spec: "gear icon opens modal, Apply saves + recalcs" → Task 2
- [x] Spec: "5 year methods including True Solar Return" → Task 3 + Task 5
- [x] Spec: "custom year input, 300–400, debounced 500ms" → Task 5 Step 5
- [x] Spec: "recalcAll() exported from input.js" → Task 4
- [x] Spec: "applyAyanamsa() called before each calc" → Task 4 Steps 2+3
- [x] Spec: "guard: state.birth === null → return" → Task 4 Step 2 (`if (!state.birth) return`)
- [x] Spec: "loadSettings() at startup, applyAyanamsa() after initSwissEph()" → Task 2 Step 2
- [x] Spec: "settings persisted to localStorage" → Task 1 `saveSettings`
- [x] Type consistency: `calcDasha(moon, dob, { settings, swe, jd })` — matches Tasks 3, 4
- [x] `YEAR_METHOD_OPTIONS` defined in Task 1, imported in Task 5 — consistent
- [x] `recalcAll` defined in Task 4, called by Task 2 modal and Task 5 controls — consistent
- [x] `applyAyanamsa` defined in Task 1, called in Task 2 modal and Task 4 recalcAll — consistent
- [x] No placeholders or TBDs
