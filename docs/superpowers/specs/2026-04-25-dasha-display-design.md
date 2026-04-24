# Dasha Display — Active-First, Breadcrumb, Planet Colors

**Date:** 2026-04-25

## Summary

Improve the Vimshottari Dasha table with three layered enhancements:
1. **Focused / Full toggle** — defaults to Focused mode showing only the active MD, auto-expanded to its ADs
2. **Breadcrumb strip** — slim bar showing the active path and time remaining in the current AD
3. **Planet color dots** — colored ● before every planet name using existing `PLANET_COLORS`

## Behavior

### Focused Mode (default)

- Only the active MD row is rendered; all other MDs are hidden.
- The active MD is auto-expanded on render, showing all its ADs.
- The active AD receives a `★ now` badge.
- **Collapsing the active MD** reveals all 9 MD rows collapsed (peers become visible). The mode stays `focused` — re-expanding the active MD returns to the focused drill-down (not all ADs of other MDs).
- Expanding a non-active MD in this collapsed peer view works normally (lazy-loads its ADs), consistent with Full mode behavior.

### Full Mode

- All 9 MD rows rendered collapsed. Identical to current behavior.
- Breadcrumb strip is hidden (not needed).

### Toggle

- A `Focused | Full` pill button in the dasha card header, to the left of the existing collapse ▼ button.
- State stored in `ui.focusedMode` (boolean). Default: `true`.
- Switching modes re-renders the table in place (no full panel re-render needed).

### Breadcrumb Strip

Rendered above the dasha table in Focused mode only:

```
★  Ke MD  ›  Su AD  ›  Mo PD  ·  4 months left in AD
```

- Planet names use `PLANET_ABBR` (already in scope).
- "X months left" = `Math.round(daysRemaining / 30.4)` where `daysRemaining = (activeAD.end - now) / 86400000`.
- If `daysRemaining < 30`, show "X days left" instead.
- If no active AD exists (between periods), omit the "left" segment.

### Planet Color Dots

- A `<span class="planet-dot" style="background: COLOR">` before the planet name in every row.
- `COLOR = PLANET_COLORS[PLANET_ABBR[planetName]] ?? '#94a3b8'` — fallback to muted grey.
- Applied in: `makeMdRow`, `makeRow`, `makeLeafRow`, and the DOM-insertion path in `insertChildRows`.

## Data / State Changes

### `src/sessions.js` — `defaultDashaUI()`

Add field:
```js
focusedMode: true,
```

### `src/tabs/dasha.js`

| Area | Change |
|------|--------|
| Header HTML | Add `Focused \| Full` toggle pill next to collapse button |
| `renderDasha()` | Read `ui.focusedMode`; pass it to `buildDashaRows` and breadcrumb render |
| `buildDashaRows()` | In focused mode: only render the active MD row + its ADs; in full mode: unchanged |
| `makeMdRow()` | Add planet dot |
| `makeRow()` | Add planet dot |
| `makeLeafRow()` | Add planet dot |
| `insertChildRows()` | Add planet dot to dynamically inserted rows |
| New `renderBreadcrumb()` | Returns breadcrumb HTML string; empty string in full mode or when no active period |
| Click handler | Handle toggle click: flip `ui.focusedMode`, re-render table body + breadcrumb |

## Files Changed

- `src/tabs/dasha.js` — primary changes
- `src/sessions.js` — add `focusedMode: true` to `defaultDashaUI()`

## Out of Scope

- No changes to AD auto-expansion depth (stays at MD → all ADs, not deeper).
- No changes to Progression or Age Progression sections.
- No changes to the collapsed-section (▼/▶) behavior of the card itself.
