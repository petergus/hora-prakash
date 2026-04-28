# Hora Prakash — Calculation Reference

Complete documentation of every formula and algorithm used in this app.
All Vedic calculations follow Parashari / Lahiri (Chitrapaksha) ayanamsa.

---

## 1. Time Conversion

### Local Time → Julian Day (UT)

**File:** `src/utils/time.js`

1. Parse local date/time string `"YYYY-MM-DDThh:mm:00"` in the given IANA timezone.
2. Resolve UTC by probing the timezone offset twice (handles DST edge cases):
   ```
   tzOffset = localString - UTCString (in minutes, via toLocaleString)
   utcDate  = probeUTC - tzOffset (re-evaluated at the corrected instant)
   ```
3. Convert UTC date to Julian Day (Gregorian calendar formula):
   ```
   if M ≤ 2: Y -= 1, M += 12
   A = floor(Y / 100)
   B = 2 − A + floor(A / 4)
   JD = floor(365.25 × (Y + 4716)) + floor(30.6001 × (M + 1)) + D + h/24 + B − 1524.5
   where h = UTC hours + minutes/60 + seconds/3600
   ```

### Julian Day → UTC Date

Inverse algorithm (Meeus):
```
z = floor(JD + 0.5),  f = JD + 0.5 − z
if z ≥ 2299161:
    alpha = floor((z − 1867216.25) / 36524.25)
    a = z + 1 + alpha − floor(alpha/4)
else a = z
b = a + 1524,  c = floor((b − 122.1) / 365.25),  e = floor((b − floor(365.25×c)) / 30.6001)
day   = b − floor(365.25×c) − floor(30.6001×e)
month = e < 14 ? e − 1 : e − 13
year  = month > 2 ? c − 4716 : c − 4715
```

---

## 2. Birth Chart (Rashi / D1)

**File:** `src/core/calculations.js`  
**Engine:** `swisseph-wasm v0.0.5`, Lahiri ayanamsa

### SwissEph Flags
| Purpose | Flag value |
|---------|-----------|
| Sidereal positions | `65536` (SEFLG_SIDEREAL) |
| Speed | `256` (SEFLG_SPEED) |
| Sidereal + Speed | `65792` |
| Tropical (Panchang only) | `2` (SEFLG_SWIEPH) |
| Tropical + Speed | `258` |

### Planets
Nine grahas, computed with `swe.calc_ut(jd, bodyId, SIDEREAL_SPEED_FLAG)`:

| Planet | Body ID | Notes |
|--------|---------|-------|
| Sun    | 0  | — |
| Moon   | 1  | — |
| Mars   | 4  | — |
| Mercury| 2  | — |
| Jupiter| 5  | — |
| Venus  | 3  | — |
| Saturn | 6  | — |
| Rahu   | 11 | North node (mean) |
| Ketu   | 11 | `Rahu lon + 180° (mod 360)` — no dedicated body |

Return array from `calc_ut`: `[lon, lat, dist, lonSpeed, ...]`

### Lagna (Ascendant)
```
housesResult = swe.houses_ex(jd, 65536, lat, lon, 'P')
lagnaLon     = housesResult.ascmc[0]   // sidereal longitude of Ascendant
```
House cusps array (Placidus sidereal) stored for reference but **not used for house assignment**.

### Sign
```
sign = floor(lon / 30) + 1   // 1–12 (Aries=1 … Pisces=12)
degree = lon % 30
```

### House (Whole-Sign)
**The chart SVG and all house-dependent logic use whole-sign houses.**
```
house = ((planetSign − lagnaSign + 12) % 12) + 1
```
- Planet in the Lagna sign → H1, regardless of degree within sign.
- Verified: 12 test cases across all sign combinations.

### Nakshatra & Pada
27 nakshatras, each spanning `360/27 = 13.333°`:
```
nakshatraIndex = floor(lon / (360/27))   // 0–26
pada           = floor((lon % (360/27)) / (360/108)) + 1   // 1–4
```
Nakshatra lords cycle: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury (repeated × 3).

### Retrograde
```
retrograde = (lonSpeed < 0)
```

### Combustion (Parashari orbs)
Planet is combust if within the following orbs of the Sun (angular distance):

| Planet | Orb |
|--------|-----|
| Moon   | 12° |
| Mars   | 17° |
| Mercury | 14° |
| Jupiter | 11° |
| Venus  | 10° |
| Saturn | 15° |
| Sun, Rahu, Ketu | immune |

```
angularDist(a, b) = |((a − b + 540) % 360) − 180|
combust = angularDist(planet.lon, sun.lon) ≤ orb
```

---

## 3. Divisional Charts

**File:** `src/core/divisional.js`  
**Reference:** PyJHora (`naturalstupid/PyJHora`) — Parashari methods

### Common Helpers
```
part(lon, n) = floor((lon % 30) × n / 30)   // which subdivision: 0..n-1
deg(lon, n)  = ((lon % 30) × n) % 30 / n    // degree within the divisional sign
sign         = floor(lon / 30) + 1           // 1-indexed natal sign
```

### D1 — Rashi (Identity)
```
dSign   = floor(lon / 30) + 1
dDegree = lon % 30
```

### D2 — Hora
Traditional Parashari rule:
```
isOdd     = (sign % 2 === 1)     // Aries, Gemini, Leo, Libra, Sagittarius, Aquarius
firstHalf = (degInSign < 15)
dSign = ((isOdd === firstHalf) ? Leo(5) : Cancer(4))
```
- Odd sign, 0–15°  → Leo; 15–30° → Cancer
- Even sign, 0–15° → Cancer; 15–30° → Leo

### D3 — Drekkana
Each sign maps to its trikona (same-element group); +4 signs per part:
```
l     = part(lon, 3)
dSign = ((sign − 1) + l × 4) % 12 + 1
```
- Aries parts → Aries, Leo, Sagittarius (fire)
- Taurus parts → Taurus, Virgo, Capricorn (earth)
- Gemini parts → Gemini, Libra, Aquarius (air)
- Cancer parts → Cancer, Scorpio, Pisces (water)

### D4 — Chaturthamsa
Each sign maps to its kendra (same quadrant); +3 signs per part:
```
l     = part(lon, 4)
dSign = ((sign − 1) + l × 3) % 12 + 1
```
- Aries parts → Aries, Cancer, Libra, Capricorn (movable signs)
- Taurus parts → Taurus, Leo, Scorpio, Aquarius (fixed signs)
- Gemini parts → Gemini, Virgo, Sagittarius, Pisces (dual signs)

### D5 — Panchamsa
*(Non-standard; uses Parivritti Cyclic as no universal formula in Parashari tradition)*
```
l     = part(lon, 5)
dSign = ((sign − 1) × 5 + l) % 12 + 1
```

### D6 — Shashthamsa
*(Non-standard; Parivritti Cyclic)*
```
l     = part(lon, 6)
dSign = ((sign − 1) × 6 + l) % 12 + 1
```

### D7 — Saptamsa
Odd signs start from self; even signs start from the 7th (self + 6):
```
l      = part(lon, 7)
offset = (sign % 2 === 0) ? 6 : 0
dSign  = ((sign − 1) + offset + l) % 12 + 1
```
- Aries (odd): parts → Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra
- Taurus (even): parts → Scorpio, Sagittarius, … (7th from Taurus)

### D8 — Ashtamsa
*(Non-standard; Parivritti Cyclic)*
```
l     = part(lon, 8)
dSign = ((sign − 1) × 8 + l) % 12 + 1
```

### D9 — Navamsa
Element group seeds (0-indexed): Fire→0 (Aries), Earth→9 (Capricorn), Air→6 (Libra), Water→3 (Cancer):
```
SEEDS = [0, 9, 6, 3,  0, 9, 6, 3,  0, 9, 6, 3]   // index = sign − 1
l     = part(lon, 9)
dSign = (SEEDS[sign − 1] + l) % 12 + 1
```
Sign groups: Fire (Ar/Le/Sg) → from Aries; Earth (Ta/Vi/Cp) → from Capricorn;
Air (Ge/Li/Aq) → from Libra; Water (Ca/Sc/Pi) → from Cancer.

### D10 — Dasamsa
Odd signs start from self; even signs start from the 9th (self + 8):
```
l      = part(lon, 10)
offset = (sign % 2 === 0) ? 8 : 0
dSign  = ((sign − 1) + offset + l) % 12 + 1
```

### D11 — Rudramsa
*(Non-standard; Parivritti Cyclic)*
```
l     = part(lon, 11)
dSign = ((sign − 1) × 11 + l) % 12 + 1
```

### D12 — Dwadasamsa
Each sign starts from itself, advances +1 per 2.5° part:
```
l     = part(lon, 12)
dSign = ((sign − 1) + l) % 12 + 1
```

### Chalit
Not a divisional chart. Replaces `planet.sign` with `planet.house` (whole-sign house number), and sets `lagna.sign = 1`. Shows house-based chart instead of sign-based.

---

## 4. Planetary Aspects (Parashari Vedic)

**File:** `src/core/aspects.js`

All planets aspect the 7th house from themselves. Special additional aspects:

| Planet | Aspects (house offsets from its sign) |
|--------|--------------------------------------|
| Sun    | 7th (+6) |
| Moon   | 7th (+6) |
| Mars   | 4th (+3), 7th (+6), 8th (+7) |
| Mercury | 7th (+6) |
| Jupiter | 5th (+4), 7th (+6), 9th (+8) |
| Venus  | 7th (+6) |
| Saturn | 3rd (+2), 7th (+6), 10th (+9) |
| Rahu   | 5th (+4), 7th (+6), 9th (+8) |
| Ketu   | 5th (+4), 7th (+6), 9th (+8) |

```
aspectedSign(planetSign, offset) = ((planetSign − 1 + offset) % 12) + 1
```

---

## 5. Panchang

**File:** `src/core/panchang.js`  
Uses **tropical** Sun and Moon longitudes for Tithi/Yoga/Karana (standard Vedic panchang practice). Moon nakshatra uses sidereal longitude.

### Tithi
```
diff    = (moonLon − sunLon + 360) % 360    // tropical
tithiNum = floor(diff / 12) + 1             // 1–30
```
- 1–15: Shukla Paksha (waxing), 15 = Purnima
- 16–30: Krishna Paksha (waning), 30 = Amavasya

### Vara (Weekday)
Derived from the birth location's local civil date (`YYYY-MM-DD` from the input profile), not the UTC date. Lord assigned by traditional order (Sun/Mon/Mars/Mer/Jup/Ven/Sat).

### Nakshatra of the Day
Sidereal Moon longitude → nakshatra index and pada (same formula as birth chart).

### Yoga
```
yogaVal  = ((sunLon + moonLon) % 360) / (360/27)    // tropical
yogaName = YOGA_NAMES[floor(yogaVal)]                // 27 yogas
```

### Karana
```
karanaNum = floor(diff / 6)     // 0–59 (half-tithis)
```
- Position 0: Kimstughna (fixed)
- Positions 1–56: 7 moveable karanas cycling (Bava, Balava, Kaulava, Taitila, Garaja, Vanija, Vishti)
- Positions 57–59: Shakuni, Chatushpada, Naga (fixed)

### Sunrise / Sunset
```
dayStartJD = JD of 00:00 at the birth location on the profile's local date
swe.rise_trans(dayStartJD, body=0 (Sun), lon, lat, flags=0, type=1/2)
```
- `type=1` = rise, `type=2` = set
- Valid only if returned JD > 1,000,000 (guards against known swisseph-wasm wrapper bug)

### Rahu Kalam & Gulika Kalam
Day split into 8 equal parts from sunrise to sunset:
```
partMs = (sunsetTime − sunriseTime) / 8
```
Rahu Kalam period by weekday (1-indexed, 1 = first part of day):

| Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|-----|-----|-----|-----|-----|-----|-----|
| 8th | 2nd | 7th | 5th | 6th | 4th | 3rd |

Gulika Kalam period by weekday: Sun=6, Mon=5, Tue=4, Wed=3, Thu=2, Fri=1, Sat=7.

---

## 6. Vimshottari Dasha

**File:** `src/core/dasha.js`

### Sequence & Durations
120-year cycle in fixed order:

| Planet | Years |
|--------|-------|
| Ketu   | 7  |
| Venus  | 20 |
| Sun    | 6  |
| Moon   | 10 |
| Mars   | 7  |
| Rahu   | 18 |
| Jupiter | 16 |
| Saturn | 19 |
| Mercury | 17 |

### Starting Dasha
Determined by the Moon's nakshatra at birth:
```
nakshatraIndex   = floor(moon.lon / (360/27))    // 0–26
dashaStartIndex  = nakshatraIndex % 9            // maps to 0–8 in sequence above
```
Nakshatra-to-dasha mapping: cycles [Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury] × 3 across 27 nakshatras.

### Balance of First Dasha
```
nakshatraSpan    = 360 / 27
posInNakshatra   = moon.lon % nakshatraSpan
fractionElapsed  = posInNakshatra / nakshatraSpan
balanceYears     = dashaSequence[startIndex].years × (1 − fractionElapsed)
```

### Duration Arithmetic
Year-based duration uses `365.25 days/year`:
```
addYears(date, years) = date + years × 365.25 × 24 × 3600 × 1000 ms
```

### Antardasha Duration
```
antarYears = (mahaDurationYears × antarPlanetYears) / 120
```

### Pratyantar Duration
```
pratYears = (antarYears × pratPlanetYears) / 120
```

---

## 7. Age Progression

**File:** `src/core/dasha.js`

### Age Components (DATEDIF equivalent)
Replicates Excel `DATEDIF(dob, ref, "Y/YM/MD")`:
```
years  = refYear − dobYear          (adjusted if day/month borrow needed)
months = refMonth − dobMonth        (adjusted if days < 0 → borrow a month)
days   = refDay − dobDay            (if < 0 → borrow from previous month)
```

### House Active from Age
```
house = (wholeYears % 12) + 1
```
- Year 1 (age 0) → H1, Year 2 (age 1) → H2, …, Year 12 (age 11) → H12, Year 13 (age 12) → H1 (cycle repeats)

---

## 8. Dasha Progression

**File:** `src/core/dasha.js`  
**Reference:** `Dasha Progression-V3-personal.xlsx` (EDATE / SEQUENCE formulas)

Divides a Mahadasha into 12 equal sub-periods using the MD lord's Rashi chart house as the starting point.

### Period Boundaries
```
start(i) = EDATE(mdStart, i × mdDurationYears)
end(i)   = EDATE(mdStart, (i+1) × mdDurationYears)
```
`EDATE` implemented as calendar-month addition via `Date.setUTCMonth()`.  
Each period spans `mdDurationYears` calendar months.

### House Assignments (per period i, 0-indexed)
```
progressionHouse(i) = ((mdLordHouse − 1 + i) % 12) + 1     // forward from lord's house
regressionHouse(i)  = ((mdLordHouse − 1 − i + 120) % 12) + 1  // backward from lord's house
houseFromMDL(i)     = i + 1                                  // sequential 1–12
```

---

## 9. Known Limitations / Bugs in SwissEph WASM

- `rise_trans` has a wrapper bug (passes geopos as individual args instead of pointer array). Returns JD ≈ 0 for many locations. Guarded with `result[0] > 1000000` check — sunrise/sunset show `—` when invalid.
- All calculations use `swisseph-wasm v0.0.5`.
- Ketu has no dedicated body ID in Swiss Ephemeris; it is always computed as `Rahu + 180°`.
