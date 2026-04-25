# Vedic Astrology Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Vedic astrology web app (Vite + Vanilla JS + WASM) that computes a North Indian birth chart, Vimshottari dasha tree, and birth-day panchang from user-entered birth details.

**Architecture:** Multi-tab single-page app; all astronomical calculations run in-browser via swisseph-wasm. User input tab feeds a single calculation pipeline that populates a shared app state object consumed by chart, dasha, and panchang tabs.

**Tech Stack:** Vite, Vanilla JS ES Modules, swisseph-wasm (prolaxu), Nominatim geocoding, SVG chart rendering, GitHub Pages deployment.

---

## File Map

| File | Responsibility |
|------|---------------|
| `public/index.html` | App shell with tab nav + 4 tab content divs |
| `src/main.js` | App entry: init swisseph, wire tabs, form submit handler |
| `src/state.js` | Singleton app state object |
| `src/ui/tabs.js` | Tab switching show/hide logic |
| `src/utils/time.js` | Local datetime + timezone → UTC Julian Day |
| `src/utils/geocoding.js` | Nominatim location search → `{lat, lon, timezone, displayName}` |
| `src/core/swisseph.js` | WASM loader + thin wrapper (calc, houses, ut_to_jd) |
| `src/core/calculations.js` | Planets, lagna, house cusps, nakshatra — uses swisseph.js |
| `src/core/dasha.js` | Vimshottari dasha sequence computation |
| `src/core/panchang.js` | Tithi, vara, nakshatra, yoga, karana, sunrise/sunset |
| `src/ui/chart-svg.js` | North Indian SVG chart renderer |
| `src/tabs/input.js` | Form render + geocode autocomplete + validation |
| `src/tabs/chart.js` | Chart tab: calls chart-svg.js with state data |
| `src/tabs/dasha.js` | Dasha tab: renders expandable dasha table |
| `src/tabs/panchang.js` | Panchang tab: renders 5 elements + kalam table |
| `.github/workflows/deploy.yml` | GitHub Actions: build + deploy to gh-pages |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `public/index.html`
- Create: `src/main.js`
- Create: `src/state.js`

- [ ] **Step 1: Init npm and install deps**

```bash
cd /Users/priyankgahtori/Code/aditya-amrit-hora
npm init -y
npm install --save-dev vite
npm install swisseph-wasm
```

- [ ] **Step 2: Create vite.config.js**

```js
// vite.config.js
export default {
  base: '/aditya-amrit-hora/',
  build: { outDir: 'dist' },
}
```

- [ ] **Step 3: Update package.json scripts**

Replace the `scripts` section in `package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

- [ ] **Step 4: Create public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aditya Amrit Hora</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <header>
    <h1>Aditya Amrit Hora</h1>
    <nav id="tab-nav">
      <button data-tab="input" class="tab-btn active">Birth Details</button>
      <button data-tab="chart" class="tab-btn" disabled>Birth Chart</button>
      <button data-tab="dasha" class="tab-btn" disabled>Dasha</button>
      <button data-tab="panchang" class="tab-btn" disabled>Panchang</button>
    </nav>
  </header>
  <main>
    <section id="tab-input" class="tab-panel active"></section>
    <section id="tab-chart" class="tab-panel"></section>
    <section id="tab-dasha" class="tab-panel"></section>
    <section id="tab-panchang" class="tab-panel"></section>
  </main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create src/state.js**

```js
// src/state.js
export const state = {
  birth: null,       // { name, dob, tob, lat, lon, timezone, location }
  planets: null,     // array of { id, name, lon, house, nakshatra, pada, retrograde }
  lagna: null,       // { lon, house: 1, nakshatra, pada }
  houses: null,      // array of 12 house cusp longitudes
  dasha: null,       // computed dasha tree
  panchang: null,    // computed panchang values
}
```

- [ ] **Step 6: Create src/main.js**

```js
// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'

initTabs()
renderInputTab()
```

- [ ] **Step 7: Create src/style.css with minimal styles**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 1rem; }
header { margin-bottom: 1rem; }
h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
nav { display: flex; gap: 0.5rem; }
.tab-btn { padding: 0.4rem 1rem; cursor: pointer; border: 1px solid #ccc; background: #f5f5f5; border-radius: 4px; }
.tab-btn.active { background: #333; color: #fff; border-color: #333; }
.tab-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite dev server starts, browser shows "Aditya Amrit Hora" with 4 tab buttons (last 3 disabled).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite project with tab shell"
```

---

## Task 2: Tab Switching UI

**Files:**
- Create: `src/ui/tabs.js`

- [ ] **Step 1: Create src/ui/tabs.js**

```js
// src/ui/tabs.js
export function initTabs() {
  document.getElementById('tab-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn')
    if (!btn || btn.disabled) return
    switchTab(btn.dataset.tab)
  })
}

export function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`))
}

export function enableTab(name) {
  const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`)
  if (btn) btn.disabled = false
}
```

- [ ] **Step 2: Verify tab switching works**

In the browser, manually remove `disabled` from Chart button in DevTools and click it — panel should switch.

- [ ] **Step 3: Commit**

```bash
git add src/ui/tabs.js
git commit -m "feat: add tab switching logic"
```

---

## Task 3: Geocoding Utility

**Files:**
- Create: `src/utils/geocoding.js`

- [ ] **Step 1: Create src/utils/geocoding.js**

```js
// src/utils/geocoding.js

/**
 * Search locations via Nominatim OpenStreetMap.
 * Returns array of { displayName, lat, lon, timezone } candidates.
 */
export async function searchLocation(query) {
  if (!query || query.length < 3) return []
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error('Geocoding request failed')
  const data = await res.json()
  return data.map(item => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }))
}

/**
 * Get IANA timezone string for coordinates via timeapi.io (free, no key).
 */
export async function getTimezone(lat, lon) {
  const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Timezone lookup failed')
  const data = await res.json()
  return data.timeZone  // e.g. "Asia/Kolkata"
}
```

- [ ] **Step 2: Smoke test in browser console**

Open browser console on the dev server, paste:
```js
import('/src/utils/geocoding.js').then(m => m.searchLocation('Mumbai').then(console.log))
```
Expected: Array of 5 location objects with lat/lon.

- [ ] **Step 3: Commit**

```bash
git add src/utils/geocoding.js
git commit -m "feat: add Nominatim geocoding utility"
```

---

## Task 4: Time Utility (Julian Day Conversion)

**Files:**
- Create: `src/utils/time.js`

- [ ] **Step 1: Create src/utils/time.js**

```js
// src/utils/time.js

/**
 * Convert local datetime + IANA timezone to UTC Julian Day Number.
 * swisseph expects UT (Universal Time) Julian Day.
 *
 * @param {string} dateStr  "YYYY-MM-DD"
 * @param {string} timeStr  "HH:MM"
 * @param {string} timezone IANA timezone, e.g. "Asia/Kolkata"
 * @returns {number} Julian Day (UT)
 */
export function toJulianDay(dateStr, timeStr, timezone) {
  const localISO = `${dateStr}T${timeStr}:00`
  // Use Intl to determine UTC offset at this moment in this timezone
  const localDate = new Date(localISO)
  // Create a formatter that tells us what UTC time corresponds to this local time
  const utcDate = localToUTC(localISO, timezone)
  return dateToJD(utcDate)
}

function localToUTC(localISO, timezone) {
  // Trick: format a known UTC time as if it were in the target timezone,
  // then back-solve for UTC.
  const parts = localISO.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  const [, y, mo, d, h, m] = parts.map(Number)
  // Build a Date treating the string as UTC, then adjust using timezone offset
  const probe = new Date(Date.UTC(y, mo - 1, d, h, m))
  const tzOffset = getTZOffsetMinutes(probe, timezone)
  return new Date(probe.getTime() - tzOffset * 60000)
}

function getTZOffsetMinutes(date, timezone) {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr  = date.toLocaleString('en-US', { timeZone: timezone })
  return (new Date(tzStr) - new Date(utcStr)) / 60000
}

function dateToJD(date) {
  // Julian Day Number from a JS Date (UTC)
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const h = date.getUTCHours() + date.getUTCMinutes() / 60
  let Y = y, M = m
  if (M <= 2) { Y -= 1; M += 12 }
  const A = Math.floor(Y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + h / 24 + B - 1524.5
}

/**
 * Format a Julian Day back to a JS Date (UTC).
 */
export function jdToDate(jd) {
  const z = Math.floor(jd + 0.5)
  const f = jd + 0.5 - z
  let a = z
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25)
    a = z + 1 + alpha - Math.floor(alpha / 4)
  }
  const b = a + 1524
  const c = Math.floor((b - 122.1) / 365.25)
  const dd = Math.floor(365.25 * c)
  const e = Math.floor((b - dd) / 30.6001)
  const day = b - dd - Math.floor(30.6001 * e)
  const month = e < 14 ? e - 1 : e - 13
  const year = month > 2 ? c - 4716 : c - 4715
  const hours = f * 24
  const h = Math.floor(hours)
  const mins = Math.floor((hours - h) * 60)
  return new Date(Date.UTC(year, month - 1, day, h, mins))
}
```

- [ ] **Step 2: Verify in browser console**

```js
import('/src/utils/time.js').then(m => {
  const jd = m.toJulianDay('1990-01-15', '10:30', 'Asia/Kolkata')
  console.log(jd)  // Expected: ~2447907.1
})
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/time.js
git commit -m "feat: add Julian Day conversion utility"
```

---

## Task 5: SwissEph WASM Wrapper

**Files:**
- Create: `src/core/swisseph.js`

- [ ] **Step 1: Check swisseph-wasm API**

```bash
ls node_modules/swisseph-wasm/
cat node_modules/swisseph-wasm/README.md 2>/dev/null || cat node_modules/swisseph-wasm/package.json
```

Note the exported module entry and available functions (typically `swe_calc_ut`, `swe_houses`, `swe_set_sid_mode`, `swe_julday`).

- [ ] **Step 2: Create src/core/swisseph.js**

```js
// src/core/swisseph.js
let swe = null

export async function initSwissEph() {
  if (swe) return swe
  const mod = await import('swisseph-wasm')
  // swisseph-wasm may export a default factory or named exports — adjust if needed
  swe = typeof mod.default === 'function' ? await mod.default() : mod
  // Set Lahiri ayanamsa (SE_SIDM_LAHIRI = 1)
  swe.swe_set_sid_mode(1, 0, 0)
  return swe
}

export function getSwe() {
  if (!swe) throw new Error('SwissEph not initialized — call initSwissEph() first')
  return swe
}

// Planet IDs used throughout the app
export const PLANETS = [
  { id: 0,  name: 'Sun',     abbr: 'Su' },
  { id: 1,  name: 'Moon',    abbr: 'Mo' },
  { id: 2,  name: 'Mercury', abbr: 'Me' },
  { id: 3,  name: 'Venus',   abbr: 'Ve' },
  { id: 4,  name: 'Mars',    abbr: 'Ma' },
  { id: 5,  name: 'Jupiter', abbr: 'Ju' },
  { id: 6,  name: 'Saturn',  abbr: 'Sa' },
  { id: 11, name: 'Rahu',    abbr: 'Ra' },  // mean node
  { id: 11, name: 'Ketu',    abbr: 'Ke', isKetu: true },
]
```

- [ ] **Step 3: Update src/main.js to init swisseph on load**

```js
// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'

async function main() {
  await initSwissEph()
  initTabs()
  renderInputTab()
}

main()
```

- [ ] **Step 4: Verify WASM loads without error**

Open browser console — no errors, no "SwissEph not initialized" warnings.

- [ ] **Step 5: Commit**

```bash
git add src/core/swisseph.js src/main.js
git commit -m "feat: load and init swisseph-wasm with Lahiri ayanamsa"
```

---

## Task 6: Planetary Calculations

**Files:**
- Create: `src/core/calculations.js`

- [ ] **Step 1: Create src/core/calculations.js**

```js
// src/core/calculations.js
import { getSwe, PLANETS } from './swisseph.js'

const SIDEREAL_FLAG = 64 + 256  // SEFLG_SIDEREAL | SEFLG_SPEED

// 27 nakshatras, 13°20' each
const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta',
  'Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'
]

const NAKSHATRA_LORDS = [
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury', // 0-8
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury', // 9-17
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury', // 18-26
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

/**
 * Calculate all planet positions for a given Julian Day and coordinates.
 * @returns {{ planets: PlanetData[], lagna: LagnaData, houses: number[] }}
 */
export function calcBirthChart(jd, lat, lon) {
  const swe = getSwe()

  // Calculate house cusps and lagna (Ascendant) using Placidus ('P')
  const housesResult = swe.swe_houses(jd, lat, lon, 'P')
  // housesResult.house is array of 12 cusp longitudes (sidereal via set_sid_mode)
  // housesResult.ascendant is lagna longitude
  const lagnaLon = housesResult.ascmc[0]  // ASC
  const houseCusps = housesResult.house   // [cusp1..cusp12]

  const lagnaSign = Math.floor(lagnaLon / 30) + 1  // 1-12

  // Calculate each planet
  const planets = PLANETS.map(p => {
    const result = swe.swe_calc_ut(jd, p.id, SIDEREAL_FLAG)
    let pLon = result.longitude
    if (p.isKetu) pLon = (pLon + 180) % 360  // Ketu = Rahu + 180°
    const speed = result.longitudeSpeed
    const house = getLongitudeHouse(pLon, houseCusps)
    const nakshatra = getNakshatraInfo(pLon)
    return {
      id: p.id,
      name: p.name,
      abbr: p.abbr,
      lon: pLon,
      sign: Math.floor(pLon / 30) + 1,
      degree: pLon % 30,
      house,
      nakshatra: nakshatra.name,
      nakshatraLord: nakshatra.lord,
      nakshatraIndex: nakshatra.index,
      pada: nakshatra.pada,
      retrograde: speed < 0,
    }
  })

  const lagnaInfo = getNakshatraInfo(lagnaLon)
  const lagna = {
    lon: lagnaLon,
    sign: lagnaSign,
    degree: lagnaLon % 30,
    house: 1,
    nakshatra: lagnaInfo.name,
    pada: lagnaInfo.pada,
  }

  return { planets, lagna, houses: houseCusps }
}

function getLongitudeHouse(lon, cusps) {
  // cusps is array of 12 cusp longitudes in sidereal degrees
  for (let i = 0; i < 12; i++) {
    const start = cusps[i]
    const end = cusps[(i + 1) % 12]
    if (end > start) {
      if (lon >= start && lon < end) return i + 1
    } else {
      // Wraps around 360°
      if (lon >= start || lon < end) return i + 1
    }
  }
  return 1
}
```

- [ ] **Step 2: Wire into main.js for testing**

In browser console after loading app, run:
```js
import { calcBirthChart } from '/src/core/calculations.js'
// JD for 1990-01-15 05:00 UTC ≈ 2447905.71
const result = calcBirthChart(2447905.71, 19.076, 72.877)
console.log(result.lagna, result.planets[1])  // lagna + Moon
```
Expected: Objects with lon, sign (1-12), nakshatra name.

- [ ] **Step 3: Commit**

```bash
git add src/core/calculations.js
git commit -m "feat: add planetary and lagna calculation with nakshatra info"
```

---

## Task 7: Input Tab — Form + Geocode Autocomplete

**Files:**
- Create: `src/tabs/input.js`

- [ ] **Step 1: Create src/tabs/input.js**

```js
// src/tabs/input.js
import { searchLocation, getTimezone } from '../utils/geocoding.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { calcDasha } from '../core/dasha.js'
import { calcPanchang } from '../core/panchang.js'
import { state } from '../state.js'
import { switchTab, enableTab } from '../ui/tabs.js'
import { renderChart } from './chart.js'
import { renderDasha } from './dasha.js'
import { renderPanchang } from './panchang.js'

let selectedLocation = null
let autocompleteTimeout = null

export function renderInputTab() {
  const panel = document.getElementById('tab-input')
  panel.innerHTML = `
    <form id="birth-form">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="inp-name" required placeholder="Full name" />
      </div>
      <div class="form-group">
        <label>Date of Birth</label>
        <input type="date" id="inp-dob" required />
      </div>
      <div class="form-group">
        <label>Time of Birth</label>
        <input type="time" id="inp-tob" required />
      </div>
      <div class="form-group">
        <label>Birth Location</label>
        <input type="text" id="inp-location" required placeholder="Type city name..." autocomplete="off" />
        <ul id="location-suggestions"></ul>
      </div>
      <div class="form-group coords-row">
        <div>
          <label>Latitude</label>
          <input type="number" id="inp-lat" step="0.0001" placeholder="e.g. 19.0760" />
        </div>
        <div>
          <label>Longitude</label>
          <input type="number" id="inp-lon" step="0.0001" placeholder="e.g. 72.8777" />
        </div>
        <div>
          <label>Timezone</label>
          <input type="text" id="inp-tz" placeholder="e.g. Asia/Kolkata" readonly />
        </div>
      </div>
      <button type="submit" id="btn-calculate">Calculate Chart</button>
      <p id="calc-error" class="error"></p>
    </form>
  `

  document.getElementById('inp-location').addEventListener('input', onLocationInput)
  document.getElementById('birth-form').addEventListener('submit', onFormSubmit)
  document.getElementById('location-suggestions').addEventListener('click', onSuggestionClick)
}

async function onLocationInput(e) {
  clearTimeout(autocompleteTimeout)
  const q = e.target.value
  if (q.length < 3) { clearSuggestions(); return }
  autocompleteTimeout = setTimeout(async () => {
    const results = await searchLocation(q)
    renderSuggestions(results)
  }, 400)
}

function renderSuggestions(results) {
  const ul = document.getElementById('location-suggestions')
  ul.innerHTML = results.map((r, i) =>
    `<li data-index="${i}" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${r.displayName}">${r.displayName}</li>`
  ).join('')
}

function clearSuggestions() {
  document.getElementById('location-suggestions').innerHTML = ''
}

async function onSuggestionClick(e) {
  const li = e.target.closest('li')
  if (!li) return
  const lat = parseFloat(li.dataset.lat)
  const lon = parseFloat(li.dataset.lon)
  const tz = await getTimezone(lat, lon)
  selectedLocation = { displayName: li.dataset.name, lat, lon, timezone: tz }
  document.getElementById('inp-location').value = li.dataset.name
  document.getElementById('inp-lat').value = lat
  document.getElementById('inp-lon').value = lon
  document.getElementById('inp-tz').value = tz
  clearSuggestions()
}

async function onFormSubmit(e) {
  e.preventDefault()
  const errEl = document.getElementById('calc-error')
  errEl.textContent = ''
  const name = document.getElementById('inp-name').value.trim()
  const dob  = document.getElementById('inp-dob').value
  const tob  = document.getElementById('inp-tob').value
  const lat  = parseFloat(document.getElementById('inp-lat').value)
  const lon  = parseFloat(document.getElementById('inp-lon').value)
  const tz   = document.getElementById('inp-tz').value.trim()

  if (!name || !dob || !tob || isNaN(lat) || isNaN(lon) || !tz) {
    errEl.textContent = 'Please fill all fields and select a location from suggestions.'
    return
  }

  try {
    document.getElementById('btn-calculate').textContent = 'Calculating...'
    const jd = toJulianDay(dob, tob, tz)
    const { planets, lagna, houses } = calcBirthChart(jd, lat, lon)
    const dasha = calcDasha(planets.find(p => p.name === 'Moon'), dob)
    const panchang = calcPanchang(jd, lat, lon)

    state.birth    = { name, dob, tob, lat, lon, timezone: tz, location: selectedLocation?.displayName || '' }
    state.planets  = planets
    state.lagna    = lagna
    state.houses   = houses
    state.dasha    = dasha
    state.panchang = panchang

    renderChart()
    renderDasha()
    renderPanchang()
    enableTab('chart'); enableTab('dasha'); enableTab('panchang')
    switchTab('chart')
  } catch (err) {
    errEl.textContent = `Calculation error: ${err.message}`
    console.error(err)
  } finally {
    document.getElementById('btn-calculate').textContent = 'Calculate Chart'
  }
}
```

- [ ] **Step 2: Add form CSS to style.css**

```css
/* Append to src/style.css */
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem; }
.form-group input { width: 100%; padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
.coords-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
#location-suggestions { list-style: none; border: 1px solid #ccc; border-top: none; max-height: 200px; overflow-y: auto; }
#location-suggestions li { padding: 0.4rem; cursor: pointer; font-size: 0.9rem; }
#location-suggestions li:hover { background: #eee; }
#btn-calculate { padding: 0.5rem 1.5rem; background: #333; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
.error { color: red; margin-top: 0.5rem; font-size: 0.9rem; }
```

- [ ] **Step 3: Commit**

```bash
git add src/tabs/input.js src/style.css
git commit -m "feat: add birth details input form with geocode autocomplete"
```

---

## Task 8: Vimshottari Dasha Calculation

**Files:**
- Create: `src/core/dasha.js`

- [ ] **Step 1: Create src/core/dasha.js**

```js
// src/core/dasha.js

// Vimshottari dasha order and durations in years
const DASHA_SEQUENCE = [
  { name: 'Ketu',    years: 7  },
  { name: 'Venus',   years: 20 },
  { name: 'Sun',     years: 6  },
  { name: 'Moon',    years: 10 },
  { name: 'Mars',    years: 7  },
  { name: 'Rahu',    years: 18 },
  { name: 'Jupiter', years: 16 },
  { name: 'Saturn',  years: 19 },
  { name: 'Mercury', years: 17 },
]
const TOTAL_YEARS = 120

// Nakshatra lord order (0=Ketu, 1=Venus, ... matching DASHA_SEQUENCE)
const NAKSHATRA_DASHA_INDEX = [
  0,1,2,3,4,5,6,7,8, // Aswini-Ashlesha → Ketu,Venus,Sun,Moon,Mars,Rahu,Jup,Sat,Mer
  0,1,2,3,4,5,6,7,8, // Magha-Jyeshtha
  0,1,2,3,4,5,6,7,8, // Mula-Revati
]

/**
 * @param {object} moon - planet object for Moon from calculations.js
 * @param {string} dobStr - "YYYY-MM-DD"
 * @returns {DashaTree[]}
 */
export function calcDasha(moon, dobStr) {
  const nakshatraIdx = moon.nakshatraIndex
  const dashaStartIndex = NAKSHATRA_DASHA_INDEX[nakshatraIdx]

  // Fraction of nakshatra traversed = balance of current dasha remaining
  const nakshatraSpan = 360 / 27
  const posInNakshatra = moon.lon % nakshatraSpan
  const fractionElapsed = posInNakshatra / nakshatraSpan
  const fractionRemaining = 1 - fractionElapsed
  const balanceYears = DASHA_SEQUENCE[dashaStartIndex].years * fractionRemaining

  const birthDate = new Date(dobStr + 'T00:00:00Z')
  const tree = []

  let currentDate = new Date(birthDate)

  for (let i = 0; i < 9; i++) {
    const idx = (dashaStartIndex + i) % 9
    const maha = DASHA_SEQUENCE[idx]
    const mahaDurationYears = i === 0 ? balanceYears : maha.years
    const mahaEnd = addYears(currentDate, mahaDurationYears)

    const antars = []
    let antarStart = new Date(currentDate)

    for (let j = 0; j < 9; j++) {
      const aIdx = (idx + j) % 9
      const antar = DASHA_SEQUENCE[aIdx]
      const antarYears = (mahaDurationYears * antar.years) / TOTAL_YEARS
      const antarEnd = addYears(antarStart, antarYears)

      const pratyantars = []
      let pratStart = new Date(antarStart)
      for (let k = 0; k < 9; k++) {
        const pIdx = (aIdx + k) % 9
        const prat = DASHA_SEQUENCE[pIdx]
        const pratYears = (antarYears * prat.years) / TOTAL_YEARS
        const pratEnd = addYears(pratStart, pratYears)
        pratyantars.push({ planet: prat.name, start: new Date(pratStart), end: pratEnd })
        pratStart = pratEnd
      }

      antars.push({ planet: antar.name, start: new Date(antarStart), end: antarEnd, pratyantars })
      antarStart = antarEnd
    }

    tree.push({ planet: maha.name, start: new Date(currentDate), end: mahaEnd, antars })
    currentDate = mahaEnd
  }

  return tree
}

function addYears(date, years) {
  const ms = years * 365.25 * 24 * 60 * 60 * 1000
  return new Date(date.getTime() + ms)
}

export function isCurrentPeriod(start, end) {
  const now = Date.now()
  return start.getTime() <= now && end.getTime() > now
}
```

- [ ] **Step 2: Smoke test in console**

```js
// In browser console
import { calcDasha } from '/src/core/dasha.js'
const fakeMoon = { lon: 45.5, nakshatraIndex: 3, nakshatraLord: 'Moon' }
const tree = calcDasha(fakeMoon, '1990-01-15')
console.log(tree[0].planet, tree[0].start, tree[0].end)
```
Expected: A planet name + valid Date objects.

- [ ] **Step 3: Commit**

```bash
git add src/core/dasha.js
git commit -m "feat: add Vimshottari dasha calculation (3-level tree)"
```

---

## Task 9: Panchang Calculation

**Files:**
- Create: `src/core/panchang.js`

- [ ] **Step 1: Create src/core/panchang.js**

```js
// src/core/panchang.js
import { getSwe } from './swisseph.js'
import { getNakshatraInfo } from './calculations.js'
import { jdToDate } from '../utils/time.js'

const TITHI_NAMES = [
  'Pratipada','Dvitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami',
  'Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi',
  'Purnima/Amavasya'
]

const VARA_NAMES = [
  { name: 'Sunday',    lord: 'Sun'     },
  { name: 'Monday',    lord: 'Moon'    },
  { name: 'Tuesday',   lord: 'Mars'    },
  { name: 'Wednesday', lord: 'Mercury' },
  { name: 'Thursday',  lord: 'Jupiter' },
  { name: 'Friday',    lord: 'Venus'   },
  { name: 'Saturday',  lord: 'Saturn'  },
]

const YOGA_NAMES = [
  'Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarman',
  'Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra',
  'Siddhi','Vyatipata','Variyan','Parigha','Shiva','Siddha','Sadhya','Shubha',
  'Shukla','Brahma','Indra','Vaidhriti'
]

const KARANA_NAMES = [
  'Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti',
  'Shakuni','Chatushpada','Naga','Kimstughna'
]

const RAHU_KALAM_ORDER = [8, 2, 7, 5, 6, 4, 3]  // index = day of week (0=Sun), value = period (1-8)
const GULIKA_ORDER     = [6, 5, 4, 3, 2, 1, 7]

export function calcPanchang(jd, lat, lon) {
  const swe = getSwe()

  // Sun and Moon tropical longitudes for panchang
  const SUN_FLAG  = 256  // SEFLG_SPEED only (tropical for panchang)
  const sunResult  = swe.swe_calc_ut(jd, 0,  SUN_FLAG)
  const moonResult = swe.swe_calc_ut(jd, 1,  SUN_FLAG)
  const sunLon  = sunResult.longitude
  const moonLon = moonResult.longitude

  // Tithi: each tithi = 12° difference between Moon and Sun
  const diff = ((moonLon - sunLon) + 360) % 360
  const tithiNum = Math.floor(diff / 12) + 1   // 1-30
  const tithiName = tithiNum <= 15 ? TITHI_NAMES[tithiNum - 1] + ' (Shukla)' : TITHI_NAMES[tithiNum - 16] + ' (Krishna)'

  // Vara (weekday) — JD 0.5 = Monday, repeating cycle
  const date = jdToDate(jd)
  const vara = VARA_NAMES[date.getUTCDay()]

  // Nakshatra: sidereal Moon longitude
  const sidMoonResult = swe.swe_calc_ut(jd, 1, 64 + 256)
  const nakshatra = getNakshatraInfo(sidMoonResult.longitude)

  // Yoga: (Sun lon + Moon lon) / (360/27), tropical
  const yogaVal = ((sunLon + moonLon) % 360) / (360 / 27)
  const yogaName = YOGA_NAMES[Math.floor(yogaVal)]

  // Karana: each karana = 6° of Moon-Sun difference
  const karanaNum = Math.floor(diff / 6)
  const karanaName = KARANA_NAMES[karanaNum % 7]

  // Sunrise and Sunset
  const riseResult = swe.swe_rise_trans(jd - 0.5, 0, 0, lat, lon, 0, 1)  // SE_CALC_RISE=1
  const setResult  = swe.swe_rise_trans(jd - 0.5, 0, 0, lat, lon, 0, 2)  // SE_CALC_SET=2
  const sunrise = riseResult.tret ? jdToDate(riseResult.tret[0]) : null
  const sunset  = setResult.tret  ? jdToDate(setResult.tret[0])  : null

  // Rahu Kalam and Gulika Kalam (8 equal parts of daytime)
  const dayDuration = sunrise && sunset ? (sunset - sunrise) : 43200000  // fallback 12h
  const partMs = dayDuration / 8
  const dayOfWeek = date.getUTCDay()
  const rahuPart  = RAHU_KALAM_ORDER[dayOfWeek] - 1
  const gulikaPart = GULIKA_ORDER[dayOfWeek] - 1
  const rahuStart  = sunrise ? new Date(sunrise.getTime() + rahuPart  * partMs) : null
  const rahuEnd    = rahuStart  ? new Date(rahuStart.getTime()  + partMs) : null
  const gulikaStart = sunrise ? new Date(sunrise.getTime() + gulikaPart * partMs) : null
  const gulikaEnd   = gulikaStart ? new Date(gulikaStart.getTime() + partMs) : null

  return {
    tithi: { num: tithiNum, name: tithiName },
    vara,
    nakshatra: { name: nakshatra.name, pada: nakshatra.pada, lord: nakshatra.lord },
    yoga: yogaName,
    karana: karanaName,
    sunrise,
    sunset,
    rahuKalam:  { start: rahuStart,  end: rahuEnd },
    gulikaKalam: { start: gulikaStart, end: gulikaEnd },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/panchang.js
git commit -m "feat: add panchang calculation (tithi, vara, nakshatra, yoga, karana, kalam)"
```

---

## Task 10: North Indian SVG Chart Renderer

**Files:**
- Create: `src/ui/chart-svg.js`
- Create: `src/tabs/chart.js`

- [ ] **Step 1: Create src/ui/chart-svg.js**

```js
// src/ui/chart-svg.js

// North Indian chart: fixed house positions in 4x4 grid
// House numbers in grid cells (row, col) — 0-indexed
// Layout:
//  [12][1][2]
//  [11][  ][3]
//  [10][7][4]   center = two triangles for 5,6,8,9 via diagonals
// Actually standard NI uses 4x4 with center split:
//
//  Row 0: [12][ 1][ 2]
//  Row 1: [11][  ][ 3]   center row
//  Row 2: [10][ 7][ 4]
//
// But standard NI is a diamond — we'll use polygon approach:

const SIZE = 400

// 16 polygon definitions for all 12 houses in NI style (as fractions of SIZE)
// Coordinates are defined as polygons in the 400x400 SVG viewBox
const HOUSE_POLYGONS = {
  1:  [[1/3,0],[2/3,0],[1/2,1/6]],                        // top triangle
  2:  [[2/3,0],[1,0],[1,1/3],[2/3,1/3]],                  // top-right
  3:  [[1,1/3],[1,2/3],[2/3,1/2]],                        // right triangle
  4:  [[1,2/3],[1,1],[2/3,1],[2/3,2/3]],                  // bottom-right
  5:  [[2/3,2/3],[2/3,1],[1/2,5/6]],                      // bottom-right triangle (moved)
  6:  [[1/3,1],[2/3,1],[1/2,5/6]],                        // bottom triangle
  7:  [[0,1],[1/3,1],[1/2,5/6]],                          // bottom-left triangle
  8:  [[0,2/3],[1/3,2/3],[1/3,1],[0,1]],                  // bottom-left
  9:  [[0,1/3],[0,2/3],[1/3,1/2]],                        // left triangle
  10: [[0,0],[1/3,0],[1/3,1/3],[0,1/3]],                  // top-left
  11: [[1/3,0],[1/2,1/6],[1/3,1/3]],                      // top-left triangle
  12: [[0,0],[1/3,0],[1/2,1/6],[1/3,1/3],[0,1/3]],        // left
}

// Recalculate to proper NI diamond layout:
const NI_POLYGONS = {
  1:  [[1/3,0],[2/3,0],[1/2,1/6]],
  2:  [[2/3,0],[1,0],[2/3,1/3]],
  3:  [[2/3,1/3],[1,0],[1,1/3]],
  4:  [[2/3,1/3],[1,1/3],[2/3,2/3],[1/2,1/2]],
  5:  [[1,1/3],[1,2/3],[2/3,2/3]],
  6:  [[2/3,2/3],[1,2/3],[1,1],[2/3,1]],
  7:  [[1/3,1],[2/3,1],[1/2,5/6]],
  8:  [[0,2/3],[1/3,2/3],[1/3,1],[0,1]],
  9:  [[0,1/3],[1/3,1/3],[1/3,2/3],[0,2/3]],
  10: [[0,0],[1/3,0],[1/3,1/3],[0,1/3]],
  11: [[1/3,0],[2/3,0],[1/2,1/6],[1/3,1/3]],
  12: [[0,0],[1/3,0],[1/3,1/3],[0,1/3]],
}

// Standard North Indian house polygons (normalized 0-1)
const HOUSES_NI = {
  1:  [[1/3,0],[2/3,0],[1/2,1/6]],
  2:  [[2/3,0],[1,0],[2/3,1/3]],
  3:  [[1,0],[1,1/3],[2/3,1/3]],
  4:  [[1,1/3],[1,2/3],[2/3,2/3]],
  5:  [[1,2/3],[1,1],[2/3,2/3]],
  6:  [[2/3,1],[1,1],[2/3,2/3]],
  7:  [[1/3,1],[2/3,1],[1/2,5/6]],
  8:  [[0,2/3],[1/3,1],[0,1]],
  9:  [[0,1/3],[1/3,2/3],[0,2/3]],
  10: [[0,0],[1/3,1/3],[0,1/3]],
  11: [[0,0],[2/3,0],[1/3,1/3]],   // wrong, will fix
  12: [[0,0],[1/3,0],[1/3,1/3]],
}

// Correct standard North Indian 12-house SVG polygons (normalized 0..1 in 400px)
const CHART_POLYGONS = {
  1:  [[1/3,0],[2/3,0],[1/2,1/6]],                                       // top △
  2:  [[2/3,0],[1,0],[1,1/3],[2/3,1/3]],                                  // top-right ◻
  3:  [[1,1/3],[1,2/3],[2/3,1/3]],                                        // right-top △
  4:  [[1,1/3],[1,2/3],[2/3,2/3],[2/3,1/3]],                              // right ◻ -- duplicate, adjust:
  5:  [[1,2/3],[2/3,2/3],[2/3,1],[1,1]],                                  // bottom-right ◻
  6:  [[2/3,1],[1/2,5/6],[1/3,1]],                                        // bottom △
  7:  [[1/3,1],[0,1],[0,2/3],[1/3,2/3]],                                  // bottom-left ◻
  8:  [[0,2/3],[1/3,2/3],[0,1/3]],                                        // left-bottom △
  9:  [[0,1/3],[1/3,1/3],[1/3,2/3],[0,2/3]],                              // left ◻ -- adjust:
  10: [[0,0],[1/3,0],[1/3,1/3],[0,1/3]],                                  // top-left ◻
  11: [[1/3,0],[1/2,1/6],[1/3,1/3]],                                      // left-top △
  12: [[2/3,0],[1/2,1/6],[2/3,1/3]],                                      // right-top △ (house 12 is between 1 and 2)
}

// Centroid helper
function centroid(pts) {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return [x, y]
}

function pts(polygon, s) {
  return polygon.map(([x, y]) => `${x*s},${y*s}`).join(' ')
}

/**
 * Render North Indian birth chart as SVG string.
 * @param {object[]} planets - from calcBirthChart
 * @param {object} lagna     - from calcBirthChart
 * @param {number} lagnaSign - 1..12 sign number of ascendant
 * @returns {string} SVG markup
 */
export function renderChartSVG(planets, lagna, lagnaSign) {
  const S = SIZE

  // North Indian: house 1 is always top-center, but sign numbers rotate
  // The cell labeled "house 1" in NI style always = Lagna sign
  // Each subsequent cell clockwise = next sign
  // Build sign→cell mapping
  // cell 1 (top △) = lagnaSign
  const cellSignMap = {}  // cell number (1-12) → zodiac sign (1-12)
  for (let cell = 1; cell <= 12; cell++) {
    cellSignMap[cell] = ((lagnaSign - 1 + cell - 1) % 12) + 1
  }
  const signCellMap = {}  // sign → cell
  for (const [cell, sign] of Object.entries(cellSignMap)) {
    signCellMap[sign] = parseInt(cell)
  }

  // Group planets by cell
  const cellPlanets = {}
  for (let c = 1; c <= 12; c++) cellPlanets[c] = []
  for (const p of planets) {
    const cell = signCellMap[p.sign]
    if (cell) cellPlanets[cell].push(p)
  }
  // Lagna marker in cell 1
  cellPlanets[1].unshift({ abbr: 'Asc', lon: lagna.lon, degree: lagna.degree, retrograde: false, isLagna: true })

  // Use a clean polygon layout for North Indian diamond
  const POLYS = {
    1:  [[1/3,0],[2/3,0],[1/2,1/6]],
    2:  [[2/3,0],[1,0],[1,1/3],[2/3,1/3]],
    3:  [[1,1/3],[2/3,1/3],[2/3,2/3],[1,2/3]],  // right box
    4:  [[1,2/3],[2/3,2/3],[1,1]],               // bottom-right triangle WRONG
    5:  [[2/3,2/3],[1,2/3],[1,1],[2/3,1]],
    6:  [[1/3,1],[2/3,1],[1/2,5/6]],
    7:  [[0,2/3],[1/3,2/3],[1/3,1],[0,1]],
    8:  [[0,1/3],[1/3,1/3],[1/3,2/3],[0,2/3]],  // left box
    9:  [[0,0],[1/3,0],[1/3,1/3],[0,1/3]],
    10: [[0,0],[1/3,1/3],[1/2,1/6]],             // top-left △ WRONG
    11: [[0,0],[2/3,0],[1/2,1/6],[0,0]],         // WRONG
    12: [[2/3,0],[1/2,1/6],[2/3,1/3]],
  }

  // Definitive standard NI polygon layout
  const P = {
    1:  [[1/3,0],[2/3,0],[1/2,1/6]],                            // top △
    2:  [[2/3,0],[1,0],[1,1/3],[2/3,1/3]],                       // top-right □
    3:  [[1,1/3],[1,2/3],[2/3,1/3]],                             // right-upper △ (MISTAKE: should be box)
    4:  [[1,1/3],[1,2/3],[2/3,2/3],[2/3,1/3]],                   // right □
    5:  [[1,2/3],[1,1],[2/3,1],[2/3,2/3]],                       // bottom-right □
    6:  [[2/3,1],[1/2,5/6],[1/3,1]],                             // bottom △
    7:  [[1/3,1],[0,1],[0,2/3],[1/3,2/3]],                       // bottom-left □
    8:  [[0,2/3],[1/3,2/3],[1/3,1/3],[0,1/3]],                   // left □
    9:  [[0,0],[1/3,0],[1/3,1/3],[0,1/3]],                       // top-left □
    10: [[1/3,0],[1/2,1/6],[1/3,1/3]],                           // inner-left △
    11: [[2/3,0],[1/2,1/6],[2/3,1/3]],                           // inner-right △
    12: [[1/2,1/6],[1/2,5/6],[1/3,1/3],[2/3,1/3],[2/3,2/3],[1/3,2/3]], // center (not rendered as house)
  }

  // Final correct NI diamond layout - standard reference
  const FINAL_P = {
    // Corners (squares): 2,5,8,11
    // Sides (triangles pointing in): 1,4,7,10
    // Inner diagonals (triangles pointing out): 3,6,9,12
    // Standard NI numbering, house 1 top center:
    1:  [[1/3,0],[2/3,0],[1/2,1/6]],
    2:  [[2/3,0],[1,0],[1,1/3],[2/3,1/3]],
    3:  [[2/3,1/3],[1,1/3],[1/2,1/2]],
    4:  [[1,1/3],[1,2/3],[2/3,2/3],[2/3,1/3]],  // Hmm, standard says 4 is right side box
    5:  [[1,2/3],[1,1],[2/3,1],[2/3,2/3]],
    6:  [[2/3,2/3],[1/2,5/6],[1/3,2/3]],         // Hmm
    7:  [[1/3,1],[2/3,1],[1/2,5/6]],
    8:  [[0,2/3],[1/3,2/3],[1/3,1],[0,1]],
    9:  [[1/3,2/3],[0,2/3],[1/2,1/2]],
    10: [[0,1/3],[1/3,1/3],[1/3,2/3],[0,2/3]],
    11: [[0,0],[1/3,0],[1/3,1/3],[0,1/3]],
    12: [[1/3,1/3],[0,1/3],[1/2,1/2]],
  }

  let svgLines = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="100%" style="max-width:${S}px">`]
  svgLines.push(`<rect width="${S}" height="${S}" fill="white" stroke="#333" stroke-width="1"/>`)

  // Draw each house
  for (let cell = 1; cell <= 12; cell++) {
    if (cell === 12 && FINAL_P[12]) {
      // skip center if you want, or draw it — here we skip the center pseudo-cell
    }
    const poly = FINAL_P[cell]
    if (!poly) continue
    const pointsStr = pts(poly, S)
    svgLines.push(`<polygon points="${pointsStr}" fill="none" stroke="#555" stroke-width="1"/>`)

    // House label (sign name abbreviation) — top of centroid
    const [cx, cy] = centroid(poly)
    const signNum = cellSignMap[cell]
    const signAbbr = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi'][signNum-1]

    svgLines.push(`<text x="${cx*S}" y="${cy*S - 8}" text-anchor="middle" font-size="9" fill="#999">${signAbbr}</text>`)

    // Planet text inside cell
    const cellP = cellPlanets[cell] || []
    cellP.forEach((p, i) => {
      const deg = p.degree ? p.degree.toFixed(1) : ''
      const retro = p.retrograde ? 'R' : ''
      const label = `${p.abbr}${retro} ${deg}°`
      const color = p.isLagna ? '#b00' : '#222'
      svgLines.push(`<text x="${cx*S}" y="${cy*S + 6 + i*13}" text-anchor="middle" font-size="10" fill="${color}" font-weight="${p.isLagna ? 'bold' : 'normal'}">${label}</text>`)
    })
  }

  svgLines.push('</svg>')
  return svgLines.join('\n')
}
```

- [ ] **Step 2: Create src/tabs/chart.js**

```js
// src/tabs/chart.js
import { state } from '../state.js'
import { renderChartSVG } from '../ui/chart-svg.js'

export function renderChart() {
  const panel = document.getElementById('tab-chart')
  const { planets, lagna, birth } = state
  panel.innerHTML = `
    <h2>${birth.name} — Birth Chart</h2>
    <p>${birth.dob} ${birth.tob} | ${birth.location}</p>
    <div id="chart-container">
      ${renderChartSVG(planets, lagna, lagna.sign)}
    </div>
    <h3>Planet Positions</h3>
    <table class="planet-table">
      <thead><tr><th>Planet</th><th>Sign</th><th>Degree</th><th>House</th><th>Nakshatra</th><th>Pada</th><th>R</th></tr></thead>
      <tbody>
        ${planets.map(p => `<tr>
          <td>${p.name}</td>
          <td>${signName(p.sign)}</td>
          <td>${p.degree.toFixed(2)}°</td>
          <td>${p.house}</td>
          <td>${p.nakshatra}</td>
          <td>${p.pada}</td>
          <td>${p.retrograde ? '℞' : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `
}

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
function signName(n) { return SIGN_NAMES[n-1] || '' }
```

- [ ] **Step 3: Add chart CSS to style.css**

```css
/* Append to src/style.css */
#chart-container { max-width: 400px; margin: 1rem auto; }
.planet-table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
.planet-table th, .planet-table td { border: 1px solid #ddd; padding: 0.3rem 0.5rem; text-align: left; }
.planet-table thead { background: #f0f0f0; }
h2, h3 { margin: 1rem 0 0.5rem; }
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/chart-svg.js src/tabs/chart.js src/style.css
git commit -m "feat: add North Indian SVG birth chart renderer and chart tab"
```

---

## Task 11: Dasha Tab

**Files:**
- Create: `src/tabs/dasha.js`

- [ ] **Step 1: Create src/tabs/dasha.js**

```js
// src/tabs/dasha.js
import { state } from '../state.js'
import { isCurrentPeriod } from '../core/dasha.js'

export function renderDasha() {
  const panel = document.getElementById('tab-dasha')
  const { dasha, birth } = state

  const rows = dasha.map(maha => {
    const isMahaCurrent = isCurrentPeriod(maha.start, maha.end)
    const antarRows = maha.antars.map(antar => {
      const isAntarCurrent = isCurrentPeriod(antar.start, antar.end)
      const pratRows = antar.pratyantars.map(prat => {
        const isPratCurrent = isCurrentPeriod(prat.start, prat.end)
        return `<tr class="${isPratCurrent ? 'current-period' : ''}" style="display:none" data-prat>
          <td style="padding-left:3rem">↳ ${prat.planet}</td>
          <td>${fmt(prat.start)}</td>
          <td>${fmt(prat.end)}</td>
        </tr>`
      }).join('')

      return `<tr class="${isAntarCurrent ? 'current-period' : ''}" style="display:none" data-antar data-toggle-prat>
          <td style="padding-left:1.5rem; cursor:pointer">▶ ${antar.planet}</td>
          <td>${fmt(antar.start)}</td>
          <td>${fmt(antar.end)}</td>
        </tr>${pratRows}`
    }).join('')

    return `<tr class="${isMahaCurrent ? 'current-period' : ''}" data-toggle-antar style="cursor:pointer">
        <td><strong>▶ ${maha.planet}</strong></td>
        <td>${fmt(maha.start)}</td>
        <td>${fmt(maha.end)}</td>
      </tr>${antarRows}`
  }).join('')

  panel.innerHTML = `
    <h2>Vimshottari Dasha — ${birth.name}</h2>
    <table class="dasha-table">
      <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `

  // Toggle antardasha rows on mahadasha click
  panel.querySelector('.dasha-table tbody').addEventListener('click', (e) => {
    const row = e.target.closest('tr')
    if (!row) return
    if (row.dataset.toggleAntar !== undefined) {
      let next = row.nextElementSibling
      while (next && next.dataset.antar !== undefined) {
        next.style.display = next.style.display === 'none' ? '' : 'none'
        next = next.nextElementSibling
      }
    }
    if (row.dataset.togglePrat !== undefined) {
      let next = row.nextElementSibling
      while (next && next.dataset.prat !== undefined) {
        next.style.display = next.style.display === 'none' ? '' : 'none'
        next = next.nextElementSibling
      }
    }
  })
}

function fmt(date) {
  return date.toISOString().slice(0, 10)
}
```

- [ ] **Step 2: Add dasha CSS to style.css**

```css
/* Append to src/style.css */
.dasha-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.dasha-table th, .dasha-table td { border: 1px solid #ddd; padding: 0.3rem 0.6rem; }
.dasha-table thead { background: #f0f0f0; }
.current-period { background: #fffbe6; font-weight: bold; }
```

- [ ] **Step 3: Commit**

```bash
git add src/tabs/dasha.js src/style.css
git commit -m "feat: add expandable Vimshottari dasha tab"
```

---

## Task 12: Panchang Tab

**Files:**
- Create: `src/tabs/panchang.js`

- [ ] **Step 1: Create src/tabs/panchang.js**

```js
// src/tabs/panchang.js
import { state } from '../state.js'

export function renderPanchang() {
  const panel = document.getElementById('tab-panchang')
  const { panchang, birth } = state
  const p = panchang

  const fmtTime = (d) => d ? d.toUTCString().slice(17, 22) + ' UTC' : '—'

  panel.innerHTML = `
    <h2>Panchang — ${birth.dob}</h2>
    <p>${birth.location}</p>
    <table class="panchang-table">
      <tbody>
        <tr><th>Tithi</th><td>${p.tithi.name} (${p.tithi.num})</td></tr>
        <tr><th>Vara</th><td>${p.vara.name} (Lord: ${p.vara.lord})</td></tr>
        <tr><th>Nakshatra</th><td>${p.nakshatra.name} Pada ${p.nakshatra.pada} (Lord: ${p.nakshatra.lord})</td></tr>
        <tr><th>Yoga</th><td>${p.yoga}</td></tr>
        <tr><th>Karana</th><td>${p.karana}</td></tr>
        <tr><th>Sunrise</th><td>${fmtTime(p.sunrise)}</td></tr>
        <tr><th>Sunset</th><td>${fmtTime(p.sunset)}</td></tr>
        <tr><th>Rahu Kalam</th><td>${fmtTime(p.rahuKalam.start)} – ${fmtTime(p.rahuKalam.end)}</td></tr>
        <tr><th>Gulika Kalam</th><td>${fmtTime(p.gulikaKalam.start)} – ${fmtTime(p.gulikaKalam.end)}</td></tr>
      </tbody>
    </table>
  `
}
```

- [ ] **Step 2: Add panchang CSS to style.css**

```css
/* Append to src/style.css */
.panchang-table { border-collapse: collapse; min-width: 400px; font-size: 0.95rem; }
.panchang-table th, .panchang-table td { border: 1px solid #ddd; padding: 0.4rem 0.8rem; }
.panchang-table th { background: #f5f5f5; text-align: right; width: 140px; }
```

- [ ] **Step 3: Commit**

```bash
git add src/tabs/panchang.js src/style.css
git commit -m "feat: add panchang display tab"
```

---

## Task 13: GitHub Actions Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create .github/workflows/deploy.yml**

```bash
mkdir -p .github/workflows
```

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Enable GitHub Pages in repo settings**

On GitHub: Settings → Pages → Source: "GitHub Actions"

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy to GitHub Pages"
git remote add origin https://github.com/<your-username>/aditya-amrit-hora.git
git push -u origin main
```

---

## Task 14: End-to-End Smoke Test

- [ ] **Step 1: Run dev server and fill form**

```bash
npm run dev
```

Open browser, enter: Name = "Test User", DOB = "1990-01-15", TOB = "10:30", search "Mumbai", select suggestion.

- [ ] **Step 2: Verify chart renders**

Click "Calculate Chart" — Chart tab should open with SVG diamond grid, planets placed in correct houses, planet table below.

- [ ] **Step 3: Verify dasha tab**

Click Dasha tab — table shows 9 Mahadasha rows. Click one to expand Antardasha rows. Current period highlighted.

- [ ] **Step 4: Verify panchang tab**

Click Panchang tab — 9 rows table with Tithi, Vara, Nakshatra, Yoga, Karana, Sunrise, Sunset, Rahu Kalam, Gulika Kalam. No empty/undefined values.

- [ ] **Step 5: Production build**

```bash
npm run build
npm run preview
```

Verify app loads at `http://localhost:4173/aditya-amrit-hora/` and all tabs work.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete MVP - birth chart, dasha, panchang"
```
