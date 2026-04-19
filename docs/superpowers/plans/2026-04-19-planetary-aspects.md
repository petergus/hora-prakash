# Planetary Aspects Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive animated aspect arrows to the Vedic chart — click a planet to toggle colored flowing dashed arrows to aspected houses; Show All / Hide All buttons for bulk control.

**Architecture:** New `src/core/aspects.js` holds aspect rules and planet colors. `chart-svg.js` is extended to render arrows as animated SVG lines with arrowhead markers. `chart.js` manages `activePlanets` state and wires up click delegation and control buttons without full panel re-renders.

**Tech Stack:** Vanilla JS, inline SVG, CSS keyframe animation embedded in SVG `<style>` block.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/aspects.js` | **Create** | PLANET_COLORS, ASPECT_OFFSETS, getAspectedSigns() |
| `src/ui/chart-svg.js` | **Modify** | data-planet attrs, active highlight rects, animated arrow rendering, updated signatures |
| `src/tabs/chart.js` | **Modify** | activePlanets state, renderSVGOnly(), Show All / Hide All buttons, click delegation |

---

## Task 1: Create `src/core/aspects.js`

**Files:**
- Create: `src/core/aspects.js`

- [ ] **Step 1: Create the file**

```js
// src/core/aspects.js

export const PLANET_COLORS = {
  Su: '#f59e0b',
  Mo: '#6366f1',
  Ma: '#ef4444',
  Me: '#10b981',
  Ju: '#f97316',
  Ve: '#ec4899',
  Sa: '#64748b',
  Ra: '#7c3aed',
  Ke: '#0891b2',
}

// 0-based offsets: 7th house = 6, 4th = 3, 5th = 4, 8th = 7, 9th = 8, 3rd = 2, 10th = 9
const ASPECT_OFFSETS = {
  Su: [6],
  Mo: [6],
  Ma: [3, 6, 7],
  Me: [6],
  Ju: [4, 6, 8],
  Ve: [6],
  Sa: [2, 6, 9],
  Ra: [4, 6, 8],
  Ke: [4, 6, 8],
}

// Returns array of sign numbers (1–12) that planetAbbr aspects from planetSign
export function getAspectedSigns(planetSign, planetAbbr) {
  const offsets = ASPECT_OFFSETS[planetAbbr] ?? [6]
  return offsets.map(o => ((planetSign - 1 + o) % 12) + 1)
}
```

- [ ] **Step 2: Verify file is importable — start dev server**

```bash
npm run dev
```

Open `http://localhost:5173/hora-prakash/` and confirm the page loads without console errors (aspects.js is not imported yet — this just checks the server starts).

- [ ] **Step 3: Commit**

```bash
git add src/core/aspects.js
git commit -m "feat: add planetary aspect rules and colors (aspects.js)"
```

---

## Task 2: Add `data-planet` attributes and active-planet highlight to `placePlanets()`

**Files:**
- Modify: `src/ui/chart-svg.js` — `placePlanets()` function (lines ~60–80)

- [ ] **Step 1: Update `placePlanets` signature and body**

Replace the entire `placePlanets` function:

```js
function placePlanets(ps, cx, areaTop, areaBottom, activePlanetColors = {}) {
  if (ps.length === 0) return ''
  const areaH = areaBottom - areaTop
  const maxFont = 17
  const minFont = 11
  const lineH = Math.max(minFont + 3, Math.min(maxFont + 4, areaH / ps.length))
  const fontSize = Math.round(Math.min(maxFont, lineH - 3))
  const blockH = (ps.length - 1) * lineH
  const firstY = areaTop + (areaH - blockH) / 2 + fontSize * 0.36

  return ps.map((p, i) => {
    const deg = typeof p.degree === 'number' ? p.degree.toFixed(0) + '°' : ''
    const r   = p.retrograde ? 'ᴿ' : ''
    const label = `${p.abbr}${r} ${deg}`
    const color  = p.isLagna ? '#c2410c' : '#1e293b'
    const weight = p.isLagna ? '700' : '500'
    const y = firstY + i * lineH
    const activeColor = !p.isLagna && activePlanetColors[p.abbr]
    const highlight = activeColor
      ? `<rect x="${(cx - 24).toFixed(1)}" y="${(y - fontSize + 1).toFixed(1)}" width="48" height="${fontSize + 3}" rx="3" fill="${activeColor}" opacity="0.2"/>`
      : ''
    const dataPlanet = !p.isLagna ? `data-planet="${p.abbr}"` : ''
    return highlight + `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-weight="${weight}" ${FONT} ${dataPlanet} style="cursor:pointer">${label}</text>`
  }).join('\n')
}
```

- [ ] **Step 2: Verify in browser**

Enter a birth chart, switch to Chart tab. Planet labels should still render correctly. No visual difference yet (no active colors passed yet). Open DevTools → Elements and confirm planet `<text>` elements have `data-planet="Su"` etc.

- [ ] **Step 3: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "feat: add data-planet attrs and active highlight to planet labels"
```

---

## Task 3: Add animated arrow rendering to North Indian SVG

**Files:**
- Modify: `src/ui/chart-svg.js` — `renderNorthIndianSVG()` and helpers

- [ ] **Step 1: Add `shortenLine` helper after `bbox` function**

After the `bbox` function (~line 57), add:

```js
function shortenLine(x1, y1, x2, y2, by) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < by * 2) return [x1, y1, x2, y2]
  const r = (len - by) / len
  return [x1, y1, x1 + dx * r, y1 + dy * r]
}
```

- [ ] **Step 2: Add `buildArrowDefs` helper after `shortenLine`**

```js
function buildArrowDefs(activeAspects) {
  if (!activeAspects || activeAspects.length === 0) return '<defs/>'
  const colors = [...new Set(activeAspects.map(a => a.color))]
  const markers = colors.map(color => {
    const id = `arrow-${color.replace('#', '')}`
    return `<marker id="${id}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="${color}" opacity="0.85"/>
    </marker>`
  })
  return `<defs>
    <style>@keyframes flowAspect { from { stroke-dashoffset: 26; } to { stroke-dashoffset: 0; } }</style>
    ${markers.join('\n    ')}
  </defs>`
}
```

- [ ] **Step 3: Update `renderNorthIndianSVG` signature and add arrow rendering**

Change the function signature from:
```js
export function renderNorthIndianSVG(planets, lagna, signLabels) {
```
to:
```js
export function renderNorthIndianSVG(planets, lagna, signLabels, activeAspects = [], activePlanetColors = {}) {
```

Inside the function, after computing `cellToSign`/`signToCell` (after line ~90), add the sign centroid lookup:

```js
  const signCentroid = {}
  for (let cell = 1; cell <= 12; cell++) {
    signCentroid[cellToSign[cell]] = centroid(NI_POLYS[cell])
  }
```

Change the `parts` array initializer to include the defs block:

```js
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
  ]
```

Update the `placePlanets` call inside the cell loop to pass `activePlanetColors`:

```js
    parts.push(placePlanets(cellPlanets[cell], cx, signY + 4, maxY - 6, activePlanetColors))
```

After the cell loop (before `parts.push('</svg>')`), add the arrow rendering:

```js
  for (const { fromSign, toSigns, color } of activeAspects) {
    const from = signCentroid[fromSign]
    if (!from) continue
    for (const toSign of toSigns) {
      if (toSign === fromSign) continue
      const to = signCentroid[toSign]
      if (!to) continue
      const [x1, y1, x2, y2] = shortenLine(from[0], from[1], to[0], to[1], 18)
      const markerId = `arrow-${color.replace('#', '')}`
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.8" stroke-dasharray="8 5" marker-end="url(#${markerId})" opacity="0.85" style="animation:flowAspect 1.2s linear infinite"/>`)
    }
  }
```

- [ ] **Step 4: Verify file still compiles**

```bash
npm run dev
```

Open browser, load a chart — North Indian chart should render exactly as before (no activeAspects passed yet).

- [ ] **Step 5: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "feat: add animated aspect arrow rendering to North Indian chart"
```

---

## Task 4: Add animated arrow rendering to South Indian SVG

**Files:**
- Modify: `src/ui/chart-svg.js` — `renderSouthIndianSVG()`

- [ ] **Step 1: Update `renderSouthIndianSVG` signature**

Change from:
```js
export function renderSouthIndianSVG(planets, lagna, signLabels, centerLabel = 'Rashi\nChart') {
```
to:
```js
export function renderSouthIndianSVG(planets, lagna, signLabels, centerLabel = 'Rashi\nChart', activeAspects = [], activePlanetColors = {}) {
```

- [ ] **Step 2: Add defs block and SI sign centroids**

Change the `parts` array initializer to include defs:

```js
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
    `<rect x="${cs}" y="${cs}" width="${cs * 2}" height="${cs * 2}" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1.5"/>`,
    ...centerLabel.split('\n').map((line, i, arr) => {
      const totalH = arr.length * 28
      const y = S / 2 - totalH / 2 + i * 28 + 20
      return `<text x="${S/2}" y="${y}" text-anchor="middle" font-size="20" font-weight="700" fill="#c2410c" ${FONT}>${line}</text>`
    }),
  ]
```

After the SI_CELLS loop (before `parts.push('</svg>')`), add SI sign centroid map and arrows:

```js
  const siCentroid = {}
  for (const { sign, col, row } of SI_CELLS) {
    siCentroid[sign] = [col * cs + cs / 2, row * cs + cs / 2]
  }

  for (const { fromSign, toSigns, color } of activeAspects) {
    const from = siCentroid[fromSign]
    if (!from) continue
    for (const toSign of toSigns) {
      if (toSign === fromSign) continue
      const to = siCentroid[toSign]
      if (!to) continue
      const [x1, y1, x2, y2] = shortenLine(from[0], from[1], to[0], to[1], 18)
      const markerId = `arrow-${color.replace('#', '')}`
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.8" stroke-dasharray="8 5" marker-end="url(#${markerId})" opacity="0.85" style="animation:flowAspect 1.2s linear infinite"/>`)
    }
  }
```

- [ ] **Step 3: Update `placePlanets` call inside SI cell loop**

Find the existing `placePlanets` call in `renderSouthIndianSVG`:
```js
    parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, y + cs - 4))
```
Change to:
```js
    parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, y + cs - 4, activePlanetColors))
```

- [ ] **Step 4: Verify SI chart still renders correctly**

```bash
npm run dev
```

Switch to South Indian chart style — should render exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "feat: add animated aspect arrow rendering to South Indian chart"
```

---

## Task 5: Update `renderChartSVG` to pass through new params

**Files:**
- Modify: `src/ui/chart-svg.js` — `renderChartSVG()` (last ~5 lines of file)

- [ ] **Step 1: Update signature and calls**

Change from:
```js
export function renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR, centerLabel) {
  return style === 'south'
    ? renderSouthIndianSVG(planets, lagna, signLabels, centerLabel)
    : renderNorthIndianSVG(planets, lagna, signLabels)
}
```
to:
```js
export function renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR, centerLabel, activeAspects = [], activePlanetColors = {}) {
  return style === 'south'
    ? renderSouthIndianSVG(planets, lagna, signLabels, centerLabel, activeAspects, activePlanetColors)
    : renderNorthIndianSVG(planets, lagna, signLabels, activeAspects, activePlanetColors)
}
```

- [ ] **Step 2: Verify chart still works**

```bash
npm run dev
```

Load a chart — both North and South Indian should render as before. No aspects yet.

- [ ] **Step 3: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "feat: thread activeAspects and activePlanetColors through renderChartSVG"
```

---

## Task 6: Wire up interactivity in `chart.js`

**Files:**
- Modify: `src/tabs/chart.js`

- [ ] **Step 1: Add imports and module state**

At the top of the file, add the import after existing imports:
```js
import { PLANET_COLORS, getAspectedSigns } from '../core/aspects.js'
```

After the existing `let chartStyle = 'north'` and `let divisional = 'D1'` lines, add:
```js
let activePlanets = new Set()
let _dPlanets = null, _dLagna = null, _signLabels = null, _centerLabel = null
```

- [ ] **Step 2: Add `renderSVGOnly` helper**

Add this function before `export function renderChart()`:

```js
function renderSVGOnly() {
  if (!_dPlanets) return
  const activeAspects = _dPlanets
    .filter(p => activePlanets.has(p.abbr))
    .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
  const activePlanetColors = Object.fromEntries(
    _dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]])
  )
  document.getElementById('chart-container').innerHTML =
    renderChartSVG(_dPlanets, _dLagna, chartStyle, _signLabels, _centerLabel, activeAspects, activePlanetColors)
}
```

- [ ] **Step 3: Update `renderChart()` to cache computed values and add buttons**

Inside `renderChart()`, after computing `dPlanets`, `dLagna`, `signLabels`, `centerLabel`, add:

```js
  _dPlanets = dPlanets
  _dLagna = dLagna
  _signLabels = signLabels
  _centerLabel = centerLabel
```

In the `panel.innerHTML` template, update the `.chart-controls` div to add Show All / Hide All buttons:

```js
      <div class="chart-controls">
        <select id="div-select" class="div-select">
          ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === divisional ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
        <div class="chart-style-group">
          <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North</button>
          <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South</button>
        </div>
        <div class="chart-style-group">
          <button id="btn-show-all" class="chart-style-btn">Show All</button>
          <button id="btn-hide-all" class="chart-style-btn">Hide All</button>
        </div>
      </div>
```

- [ ] **Step 4: Wire up event listeners in `renderChart()`**

Replace the existing event listener block at the bottom of `renderChart()`:

```js
  panel.querySelector('#div-select').addEventListener('change', e => {
    divisional = e.target.value
    activePlanets = new Set()
    renderChart()
  })
  panel.querySelector('#btn-north').addEventListener('click', () => { chartStyle = 'north'; renderChart() })
  panel.querySelector('#btn-south').addEventListener('click', () => { chartStyle = 'south'; renderChart() })

  panel.querySelector('#btn-show-all').addEventListener('click', () => {
    dPlanets.forEach(p => activePlanets.add(p.abbr))
    renderSVGOnly()
  })
  panel.querySelector('#btn-hide-all').addEventListener('click', () => {
    activePlanets = new Set()
    renderSVGOnly()
  })

  document.getElementById('chart-container').addEventListener('click', e => {
    const el = e.target.closest('[data-planet]')
    if (!el) return
    const abbr = el.dataset.planet
    if (activePlanets.has(abbr)) activePlanets.delete(abbr)
    else activePlanets.add(abbr)
    renderSVGOnly()
  })
```

- [ ] **Step 5: Verify in browser — full end-to-end test**

```bash
npm run dev
```

1. Load a birth chart.
2. Switch to Chart tab — chart renders normally, no arrows visible.
3. Click a planet label (e.g., "Su") — amber dashed flowing arrows should appear from Sun's house to the 7th house from it.
4. Click another planet (e.g., "Ma") — red arrows from Mars's house to 4th, 7th, 8th from it. Both sets of arrows visible simultaneously.
5. Click "Su" again — amber arrows disappear.
6. Click "Show All" — all 9 planets' colored arrows appear.
7. Click "Hide All" — all arrows clear.
8. Switch divisional (D1 → D9) — arrows clear, chart re-renders correctly.
9. Switch North ↔ South — arrows persist correctly in both styles.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/chart.js
git commit -m "feat: wire planetary aspect toggle, Show All / Hide All controls"
```

---

## Task 7: Push to remote

- [ ] **Step 1: Push**

```bash
git push
```

GitHub Actions will build and deploy to GitHub Pages. Verify at https://priyankgahtori.github.io/hora-prakash/ after ~2 minutes.
