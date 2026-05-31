# Transit Border Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the semi-transparent SVG stack overlay with a single expanded SVG that places transiting planets in labeled border zones outside the natal chart.

**Architecture:** Extract natal chart inner rendering into a `_northChartParts` helper so both the standalone `renderNorthIndianSVG` and the new `renderTransitBorderSVG` can share it. `renderTransitBorderSVG` generates a 640×640 SVG with the natal chart (480×480) centered and 80px border strips on all four sides divided into 12 house zones. South Indian chart receives a `transitPlanets` parameter and renders transit planets in the same sign cells styled in amber. `TransitChartPane._renderOverlay` calls the new function directly; stale CSS is removed.

**Tech Stack:** Vanilla JS, inline SVG, no dependencies. No test suite — verify in browser at `http://localhost:5173/hora-prakash/`.

---

## File Map

| File | Change |
|------|--------|
| `src/ui/chart-svg.js` | Extract `_northChartParts`, add `_southChartParts`, add `renderTransitBorderSVG` |
| `src/components/TransitChartPane.js` | Update `_renderOverlay`, remove overlay legend |
| `src/style.css` | Remove stale overlay CSS (lines ~1574–1606), add `.transit-border-chart` |

---

### Task 1: Extract `_northChartParts` helper in `chart-svg.js`

**Files:**
- Modify: `src/ui/chart-svg.js`

The current `renderNorthIndianSVG` (line 112) builds an SVG string including the `<svg>` wrapper. Extract the inner content generation into `_northChartParts` so it can be reused inside a `<g transform>` block.

- [ ] **Step 1: Replace `renderNorthIndianSVG` with this refactored version**

Open `src/ui/chart-svg.js`. Replace the entire `renderNorthIndianSVG` function (lines 112–175) with:

```js
function _northChartParts(planets, lagna, signLabels, activeAspects, activePlanetColors) {
  const lagnaSign = lagna.sign

  const cellToSign = {}, signToCell = {}
  for (let cell = 1; cell <= 12; cell++) {
    const sign = ((lagnaSign - 1 + cell - 1) % 12) + 1
    cellToSign[cell] = sign
    signToCell[sign] = cell
  }

  const signCentroid = {}
  for (let cell = 1; cell <= 12; cell++) {
    signCentroid[cellToSign[cell]] = centroid(NI_POLYS[cell])
  }

  const cellPlanets = {}
  for (let c = 1; c <= 12; c++) cellPlanets[c] = []
  cellPlanets[1].push({ abbr: 'Asc', degree: lagna.degree, retrograde: false, isLagna: true })
  for (const p of planets) {
    const cell = signToCell[p.sign]
    if (cell) cellPlanets[cell].push(p)
  }

  const parts = []
  for (let cell = 1; cell <= 12; cell++) {
    const poly = NI_POLYS[cell]
    parts.push(`<polygon points="${toPts(poly)}" fill="transparent" stroke="#94a3b8" stroke-width="1.2" data-sign="${cellToSign[cell]}" style="cursor:context-menu" pointer-events="all"/>`)
    const [cx, cy] = centroid(poly)
    const { minY, maxY } = bbox(poly)
    const cellH = maxY - minY
    const signFontSize = 14
    const signY = minY + cellH * 0.22 + signFontSize
    const sign = cellToSign[cell]
    parts.push(`<text x="${cx.toFixed(1)}" y="${signY.toFixed(1)}" text-anchor="middle" font-size="${signFontSize}" font-weight="600" fill="#64748b" ${FONT}><tspan>${signLabels[sign - 1]}</tspan><tspan font-size="10" fill="#94a3b8" dy="-1"> ${sign}</tspan></text>`)
    parts.push(placePlanets(cellPlanets[cell], cx, signY + 4, maxY - 6, activePlanetColors))
  }

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

  return parts
}

export function renderNorthIndianSVG(planets, lagna, signLabels, activeAspects = [], activePlanetColors = {}) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
    ..._northChartParts(planets, lagna, signLabels, activeAspects, activePlanetColors),
    '</svg>',
  ]
  return parts.join('\n')
}
```

- [ ] **Step 2: Verify natal chart still renders**

Run: `npm run dev`
Open `http://localhost:5173/hora-prakash/`, load any birth chart, check Chart tab — natal North Indian chart should look identical to before.

- [ ] **Step 3: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "refactor: extract _northChartParts helper from renderNorthIndianSVG"
```

---

### Task 2: Extract `_southChartParts` helper in `chart-svg.js`

**Files:**
- Modify: `src/ui/chart-svg.js`

Same extraction as Task 1 but for the South Indian chart. This lets `renderTransitBorderSVG` render transit planets in South Indian sign cells without duplicating the cell layout logic.

- [ ] **Step 1: Replace `renderSouthIndianSVG` with refactored version**

Replace the entire `renderSouthIndianSVG` function (currently line 177) with:

```js
function _southChartParts(planets, lagna, signLabels, centerLabel = 'Rashi\nChart', activeAspects = [], activePlanetColors = {}, transitPlanets = [], transitFilter = new Set()) {
  const lagnaSign = lagna.sign
  const cs = S / 4  // 120px per cell

  const signPlanets = {}
  for (let s = 1; s <= 12; s++) signPlanets[s] = []
  signPlanets[lagnaSign].push({ abbr: 'Asc', degree: lagna.degree, retrograde: false, isLagna: true })
  for (const p of planets) signPlanets[p.sign].push(p)

  // Transit planets grouped by sign
  const transitBySign = {}
  for (let s = 1; s <= 12; s++) transitBySign[s] = []
  for (const p of (transitPlanets || [])) {
    if (transitFilter.has(p.abbr)) transitBySign[p.sign].push(p)
  }

  const parts = [
    `<rect x="${cs}" y="${cs}" width="${cs * 2}" height="${cs * 2}" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1.5"/>`,
    ...centerLabel.split('\n').map((line, i, arr) => {
      const totalH = arr.length * 28
      const y = S / 2 - totalH / 2 + i * 28 + 20
      return `<text x="${S/2}" y="${y}" text-anchor="middle" font-size="20" font-weight="700" fill="#c2410c" ${FONT}>${line}</text>`
    }),
  ]

  for (const { sign, col, row } of SI_CELLS) {
    const x = col * cs, y = row * cs
    const house = ((sign - lagnaSign + 12) % 12) + 1
    const isLagnaCell = sign === lagnaSign
    const hasTransit = transitBySign[sign].length > 0

    parts.push(`<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${isLagnaCell ? '#fff7ed' : '#fafafa'}" stroke="#94a3b8" stroke-width="1.2" data-sign="${sign}" style="cursor:context-menu"/>`)
    const headerH = 24
    parts.push(`<text x="${x + 5}" y="${y + headerH - 4}" font-size="14" font-weight="600" fill="#475569" ${FONT}><tspan>${signLabels[sign - 1]}</tspan><tspan font-size="10" fill="#94a3b8" dy="-1"> ${sign}</tspan></text>`)
    parts.push(`<text x="${x + cs - 5}" y="${y + headerH - 4}" text-anchor="end" font-size="14" font-weight="600" fill="${isLagnaCell ? '#c2410c' : '#94a3b8'}" ${FONT}>${house}</text>`)
    parts.push(`<line x1="${x + 2}" y1="${y + headerH}" x2="${x + cs - 2}" y2="${y + headerH}" stroke="#e2e8f0" stroke-width="0.8"/>`)

    const cx = x + cs / 2

    if (hasTransit) {
      // Split cell vertically: natal top half, separator, transit bottom half
      const midY = y + headerH + 2 + (cs - headerH - 4) / 2
      parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, midY - 2, activePlanetColors))
      parts.push(`<line x1="${x + 4}" y1="${midY}" x2="${x + cs - 4}" y2="${midY}" stroke="#fde68a" stroke-width="0.8" stroke-dasharray="3 2"/>`)
      // Transit planets in amber
      const tp = transitBySign[sign].map(p => ({
        ...p,
        _transitColor: true,
      }))
      parts.push(placeTransitPlanets(tp, cx, midY + 2, y + cs - 4))
    } else {
      parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, y + cs - 4, activePlanetColors))
    }
  }

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

  return parts
}

export function renderSouthIndianSVG(planets, lagna, signLabels, centerLabel = 'Rashi\nChart', activeAspects = [], activePlanetColors = {}) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
    ..._southChartParts(planets, lagna, signLabels, centerLabel, activeAspects, activePlanetColors),
    '</svg>',
  ]
  return parts.join('\n')
}
```

- [ ] **Step 2: Add `placeTransitPlanets` helper** (add immediately after `placePlanets` function, around line 110)

```js
function placeTransitPlanets(ps, cx, areaTop, areaBottom) {
  if (ps.length === 0) return ''
  const areaH = areaBottom - areaTop
  const maxFont = 13
  const minFont = 10
  const lineH = Math.max(minFont + 2, Math.min(maxFont + 3, areaH / ps.length))
  const fontSize = Math.round(Math.min(maxFont, lineH - 2))
  const blockH = (ps.length - 1) * lineH
  const firstY = areaTop + (areaH - blockH) / 2 + fontSize * 0.36

  return ps.map((p, i) => {
    const r = p.retrograde ? '℞' : ''
    const label = `${p.abbr}${r}`
    const y = firstY + i * lineH
    return `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="#d97706" font-weight="600" ${FONT} data-planet="${p.abbr}" data-chart="transit" style="cursor:pointer">${label}</text>`
  }).join('\n')
}
```

- [ ] **Step 3: Verify south Indian natal chart unchanged**

`npm run dev`, load chart, switch to South Indian style — should look same as before.

- [ ] **Step 4: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "refactor: extract _southChartParts, add placeTransitPlanets helper"
```

---

### Task 3: Add `renderTransitBorderSVG` to `chart-svg.js`

**Files:**
- Modify: `src/ui/chart-svg.js`

Add the main export for the border overlay. For North Indian: 640×640 SVG with natal chart at center and 12 border house zones. For South Indian: 480×480 SVG with transit planets co-rendered in sign cells.

- [ ] **Step 1: Add `renderTransitBorderSVG` at end of `chart-svg.js` (before the last line)**

```js
const BORDER = 80  // border strip width in px
const TOTAL  = S + BORDER * 2  // 640

// [house, x, y, w, h] for each of the 12 border sections
function _borderSections() {
  const third = S / 3  // 160
  return [
    // Top strip (y: 0→BORDER)
    { house: 2,  x: BORDER,              y: 0,         w: third, h: BORDER },
    { house: 1,  x: BORDER + third,      y: 0,         w: third, h: BORDER },
    { house: 12, x: BORDER + third * 2,  y: 0,         w: third, h: BORDER },
    // Left strip (x: 0→BORDER)
    { house: 3,  x: 0, y: BORDER,              w: BORDER, h: third },
    { house: 4,  x: 0, y: BORDER + third,      w: BORDER, h: third },
    { house: 5,  x: 0, y: BORDER + third * 2,  w: BORDER, h: third },
    // Bottom strip (y: BORDER+S → TOTAL)
    { house: 6,  x: BORDER,              y: BORDER + S, w: third, h: BORDER },
    { house: 7,  x: BORDER + third,      y: BORDER + S, w: third, h: BORDER },
    { house: 8,  x: BORDER + third * 2,  y: BORDER + S, w: third, h: BORDER },
    // Right strip (x: BORDER+S → TOTAL)
    { house: 11, x: BORDER + S, y: BORDER,              w: BORDER, h: third },
    { house: 10, x: BORDER + S, y: BORDER + third,      w: BORDER, h: third },
    { house: 9,  x: BORDER + S, y: BORDER + third * 2,  w: BORDER, h: third },
  ]
}

export function renderTransitBorderSVG(natalPlanets, natalLagna, transitPlanets, style, filter, activeAspects = [], activePlanetColors = {}) {
  if (style === 'south') {
    // South Indian: co-render transit planets in same sign cells
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
      `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
      buildArrowDefs(activeAspects),
      ..._southChartParts(natalPlanets, natalLagna, SIGN_ABBR, 'Natal\nTransit', activeAspects, activePlanetColors, transitPlanets, filter),
      '</svg>',
    ]
    return parts.join('\n')
  }

  // North Indian: expanded 640×640 with border zones
  const byHouse = {}
  for (const p of (transitPlanets || [])) {
    if (!filter.has(p.abbr)) continue
    if (!byHouse[p.house]) byHouse[p.house] = []
    byHouse[p.house].push(p)
  }

  const sections = _borderSections()

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TOTAL} ${TOTAL}" style="width:100%;max-width:${TOTAL}px">`,
    `<rect width="${TOTAL}" height="${TOTAL}" fill="#f8fafc" rx="6"/>`,
    // Corner squares
    `<rect x="0"            y="0"            width="${BORDER}" height="${BORDER}" fill="#f1f5f9"/>`,
    `<rect x="${BORDER + S}" y="0"            width="${BORDER}" height="${BORDER}" fill="#f1f5f9"/>`,
    `<rect x="0"            y="${BORDER + S}" width="${BORDER}" height="${BORDER}" fill="#f1f5f9"/>`,
    `<rect x="${BORDER + S}" y="${BORDER + S}" width="${BORDER}" height="${BORDER}" fill="#f1f5f9"/>`,
    buildArrowDefs(activeAspects),
  ]

  // Border sections
  for (const sec of sections) {
    const { house, x, y, w, h } = sec
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fffbeb" stroke="#fde68a" stroke-width="0.8"/>`)
    parts.push(`<text x="${(x + 3).toFixed(1)}" y="${(y + 10).toFixed(1)}" font-size="9" fill="#94a3b8" ${FONT}>H${house}</text>`)

    const ps = byHouse[house] || []
    if (ps.length > 0) {
      const cx = x + w / 2
      const areaTop    = y + 13
      const areaBottom = y + h - 2
      const areaH      = areaBottom - areaTop
      const lineH      = Math.max(11, Math.min(15, areaH / ps.length))
      const fontSize   = Math.round(Math.min(12, lineH - 2))
      const blockH     = (ps.length - 1) * lineH
      const firstY     = areaTop + (areaH - blockH) / 2 + fontSize * 0.36
      ps.forEach((p, i) => {
        const label = p.abbr + (p.retrograde ? '℞' : '')
        const py    = firstY + i * lineH
        parts.push(`<text x="${cx.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="#d97706" font-weight="600" ${FONT} data-planet="${p.abbr}" data-chart="transit" style="cursor:pointer">${label}</text>`)
      })
    }
  }

  // Natal chart body translated to center
  parts.push(`<g transform="translate(${BORDER},${BORDER})">`)
  parts.push(`<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`)
  parts.push(..._northChartParts(natalPlanets, natalLagna, SIGN_ABBR, activeAspects, activePlanetColors))
  parts.push(`</g>`)

  parts.push('</svg>')
  return parts.join('\n')
}
```

- [ ] **Step 2: Verify `renderChartSVG` export at bottom is unchanged**

Line 240–244 of the original file (now shifted) should still read:
```js
export function renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR, centerLabel, activeAspects = [], activePlanetColors = {}) {
  return style === 'south'
    ? renderSouthIndianSVG(planets, lagna, signLabels, centerLabel, activeAspects, activePlanetColors)
    : renderNorthIndianSVG(planets, lagna, signLabels, activeAspects, activePlanetColors)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/chart-svg.js
git commit -m "feat: add renderTransitBorderSVG with North border zones and South co-render"
```

---

### Task 4: Update `TransitChartPane._renderOverlay`

**Files:**
- Modify: `src/components/TransitChartPane.js`

Replace the CSS-stacked two-SVG approach with a single call to `renderTransitBorderSVG`. Remove the planet legend (no longer needed — transit planets are now clickable directly in the border zones or sign cells).

- [ ] **Step 1: Update the import at top of `TransitChartPane.js`**

Change line 1:
```js
import { renderChartSVG } from '../ui/chart-svg.js'
```
to:
```js
import { renderChartSVG, renderTransitBorderSVG } from '../ui/chart-svg.js'
```

- [ ] **Step 2: Replace `_renderOverlay` method entirely**

Replace the entire `_renderOverlay` method (lines 76–101) with:

```js
_renderOverlay(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, natalAsp, transitAsp) {
  const svg = renderTransitBorderSVG(
    natalPlanets, natalLagna,
    transitPlanets || [],
    chartStyle,
    filter,
    natalAsp.activeAspects,
    natalAsp.activePlanetColors
  )
  this.el.innerHTML = `
    <div class="transit-overlay-pane">
      <div class="transit-chart-label">Natal + Transit</div>
      <div class="transit-border-chart" data-chart="natal">${svg}</div>
    </div>`
}
```

Note: `data-chart="natal"` on the wrapper handles natal planet clicks. Transit planet `<text>` elements inside the SVG have `data-chart="transit"` directly, so `e.target.closest('[data-chart]')` in `_bindEvents` finds the more-specific element first.

- [ ] **Step 3: Verify overlay toggle works**

`npm run dev`, load chart, go to Transit tab, click "Dual ⇌" to switch to Overlay mode. Should show single 640×640 SVG (North) or 480×480 (South) with transit planets in border zones. Click transit planet in border → aspect arrows appear on natal chart. Click natal planet inside chart → natal aspect arrows.

- [ ] **Step 4: Commit**

```bash
git add src/components/TransitChartPane.js
git commit -m "feat: update TransitChartPane overlay to use renderTransitBorderSVG"
```

---

### Task 5: Update CSS

**Files:**
- Modify: `src/style.css`

Remove stale overlay CSS rules, add minimal rule for the new border chart container.

- [ ] **Step 1: Remove stale CSS rules**

In `src/style.css`, find and remove these rules (lines ~1574–1606):
```css
.transit-overlay-stack { ... }
.transit-overlay-natal svg { ... }
.transit-overlay-transit { ... }
.transit-overlay-transit svg { ... }
.transit-overlay-legend { ... }
.transit-overlay-chip { ... }
.transit-overlay-chip:hover { ... }
```

Keep `.transit-overlay-pane` (still used as the wrapper flex container).

- [ ] **Step 2: Add `.transit-border-chart` rule**

After `.transit-overlay-pane` rule, add:
```css
.transit-border-chart svg { width: 100%; max-width: 640px; height: auto; display: block; }
```

- [ ] **Step 3: Verify no visual regressions**

Check: Chart tab, Dasha tab, Strength tab — should be unaffected. Transit dual view should be unaffected. Transit overlay should show new border chart layout.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "style: remove stale overlay CSS, add transit-border-chart rule"
```

---

## Manual Verification Checklist

After all tasks complete, verify in browser (`http://localhost:5173/hora-prakash/`):

- [ ] Chart tab — natal North Indian chart renders correctly
- [ ] Chart tab — natal South Indian chart renders correctly
- [ ] Transit tab dual view — two side-by-side charts, unchanged
- [ ] Transit overlay (North) — single 640×640 SVG, 12 border zones visible with house labels, transit planets in amber in their house zones
- [ ] Transit overlay (South) — single 480×480 SVG, transit planets in amber below separator line in correct sign cells
- [ ] Click transit planet in border zone → aspect arrows appear on natal chart for that planet
- [ ] Click natal planet inside chart → natal aspect arrows only
- [ ] Planets filter chips (toolbar) — filtered planets disappear from border zones
- [ ] North/South toggle in transit toolbar — overlay re-renders in correct style
