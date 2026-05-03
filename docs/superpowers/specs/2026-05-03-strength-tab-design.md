# Strength Tab — Design Spec
**Date:** 2026-05-03

## Overview

Add a "Strength" tab to Hora Prakash with three sub-tabs: Ashtakavarga, Shadbala, and Bar Graph. Computed at the same time as the birth chart and stored in `state.strength`.

---

## Architecture

### New files
| File | Purpose |
|------|---------|
| `src/core/ashtakavarga.js` | `calcBhinnashtakavarga(planets, lagna)` → per-planet 12-score arrays; `calcSarvashtakavarga(bhinna)` → 12-score totals |
| `src/core/shadbala.js` | `calcShadbala(planets, lagna, houses, jd, birth)` → 6 component scores + total per planet |
| `src/tabs/strength.js` | `renderStrength()` — 3 sub-tabs rendering ashtakavarga tables, shadbala table, bar graph |

### Modified files
| File | Change |
|------|--------|
| `index.html` | Add `<button data-tab="strength">Strength</button>` + `<section id="tab-strength">` |
| `src/ui/tabs.js` | Add `strength` case in click + swipe handlers; add `'strength'` to `TAB_ORDER` |
| `src/state.js` | Add `strength: null` field → `{ bhinna, sarva, shadbala }` |
| `src/tabs/input.js` | After `calcBirthChart`, compute and store `state.strength`; call `enableTab('strength')` |

---

## Ashtakavarga (`src/core/ashtakavarga.js`)

### `calcBhinnashtakavarga(planets, lagna)`

Computes Bhinnashtakavarga for 7 planets: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn.

For each planet, 8 contributors cast points (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Lagna). Each contributor has a fixed Parashari benefic-house list. A contributor at sign S casts a point into sign `(S + h - 2) % 12` for each benefic house `h` in its list.

Returns:
```js
{
  Sun:     [s1..s12],  // score per sign index 0–11, range 0–8
  Moon:    [s1..s12],
  Mars:    [s1..s12],
  Mercury: [s1..s12],
  Jupiter: [s1..s12],
  Venus:   [s1..s12],
  Saturn:  [s1..s12],
}
```

#### Benefic house tables (from contributor → houses where point is cast)

**Sun's Bhinnashtakavarga:**
- From Sun: 1,2,4,7,8,9,10,11
- From Moon: 3,6,10,11
- From Mars: 1,2,4,7,8,9,10,11
- From Mercury: 3,5,6,9,10,11,12
- From Jupiter: 5,6,9,11
- From Venus: 6,7,12
- From Saturn: 1,2,4,7,8,9,10,11
- From Lagna: 1,2,4,7,8,9,10,11

**Moon's Bhinnashtakavarga:**
- From Sun: 3,6,7,8,10,11
- From Moon: 1,3,6,7,10,11
- From Mars: 2,3,5,6,9,10,11
- From Mercury: 1,3,4,5,7,8,10,11
- From Jupiter: 1,4,7,8,10,11
- From Venus: 3,4,5,7,9,10,11
- From Saturn: 3,5,6,11
- From Lagna: 3,6,10,11

**Mars's Bhinnashtakavarga:**
- From Sun: 3,5,6,10,11
- From Moon: 3,6,11
- From Mars: 1,2,4,7,8,10,11
- From Mercury: 3,5,6,11
- From Jupiter: 6,10,11,12
- From Venus: 6,8,11,12
- From Saturn: 1,4,7,8,9,10,11
- From Lagna: 1,2,4,7,8,10,11

**Mercury's Bhinnashtakavarga:**
- From Sun: 5,6,9,11,12
- From Moon: 2,4,6,8,10,11
- From Mars: 1,2,4,7,8,9,10,11
- From Mercury: 1,3,5,6,9,10,11,12
- From Jupiter: 6,8,11,12
- From Venus: 1,2,3,4,5,8,9,11
- From Saturn: 1,2,4,7,8,9,10,11
- From Lagna: 1,2,4,7,8,10,11

**Jupiter's Bhinnashtakavarga:**
- From Sun: 1,2,3,4,7,8,9,10,11
- From Moon: 2,5,7,9,11
- From Mars: 1,2,4,7,8,10,11
- From Mercury: 1,2,4,5,6,9,10,11
- From Jupiter: 1,2,3,4,7,8,10,11
- From Venus: 2,5,6,9,10,11
- From Saturn: 3,5,6,12
- From Lagna: 1,2,4,7,8,10,11

**Venus's Bhinnashtakavarga:**
- From Sun: 8,11,12
- From Moon: 1,2,3,4,5,8,9,11,12
- From Mars: 3,4,6,9,11,12
- From Mercury: 3,5,6,9,11
- From Jupiter: 5,8,9,10,11
- From Venus: 1,2,3,4,5,8,9,10,11
- From Saturn: 3,4,5,8,9,10,11
- From Lagna: 1,2,3,4,5,8,9,11

**Saturn's Bhinnashtakavarga:**
- From Sun: 1,2,4,7,8,10,11
- From Moon: 3,6,11
- From Mars: 1,4,7,8,9,10,11
- From Mercury: 6,8,9,10,11,12
- From Jupiter: 5,6,11,12
- From Venus: 6,11,12
- From Saturn: 1,2,4,7,8,9,10,11
- From Lagna: 1,3,4,6,10,11

### `calcSarvashtakavarga(bhinna)`

Sum all 7 bhinna arrays element-wise → array of 12 scores (range 0–56).

### Display

- Each of 7 bhinna tables: 2-row grid (sign abbreviations header + 12 scores). Planet's own sign highlighted.
- Sarvashtakavarga: highlighted total row shown after all 7 tables.
- Signs labelled Ar/Ta/Ge/Ca/Le/Vi/Li/Sc/Sa/Cp/Aq/Pi.

---

## Shadbala (`src/core/shadbala.js`)

Applies to 7 planets: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn.

### `calcShadbala(planets, lagna, houses, jd, birth)`

Returns per planet:
```js
{
  Sun: {
    sthanaBala, digBala, kalaBala, chestaBala, naisargikaBala, drikBala,
    total,       // sum of all 6
    required,    // minimum virupas
    ratio        // total / required
  },
  ...
}
```

### Component details

#### 1. Sthana Bala (positional)

Sum of 5 sub-components:

**Uccha Bala** — linear interpolation between exaltation (60 virupas) and debilitation (0 virupas).
- Exaltation degrees: Sun 10°Ar, Moon 3°Ta, Mars 28°Cp, Mercury 15°Vi, Jupiter 5°Ca, Venus 27°Pi, Saturn 20°Li
- Debilitation = exaltation + 180°
- `ucchaBala = 60 * (1 - angularDist(planet.lon, exaltLon) / 180)`

**Sapta Vargaja Bala** — check dignity in D1, D2, D3, D7, D9, D12, D30. Points per dignity level:
- Moolatrikona: 45 | Own sign: 30 | Great friend: 22.5 | Friend: 15 | Neutral: 7.5 | Enemy: 3.75 | Great enemy: 1.875

Moolatrikona signs: Sun=Leo(1–20°), Moon=Taurus(4–30°), Mars=Aries, Mercury=Virgo(16–20°), Jupiter=Sagittarius, Venus=Libra, Saturn=Aquarius.

Friendship table (natural): use standard Parashari permanent friend/enemy table.

**Ojayugma Bala** — sign parity preferences:
- Sun, Mars, Jupiter, Saturn prefer odd signs → 15 in odd, 0 in even
- Moon, Venus prefer even signs → 15 in even, 0 in odd
- Mercury: 15 in both
- (For navamsa sign in D9, same logic, half weight)

**Kendradi Bala** — house position:
- Angular (1,4,7,10): 60 | Succedent (2,5,8,11): 30 | Cadent (3,6,9,12): 15

**Drekkana Bala** — position in 10° segments of sign:
- Male planets (Sun, Mars, Jupiter): 1st drekkana = 15
- Female planets (Moon, Venus): 3rd drekkana = 15
- Neutral (Mercury, Saturn): 2nd drekkana = 15
- Others: 0

#### 2. Dig Bala (directional)

Best house per planet: Sun/Mars=10th, Moon/Venus=4th, Mercury/Jupiter=1st, Saturn=7th.
Worst house = best + 6 (opposite).
`digBala = 60 * (1 - angularDist(planet.house, bestHouse) / 6)` (house distance 0–6).

#### 3. Kala Bala (temporal)

Implement three sub-components:

**Nathonnatha Bala** — day/night birth:
- Day planets (Sun, Jupiter, Venus): 60 if born during day, 0 at night
- Night planets (Moon, Mars, Saturn): 60 if born at night, 0 during day
- Mercury: always 60
- Day = between sunrise and sunset (use `birth.sunrise`/`birth.sunset` from panchang if available; else approximate from jd/lat/lon)

**Paksha Bala** — moon phase:
- Moon distance from Sun: 0–180° = waxing (shukla), 180–360° = waning (krishna)
- Benefics (Moon, Mercury, Jupiter, Venus): max 60 at full moon, 0 at new moon, linear on 0–180° phase
- Malefics (Sun, Mars, Saturn): inverse (max at new moon)
- Moon's Paksha Bala = `moonPhaseAngle / 3` (0–60)

**Ayana Bala** — declination-based:
- Sun, Mars, Jupiter, Venus: max at north declination (summer solstice)
- Moon, Saturn: max at south declination
- Mercury: always 30
- Use `30 + 30 * sin(declination * π/180)` as approximation (requires swe.calc_ut with lat flag)

Total Kala Bala = sum of three sub-components.

#### 4. Chesta Bala (motional)

- Sun, Moon: use Ayana Bala value (they don't retrograde)
- Other planets:
  - Retrograde: 60
  - Stationary (|speed| < 0.1°/day): 30
  - Direct, slow (speed < mean): 15
  - Direct, fast (speed ≥ mean): 45

Mean daily speeds: Mars=0.524, Mercury=1.383, Jupiter=0.083, Venus=1.2, Saturn=0.033

#### 5. Naisargika Bala (natural, fixed)

| Planet | Virupas |
|--------|---------|
| Sun | 60 |
| Moon | 51.43 |
| Venus | 42.86 |
| Jupiter | 34.28 |
| Mercury | 25.71 |
| Mars | 17.14 |
| Saturn | 8.57 |

#### 6. Drik Bala (aspectual)

For each planet, sum aspectual strength received from other planets:
- Natural benefics (Moon, Mercury, Jupiter, Venus) casting full aspect: +15
- Natural malefics (Sun, Mars, Saturn, Rahu) casting full aspect: -15
- Partial aspect strength proportional (e.g., Mars 3rd/10th house aspect = 25%, 4th/8th = 50%, 5th/9th = 75%, 7th = 100%)

`drikBala = sum / 2` (halved per classical rule)

### Required minimums (virupas)

| Planet | Required |
|--------|---------|
| Sun | 390 |
| Moon | 360 |
| Mars | 300 |
| Mercury | 420 |
| Jupiter | 390 |
| Venus | 330 |
| Saturn | 300 |

### Display

Table with columns: Planet | Sthana | Dig | Kala | Chesta | Naisargika | Drik | **Total** | Required | Ratio.
Total column bold. Ratio colored: green ≥1.0, amber 0.8–0.99, red <0.8.

---

## Bar Graph (`src/tabs/strength.js`)

- SVG horizontal bars, one row per planet (7 rows)
- Bar width = `(total / maxTotal) * maxBarWidth`
- Vertical marker line at required minimum position
- Color per planet: green if ratio ≥ 1.0, amber if 0.8–0.99, red if < 0.8
- Label: planet name left, `total / required = Xx` right
- Max width scaled to highest total among 7 planets

---

## State

```js
// src/state.js addition
state.strength = null
// shape after compute:
state.strength = {
  bhinna: { Sun: [...], Moon: [...], ..., Saturn: [...] },
  sarva:  [...],   // 12 scores
  shadbala: {
    Sun: { sthanaBala, digBala, kalaBala, chestaBala, naisargikaBala, drikBala, total, required, ratio },
    ...
  }
}
```

---

## Sub-tab UI

```
[ Ashtakavarga ] [ Shadbala ] [ Bar Graph ]
```

Buttons styled as secondary pill tabs (smaller than main tabs, no disabled state). Default sub-tab: Ashtakavarga. Sub-tab state not persisted across sessions.

---

## Constraints & Notes

- Rahu/Ketu excluded from both Ashtakavarga and Shadbala (classical rule)
- Shadbala Kala Bala v1 covers only Nathonnatha + Paksha + Ayana (full Kala Bala has 9 sub-components; remaining deferred)
- Sapta Vargaja Bala uses D1/D2/D3/D7/D9/D12/D30 — D7 and D30 require extending `calcDivisional`
- If D7/D30 not yet implemented, fall back to D1/D2/D3/D9/D12 (5 vargas) with proportional weights
- SwissEph `calc_ut` with `SEFLG_EQUATORIAL` (2048) gives declination for Ayana Bala
