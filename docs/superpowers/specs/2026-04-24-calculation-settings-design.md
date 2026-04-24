# Calculation Settings — Design Spec
**Date:** 2026-04-24
**Status:** Approved

## Problem

Hora Prakash hardcodes Lahiri ayanamsa and Julian year (365.25 days) for all calculations. Professional software like JHora lets users select ayanamsa and Vimshottari year method. Users coming from JHora expect these options.

## Scope

Two independently configurable settings:
1. **Ayanamsa** — affects planet/lagna longitudes (all tabs)
2. **Dasha year method** — affects dasha period boundaries (Dasha tab only)

Both trigger a full recalc when changed (planets + houses + dasha).

---

## Architecture

### New file: `src/core/settings.js`

Single source of truth for user preferences. Persisted to `localStorage` under `hora-prakash-settings`.

**Shape:**
```js
{
  ayanamsa: 1,             // SE_SIDM_* integer (default: Lahiri = 1)
  yearMethod: 'sidereal',  // 'sidereal' | 'tropical' | 'savana' | 'true-solar' | 'custom'
  customYearDays: 365.25   // used only when yearMethod === 'custom'
}
```

**Exports:**
- `getSettings()` — returns current in-memory settings object
- `saveSettings(patch)` — merges patch, writes to localStorage
- `applyAyanamsa()` — calls `getSwe().set_sid_mode(settings.ayanamsa, 0, 0)`

### New file: `src/ui/settings-modal.js`

Gear icon + modal for ayanamsa selection. Appends `<div id="settings-modal">` to `<body>` on init.

**Exports:**
- `initSettingsModal()` — called from `src/main.js` after SwissEph init; renders `⚙` icon into tab bar and wires modal

### Modified: `src/tabs/input.js`

Extract form-submit pipeline into exported `recalcAll()` async function. Both the modal Apply button and dasha year method dropdown call this.

### Modified: `src/core/dasha.js`

`calcDasha` gains a `settings` parameter and becomes `async`:
```js
export async function calcDasha(moon, dobStr, settings, swe)
```

- `swe` is only used when `settings.yearMethod === 'true-solar'`; pass `null` for other methods
- For non-solar methods: returns a resolved promise (no actual async work)

### Modified: `src/tabs/dasha.js`

Year method controls rendered at top of Dasha panel. Reads from `getSettings()`, calls `saveSettings` + `recalcAll()` on change.

---

## Ayanamsa Options (12)

| Label | SE_SIDM constant |
|---|---|
| Lahiri | 1 |
| Raman | 3 |
| Krishnamurti (KP) | 5 |
| Yukteshwar | 7 |
| Fagan-Bradley | 0 |
| Djwhal Khul | 6 |
| De Luce | 2 |
| JN Bhasin | 8 |
| True Citra | 27 |
| Babylonian (Kugler 1) | 9 |
| Suryasiddhanta | 21 |
| Aryabhata | 23 |

---

## Year Method Options (5)

| Label | key | Days per year |
|---|---|---|
| Mean Sidereal | `sidereal` | 365.256363004 |
| Tropical | `tropical` | 365.242190 |
| Savana | `savana` | 360.0 |
| True Solar Return | `true-solar` | computed via Sun longitude |
| Custom | `custom` | user-entered (300–400) |

### True Solar Return algorithm

Uses the same approach as dasha-engine.js method 5:

1. At birth, record `sidSunLonAtBirth`
2. For MD balance: `targetLon = (sidSunLonAtBirth + remainingYears * 360) % 360`. Use Newton's method (6 iterations, `swe.calc_ut`) to find exact JD when Sun reaches `targetLon`. This is `firstMdEndJd`.
3. Each subsequent MD boundary: advance seed by `mdYears * 365.25636` days, refine with Newton's method to the same `targetLon` (each year the Sun returns to this longitude).
4. Sub-dasha boundaries computed proportionally from parent JD span (same as other methods — no extra Sun lookups needed).

Newton's method iteration:
```js
async function findSolarReturn(targetLon, seedJd, swe) {
  let jd = seedJd
  for (let i = 0; i < 6; i++) {
    const lon = swe.calc_ut(jd, 0, 65536 | 256).data[0]  // Sun sidereal
    let diff = targetLon - lon
    while (diff > 180) diff -= 360
    while (diff < -180) diff += 360
    jd += diff / 360  // ~1 day per degree
  }
  return jd
}
```

---

## UI Details

### Gear Icon

- Rendered as a `<button class="settings-btn">⚙</button>` appended to `.tabs` nav bar (right-aligned via `margin-left: auto`)
- Opens `#settings-modal` overlay on click

### Settings Modal

```
┌─────────────────────────────┐
│  ⚙ Calculation Settings   ✕ │
├─────────────────────────────┤
│  Ayanamsa                   │
│  [Lahiri              ▼]    │
│                             │
│  [Apply]  [Cancel]          │
└─────────────────────────────┘
```

- Modal is a centered `position: fixed` overlay
- Apply: `saveSettings({ ayanamsa })` → `applyAyanamsa()` → `recalcAll()` → close modal
- Cancel / ✕: close without saving

### Dasha Tab Year Method Controls

Rendered above the dasha table inside the existing dasha panel:

```
Year Method: [Mean Sidereal ▼]
```

When `Custom` is selected, a number input appears inline:
```
Year Method: [Custom ▼]  Days: [365.25____]
```

- Dropdown `change` event: `saveSettings({ yearMethod })` → `recalcAll()`
- Custom input: debounced 500ms, then `saveSettings({ customYearDays })` → `recalcAll()`
- Controls only shown if `state.dasha !== null`

---

## Recalc Flow

```
saveSettings(patch)
  → applyAyanamsa()           // set_sid_mode on swe instance
  → calcBirthChart(jd, lat, lon)
  → calcDasha(moon, dob, settings, swe)
  → calcPanchang(jd, lat, lon)
  → write to state
  → re-render all tabs
```

`recalcAll()` exported from `src/tabs/input.js`. Called by:
- Modal Apply button (ayanamsa change)
- Dasha year method dropdown change
- Form submit (replaces inline pipeline)

Guard: if `state.birth === null`, return immediately without calculating.

---

## Files Changed

| File | Change |
|---|---|
| `src/core/settings.js` | New — settings state, localStorage persistence, `applyAyanamsa` |
| `src/ui/settings-modal.js` | New — gear icon + ayanamsa modal |
| `src/tabs/input.js` | Extract pipeline into `recalcAll()`, call `applyAyanamsa()` before calc |
| `src/core/dasha.js` | Add `settings` + `swe` params, implement year methods, async for true-solar |
| `src/tabs/dasha.js` | Add year method controls at top of panel |
| `src/main.js` | Call `initSettingsModal()` after `initSwissEph()` |

---

## Unchanged

- `state.js` shape — no new fields
- All divisional chart calculations
- Panchang calculations
- Chart SVG rendering
- Aspect calculations
- Profile save/load
- `calcSubPeriods` internals
- `ensureChildren` lazy loading (still works — node structure unchanged)
