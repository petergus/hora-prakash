# Divisional Charts (D1–D12 + Chalit) Design

**Goal:** Add a dropdown to the Chart tab that lets the user switch between D1 Rashi and all standard divisional charts (D2–D12) plus Chalit, updating both the SVG chart and the planet table.

**Architecture:** Pure computation function in a new `src/core/divisional.js`; chart tab reads it on-demand when the dropdown changes. State shape is unchanged — no precomputation at calculation time.

**Tech Stack:** Vanilla JS, existing swisseph planet data (`planet.lon`, `planet.sign`, `planet.degree`, `planet.house`), existing SVG renderer (`renderChartSVG`).

---

## Divisional Chart Computation (`src/core/divisional.js`)

### Standard Parashari formula (D3–D12 except D2)

For divisor `n` and a planet/lagna with sidereal longitude `lon`:
```
sign          = floor(lon / 30) + 1          // 1–12
degreeInSign  = lon % 30
part          = floor(degreeInSign / (30 / n))  // 0-indexed, 0..n-1
dSign         = ((sign - 1) * n + part) % 12 + 1
```

Applies to: D3, D4, D5, D6, D7, D8, D9, D10, D11, D12.

### D1 (Rashi) — identity

`dSign = sign`, `dDegree = degreeInSign`. No transformation.

### D2 (Hora) — traditional rule

- Odd signs (1,3,5,7,9,11): 0–15° → Leo (5), 15–30° → Cancer (4)
- Even signs (2,4,6,8,10,12): 0–15° → Cancer (4), 15–30° → Leo (5)

`dDegree = degreeInSign % 15`

### Chalit — bhava-based placement

Planets are placed by their Placidus house number (`planet.house`, already computed in `calcBirthChart`). The SVG renders planets in house cells rather than sign cells. The lagna is always house 1. Sign labels in the SVG show the actual sign occupying each house cusp.

For Chalit, `calcDivisional` is not called — the chart tab passes `planets` and `lagna` unchanged but uses a `'chalit'` style flag so `renderChartSVG` places by house instead of sign.

### Output shape

`calcDivisional(planets, lagna, n)` returns `{ planets, lagna }` where each planet gets:
- `sign` — D-chart sign (1–12)
- `degree` — degree within that D-chart sign
- All other fields (`name`, `abbr`, `house`, `retrograde`, etc.) preserved as-is

Lagna gets: `sign`, `degree` (same formula applied to `lagna.lon`).

---

## UI Changes

### `src/tabs/chart.js`

- Add `let divisional = 'D1'` module-level state alongside existing `let chartStyle`.
- Add `<select id="div-select" class="div-select">` with 13 options above the North/South buttons:
  - `D1 – Rashi` (default), `D2 – Hora`, `D3 – Drekkana`, `D4 – Chaturthamsha`, `D5 – Panchamsha`, `D6 – Shashthamsha`, `D7 – Saptamsha`, `D8 – Ashtamsha`, `D9 – Navamsa`, `D10 – Dashamsha`, `D11 – Rudramsha`, `D12 – Dwadashamsha`, `Chalit`
- On change: set `divisional`, call `renderChart()` (re-renders in place, same pattern as North/South).
- Chart heading: `${birth.name} — ${divisional === 'D1' ? 'Birth Chart' : divisionalLabel(divisional)}`
- Pass computed divisional planets/lagna to `renderChartSVG`.
- Planet table shows divisional Sign + Degree columns; House column shows original D1 house (unchanged for all variants).

### `src/ui/chart-svg.js`

- `renderChartSVG(planets, lagna, style)` — `style` already accepts `'north'` / `'south'`. No signature change needed; callers pass already-transformed planet data.
- Chalit: chart tab passes `planets` with `sign` replaced by `house` value (1–12) before calling `renderChartSVG`, so the existing sign-keyed rendering works without modification.

### `src/style.css`

Add `.div-select` — styled identically to `.profile-select` (same border, radius, font, focus ring). Sits in a row above the chart-style buttons.

---

## Chalit Detail

For Chalit rendering, the chart tab remaps each planet:
```js
const chaliPlanets = planets.map(p => ({ ...p, sign: p.house }))
const chaliLagna   = { ...lagna, sign: 1 }
```
Then calls `renderChartSVG(chaliPlanets, chaliLagna, chartStyle)` normally. Sign abbreviations in the SVG will show house numbers 1–12 — which is correct for Chalit (each cell represents a bhava, not a rashi).

To make Chalit cells show the actual rashi name instead of a number, `renderChartSVG` would need to know it's Chalit. Simpler: pass `chaliLagna` with `sign = 1` and use a separate sign-label override array `['H1','H2',...,'H12']`. This is passed as an optional `signLabels` array to `renderChartSVG`; default is `SIGN_ABBR`.

---

## Files Changed

| File | Action |
|------|--------|
| `src/core/divisional.js` | **Create** — `calcDivisional(planets, lagna, n)` |
| `src/tabs/chart.js` | **Modify** — add dropdown, call `calcDivisional`, update heading + table |
| `src/ui/chart-svg.js` | **Modify** — accept optional `signLabels` param for Chalit |
| `src/style.css` | **Modify** — add `.div-select` style |

No changes to `state.js`, `calculations.js`, or other tabs.
