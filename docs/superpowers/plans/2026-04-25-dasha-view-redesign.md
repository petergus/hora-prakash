# Dasha View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the focused drill-down interaction, breadcrumb navigation, toggle button, and row styling in the Vimshottari Dasha table.

**Architecture:** A new `focusedPath` array in session UI state drives what rows `buildDashaRows` renders in focused mode — siblings at the selected depth are hidden, and breadcrumb chips let users navigate back. Row clicks in focused mode rebuild the table rather than doing DOM insertion. Full mode keeps the existing DOM-mutation approach unchanged.

**Tech Stack:** Vanilla JS, Vite, inline SVG, CSS custom properties — no framework.

**Spec:** `docs/superpowers/specs/2026-04-25-dasha-view-redesign.md`

---

## File Map

| File | What changes |
|---|---|
| `src/sessions.js` | Add `focusedPath: []` to `defaultDashaUI` |
| `src/tabs/dasha.js` | Toggle button markup+handler, `buildDashaRows` focused logic, row click handler rewrite for focused mode, `renderBreadcrumb` rewrite, remove `planetDot` |
| `src/style.css` | Add `.dasha-mode-btn`, rewrite `.dasha-breadcrumb`, remove `.focus-toggle` rules |

---

### Task 1: Add `focusedPath` to session state

**Files:**
- Modify: `src/sessions.js`

- [ ] **Step 1: Add `focusedPath` field**

In `src/sessions.js`, find `defaultDashaUI` (line ~14). Add `focusedPath` after `focusedMode`:

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
    focusedPath:     [],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sessions.js
git commit -m "feat: add focusedPath to dasha UI state"
```

---

### Task 2: Replace toggle button markup in `renderDasha`

**Files:**
- Modify: `src/tabs/dasha.js` — `renderDasha` function (lines ~91–118)

- [ ] **Step 1: Replace the focus-toggle div with a single pill button**

In `renderDasha`, find the `panel.innerHTML = \`...\`` block. Change the `.prog-card-title` inner HTML from:

```html
<span class="drag-handle" title="Drag to reorder">⠿</span>
<div class="focus-toggle" id="dasha-focus-toggle">
  <span class="${(ui.focusedMode ?? true) ? 'focus-on' : ''}" data-mode="focused">Focused</span>
  <span class="${!(ui.focusedMode ?? true) ? 'focus-on' : ''}" data-mode="full">Full</span>
</div>
<button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
<h3>Vimshottari Dasha — ${birth.name}</h3>
```

to:

```html
<span class="drag-handle" title="Drag to reorder">⠿</span>
<button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
<h3>Vimshottari Dasha — ${birth.name}</h3>
<button id="dasha-mode-btn" class="dasha-mode-btn${(ui.focusedMode ?? true) ? ' focused-active' : ''}">${(ui.focusedMode ?? true) ? 'Focused' : 'Full'}</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: replace segmented focus toggle with single pill button"
```

---

### Task 3: Rewrite the toggle click handler

**Files:**
- Modify: `src/tabs/dasha.js` — `panel.onclick` handler (~line 148)

- [ ] **Step 1: Replace the `#dasha-focus-toggle` branch with `#dasha-mode-btn`**

Find this block inside `panel.onclick`:

```js
if (e.target.closest('#dasha-focus-toggle')) {
  const span = e.target.closest('span[data-mode]')
  if (!span) return
  ui.focusedMode = span.dataset.mode === 'focused'
  document.querySelectorAll('#dasha-focus-toggle span').forEach(s => {
    s.classList.toggle('focus-on', s.dataset.mode === (ui.focusedMode ? 'focused' : 'full'))
  })
  buildDashaRows(dasha, ui).then(rows => {
    document.querySelector('.dasha-table tbody').innerHTML = rows
    document.getElementById('dasha-breadcrumb-wrap').innerHTML =
      ui.focusedMode ? renderBreadcrumb(dasha, ui) : ''
  })
  return
}
```

Replace it with:

```js
if (e.target.id === 'dasha-mode-btn') {
  const wasFocused = ui.focusedMode ?? true
  ui.focusedMode = !wasFocused
  if (ui.focusedMode) {
    // Infer focusedPath from full-mode expansion state
    ui.focusedPath = inferFocusedPath(dasha, ui)
  }
  const btn = document.getElementById('dasha-mode-btn')
  btn.textContent = ui.focusedMode ? 'Focused' : 'Full'
  btn.classList.toggle('focused-active', ui.focusedMode)
  buildDashaRows(dasha, ui).then(rows => {
    document.querySelector('.dasha-table tbody').innerHTML = rows
    document.getElementById('dasha-breadcrumb-wrap').innerHTML =
      ui.focusedMode ? renderBreadcrumb(dasha, ui) : ''
  })
  return
}
```

- [ ] **Step 2: Add `inferFocusedPath` function**

Add this new function near the top of `dasha.js`, after the `d()` helper:

```js
function inferFocusedPath(dasha, ui) {
  // Pick MD: current-period if expanded, else first expanded MD
  const currentMD = dasha.find(m => isCurrentPeriod(m.start, m.end))
  let md = null
  if (currentMD && ui.expandedMahas.has(currentMD.planet)) {
    md = currentMD.planet
  } else {
    for (const m of dasha) {
      if (ui.expandedMahas.has(m.planet)) { md = m.planet; break }
    }
  }
  if (!md) return []

  // Pick AD within MD
  const antarSet = ui.expandedAntars.get(md)
  if (!antarSet || antarSet.size === 0) return [md]
  const mdNode = dasha.find(m => m.planet === md)
  const currentAD = mdNode?.children?.find(a => isCurrentPeriod(a.start, a.end))
  let ad = null
  if (currentAD && antarSet.has(currentAD.planet)) {
    ad = currentAD.planet
  } else {
    ad = [...antarSet][0] ?? null
  }
  if (!ad) return [md]

  // Pick PD and deeper via expandedPaths
  const path = []
  for (let depth = 2; depth <= 4; depth++) {
    const prefix = [md, ad, ...path].join('/')
    const match = [...ui.expandedPaths].find(p => p.startsWith(prefix + '/') && p.split('/').length === depth + 1)
    if (!match) break
    path.push(match.split('/')[depth])
  }

  return [md, ad, ...path]
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: add inferFocusedPath and wire dasha-mode-btn click handler"
```

---

### Task 4: Rewrite `buildDashaRows` focused-mode logic

**Files:**
- Modify: `src/tabs/dasha.js` — `buildDashaRows` function (~line 269)

- [ ] **Step 1: Replace focused-mode row generation**

The current focused logic (lines ~276–283) only hides non-active MDs when the active MD is expanded. Replace the entire `buildDashaRows` function with the version below. The full-mode loop (lines ~278–333) is preserved unchanged; only the focused-mode path is rewritten.

```js
async function buildDashaRows(dasha, ui) {
  const swe         = getSwe()
  const flags       = buildCalcFlags(getSettings())
  const rows        = []
  const focusedMode = ui.focusedMode ?? true

  if (!focusedMode) {
    // ── FULL MODE: unchanged behaviour ──────────────────────────────────────
    for (const maha of dasha) {
      const isCur0    = isCurrentPeriod(maha.start, maha.end)
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

  // ── FOCUSED MODE ──────────────────────────────────────────────────────────
  const fp = ui.focusedPath ?? []
  // fp = []         → show all MDs collapsed
  // fp = [md]       → show only that MD expanded (all its ADs)
  // fp = [md, ad]   → show that MD (only that AD visible) + that AD expanded (all its PDs)
  // etc.

  if (fp.length === 0) {
    // All MDs, all collapsed
    for (const maha of dasha) {
      rows.push(makeMdRow(maha, false, isCurrentPeriod(maha.start, maha.end)))
    }
    return rows.join('')
  }

  // Render the focused MD row (expanded)
  const focusedMD = dasha.find(m => m.planet === fp[0])
  if (!focusedMD) return rows.join('')
  rows.push(makeMdRow(focusedMD, true, isCurrentPeriod(focusedMD.start, focusedMD.end)))

  await ensureChildren(focusedMD, swe, flags)

  if (fp.length === 1) {
    // Show all ADs of this MD
    for (const antar of focusedMD.children) {
      const path1  = `${fp[0]}/${antar.planet}`
      const isCur1 = isCurrentPeriod(antar.start, antar.end)
      rows.push(makeRow(antar, path1, 1, false, isCur1, isCur1))
    }
    return rows.join('')
  }

  // Render the focused AD row (expanded), all other ADs hidden
  const focusedAD = focusedMD.children.find(a => a.planet === fp[1])
  if (!focusedAD) return rows.join('')
  const path1AD = `${fp[0]}/${fp[1]}`
  rows.push(makeRow(focusedAD, path1AD, 1, true, isCurrentPeriod(focusedAD.start, focusedAD.end), isCurrentPeriod(focusedAD.start, focusedAD.end)))

  await ensureChildren(focusedAD, swe, flags)

  if (fp.length === 2) {
    for (const prat of focusedAD.children) {
      const path2  = `${path1AD}/${prat.planet}`
      const isCur2 = isCurrentPeriod(prat.start, prat.end)
      rows.push(makeRow(prat, path2, 2, false, isCur2))
    }
    return rows.join('')
  }

  // Render focused PD row (expanded), all other PDs hidden
  const focusedPD = focusedAD.children.find(p => p.planet === fp[2])
  if (!focusedPD) return rows.join('')
  const path2PD = `${path1AD}/${fp[2]}`
  rows.push(makeRow(focusedPD, path2PD, 2, true, isCurrentPeriod(focusedPD.start, focusedPD.end)))

  await ensureChildren(focusedPD, swe, flags)

  if (fp.length === 3) {
    for (const sook of focusedPD.children) {
      const path3  = `${path2PD}/${sook.planet}`
      const isCur3 = isCurrentPeriod(sook.start, sook.end)
      rows.push(makeRow(sook, path3, 3, false, isCur3))
    }
    return rows.join('')
  }

  // Render focused SD row (expanded), all other SDs hidden
  const focusedSD = focusedPD.children.find(s => s.planet === fp[3])
  if (!focusedSD) return rows.join('')
  const path3SD = `${path2PD}/${fp[3]}`
  rows.push(makeRow(focusedSD, path3SD, 3, true, isCurrentPeriod(focusedSD.start, focusedSD.end)))

  await ensureChildren(focusedSD, swe, flags)

  if (fp.length === 4) {
    for (const prana of focusedSD.children) {
      const path4  = `${path3SD}/${prana.planet}`
      const isCur4 = isCurrentPeriod(prana.start, prana.end)
      rows.push(makeRow(prana, path4, 4, false, isCur4))
    }
    return rows.join('')
  }

  // Render focused PrD row (expanded), all other PrDs hidden
  const focusedPrD = focusedSD.children.find(p => p.planet === fp[4])
  if (!focusedPrD) return rows.join('')
  const path4PrD = `${path3SD}/${fp[4]}`
  rows.push(makeRow(focusedPrD, path4PrD, 4, true, isCurrentPeriod(focusedPrD.start, focusedPrD.end)))

  await ensureChildren(focusedPrD, swe, flags)
  for (const deha of focusedPrD.children) {
    const path5  = `${path4PrD}/${deha.planet}`
    const isCur5 = isCurrentPeriod(deha.start, deha.end)
    rows.push(makeLeafRow(deha, path5, isCur5))
  }

  return rows.join('')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: rewrite buildDashaRows focused-mode with focusedPath drill-down"
```

---

### Task 5: Rewrite dasha table row click handler for focused mode

**Files:**
- Modify: `src/tabs/dasha.js` — tbody click listener (~line 203)

- [ ] **Step 1: Replace the tbody click handler**

Find the `panel.querySelector('.dasha-table tbody').addEventListener('click', ...)` block (lines ~203–263). Replace it entirely with:

```js
panel.querySelector('.dasha-table tbody').addEventListener('click', async (e) => {
  const row = e.target.closest('tr[data-toggle]')
  if (!row) return
  const ui    = d()
  const path  = row.dataset.path
  const depth = parseInt(row.dataset.depth)
  const parts = path.split('/')

  if (ui.focusedMode ?? true) {
    // ── FOCUSED MODE: update focusedPath and rebuild ──
    const fp = ui.focusedPath ?? []
    const isExpanded = fp.length > depth && fp[depth] === parts[depth]

    if (isExpanded) {
      // Collapse: pop back to this level (show siblings)
      ui.focusedPath = fp.slice(0, depth)
    } else {
      // Expand: focus into this node
      ui.focusedPath = parts.slice(0, depth + 1)
    }

    const rows = await buildDashaRows(state.dasha, ui)
    document.querySelector('.dasha-table tbody').innerHTML = rows
    document.getElementById('dasha-breadcrumb-wrap').innerHTML = renderBreadcrumb(state.dasha, ui)
    return
  }

  // ── FULL MODE: existing DOM-mutation behaviour ──
  let node = state.dasha.find(m => m.planet === parts[0])
  for (let i = 1; i < parts.length; i++) {
    node = node?.children.find(c => c.planet === parts[i])
  }
  if (!node) return

  const tbody    = row.closest('tbody')
  const allRows  = Array.from(tbody.querySelectorAll('tr'))
  const nextIdx  = allRows.indexOf(row) + 1
  const hasChild = nextIdx < allRows.length && parseInt(allRows[nextIdx].dataset.depth ?? '-1') === depth + 1
  const opening  = !hasChild

  if (opening) {
    insertChildRows(row, node, depth).catch(console.error)
  } else {
    removeChildRows(row)
  }
  setArrow(row, opening)

  if (depth === 0) {
    const mahaName = path
    if (opening) ui.expandedMahas.add(mahaName)
    else {
      ui.expandedMahas.delete(mahaName)
      ui.expandedAntars.delete(mahaName)
      for (const p of ui.expandedPaths) {
        if (p.startsWith(mahaName + '/')) ui.expandedPaths.delete(p)
      }
    }
  } else if (depth === 1) {
    const mahaName = parts[0]
    if (!ui.expandedAntars.has(mahaName)) ui.expandedAntars.set(mahaName, new Set())
    if (opening) ui.expandedAntars.get(mahaName).add(parts[1])
    else {
      ui.expandedAntars.get(mahaName).delete(parts[1])
      for (const p of ui.expandedPaths) {
        if (p.startsWith(path + '/')) ui.expandedPaths.delete(p)
      }
    }
  } else {
    if (opening) ui.expandedPaths.add(path)
    else {
      ui.expandedPaths.delete(path)
      for (const p of ui.expandedPaths) {
        if (p.startsWith(path + '/')) ui.expandedPaths.delete(p)
      }
    }
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: rewrite dasha row click handler for focused/full mode"
```

---

### Task 6: Rewrite `renderBreadcrumb` with interactive navigation

**Files:**
- Modify: `src/tabs/dasha.js` — `renderBreadcrumb` function (~line 420)

- [ ] **Step 1: Replace `renderBreadcrumb`**

The current function is read-only (shows active period). Replace it entirely:

```js
function renderBreadcrumb(dasha, ui) {
  const fp = ui.focusedPath ?? []

  // Build time-left annotation when the focused AD is the current period AD
  let timeLeft = ''
  if (fp.length >= 2) {
    const md = dasha.find(m => m.planet === fp[0])
    const ad = md?.children?.find(a => a.planet === fp[1])
    if (ad && isCurrentPeriod(ad.start, ad.end)) {
      const daysLeft = Math.round((ad.end - new Date()) / 86400000)
      if (daysLeft >= 30) timeLeft = `· ${Math.round(daysLeft / 30.4)}mo left in AD`
      else if (daysLeft > 0) timeLeft = `· ${daysLeft}d left in AD`
    }
  }

  const LEVEL_CRUMB = ['MD','AD','PD','SD','PrD']

  let chips = `<button class="dasha-crumb-btn${fp.length === 0 ? ' active' : ''}" data-crumb-depth="-1">All MDs</button>`

  for (let i = 0; i < fp.length; i++) {
    const abbr    = PLANET_ABBR[fp[i]] ?? fp[i]
    const label   = LEVEL_CRUMB[i] ?? ''
    const isLast  = i === fp.length - 1
    chips += `<span class="dasha-crumb-sep">›</span>`
    chips += `<button class="dasha-crumb-btn${isLast ? ' active' : ''}" data-crumb-depth="${i}">${abbr} <span class="dasha-level-label">${label}</span></button>`
  }

  if (timeLeft) chips += `<span class="dasha-crumb-sep">${timeLeft}</span>`

  return `<div class="dasha-breadcrumb">${chips}</div>`
}
```

- [ ] **Step 2: Wire breadcrumb clicks in `panel.onclick`**

Inside `panel.onclick` (the existing handler block), add a new branch **before** the `dasha-mode-btn` check:

```js
const crumbBtn = e.target.closest('[data-crumb-depth]')
if (crumbBtn) {
  const depth = parseInt(crumbBtn.dataset.crumbDepth)
  const ui = d()
  ui.focusedPath = depth < 0 ? [] : (ui.focusedPath ?? []).slice(0, depth + 1)
  buildDashaRows(state.dasha, ui).then(rows => {
    document.querySelector('.dasha-table tbody').innerHTML = rows
    document.getElementById('dasha-breadcrumb-wrap').innerHTML = renderBreadcrumb(state.dasha, ui)
  })
  return
}
```

- [ ] **Step 3: Update `renderDasha` to pass `ui` to `renderBreadcrumb`**

In `renderDasha`, find:

```js
<div id="dasha-breadcrumb-wrap">${(ui.focusedMode ?? true) ? renderBreadcrumb(dasha) : ''}</div>
```

Change to:

```js
<div id="dasha-breadcrumb-wrap">${(ui.focusedMode ?? true) ? renderBreadcrumb(dasha, ui) : ''}</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: interactive breadcrumb with focusedPath navigation"
```

---

### Task 7: Remove planet dots from dasha rows

**Files:**
- Modify: `src/tabs/dasha.js`

- [ ] **Step 1: Remove `planetDot` calls from all row builders**

Find and update `makeMdRow`:

```js
function makeMdRow(node, expanded, isCurrent) {
  return `<tr data-toggle data-depth="0" data-path="${node.planet}" class="dasha-d0${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:0.5rem">${expanded ? '▼' : '▶'} <strong>${node.planet}</strong> <span class="dasha-level-label">MD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}
```

Find and update `makeRow`:

```js
function makeRow(node, path, depth, expanded, isCurrent, isNow = false) {
  const label    = LEVEL_LABELS[depth]
  const indent   = INDENT[depth]
  const nowBadge = isNow ? ' <span class="dasha-now-badge">★ now</span>' : ''
  return `<tr data-toggle data-depth="${depth}" data-path="${path}" class="dasha-d${depth}${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${indent}">${expanded ? '▼' : '▶'} ${node.planet}${nowBadge} <span class="dasha-level-label">${label}</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}
```

Find and update `makeLeafRow`:

```js
function makeLeafRow(node, path, isCurrent) {
  return `<tr data-depth="5" data-path="${path}" class="dasha-d5${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${INDENT[5]}">${node.planet} <span class="dasha-level-label">DeD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}
```

Find and update `insertChildRows` inner template (line ~381):

```js
tr.innerHTML = `<td style="padding-left:${indent}">${arrow}${child.planet} <span class="dasha-level-label">${label}</span></td><td>${startCell}</td><td>${endCell}</td>`
```

- [ ] **Step 2: Remove the `planetDot` function itself**

Delete lines:

```js
function planetDot(name) {
  const color = PLANET_COLORS[PLANET_ABBR[name]] ?? '#94a3b8'
  return `<span class="planet-dot" style="background:${color}"></span>`
}
```

Also remove the `PLANET_COLORS` import from `'../core/aspects.js'` if it is only used by `planetDot`. Check: `PLANET_COLORS` is also used in `renderProgression` for `lordColor` — so keep the import.

- [ ] **Step 3: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: remove planet color dots from dasha table rows"
```

---

### Task 8: Remove initial focused-mode auto-expand from `renderDasha`

**Files:**
- Modify: `src/tabs/dasha.js` — `renderDasha` function

- [ ] **Step 1: Remove the auto-expand block**

Find and delete these lines in `renderDasha`:

```js
// Auto-expand active MD in focused mode on first render
if (ui.focusedMode ?? true) {
  const activeMaha = dasha.find(m => isCurrentPeriod(m.start, m.end))
  if (activeMaha && !ui.expandedMahas.has(activeMaha.planet)) {
    ui.expandedMahas.add(activeMaha.planet)
  }
}
```

`focusedPath = []` is already the correct initial state (all MDs shown, none drilled in). The user selects manually.

- [ ] **Step 2: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: remove auto-expand active MD in focused mode on first render"
```

---

### Task 9: CSS — add `.dasha-mode-btn`, update breadcrumb, remove `.focus-toggle`

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add `.dasha-mode-btn` styles**

After the existing `.toggle-btn` rules (search for `.toggle-btn`), add:

```css
.dasha-mode-btn {
  font-size: 0.75rem;
  padding: 3px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  font-family: inherit;
}
.dasha-mode-btn.focused-active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
.dasha-mode-btn:hover:not(.focused-active) {
  background: #e0e7ff;
  color: var(--primary);
  border-color: var(--primary);
}
```

- [ ] **Step 2: Replace `.dasha-breadcrumb` block**

Find and replace the existing `.dasha-breadcrumb` and `.dasha-breadcrumb-sep` rules:

```css
.dasha-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 0.78rem;
  background: #0f172a;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}
.dasha-crumb-btn {
  background: none;
  border: none;
  color: #60a5fa;
  cursor: pointer;
  font-size: 0.78rem;
  font-family: inherit;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.1s;
}
.dasha-crumb-btn:hover:not(.active) { background: rgba(255,255,255,0.08); }
.dasha-crumb-btn.active { color: #fff; font-weight: 600; cursor: default; }
.dasha-crumb-sep { color: #475569; font-size: 0.72rem; padding: 0 2px; }
```

- [ ] **Step 3: Remove `.focus-toggle` rules**

Delete these rules entirely:

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

- [ ] **Step 4: Add mobile flex-wrap for prog-card-title**

Find the `@media (max-width: 540px)` block and add:

```css
.prog-card-title { flex-wrap: wrap; gap: 0.4rem; }
.dasha-breadcrumb { font-size: 0.72rem; }
```

- [ ] **Step 5: Commit**

```bash
git add src/style.css
git commit -m "feat: add dasha-mode-btn styles, update breadcrumb CSS, remove focus-toggle"
```

---

### Task 10: Browser verification

**Files:** none — dev server only

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open http://localhost:5173/hora-prakash/ in browser. Load a saved profile or submit a birth chart.

- [ ] **Step 2: Verify toggle button**

- Toggle button appears after the heading with a blue "Focused" pill
- Clicking switches to "Full" (grey/outline), clicking again back to "Focused"

- [ ] **Step 3: Verify focused mode drill-down**

- Default view: all 9 MDs listed, none expanded
- Click an MD → only that MD shown expanded with all its ADs; other MDs gone
- Click the same MD again → back to all MDs
- Click an AD → only parent MD + that AD shown expanded with all PDs; other ADs gone
- Click same AD → back to showing all ADs of that MD
- Repeat for PD → SD → PrD → DeD (leaf)

- [ ] **Step 4: Verify breadcrumb**

- Shows "All MDs" when nothing is focused
- Shows "All MDs › Ra MD" after focusing into Rahu
- Shows "All MDs › Ra MD › Ve AD" after focusing into Venus AD
- Clicking "All MDs" → returns to all MDs view
- Clicking "Ra MD" in breadcrumb → returns to all ADs of Rahu

- [ ] **Step 5: Verify Full→Focused inference**

- Switch to Full mode; expand an MD and one of its ADs
- Switch back to Focused mode → `focusedPath` should infer to `[md, ad]`, showing that AD expanded

- [ ] **Step 6: Verify no planet dots**

- No coloured circles visible in any dasha table row

- [ ] **Step 7: Verify mobile**

- Resize browser to 375px width
- Card title wraps neatly
- Breadcrumb wraps without overflow
- Table scrolls horizontally

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: verify dasha view redesign complete"
```
