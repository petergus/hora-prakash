# JHora File (.jhd) Import Design

**Date:** 2026-04-24

## Problem

Users with existing JHora chart files (.jhd) have no way to import them into Hora Prakash. They must re-enter birth details manually. The profiles section already supports JSON import/export; JHD import is a natural extension.

---

## Design

### 1. JHD File Format

JHora `.jhd` files are plain-text, one value per line (0-indexed):

| Line | Field | Notes |
|------|-------|-------|
| 0 | Month (1–12) | |
| 1 | Day (1–31) | |
| 2 | Year | |
| 3 | Local time (decimal hours) | e.g. `8.3` = 08:18 |
| 4 | (ignored) | LMT/zone adjustment |
| 5 | Longitude | JHora convention: East = negative |
| 6 | Latitude | Standard: North = positive |
| 7 | (ignored) | Altitude |
| 8 | UTC offset (decimal hours) | JHora: East = negative, e.g. `-5.5` = UTC+5:30 |
| 9 | (ignored) | DST offset |
| 10 | (ignored) | Flag |
| 11 | (ignored) | Ayanamsa code |
| 12 | City name | |
| 13 | Country | |
| 14 | (ignored) | Gender |

Minimum required lines: 14 (0–13). Files with fewer lines are invalid and skipped.

---

### 2. Parser (`src/utils/jhd.js`)

New file with a single export:

```js
export function parseJhdFile(text, filename)
```

**Input:** raw file text string, filename (used to derive the person's name).

**Output:** profile object `{ id, name, dob, tob, lat, lon, timezone, location }`.

**Throws** if the file has fewer than 14 lines or contains non-numeric values where numbers are required.

**Field conversions:**

- **name**: filename without `.jhd` extension; underscores and hyphens replaced with spaces; trimmed.
- **dob**: `YYYY-MM-DD` from lines 2, 0, 1.
- **tob**: `HH:MM` from line 3. `h = Math.floor(decHours)`, `m = Math.round((decHours - h) * 60)`, both zero-padded.
- **lat**: `parseFloat(line[6])` — positive = North, standard convention.
- **lon**: `-parseFloat(line[5])` — negate JHora's East-negative convention to standard East-positive.
- **timezone**: from line 8. `utcHours = -parseFloat(line[8])` (negate JHora sign). `sign = utcHours >= 0 ? '+' : '-'`. `h = Math.floor(Math.abs(utcHours))`, `m = Math.round((Math.abs(utcHours) - h) * 60)`. Format: `±HH:MM`.
- **location**: `line[12].trim() + ', ' + line[13].trim()`.
- **id**: generated via `crypto.randomUUID()` or fallback.

---

### 3. Import Handler (`src/tabs/input.js`)

New function `importJhdFiles(files)`:

1. For each file in the `FileList`, read text via `file.text()` (returns Promise).
2. Call `parseJhdFile(text, file.name)`.
3. Collect successes and failures.
4. Deduplicate against existing profiles by `name + dob` slug — skip if a profile with the same name+dob already exists (case-insensitive name match).
5. Prepend new profiles to the existing list via `saveProfiles`.
6. Call `renderSavedProfiles()`.
7. Show alert:
   - All succeed: `Imported N profile(s).`
   - Mixed: `Imported N profile(s). M file(s) were invalid and skipped.`
   - All fail: `No valid JHD files found.`
   - All duplicates (nothing new): `All profiles already exist.`

---

### 4. UI (`src/tabs/input.js` — `renderSavedProfiles`)

Add a `↑ JHD` button alongside the existing `↑ Import` (JSON) and `↓ Export` buttons:

```html
<label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">
  ↑ JHD
  <input type="file" id="inp-import-jhd" accept=".jhd" multiple style="display:none" />
</label>
```

The `change` event on `#inp-import-jhd` calls `importJhdFiles(e.target.files)` then resets `e.target.value = ''` to allow re-importing the same file.

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/jhd.js` | New file — `parseJhdFile` parser |
| `src/tabs/input.js` | Add `importJhdFiles`, add `↑ JHD` button, wire event |

---

## Validation

Test with sample files from `/Users/priyankgahtori/Astrology/charts/`:
- `Chart A_Gahtori.jhd` → name "Chart A", DOB 1990-07-26, TOB 08:18, lat 29.25, lon 80.06, tz +05:30, location "Location A, India"
- `Narendra_Modi.jhd` → name "Narendra Modi", DOB 1950-09-17, TOB 09:20, lat 23.47, lon 72.38, tz +05:30, location "Vadnagar, India"
- Re-importing same files → "All profiles already exist."
- Selecting a `.txt` file renamed to `.jhd` with wrong format → skipped with error count
