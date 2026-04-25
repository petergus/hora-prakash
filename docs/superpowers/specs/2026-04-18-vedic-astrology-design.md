# Vedic Astrology Web App — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Overview

A static Vedic astrology web app deployable to GitHub Pages. Users enter birth details, and the app computes and displays a North Indian birth chart, Vimshottari dasha tree, and birth-day panchang. All astronomical calculations run in-browser via WebAssembly (swisseph-wasm). No backend required.

**Calculation reference:** [PyJHora](https://github.com/naturalstupid/PyJHora)  
**WASM library:** [swisseph-wasm](https://github.com/prolaxu/swisseph-wasm)

---

## Stack

- **Vite** — dev server + build tool
- **Vanilla JS ES Modules** — no framework
- **swisseph-wasm** — astronomical calculations (planets, lagna, nakshatras, sunrise)
- **SVG** — birth chart rendering
- **Nominatim (OpenStreetMap)** — free geocoding, no API key required
- **GitHub Pages** — deployment via `vite build --base=/aditya-amrit-hora/`

---

## Project Structure

```
src/
  main.js              # App entry point, tab routing
  tabs/
    input.js           # Tab 1: user details form
    chart.js           # Tab 2: birth chart display
    dasha.js           # Tab 3: Vimshottari dasha table
    panchang.js        # Tab 4: birth day panchang
  core/
    swisseph.js        # WASM loader + thin wrapper
    calculations.js    # Planets, lagna, house cusps, nakshatras
    dasha.js           # Vimshottari dasha logic
    panchang.js        # Tithi, vara, nakshatra, yoga, karana
  ui/
    chart-svg.js       # North Indian chart SVG renderer
    tabs.js            # Tab switching logic
  utils/
    geocoding.js       # Location search via Nominatim
    time.js            # Timezone + Julian Day conversion
public/
  index.html
```

---

## Data Flow

```
User Input
  → geocoding.js       Nominatim → { lat, lon, timezone }
  → time.js            Local time → UTC → Julian Day
  → swisseph.js        JD + coords → raw planet positions
  → calculations.js    Lagna, house cusps, nakshatra lords (Lahiri ayanamsa)
  → app state          Single state object shared across all tabs
  → tabs render        Chart, Dasha, Panchang read from state
```

Calculation fires once on form submit. Results are stored in a single JS state object and consumed by all tabs without recalculation.

---

## Tab 1: User Input

**Fields:**
- Name (text)
- Date of Birth (date picker)
- Time of Birth (time picker)
- Location (text search → Nominatim autocomplete)
- Coordinates (lat/lon — read-only after geocode, with manual override)

**Behavior:** On submit, validates all fields, triggers full calculation pipeline, advances to Chart tab.

---

## Tab 2: North Indian Birth Chart

- Standard 4×4 diamond grid, 12 fixed house cells
- Lagna always in top-center cell (house 1 fixed position)
- Planet abbreviations + degrees rendered inside each house cell
- Planets: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu + Lagna marker
- Rendered as programmatic SVG via `chart-svg.js` (no charting library)
- SVG scales responsively to container width
- **Ayanamsa:** Lahiri (Chitrapaksha) — matching PyJHora default

---

## Tab 3: Vimshottari Dasha

- Mahadasha sequence derived from Moon's nakshatra balance at birth
- Planet order: Sun → Moon → Mars → Rahu → Jupiter → Saturn → Mercury → Ketu → Venus (120-year cycle)
- Display: 3-level expandable table — Mahadasha → Antardasha → Pratyantar dasha
- Each row: Planet name, Start Date, End Date, Duration
- Currently running dasha period highlighted

---

## Tab 4: Panchang (MVP — Birth Date)

Displays the 5 elements for the birth date/time/location:

| Element | Description |
|---------|-------------|
| Tithi | Lunar day (1–30) |
| Vara | Weekday + ruling planet |
| Nakshatra | Moon's nakshatra + pada |
| Yoga | One of 27 yogas |
| Karana | Half-tithi |

Additional: Sunrise, Sunset, Rahu Kalam, Gulika Kalam

All values derived from swisseph-wasm — no external panchang API.

**Future:** Allow any date input for daily panchang lookup.

---

## Deployment

```bash
npm run build          # vite build --base=/aditya-amrit-hora/
# push dist/ to gh-pages branch
```

GitHub Actions workflow to auto-deploy on push to main.
