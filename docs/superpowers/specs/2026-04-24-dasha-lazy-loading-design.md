# Dasha Lazy Loading — Design Spec
**Date:** 2026-04-24
**Status:** Approved

## Problem

The Dasha tab has high memory footprint because `calcDasha` eagerly computes all 5 levels of the Vimshottari tree on form submit. This produces ~66,000 nodes (9⁵ = 59,049 PrD nodes alone), each holding 2 `Date` objects. The UI then renders all of them as hidden `<tr>` DOM elements, bloating the DOM regardless of what the user expands.

## Approach: Lazy children on node (Option A)

Compute only MD + AD levels on load (90 nodes). Deeper levels are computed and cached on the node itself when the user first expands that row. DOM rows are injected on expand and removed on collapse — no hidden rows in the DOM.

## Core changes — `src/core/dasha.js`

- `calcDasha`: change `calcSubPeriods` depth from `4` to `1` (MD children = AD only)
- Add exported function:
  ```js
  export function ensureChildren(node)
  ```
  If `node.children.length === 0`, calls `calcSubPeriods(seqIndex, node.start, node.durationYears, 1)` and writes result onto `node.children`. Idempotent. Called by the UI before inserting child rows.
- Each node must store `seqIndex` and `durationYears` so `ensureChildren` has enough context to compute children without re-deriving from the tree.
- `calcSubPeriods` itself is unchanged.

## UI changes — `src/tabs/dasha.js`

- `buildDashaRows`: renders only the 9 MD rows. No nested loops.
- On re-render (tab switch), walks `ui.expandedMahas / expandedAntars / expandedPaths` and re-inserts rows for any previously expanded paths by calling `ensureChildren` on the relevant cached nodes.
- Replace `toggleChildRows` with:
  - `insertChildRows(parentRow, node)` — calls `ensureChildren(node)`, creates `<tr>` elements for each child, inserts after parent row
  - `removeChildRows(parentRow, depth)` — removes all descendant rows from the DOM
- Click handler: calls `ensureChildren` on the clicked node, then `insertChildRows` or `removeChildRows`
- `setArrow` unchanged.

## Unchanged

- `state.js` shape — `state.dasha` is still an array of 9 MD nodes
- `renderProgression`, `renderAgeProgression`, drag-reorder, panchang, chart tabs
- `calcSubPeriods` internals
- `isCurrentPeriod` — computed at render time from node dates
- Session UI state: `expandedMahas`, `expandedAntars`, `expandedPaths` — same Sets/Maps, same logic

## Expected impact

| | Before | After |
|---|---|---|
| Nodes on load | ~66,000 | 90 |
| DOM rows on load | ~66,000 | 9 |
| Nodes after full expand | ~66,000 | ~66,000 |
| DOM rows (fully expanded) | same | same |

Memory drops dramatically on initial load and for users who never expand deep levels.
