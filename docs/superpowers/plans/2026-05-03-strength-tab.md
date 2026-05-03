# Strength Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Strength" tab with three sub-tabs — Ashtakavarga, Shadbala, and Bar Graph — computed at chart calculation time and stored in `state.strength`.

**Architecture:** Two new core modules (`ashtakavarga.js`, `shadbala.js`) compute data; one new tab module (`strength.js`) renders three sub-tabs. Wired into the existing input.js compute pipeline alongside chart/dasha/panchang.

**Tech Stack:** Vanilla JS, existing `calcDivisional` from `src/core/divisional.js`, existing CSS patterns (`.planet-table`, `.chart-style-btn`), inline SVG for bar graph.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/core/calculations.js` | Add `speed` field to planet objects |
| Modify | `src/state.js` | Add `strength: null` |
| Modify | `index.html` | Add Strength tab button + panel |
| Modify | `src/ui/tabs.js` | Handle `strength` tab in click + swipe |
| Create | `src/tabs/strength.js` | `renderStrength()` with 3 sub-tabs |
| Create | `src/core/ashtakavarga.js` | Bhinnashtakavarga + Sarvashtakavarga |
| Create | `src/core/shadbala.js` | Shadbala 6 components |
| Modify | `src/tabs/input.js` | Compute + store `state.strength` (2 places) |
| Modify | `src/style.css` | Strength tab sub-tab + table styles |

---

## Task 1: Add `speed` to planet objects

Chesta Bala needs actual planet speed. Currently only `retrograde: boolean` is stored.

**Files:**
- Modify: `src/core/calculations.js`

- [ ] **Step 1: Add `speed` to the returned planet object**

In `src/core/calculations.js`, the `rawPlanets` map around line 67–84 has `speed` as a local variable. Add it to the returned object:

```js
// Before (line ~83):
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

// After — add speed field:
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
  speed,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/calculations.js
git commit -m "feat: store planet speed in chart calc output"
```

---

## Task 2: Scaffold Strength tab

**Files:**
- Modify: `src/state.js`
- Modify: `index.html`
- Modify: `src/ui/tabs.js`
- Create: `src/tabs/strength.js`

- [ ] **Step 1: Add `strength` to state**

In `src/state.js`, add `strength: null` to the exported state object:

```js
export const state = {
  birth: null,
  planets: null,
  lagna: null,
  houses: null,
  dasha: null,
  panchang: null,
  strength: null,   // { bhinna, sarva, shadbala }
}
```

- [ ] **Step 2: Add tab button and panel to index.html**

```html
<!-- In <nav id="tab-nav">, after the panchang button: -->
<button data-tab="strength" class="tab-btn" disabled>Strength</button>
```

```html
<!-- In <main>, after <section id="tab-panchang">: -->
<section id="tab-strength" class="tab-panel"></section>
```

- [ ] **Step 3: Wire strength into tabs.js**

In `src/ui/tabs.js`, add `'strength'` to `TAB_ORDER`:

```js
const TAB_ORDER = ['input', 'chart', 'dasha', 'panchang', 'strength']
```

Add the `strength` case to the click handler (inside the `if/else if` chain after `panchang`):

```js
} else if (name === 'strength') {
  const { renderStrength } = await import('../tabs/strength.js')
  renderStrength()
}
```

Add the same case to the `touchend` handler (inside its `if/else if` chain after `panchang`):

```js
} else if (nextTab === 'strength') {
  const { renderStrength } = await import('../tabs/strength.js')
  renderStrength()
}
```

- [ ] **Step 4: Create stub strength.js**

Create `src/tabs/strength.js`:

```js
// src/tabs/strength.js
import { state } from '../state.js'

let activeSubTab = 'ashtakavarga'

export function renderStrength() {
  const el = document.getElementById('tab-strength')
  if (!el) return
  if (!state.strength) {
    el.innerHTML = '<p class="panchang-empty">Calculate a birth chart first.</p>'
    return
  }
  el.innerHTML = `
    <div class="strength-wrap">
      <div class="strength-subtab-bar">
        <button class="chart-style-btn${activeSubTab === 'ashtakavarga' ? ' active' : ''}" data-subtab="ashtakavarga">Ashtakavarga</button>
        <button class="chart-style-btn${activeSubTab === 'shadbala' ? ' active' : ''}" data-subtab="shadbala">Shadbala</button>
        <button class="chart-style-btn${activeSubTab === 'bargraph' ? ' active' : ''}" data-subtab="bargraph">Bar Graph</button>
      </div>
      <div id="strength-panel"></div>
    </div>
  `
  el.querySelectorAll('.chart-style-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.subtab
      renderStrength()
    })
  })
  renderSubTab()
}

function renderSubTab() {
  const panel = document.getElementById('strength-panel')
  if (!panel) return
  if (activeSubTab === 'ashtakavarga') panel.innerHTML = '<p style="padding:1rem">Ashtakavarga coming soon.</p>'
  else if (activeSubTab === 'shadbala') panel.innerHTML = '<p style="padding:1rem">Shadbala coming soon.</p>'
  else panel.innerHTML = '<p style="padding:1rem">Bar Graph coming soon.</p>'
}
```

- [ ] **Step 5: Commit**

```bash
git add src/state.js index.html src/ui/tabs.js src/tabs/strength.js
git commit -m "feat: scaffold Strength tab with sub-tab navigation"
```

---

## Task 3: Implement Ashtakavarga (`src/core/ashtakavarga.js`)

**Files:**
- Create: `src/core/ashtakavarga.js`

- [ ] **Step 1: Create the file with benefic tables and both export functions**

```js
// src/core/ashtakavarga.js

// Parashari Bhinnashtakavarga benefic house tables.
// Key = planet being analysed. Value = map of contributor → 1-indexed house list.
const BHINNA_TABLES = {
  Sun: {
    Sun:     [1,2,4,7,8,9,10,11],
    Moon:    [3,6,10,11],
    Mars:    [1,2,4,7,8,9,10,11],
    Mercury: [3,5,6,9,10,11,12],
    Jupiter: [5,6,9,11],
    Venus:   [6,7,12],
    Saturn:  [1,2,4,7,8,9,10,11],
    Lagna:   [1,2,4,7,8,9,10,11],
  },
  Moon: {
    Sun:     [3,6,7,8,10,11],
    Moon:    [1,3,6,7,10,11],
    Mars:    [2,3,5,6,9,10,11],
    Mercury: [1,3,4,5,7,8,10,11],
    Jupiter: [1,4,7,8,10,11],
    Venus:   [3,4,5,7,9,10,11],
    Saturn:  [3,5,6,11],
    Lagna:   [3,6,10,11],
  },
  Mars: {
    Sun:     [3,5,6,10,11],
    Moon:    [3,6,11],
    Mars:    [1,2,4,7,8,10,11],
    Mercury: [3,5,6,11],
    Jupiter: [6,10,11,12],
    Venus:   [6,8,11,12],
    Saturn:  [1,4,7,8,9,10,11],
    Lagna:   [1,2,4,7,8,10,11],
  },
  Mercury: {
    Sun:     [5,6,9,11,12],
    Moon:    [2,4,6,8,10,11],
    Mars:    [1,2,4,7,8,9,10,11],
    Mercury: [1,3,5,6,9,10,11,12],
    Jupiter: [6,8,11,12],
    Venus:   [1,2,3,4,5,8,9,11],
    Saturn:  [1,2,4,7,8,9,10,11],
    Lagna:   [1,2,4,7,8,10,11],
  },
  Jupiter: {
    Sun:     [1,2,3,4,7,8,9,10,11],
    Moon:    [2,5,7,9,11],
    Mars:    [1,2,4,7,8,10,11],
    Mercury: [1,2,4,5,6,9,10,11],
    Jupiter: [1,2,3,4,7,8,10,11],
    Venus:   [2,5,6,9,10,11],
    Saturn:  [3,5,6,12],
    Lagna:   [1,2,4,7,8,10,11],
  },
  Venus: {
    Sun:     [8,11,12],
    Moon:    [1,2,3,4,5,8,9,11,12],
    Mars:    [3,4,6,9,11,12],
    Mercury: [3,5,6,9,11],
    Jupiter: [5,8,9,10,11],
    Venus:   [1,2,3,4,5,8,9,10,11],
    Saturn:  [3,4,5,8,9,10,11],
    Lagna:   [1,2,3,4,5,8,9,11],
  },
  Saturn: {
    Sun:     [1,2,4,7,8,10,11],
    Moon:    [3,6,11],
    Mars:    [1,4,7,8,9,10,11],
    Mercury: [6,8,9,10,11,12],
    Jupiter: [5,6,11,12],
    Venus:   [6,11,12],
    Saturn:  [1,2,4,7,8,9,10,11],
    Lagna:   [1,3,4,6,10,11],
  },
}

const CONTRIBUTORS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Lagna']

/**
 * @param {object[]} planets  state.planets
 * @param {object}   lagna    state.lagna
 * @returns {{ Sun: number[], Moon: number[], ..., Saturn: number[] }}
 *   Each array has 12 elements: score per sign index 0–11 (Aries=0 … Pisces=11), range 0–8.
 */
export function calcBhinnashtakavarga(planets, lagna) {
  const planetMap = Object.fromEntries(planets.map(p => [p.name, p]))

  const result = {}
  for (const planet of Object.keys(BHINNA_TABLES)) {
    const scores = new Array(12).fill(0)
    const table = BHINNA_TABLES[planet]
    for (const contrib of CONTRIBUTORS) {
      const contribSign0 = contrib === 'Lagna'
        ? lagna.sign - 1
        : (planetMap[contrib]?.sign ?? 1) - 1  // 0-indexed
      for (const h of table[contrib]) {
        const targetSign0 = (contribSign0 + h - 1) % 12
        scores[targetSign0]++
      }
    }
    result[planet] = scores
  }
  return result
}

/**
 * @param {{ [planet: string]: number[] }} bhinna  output of calcBhinnashtakavarga
 * @returns {number[]} 12 scores (Aries…Pisces), range 0–56
 */
export function calcSarvashtakavarga(bhinna) {
  const sarva = new Array(12).fill(0)
  for (const scores of Object.values(bhinna)) {
    for (let i = 0; i < 12; i++) sarva[i] += scores[i]
  }
  return sarva
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/ashtakavarga.js
git commit -m "feat: implement Bhinnashtakavarga and Sarvashtakavarga"
```

---

## Task 4: Implement Shadbala (`src/core/shadbala.js`)

**Files:**
- Create: `src/core/shadbala.js`

- [ ] **Step 1: Create the file**

```js
// src/core/shadbala.js
import { calcDivisional } from './divisional.js'
import { jdToDate } from '../utils/time.js'

const SHADBALA_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

// Ecliptic longitude of exact exaltation point
const EXALT_LON = { Sun: 10, Moon: 33, Mars: 298, Mercury: 165, Jupiter: 95, Venus: 357, Saturn: 200 }

// Own signs (1-indexed sign numbers)
const OWN_SIGNS = {
  Sun: [5], Moon: [4], Mars: [1, 8], Mercury: [3, 6],
  Jupiter: [9, 12], Venus: [2, 7], Saturn: [10, 11],
}

// Moolatrikona sign (takes precedence over own-sign check)
const MOOLA_SIGN = { Sun: 5, Moon: 2, Mars: 1, Mercury: 6, Jupiter: 9, Venus: 7, Saturn: 11 }

// Sign ruler (1-indexed sign → planet name)
const SIGN_RULER = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
]

// Permanent friendship
const PERM_FRIENDS = {
  Sun: ['Moon', 'Mars', 'Jupiter'],
  Moon: ['Sun', 'Mercury'],
  Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'],
  Jupiter: ['Sun', 'Moon', 'Mars'],
  Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus'],
}
const PERM_ENEMIES = {
  Sun: ['Venus', 'Saturn'],
  Moon: [],
  Mars: ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'],
  Venus: ['Sun', 'Moon'],
  Saturn: ['Sun', 'Moon', 'Mars'],
}

function getDignity(planetName, sign) {
  if (MOOLA_SIGN[planetName] === sign) return 'moolatrikona'
  if (OWN_SIGNS[planetName].includes(sign)) return 'own'
  const ruler = SIGN_RULER[sign - 1]
  if (PERM_FRIENDS[planetName].includes(ruler)) return 'friend'
  if (PERM_ENEMIES[planetName].includes(ruler)) return 'enemy'
  return 'neutral'
}

const DIGNITY_PTS = { moolatrikona: 45, own: 30, friend: 15, neutral: 7.5, enemy: 3.75 }
const VARGA_KEYS = ['D1', 'D2', 'D3', 'D7', 'D9', 'D12', 'D30']

// ── Sthana Bala helpers ────────────────────────────────────────────────────────

function uchaBala(planetName, lon) {
  const exalt = EXALT_LON[planetName]
  if (exalt === undefined) return 0
  const debil = (exalt + 180) % 360
  // Angular distance from exaltation
  const dist = Math.abs(((lon - exalt + 540) % 360) - 180)
  return 60 * (1 - dist / 180)
}

function saptaVargajaBala(planetName, planets, lagna) {
  let total = 0
  for (const key of VARGA_KEYS) {
    const { planets: dPlanets } = calcDivisional(planets, lagna, key)
    const dp = dPlanets.find(p => p.name === planetName)
    total += DIGNITY_PTS[getDignity(planetName, dp.sign)]
  }
  return total
}

function ojayugmaBala(planetName, d1Sign, d9Sign) {
  function pref(sign) {
    const isOdd = sign % 2 === 1
    if (['Sun', 'Mars', 'Jupiter', 'Saturn'].includes(planetName)) return isOdd ? 15 : 0
    if (['Moon', 'Venus'].includes(planetName)) return isOdd ? 0 : 15
    return 15 // Mercury always gets 15
  }
  return pref(d1Sign) + pref(d9Sign) / 2
}

function kendradiBala(house) {
  if ([1, 4, 7, 10].includes(house)) return 60
  if ([2, 5, 8, 11].includes(house)) return 30
  return 15
}

const DREKKANA_GENDER = {
  Sun: 'male', Mars: 'male', Jupiter: 'male',
  Moon: 'female', Venus: 'female',
  Mercury: 'neutral', Saturn: 'neutral',
}

function drekkanaBala(planetName, degree) {
  const part = Math.floor((degree % 30) / 10)  // 0=first, 1=second, 2=third drekkana
  const g = DREKKANA_GENDER[planetName]
  if (g === 'male' && part === 0) return 15
  if (g === 'female' && part === 2) return 15
  if (g === 'neutral' && part === 1) return 15
  return 0
}

function sthanaBala(planet, planets, lagna) {
  const { planets: d9Planets } = calcDivisional(planets, lagna, 'D9')
  const d9Planet = d9Planets.find(p => p.name === planet.name)
  return (
    uchaBala(planet.name, planet.lon) +
    saptaVargajaBala(planet.name, planets, lagna) +
    ojayugmaBala(planet.name, planet.sign, d9Planet.sign) +
    kendradiBala(planet.house) +
    drekkanaBala(planet.name, planet.degree)
  )
}

// ── Dig Bala ──────────────────────────────────────────────────────────────────

const DIG_BEST = { Sun: 10, Mars: 10, Moon: 4, Venus: 4, Mercury: 1, Jupiter: 1, Saturn: 7 }

function digBala(planetName, house) {
  const best = DIG_BEST[planetName]
  const dist = Math.min(Math.abs(house - best), 12 - Math.abs(house - best))
  return 60 * (1 - dist / 6)
}

// ── Kala Bala ─────────────────────────────────────────────────────────────────

function nathonnathaBala(planetName, isDayBirth) {
  if (planetName === 'Mercury') return 60
  if (['Sun', 'Jupiter', 'Venus'].includes(planetName)) return isDayBirth ? 60 : 0
  return isDayBirth ? 0 : 60  // Moon, Mars, Saturn
}

function pakshaBala(planetName, planets) {
  const moon = planets.find(p => p.name === 'Moon')
  const sun  = planets.find(p => p.name === 'Sun')
  const phase = ((moon.lon - sun.lon) + 360) % 360  // 0=new moon, 180=full moon

  if (planetName === 'Moon') {
    return phase <= 180 ? phase / 3 : (360 - phase) / 3
  }
  const waxing = phase <= 180
  if (['Mercury', 'Jupiter', 'Venus'].includes(planetName)) {
    return waxing ? phase / 3 : (360 - phase) / 3
  }
  // Sun, Mars, Saturn (malefics): max at new moon
  return waxing ? (180 - phase) / 3 : (phase - 180) / 3
}

function ayanaBala(planetName, planet) {
  if (planetName === 'Mercury') return 30
  // Approximate tropical longitude: sidereal + ~24° ayanamsa
  const tropLon = (planet.lon + 24) % 360
  const obliqRad = 23.45 * Math.PI / 180
  const lonRad = tropLon * Math.PI / 180
  const decl = Math.asin(Math.sin(obliqRad) * Math.sin(lonRad)) * 180 / Math.PI
  // Normalise to 0-60 range; north-preferring planets score higher in northern declination
  const northPrefer = ['Sun', 'Mars', 'Jupiter', 'Venus']
  const factor = northPrefer.includes(planetName) ? 1 : -1
  return 30 + factor * 30 * (decl / 23.45)
}

function kalaBala(planetName, planet, planets, jd, panchang) {
  let isDayBirth = true
  if (panchang?.sunrise && panchang?.sunset) {
    const birthDate = jdToDate(jd)
    isDayBirth = birthDate >= panchang.sunrise && birthDate < panchang.sunset
  }
  return (
    nathonnathaBala(planetName, isDayBirth) +
    pakshaBala(planetName, planets) +
    ayanaBala(planetName, planet)
  )
}

// ── Chesta Bala ───────────────────────────────────────────────────────────────

const MEAN_SPEED = { Mars: 0.524, Mercury: 1.383, Jupiter: 0.083, Venus: 1.2, Saturn: 0.033 }

function chestaBala(planetName, planet) {
  // Sun and Moon use Ayana Bala as their Chesta Bala
  if (planetName === 'Sun' || planetName === 'Moon') return ayanaBala(planetName, planet)
  if (planet.retrograde) return 60
  const spd = Math.abs(planet.speed ?? 0)
  if (spd < 0.083) return 30  // stationary (less than ~1/12 degree per day)
  return spd >= (MEAN_SPEED[planetName] ?? 1) ? 45 : 15
}

// ── Naisargika Bala (fixed) ───────────────────────────────────────────────────

const NAISARGIKA = {
  Sun: 60, Moon: 51.43, Venus: 42.86, Jupiter: 34.28,
  Mercury: 25.71, Mars: 17.14, Saturn: 8.57,
}

// ── Drik Bala ─────────────────────────────────────────────────────────────────

// 0-indexed house offsets from caster that each planet aspects
const ASPECT_OFFSETS = {
  Sun:     [6],
  Moon:    [6],
  Mars:    [3, 6, 7],    // 4th, 7th, 8th house
  Mercury: [6],
  Jupiter: [4, 6, 8],   // 5th, 7th, 9th house
  Venus:   [6],
  Saturn:  [2, 6, 9],   // 3rd, 7th, 10th house
}

// Aspect strength for each 0-indexed house offset
const ASPECT_STRENGTH = { 2: 0.25, 3: 0.5, 4: 0.75, 6: 1.0, 7: 0.5, 8: 0.75, 9: 0.25 }

const BENEFICS = new Set(['Moon', 'Mercury', 'Jupiter', 'Venus'])
const MALEFICS = new Set(['Sun', 'Mars', 'Saturn'])

function drikBala(targetName, planets) {
  const target = planets.find(p => p.name === targetName)
  let total = 0
  for (const caster of planets) {
    if (caster.name === targetName) continue
    if (!SHADBALA_PLANETS.includes(caster.name)) continue
    const relOffset = (target.house - caster.house + 12) % 12  // 0-11
    const offsets = ASPECT_OFFSETS[caster.name] ?? [6]
    if (!offsets.includes(relOffset)) continue
    const strength = ASPECT_STRENGTH[relOffset] ?? 0
    if (BENEFICS.has(caster.name)) total += 15 * strength
    if (MALEFICS.has(caster.name)) total -= 15 * strength
  }
  return total / 2
}

// ── Required minimums ─────────────────────────────────────────────────────────

const REQUIRED = {
  Sun: 390, Moon: 360, Mars: 300, Mercury: 420,
  Jupiter: 390, Venus: 330, Saturn: 300,
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {object[]} planets   state.planets
 * @param {object}   lagna     state.lagna
 * @param {number[]} houses    state.houses (unused currently, reserved)
 * @param {number}   jd        Julian Day of birth (UT)
 * @param {object}   panchang  state.panchang (for sunrise/sunset)
 * @returns {{ [planet: string]: { sthanaBala, digBala, kalaBala, chestaBala, naisargikaBala, drikBala, total, required, ratio } }}
 */
export function calcShadbala(planets, lagna, houses, jd, panchang) {
  const result = {}
  for (const name of SHADBALA_PLANETS) {
    const planet = planets.find(p => p.name === name)
    if (!planet) continue
    const sb  = sthanaBala(planet, planets, lagna)
    const db  = digBala(name, planet.house)
    const kb  = kalaBala(name, planet, planets, jd, panchang)
    const cb  = chestaBala(name, planet)
    const nb  = NAISARGIKA[name]
    const drb = drikBala(name, planets)
    const total = sb + db + kb + cb + nb + drb
    const req   = REQUIRED[name]
    result[name] = {
      sthanaBala:    Math.round(sb  * 10) / 10,
      digBala:       Math.round(db  * 10) / 10,
      kalaBala:      Math.round(kb  * 10) / 10,
      chestaBala:    Math.round(cb  * 10) / 10,
      naisargikaBala: Math.round(nb * 10) / 10,
      drikBala:      Math.round(drb * 10) / 10,
      total:         Math.round(total * 10) / 10,
      required:      req,
      ratio:         Math.round((total / req) * 100) / 100,
    }
  }
  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/shadbala.js
git commit -m "feat: implement Shadbala (6 components)"
```

---

## Task 5: Wire compute into input.js

Two places need updating: the form submit handler (around line 519) and `recalcAll()` (around line 622).

**Files:**
- Modify: `src/tabs/input.js`

- [ ] **Step 1: Add imports at top of input.js**

At the top of `src/tabs/input.js`, add two new imports alongside the existing core imports:

```js
import { calcBhinnashtakavarga, calcSarvashtakavarga } from '../core/ashtakavarga.js'
import { calcShadbala } from '../core/shadbala.js'
```

- [ ] **Step 2: Compute strength in the form submit handler**

Find the block where `state.panchang = panchang` is set (around line 532). Add the strength computation immediately after:

```js
state.planets  = planets
state.lagna    = lagna
state.houses   = houses
state.dasha    = dasha
state.panchang = panchang

// Compute strength
const bhinna = calcBhinnashtakavarga(planets, lagna)
const sarva  = calcSarvashtakavarga(bhinna)
const shadbala = calcShadbala(planets, lagna, houses, jd, panchang)
state.strength = { bhinna, sarva, shadbala }
```

Also add `enableTab('strength')` and `renderStrength()` in the same block where other tabs are enabled (around line 545):

```js
const { renderStrength } = await import('./strength.js')
renderStrength()
enableTab('chart'); enableTab('dasha'); enableTab('panchang'); enableTab('strength')
```

- [ ] **Step 3: Compute strength in recalcAll()**

Find the same `state.panchang = panchang` block in `recalcAll()` (around line 637). Add identical strength computation:

```js
state.planets  = planets
state.lagna    = lagna
state.houses   = houses
state.dasha    = dasha
state.panchang = panchang

const bhinna = calcBhinnashtakavarga(planets, lagna)
const sarva  = calcSarvashtakavarga(bhinna)
const shadbala = calcShadbala(planets, lagna, houses, jd, panchang)
state.strength = { bhinna, sarva, shadbala }
```

Also add `renderStrength()` call in `recalcAll()` alongside the other render calls:

```js
const { renderChart }    = await import('./chart.js')
const { renderDasha }    = await import('./dasha.js')
const { renderPanchang } = await import('./panchang.js')
const { renderStrength } = await import('./strength.js')

renderChart(); renderDasha().catch(console.error); renderPanchang(); renderStrength()
```

- [ ] **Step 4: Verify in browser**

Run `npm run dev`, open http://localhost:5173/hora-prakash/, calculate a chart, click Strength tab. Should show sub-tab buttons with "coming soon" placeholder text. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/input.js
git commit -m "feat: compute and store state.strength on chart calculation"
```

---

## Task 6: Render Ashtakavarga sub-tab

**Files:**
- Modify: `src/tabs/strength.js`
- Modify: `src/style.css`

- [ ] **Step 1: Add CSS for strength tab**

In `src/style.css`, add at the end of the file:

```css
/* ── Strength tab ── */
.strength-wrap { padding: 1rem; }
.strength-subtab-bar { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.avarga-table-grid { display: grid; gap: 1.5rem; margin-bottom: 1.5rem; }
.avarga-section h4 { font-size: 0.85rem; font-weight: 600; color: var(--muted); margin: 0 0 0.4rem; text-transform: uppercase; letter-spacing: 0.04em; }
.avarga-row { display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; }
.avarga-row.header .avarga-cell { background: var(--primary); color: var(--primary-text); font-weight: 600; border-radius: 4px 4px 0 0; }
.avarga-cell { text-align: center; padding: 0.25rem 0; font-size: 0.8rem; border: 1px solid var(--border); min-width: 0; }
.avarga-cell.own-sign { background: #fef9c3; font-weight: 700; }
.avarga-cell.score-high { background: #dcfce7; }
.avarga-cell.score-low  { background: #fee2e2; }
.avarga-sarva { border-top: 2px solid var(--primary); margin-top: 0.5rem; }
.avarga-sarva .avarga-cell { background: #eff6ff; font-weight: 600; }
@media (max-width: 640px) {
  .avarga-cell { font-size: 0.68rem; padding: 0.15rem 0; }
}
```

- [ ] **Step 2: Implement `renderAshtakavarga` function in strength.js**

Replace the stub content in `src/tabs/strength.js` by adding a `renderAshtakavarga` function and wiring it into `renderSubTab`:

```js
// src/tabs/strength.js
import { state } from '../state.js'

const SIGN_ABBR = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']
const PLANETS_ORDER = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']

let activeSubTab = 'ashtakavarga'

export function renderStrength() {
  const el = document.getElementById('tab-strength')
  if (!el) return
  if (!state.strength) {
    el.innerHTML = '<p class="panchang-empty">Calculate a birth chart first.</p>'
    return
  }
  el.innerHTML = `
    <div class="strength-wrap">
      <div class="strength-subtab-bar">
        <button class="chart-style-btn${activeSubTab === 'ashtakavarga' ? ' active' : ''}" data-subtab="ashtakavarga">Ashtakavarga</button>
        <button class="chart-style-btn${activeSubTab === 'shadbala' ? ' active' : ''}" data-subtab="shadbala">Shadbala</button>
        <button class="chart-style-btn${activeSubTab === 'bargraph' ? ' active' : ''}" data-subtab="bargraph">Bar Graph</button>
      </div>
      <div id="strength-panel"></div>
    </div>
  `
  el.querySelectorAll('.chart-style-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.subtab
      renderStrength()
    })
  })
  renderSubTab()
}

function renderSubTab() {
  const panel = document.getElementById('strength-panel')
  if (!panel) return
  if (activeSubTab === 'ashtakavarga') renderAshtakavarga(panel)
  else if (activeSubTab === 'shadbala') panel.innerHTML = '<p style="padding:1rem">Shadbala coming soon.</p>'
  else panel.innerHTML = '<p style="padding:1rem">Bar Graph coming soon.</p>'
}

function renderAshtakavarga(panel) {
  const { bhinna, sarva } = state.strength
  // Get each planet's own sign (0-indexed) for highlighting
  const planetMap = Object.fromEntries(state.planets.map(p => [p.name, p]))

  const sections = PLANETS_ORDER.map(pname => {
    const scores = bhinna[pname]
    const ownSign0 = (planetMap[pname]?.sign ?? 1) - 1
    const total = scores.reduce((a, b) => a + b, 0)
    const headerCells = SIGN_ABBR.map(s => `<div class="avarga-cell">${s}</div>`).join('')
    const scoreCells = scores.map((s, i) => {
      let cls = 'avarga-cell'
      if (i === ownSign0) cls += ' own-sign'
      else if (s >= 6) cls += ' score-high'
      else if (s <= 2) cls += ' score-low'
      return `<div class="${cls}">${s}</div>`
    }).join('')
    return `
      <div class="avarga-section">
        <h4>${pname} Bhinnashtakavarga (total ${total})</h4>
        <div class="avarga-row header">${headerCells}</div>
        <div class="avarga-row">${scoreCells}</div>
      </div>
    `
  }).join('')

  // Sarvashtakavarga row
  const sarvaTotal = sarva.reduce((a, b) => a + b, 0)
  const sarvaCells = sarva.map(s => {
    let cls = 'avarga-cell'
    if (s >= 30) cls += ' score-high'
    else if (s <= 18) cls += ' score-low'
    return `<div class="${cls}">${s}</div>`
  }).join('')

  panel.innerHTML = `
    <div class="avarga-table-grid">
      ${sections}
      <div class="avarga-section avarga-sarva">
        <h4>Sarvashtakavarga (total ${sarvaTotal})</h4>
        <div class="avarga-row header">${SIGN_ABBR.map(s => `<div class="avarga-cell">${s}</div>`).join('')}</div>
        <div class="avarga-row">${sarvaCells}</div>
      </div>
    </div>
  `
}
```

- [ ] **Step 3: Verify in browser**

Calculate a chart, open Strength → Ashtakavarga. Should show 7 planet tables + 1 sarva row, each with 12 score cells. Own sign highlighted yellow. High scores green, low scores red.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/strength.js src/style.css
git commit -m "feat: render Ashtakavarga sub-tab"
```

---

## Task 7: Render Shadbala sub-tab

**Files:**
- Modify: `src/tabs/strength.js`
- Modify: `src/style.css`

- [ ] **Step 1: Add Shadbala table CSS**

Append to the `/* ── Strength tab ── */` section in `src/style.css`:

```css
.shadbala-wrap .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.shadbala-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 640px; }
.shadbala-table th { background: var(--primary); color: var(--primary-text); padding: 0.4rem 0.6rem; text-align: right; font-weight: 600; white-space: nowrap; }
.shadbala-table th:first-child { text-align: left; }
.shadbala-table td { padding: 0.35rem 0.6rem; text-align: right; border-bottom: 1px solid var(--border); }
.shadbala-table td:first-child { text-align: left; font-weight: 500; }
.shadbala-table td.total-col { font-weight: 700; }
.shadbala-table tr.ratio-strong td { background: #f0fdf4; }
.shadbala-table tr.ratio-weak   td { background: #fff7f7; }
.shadbala-table tr.ratio-low    td { background: #fef2f2; }
.ratio-strong .ratio-val { color: #16a34a; font-weight: 700; }
.ratio-weak   .ratio-val { color: #d97706; font-weight: 700; }
.ratio-low    .ratio-val { color: #dc2626; font-weight: 700; }
```

- [ ] **Step 2: Add `renderShadbala` function to strength.js and wire it**

Add the function and update `renderSubTab`:

```js
function renderSubTab() {
  const panel = document.getElementById('strength-panel')
  if (!panel) return
  if (activeSubTab === 'ashtakavarga') renderAshtakavarga(panel)
  else if (activeSubTab === 'shadbala') renderShadbala(panel)
  else renderBarGraph(panel)
}

function renderShadbala(panel) {
  const { shadbala } = state.strength
  const rows = PLANETS_ORDER.map(name => {
    const d = shadbala[name]
    if (!d) return ''
    const ratioClass = d.ratio >= 1.0 ? 'ratio-strong' : d.ratio >= 0.8 ? 'ratio-weak' : 'ratio-low'
    return `
      <tr class="${ratioClass}">
        <td>${name}</td>
        <td>${d.sthanaBala}</td>
        <td>${d.digBala}</td>
        <td>${d.kalaBala}</td>
        <td>${d.chestaBala}</td>
        <td>${d.naisargikaBala}</td>
        <td>${d.drikBala}</td>
        <td class="total-col">${d.total}</td>
        <td>${d.required}</td>
        <td class="ratio-val">${d.ratio.toFixed(2)}×</td>
      </tr>
    `
  }).join('')

  panel.innerHTML = `
    <div class="shadbala-wrap">
      <div class="table-scroll">
        <table class="shadbala-table">
          <thead>
            <tr>
              <th>Planet</th><th>Sthana</th><th>Dig</th><th>Kala</th>
              <th>Chesta</th><th>Naisargika</th><th>Drik</th>
              <th>Total</th><th>Required</th><th>Ratio</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `
}
```

Replace `panel.innerHTML = '<p style="padding:1rem">Bar Graph coming soon.</p>'` in `renderSubTab` with `renderBarGraph(panel)`, and add a stub:

```js
function renderBarGraph(panel) {
  panel.innerHTML = '<p style="padding:1rem">Bar Graph coming soon.</p>'
}
```

- [ ] **Step 3: Verify in browser**

Strength → Shadbala. Should show table with 7 planet rows × 10 columns. Rows colored green/amber/red by ratio. Numbers should look reasonable (Sthana Bala 100–350 range, totals 300–700 range).

- [ ] **Step 4: Commit**

```bash
git add src/tabs/strength.js src/style.css
git commit -m "feat: render Shadbala sub-tab with 6-component table"
```

---

## Task 8: Render Bar Graph sub-tab

**Files:**
- Modify: `src/tabs/strength.js`
- Modify: `src/style.css`

- [ ] **Step 1: Add bar graph CSS**

Append to the strength section in `src/style.css`:

```css
.bargraph-wrap { padding: 0.5rem 0; }
.bargraph-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.6rem; }
.bargraph-label { width: 5rem; font-size: 0.82rem; font-weight: 500; text-align: right; flex-shrink: 0; }
.bargraph-track { flex: 1; position: relative; height: 24px; background: #f1f5f9; border-radius: 4px; overflow: visible; }
.bargraph-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
.bargraph-bar.bar-strong { background: #22c55e; }
.bargraph-bar.bar-weak   { background: #f59e0b; }
.bargraph-bar.bar-low    { background: #ef4444; }
.bargraph-required { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #334155; border-radius: 1px; }
.bargraph-value { font-size: 0.75rem; color: var(--muted); white-space: nowrap; flex-shrink: 0; min-width: 7rem; }
```

- [ ] **Step 2: Implement `renderBarGraph` in strength.js**

Replace the stub `renderBarGraph` function:

```js
function renderBarGraph(panel) {
  const { shadbala } = state.strength
  const maxTotal = Math.max(...PLANETS_ORDER.map(n => shadbala[n]?.total ?? 0))

  const rows = PLANETS_ORDER.map(name => {
    const d = shadbala[name]
    if (!d) return ''
    const barPct  = (d.total    / maxTotal) * 100
    const reqPct  = (d.required / maxTotal) * 100
    const barClass = d.ratio >= 1.0 ? 'bar-strong' : d.ratio >= 0.8 ? 'bar-weak' : 'bar-low'
    return `
      <div class="bargraph-row">
        <div class="bargraph-label">${name}</div>
        <div class="bargraph-track">
          <div class="bargraph-bar ${barClass}" style="width:${barPct.toFixed(1)}%"></div>
          <div class="bargraph-required" style="left:${reqPct.toFixed(1)}%" title="Required: ${d.required}"></div>
        </div>
        <div class="bargraph-value">${d.total} / ${d.required} = ${d.ratio.toFixed(2)}×</div>
      </div>
    `
  }).join('')

  panel.innerHTML = `<div class="bargraph-wrap">${rows}</div>`
}
```

- [ ] **Step 3: Verify in browser**

Strength → Bar Graph. Should show 7 horizontal bars, each with a vertical tick mark at the required minimum. Bars colored green/amber/red. Values shown to the right.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/strength.js src/style.css
git commit -m "feat: render Shadbala bar graph sub-tab"
```

---

## Self-Review

**Spec coverage:**
- ✅ Bhinnashtakavarga (7 planet tables) — Task 3 + 6
- ✅ Sarvashtakavarga (combined row) — Task 3 + 6
- ✅ Shadbala 6 components — Task 4 + 7
- ✅ Shadbala breakdown table — Task 7
- ✅ Bar Graph (Shadbala only) — Task 8
- ✅ Sub-tabs inside Strength — Task 2 + 6
- ✅ Ashtakavarga + Shadbala sub-tab structure — throughout
- ✅ `speed` added to planets for Chesta Bala — Task 1

**Notes / limitations (v1):**
- Kala Bala covers Nathonnatha + Paksha + Ayana only (9-component full Kala Bala deferred)
- Sapta Vargaja Bala uses permanent friendship only (no temporary friendship → no great friend/enemy distinction)
- Sapta Vargaja Bala D30 uses parivritti formula (standard, supported by existing `calcDivisional`)
- Drik Bala uses house-based aspect check; partial aspect signs are proportional (25%/50%/75%/100%)
