# Planetary Aspects Visualization — Design Spec

**Date:** 2026-04-19
**Status:** Approved

## Overview

Add interactive planetary aspect arrows to the Vedic chart. Clicking a planet toggles animated dashed arrows from that planet's house centroid to each aspected house centroid. Each planet has a unique color. Show All / Hide All buttons control all aspects at once.

---

## Vedic Aspect Rules

Aspects are counted by house from the planet's own position (1 = own house):

| Planet | Aspects (nth house from itself) |
|--------|---------------------------------|
| Sun, Moon, Mercury, Venus | 7th |
| Mars | 4th, 7th, 8th |
| Jupiter | 5th, 7th, 9th |
| Saturn | 3rd, 7th, 10th |
| Rahu, Ketu | 5th, 7th, 9th (Parashari) |

House offset formula: `aspectedSign = ((planetSign - 1 + nthOffset - 1) % 12) + 1`
where `nthOffset` is `n - 1` (e.g., 7th house = offset of 6).

---

## Planet Colors

| Planet | Abbr | Color | Hex |
|--------|------|-------|-----|
| Sun | Su | Amber | `#f59e0b` |
| Moon | Mo | Indigo | `#6366f1` |
| Mars | Ma | Red | `#ef4444` |
| Mercury | Me | Emerald | `#10b981` |
| Jupiter | Ju | Orange | `#f97316` |
| Venus | Ve | Pink | `#ec4899` |
| Saturn | Sa | Slate | `#64748b` |
| Rahu | Ra | Purple | `#7c3aed` |
| Ketu | Ke | Cyan | `#0891b2` |

---

## Architecture

### New file: `src/core/aspects.js`

Exports:
- `PLANET_COLORS` — map of planet abbr → hex color string
- `ASPECT_OFFSETS` — map of planet abbr → array of sign offsets (0-based, e.g., 7th house = offset 6)
- `getAspectedSigns(planetSign, planetAbbr)` — returns array of aspected sign numbers (1–12)

### Modified: `src/ui/chart-svg.js`

**`placePlanets()`:**
- Each planet `<text>` element gets `data-planet="${p.abbr}"` attribute
- Active planets (passed via `activePlanetColors` map) get a colored `<rect>` highlight behind the label

**`renderNorthIndianSVG(planets, lagna, signLabels, activeAspects)`:**
- `activeAspects` = array of `{ fromSign, toSigns, color }` objects
- For each entry, draws animated arrows from the centroid of `fromSign`'s cell to each `toSign`'s cell centroid
- SVG `<defs>` includes one `<marker>` arrowhead per unique color
- Arrow style: `stroke-dasharray="8 5"`, animated `stroke-dashoffset` (CSS keyframe inside `<style>` tag in SVG)
- `stroke-width="1.8"`, semi-transparent (`opacity="0.85"`)

**`renderSouthIndianSVG(planets, lagna, signLabels, centerLabel, activeAspects)`:**
- Same `activeAspects` param; centroids computed from fixed SI cell grid positions
- Arrow drawn sign-to-sign (SI chart is sign-fixed, so sign = cell)

**`renderChartSVG(planets, lagna, style, signLabels, centerLabel, activeAspects)`:**
- Passes `activeAspects` through to the relevant renderer

### Modified: `src/tabs/chart.js`

**Module state additions:**
```js
let activePlanets = new Set()  // set of planet abbrs currently toggled on
```

**`renderChart()`:**
- Adds "Show All" and "Hide All" buttons to `.chart-controls` row
- Computes `activeAspects` from `activePlanets` + `dPlanets` using `getAspectedSigns()`
- Passes `activeAspects` to `renderChartSVG()`

**`renderSVGOnly(dPlanets, dLagna, signLabels, centerLabel)`:**
- New helper that re-renders only `#chart-container` innerHTML (not the full panel)
- Called on planet click, Show All, Hide All — avoids resetting dropdown/button state

**Event delegation (attached after `renderChart()`):**
- `#chart-container` click listener checks `e.target.closest('[data-planet]')`
- Toggles planet abbr in `activePlanets`, calls `renderSVGOnly()`
- "Show All" → adds all 9 planet abbrs to `activePlanets`, calls `renderSVGOnly()`
- "Hide All" → clears `activePlanets`, calls `renderSVGOnly()`

---

## Arrow Animation

Embedded in SVG `<style>` block:

```css
@keyframes flowAspect {
  from { stroke-dashoffset: 26; }
  to   { stroke-dashoffset: 0; }
}
```

Each arrow line:
```svg
<line ... stroke-dasharray="8 5" style="animation: flowAspect 1.2s linear infinite"/>
```

The animation loops continuously, giving a "flowing toward target" directional feel.

---

## Controls Layout

Existing `.chart-controls` row gets two additional buttons appended:

```
[ D1 ▾ ]  [ North ] [ South ]  [ Show All ]  [ Hide All ]
```

Buttons use existing `.chart-style-btn` class styling for visual consistency.

---

## Constraints

- Arrow rendering does not change sign/house layout, label positions, or planet text
- `activePlanets` is reset to empty on divisional chart change (switching D1→D9 etc.)
- Arrows work identically in both North and South Indian chart styles
- No aspect arrows for the Lagna/Asc pseudo-planet (it has no aspect rules)
