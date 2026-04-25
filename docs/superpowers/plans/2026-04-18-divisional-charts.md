# Divisional Charts (D1–D12 + Chalit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dropdown to the Chart tab to switch between D1 Rashi and all standard divisional charts (D2–D12) plus Chalit, updating both the SVG chart and the planet table.

**Architecture:** New pure function `calcDivisional` in `src/core/divisional.js` applies the Parashari formula; chart tab calls it on dropdown change and re-renders. `renderChartSVG` gains an optional `signLabels` param for Chalit house labels. State shape is unchanged.

**Tech Stack:** Vanilla JS, existing swisseph planet data, existing SVG renderer.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/core/divisional.js` | Create | Pure function: transform planet/lagna positions for any Dn |
| `src/tabs/chart.js` | Modify | Add dropdown, compute divisional on change, update heading + table |
| `src/ui/chart-svg.js` | Modify | Accept optional `signLabels` array param |
| `src/style.css` | Modify | Add `.div-select` style |

---

### Task 1: Create `src/core/divisional.js`

**Files:**
- Create: `src/core/divisional.js`

- [ ] **Step 1: Create the file with the full implementation**

```js
// src/core/divisional.js

// Map divisor → human label (used by chart tab)
export const DIVISIONAL_OPTIONS = [
  { value: 'D1',     label: 'D1 – Rashi' },
  { value: 'D2',     label: 'D2 – Hora' },
  { value: 'D3',     label: 'D3 – Drekkana' },
  { value: 'D4',     label: 'D4 – Chaturthamsha' },
  { value: 'D5',     label: 'D5 – Panchamsha' },
  { value: 'D6',     label: 'D6 – Shashthamsha' },
  { value: 'D7',     label: 'D7 – Saptamsha' },
  { value: 'D8',     label: 'D8 – Ashtamsha' },
  { value: 'D9',     label: 'D9 – Navamsa' },
  { value: 'D10',    label: 'D10 – Dashamsha' },
  { value: 'D11',    label: 'D11 – Rudramsha' },
  { value: 'D12',    label: 'D12 – Dwadashamsha' },
  { value: 'Chalit', label: 'Chalit' },
]

// Standard Parashari formula for D3–D12
function parashari(lon, n) {
  const sign        = Math.floor(lon / 30) + 1          // 1–12
  const degInSign   = lon % 30
  const part        = Math.floor(degInSign / (30 / n))  // 0..n-1
  const dSign       = ((sign - 1) * n + part) % 12 + 1
  const dDegree     = degInSign % (30 / n)
  return { sign: dSign, degree: dDegree }
}

// D2 Hora — traditional rule
function hora(lon) {
  const sign      = Math.floor(lon / 30) + 1
  const degInSign = lon % 30
  const isOdd     = sign % 2 === 1
  const firstHalf = degInSign < 15
  // Odd sign: 0–15 → Leo(5), 15–30 → Cancer(4)
  // Even sign: 0–15 → Cancer(4), 15–30 → Leo(5)
  const dSign = (isOdd === firstHalf) ? 5 : 4
  return { sign: dSign, degree: degInSign % 15 }
}

function transformLon(lon, key) {
  if (key === 'D1')  return { sign: Math.floor(lon / 30) + 1, degree: lon % 30 }
  if (key === 'D2')  return hora(lon)
  const n = parseInt(key.slice(1), 10)
  return parashari(lon, n)
}

/**
 * Returns transformed { planets, lagna } for the given divisional key.
 * For 'Chalit', planets.sign is replaced with planet.house so the caller
 * can pass them straight to renderChartSVG.
 *
 * @param {object[]} planets  - from state.planets
 * @param {object}   lagna    - from state.lagna
 * @param {string}   key      - 'D1'|'D2'|...|'D12'|'Chalit'
 */
export function calcDivisional(planets, lagna, key) {
  if (key === 'Chalit') {
    return {
      planets: planets.map(p => ({ ...p, sign: p.house })),
      lagna:   { ...lagna, sign: 1 },
    }
  }
  return {
    planets: planets.map(p => {
      const { sign, degree } = transformLon(p.lon, key)
      return { ...p, sign, degree }
    }),
    lagna: (() => {
      const { sign, degree } = transformLon(lagna.lon, key)
      return { ...lagna, sign, degree }
    })(),
  }
}
```

- [ ] **Step 2: Verify the file exists and has no syntax errors**

```bash
node --input-type=module < src/core/divisional.js && echo OK
```
Expected: `OK` (no output before that line).

- [ ] **Step 3: Commit**

```bash
git add src/core/divisional.js
git commit -m "feat: add divisional chart computation (D1-D12 + Chalit)"
```

---

### Task 2: Add `signLabels` param to `renderChartSVG`

**Files:**
- Modify: `src/ui/chart-svg.js`

Context: `renderNorthIndianSVG` and `renderSouthIndianSVG` both hard-code `SIGN_ABBR[sign - 1]` for sign labels. For Chalit the "sign" values are house numbers 1–12, so we need to substitute `['H1','H2',...,'H12']`.

- [ ] **Step 1: Add `CHALIT_LABELS` constant and thread `signLabels` through all three exported/internal functions**

Current signature: `renderChartSVG(planets, lagna, style = 'north')`
New signature:     `renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR)`

In `src/ui/chart-svg.js`, at the top after `const SIGN_ABBR = [...]`, add:

```js
const CHALIT_LABELS = ['H1','H2','H3','H4','H5','H6','H7','H8','H9','H10','H11','H12']
```

Change `renderNorthIndianSVG(planets, lagna)` to `renderNorthIndianSVG(planets, lagna, signLabels)` and replace every occurrence of `SIGN_ABBR[sign - 1]` inside it with `signLabels[sign - 1]`.

Change `renderSouthIndianSVG(planets, lagna)` to `renderSouthIndianSVG(planets, lagna, signLabels)` and replace every occurrence of `SIGN_ABBR[sign - 1]` inside it with `signLabels[sign - 1]`.

Change `renderChartSVG`:

```js
export function renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR) {
  return style === 'south'
    ? renderSouthIndianSVG(planets, lagna, signLabels)
    : renderNorthIndianSVG(planets, lagna, signLabels)
}
```

Export `CHALIT_LABELS` so `chart.js` can pass it:

```js
export { CHALIT_LABELS }
```

- [ ] **Step 2: Verify no regressions — build must succeed**

```bash
npm run build 2>&1 | tail -5
```
Expected: last line contains `built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "feat: accept signLabels param in renderChartSVG for Chalit support"
```

---

### Task 3: Add `.div-select` CSS

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add the style after `.profile-select:focus {}`**

Find this block in `src/style.css`:
```css
.profile-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
}
```

Add immediately after:
```css
.div-select {
  padding: 0.45rem 0.7rem;
  border: 1.5px solid var(--border);
  border-radius: 7px;
  font-size: 0.88rem;
  font-family: inherit;
  color: var(--text);
  background: #f8fafc;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.div-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/style.css
git commit -m "style: add .div-select for divisional chart dropdown"
```

---

### Task 4: Wire up the dropdown in `src/tabs/chart.js`

**Files:**
- Modify: `src/tabs/chart.js`

This is the largest change. Replace the entire file with the version below. Key changes vs. current:
- Import `calcDivisional`, `DIVISIONAL_OPTIONS` from `../core/divisional.js`
- Import `CHALIT_LABELS` from `../ui/chart-svg.js`
- Add `let divisional = 'D1'` alongside existing `let chartStyle`
- Dropdown renders above North/South buttons
- `renderChart()` calls `calcDivisional` before passing to `renderChartSVG`
- Planet table Sign + Degree columns reflect the selected divisional
- Chart heading updates with the selected divisional label

- [ ] **Step 1: Replace `src/tabs/chart.js` with the full updated version**

```js
// src/tabs/chart.js
import { state } from '../state.js'
import { renderChartSVG, CHALIT_LABELS } from '../ui/chart-svg.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

let chartStyle  = 'north'
let divisional  = 'D1'

function divLabel() {
  return DIVISIONAL_OPTIONS.find(o => o.value === divisional)?.label ?? divisional
}

export function renderChart() {
  const panel = document.getElementById('tab-chart')
  const { planets, lagna, birth } = state

  const { planets: dPlanets, lagna: dLagna } = calcDivisional(planets, lagna, divisional)
  const signLabels = divisional === 'Chalit' ? CHALIT_LABELS : undefined

  const heading = divisional === 'D1'
    ? `${birth.name} — Birth Chart`
    : `${birth.name} — ${divLabel()}`

  panel.innerHTML = `
    <div class="card">
      <h2>${heading}</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${birth.dob} &nbsp;${birth.tob} &nbsp;·&nbsp; ${birth.location || birth.lat + '°, ' + birth.lon + '°'}</p>
      <div style="margin-bottom:0.75rem">
        <select id="div-select" class="div-select">
          ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === divisional ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:1rem">
        <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North Indian</button>
        <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South Indian</button>
      </div>
      <div id="chart-container">
        ${renderChartSVG(dPlanets, dLagna, chartStyle, signLabels)}
      </div>
      <h3>Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel() : ''}</h3>
      <div class="table-scroll"><table class="planet-table">
        <thead>
          <tr><th>Planet</th><th>Sign</th><th>Deg</th><th>House</th><th>Nakshatra</th><th>Pada</th><th>R</th></tr>
        </thead>
        <tbody>
          ${dPlanets.map((p, i) => {
            const signLabel = divisional === 'Chalit'
              ? `H${p.sign}`
              : SIGN_NAMES[p.sign - 1]
            const origHouse = planets[i].house
            return `<tr>
              <td>${p.name}</td>
              <td>${signLabel}</td>
              <td>${p.degree.toFixed(2)}°</td>
              <td>${origHouse}</td>
              <td>${planets[i].nakshatra}</td>
              <td>${planets[i].pada}</td>
              <td style="color:#c00">${p.retrograde ? '℞' : ''}</td>
            </tr>`
          }).join('')}
          <tr style="background:#fef3ff">
            <td><strong>Lagna</strong></td>
            <td>${divisional === 'Chalit' ? 'H1' : SIGN_NAMES[dLagna.sign - 1]}</td>
            <td>${dLagna.degree.toFixed(2)}°</td>
            <td>1</td>
            <td>${lagna.nakshatra}</td>
            <td>${lagna.pada}</td>
            <td></td>
          </tr>
        </tbody>
      </table></div>
    </div>
  `

  panel.querySelector('#div-select').addEventListener('change', e => {
    divisional = e.target.value
    renderChart()
  })
  panel.querySelector('#btn-north').addEventListener('click', () => { chartStyle = 'north'; renderChart() })
  panel.querySelector('#btn-south').addEventListener('click', () => { chartStyle = 'south'; renderChart() })
}
```

- [ ] **Step 2: Build and verify no errors**

```bash
npm run build 2>&1 | tail -5
```
Expected: last line contains `built in` with no errors.

- [ ] **Step 3: Run dev server and manually verify**

```bash
npm run dev
```

Open http://localhost:5173/hora-prakash/ in a browser.
1. Fill in a birth date (e.g. 15 Aug 1947, 00:00, New Delhi) and click Calculate Chart.
2. On the Chart tab, confirm the dropdown shows "D1 – Rashi" by default.
3. Switch to "D9 – Navamsa" — chart and table should update; planets move to new signs.
4. Switch to "Chalit" — cells show H1–H12 labels; planets placed by house.
5. Switch North/South while on D9 — layout changes but divisional selection holds.
6. Switch back to D1 — matches original birth chart.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/chart.js
git commit -m "feat: divisional chart dropdown (D1-D12 + Chalit) on Chart tab"
```

---

### Task 5: Push and deploy

- [ ] **Step 1: Push to main**

```bash
git push
```

Expected: `main -> main` and GitHub Actions deploy workflow triggers.

- [ ] **Step 2: Verify live app**

Wait ~2 minutes, then open https://priyankgahtori.github.io/hora-prakash/ and repeat the manual verification from Task 4 Step 3.
