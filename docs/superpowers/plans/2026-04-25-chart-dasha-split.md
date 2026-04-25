# Chart Dasha Split Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, resizable Dasha panel to the Birth Chart tab that shows configurable dasha cards beside the chart on desktop (1 and 2-chart views only), with pill tabs + swipe on mobile, and global swipe navigation between all top-level tabs.

**Architecture:** Extract `renderDashaCards(container, cards)` from `dasha.js` for reuse; `chart.js` owns the split layout with a CSS grid + drag handle; new state fields `showDasha`, `dashaCards`, `splitRatio` are stored in `uiState.chart` per session.

**Tech Stack:** Vanilla JS, CSS Grid, SVG (existing), no new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/sessions.js` | Add `showDasha`, `dashaCards`, `splitRatio` to `defaultChartUI()` |
| `src/tabs/dasha.js` | Export `renderDashaCards(container, cards)` — renders dasha cards without drag handles or settings controls |
| `src/tabs/chart.js` | Split wrapper layout, drag handle logic, Dasha toggle button + card popover, split preset buttons, mobile pill tabs |
| `src/ui/tabs.js` | Add global swipe listener on `<main>` for top-level tab navigation |
| `src/style.css` | `.chart-split-wrapper`, `.chart-pane`, `.split-handle`, `.dasha-pane`, `.chart-dasha-tabs`, `.ctrl-sep`, mobile breakpoint rules |

---

## Task 1: Add state fields to `defaultChartUI()`

**Files:**
- Modify: `src/sessions.js`

- [ ] **Step 1: Add the three new fields**

In `src/sessions.js`, update `defaultChartUI()`:

```js
export function defaultChartUI() {
  return {
    chartStyle:    'north',
    viewMode:      '1',
    divisional:    'D1',
    multiDivs:     ['D1','D9','D3','D10'],
    activeMultiTab: 0,
    tableDiv:      'D1',
    activePlanets:      new Set(),
    multiActivePlanets: [new Set(), new Set(), new Set(), new Set()],
    showDasha:   false,
    dashaCards:  ['vimshottari'],
    splitRatio:  0.55,
  }
}
```

- [ ] **Step 2: Verify dev server still starts**

```bash
npm run dev
```
Expected: Vite dev server starts at http://localhost:5173/hora-prakash/ with no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/sessions.js
git commit -m "feat: add showDasha, dashaCards, splitRatio to defaultChartUI"
```

---

## Task 2: Extract `renderDashaCards` from `dasha.js`

**Files:**
- Modify: `src/tabs/dasha.js`

This task pulls the card-rendering logic out of `renderDasha()` into a new exported function that `chart.js` can call. It takes a DOM container and an array of card keys (`'vimshottari'`, `'age'`, `'progression'`).

- [ ] **Step 1: Add the exported function at the bottom of `src/tabs/dasha.js`**

Add this after the `renderDasha` function (before the helper functions):

```js
export async function renderDashaCards(container, cards) {
  if (!state.dasha || !state.birth) return
  const { dasha, birth } = state
  const ui = d()

  if (ui.selectedProgLord === null) {
    const currentMaha = dasha.find(m => isCurrentPeriod(m.start, m.end)) ?? dasha[0]
    ui.selectedProgLord = currentMaha.planet
    ui.progNavIndex     = dasha.findIndex(m => m.planet === ui.selectedProgLord)
  }

  let html = ''
  if (cards.includes('vimshottari')) {
    const rows = await buildDashaRows(dasha, ui)
    html += `
      <div class="card" id="dasha-panel-vimshottari">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
          <button id="dasha-panel-mode-btn" class="dasha-mode-btn${(ui.focusedMode ?? true) ? ' focused-active' : ''}">${(ui.focusedMode ?? true) ? 'Focused' : 'Full'}</button>
          <h3 style="margin:0;font-size:0.95rem">Vimshottari Dasha — ${birth.name}</h3>
        </div>
        <div id="dasha-panel-breadcrumb-wrap">${(ui.focusedMode ?? true) && (ui.focusedPath?.length > 0) ? renderBreadcrumb(dasha, ui) : ''}</div>
        <div class="table-scroll"><table class="dasha-table">
          <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`
  }
  if (cards.includes('age')) {
    const ageRef = ui.ageAsOf ?? (ui.ageNavCycle !== null ? offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12) : new Date())
    html += renderAgeProgression(birth.dob, ageRef).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
  }
  if (cards.includes('progression')) {
    html += renderProgression(birth.dob, dasha).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
  }

  container.innerHTML = html

  // Wire up vimshottari interactions if rendered
  if (cards.includes('vimshottari')) {
    const modBtn = container.querySelector('#dasha-panel-mode-btn')
    if (modBtn) {
      modBtn.addEventListener('click', () => {
        const wasFocused = ui.focusedMode ?? true
        ui.focusedMode = !wasFocused
        if (ui.focusedMode) ui.focusedPath = inferFocusedPath(dasha, ui)
        modBtn.textContent = ui.focusedMode ? 'Focused' : 'Full'
        modBtn.classList.toggle('focused-active', ui.focusedMode)
        buildDashaRows(dasha, ui).then(rows => {
          container.querySelector('.dasha-table tbody').innerHTML = rows
          container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
            (ui.focusedMode && (ui.focusedPath?.length > 0)) ? renderBreadcrumb(dasha, ui) : ''
        }).catch(console.error)
      })
    }

    container.querySelector('#dasha-panel-breadcrumb-wrap')?.addEventListener('click', e => {
      const crumbBtn = e.target.closest('[data-crumb-depth]')
      if (!crumbBtn) return
      const depth = parseInt(crumbBtn.dataset.crumbDepth)
      ui.focusedPath = depth < 0 ? [] : (ui.focusedPath ?? []).slice(0, depth + 1)
      buildDashaRows(state.dasha, ui).then(rows => {
        container.querySelector('.dasha-table tbody').innerHTML = rows
        container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
          ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
      }).catch(console.error)
    })

    container.querySelector('.dasha-table tbody')?.addEventListener('click', async (e) => {
      const row = e.target.closest('tr[data-toggle]')
      if (!row) return
      const ui    = d()
      const path  = row.dataset.path
      const depth = parseInt(row.dataset.depth)
      const parts = path.split('/')

      if (ui.focusedMode ?? true) {
        const fp = ui.focusedPath ?? []
        const isExpanded = fp.length > depth && fp[depth] === parts[depth]
        ui.focusedPath = isExpanded ? fp.slice(0, depth) : parts.slice(0, depth + 1)
        const rows = await buildDashaRows(state.dasha, ui)
        container.querySelector('.dasha-table tbody').innerHTML = rows
        container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
          ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
      }
    })
  }

  // Wire up toggle buttons for age and progression cards (collapse/expand)
  container.querySelector('#age-toggle-btn')?.addEventListener('click', e => {
    const ui = d()
    ui.ageCollapsed = !ui.ageCollapsed
    document.getElementById('age-prog-body').style.display = ui.ageCollapsed ? 'none' : ''
    e.target.textContent = ui.ageCollapsed ? '▶' : '▼'
  })
  container.querySelector('#prog-toggle-btn')?.addEventListener('click', e => {
    const ui = d()
    ui.progCollapsed = !ui.progCollapsed
    document.getElementById('prog-body').style.display = ui.progCollapsed ? 'none' : ''
    e.target.textContent = ui.progCollapsed ? '▶' : '▼'
  })
  container.querySelector('#age-prev-btn')?.addEventListener('click', () => {
    const ui = d()
    const curCycle = ui.ageNavCycle ?? Math.floor(calcAgeYearsFromDob(birth.dob) / 12)
    ui.ageNavCycle = Math.max(0, curCycle - 1)
    ui.ageAsOf = null
    container.querySelector('#age-prog-section').outerHTML = renderAgeProgression(birth.dob, offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12)).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
  })
  container.querySelector('#age-next-btn')?.addEventListener('click', () => {
    const ui = d()
    const curCycle = ui.ageNavCycle ?? Math.floor(calcAgeYearsFromDob(birth.dob) / 12)
    ui.ageNavCycle = Math.min(9, curCycle + 1)
    ui.ageAsOf = null
    container.querySelector('#age-prog-section').outerHTML = renderAgeProgression(birth.dob, offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12)).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
  })
  container.onchange = e => {
    if (e.target.id === 'age-asof-input') {
      const ui = d()
      ui.ageAsOf = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
      ui.ageNavCycle = null
      container.querySelector('#age-prog-section').outerHTML = renderAgeProgression(birth.dob, ui.ageAsOf ?? new Date()).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    } else if (e.target.id === 'prog-lord-select') {
      const ui = d()
      ui.selectedProgLord = e.target.value
      ui.progNavIndex = dasha.findIndex(m => m.planet === ui.selectedProgLord)
      container.querySelector('#prog-section').outerHTML = renderProgression(birth.dob, dasha).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    }
  }
}
```

- [ ] **Step 2: Verify no regressions on Dasha tab**

Open http://localhost:5173/hora-prakash/, load a birth chart, go to the Dasha tab. The Dasha tab should work exactly as before (no visual change yet).

- [ ] **Step 3: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: export renderDashaCards for use in chart split panel"
```

---

## Task 3: Add CSS for split layout

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add split layout CSS**

Add the following block to `src/style.css` after the `.chart-controls` block (after line ~374):

```css
/* ── Chart / Dasha split panel ── */
.chart-split-wrapper {
  display: grid;
  gap: 0;
  min-height: 0;
}

.chart-pane {
  min-width: 0;
  min-height: 0;
}

.dasha-pane {
  min-width: 0;
  overflow-y: auto;
  max-height: 80vh;
  border-left: 1px solid var(--border);
  padding-left: 1rem;
}

.split-handle {
  width: 6px;
  cursor: col-resize;
  background: var(--border);
  border-radius: 3px;
  transition: background 0.15s;
  user-select: none;
  position: relative;
  z-index: 1;
}
.split-handle:hover,
.split-handle.dragging { background: var(--primary); }

.ctrl-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 0.25rem;
  flex-shrink: 0;
}

/* Dasha card selector popover */
.dasha-toggle-btn { position: relative; }
.dasha-card-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 0.5rem 0.75rem;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 180px;
  white-space: nowrap;
}
.dasha-card-popover label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  cursor: pointer;
}

/* Split preset buttons */
.split-preset-group {
  display: flex;
  gap: 0;
  border: 1.5px solid var(--border);
  border-radius: 7px;
  overflow: hidden;
}
.split-preset-btn {
  border: none;
  border-radius: 0;
  margin: 0;
  border-right: 1px solid var(--border);
  padding: 0.3rem 0.55rem;
  font-size: 0.75rem;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}
.split-preset-btn:last-child { border-right: none; }
.split-preset-btn:hover { background: #f1f5f9; color: var(--text); }
.split-preset-btn.active { background: var(--primary); color: var(--primary-text); }

/* Chart/Dasha pill tabs — mobile only */
.chart-dasha-tabs {
  display: none;
}

/* Mobile overrides */
@media (max-width: 600px) {
  .split-handle { display: none !important; }
  .split-preset-group { display: none !important; }
  .dasha-pane {
    border-left: none;
    padding-left: 0;
    max-height: none;
    overflow-y: visible;
  }
  .chart-split-wrapper {
    display: block !important;
  }
  .chart-dasha-tabs {
    display: flex;
    gap: 0;
    border: 1.5px solid var(--border);
    border-radius: 7px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }
  .chart-dasha-tab-btn {
    flex: 1;
    border: none;
    border-radius: 0;
    margin: 0;
    border-right: 1px solid var(--border);
    padding: 0.35rem 0.75rem;
    font-size: 0.82rem;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
  }
  .chart-dasha-tab-btn:last-child { border-right: none; }
  .chart-dasha-tab-btn.active { background: var(--primary); color: var(--primary-text); }
}
```

- [ ] **Step 2: Verify no visual regressions**

Open the app, load a chart. The Chart tab should look exactly as before.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat: add CSS for chart/dasha split layout, pill tabs, drag handle"
```

---

## Task 4: Build split layout in `chart.js` (desktop)

**Files:**
- Modify: `src/tabs/chart.js`

This task wires up the split wrapper, the drag handle, and calls `renderDashaCards` when `showDasha` is true. No Dasha button in the UI yet (Task 5).

- [ ] **Step 1: Import `renderDashaCards` at the top of `chart.js`**

Add to the existing imports at the top of `src/tabs/chart.js`:

```js
import { renderDashaCards } from './dasha.js'
```

- [ ] **Step 2: Replace the `panel.innerHTML = ...` wrapper structure**

In `renderChart()`, find the final `panel.innerHTML = \`...\`` assignment (around line 244). Replace the wrapping structure so the chart content goes inside `.chart-pane` and the dasha panel goes alongside it. The full replacement:

```js
const ui2 = c()
const showDasha = ui2.showDasha && ui2.viewMode !== '4'
const splitRatio = ui2.splitRatio ?? 0.55
const gridCols = `${splitRatio}fr 6px ${1 - splitRatio}fr`

panel.innerHTML = `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem">
      <h2 style="margin:0">${maskedName}</h2>
      <button id="btn-privacy" title="${privacyOn ? 'Show details' : 'Hide details'}" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0.2rem;margin-top:0.1rem;border-radius:4px;line-height:1;display:flex;align-items:center" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">${privacyOn ? EYE_SHUT : EYE_OPEN}</button>
    </div>
    <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${maskedDetails}</p>
    <div class="chart-controls">
      ${divSelectHtmlUnified}
      <div class="chart-style-group">
        <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North</button>
        <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South</button>
      </div>
      <div class="chart-style-group view-mode-group">
        <button id="btn-view-1" class="chart-style-btn${viewMode === '1' ? ' active' : ''}" title="Single chart">1</button>
        <button id="btn-view-2" class="chart-style-btn${viewMode === '2' ? ' active' : ''}" title="Two charts">2</button>
        <button id="btn-view-4" class="chart-style-btn${viewMode === '4' ? ' active' : ''}" title="Four charts">4</button>
      </div>
      ${aspectBtns}
    </div>
    <div class="chart-split-wrapper" id="chart-split-wrapper"${showDasha ? ` style="grid-template-columns:${gridCols}"` : ''}>
      <div class="chart-pane" id="chart-pane">
        ${chartArea}
        ${planetTable}
      </div>
      ${showDasha ? `<div class="split-handle" id="split-handle"></div><div class="dasha-pane" id="dasha-pane"></div>` : ''}
    </div>
  </div>
`
```

- [ ] **Step 3: Call `renderDashaCards` after setting innerHTML**

After the `panel.innerHTML = ...` assignment and before the event listener wiring, add:

```js
if (showDasha) {
  const dashaPane = panel.querySelector('#dasha-pane')
  if (dashaPane) renderDashaCards(dashaPane, ui2.dashaCards).catch(console.error)
}
```

- [ ] **Step 4: Wire up the drag handle**

After the above block, add the drag handle logic:

```js
const handle = panel.querySelector('#split-handle')
const wrapper = panel.querySelector('#chart-split-wrapper')
if (handle && wrapper) {
  const SNAP_POINTS = [0.40, 0.50, 0.60]
  const SNAP_THRESHOLD = 0.03

  handle.addEventListener('mousedown', e => {
    e.preventDefault()
    handle.classList.add('dragging')
    const rect = wrapper.getBoundingClientRect()

    function onMove(ev) {
      let ratio = (ev.clientX - rect.left) / rect.width
      // Account for the 6px handle: ratio is fraction of total width, handle is ~6px
      ratio = Math.max(0.2, Math.min(0.8, ratio))
      wrapper.style.gridTemplateColumns = `${ratio}fr 6px ${1 - ratio}fr`
      wrapper._liveRatio = ratio
    }

    function onUp() {
      handle.classList.remove('dragging')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      let ratio = wrapper._liveRatio ?? c().splitRatio
      const snap = SNAP_POINTS.find(s => Math.abs(ratio - s) <= SNAP_THRESHOLD)
      if (snap !== undefined) ratio = snap
      ratio = Math.round(ratio * 1000) / 1000
      c().splitRatio = ratio
      wrapper.style.gridTemplateColumns = `${ratio}fr 6px ${1 - ratio}fr`
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}
```

- [ ] **Step 5: Verify split renders**

Temporarily set `showDasha: true` in `defaultChartUI()` in `sessions.js`, reload the app, load a chart. You should see the chart on the left and an empty dasha pane on the right (dasha cards come in Task 5 once the toggle button sets `showDasha`). Revert `showDasha` back to `false` after verifying.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/chart.js
git commit -m "feat: add split layout and drag handle to chart tab"
```

---

## Task 5: Add Dasha toggle button and card selector to controls bar

**Files:**
- Modify: `src/tabs/chart.js`

- [ ] **Step 1: Add the Dasha toggle button and split presets to the controls HTML**

In `renderChart()`, replace the existing `chart-controls` div HTML. Find this block (added in Task 4):

```js
    <div class="chart-controls">
      ${divSelectHtmlUnified}
      <div class="chart-style-group">
        <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North</button>
        <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South</button>
      </div>
      <div class="chart-style-group view-mode-group">
        <button id="btn-view-1" class="chart-style-btn${viewMode === '1' ? ' active' : ''}" title="Single chart">1</button>
        <button id="btn-view-2" class="chart-style-btn${viewMode === '2' ? ' active' : ''}" title="Two charts">2</button>
        <button id="btn-view-4" class="chart-style-btn${viewMode === '4' ? ' active' : ''}" title="Four charts">4</button>
      </div>
      ${aspectBtns}
    </div>
```

Replace with:

```js
    <div class="chart-controls">
      ${divSelectHtmlUnified}
      <div class="chart-style-group">
        <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North</button>
        <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South</button>
      </div>
      <div class="chart-style-group view-mode-group">
        <button id="btn-view-1" class="chart-style-btn${viewMode === '1' ? ' active' : ''}" title="Single chart">1</button>
        <button id="btn-view-2" class="chart-style-btn${viewMode === '2' ? ' active' : ''}" title="Two charts">2</button>
        <button id="btn-view-4" class="chart-style-btn${viewMode === '4' ? ' active' : ''}" title="Four charts">4</button>
      </div>
      ${aspectBtns}
      ${viewMode !== '4' ? `
        <span class="ctrl-sep"></span>
        <div class="dasha-toggle-btn" id="dasha-toggle-wrapper" style="position:relative">
          <button id="btn-dasha-toggle" class="chart-style-btn${showDasha ? ' active' : ''}" title="Show Dasha panel">Dasha</button>
          <div id="dasha-card-popover" class="dasha-card-popover" style="display:none">
            <label><input type="checkbox" id="dasha-card-vimshottari" value="vimshottari" ${ui2.dashaCards.includes('vimshottari') ? 'checked' : ''}> Vimshottari</label>
            <label><input type="checkbox" id="dasha-card-age" value="age" ${ui2.dashaCards.includes('age') ? 'checked' : ''}> Age Progression</label>
            <label><input type="checkbox" id="dasha-card-progression" value="progression" ${ui2.dashaCards.includes('progression') ? 'checked' : ''}> Dasha Progression</label>
          </div>
        </div>
        ${showDasha ? `
          <div class="split-preset-group">
            <button class="split-preset-btn${Math.abs((ui2.splitRatio ?? 0.55) - 0.40) < 0.02 ? ' active' : ''}" data-ratio="0.4">40/60</button>
            <button class="split-preset-btn${Math.abs((ui2.splitRatio ?? 0.55) - 0.50) < 0.02 ? ' active' : ''}" data-ratio="0.5">50/50</button>
            <button class="split-preset-btn${Math.abs((ui2.splitRatio ?? 0.55) - 0.60) < 0.02 ? ' active' : ''}" data-ratio="0.6">60/40</button>
          </div>` : ''}
      ` : ''}
    </div>
```

- [ ] **Step 2: Wire up Dasha toggle button events**

After the drag handle wiring block (end of the event listener section), add:

```js
// Dasha toggle button
const dashaToggleBtn = panel.querySelector('#btn-dasha-toggle')
const dashaPopover   = panel.querySelector('#dasha-card-popover')
const dashaWrapper   = panel.querySelector('#dasha-toggle-wrapper')

if (dashaToggleBtn) {
  dashaToggleBtn.addEventListener('click', e => {
    e.stopPropagation()
    c().showDasha = !c().showDasha
    renderChart()
  })
}

if (dashaPopover && dashaWrapper) {
  // Open popover on right-click / long-press via a separate gear approach:
  // We use a second click while already active to open the popover
  dashaWrapper.addEventListener('contextmenu', e => {
    e.preventDefault()
    dashaPopover.style.display = dashaPopover.style.display === 'none' ? 'flex' : 'none'
  })

  // Card checkboxes
  dashaPopover.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation()
      const ui3 = c()
      const val = e.target.value
      if (e.target.checked) {
        if (!ui3.dashaCards.includes(val)) ui3.dashaCards = [...ui3.dashaCards, val]
      } else {
        const next = ui3.dashaCards.filter(v => v !== val)
        if (next.length === 0) { e.target.checked = true; return } // keep at least one
        ui3.dashaCards = next
      }
      const dashaPane = panel.querySelector('#dasha-pane')
      if (dashaPane) renderDashaCards(dashaPane, ui3.dashaCards).catch(console.error)
    })
  })

  // Close popover on outside click
  document.addEventListener('click', function closePop(ev) {
    if (!dashaWrapper?.contains(ev.target)) {
      if (dashaPopover) dashaPopover.style.display = 'none'
      document.removeEventListener('click', closePop)
    }
  })
}

// Split preset buttons
panel.querySelectorAll('.split-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const ratio = parseFloat(btn.dataset.ratio)
    c().splitRatio = ratio
    const w = panel.querySelector('#chart-split-wrapper')
    if (w) w.style.gridTemplateColumns = `${ratio}fr 6px ${1 - ratio}fr`
    // Update active state without full re-render
    panel.querySelectorAll('.split-preset-btn').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.ratio) === ratio))
  })
})
```

- [ ] **Step 3: Verify Dasha toggle works**

Open the app, load a chart. Click "Dasha" in the controls bar — the dasha panel should appear to the right of the chart showing the Vimshottari table. Click "Dasha" again — it hides. Verify the split presets (40/60, 50/50, 60/40) appear and change the split. Verify the drag handle moves the split.

- [ ] **Step 4: Verify card checkboxes**

Right-click the Dasha button → popover appears. Check "Age Progression" → age progression card appears in the dasha pane. Uncheck "Vimshottari" when it's the only checked item → checkbox reverts (stays checked).

- [ ] **Step 5: Commit**

```bash
git add src/tabs/chart.js
git commit -m "feat: add Dasha toggle button, card selector popover, split preset buttons"
```

---

## Task 6: Mobile pill tabs for Chart/Dasha

**Files:**
- Modify: `src/tabs/chart.js`

On mobile (≤600px), when `showDasha` is true, a pill tab bar appears below the controls bar. The split wrapper shows only one pane at a time.

- [ ] **Step 1: Add mobile tab state to `defaultChartUI()`**

In `src/sessions.js`, add one more field:

```js
mobileDashaTab: 'chart',   // 'chart' | 'dasha' — active panel on mobile
```

The full updated function:

```js
export function defaultChartUI() {
  return {
    chartStyle:    'north',
    viewMode:      '1',
    divisional:    'D1',
    multiDivs:     ['D1','D9','D3','D10'],
    activeMultiTab: 0,
    tableDiv:      'D1',
    activePlanets:      new Set(),
    multiActivePlanets: [new Set(), new Set(), new Set(), new Set()],
    showDasha:      false,
    dashaCards:     ['vimshottari'],
    splitRatio:     0.55,
    mobileDashaTab: 'chart',
  }
}
```

- [ ] **Step 2: Add pill tab HTML below the controls bar (when showDasha and mobile)**

In `renderChart()`, after the `chart-controls` div and before `chart-split-wrapper`, insert the mobile pill tabs. Find the line:

```js
    <div class="chart-split-wrapper" id="chart-split-wrapper"${showDasha ? ` style="grid-template-columns:${gridCols}"` : ''}>
```

Replace with:

```js
    ${showDasha ? `
      <div class="chart-dasha-tabs" id="chart-dasha-tabs">
        <button class="chart-dasha-tab-btn${ui2.mobileDashaTab !== 'dasha' ? ' active' : ''}" data-panel="chart">Chart</button>
        <button class="chart-dasha-tab-btn${ui2.mobileDashaTab === 'dasha' ? ' active' : ''}" data-panel="dasha">Dasha</button>
      </div>` : ''}
    <div class="chart-split-wrapper" id="chart-split-wrapper"${showDasha ? ` style="grid-template-columns:${gridCols}"` : ''}>
```

- [ ] **Step 3: Apply mobile visibility to chart-pane and dasha-pane**

When rendering the split wrapper children, add inline display style controlled by `mobileDashaTab`. Find the dasha-pane HTML in the split wrapper:

```js
${showDasha ? `<div class="split-handle" id="split-handle"></div><div class="dasha-pane" id="dasha-pane"></div>` : ''}
```

Replace with:

```js
${showDasha ? `
  <div class="split-handle" id="split-handle"></div>
  <div class="dasha-pane" id="dasha-pane" data-mobile-panel="dasha"></div>` : ''}
```

And add `data-mobile-panel="chart"` to the chart-pane:

```js
      <div class="chart-pane" id="chart-pane" data-mobile-panel="chart">
```

Then, after `renderDashaCards` is called, add mobile visibility logic:

```js
function applyMobilePanelVisibility() {
  const isMobile = window.innerWidth <= 600
  if (!isMobile || !c().showDasha) return
  const active = c().mobileDashaTab ?? 'chart'
  panel.querySelectorAll('[data-mobile-panel]').forEach(el => {
    el.style.display = el.dataset.mobilePanel === active ? '' : 'none'
  })
}
applyMobilePanelVisibility()
```

- [ ] **Step 4: Wire up pill tab clicks**

After the split handle wiring, add:

```js
panel.querySelectorAll('.chart-dasha-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    c().mobileDashaTab = btn.dataset.panel
    panel.querySelectorAll('.chart-dasha-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === btn.dataset.panel))
    applyMobilePanelVisibility()
  })
})
```

- [ ] **Step 5: Add swipe gesture for chart/dasha mobile tabs**

After the pill tab click wiring, add:

```js
const splitWrapper = panel.querySelector('#chart-split-wrapper')
if (splitWrapper && showDasha) {
  let touchStartX = 0, touchStartY = 0
  splitWrapper.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX
    touchStartY = e.changedTouches[0].clientY
  }, { passive: true })
  splitWrapper.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY)
    if (Math.abs(dx) < 50 || dy > 75) return
    const current = c().mobileDashaTab ?? 'chart'
    const next = dx < 0 ? 'dasha' : 'chart'
    if (next === current) return
    c().mobileDashaTab = next
    panel.querySelectorAll('.chart-dasha-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === next))
    applyMobilePanelVisibility()
  }, { passive: true })
}
```

- [ ] **Step 6: Verify on mobile viewport**

In Chrome DevTools, set viewport to 375px wide. Load a chart, toggle Dasha on. The pill tabs (Chart / Dasha) should appear below the controls bar. Tapping each pill switches the visible panel. Swiping left shows Dasha, swiping right shows Chart.

- [ ] **Step 7: Commit**

```bash
git add src/sessions.js src/tabs/chart.js
git commit -m "feat: mobile pill tabs and swipe for chart/dasha split panel"
```

---

## Task 7: Global swipe navigation between top-level tabs

**Files:**
- Modify: `src/ui/tabs.js`

Swipe left/right on `<main>` switches between the four top-level tabs (Birth Details → Birth Chart → Dasha → Panchang) in order.

- [ ] **Step 1: Add swipe listener in `initTabs()`**

In `src/ui/tabs.js`, update `initTabs()`:

```js
export function initTabs() {
  document.getElementById('tab-nav').addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab-btn')
    if (!btn || btn.disabled) return
    const name = btn.dataset.tab
    switchTab(name)
    if (name === 'chart') {
      const { renderChart }    = await import('../tabs/chart.js')
      renderChart()
    } else if (name === 'dasha') {
      const { renderDasha }    = await import('../tabs/dasha.js')
      renderDasha().catch(console.error)
    } else if (name === 'panchang') {
      const { renderPanchang } = await import('../tabs/panchang.js')
      renderPanchang()
    } else if (name === 'input') {
      const { renderInputTab } = await import('../tabs/input.js')
      renderInputTab()
    }
  })

  // Global swipe navigation between top-level tabs (mobile)
  const TAB_ORDER = ['input', 'chart', 'dasha', 'panchang']
  let swipeStartX = 0, swipeStartY = 0

  const mainEl = document.querySelector('main')
  if (mainEl) {
    mainEl.addEventListener('touchstart', e => {
      swipeStartX = e.changedTouches[0].clientX
      swipeStartY = e.changedTouches[0].clientY
    }, { passive: true })

    mainEl.addEventListener('touchend', async e => {
      const dx = e.changedTouches[0].clientX - swipeStartX
      const dy = Math.abs(e.changedTouches[0].clientY - swipeStartY)
      if (Math.abs(dx) < 50 || dy > 75) return

      const activeBtn = document.querySelector('#tab-nav .tab-btn.active')
      if (!activeBtn) return
      const currentIdx = TAB_ORDER.indexOf(activeBtn.dataset.tab)
      const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1
      if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return

      const nextTab = TAB_ORDER[nextIdx]
      const nextBtn = document.querySelector(`.tab-btn[data-tab="${nextTab}"]`)
      if (!nextBtn || nextBtn.disabled) return

      switchTab(nextTab)
      if (nextTab === 'chart') {
        const { renderChart } = await import('../tabs/chart.js')
        renderChart()
      } else if (nextTab === 'dasha') {
        const { renderDasha } = await import('../tabs/dasha.js')
        renderDasha().catch(console.error)
      } else if (nextTab === 'panchang') {
        const { renderPanchang } = await import('../tabs/panchang.js')
        renderPanchang()
      } else if (nextTab === 'input') {
        const { renderInputTab } = await import('../tabs/input.js')
        renderInputTab()
      }
    }, { passive: true })
  }
}
```

- [ ] **Step 2: Verify global swipe**

In Chrome DevTools mobile viewport, load the app, enter birth details, submit. Swipe left from Birth Details → should go to Birth Chart. Swipe left again → Dasha. Swipe right → back to Birth Chart. Disabled tabs (before chart data is loaded) should not be navigated to.

- [ ] **Step 3: Commit**

```bash
git add src/ui/tabs.js
git commit -m "feat: add global swipe navigation between top-level tabs"
```

---

## Task 8: Final integration verification

**Files:** none (verification only)

- [ ] **Step 1: Desktop — 1-chart view with all three dasha cards**

Load a chart. Click Dasha → panel appears with Vimshottari. Right-click Dasha button → check Age Progression and Dasha Progression → all three cards appear in the dasha pane. Drag the handle between chart and dasha pane — it resizes live and snaps at 40/60, 50/50, 60/40. The preset buttons highlight the active snap. Verify the chart SVG scales correctly within the chart pane.

- [ ] **Step 2: Desktop — 2-chart view**

Switch to 2-chart view. Toggle Dasha on. Both D1 and D9 charts appear in chart pane on the left; dasha panel on the right. Dasha and preset buttons are visible. Verify no layout overflow.

- [ ] **Step 3: Desktop — 4-chart view**

Switch to 4-chart view. Dasha button and split presets should NOT appear in the controls bar. Verify existing 4-chart layout is unchanged.

- [ ] **Step 4: Mobile — pill tabs and swipe**

Chrome DevTools → 375px viewport. Toggle Dasha on → pill tabs appear. Tap "Dasha" tab → dasha panel shows, chart hides. Swipe left on the chart panel → dasha panel shows. Swipe right → chart shows. Drag handle and split presets are hidden. Global tab swipe still works (swiping from Chart tab area goes to Dasha tab).

- [ ] **Step 5: Session isolation**

Open two profile tabs. Enable Dasha on profile A with Age Progression card. Switch to profile B → Dasha panel should be off (uses its own `uiState.chart`). Switch back to A → Dasha still on with Age Progression.

- [ ] **Step 6: Dasha tab unaffected**

Navigate to the Dasha tab directly. All three cards (Vimshottari, Age Progression, Dasha Progression) work as before: drag-reorder, year-method controls, ayanamsa info, collapse/expand all work.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: chart/dasha split panel — complete integration"
```
