# Transit Forecast & Tooltip Enhancement — Design Spec

**Date:** 2026-05-07  
**Status:** Approved

---

## Overview

Enhance the transit screen with "next major event" forecasts for transiting planets. Desktop gets an updated hover tooltip showing the nearest 2 upcoming events. All platforms get an inline table-row expansion (click/tap) showing the full forecast — sign ingress, retrograde stations, nakshatra/pada changes, gandanta crossings, combustion, and exact natal aspects.

---

## Architecture

### New File: `src/core/transitForecast.js`

Primary export:
```js
findNextEvents(planet, fromJD, natalPlanets, natalLagnaSign) → Event[]
```

`Event` shape:
```js
{ type, date, detail }
// type: 'retro' | 'direct' | 'sign' | 'nakshatra' | 'pada' | 'gandanta' |
//       'combust_enter' | 'combust_exit' | 'natal_aspect'
// date: JS Date
// detail: string (human-readable, e.g. "Enters Gemini (H2)")
```

Events returned sorted ascending by date.

### Per-Planet Scan Windows

| Planet | Scan Window |
|--------|-------------|
| Moon | 30 days |
| Mercury, Venus | 90 days |
| Sun, Mars | 180 days |
| Jupiter, Rahu, Ketu | 18 months |
| Saturn | 2 years |

### Computation: Adaptive Step + Bisection

1. Coarse scan: 1-day steps across scan window, call `swe.calc_ut()` per step
2. When boundary crossing detected (speed sign change, longitude boundary, distance threshold), bisect to ±1 hour precision
3. ~50–200 WASM calls per planet per event type — runs synchronously, ~50–200ms total per planet

### Event Detection

| Event | Detection method |
|-------|-----------------|
| Retrograde / Direct | Speed sign change (positive ↔ negative) |
| Sign ingress | `floor(lon / 30)` changes |
| Nakshatra change | `floor(lon / (360/27))` changes |
| Pada change | `floor(lon / (360/108))` changes |
| Gandanta | Sign boundary: Pisces→Aries, Cancer→Leo, Scorpio→Sagittarius (last 3°20' / first 3°20') |
| Combust entry/exit | Angular separation to Sun crosses Parashari orb (per planet) |
| Natal aspect | Transiting planet's lon hits exact aspect angle to natal planet lon |

Natal aspects checked: conjunction (0°), sextile (60°), square (90°), trine (120°), opposition (180°). Applied per-planet based on standard Parashari aspect rules (e.g. Mars also has 4th/8th).

Combust orbs from `src/core/calculations.js` (already defined): Mo 12°, Ma 17°, Me 14°, Ju 11°, Ve 10°, Sa 15°. Sun/Ra/Ke never combust.

---

## UI

### Tooltip (Desktop hover only)

Extends existing `TransitTooltip.js`. Adds "Next Events" section below existing rows showing nearest 2 upcoming events. Events fetched from cache (computed lazily on first hover).

```
┌─────────────────────────────────┐
│ ♃  Jupiter          [Transit]   │
├─────────────────────────────────┤
│ Sign      Taurus ♉              │
│ Nakshatra Rohini · Pāda 2       │
│ Degree    14°32'                │
│ Speed     +0.083°/d             │
├── Next Events ──────────────────│
│ ⟳ Retrograde    Jun 9          │
│ → Gemini        Jul 14          │
└─────────────────────────────────┘
```

If forecast not yet computed, tooltip shows "Loading…" and re-renders once ready.

### Inline Row Expansion (Click/Tap — all platforms)

Click/tap a planet row in `TransitTable` toggles an expansion `<tr>` beneath it. Full forecast split into two sections: Upcoming Transits and Natal Aspects.

```
▼ Jupiter  Taurus · Rohini Pāda 2     [row toggled]
┌─────────────────────────────────────────────┐
│ UPCOMING TRANSITS                           │
│                                             │
│ Jun 9    ℞ Goes Retrograde                  │
│ Jul 14   → Enters Gemini (H2)               │
│ Jul 19   ★ Nakshatra: Mrigashira            │
│ Aug 3    ⚠ Gandanta crossing                │
│ Sep 1    ☀ Combust (within 11°)             │
│ Oct 12   ◎ Direct station                   │
│                                             │
│ NATAL ASPECTS                               │
│ Jun 15   △ Trine natal Moon (exact)         │
│ Aug 22   ☌ Conjunct natal Sun               │
└─────────────────────────────────────────────┘
```

Pada changes appear in full panel only (not tooltip — too frequent).  
Dates are formatted relative to the transit date set in the toolbar (not today's date).  
Mobile: expansion is full-width, same markup.

---

## Data Flow

1. User hovers (desktop) or taps (all) a transiting planet
2. Check `ui.forecastCache[abbr]` in session state
3. **Cache hit** → render immediately
4. **Cache miss** → call `findNextEvents(...)` synchronously, store in cache, render
5. Tooltip renders nearest 2 events; table expansion renders full sorted list
6. Cache invalidated when transit date/time changes (on `calcAndRender`)

Cache lives at `session.uiState.transit.forecastCache` (plain object keyed by planet abbr). Wiped on session switch and on transit date/time change. Never persisted to localStorage.

---

## Files Changed

| File | Change |
|------|--------|
| `src/core/transitForecast.js` | **New** — forecast engine |
| `src/components/TransitTooltip.js` | Add "Next Events" section; accept forecast data |
| `src/components/TransitTable.js` | Add click handler; toggle inline expansion row |
| `src/tabs/transit.js` | Pass forecast cache invalidation on date change; wire forecast into tooltip/table |

No new tabs. No new top-level components.

---

## Out of Scope

- Push notifications or alerts for upcoming events
- Exporting forecast to calendar
- Panchang-level muhurta scoring of events
- Divisional chart forecasts (D9, D12, etc.) — forecast is D1 only
