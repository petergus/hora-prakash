# Hora Prakash

**Live app:** [https://priyankgahtori.github.io/hora-prakash/](https://priyankgahtori.github.io/hora-prakash/)

**Repository:** [https://github.com/Chart AGahtori/hora-prakash](https://github.com/Chart AGahtori/hora-prakash)

A Vedic astrology web app that runs entirely in the browser — no backend, no API keys required.

---

## Features

- **Birth Chart** — North Indian (diamond/triangle layout) and South Indian (fixed sign grid) SVG charts rendered directly in the browser
- **Planetary Positions** — all 9 Vedic grahas (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Rahu, Ketu) with sign, degree, house, nakshatra, pada, and retrograde status
- **Vimshottari Dasha** — 3-level expandable tree: Mahadasha → Antardasha → Pratyantar dasha with start/end dates; current period highlighted
- **Panchang** — Tithi, Vara, Nakshatra, Yoga, Karana, sunrise/sunset, Rahu Kalam, Gulika Kalam for the birth date and location
- **Location autocomplete** — type any city name, powered by OpenStreetMap Nominatim (no API key)
- **Saved Profiles** — save multiple birth details to browser localStorage, load from dropdown, delete individually or clear all
- **Smart defaults** — pre-filled with today's date, current time, and New Delhi as default location

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173/hora-prakash/](http://localhost:5173/hora-prakash/)

```bash
npm run build     # production build → dist/
npm run preview   # preview production build locally
```

Pushes to `main` automatically deploy to GitHub Pages via `.github/workflows/deploy.yml`.

---

## Calculations

All astronomical calculations use the **Swiss Ephemeris** compiled to WebAssembly.

- **Ayanamsa:** Lahiri (SE_SIDM_LAHIRI) — the standard for Vedic/Jyotish astrology
- **House system:** Placidus (via `houses_ex` with sidereal flag)
- **Ketu:** computed as Rahu longitude + 180° (no separate ephemeris body)
- **Vimshottari Dasha:** 120-year cycle seeded from Moon's nakshatra at birth; balance computed from fraction of nakshatra elapsed at birth time
- **Panchang:** Tithi and Yoga use tropical Sun+Moon longitudes; Nakshatra uses sidereal Moon; sunrise/sunset via `rise_trans`

---

## Credits & References

### Astronomical Engine
- **[Swiss Ephemeris](https://www.astro.com/swisseph/)** by Astrodienst AG — the industry-standard ephemeris library used by professional astrology software worldwide
- **[swisseph-wasm](https://github.com/prolaxu/swisseph-wasm)** by prolaxu — Swiss Ephemeris compiled to WebAssembly for browser use (v0.0.5)

### Chart Layout Reference
- **[jyotichart](https://github.com/VicharaVandana/jyotichart)** by VicharaVandana — reference implementation for North and South Indian chart polygon geometry

### Calculation Reference
- **[PyJHora](https://github.com/naturalstupid/PyJHora)** by naturalstupid — Python Vedic astrology library used as a reference for calculation logic and panchang methodology

### External APIs (free, no key required)
- **[Nominatim](https://nominatim.openstreetmap.org/)** (OpenStreetMap) — location geocoding and search
- **[timeapi.io](https://timeapi.io/)** — IANA timezone lookup by coordinates

### Build & Tooling
- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **[coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)** by gzuidhof — service worker for Cross-Origin Isolation headers (required for WASM SharedArrayBuffer on GitHub Pages)

---

## Architecture

```
src/
  core/          # astronomical calculations (swisseph wrapper, dasha, panchang)
  tabs/          # UI panels: input form, chart, dasha, panchang
  ui/            # chart SVG renderer, tab navigation
  utils/         # geocoding API, time/Julian Day conversion
  state.js       # shared mutable state
  main.js        # entry point
public/
  wasm/          # swisseph.wasm + swisseph.data (served as static files)
  icon.svg       # app brand icon
  coi-serviceworker.js
```

The app initializes the WASM engine on load, then waits for form submission. All rendering is pure DOM/SVG — no React, Vue, or canvas.
