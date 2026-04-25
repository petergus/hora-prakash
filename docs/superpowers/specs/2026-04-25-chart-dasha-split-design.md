# Chart Tab — Dasha Split Panel Design

**Date:** 2026-04-25  
**Status:** Approved

## Overview

Add an optional, configurable Dasha panel to the Birth Chart tab that sits to the right of the chart in a resizable split layout. Available in 1-chart and 2-chart views only. On mobile, a tab/swipe UI replaces the split. Global swipe navigation between top-level tabs is also added.

---

## 1. State Shape

`sessions.js → defaultChartUI()` gains three new fields:

```js
showDasha:   false,              // boolean — dasha panel visible
dashaCards:  ['vimshottari'],    // string[] — 'vimshottari' | 'age' | 'progression'
splitRatio:  0.55,               // number 0.0–1.0 — left panel fraction, persisted per session
```

No changes to `defaultDashaUI()`. The dasha panel reads from the existing `uiState.dasha` and `state.dasha`.

---

## 2. New Exported Function: `renderDashaCards`

**File:** `src/tabs/dasha.js`

```js
export async function renderDashaCards(container, cards) { ... }
```

- `container`: a DOM element to render into
- `cards`: array of `'vimshottari' | 'age' | 'progression'`
- Renders only the requested cards using the existing `buildDashaRows`, `renderAgeProgression`, `renderProgression` helpers
- Omits: year-method controls, ayanamsa info line, drag-reorder handles (`draggable` attribute, `drag-handle` spans, `initDragReorder`)
- All row click/expand interactions remain functional (they operate on `state.dasha` + `uiState.dasha` as usual)
- Called by `chart.js` after the chart renders; re-called on any chart re-render when `showDasha` is true

---

## 3. Chart Tab Layout (Desktop, ≥641px)

When `showDasha` is false (default), layout is unchanged.

When `showDasha` is true in view mode 1 or 2:

```
┌─ .chart-split-wrapper ──────────────────────────────────────────┐
│  ┌─ .chart-pane ──────────┐  │  ┌─ .dasha-pane ─────────────┐  │
│  │  chart SVG(s)          │ ↔ │  │  selected dasha cards     │  │
│  │  planet table          │drag│  │  (scrollable)             │  │
│  └────────────────────────┘  │  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### CSS Grid

```css
.chart-split-wrapper {
  display: grid;
  grid-template-columns: {ratio}fr 6px {1-ratio}fr;
  gap: 0;
  min-height: 0;
}
```

`{ratio}` and `{1-ratio}` are computed from `splitRatio` (default 0.55) on each render.

### Drag Handle (`.split-handle`)

- 6px wide, full height, cursor `col-resize`
- `mousedown` → track `mousemove` on `document` → recompute ratio from pointer X relative to wrapper → update `grid-template-columns` live
- `mouseup` → save final ratio to `uiState.chart.splitRatio`, stop tracking
- **Snap points**: 0.40, 0.50, 0.60 — if released within ±0.03 of a snap, snap to it
- Hidden on mobile via `display:none` at ≤640px

### Dasha Pane

- `overflow-y: auto` — scrolls independently from the chart pane
- Contains the output of `renderDashaCards(container, dashaCards)`

---

## 4. Controls Bar

Existing `.chart-controls` bar layout (1 and 2-chart view only):

```
[D1 ▾] [North|South] [1|2|4] [◉ aspects] | [Dasha ▾] [40/60·50/50·60/40]
```

- `|` is a `<span class="ctrl-sep">` visual divider
- **Dasha button**: toggles `showDasha`. When active (pressed state), shows a popover with three checkboxes:
  - `☑ Vimshottari`
  - `☐ Age Progression`
  - `☐ Dasha Progression`
  - At least one must remain checked — unchecking the last one is a no-op (disable the checkbox)
  - Popover closes on outside click
- **Split preset buttons** (`40/60 · 50/50 · 60/40`): rendered only when `showDasha` is true. Active preset highlighted. Sets `splitRatio` to 0.40 / 0.50 / 0.60 and re-renders.
- In **4-chart view**: Dasha button and split presets are not rendered (omitted from HTML).

---

## 5. Mobile Behavior (≤640px)

### No split panel
The dasha pane is never rendered side-by-side. `.split-handle` and split preset buttons are hidden.

### Chart/Dasha pill tabs (when `showDasha` is true)
A pill tab bar appears below the controls bar:

```
[ Chart ] [ Dasha ]
```

- Only the active panel is visible (`display:none` on inactive)
- Swiping left/right on the active panel switches between Chart and Dasha
- Swipe detection: `touchstart`/`touchend`, horizontal delta ≥50px, vertical delta <75px

### Global tab swipe
A `touchstart`/`touchend` listener on `<main>` enables swipe navigation between the four top-level tabs (Birth Details → Birth Chart → Dasha → Panchang). Same delta thresholds. This is independent of `showDasha`.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/sessions.js` | Add `showDasha`, `dashaCards`, `splitRatio` to `defaultChartUI()` |
| `src/tabs/dasha.js` | Export `renderDashaCards(container, cards)` |
| `src/tabs/chart.js` | Split layout, drag handle, controls bar additions, mobile pill tabs |
| `src/ui/tabs.js` | Add global swipe listener on `<main>` |
| `src/style.css` | `.chart-split-wrapper`, `.split-handle`, `.dasha-pane`, `.chart-pane`, `.chart-dasha-tabs`, `ctrl-sep`, mobile breakpoint rules |
| `index.html` | No changes needed |

---

## 7. Out of Scope

- Dasha panel in 4-chart view
- Persisting `dashaCards` or `splitRatio` to `localStorage` (session-only, resets on page reload)
- Drag-reorder of dasha cards within the split panel
- Year-method / ayanamsa controls in the split panel (those stay in the Dasha tab only)
