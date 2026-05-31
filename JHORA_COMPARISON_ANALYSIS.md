# JHora vs App Comparison Analysis

**Date:** 2026-05-02  
**Settings:** yearMethod=true-solar (TSSY), Ayanamsa=Lahiri  
**Tool:** `tests/compare-jhora-v2.test.mjs` (fixed traversal)

---

## Summary

| Layer | Status | Detail |
|-------|--------|--------|
| Panchang | ✅ All pass | Tithi/Nakshatra/Yoga/Ghatis within tolerance |
| Planets | ✅ All pass | All 10 grahas within 0.013° across 3 charts |
| TSSY sub-period algorithm | ✅ Correct | AD/PD/SD/PAD/Deha match JHora exactly once anchor fixed |
| Dasha anchor | ❌ Off by 53–171 min | Single root cause — Moon longitude method |

---

## v1 Test Bugs (now fixed in v2)

The original `compare-jhora.test.mjs` had two traversal bugs that inflated diffs to thousands of days.

### Bug 1 — Wrong MD matched at intermediate depth

Traversal condition: `n.planet.startsWith(planet) OR time-containment`

`.find()` returns first match. A 53-min anchor offset pushed JHora's Jup-MD start time into
the app's Rahu-MD window. Time-containment matched Rahu (index 3) before name-match reached
Jupiter (index 4). Result: "Jupiter AD within Rahu-MD" (~1939) vs JHora's Jupiter AD (~1954)
= **5491-day false diff**.

### Bug 2 — Deha sub-periods navigated to wrong MD

JHora exports 9 Deha-antardasas under `Sun→Sun→Sun→Sun→Sun PAD` (First Lord Dasha).  
For "Deha Moon", name-match found Moon-MD at depth 0 instead of Sun-MD. Descended to Moon
Deha inside Moon-MD (~1919) vs JHora's Moon Deha inside Sun-PAD (~1913) = **2192-day false diff**.

Pattern was exactly Vimshottari cumulative offsets:

```
Deha Moon: 2192d ≈ Sun MD (6yr)
Deha Mars: 5844d ≈ Sun + Moon MD (16yr)
Deha Rah:  8401d ≈ + Mars MD (23yr)
... etc.
```

### v2 Fix

- Intermediate levels: time-containment only (not OR name-match)
- Deha entries carry full ancestor path from parser (`path: [MD, AD, PD, SD, PAD]`)
- Traversal uses ancestor path at intermediate levels, name-match only at final level

---

## True Diffs After Fixing Traversal (v2 Results)

Every dasha at every level (MD → AD → PD → SD → PAD → Deha) shows **identical constant
offset per chart**:

| Chart | First Dasha | Offset (all levels) |
|-------|-------------|---------------------|
| Indira Gandhi | Sun (6yr) | +53 min |
| Chart A | Sun (6yr) | +54–57 min |
| Chart B | Saturn (19yr) | +3h (~171 min) |

Ratio sanity check: `171 min / 54 min = 3.17 ≈ Saturn/Sun = 19/6 = 3.17` ✓

**The TSSY sub-period calculation is correct.** JHora also uses TSSY for all sub-levels
(AD, PD, SD, PAD, Deha). The algorithm produces matching results once the anchor is correct.

---

## Root Cause: Moon Sidereal Longitude Method

### Ayanamsa discrepancy

```
get_ayanamsa_ut (Lahiri):         22° 42' 36.85"   ← matches JHora 22° 42' 36.71" (0.14" off)
SEFLG_SIDEREAL effective:         22° 42' 52.85"   ← 16" more than get_ayanamsa_ut
```

SwissEph's `SEFLG_SIDEREAL` applies a **latitude-dependent frame rotation** on top of the
ayanamsa. For the Moon (ecliptic latitude 2–5°), this adds ~14–18" extra. JHora uses simple
subtraction: `sidereal = tropical − lahiriAyanamsa`.

### Net Moon discrepancy

The ~16" ayanamsa excess partially cancels against a ~15" tropical Moon difference (different
ephemeris precision between JHora and swisseph-wasm), leaving a net ~0.82" sidereal Moon residual:

| Chart | Moon lat | Moon diff (JHora − App) | Expected anchor offset | Observed |
|-------|----------|------------------------|------------------------|----------|
| Indira Gandhi | +2.3° | 0.816" | 54 min | 53 min ✓ |
| Chart A | −3.8° | 0.839" | 55 min | 54–57 min ✓ |
| Chart B | +5.2° | 0.823" | 171 min | ~180 min ✓ |

Formula: `offset_min = moonDiff_deg / (360/27) × firstDashaYears × 365.256 × 24 × 60`

---

## Suggested Fix (No Core Logic Change)

**One change: how `moon.lon` is prepared before calling `calcDasha`.**

### Current (diverges from JHora by ~16" via frame rotation)

```js
const moonLon = swe.calc_ut(jd, 1, 65536 | 256 | 512)[0]  // SEFLG_SIDEREAL applied internally
```

### Suggested (simple tropical − ayanamsa, matches JHora method)

```js
const moonTrop = swe.calc_ut(jd, 1, 256 | 512)[0]    // tropical position only
const ayan     = swe.get_ayanamsa_ut(jd)              // Lahiri ayanamsa value
const moonLon  = ((moonTrop - ayan) % 360 + 360) % 360
```

**Scope:** Apply only to the Moon longitude used for nakshatra/dasha-balance calculation.
Planet display positions (`planets` array in state) should remain unchanged.

**Expected result after fix:** All dasha levels across all charts pass within ±2 minutes.

---

## Files

| File | Purpose |
|------|---------|
| `tests/compare-jhora-v2.test.mjs` | Fixed comparison test (v2) |
| `tests/compare-jhora.test.mjs` | Original test (has traversal bugs) |
| `jhora/Indira_Gandhi.md` | JHora reference data |
| `jhora/Chart B.md` | JHora reference data |
| `jhora/Chart A.md` | JHora reference data |
| `src/core/dasha.js` | `calcDashaSolarReturn` — TSSY anchor calculation |
