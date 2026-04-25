# Dasha View Redesign — Spec

**Date:** 2026-04-25

## Goals

1. Focused/Full toggle becomes a single pill button placed after the heading
2. Focused mode gains a proper drill-down interaction: all MDs visible → click MD → only that MD + its ADs → click AD → only parent MD + that AD + its PDs → etc.
3. Breadcrumb shows current focused path and is fully interactive (click any segment to navigate back)
4. Mobile-optimised layout
5. Modern, professional look
6. Remove planet color dot `<span class="planet-dot">` from all dasha rows

---

## State changes (`src/sessions.js`)

Add one field to `defaultDashaUI`:

```js
focusedPath: []   // Array<string> — planet names at each depth, e.g. ['Rahu', 'Venus', 'Jupiter']
```

`focusedPath.length === 0` → all MDs shown (default view)  
`focusedPath.length === 1` → only `focusedPath[0]` MD shown, expanded with all its ADs  
`focusedPath.length === 2` → only `focusedPath[0]` MD (with only `focusedPath[1]` AD visible), that AD expanded with all its PDs  
...and so on down to depth 4 (PrD level).

Existing `expandedMahas`, `expandedAntars`, `expandedPaths` are retained for **Full mode** only.

---

## Toggle button

**Before (two-span segmented control):**
```html
<div class="focus-toggle">
  <span data-mode="focused">Focused</span>
  <span data-mode="full">Full</span>
</div>
```

**After (single pill button placed after `<h3>`):**
```html
<h3>Vimshottari Dasha — {name}</h3>
<button id="dasha-mode-btn" class="dasha-mode-btn">Focused</button>
```

- Shows current mode label. Click toggles between Focused and Full.
- When switching **Full → Focused**: infer `focusedPath` from `expandedMahas`/`expandedAntars`/`expandedPaths` (see inference logic below).
- When switching **Focused → Full**: no state change to full-mode expansion state; just re-render.

### Inference logic (Full → Focused)

```
1. Pick preferred MD: current-period MD if it is in expandedMahas; else first entry in expandedMahas; else [].
2. If no MD found: focusedPath = []. Done.
3. Pick preferred AD within that MD: current-period AD if expandedAntars.get(md)?.has(ad); else first in expandedAntars.get(md); else stop.
4. If no AD found: focusedPath = [md]. Done.
5. Pick preferred PD: first expandedPath starting with "md/ad/"; else stop.
6. Continue down expandedPaths for SD and PrD levels the same way.
7. focusedPath = collected path segments.
```

---

## `buildDashaRows` in focused mode

```
focusedPath = []
  → render all 9 MD rows, all collapsed (no chevron-expanded state forced)

focusedPath = [MD]
  → render only MD row (expanded ▼), then all its ADs

focusedPath = [MD, AD]
  → render MD row (expanded ▼)
  → render only AD row (expanded ▼), then all its PDs

focusedPath = [MD, AD, PD]
  → render MD row (expanded ▼)
  → render AD row (expanded ▼)
  → render only PD row (expanded ▼), then all its SDs

focusedPath = [MD, AD, PD, SD]
  → render MD, AD, PD rows (all expanded ▼)
  → render only SD row (expanded ▼), then all its PrDs

focusedPath = [MD, AD, PD, SD, PrD]
  → render MD, AD, PD, SD rows (expanded ▼)
  → render PrD row (expanded ▼), then all its DeDs (leaf — no expand)
```

In all cases, **siblings at the selected depth are hidden** (not rendered). Siblings reappear when the user collapses back (clicks the expanded row).

---

## Row click behaviour in focused mode

When a row at depth `D` is clicked:

- **Opening (focusedPath.length ≤ D, or different planet at this depth):**
  `focusedPath = focusedPath.slice(0, D).concat([planet])`  
  Rebuild table + breadcrumb.

- **Closing (focusedPath[D] === planet):**
  `focusedPath = focusedPath.slice(0, D)`  
  Rebuild table + breadcrumb.

Full-mode row clicks retain current DOM-level `insertChildRows`/`removeChildRows` approach.

---

## Breadcrumb

Always visible in focused mode. Hidden in full mode.

**Format:** `All MDs · Ra MD · Ve AD · Ju PD`

- "All MDs" is always the first chip — clicking sets `focusedPath = []`
- Each subsequent chip corresponds to `focusedPath[i]` — clicking sets `focusedPath = focusedPath.slice(0, i+1)`
- Last chip is the current focus level — styled bold/active
- Time-left annotation (`"3 months left in AD"`) appended after last chip when the focused AD is the current period AD

**Breadcrumb is not shown** when `focusedPath = []` (no drill-down active), or in Full mode.

---

## Header layout

```
[drag handle] [h3: Vimshottari Dasha — Name] [Focused btn] [collapse ▼]
```

On mobile (≤ 540px): wrap to two lines — title + controls on line 1, breadcrumb below.

---

## Planet dots

Remove the `planetDot()` function and all its call sites in:
- `makeMdRow`
- `makeRow`
- `makeLeafRow`
- `insertChildRows`

Remove `.planet-dot` CSS rule (also used in Dasha Progression `renderProgression` — keep that usage since it's outside the table and not mentioned).

---

## CSS changes

### New: `.dasha-mode-btn`
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
}
.dasha-mode-btn.focused-active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
```

### Updated: `.dasha-breadcrumb`
Breadcrumb chips are `<button>` elements for keyboard accessibility.

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
  padding: 2px 4px;
  border-radius: 4px;
}
.dasha-crumb-btn:hover { background: rgba(255,255,255,0.08); }
.dasha-crumb-btn.active { color: #fff; font-weight: 600; cursor: default; }
.dasha-crumb-sep { color: #475569; }
```

### Mobile (≤ 540px)
```css
.prog-card-title { flex-wrap: wrap; }
.dasha-breadcrumb { font-size: 0.72rem; }
```

### Remove: `.focus-toggle`, `.focus-toggle span`, `.focus-toggle span.focus-on`

---

## Files to change

| File | Change |
|---|---|
| `src/sessions.js` | Add `focusedPath: []` to `defaultDashaUI` |
| `src/tabs/dasha.js` | All logic: toggle button, buildDashaRows focused logic, row click handler, breadcrumb, remove planetDot |
| `src/style.css` | Add `.dasha-mode-btn`, update `.dasha-breadcrumb`, remove `.focus-toggle` rules |

---

## Out of scope

- Full mode row click behaviour (unchanged)
- Age Progression and Dasha Progression cards (unchanged)
- Drag reorder (unchanged)
- Year method controls (unchanged)
