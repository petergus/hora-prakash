# True Sidereal Solar Year — Fix & Calculation Settings

**Date:** 2026-04-24

## Problem

The current True Sidereal Solar Year (TSSY) dasha implementation has two bugs:

1. **Antardasha and below use linear time interpolation** of the parent MD's JD span instead of independently computing each boundary via the ephemeris. The Sun's speed varies within a dasha, so proportional JD division gives wrong dates at every sub-level.

2. **Mahadasha boundaries are off by ~1 hour** because all Sun position lookups use apparent position. JHora defaults to true (geometric) position (`SEFLG_TRUEPOS`), which differs by ~20 arcsec (~30 min per boundary compounded).

Additionally, planet position type (Apparent vs True) and observer type (Geocentric vs Topocentric) are currently hardcoded and should be user-configurable settings that apply to all chart calculations.

---

## Design

### 1. New Settings (`src/core/settings.js`)

Add two fields to `DEFAULTS`:

```js
planetPositions: 'apparent',   // 'apparent' | 'true'
observerType:    'geocentric',  // 'geocentric' | 'topocentric'
```

Add option arrays for UI dropdowns:

```js
export const PLANET_POSITION_OPTIONS = [
  { label: 'Apparent', value: 'apparent' },
  { label: 'True (Geometric)', value: 'true' },
]

export const OBSERVER_TYPE_OPTIONS = [
  { label: 'Geocentric', value: 'geocentric' },
  { label: 'Topocentric', value: 'topocentric' },
]
```

Add a shared flag-builder consumed by both `calculations.js` and `dasha.js`:

```js
export function buildCalcFlags(settings) {
  let flags = 65536 | 256  // SEFLG_SIDEREAL | SEFLG_SPEED
  if (settings?.planetPositions === 'true')       flags |= 512    // SEFLG_TRUEPOS
  if (settings?.observerType    === 'topocentric') flags |= 32768  // SEFLG_TOPOCTR
  return flags
}
```

No change to `applyAyanamsa()`.

---

### 2. Birth Chart Calculations (`src/core/calculations.js`)

- Replace all hardcoded `SIDEREAL | SPEED` flag constants with `buildCalcFlags(settings)`.
- `calcBirthChart(jd, lat, lon)` gains a `settings` parameter: `calcBirthChart(jd, lat, lon, settings)`. Call sites in `input.js` pass `getSettings()`.
- For topocentric: call `swe.set_topo(lon, lat, 0)` once before planet loop. Altitude = 0 (sea level). `swe.set_topo` must be called before any `calc_ut` in the same invocation.
- After topocentric calculations complete, no cleanup needed — ayanamsa mode persists, topocentric setting is per-call context.

---

### 3. TSSY Dasha Fix (`src/core/dasha.js`)

#### 3a. `advanceTSSY(jdStart, years, swe, flags)`

New helper that generalises the existing MD boundary logic:

```
1. sunLon = swe.calc_ut(jdStart, 0, flags)[0]
2. targetLon = (sunLon + years * 360) % 360  — handles fractional years
3. seedJd = jdStart + years * 365.256363004
4. return findSolarReturn(targetLon, seedJd, swe, flags)
```

`findSolarReturn` gains a `flags` parameter (currently hardcodes its own constant).

#### 3b. `calcSubPeriodsTSSY(startIdx, startJd, parentYears, depth, swe, flags)` — async

Replaces `calcSubPeriods` for TSSY mode:

```
curJd = startJd
for i in 0..8:
  adYears = parentYears * seq.years / 120
  endJd = await advanceTSSY(curJd, adYears, swe, flags)
  node = { planet, start: curJd, end: endJd, seqIndex, durationYears: adYears,
           tssy: true,   ← marks node for lazy TSSY expansion
           children: depth > 1 ? await calcSubPeriodsTSSY(..., depth-1, swe, flags) : [] }
  curJd = endJd
```

Only depth=1 is called at startup (same as current `calcSubPeriods` call).

#### 3c. Update `calcDashaSolarReturn`

- Replace `SIDEREAL_SPEED` constant with `flags` parameter passed in from `calcDasha`.
- Replace `calcSubPeriods(...)` with `await calcSubPeriodsTSSY(idx, start, displayYrs, 1, swe, flags)`.
- Set `tssy: true` on each MD node.

#### 3d. Update `calcDasha`

- Pass `buildCalcFlags(settings)` as `flags` into `calcDashaSolarReturn`.

#### 3e. Update `ensureChildren(node, swe, flags)` — becomes async

```js
export async function ensureChildren(node, swe, flags) {
  if (node.children.length > 0) return
  if (node.tssy && swe) {
    node.children = await calcSubPeriodsTSSY(node.seqIndex, node.start, node.durationYears, 1, swe, flags)
  } else {
    node.children = calcSubPeriods(node.seqIndex, node.start, node.durationYears, 1)
  }
}
```

---

### 4. UI — Settings Tab (`src/tabs/settings.js` or equivalent)

Add two `<select>` dropdowns using the same pattern as the existing Year Method dropdown:

- **Planet Positions**: Apparent / True (Geometric)
- **Observer**: Geocentric / Topocentric

Changing either setting triggers full recalculation (same as ayanamsa/year method change).

---

### 5. UI — Dasha Tab (`src/tabs/dasha.js`)

`insertChildRows(parentRow, node, depth)` → becomes async:

```js
async function insertChildRows(parentRow, node, depth) {
  const swe   = getSwe()
  const flags = buildCalcFlags(getSettings())
  await ensureChildren(node, swe, flags)
  // ... existing row insertion logic
}
```

The click handler that calls `insertChildRows` must `await` it (or call it as a fire-and-forget with a re-render after).

The render-loop `ensureChildren` calls (inside `buildDashaRows`) remain synchronous no-ops for TSSY nodes because by the time the render loop sees an expanded TSSY node, children are already populated by the async expand flow. No change needed there.

---

## Data Flow Summary

```
Settings change
  → buildCalcFlags(settings) → flags
  → calcBirthChart(jd, lat, lon, settings) uses flags for all planets
  → calcDasha(..., { settings, swe, jd })
      → if true-solar: calcDashaSolarReturn(jd, swe, flags, ...)
          → MD boundaries: findSolarReturn(targetLon, seed, swe, flags)
          → AD boundaries: calcSubPeriodsTSSY(..., 1, swe, flags)
              → advanceTSSY(curJd, adYears, swe, flags)
  
User expands PD/SD/PrD/Deha
  → insertChildRows (async)
      → ensureChildren(node, swe, flags)
          → calcSubPeriodsTSSY (if tssy node)
      → insert rows into DOM
```

---

## Validation

Cross-check against JHora with:
- Year Type: True Sidereal Solar Year
- Planet Positions: True
- Observer: Geocentric
- Ayanamsa: Lahiri

MD boundaries should match to within ~1 minute. AD boundaries should match to within ~1 second.

---

## Files Changed

| File | Change |
|------|--------|
| `src/core/settings.js` | Add `planetPositions`, `observerType` defaults + option arrays + `buildCalcFlags` |
| `src/core/calculations.js` | Use `buildCalcFlags(settings)` for all planet flags; `set_topo` for topocentric |
| `src/core/dasha.js` | Add `advanceTSSY`, `calcSubPeriodsTSSY`; update `findSolarReturn`, `calcDashaSolarReturn`, `ensureChildren` |
| `src/tabs/dasha.js` | Make `insertChildRows` async; pass `swe` + `flags` to `ensureChildren` |
| `src/tabs/settings.js` | Add two new dropdowns for planet position and observer type |
