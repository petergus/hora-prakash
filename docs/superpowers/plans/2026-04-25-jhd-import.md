# JHD Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `↑ JHD` button to the saved-profiles section that imports one or more JHora `.jhd` files directly as saved profiles, without filling the birth form.

**Architecture:** A new pure parser module (`src/utils/jhd.js`) converts `.jhd` text to a profile object. `src/tabs/input.js` adds `importJhdFiles(files)` (reads each file, calls parser, deduplicates, saves) and wires a new `↑ JHD` button in `renderSavedProfiles`. No other files change.

**Tech Stack:** Vanilla JS, browser FileList/File APIs (`file.text()`), `crypto.randomUUID`, localStorage.

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/jhd.js` | New — `parseJhdFile(text, filename)` parser |
| `src/tabs/input.js` | Add `importJhdFiles`, add `↑ JHD` button in both branches of `renderSavedProfiles`, wire `change` event |

---

### Task 1: JHD parser (`src/utils/jhd.js`)

**Files:**
- Create: `src/utils/jhd.js`

**Background — JHD file format:**
Plain text, one value per line (0-indexed):
- Line 0: Month (1–12)
- Line 1: Day (1–31)
- Line 2: Year (4-digit)
- Line 3: Time — stored as `H.MM` (NOT decimal fractional hours). `8.30` = 08:30, `9.34` = 09:34
- Line 4: ignored
- Line 5: Longitude — JHora East=negative (negate to get standard East-positive)
- Line 6: Latitude — standard North=positive (no change needed)
- Line 7: ignored
- Line 8: UTC offset — JHora East=negative (negate to get standard). e.g. `-5.5` → `+05:30`
- Lines 9–11: ignored
- Line 12: City name
- Line 13: Country
- Line 14+: ignored; minimum required = 14 lines (indices 0–13)

**Deduplication key** (used by `importJhdFiles`, not the parser): `name|dob|tob|location` — all four fields, case-insensitive name.

- [ ] **Step 1: Create `src/utils/jhd.js` with the parser**

```js
// src/utils/jhd.js

export function parseJhdFile(text, filename) {
  const lines = text.split(/\r?\n/)
  if (lines.length < 14) throw new Error(`${filename}: too few lines (need ≥14, got ${lines.length})`)

  const num = (i) => {
    const v = parseFloat(lines[i])
    if (isNaN(v)) throw new Error(`${filename}: line ${i} is not a number ("${lines[i]}")`)
    return v
  }

  const month = num(0)
  const day   = num(1)
  const year  = num(2)

  // Line 3 is H.MM format (not decimal fractional hours)
  const rawTime = num(3)
  const h = Math.floor(rawTime)
  const m = Math.round((rawTime - h) * 100)
  const tob = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  const dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Line 5: JHora East=negative → negate for standard East-positive
  const lon = -num(5)
  const lat =  num(6)

  // Line 8: JHora East=negative UTC offset → negate
  const utcHours = -num(8)
  const sign     = utcHours >= 0 ? '+' : '-'
  const absH     = Math.floor(Math.abs(utcHours))
  const absM     = Math.round((Math.abs(utcHours) - absH) * 60)
  const timezone = `${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`

  const city    = lines[12].trim()
  const country = lines[13].trim()
  const location = city && country ? `${city}, ${country}` : city || country

  const rawName = filename.replace(/\.jhd$/i, '')
  const name    = rawName.replace(/[_-]+/g, ' ').trim()

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

  return { id, name, dob, tob, lat, lon, timezone, location }
}
```

- [ ] **Step 2: Verify parser logic manually**

Open browser console (or Node) and spot-check the conversions:
- `parseFloat('8.30')` → `8.3`, `Math.floor(8.3)` → `8`, `Math.round((8.3 - 8) * 100)` → `30` ✓ → `08:30`
- `parseFloat('9.34')` → `9.34`, `Math.floor(9.34)` → `9`, `Math.round((9.34 - 9) * 100)` → `34` ✓ → `09:34`
- lon: `-(-79.94)` → `79.94` ✓
- UTC: `utcHours = -(-5.5) = 5.5`, sign=`+`, absH=`5`, absM=`30` → `+05:30` ✓

No test file to run; proceed to Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/utils/jhd.js
git commit -m "feat: add JHD file parser (src/utils/jhd.js)"
```

---

### Task 2: `importJhdFiles` function in `src/tabs/input.js`

**Files:**
- Modify: `src/tabs/input.js`

**Context:** `src/tabs/input.js` already has `loadProfiles`, `saveProfiles`, `genId`, `renderSavedProfiles`. The JSON importer `importProfiles` (lines 61–83) is the pattern to follow. This task adds `importJhdFiles(files)` which reads a `FileList`, parses each file, deduplicates, prepends new profiles, and shows an alert. No UI changes yet — that's Task 3.

Dedup key: `${name.toLowerCase()}|${dob}|${tob}|${location}` — matches existing profiles by name (case-insensitive) + dob + tob + location.

- [ ] **Step 1: Add the import for `parseJhdFile` at the top of `src/tabs/input.js`**

After line 11 (the last `import` statement), add:

```js
import { parseJhdFile } from '../utils/jhd.js'
```

So the import block becomes:
```js
import { searchLocation, getTimezone } from '../utils/geocoding.js'
import { toJulianDay } from '../utils/time.js'
import { calcBirthChart } from '../core/calculations.js'
import { calcDasha } from '../core/dasha.js'
import { calcPanchang } from '../core/panchang.js'
import { applyAyanamsa, getSettings } from '../core/settings.js'
import { getSwe } from '../core/swisseph.js'
import { state } from '../state.js'
import { switchTab, enableTab } from '../ui/tabs.js'
import { decToDMS, dmsToDec, offsetParts, offsetStr, ianaToOffset, fmtLat, fmtLon } from '../utils/format.js'
import { parseJhdFile } from '../utils/jhd.js'
```

- [ ] **Step 2: Add `importJhdFiles` function after `importProfiles` (after line 83)**

Insert this function between `importProfiles` and the `// ── Helpers` comment:

```js
async function importJhdFiles(files) {
  const existing    = loadProfiles()
  const existingKeys = new Set(
    existing.map(p => `${p.name.toLowerCase()}|${p.dob}|${p.tob}|${(p.location||'').toLowerCase()}`)
  )
  const successes = []
  let failCount   = 0
  let dupCount    = 0

  for (const file of files) {
    try {
      const text    = await file.text()
      const profile = parseJhdFile(text, file.name)
      const key     = `${profile.name.toLowerCase()}|${profile.dob}|${profile.tob}|${(profile.location||'').toLowerCase()}`
      if (existingKeys.has(key)) { dupCount++; continue }
      existingKeys.add(key)
      successes.push(profile)
    } catch {
      failCount++
    }
  }

  if (successes.length > 0) {
    saveProfiles([...successes, ...existing])
    renderSavedProfiles()
  }

  const n = successes.length
  const m = failCount
  if (n > 0 && m === 0 && dupCount === 0) {
    alert(`Imported ${n} profile${n > 1 ? 's' : ''}.`)
  } else if (n > 0 && m > 0) {
    alert(`Imported ${n} profile${n > 1 ? 's' : ''}. ${m} file${m > 1 ? 's' : ''} were invalid and skipped.`)
  } else if (n > 0 && dupCount > 0 && m === 0) {
    alert(`Imported ${n} profile${n > 1 ? 's' : ''}. ${dupCount} already existed.`)
  } else if (n === 0 && dupCount > 0 && m === 0) {
    alert('All profiles already exist.')
  } else {
    alert('No valid JHD files found.')
  }
}
```

- [ ] **Step 3: Start dev server and verify no import errors**

```bash
npm run dev
```

Open `http://localhost:5173/hora-prakash/` in browser. Check console — should be no errors. The `↑ JHD` button doesn't exist yet; that's Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/input.js
git commit -m "feat: add importJhdFiles function to input.js"
```

---

### Task 3: Add `↑ JHD` button to `renderSavedProfiles`

**Files:**
- Modify: `src/tabs/input.js`

**Context:** `renderSavedProfiles` in `src/tabs/input.js` has two branches:
1. **Empty state** (lines 236–248): shows "No saved profiles" + single `↑ Import` button
2. **Non-empty state** (lines 250–323): shows header row with `↓ Export`, `↑ Import`, `Clear All` buttons

The `↑ JHD` button must be added to both branches, placed between `↑ Import` and `Clear All` (in the non-empty branch) and next to `↑ Import` (in the empty branch).

The button is a `<label>` wrapping a hidden `<input type="file" accept=".jhd" multiple>` — same pattern as the JSON import button. Its `change` handler calls `importJhdFiles(e.target.files)` then resets `e.target.value = ''`.

- [ ] **Step 1: Add `↑ JHD` to the empty-state branch of `renderSavedProfiles`**

Find this block (around line 237–247):
```js
  if (profiles.length === 0) {
    section.innerHTML = `
      <div class="card" style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <span style="color:var(--muted);font-size:0.88rem">No saved profiles</span>
        <label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">
          ↑ Import<input type="file" id="inp-import-file" accept=".json" style="display:none" />
        </label>
      </div>`
    section.querySelector('#inp-import-file').addEventListener('change', e => {
      const file = e.target.files[0]
      if (file) { importProfiles(file); e.target.value = '' }
    })
    return
  }
```

Replace it with:
```js
  if (profiles.length === 0) {
    section.innerHTML = `
      <div class="card" style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
        <span style="color:var(--muted);font-size:0.88rem">No saved profiles</span>
        <div style="display:flex;gap:0.4rem;align-items:center">
          <label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">
            ↑ Import<input type="file" id="inp-import-file" accept=".json" style="display:none" />
          </label>
          <label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">
            ↑ JHD<input type="file" id="inp-import-jhd" accept=".jhd" multiple style="display:none" />
          </label>
        </div>
      </div>`
    section.querySelector('#inp-import-file').addEventListener('change', e => {
      const file = e.target.files[0]
      if (file) { importProfiles(file); e.target.value = '' }
    })
    section.querySelector('#inp-import-jhd').addEventListener('change', e => {
      if (e.target.files.length) { importJhdFiles(e.target.files); e.target.value = '' }
    })
    return
  }
```

- [ ] **Step 2: Add `↑ JHD` to the non-empty-state branch**

Find this block (around line 256–258) inside the non-empty `section.innerHTML`:
```html
          <button type="button" id="btn-export-profiles" class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem">↓ Export</button>
          <label id="lbl-import-profiles" class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">↑ Import<input type="file" id="inp-import-file" accept=".json" style="display:none" /></label>
          <button type="button" id="btn-clear-all" class="btn-danger-sm">Clear All</button>
```

Replace it with:
```html
          <button type="button" id="btn-export-profiles" class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem">↓ Export</button>
          <label id="lbl-import-profiles" class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">↑ Import<input type="file" id="inp-import-file" accept=".json" style="display:none" /></label>
          <label class="btn-secondary" style="font-size:0.78rem;padding:0.25rem 0.65rem;cursor:pointer;margin:0">↑ JHD<input type="file" id="inp-import-jhd" accept=".jhd" multiple style="display:none" /></label>
          <button type="button" id="btn-clear-all" class="btn-danger-sm">Clear All</button>
```

- [ ] **Step 3: Add the `change` event listener for `#inp-import-jhd` in the non-empty branch**

Find the block where `#inp-import-file` event is wired in the non-empty branch (around line 294–298):
```js
  section.querySelector('#btn-export-profiles').addEventListener('click', exportProfiles)
  section.querySelector('#inp-import-file').addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) { importProfiles(file); e.target.value = '' }
  })
```

Add the JHD listener immediately after those two:
```js
  section.querySelector('#inp-import-jhd').addEventListener('change', e => {
    if (e.target.files.length) { importJhdFiles(e.target.files); e.target.value = '' }
  })
```

- [ ] **Step 4: Test in dev server**

```bash
npm run dev
```

Open `http://localhost:5173/hora-prakash/`. Go to the Input tab.

**Test A — empty profiles state:**
1. Clear all profiles (if any) via Clear All
2. Confirm `↑ JHD` button appears alongside `↑ Import`
3. Click `↑ JHD`, select `Chart A_Gahtori.jhd` from `/Users/priyankgahtori/Astrology/charts/`
4. Alert should say `Imported 1 profile.`
5. Profile `Chart A` appears in the select, with DOB `1990-07-26`, TOB `08:30`

**Test B — non-empty state:**
1. Confirm `↑ JHD` button appears in the button row
2. Click `↑ JHD`, select both `Chart A_Gahtori.jhd` and `Narendra_Modi.jhd`
3. Alert should say `Imported 1 profile.` (Chart A already exists → 1 dup, Modi is new)
4. Both profiles now in the select list

**Test C — re-import (all dups):**
1. Click `↑ JHD`, select both files again
2. Alert should say `All profiles already exist.`

**Test D — load profile:**
1. Select `Narendra Modi` from the dropdown
2. Click ▶ (load)
3. Chart should calculate with DOB 1950-09-17, TOB 09:34, location "Vadnagar, India"

- [ ] **Step 5: Commit**

```bash
git add src/tabs/input.js
git commit -m "feat: add ↑ JHD import button to saved profiles section"
```
