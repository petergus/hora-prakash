# Hora Prakash

**Live app:** [https://priyankgahtori.github.io/hora-prakash/](https://priyankgahtori.github.io/hora-prakash/)

A browser-based Vedic astrology calculator. No backend, no API keys, no data leaves your device. All astronomical calculations run client-side via Swiss Ephemeris compiled to WebAssembly.

---

## Features

### Charts
- **Birth Chart** — North Indian (diamond/triangle) and South Indian (fixed sign grid) SVG charts
- **Divisional Charts** — full D1–D12 suite plus Chalit; chart and planet table update instantly
  - D1 Rashi · D2 Hora · D3 Drekkana · D4 Chaturthamsha · D5 Panchamsha · D6 Shashthamsha · D7 Saptamsha · D8 Ashtamsha · D9 Navamsha · D10 Dashamsha · D11 Rudramsha · D12 Dwadashamsha · Chalit
- **Transit Chart** — dual-chart overlay showing natal and transit positions simultaneously, with aspect table and hover tooltips

### Planets & Dashas
- **Planetary Positions** — all 9 Vedic grahas with sign, degree, D1 house, nakshatra, pada; retrograde **(R)** and combust **(C)** flagged
- **Vimshottari Dasha** — 3-level expandable tree: Mahadasha → Antardasha → Pratyantar Dasha with start/end dates; current period highlighted

### Panchang
- Tithi, Vara, Nakshatra, Yoga, Karana, Lunar Year/Month, sunrise/sunset, Rahu Kalam, Gulika Kalam

### Strength
- **Shadbala** — six-source planetary strength (Sthana, Dig, Kala, Chesta, Naisargika, Drik) in rupas for Sun–Saturn
- **Ashtakavarga** — Bhinnashtakavarga per planet, Sarvashtakavarga, benefic point tables per sign

### Multi-Profile & UX
- **Multiple Sessions** — open and compare multiple charts simultaneously in tab strip
- **Saved Profiles** — persist charts to browser localStorage; load, edit, or delete anytime
- **Location Autocomplete** — powered by OpenStreetMap Nominatim; manual entry + auto-detect timezone
- **JHD Import** — drag-drop or open `.jhd` files from Jagannatha Hora
- **Themes** — 6 colour themes: Indigo, Saffron, Forest, Rose, Midnight, Crimson

---

## Getting Started

```bash
npm install
npm run dev        # dev server → http://localhost:5173/hora-prakash/
npm run build      # production build → dist/
npm run preview    # preview production build locally
```

Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/deploy.yml`.

---

## Calculations

All ephemeris computations use **Swiss Ephemeris** (WebAssembly build).

| Feature | Method |
|---|---|
| Ayanamsa | Lahiri (SE_SIDM_LAHIRI) |
| House system | Placidus via `houses_ex` with sidereal flag |
| Ketu | Rahu longitude + 180° |
| Divisional charts | Parashari: `sign = ((rasi−1)×n + floor(degInSign×n/30)) mod 12 + 1`; D2 uses traditional Hora rule; Chalit by Placidus house |
| Combustion | Parashari orbs — Moon 12°, Mars 17°, Mercury 14°, Jupiter 11°, Venus 10°, Saturn 15° |
| Vimshottari Dasha | 120-year cycle; balance from Moon nakshatra fraction at birth |
| Panchang | Tithi/Yoga from tropical Sun+Moon; Nakshatra from sidereal Moon; sunrise via `rise_trans` |

---

## Architecture

```
src/
  core/           # calculations: swisseph wrapper, dasha, panchang, divisional, shadbala, ashtakavarga
  tabs/           # UI panels: input, chart, transit, dasha, panchang, strength
  components/     # reusable UI: TransitChartPane, TransitToolbar, TransitTooltip
  ui/             # chart SVG renderer, tab navigation, profile tabs
  utils/          # geocoding, Julian Day conversion, JHD parser
  state.js        # shared mutable state (birth, planets, lagna, houses, dasha, panchang)
  sessions.js     # multi-profile session management
  main.js         # entry point — init WASM, then tabs
public/
  wasm/           # swisseph.wasm + swisseph.data (static, not bundled)
  coi-serviceworker.js
```

Pure DOM/SVG — no React, Vue, or canvas. WASM engine initializes on load; all rendering is synchronous after form submission.

---

## Credits

### Astronomical Engine
- **[Swiss Ephemeris](https://www.astro.com/swisseph/)** by Astrodienst AG — industry-standard ephemeris library
- **[swisseph-wasm](https://github.com/prolaxu/swisseph-wasm)** by prolaxu — Swiss Ephemeris compiled to WebAssembly (v0.0.5)

### References
- **[jyotichart](https://github.com/VicharaVandana/jyotichart)** by VicharaVandana — North/South Indian chart geometry reference
- **[PyJHora](https://github.com/naturalstupid/PyJHora)** by naturalstupid — reference for panchang and dasha calculation methodology

### External APIs
- **[Nominatim](https://nominatim.openstreetmap.org/)** (OpenStreetMap) — location geocoding
- **[timeapi.io](https://timeapi.io/)** — IANA timezone lookup by coordinates

### Tooling
- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **[coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)** — Cross-Origin Isolation for WASM SharedArrayBuffer on GitHub Pages

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This license is required by the underlying **Swiss Ephemeris** library. Per Astrodienst's terms, any software that incorporates Swiss Ephemeris must either:
1. Be released under the GNU AGPL v3 (or a compatible copyleft license), **or**
2. Purchase a commercial license from Astrodienst AG

See [LICENSE](LICENSE) for the full license text and [Swiss Ephemeris licensing](https://www.astro.com/swisseph/swephinfo_e.htm#licen) for details on the upstream requirement.
