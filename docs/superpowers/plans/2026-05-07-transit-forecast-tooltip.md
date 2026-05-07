# Transit Forecast & Tooltip Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "next major event" forecasts to transit planet tooltips (desktop) and inline table-row expansion (all platforms), showing upcoming retrograde stations, sign ingresses, nakshatra/pada changes, gandanta crossings, combustion windows, and natal aspect activations.

**Architecture:** A new `src/core/transitForecast.js` engine scans forward using SwissEph WASM with a 1-day coarse step + bisection to ±1 hour precision; results are cached in session UI state and consumed by an updated tooltip and an expanded TransitTable row. Aspects follow Parashari sign-based rules: a natal aspect "activates" when the transiting planet enters a sign that aspects the natal planet's sign.

**Tech Stack:** Vanilla JS, SwissEph WASM (already initialized), existing `getSwe()` + `PLANETS` from `src/core/swisseph.js`, `getNakshatraInfo` from `src/core/calculations.js`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/calculations.js` | Modify | Export `COMBUST_ORBS` (currently private) |
| `src/core/transitForecast.js` | **Create** | Forecast engine — `findNextEvents()` |
| `src/components/TransitTooltip.js` | Modify | Add "Next Events" section (2 events, desktop only) |
| `src/components/TransitTable.js` | Modify | Click handler + inline expansion row with full forecast |
| `src/tabs/transit.js` | Modify | Wire cache, pass forecast into tooltip & table, invalidate on date change |

---

## Task 1: Export COMBUST_ORBS from calculations.js

**Files:**
- Modify: `src/core/calculations.js:32`

- [ ] **Step 1: Export `COMBUST_ORBS`**

In `src/core/calculations.js`, change line 32 from:
```js
const COMBUST_ORBS = {
  Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15,
}
```
to:
```js
export const COMBUST_ORBS = {
  Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15,
}
```

- [ ] **Step 2: Verify dev server still starts**

```bash
npm run dev
```
Expected: Server starts at `http://localhost:5173/hora-prakash/` with no errors in terminal. Open the app, load a chart, verify transit tab still works.

- [ ] **Step 3: Commit**

```bash
git add src/core/calculations.js
git commit -m "feat: export COMBUST_ORBS from calculations.js"
```

---

## Task 2: Create `src/core/transitForecast.js` — forecast engine

**Files:**
- Create: `src/core/transitForecast.js`

### Background

The engine works in two passes per event type:
1. **Coarse scan** — step 1 day at a time, evaluate boundary condition
2. **Bisection** — once a crossing bracket `[jd_before, jd_after]` is found, binary-search to within 1 hour (1/24 JD)

Aspect events use Parashari sign-based rules: a natal aspect activates when the transiting planet enters a sign that `getAspectedSigns(newSign, abbr)` overlaps with a natal planet's sign. Since this is sign-entry based, it's detected as part of the sign-ingress scan.

Ketu: `id = 10` (Rahu body), `lon = rawLon + 180`, same as in `transit.js`.

All JD arithmetic: 1 JD = 1 day.

- [ ] **Step 1: Create the file**

Create `src/core/transitForecast.js`:

```js
// src/core/transitForecast.js
import { getSwe }          from './swisseph.js'
import { COMBUST_ORBS }    from './calculations.js'
import { getNakshatraInfo } from './calculations.js'
import { getAspectedSigns } from './aspects.js'

// Scan windows per planet abbreviation (in days)
const SCAN_WINDOWS = {
  Mo: 30, Me: 90, Ve: 90,
  Su: 180, Ma: 180,
  Ju: 540, Ra: 540, Ke: 540,
  Sa: 730,
}

// Sidereal + speed flags
const FLAGS = 65536 | 256

function getRawLon(abbr, id, jd) {
  const swe = getSwe()
  const r   = swe.calc_ut(jd, id, FLAGS)
  return abbr === 'Ke' ? (r[0] + 180) % 360 : r[0]
}

function getSpeed(abbr, id, jd) {
  const swe = getSwe()
  const r   = swe.calc_ut(jd, id, FLAGS)
  // Ketu speed mirrors Rahu (mean node is always retrograde)
  return r[3]
}

function getSunLon(jd) {
  const swe = getSwe()
  return swe.calc_ut(jd, 0, FLAGS)[0]
}

function angularDist(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

// Binary-search the JD where condition(jd) flips from false to true
// jdLo: condition is false, jdHi: condition is true
// Resolves to within 1 hour (1/24 JD)
function bisect(jdLo, jdHi, condition) {
  for (let i = 0; i < 20; i++) {
    const mid = (jdLo + jdHi) / 2
    if (jdHi - jdLo < 1 / 24) break
    if (condition(mid)) jdHi = mid
    else jdLo = mid
  }
  return (jdLo + jdHi) / 2
}

function jdToDate(jd) {
  // JD 2440587.5 = 1970-01-01 00:00 UTC
  return new Date((jd - 2440587.5) * 86400000)
}

function signOf(lon) { return Math.floor(((lon % 360) + 360) % 360 / 30) + 1 }
function nakOf(lon)  { return Math.floor(((lon % 360) + 360) % 360 / (360 / 27)) }
function padaOf(lon) { return Math.floor(((lon % 360) + 360) % 360 / (360 / 108)) }

// Gandanta: last 3°20' of Cancer/Scorpio/Pisces OR first 3°20' of Leo/Sagittarius/Aries
// These are sign indices (0-based): Cancer=3, Scorpio=7, Pisces=11, Leo=4, Sag=8, Aries=0
const GANDANTA_WATER_SIGNS = new Set([3, 7, 11]) // 0-based
const GANDANTA_FIRE_SIGNS  = new Set([0, 4, 8])  // 0-based
const GANDANTA_DEG = 360 / 108 // 3°20' = 1 pada width

function isGandanta(lon) {
  const normLon = ((lon % 360) + 360) % 360
  const sign0   = Math.floor(normLon / 30)          // 0-based sign index
  const degInSign = normLon % 30
  if (GANDANTA_WATER_SIGNS.has(sign0) && degInSign >= (30 - GANDANTA_DEG)) return true
  if (GANDANTA_FIRE_SIGNS.has(sign0)  && degInSign <  GANDANTA_DEG)         return true
  return false
}

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

/**
 * Find all upcoming events for a transiting planet.
 *
 * @param {{ abbr: string, id: number, name: string }} planet  - from PLANETS array
 * @param {number} fromJD           - start Julian Day (current transit JD)
 * @param {object[]} natalPlanets   - state.planets
 * @param {number} natalLagnaSign   - state.lagna.sign (1–12)
 * @returns {{ type: string, date: Date, label: string, detail: string }[]}
 */
export function findNextEvents(planet, fromJD, natalPlanets, natalLagnaSign) {
  const { abbr, id, name } = planet
  const window = SCAN_WINDOWS[abbr] ?? 180
  const events = []

  // Snapshot values at start
  let prevLon   = getRawLon(abbr, id, fromJD)
  let prevSpeed = getSpeed(abbr, id, fromJD)
  let prevSign  = signOf(prevLon)
  let prevNak   = nakOf(prevLon)
  let prevPada  = padaOf(prevLon)
  let prevInGandanta = isGandanta(prevLon)
  const orb     = COMBUST_ORBS[name]
  let prevSunLon   = orb !== undefined ? getSunLon(fromJD) : null
  let prevCombust  = orb !== undefined ? angularDist(prevLon, prevSunLon) <= orb : false

  // Track which natal planets already aspected at start (avoid re-reporting current state)
  const alreadyAspecting = new Set()
  if (natalPlanets) {
    const aspectedSigns = getAspectedSigns(prevSign, abbr)
    for (const np of natalPlanets) {
      if (aspectedSigns.includes(np.sign)) alreadyAspecting.add(np.abbr)
    }
  }

  for (let d = 1; d <= window; d++) {
    const jd  = fromJD + d
    const lon = getRawLon(abbr, id, jd)
    const spd = getSpeed(abbr, id, jd)
    const sgn = signOf(lon)
    const nak = nakOf(lon)
    const pda = padaOf(lon)
    const inGandanta = isGandanta(lon)

    // --- Retrograde / Direct ---
    if (prevSpeed >= 0 && spd < 0) {
      const jdEvent = bisect(jd - 1, jd, jd2 => getSpeed(abbr, id, jd2) < 0)
      events.push({ type: 'retro', date: jdToDate(jdEvent), label: 'Goes Retrograde ℞', detail: '' })
    } else if (prevSpeed < 0 && spd >= 0) {
      const jdEvent = bisect(jd - 1, jd, jd2 => getSpeed(abbr, id, jd2) >= 0)
      events.push({ type: 'direct', date: jdToDate(jdEvent), label: 'Goes Direct ◎', detail: '' })
    }

    // --- Sign ingress ---
    if (sgn !== prevSign) {
      const jdEvent = bisect(jd - 1, jd, jd2 => signOf(getRawLon(abbr, id, jd2)) === sgn)
      const house   = ((sgn - natalLagnaSign + 12) % 12) + 1
      events.push({
        type: 'sign',
        date: jdToDate(jdEvent),
        label: `→ Enters ${SIGN_NAMES[sgn - 1]} (H${house})`,
        detail: SIGN_NAMES[sgn - 1],
      })

      // --- Natal aspect (sign-based) ---
      if (natalPlanets) {
        const newAspected = getAspectedSigns(sgn, abbr)
        for (const np of natalPlanets) {
          if (newAspected.includes(np.sign) && !alreadyAspecting.has(np.abbr)) {
            const aspectType = sgn === np.sign ? '☌ Conjunct' : '◈ Aspects'
            events.push({
              type: 'natal_aspect',
              date: jdToDate(jdEvent),
              label: `${aspectType} natal ${np.name}`,
              detail: np.abbr,
            })
          }
        }
        // Update alreadyAspecting for new sign
        alreadyAspecting.clear()
        const aspectedSigns = getAspectedSigns(sgn, abbr)
        for (const np of natalPlanets) {
          if (aspectedSigns.includes(np.sign)) alreadyAspecting.add(np.abbr)
        }
      }

      prevSign = sgn
    }

    // --- Nakshatra change ---
    if (nak !== prevNak) {
      const jdEvent = bisect(jd - 1, jd, jd2 => nakOf(getRawLon(abbr, id, jd2)) === nak)
      const nakInfo = getNakshatraInfo(lon)
      events.push({
        type: 'nakshatra',
        date: jdToDate(jdEvent),
        label: `★ Nakshatra: ${nakInfo.name}`,
        detail: nakInfo.name,
      })
      prevNak = nak
    }

    // --- Pada change ---
    if (pda !== prevPada) {
      const jdEvent = bisect(jd - 1, jd, jd2 => padaOf(getRawLon(abbr, id, jd2)) === pda)
      const nakInfo = getNakshatraInfo(lon)
      events.push({
        type: 'pada',
        date: jdToDate(jdEvent),
        label: `Pāda ${nakInfo.pada}`,
        detail: `${nakInfo.name} Pāda ${nakInfo.pada}`,
      })
      prevPada = pda
    }

    // --- Gandanta ---
    if (!prevInGandanta && inGandanta) {
      const jdEvent = bisect(jd - 1, jd, jd2 => isGandanta(getRawLon(abbr, id, jd2)))
      events.push({ type: 'gandanta', date: jdToDate(jdEvent), label: '⚠ Gandanta crossing', detail: '' })
    }
    prevInGandanta = inGandanta

    // --- Combust ---
    if (orb !== undefined) {
      const sunLon    = getSunLon(jd)
      const dist      = angularDist(lon, sunLon)
      const combust   = dist <= orb
      if (!prevCombust && combust) {
        const jdEvent = bisect(jd - 1, jd, jd2 => {
          const l = getRawLon(abbr, id, jd2)
          const s = getSunLon(jd2)
          return angularDist(l, s) <= orb
        })
        events.push({ type: 'combust_enter', date: jdToDate(jdEvent), label: `☀ Combust (within ${orb}°)`, detail: '' })
      } else if (prevCombust && !combust) {
        const jdEvent = bisect(jd - 1, jd, jd2 => {
          const l = getRawLon(abbr, id, jd2)
          const s = getSunLon(jd2)
          return angularDist(l, s) > orb
        })
        events.push({ type: 'combust_exit', date: jdToDate(jdEvent), label: '☀ Leaves combustion', detail: '' })
      }
      prevCombust = combust
      prevSunLon  = sunLon
    }

    prevLon   = lon
    prevSpeed = spd
  }

  // Sort by date ascending
  events.sort((a, b) => a.date - b.date)
  return events
}
```

- [ ] **Step 2: Verify import chain works**

Open browser dev console on the transit tab. In the browser console:
```js
// This should not throw — just verifying imports resolve
import('/hora-prakash/src/core/transitForecast.js').then(m => console.log('ok', Object.keys(m)))
```
Expected: `ok ['findNextEvents']`

(If the app uses bundled imports, skip this step — Vite will catch import errors at build time. Run `npm run build` instead and check for errors.)

- [ ] **Step 3: Commit**

```bash
git add src/core/transitForecast.js
git commit -m "feat: transit forecast engine — sign, retro, nakshatra, pada, gandanta, combust, natal aspects"
```

---

## Task 3: Update `TransitTooltip.js` — Next Events section

**Files:**
- Modify: `src/components/TransitTooltip.js`

The tooltip already receives a `data` object from `data-tip` JSON. We'll add an optional `forecast` array to that data (nearest 2 events, pre-sliced before serialization is NOT used here — forecast is too large for JSON attribute). Instead, pass forecast via a `setForecast(abbr, events)` method and look up on show.

- [ ] **Step 1: Add forecast cache and `setForecast` method**

Replace the entire `TransitTooltip.js` with:

```js
// src/components/TransitTooltip.js
const PLANET_ICONS = { Su:'☉', Mo:'☽', Ma:'♂', Me:'☿', Ju:'♃', Ve:'♀', Sa:'♄', Ra:'☊', Ke:'☋', Asc:'↑' }
const SIGN_SYMS    = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓']
const SIGN_NAMES   = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(date) {
  return `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCDate()}`
}

export class TransitTooltip {
  constructor() {
    this._el        = null
    this._target    = null
    this._onMove    = null
    this._onOver    = null
    this._onOut     = null
    this._enabled   = true
    this._visible   = false
    this._forecasts = {}   // abbr → Event[]
    this._onForecast = null // callback: (abbr) => void, called when forecast needed
  }

  mount() {
    if (this._el) return
    this._el = document.createElement('div')
    this._el.className = 'p-tooltip p-tooltip--hidden'
    document.body.appendChild(this._el)
    this._onMove = e => { if (this._visible) this._position(e) }
    document.addEventListener('mousemove', this._onMove)
  }

  attach(container) {
    this.detach()
    this._target = container
    this._onOver = e => {
      if (!this._enabled) return
      const el = e.target.closest('[data-tip]')
      if (!el) { this._hide(); return }
      try { this._show(JSON.parse(el.getAttribute('data-tip')), e) } catch { this._hide() }
    }
    this._onOut = e => {
      if (!e.relatedTarget?.closest('[data-tip]')) this._hide()
    }
    container.addEventListener('mouseover', this._onOver)
    container.addEventListener('mouseout',  this._onOut)
  }

  detach() {
    if (this._target) {
      this._target.removeEventListener('mouseover', this._onOver)
      this._target.removeEventListener('mouseout',  this._onOut)
      this._target = null
    }
    this._hide()
  }

  setEnabled(v) { this._enabled = v; if (!v) this._hide() }

  // Register a callback that the tooltip calls when it needs forecast for an abbr
  setForecastProvider(fn) { this._onForecast = fn }

  // Called externally when forecast is ready for an abbr
  setForecast(abbr, events) {
    this._forecasts[abbr] = events
    // If this tooltip is currently showing that planet, re-render
    if (this._visible && this._currentAbbr === abbr) {
      this._el.querySelector('.p-tt-forecast')?.replaceWith(this._buildForecastEl(events))
    }
  }

  clearForecasts() { this._forecasts = {} }

  destroy() {
    this.detach()
    if (this._onMove) document.removeEventListener('mousemove', this._onMove)
    this._el?.remove()
    this._el = null
  }

  _buildForecastEl(events) {
    const el = document.createElement('div')
    el.className = 'p-tt-forecast'
    const top2 = events.filter(e => e.type !== 'pada').slice(0, 2)
    if (top2.length === 0) { el.style.display = 'none'; return el }
    el.innerHTML = `
      <div class="p-tt-divider">Next Events</div>
      ${top2.map(ev => `
        <div class="p-tt-row">
          <span class="p-tt-lbl">${ev.label}</span>
          <span class="p-tt-val">${fmtDate(ev.date)}</span>
        </div>`).join('')}`
    return el
  }

  _show(d, e) {
    this._currentAbbr = d.abbr
    const icon    = PLANET_ICONS[d.abbr] ?? '●'
    const signIdx = SIGN_NAMES.indexOf(d.sign)
    const signSym = signIdx >= 0 ? SIGN_SYMS[signIdx] : ''
    const badge   = d.transit
      ? `<span class="p-tt-badge p-tt-badge--transit">Transit</span>`
      : `<span class="p-tt-badge p-tt-badge--natal">Natal</span>`

    let speedRow = ''
    if (typeof d.speed === 'number') {
      const sign = d.speed < 0 ? '−' : '+'
      const abs  = Math.abs(d.speed).toFixed(3)
      const cls  = d.retro ? ' p-tt-retro' : ''
      const flag = d.retro ? ' ℞' : ''
      speedRow = `<div class="p-tt-row"><span class="p-tt-lbl">Speed</span><span class="p-tt-val${cls}">${sign}${abs}°/d${flag}</span></div>`
    } else if (d.retro) {
      speedRow = `<div class="p-tt-row"><span class="p-tt-lbl">Motion</span><span class="p-tt-val p-tt-retro">Retrograde ℞</span></div>`
    }

    this._el.innerHTML = `
      <div class="p-tt-head">
        <span class="p-tt-icon">${icon}</span>
        <span class="p-tt-name">${d.name}</span>
        ${badge}
      </div>
      <div class="p-tt-body">
        ${d.sign ? `<div class="p-tt-row"><span class="p-tt-lbl">Sign</span><span class="p-tt-val">${d.sign} ${signSym}</span></div>` : ''}
        ${d.nak  ? `<div class="p-tt-row"><span class="p-tt-lbl">Nakshatra</span><span class="p-tt-val">${d.nak}${d.pada ? ' · Pāda ' + d.pada : ''}</span></div>` : ''}
        ${d.deg  ? `<div class="p-tt-row"><span class="p-tt-lbl">Degree</span><span class="p-tt-val">${d.deg}</span></div>` : ''}
        ${speedRow}
      </div>`

    // Forecast section — transit planets only
    if (d.transit && d.abbr) {
      const cached = this._forecasts[d.abbr]
      if (cached) {
        this._el.appendChild(this._buildForecastEl(cached))
      } else {
        const loadingEl = document.createElement('div')
        loadingEl.className = 'p-tt-forecast'
        loadingEl.innerHTML = '<div class="p-tt-divider">Next Events</div><div class="p-tt-row p-tt-loading">Computing…</div>'
        this._el.appendChild(loadingEl)
        // Request forecast asynchronously
        if (this._onForecast) this._onForecast(d.abbr)
      }
    }

    this._el.classList.remove('p-tooltip--hidden')
    this._visible = true
    this._position(e)
  }

  _hide() {
    this._visible = false
    this._currentAbbr = null
    this._el?.classList.add('p-tooltip--hidden')
  }

  _position(e) {
    if (!this._el || !this._visible) return
    const x = e.clientX + 14, y = e.clientY - 10
    const w = this._el.offsetWidth,  h = this._el.offsetHeight
    const vw = window.innerWidth,    vh = window.innerHeight
    this._el.style.left = (x + w > vw - 8 ? e.clientX - w - 10 : x) + 'px'
    this._el.style.top  = (y + h > vh - 8 ? e.clientY - h - 8  : y) + 'px'
  }
}
```

- [ ] **Step 2: Verify tooltip still works**

Load a chart, go to Transit tab, hover a planet on the chart. Tooltip should appear as before (sign, nakshatra, degree, speed). "Computing…" should appear for transit planets while forecast loads.

- [ ] **Step 3: Commit**

```bash
git add src/components/TransitTooltip.js
git commit -m "feat: tooltip — next events section with forecast provider hook"
```

---

## Task 4: Update `TransitTable.js` — inline row expansion

**Files:**
- Modify: `src/components/TransitTable.js`

Clicking a row with a transit planet toggles an expansion `<tr>` directly below it. The table manages its own `_expanded` set (planet abbrs currently expanded) and `_forecasts` map.

- [ ] **Step 1: Rewrite TransitTable.js**

```js
// src/components/TransitTable.js
import { DIVISIONAL_OPTIONS } from '../core/divisional.js'

const SIGN_NAMES = ['','Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(date) {
  return `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCDate()}`
}

function divLabel(key) {
  return DIVISIONAL_OPTIONS.find(o => o.value === key)?.label ?? key
}

function fmtDeg(dec) {
  const d = Math.floor(dec)
  const m = Math.floor((dec - d) * 60)
  return `${d}°${String(m).padStart(2,'0')}'`
}

function nakPada(p) {
  if (!p?.nakshatra) return '—'
  return `${p.nakshatra} (${p.pada})`
}

export class TransitTable {
  constructor(el, getState) {
    this.el         = el
    this._getState  = getState
    this._expanded  = new Set()       // abbrs with open expansion
    this._forecasts = {}              // abbr → Event[]
    this._onForecast = null           // callback: (abbr) => void
    this._lastRenderArgs = null       // store for re-render after forecast arrives
  }

  get ui() { return this._getState() }

  // Register callback called when forecast is needed for an abbr
  setForecastProvider(fn) { this._onForecast = fn }

  // Called externally when forecast ready; re-renders only the expansion row
  setForecast(abbr, events) {
    this._forecasts[abbr] = events
    const expansionEl = this.el.querySelector(`[data-expansion="${abbr}"]`)
    if (expansionEl) {
      expansionEl.innerHTML = this._buildExpansionContent(events)
    }
  }

  clearForecasts() { this._forecasts = {}; this._expanded.clear() }

  destroy() { this.el.innerHTML = '' }

  render(natalPlanets, transitPlanets, _t2n, _t2t, natalLagna, transitLagna, div = 'D1') {
    this._lastRenderArgs = [natalPlanets, transitPlanets, _t2n, _t2t, natalLagna, transitLagna, div]
    if (!natalPlanets) { this.el.innerHTML = ''; return }

    const isD1      = !div || div === 'D1'
    const divSuffix = isD1 ? '' : ` — ${divLabel(div)}`
    const isChalit  = div === 'Chalit'
    const signName  = (sign) => isChalit ? `H${sign}` : (SIGN_NAMES[sign] ?? '—')
    const filter    = this.ui.transitFilter ?? new Set(['Ju','Sa'])

    const tMap = {}
    if (transitPlanets) {
      for (const tp of transitPlanets) tMap[tp.abbr] = tp
    }

    const retroMark = (p) => p?.retrograde ? ' (R)' : ''

    const nLagna = natalLagna
    const tLagna = transitLagna ?? this.ui.transitLagna
    const lagnaRow = `
      <tr class="lagna-row">
        <td><strong>Lg</strong></td>
        <td>${nLagna ? signName(nLagna.sign) : '—'}</td>
        <td>${nLagna ? fmtDeg(nLagna.degree) : '—'}</td>
        <td>${nLagna ? nakPada(nLagna) : '—'}</td>
        <td>${tLagna ? signName(tLagna.sign) : '—'}</td>
        <td>${tLagna ? fmtDeg(tLagna.degree) : '—'}</td>
        <td>${tLagna ? nakPada(tLagna) : '—'}</td>
      </tr>`

    const rows = natalPlanets.map(np => {
      const tp          = filter.has(np.abbr) ? tMap[np.abbr] : null
      const isExpanded  = this._expanded.has(np.abbr)
      const clickable   = tp ? ` class="transit-row-clickable" data-abbr="${np.abbr}"` : ''
      const expandIcon  = tp ? (isExpanded ? '▼' : '▶') : ''

      const mainRow = `
        <tr${clickable}>
          <td><strong>${np.abbr}</strong> <span class="expand-icon">${expandIcon}</span></td>
          <td>${signName(np.sign)}</td>
          <td>${fmtDeg(np.degree)}${retroMark(np)}</td>
          <td>${nakPada(np)}</td>
          <td>${tp ? signName(tp.sign) : '—'}</td>
          <td>${tp ? fmtDeg(tp.degree) + retroMark(tp) : '—'}</td>
          <td>${tp ? nakPada(tp) : '—'}</td>
        </tr>`

      const expansionRow = tp && isExpanded ? `
        <tr class="transit-expansion-row">
          <td colspan="7">
            <div class="transit-expansion" data-expansion="${np.abbr}">
              ${this._forecasts[np.abbr]
                ? this._buildExpansionContent(this._forecasts[np.abbr])
                : '<div class="transit-expansion-loading">Computing forecast…</div>'}
            </div>
          </td>
        </tr>` : ''

      return mainRow + expansionRow
    }).join('')

    this.el.innerHTML = `
      <div class="transit-table-wrap">
        <h3 class="section-label" style="padding:0.5rem 0 0.25rem">Planetary Positions${divSuffix}</h3>
        <table class="transit-table">
          <thead>
            <tr>
              <th>Planet</th>
              <th>Natal Sign</th>
              <th>Natal°</th>
              <th>Natal Nakshatra</th>
              <th>Transit Sign</th>
              <th>Transit°</th>
              <th>Transit Nakshatra</th>
            </tr>
          </thead>
          <tbody>${lagnaRow}${rows}</tbody>
        </table>
      </div>`

    // Attach click handlers
    this.el.querySelectorAll('[data-abbr]').forEach(row => {
      row.addEventListener('click', () => this._handleRowClick(row.dataset.abbr))
    })
  }

  _handleRowClick(abbr) {
    if (this._expanded.has(abbr)) {
      this._expanded.delete(abbr)
    } else {
      this._expanded.add(abbr)
      if (!this._forecasts[abbr] && this._onForecast) {
        this._onForecast(abbr)
      }
    }
    // Re-render with same args
    if (this._lastRenderArgs) this.render(...this._lastRenderArgs)
  }

  _buildExpansionContent(events) {
    if (!events || events.length === 0) {
      return '<div class="transit-expansion-empty">No upcoming events found in scan window.</div>'
    }

    const transitEvents = events.filter(e => e.type !== 'natal_aspect')
    const aspectEvents  = events.filter(e => e.type === 'natal_aspect')

    const renderRows = (evs) => evs.map(ev =>
      `<div class="transit-exp-row">
        <span class="transit-exp-date">${fmtDate(ev.date)}</span>
        <span class="transit-exp-label">${ev.label}</span>
      </div>`
    ).join('')

    return `
      <div class="transit-exp-section">
        <div class="transit-exp-heading">UPCOMING TRANSITS</div>
        ${transitEvents.length ? renderRows(transitEvents) : '<div class="transit-exp-empty">None in scan window</div>'}
      </div>
      ${aspectEvents.length ? `
      <div class="transit-exp-section">
        <div class="transit-exp-heading">NATAL ASPECTS</div>
        ${renderRows(aspectEvents)}
      </div>` : ''}`
  }
}
```

- [ ] **Step 2: Verify table renders correctly**

Load a chart, go to Transit tab. Planet rows should render identically to before. Transit planet rows should show a `▶` icon. Clicking one should show "Computing forecast…" while loading.

- [ ] **Step 3: Commit**

```bash
git add src/components/TransitTable.js
git commit -m "feat: transit table — inline row expansion for planet forecast"
```

---

## Task 5: Wire forecast into `src/tabs/transit.js`

**Files:**
- Modify: `src/tabs/transit.js`

This is the coordination layer. It:
1. Imports `findNextEvents` and `PLANETS` 
2. Provides `requestForecast(abbr)` — checks cache, computes if missing, pushes to tooltip and table
3. Registers as `forecastProvider` on both tooltip and table
4. Invalidates cache (`forecastCache = {}`) when transit date/time changes

- [ ] **Step 1: Add imports**

At the top of `src/tabs/transit.js`, add to existing imports:
```js
import { findNextEvents }  from '../core/transitForecast.js'
import { PLANETS }         from '../core/swisseph.js'
```

- [ ] **Step 2: Add `requestForecast` function**

Add this function after the `_reRenderChart` function (before `export function renderTransit`):

```js
function requestForecast(abbr) {
  const ui = getTransitUI()
  if (!state.planets || !state.lagna) return

  ui.forecastCache ??= {}
  if (ui.forecastCache[abbr]) {
    _tooltip?.setForecast(abbr, ui.forecastCache[abbr])
    _table?.setForecast(abbr, ui.forecastCache[abbr])
    return
  }

  const date = ui.transitDate ?? todayDate()
  const time = ui.transitTime ?? nowTime()
  const tz   = state.birth?.timezone ?? '+00:00'
  const jd   = toJulianDay(date, time, tz)

  const planet = PLANETS.find(p => p.abbr === abbr)
  if (!planet) return

  // Run synchronously (WASM is blocking) in a microtask to allow tooltip to render first
  Promise.resolve().then(() => {
    const events = findNextEvents(planet, jd, state.planets, state.lagna.sign)
    ui.forecastCache[abbr] = events
    _tooltip?.setForecast(abbr, events)
    _table?.setForecast(abbr, events)
  })
}
```

- [ ] **Step 3: Add `_tooltip` module variable and wire providers**

Add `_tooltip` to the module-level variables (near `_toolbar`, `_chartPane`, `_table`):

Find:
```js
let _toolbar   = null
let _chartPane = null
let _table     = null
```

Replace with:
```js
let _toolbar   = null
let _chartPane = null
let _table     = null
let _tooltip   = null
```

- [ ] **Step 4: Wire tooltip and table in `renderTransit`**

In `renderTransit`, after the `_toolbar`, `_chartPane`, `_table` construction lines, find where `_chartPane` is constructed. The `TransitChartPane` owns the tooltip internally. We need a reference to the tooltip that `TransitChartPane` uses, OR we manage a separate `TransitTooltip` for the table.

Check how `TransitChartPane` exposes its tooltip:

```bash
grep -n "tooltip\|Tooltip" src/components/TransitChartPane.js | head -20
```

If `TransitChartPane` exposes a `tooltip` property or `getTooltip()`, use that. If not, add a `getTooltip()` method to `TransitChartPane` in Task 5 Step 5.

- [ ] **Step 5: Expose tooltip from TransitChartPane (if needed)**

Read `src/components/TransitChartPane.js` and check if `this._tooltip` or similar is accessible. If the class creates a `TransitTooltip` internally, add:

```js
getTooltip() { return this._tooltip }
```

to the class. Then in `renderTransit` after `_chartPane` is created:

```js
_tooltip = _chartPane.getTooltip()
_tooltip?.setForecastProvider(requestForecast)
_table.setForecastProvider(requestForecast)
```

- [ ] **Step 6: Invalidate forecast cache on date/time change**

In `handleToolbarChange`, in the `else` branch (which calls `calcAndRender()`), add cache invalidation before the call:

Find:
```js
  } else {
    calcAndRender()
  }
```

Replace with:
```js
  } else {
    if (key === 'transitDate' || key === 'transitTime') {
      const ui = getTransitUI()
      ui.forecastCache = {}
      _tooltip?.clearForecasts()
      _table?.clearForecasts()
    }
    calcAndRender()
  }
```

- [ ] **Step 7: Verify full flow**

1. Load a chart
2. Go to Transit tab
3. **Desktop:** Hover a transit planet on the chart — tooltip appears, "Computing…" shows briefly, then next 2 events appear
4. Click a planet row in the table — expansion appears with "Computing forecast…" then populates
5. Click the same row again — expansion closes
6. Change the transit date — expansion closes (row collapses due to cache clear), forecast re-computes on next click/hover

- [ ] **Step 8: Commit**

```bash
git add src/tabs/transit.js src/components/TransitChartPane.js
git commit -m "feat: wire transit forecast provider — lazy cache, tooltip + table integration"
```

---

## Task 6: Add CSS styles for expansion and forecast sections

**Files:**
- Modify: whichever CSS file styles the transit tab (check `src/` or `src/styles/` for transit styles)

```bash
grep -rn "transit-table\|p-tooltip\|p-tt-" src/ --include="*.css" -l
```

- [ ] **Step 1: Find the CSS file**

Run the grep above. Note the file path.

- [ ] **Step 2: Add styles**

Append to the identified CSS file:

```css
/* Transit table row expansion */
.transit-row-clickable {
  cursor: pointer;
}
.transit-row-clickable:hover {
  background: var(--color-surface-hover, rgba(255,255,255,0.05));
}
.expand-icon {
  font-size: 0.65rem;
  opacity: 0.6;
  margin-left: 0.2rem;
}
.transit-expansion-row td {
  padding: 0;
}
.transit-expansion {
  padding: 0.75rem 1rem;
  background: var(--color-surface-2, rgba(0,0,0,0.2));
  border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.1));
}
.transit-expansion-loading,
.transit-expansion-empty {
  font-size: 0.8rem;
  opacity: 0.5;
  padding: 0.25rem 0;
}
.transit-exp-section {
  margin-bottom: 0.75rem;
}
.transit-exp-section:last-child {
  margin-bottom: 0;
}
.transit-exp-heading {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.5;
  margin-bottom: 0.4rem;
  text-transform: uppercase;
}
.transit-exp-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.15rem 0;
  font-size: 0.85rem;
}
.transit-exp-date {
  min-width: 3.5rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
  flex-shrink: 0;
}
.transit-exp-label {
  flex: 1;
}
.transit-exp-empty {
  font-size: 0.8rem;
  opacity: 0.4;
}

/* Tooltip forecast section */
.p-tt-divider {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.5;
  margin: 0.5rem 0 0.3rem;
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 0.4rem;
}
.p-tt-loading {
  opacity: 0.5;
  font-style: italic;
}
```

- [ ] **Step 3: Verify visual appearance**

Load chart, transit tab. Expand a planet row. Check:
- Expansion card appears with correct background
- Section headings visible but subdued
- Dates and labels align cleanly
- Row hover highlight works

On mobile (or narrow viewport): expansion is full table width, readable.

- [ ] **Step 4: Commit**

```bash
git add <css-file-path>
git commit -m "feat: CSS for transit forecast expansion and tooltip next-events section"
```

---

## Self-Review

**Spec coverage:**
- ✅ Next retrograde/direct → `retro`/`direct` event types in `findNextEvents`
- ✅ Sign/house change → `sign` event type
- ✅ Nakshatra change → `nakshatra` event type
- ✅ Pada change → `pada` event type (panel only, filtered from tooltip top-2 by `type !== 'pada'` filter)
- ✅ Gandanta → `gandanta` event type
- ✅ Combust entry/exit → `combust_enter`/`combust_exit`
- ✅ Natal aspects → `natal_aspect` events on sign ingress
- ✅ Adaptive scan windows → `SCAN_WINDOWS` map
- ✅ Bisection to ±1hr → `bisect()` helper, 20-iteration loop (2^20 = 1M divisions, stops at 1/24 JD)
- ✅ Desktop tooltip: nearest 2 non-pada events
- ✅ Mobile: inline expansion (no tooltip dependency)
- ✅ Cache invalidation on date change
- ✅ Cache in session `uiState.transit.forecastCache`

**Placeholder scan:** No TBDs. All code complete.

**Type consistency:**
- `findNextEvents` returns `{ type, date, label, detail }[]` — consumed as `ev.label`, `ev.date`, `ev.type` in both tooltip and table ✅
- `setForecast(abbr, events)` signature matches in both tooltip and table ✅
- `setForecastProvider(fn)` signature consistent ✅
- `clearForecasts()` present on both tooltip and table ✅

**Note on Task 5 Step 4-5:** TransitChartPane internals need inspection before Step 5 can be completed exactly. The step instructs the implementor to grep the file and handle either case. This is intentional — the exact wiring depends on how the chart pane manages its tooltip.
