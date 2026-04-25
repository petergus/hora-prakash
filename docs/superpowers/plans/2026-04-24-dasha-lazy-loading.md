# Dasha Lazy Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Dasha tab memory footprint by lazily computing and rendering dasha tree nodes only when the user expands a row.

**Architecture:** `calcDasha` computes MD + AD only (90 nodes). Each node stores `seqIndex` + `durationYears` so `ensureChildren(node)` can compute its 9 children on demand, caching them in-place. The UI renders only visible rows and surgically inserts/removes `<tr>` elements on expand/collapse.

**Tech Stack:** Vanilla JS, Vite dev server (`npm run dev` → http://localhost:5173/hora-prakash/)

---

## File Map

| File | Change |
|---|---|
| `src/core/dasha.js` | Add `seqIndex`+`durationYears` to nodes; change depth to 1; export `ensureChildren` |
| `src/tabs/dasha.js` | `buildDashaRows` renders MD-only; replace `toggleChildRows` with `insertChildRows`/`removeChildRows`; update click handler |

---

### Task 1: Add `seqIndex` and `durationYears` to every node in `calcSubPeriods`

**Files:**
- Modify: `src/core/dasha.js`

This makes every node self-sufficient for lazy child computation. `ensureChildren` will use these fields.

- [ ] **Step 1: Update `calcSubPeriods` to attach `seqIndex` and `durationYears` to each node**

In `src/core/dasha.js`, replace the `result.push({...})` block inside `calcSubPeriods` (lines 43–49):

```js
result.push({
  planet:        seq.name,
  start:         new Date(cur),
  end:           new Date(end),
  seqIndex:      idx,
  durationYears: yrs,
  children:      calcSubPeriods(idx, new Date(cur), yrs, depth - 1),
})
```

_(No other change to `calcSubPeriods` — signature and logic unchanged.)_

- [ ] **Step 2: Update `calcDasha` to attach `seqIndex` and `durationYears` and use depth=1**

In `src/core/dasha.js`, replace the `tree.push({...})` block inside `calcDasha` (lines 84–90):

```js
tree.push({
  planet:        seq.name,
  start:         new Date(cur),
  end:           new Date(end),
  seqIndex:      idx,
  durationYears: i === 0 ? balanceYears : seq.years,
  children:      calcSubPeriods(idx, new Date(cur), i === 0 ? balanceYears : seq.years, 1),
})
```

This computes only 1 level deep (AD), giving 90 nodes at load instead of ~66,000.

- [ ] **Step 3: Export `ensureChildren`**

Add this function at the bottom of `src/core/dasha.js`, before the final exports:

```js
/**
 * Lazily compute direct children of a node if not yet computed.
 * Idempotent — safe to call multiple times.
 */
export function ensureChildren(node) {
  if (node.children.length === 0) {
    node.children = calcSubPeriods(node.seqIndex, node.start, node.durationYears, 1)
  }
}
```

- [ ] **Step 4: Verify dev server still starts and chart calculates**

```bash
npm run dev
```

Open http://localhost:5173/hora-prakash/, enter any birth details, submit. Confirm the Dasha tab loads with 9 MD rows visible and no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/dasha.js
git commit -m "feat: lazy dasha nodes — depth-1 on load, ensureChildren for on-demand expansion"
```

---

### Task 2: Update `buildDashaRows` to render MD-only, with recursive restore for already-expanded nodes

**Files:**
- Modify: `src/tabs/dasha.js`

On first load only 9 MD rows render. On tab switch, any previously expanded rows are restored by walking the cached (already-computed) tree.

- [ ] **Step 1: Add `ensureChildren` import at the top of `src/tabs/dasha.js`**

Change line 3:

```js
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, calcAgeComponents, DASHA_YEARS, LEVEL_NAMES, ensureChildren } from '../core/dasha.js'
```

- [ ] **Step 2: Replace `buildDashaRows` with an MD-only version that recursively restores expanded state**

Replace the entire `buildDashaRows` function (lines 162–219 in `src/tabs/dasha.js`) with:

```js
function buildDashaRows(dasha, ui) {
  const rows = []

  for (const maha of dasha) {
    const isCur0    = isCurrentPeriod(maha.start, maha.end)
    const expanded0 = ui.expandedMahas.has(maha.planet)
    rows.push(makeMdRow(maha, expanded0, isCur0))

    if (!expanded0 || maha.children.length === 0) continue

    for (const antar of maha.children) {
      const path1     = `${maha.planet}/${antar.planet}`
      const isCur1    = isCurrentPeriod(antar.start, antar.end)
      const expanded1 = ui.expandedAntars.get(maha.planet)?.has(antar.planet) ?? false
      rows.push(makeRow(antar, path1, 1, expanded1, isCur1))

      if (!expanded1 || antar.children.length === 0) continue

      for (const prat of antar.children) {
        const path2     = `${path1}/${prat.planet}`
        const isCur2    = isCurrentPeriod(prat.start, prat.end)
        const expanded2 = ui.expandedPaths.has(path2)
        rows.push(makeRow(prat, path2, 2, expanded2, isCur2))

        if (!expanded2 || prat.children.length === 0) continue

        for (const sook of prat.children) {
          const path3     = `${path2}/${sook.planet}`
          const isCur3    = isCurrentPeriod(sook.start, sook.end)
          const expanded3 = ui.expandedPaths.has(path3)
          rows.push(makeRow(sook, path3, 3, expanded3, isCur3))

          if (!expanded3 || sook.children.length === 0) continue

          for (const prana of sook.children) {
            const path4  = `${path3}/${prana.planet}`
            const isCur4 = isCurrentPeriod(prana.start, prana.end)
            rows.push(makeLeafRow(prana, path4, isCur4))
          }
        }
      }
    }
  }

  return rows.join('')
}

function makeMdRow(node, expanded, isCurrent) {
  return `<tr data-toggle data-depth="0" data-path="${node.planet}" class="dasha-d0${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:0.5rem">${expanded ? '▼' : '▶'} <strong>${node.planet}</strong> <span class="dasha-level-label">MD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}

const LEVEL_LABELS = ['MD','AD','PD','SD','PrD']
const INDENT = ['0.5rem','1.8rem','3.1rem','4.4rem','5.7rem']

function makeRow(node, path, depth, expanded, isCurrent) {
  const label = LEVEL_LABELS[depth]
  const indent = INDENT[depth]
  const useFmtDeep = depth >= 2
  const startCell = useFmtDeep ? fmtDeep(node.start) : fmt(node.start)
  const endCell   = useFmtDeep ? fmtDeep(node.end)   : fmt(node.end)
  return `<tr data-toggle data-depth="${depth}" data-path="${path}" class="dasha-d${depth}${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${indent}">${expanded ? '▼' : '▶'} ${node.planet} <span class="dasha-level-label">${label}</span></td>
    <td>${startCell}</td><td>${endCell}</td></tr>`
}

function makeLeafRow(node, path, isCurrent) {
  return `<tr data-depth="4" data-path="${path}" class="dasha-d4${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:5.7rem">${node.planet} <span class="dasha-level-label">PrD</span></td>
    <td>${fmtDeep(node.start)}</td><td>${fmtDeep(node.end)}</td></tr>`
}
```

- [ ] **Step 3: Verify MD-only rendering on first load**

Open http://localhost:5173/hora-prakash/, submit a chart, go to Dasha tab. Confirm exactly 9 rows appear. Open browser DevTools → Elements → count `<tr>` in `tbody`. Should be 9.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "refactor: buildDashaRows renders MD-only, restores expanded state from cached nodes"
```

---

### Task 3: Replace `toggleChildRows` with `insertChildRows` / `removeChildRows` and update click handler

**Files:**
- Modify: `src/tabs/dasha.js`

On expand: call `ensureChildren`, create `<tr>` elements, insert after parent. On collapse: remove all descendant rows from DOM.

- [ ] **Step 1: Add `insertChildRows` and `removeChildRows` functions**

Add these two functions to `src/tabs/dasha.js`, replacing the existing `toggleChildRows` function (lines 222–252):

```js
// Lazily compute children of node and insert their <tr> elements after parentRow.
function insertChildRows(parentRow, node, depth) {
  ensureChildren(node)
  const tbody   = parentRow.closest('tbody')
  const allRows = Array.from(tbody.querySelectorAll('tr'))
  let insertAfter = parentRow

  // Find last existing descendant so we insert after it (handles re-expand)
  for (let i = allRows.indexOf(parentRow) + 1; i < allRows.length; i++) {
    const d = parseInt(allRows[i].dataset.depth ?? '-1')
    if (d <= parseInt(parentRow.dataset.depth)) break
    insertAfter = allRows[i]
  }

  const childDepth = depth + 1
  const useFmtDeep = childDepth >= 2
  const isLeaf     = childDepth === 4
  const path       = parentRow.dataset.path

  const fragment = document.createDocumentFragment()
  for (const child of node.children) {
    const childPath = `${path}/${child.planet}`
    const isCur     = isCurrentPeriod(child.start, child.end)
    const tr        = document.createElement('tr')
    tr.dataset.depth = String(childDepth)
    tr.dataset.path  = childPath
    if (!isLeaf) tr.dataset.toggle = ''
    tr.className = `dasha-d${childDepth}${isCur ? ' current-period' : ''}`
    const startCell = useFmtDeep ? fmtDeep(child.start) : fmt(child.start)
    const endCell   = useFmtDeep ? fmtDeep(child.end)   : fmt(child.end)
    const label     = LEVEL_LABELS[childDepth]
    const indent    = INDENT[childDepth]
    const arrow     = isLeaf ? '' : '▶ '
    tr.innerHTML = `<td style="padding-left:${indent}">${arrow}${child.planet} <span class="dasha-level-label">${label}</span></td><td>${startCell}</td><td>${endCell}</td>`
    fragment.appendChild(tr)
  }

  insertAfter.after(fragment)
}

// Remove all descendant rows of parentRow from the DOM.
function removeChildRows(parentRow) {
  const parentDepth = parseInt(parentRow.dataset.depth)
  const tbody       = parentRow.closest('tbody')
  const allRows     = Array.from(tbody.querySelectorAll('tr'))
  const parentIdx   = allRows.indexOf(parentRow)
  const toRemove    = []
  for (let i = parentIdx + 1; i < allRows.length; i++) {
    const d = parseInt(allRows[i].dataset.depth ?? '-1')
    if (d <= parentDepth) break
    toRemove.push(allRows[i])
  }
  toRemove.forEach(r => r.remove())
}
```

- [ ] **Step 2: Update the tbody click handler to use `insertChildRows`/`removeChildRows`**

Replace the `panel.querySelector('.dasha-table tbody').addEventListener('click', ...)` block (lines 116–158 in `src/tabs/dasha.js`) with:

```js
panel.querySelector('.dasha-table tbody').addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-toggle]')
  if (!row) return
  const ui    = d()
  const path  = row.dataset.path
  const depth = parseInt(row.dataset.depth)

  // Find the node in state.dasha by path
  const parts = path.split('/')
  let node = state.dasha.find(m => m.planet === parts[0])
  for (let i = 1; i < parts.length; i++) {
    node = node?.children.find(c => c.planet === parts[i])
  }
  if (!node) return

  // Determine if we're opening or closing
  const firstChildDepth = depth + 1
  const tbody    = row.closest('tbody')
  const allRows  = Array.from(tbody.querySelectorAll('tr'))
  const nextIdx  = allRows.indexOf(row) + 1
  const hasChild = nextIdx < allRows.length && parseInt(allRows[nextIdx].dataset.depth ?? '-1') === firstChildDepth

  const opening = !hasChild

  if (opening) {
    insertChildRows(row, node, depth)
  } else {
    removeChildRows(row)
  }
  setArrow(row, opening)

  // Update session state (unchanged logic)
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

- [ ] **Step 3: Remove the now-unused `toggleChildRows` and `toggleSiblings` functions**

Delete both functions from `src/tabs/dasha.js` (the `toggleChildRows` function around lines 222–252, and `toggleSiblings` around lines 254–277). They are replaced by `insertChildRows`/`removeChildRows`.

- [ ] **Step 4: Manual verification — expand/collapse all levels**

Open http://localhost:5173/hora-prakash/, submit a chart, go to Dasha tab.

Check each of the following:
1. 9 MD rows show. Click any MD row → 9 AD rows appear below it. Click again → AD rows disappear.
2. With an MD expanded, click an AD row → 9 PD rows appear. Click again → collapse.
3. Expand MD → AD → PD → SD → 9 PrD rows appear (leaf rows, no arrow).
4. Switch to Chart tab and back to Dasha — previously expanded rows are restored correctly.
5. The currently-active period row has the `current-period` highlight at every level.
6. Open DevTools Memory tab → take heap snapshot before and after submit. Node count should be dramatically lower than before this change.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/dasha.js
git commit -m "feat: lazy dasha DOM — insert/remove rows on expand/collapse, drop toggleChildRows"
```

---

## Self-Review Checklist

- [x] Spec: "calcDasha depth 1" → Task 1 Step 2
- [x] Spec: "seqIndex + durationYears on nodes" → Task 1 Steps 1–2
- [x] Spec: "ensureChildren export" → Task 1 Step 3
- [x] Spec: "buildDashaRows MD-only" → Task 2 Step 2
- [x] Spec: "restore expanded state on re-render" → Task 2 Step 2 (recursive walk of cached tree)
- [x] Spec: "insertChildRows / removeChildRows" → Task 3 Step 1
- [x] Spec: "click handler calls ensureChildren" → Task 3 Step 2
- [x] Spec: "expandedMahas/expandedAntars/expandedPaths unchanged" → Task 3 Step 2
- [x] Type consistency: `ensureChildren` defined in Task 1 Step 3, imported in Task 2 Step 1, used in Task 3 Step 1 — consistent
- [x] `LEVEL_LABELS` and `INDENT` defined in Task 2 Step 2, used in Task 3 Step 1 — consistent
- [x] No placeholders or TBDs
