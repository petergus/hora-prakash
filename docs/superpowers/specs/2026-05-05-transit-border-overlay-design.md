# Transit Border Overlay Design

## Goal

Improve transit overlay view: place transiting planets in labeled border zones outside the natal chart boundary, instead of stacking a semi-transparent SVG on top.

## Architecture

### New function: `renderTransitBorderSVG`

**File:** `src/ui/chart-svg.js`

**Signature:**
```js
export function renderTransitBorderSVG(
  natalPlanets, natalLagna, transitPlanets,
  style, filter, activeAspects, activePlanetColors
)
```

Dispatches to `_renderNorthBorder` or `_renderSouthBorder` based on `style`.

---

## North Indian Border Layout

### SVG dimensions

- ViewBox: `0 0 640 640`
- Natal chart: 480×480, translated to `(80, 80)` via `<g transform="translate(80,80)">`
- Border strips: 80px wide on all 4 sides

### House → border section mapping

```
Top strip    (y: 0→80,   x: 80→560, split in 3):   H2 | H1 | H12
Left strip   (x: 0→80,   y: 80→560, split in 3):   H3 | H4 | H5
Bottom strip (y: 560→640, x: 80→560, split in 3):  H6 | H7 | H8
Right strip  (x: 560→640, y: 80→560, split in 3):  H11 | H10 | H9
```

Corner squares (80×80 each) — empty, subtle `#f8fafc` fill.

### Border section rendering

Each section:
1. Background: `#fffbeb` (amber-50), border: `1px solid #fde68a`
2. House label (`H1`…`H12`) — top-left, font-size 10, color `#94a3b8`
3. Transit planets — stacked vertically using adapted `placePlanets`, color `#d97706` (amber-600)
   - Retrograde suffix `℞`
   - `data-planet="<abbr>"` + `data-chart="transit"` on each text element
   - Only planets matching `filter` Set are rendered

### Transit planet → house mapping

Use transit planet's `.house` property (already computed relative to natal lagna).

### Aspect arrows

Drawn inside the `<g transform="translate(80,80)">` group — same logic as existing `renderNorthIndianSVG`. Clicking a border planet fires `onPlanetClick(abbr, 'transit')`.

---

## South Indian Border Layout

South Indian chart has fixed sign positions. No border zones needed.

**Approach:** modify `renderSouthIndianSVG` (or create `renderSouthTransitSVG`) to accept `transitPlanets` and render them in the same sign cells as natal planets, visually distinguished:

- Thin horizontal separator line between natal and transit planet groups within each cell
- Transit planets: color `#d97706` (amber-600), retrograde `℞` suffix
- `data-planet` + `data-chart="transit"` attributes

Filter (`filter` Set) applies — only matching planets render.

---

## `TransitChartPane` changes

### `_renderOverlay` updated

Replace CSS-stacked SVG approach with single call to `renderTransitBorderSVG`:

```js
_renderOverlay(natalPlanets, natalLagna, transitPlanets, chartStyle, filter, natalAsp, transitAsp) {
  const filteredTransit = (transitPlanets || []).filter(p => filter.has(p.abbr))
  const svg = renderTransitBorderSVG(
    natalPlanets, natalLagna, filteredTransit,
    chartStyle, filter,
    natalAsp.activeAspects, natalAsp.activePlanetColors
  )
  this.el.innerHTML = `
    <div class="transit-overlay-pane">
      <div class="transit-chart-label">Natal + Transit</div>
      <div class="transit-border-chart" data-chart="natal">${svg}</div>
    </div>`
}
```

The outer `data-chart="natal"` wrapper ensures natal planet clicks route correctly. Border section planets have `data-chart="transit"` on the element itself — click handler's `closest('[data-chart]')` walk picks up the more specific one.

---

## CSS changes

Remove `.transit-overlay-stack`, `.transit-overlay-natal`, `.transit-overlay-transit` rules (no longer used).

Add:
```css
.transit-border-chart svg { width: 100%; max-width: 640px; }
```

---

## Files to change

| File | Change |
|------|--------|
| `src/ui/chart-svg.js` | Add `renderTransitBorderSVG`, `_renderNorthBorder`, `_renderSouthBorder` helpers |
| `src/components/TransitChartPane.js` | Update `_renderOverlay` to use new function |
| `src/style.css` | Remove stale overlay CSS, add `.transit-border-chart` rule |

No changes to `transit.js`, `sessions.js`, `TransitToolbar.js`, or any non-transit file.

---

## Non-goals

- No changes to dual view
- No changes to existing natal-only chart rendering
- No changes to aspect logic or toolbar
