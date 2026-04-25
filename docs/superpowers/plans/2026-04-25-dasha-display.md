# Dasha Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Vimshottari Dasha table with a Focused/Full toggle, breadcrumb strip, and planet color dots.

**Architecture:** All changes are confined to `src/tabs/dasha.js` (rendering logic) and `src/sessions.js` (state default). `buildDashaRows` gains a `focusedMode` parameter; a new `renderBreadcrumb` function computes the active path string; planet dots are added to all four row-building code paths.

**Tech Stack:** Vanilla JS, inline SVG/HTML, no build step beyond `npm run dev`.

---

## File Map

| File | Change |
|------|--------|
| `src/sessions.js` | Add `focusedMode: true` to `defaultDashaUI()` |
| `src/tabs/dasha.js` | Toggle pill, breadcrumb, planet dots, focused build logic |

---

### Task 1: Add `focusedMode` to session state

**Files:**
- Modify: `src/sessions.js:14-27`

- [ ] **Step 1: Add the field**

In `defaultDashaUI()`, add `focusedMode: true` after `expandedPaths`:

```js
export function defaultDashaUI() {
  return {
    dashaCollapsed:  false,
    ageCollapsed:    true,
    progCollapsed:   true,
    selectedProgLord: null,
    ageNavCycle:     null,
    ageAsOf:         null,
    progNavIndex:    null,
    expandedMahas:   new Set(),
    expandedAntars:  new Map(),
    expandedPaths:   new Set(),
    focusedMode:     true,
  }
}
```

- [ ] **Step 2: Verify dev server starts without error**

```bash
npm run dev
```
Expected: no console errors on load.

- [ ] **Step 3: Commit**

```bash
git add src/sessions.js
git commit -m "feat: add focusedMode field to defaultDashaUI"
```

---

### Task 2: Add planet color dots to all row builders

**Files:**
- Modify: `src/tabs/dasha.js` — `makeMdRow`, `makeRow`, `makeLeafRow`, `insertChildRows`

The existing `PLANET_ABBR` map and `PLANET_COLORS` import are already at the top of the file. Add a helper:

- [ ] **Step 1: Add `planetDot` helper after the `PLANET_ABBR` line**

After line:
```js
const PLANET_ABBR = { Ketu:'Ke', Venus:'Ve', Sun:'Su', Moon:'Mo', Mars:'Ma', Rahu:'Ra', Jupiter:'Ju', Saturn:'Sa', Mercury:'Me' }
```

Add:
```js
function planetDot(name) {
  const color = PLANET_COLORS[PLANET_ABBR[name]] ?? '#94a3b8'
  return `<span class="planet-dot" style="background:${color}"></span>`
}
```

- [ ] **Step 2: Update `makeMdRow`**

Replace:
```js
function makeMdRow(node, expanded, isCurrent) {
  return `<tr data-toggle data-depth="0" data-path="${node.planet}" class="dasha-d0${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:0.5rem">${expanded ? '▼' : '▶'} <strong>${node.planet}</strong> <span class="dasha-level-label">MD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}
```
With:
```js
function makeMdRow(node, expanded, isCurrent) {
  return `<tr data-toggle data-depth="0" data-path="${node.planet}" class="dasha-d0${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:0.5rem">${expanded ? '▼' : '▶'} ${planetDot(node.planet)}<strong>${node.planet}</strong> <span class="dasha-level-label">MD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}
```

- [ ] **Step 3: Update `makeRow`**

Replace:
```js
function makeRow(node, path, depth, expanded, isCurrent) {
  const label = LEVEL_LABELS[depth]
  const indent = INDENT[depth]
  const startCell = fmt(node.start)
  const endCell   = fmt(node.end)
  return `<tr data-toggle data-depth="${depth}" data-path="${path}" class="dasha-d${depth}${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${indent}">${expanded ? '▼' : '▶'} ${node.planet} <span class="dasha-level-label">${label}</span></td>
    <td>${startCell}</td><td>${endCell}</td></tr>`
}
```
With:
```js
function makeRow(node, path, depth, expanded, isCurrent, isNow = false) {
  const label = LEVEL_LABELS[depth]
  const indent = INDENT[depth]
  const startCell = fmt(node.start)
  const endCell   = fmt(node.end)
  const nowBadge  = isNow ? ' <span class="dasha-now-badge">★ now</span>' : ''
  return `<tr data-toggle data-depth="${depth}" data-path="${path}" class="dasha-d${depth}${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${indent}">${expanded ? '▼' : '▶'} ${planetDot(node.planet)}${node.planet}${nowBadge} <span class="dasha-level-label">${label}</span></td>
    <td>${startCell}</td><td>${endCell}</td></tr>`
}
```

- [ ] **Step 4: Update `makeLeafRow`**

Replace:
```js
function makeLeafRow(node, path, isCurrent) {
  return `<tr data-depth="5" data-path="${path}" class="dasha-d5${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${INDENT[5]}">${node.planet} <span class="dasha-level-label">DeD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}
```
With:
```js
function makeLeafRow(node, path, isCurrent) {
  return `<tr data-depth="5" data-path="${path}" class="dasha-d5${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${INDENT[5]}">${planetDot(node.planet)}${node.planet} <span class="dasha-level-label">DeD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}
```

- [ ] **Step 5: Update `insertChildRows` (dynamic DOM insertion)**

In `insertChildRows`, find the line that sets `tr.innerHTML`:
```js
tr.innerHTML = `<td style="padding-left:${indent}">${arrow}${child.planet} <span class="dasha-level-label">${label}</span></td><td>${startCell}</td><td>${endCell}</td>`
```
Replace with:
```js
tr.innerHTML = `<td style="padding-left:${indent}">${arrow}${planetDot(child.planet)}${child.planet} <span class="dasha-level-label">${label}</span></td><td>${startCell}</td><td>${endCell}</td>`
```

- [ ] **Step 6: Add CSS for `dasha-now-badge`**

Open `src/style.css` (or wherever dasha styles live — search for `.dasha-level-label`). Add after that rule:

```css
.dasha-now-badge {
  font-size: 0.68rem;
  background: #1e3a5f;
  color: #60a5fa;
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 4px;
}
```

- [ ] **Step 7: Verify in browser**

Run `npm run dev`, open the Dasha tab, load a chart. Every row should have a coloured dot before the planet name.

- [ ] **Step 8: Commit**

```bash
git add src/tabs/dasha.js src/style.css
git commit -m "feat: add planet color dots to dasha table rows"
```

---

### Task 3: Add `renderBreadcrumb` function

**Files:**
- Modify: `src/tabs/dasha.js` — add new function

- [ ] **Step 1: Add `renderBreadcrumb` after `getTzOffsetMs`**

```js
function renderBreadcrumb(dasha) {
  const now      = new Date()
  const activeMD = dasha.find(m => isCurrentPeriod(m.start, m.end))
  if (!activeMD) return ''

  const activeAD = activeMD.children?.find(a => isCurrentPeriod(a.start, a.end))
  const activePD = activeAD?.children?.find(p => isCurrentPeriod(p.start, p.end))

  const mdAbbr = PLANET_ABBR[activeMD.planet] ?? activeMD.planet
  let crumb = `★ &nbsp;${mdAbbr} <span class="dasha-level-label">MD</span>`

  if (activeAD) {
    const adAbbr = PLANET_ABBR[activeAD.planet] ?? activeAD.planet
    crumb += ` &rsaquo; ${adAbbr} <span class="dasha-level-label">AD</span>`

    const daysLeft = Math.round((activeAD.end - now) / 86400000)
    let timeLeft = ''
    if (daysLeft >= 30) {
      timeLeft = `${Math.round(daysLeft / 30.4)} months left in AD`
    } else if (daysLeft > 0) {
      timeLeft = `${daysLeft} days left in AD`
    }
    if (timeLeft) crumb += ` <span class="dasha-breadcrumb-sep">·</span> ${timeLeft}`
  }

  if (activePD) {
    const pdAbbr = PLANET_ABBR[activePD.planet] ?? activePD.planet
    // Insert PD segment after AD segment (before the time-left segment)
    // Re-build to keep order: MD › AD › PD · time left
    const adAbbr = PLANET_ABBR[activeAD.planet] ?? activeAD.planet
    const daysLeft = Math.round((activeAD.end - now) / 86400000)
    let timeLeft = ''
    if (daysLeft >= 30) timeLeft = `${Math.round(daysLeft / 30.4)} months left in AD`
    else if (daysLeft > 0) timeLeft = `${daysLeft} days left in AD`

    crumb = `★ &nbsp;${mdAbbr} <span class="dasha-level-label">MD</span>`
           + ` &rsaquo; ${adAbbr} <span class="dasha-level-label">AD</span>`
           + ` &rsaquo; ${pdAbbr} <span class="dasha-level-label">PD</span>`
    if (timeLeft) crumb += ` <span class="dasha-breadcrumb-sep">·</span> ${timeLeft}`
  }

  return `<div class="dasha-breadcrumb">${crumb}</div>`
}
```

- [ ] **Step 2: Add breadcrumb CSS**

In `src/style.css`, add:

```css
.dasha-breadcrumb {
  padding: 5px 10px;
  font-size: 0.78rem;
  color: #60a5fa;
  background: #0f172a;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.5rem;
  border-radius: 6px 6px 0 0;
}
.dasha-breadcrumb-sep {
  color: var(--muted);
  margin: 0 4px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tabs/dasha.js src/style.css
git commit -m "feat: add renderBreadcrumb function for dasha active path"
```

---

### Task 4: Add Focused/Full toggle and wire everything together

**Files:**
- Modify: `src/tabs/dasha.js` — `renderDasha`, `buildDashaRows`, click handler

- [ ] **Step 1: Update `buildDashaRows` to accept and use `focusedMode`**

Change the function signature and the MD loop:

```js
async function buildDashaRows(dasha, ui) {
  const swe        = getSwe()
  const flags      = buildCalcFlags(getSettings())
  const rows       = []
  const focusedMode = ui.focusedMode ?? true

  // In focused mode, find the active MD. If the active MD is collapsed (not in expandedMahas),
  // show all MDs collapsed (peer reveal). Otherwise show only the active MD.
  const activeMaha = dasha.find(m => isCurrentPeriod(m.start, m.end))
  const activeMahaExpanded = activeMaha && ui.expandedMahas.has(activeMaha.planet)
  const showAllMDs = !focusedMode || !activeMaha || (focusedMode && !activeMahaExpanded)

  for (const maha of dasha) {
    const isCur0    = isCurrentPeriod(maha.start, maha.end)

    // In focused mode with active MD expanded: skip non-active MDs
    if (focusedMode && activeMahaExpanded && !isCur0) continue

    const expanded0 = ui.expandedMahas.has(maha.planet)
    rows.push(makeMdRow(maha, expanded0, isCur0))

    if (!expanded0) continue
    await ensureChildren(maha, swe, flags)
    for (const antar of maha.children) {
      const path1     = `${maha.planet}/${antar.planet}`
      const isCur1    = isCurrentPeriod(antar.start, antar.end)
      const expanded1 = ui.expandedAntars.get(maha.planet)?.has(antar.planet) ?? false
      rows.push(makeRow(antar, path1, 1, expanded1, isCur1, isCur1))

      if (!expanded1) continue
      await ensureChildren(antar, swe, flags)
      for (const prat of antar.children) {
        const path2     = `${path1}/${prat.planet}`
        const isCur2    = isCurrentPeriod(prat.start, prat.end)
        const expanded2 = ui.expandedPaths.has(path2)
        rows.push(makeRow(prat, path2, 2, expanded2, isCur2))

        if (!expanded2) continue
        await ensureChildren(prat, swe, flags)
        for (const sook of prat.children) {
          const path3     = `${path2}/${sook.planet}`
          const isCur3    = isCurrentPeriod(sook.start, sook.end)
          const expanded3 = ui.expandedPaths.has(path3)
          rows.push(makeRow(sook, path3, 3, expanded3, isCur3))

          if (!expanded3) continue
          await ensureChildren(sook, swe, flags)
          for (const prana of sook.children) {
            const path4     = `${path3}/${prana.planet}`
            const isCur4    = isCurrentPeriod(prana.start, prana.end)
            const expanded4 = ui.expandedPaths.has(path4)
            rows.push(makeRow(prana, path4, 4, expanded4, isCur4))

            if (!expanded4) continue
            await ensureChildren(prana, swe, flags)
            for (const deha of prana.children) {
              const path5  = `${path4}/${deha.planet}`
              const isCur5 = isCurrentPeriod(deha.start, deha.end)
              rows.push(makeLeafRow(deha, path5, isCur5))
            }
          }
        }
      }
    }
  }

  return rows.join('')
}
```

- [ ] **Step 2: Auto-expand active MD on first render in focused mode**

In `renderDasha()`, after the `ui.selectedProgLord` init block, add:

```js
// Auto-expand active MD in focused mode on first render
if ((ui.focusedMode ?? true) && !ui.expandedMahas.has(dasha.find(m => isCurrentPeriod(m.start, m.end))?.planet ?? '')) {
  const activeMaha = dasha.find(m => isCurrentPeriod(m.start, m.end))
  if (activeMaha) ui.expandedMahas.add(activeMaha.planet)
}
```

- [ ] **Step 3: Add toggle pill to the dasha card header HTML**

In `renderDasha()`, find the header HTML block:
```js
<button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
```

Change that line to:
```js
<div class="focus-toggle" id="dasha-focus-toggle">
  <span class="${(ui.focusedMode ?? true) ? 'focus-on' : ''}" data-mode="focused">Focused</span>
  <span class="${!(ui.focusedMode ?? true) ? 'focus-on' : ''}" data-mode="full">Full</span>
</div>
<button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
```

- [ ] **Step 4: Inject breadcrumb into the dasha body**

In `renderDasha()`, find:
```js
<p style="color:var(--muted);font-size:0.82rem;margin-bottom:0.85rem">MD → AD → PD → SD → PrD — click any row to expand</p>
```

Replace with:
```js
<div id="dasha-breadcrumb-wrap">${(ui.focusedMode ?? true) ? renderBreadcrumb(dasha) : ''}</div>
<p style="color:var(--muted);font-size:0.82rem;margin-bottom:0.85rem">MD → AD → PD → SD → PrD — click any row to expand</p>
```

- [ ] **Step 5: Handle toggle click in `panel.onclick`**

In the existing `panel.onclick` handler, add a new branch at the top:

```js
if (e.target.closest('#dasha-focus-toggle')) {
  const span = e.target.closest('span[data-mode]')
  if (!span) return
  const ui = d()
  ui.focusedMode = span.dataset.mode === 'focused'
  // Update pill appearance
  document.querySelectorAll('#dasha-focus-toggle span').forEach(s => {
    s.classList.toggle('focus-on', s.dataset.mode === (ui.focusedMode ? 'focused' : 'full'))
  })
  // Re-render table and breadcrumb
  buildDashaRows(dasha, ui).then(rows => {
    document.querySelector('.dasha-table tbody').innerHTML = rows
    document.getElementById('dasha-breadcrumb-wrap').innerHTML =
      ui.focusedMode ? renderBreadcrumb(dasha) : ''
  })
  return
}
```

- [ ] **Step 6: Add CSS for the focus toggle pill**

In `src/style.css`:

```css
.focus-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  font-size: 0.75rem;
  margin-right: 0.4rem;
}
.focus-toggle span {
  padding: 2px 10px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.focus-toggle span.focus-on {
  background: #3b82f6;
  color: #fff;
}
```

- [ ] **Step 7: Verify full behavior in browser**

Run `npm run dev`. Load a chart, open Dasha tab. Confirm:
1. Focused mode is default — only active MD shown, expanded with all ADs
2. Active AD has `★ now` badge
3. Breadcrumb shows `★ Ke MD › Su AD › Mo PD · X months left in AD`
4. Collapsing active MD reveals all 9 MD rows; re-expanding returns to focused drill-down
5. Clicking Full shows all 9 MDs collapsed, breadcrumb hidden
6. Planet dots on every row with correct colours

- [ ] **Step 8: Commit**

```bash
git add src/tabs/dasha.js src/style.css
git commit -m "feat: focused/full toggle with breadcrumb for dasha table"
```

---

### Task 5: Push to production

- [ ] **Step 1: Push**

```bash
git push
```

Expected: GitHub Actions deploys to https://priyankgahtori.github.io/hora-prakash/
