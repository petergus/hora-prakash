# Chart Screen Redesign + Theme + White-Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernise the birth chart screen layout, add a ⋮ context menu to the Vimshottari dasha card, implement 5 named theme presets, and add a runtime white-label branding config.

**Architecture:** All changes are in-browser vanilla JS + CSS. Branding is loaded via `fetch('branding.json')` at app start. Themes are CSS custom-property overrides on the `[data-theme]` attribute of `<html>`. The planet table is extracted from inside `chartArea` to a standalone card below the split wrapper in all view modes. The dasha ⋮ popover replaces inline mode/year controls in both the Dasha tab and the chart embedded panel.

**Tech Stack:** Vanilla JS ES modules, CSS custom properties, Vite dev server (`npm run dev`), no test framework — verify each task manually in the browser at `http://localhost:5173/hora-prakash/`.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/style.css` | Modify | Add `[data-theme]` blocks; update `--radius`/`--shadow`; typography; card elevation; alignment fixes; ⋮ popover styles |
| `src/core/settings.js` | Modify | Add `theme: 'indigo'` to `DEFAULTS` |
| `src/ui/settings-modal.js` | Modify | Add Appearance section with 5 theme swatches |
| `public/branding.json` | Create | Default white-label config |
| `src/config/branding.js` | Create | Runtime branding loader |
| `src/main.js` | Modify | Call `loadBranding()` before `loadSettings()` |
| `index.html` | Modify | Add `<meta name="description">` and `<meta property="og:title">` |
| `src/tabs/chart.js` | Modify | Extract planet card; tidy controls bar template |
| `src/tabs/dasha.js` | Modify | Remove inline mode btn + year controls; add ⋮ popover in both `renderDasha` and `renderDashaCards` |

---

## Task 1: Theme CSS — 5 presets + card/typography polish

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Open `src/style.css`. Find the `:root` block (line 1). Replace it with the updated root + all 5 theme blocks:**

```css
:root {
  --bg: #f4f6fb;
  --surface: #ffffff;
  --border: #e2e8f0;
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --primary-text: #ffffff;
  --text: #1e293b;
  --muted: #64748b;
  --danger: #ef4444;
  --highlight: #fef9c3;
  --radius: 12px;
  --shadow: 0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05);
}
[data-theme="indigo"] {
  --primary: #4f46e5; --primary-hover: #4338ca; --highlight: #fef9c3;
}
[data-theme="saffron"] {
  --primary: #d97706; --primary-hover: #b45309; --highlight: #fef3c7;
}
[data-theme="forest"] {
  --primary: #059669; --primary-hover: #047857; --highlight: #d1fae5;
}
[data-theme="rose"] {
  --primary: #e11d48; --primary-hover: #be123c; --highlight: #ffe4e6;
}
[data-theme="midnight"] {
  --primary: #7c3aed; --primary-hover: #6d28d9; --highlight: #ede9fe;
}
```

- [ ] **Step 2: Find `.card {` in `style.css` (around line 172). Update it to use the CSS vars:**

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.25rem;
  margin-bottom: 1rem;
}
```

- [ ] **Step 3: Add the ⋮ popover styles. Find the `/* ── Dasha ──` section comment and add these new rules after `.dasha-mode-btn:hover:not(.focused-active) { ... }` block:**

```css
/* ── Dasha ⋮ options popover ── */
.dasha-options-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: var(--muted);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  line-height: 1;
  margin-left: auto;
}
.dasha-options-btn:hover { color: var(--text); background: var(--bg); }
.dasha-options-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  padding: 0.75rem 1rem;
  z-index: 200;
  min-width: 220px;
  display: none;
}
.dasha-options-popover.open { display: block; }
.dasha-options-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  font-size: 0.83rem;
  color: var(--muted);
}
.dasha-options-row:last-child { margin-bottom: 0; }
.dasha-options-row label { color: var(--text); font-size: 0.83rem; cursor: pointer; }
.dasha-options-row select,
.dasha-options-row input[type="number"] { font-size: 0.82rem; }
.dasha-mode-radios { display: flex; gap: 0.5rem; }
.dasha-mode-radios label { display: flex; align-items: center; gap: 0.25rem; }
.dasha-options-info {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.5rem;
  border-top: 1px solid var(--border);
  padding-top: 0.5rem;
}
```

- [ ] **Step 4: Add theme swatch styles. Find `/* ── Saved Profiles ──` section and add before it:**

```css
/* ── Theme swatches ── */
.theme-swatches { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.theme-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  outline: none;
}
.theme-swatch:hover { transform: scale(1.15); }
.theme-swatch.active { border-color: var(--text); }
```

- [ ] **Step 5: Start the dev server and open the app. Verify cards have slightly rounder corners and a softer shadow. No visual regressions.**

```bash
npm run dev
```

- [ ] **Step 6: Commit.**

```bash
git add src/style.css
git commit -m "feat: theme preset CSS vars + card/typography polish"
```

---

## Task 2: Add `theme` to settings

**Files:**
- Modify: `src/core/settings.js`

- [ ] **Step 1: Find the `DEFAULTS` object in `src/core/settings.js`. Add `theme: 'indigo'`:**

```js
const DEFAULTS = {
  ayanamsa:        1,
  yearMethod:      'sidereal',
  customYearDays:  365.25,
  planetPositions: 'apparent',
  observerType:    'geocentric',
  theme:           'indigo',
}
```

- [ ] **Step 2: At the bottom of `src/core/settings.js`, export the theme list so the modal can use it:**

```js
export const THEME_OPTIONS = [
  { label: 'Indigo',   value: 'indigo',   color: '#4f46e5' },
  { label: 'Saffron',  value: 'saffron',  color: '#d97706' },
  { label: 'Forest',   value: 'forest',   color: '#059669' },
  { label: 'Rose',     value: 'rose',     color: '#e11d48' },
  { label: 'Midnight', value: 'midnight', color: '#7c3aed' },
]
```

- [ ] **Step 3: Commit.**

```bash
git add src/core/settings.js
git commit -m "feat: add theme field to settings defaults"
```

---

## Task 3: Settings modal — Appearance section with theme swatches

**Files:**
- Modify: `src/ui/settings-modal.js`

- [ ] **Step 1: Add `THEME_OPTIONS` to the import at the top of `src/ui/settings-modal.js`:**

```js
import {
  getSettings, saveSettings, applyAyanamsa,
  AYANAMSA_OPTIONS, PLANET_POSITION_OPTIONS, OBSERVER_TYPE_OPTIONS, THEME_OPTIONS,
} from '../core/settings.js'
```

- [ ] **Step 2: Find the `overlay.innerHTML = \`` line. Add an Appearance section as the first section inside the modal `<div>`, before the Ayanamsa group:**

Replace the inner modal content opening from:
```html
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Ayanamsa</label>
```

with:
```html
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.5rem;font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Theme</label>
        <div class="theme-swatches" id="theme-swatches">
          ${THEME_OPTIONS.map(t => `<button class="theme-swatch" data-theme="${t.value}" title="${t.label}" style="background:${t.color}" aria-label="${t.label}"></button>`).join('')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Ayanamsa</label>
```

- [ ] **Step 3: In the `gearBtn.addEventListener('click', ...)` handler, after populating the select values, activate the correct theme swatch. Find:**

```js
    overlay.style.display = 'flex'
    document.getElementById('settings-ayanamsa').value         = String(s.ayanamsa)
```

Add after `overlay.style.display = 'flex'`:
```js
    overlay.style.display = 'flex'
    const currentTheme = s.theme || 'indigo'
    overlay.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.theme === currentTheme)
    })
    document.getElementById('settings-ayanamsa').value         = String(s.ayanamsa)
```

- [ ] **Step 4: Wire up swatch clicks. Find `document.getElementById('settings-apply').addEventListener('click', async () => {` and add this block just before it:**

```js
  overlay.querySelectorAll('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const theme = sw.dataset.theme
      overlay.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === theme))
      document.documentElement.dataset.theme = theme
      saveSettings({ theme })
    })
  })
```

- [ ] **Step 5: In the settings-apply click handler, after `saveSettings({ ayanamsa, planetPositions, observerType })`, also save the currently active swatch's theme. Replace:**

```js
    saveSettings({ ayanamsa, planetPositions, observerType })
```

with:
```js
    const activeThemeSwatch = overlay.querySelector('.theme-swatch.active')
    const theme = activeThemeSwatch?.dataset.theme || 'indigo'
    saveSettings({ ayanamsa, planetPositions, observerType, theme })
    document.documentElement.dataset.theme = theme
```

- [ ] **Step 6: Apply saved theme on settings load. Open `src/main.js`. Find `loadSettings()` and add theme application after it:**

```js
  loadSettings()
  const { getSettings } = await import('./core/settings.js')
  document.documentElement.dataset.theme = getSettings().theme || 'indigo'
```

Wait — `loadSettings` is synchronous and already imported. Instead, add this line right after the `loadSettings()` call in `main()`:

```js
  loadSettings()
  document.documentElement.dataset.theme = (JSON.parse(localStorage.getItem('hora-prakash-settings') || '{}').theme) || 'indigo'
```

- [ ] **Step 7: Verify in browser — open settings modal, click each swatch, confirm accent colour changes immediately across buttons, active states, etc.**

- [ ] **Step 8: Commit.**

```bash
git add src/ui/settings-modal.js src/main.js
git commit -m "feat: theme swatches in settings modal, apply on load"
```

---

## Task 4: White-label branding config

**Files:**
- Create: `public/branding.json`
- Create: `src/config/branding.js`
- Modify: `src/main.js`
- Modify: `index.html`

- [ ] **Step 1: Create `public/branding.json`:**

```json
{
  "appName": "Hora Prakash",
  "appTagline": "Vedic Astrology",
  "logoUrl": "",
  "faviconUrl": "",
  "theme": "indigo",
  "footerText": ""
}
```

- [ ] **Step 2: Create `src/config/branding.js`:**

```js
// src/config/branding.js
// Reads public/branding.json at runtime and applies name, logo, favicon, theme.
// Called once in main.js before loadSettings() so theme from branding.json is
// the fallback when the user has no saved theme preference.

export async function loadBranding() {
  let json = {}
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}branding.json`)
    if (res.ok) json = await res.json()
  } catch (_) {}

  // App name
  const appName = json.appName || 'Hora Prakash'
  document.title = appName

  const h1 = document.querySelector('header h1')
  if (h1) {
    const img = h1.querySelector('img')
    // Replace text node (preserves the img element)
    const textNode = [...h1.childNodes].find(n => n.nodeType === Node.TEXT_NODE)
    if (textNode) textNode.textContent = appName
    else h1.append(document.createTextNode(appName))

    // Logo swap
    if (img && json.logoUrl) img.src = json.logoUrl
  }

  // Favicon
  if (json.faviconUrl) {
    const link = document.querySelector('link[rel="icon"]')
    if (link) link.href = json.faviconUrl
  }

  // Theme — only apply if the user has no saved preference
  const savedTheme = (() => {
    try { return JSON.parse(localStorage.getItem('hora-prakash-settings') || '{}').theme } catch { return null }
  })()
  if (!savedTheme && json.theme) {
    document.documentElement.dataset.theme = json.theme
  }

  // Meta tags
  if (json.appTagline) {
    const desc = document.querySelector('meta[name="description"]')
    if (desc) desc.setAttribute('content', json.appTagline)
  }

  // Footer
  if (json.footerText) {
    const footer = document.createElement('footer')
    footer.className = 'app-footer'
    footer.style.cssText = 'text-align:center;padding:1rem;font-size:0.78rem;color:var(--muted);margin-top:1rem'
    footer.textContent = json.footerText
    document.body.appendChild(footer)
  }
}
```

- [ ] **Step 3: Update `src/main.js`. Add `loadBranding` import and call it first:**

```js
// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa } from './core/settings.js'
import { initSettingsModal } from './ui/settings-modal.js'
import { createSession, switchSession } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'
import { loadBranding } from './config/branding.js'

// Register SW early so it intercepts the 12MB ephemeris fetch.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
}

async function main() {
  await loadBranding()    // sets title, logo, favicon, branding-default theme
  loadSettings()
  document.documentElement.dataset.theme =
    (JSON.parse(localStorage.getItem('hora-prakash-settings') || '{}').theme) || 'indigo'

  document.getElementById('app-loader')?.remove()
  document.getElementById('tab-input').style.display = ''

  initTabs()
  initSettingsModal()

  const id = createSession()
  switchSession(id)
  renderProfileTabs()
  renderInputTab()

  initSwissEph().then(() => applyAyanamsa()).catch(console.error)
}

main()
```

- [ ] **Step 4: Update `index.html` — add meta tags. After `<title>Hora Prakash</title>` add:**

```html
  <meta name="description" content="Vedic Astrology" />
  <meta property="og:title" content="Hora Prakash" />
```

- [ ] **Step 5: Start dev server, verify app name in `<title>` bar, logo still shows, no console errors. Change `appName` in `public/branding.json` to "Test App", reload — confirm title updates.**

- [ ] **Step 6: Revert `branding.json` `appName` back to `"Hora Prakash"`. Commit.**

```bash
git add public/branding.json src/config/branding.js src/main.js index.html
git commit -m "feat: runtime white-label branding via public/branding.json"
```

---

## Task 5: Chart screen — extract planet table to separate card

**Files:**
- Modify: `src/tabs/chart.js`

- [ ] **Step 1: In `src/tabs/chart.js`, find the `chartArea` assignment for view modes 2/4 (the `else` block starting around line 200). Locate the two divs at the end of the template literal:**

```js
      <div class="multi-planet-desktop">
        ${tableDivSelect}
        ${buildPlanetTable(tableDiv, planets, lagna)}
      </div>
      <div class="multi-planet-mobile">
        <h3>Planetary Positions — ${divLabel(mobileDivKey)}</h3>
        ${mobileTable}
      </div>`
```

Remove both of those divs from `chartArea`. The `chartArea` assignment should end with:

```js
    chartArea = `
      ${renderMultiTabNav(keys, ui.activeMultiTab)}
      <div class="multi-chart-grid multi-chart-grid-${slots}${slots === 2 && showDasha ? ' multi-chart-grid-2--dasha' : ''}">
        ${gridCells}
      </div>
      <div id="chart-container" class="multi-chart-mobile-view">
        ${renderChartSVG(activeDP, activeDL, chartStyle, activeLabels, activeLabel, activeAspects, activePlanetColors)}
      </div>`
```

- [ ] **Step 2: Find where `planetTable` is built (around line 256):**

```js
  const planetTable = viewMode === '1' ? `
    <h3>Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel(divisional) : ''}</h3>
    ${buildPlanetTable(divisional, planets, lagna)}` : ''
```

Replace with a unified planet card string that covers all view modes:

```js
  const planetCardInner = viewMode === '1'
    ? `<h3 class="section-label">Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel(divisional) : ''}</h3>
       ${buildPlanetTable(divisional, planets, lagna)}`
    : `${tableDivSelect}
       ${buildPlanetTable(tableDiv, planets, lagna)}`

  const planetCard = `<div class="card planet-positions-card">${planetCardInner}</div>`
```

Note: `tableDivSelect` is already built inside the `else` block for view modes 2/4 (around line 219). You need to move its definition **above** the `if (viewMode === '1')` block so it is in scope for both branches. Find:

```js
    // Desktop: planet table heading with gear icon + select for choosing which division
    const tableDivSelect = `<div class="multi-table-header">
```

Move that entire `tableDivSelect` const declaration out of the `else` block to the shared scope, guarded:

```js
  const tableDivSelect = viewMode !== '1' ? `<div class="multi-table-header">
    <h3 class="section-label">Planetary Positions — ${divLabel(tableDiv)}</h3>
    <div class="multi-table-gear" id="multi-table-gear-wrapper">
      <button id="btn-table-gear" class="chart-style-btn" title="Change division" style="padding:0.3rem 0.5rem;margin:0">${GEAR_ICON}</button>
      <div id="multi-table-div-select" class="multi-table-gear-popover" style="display:none">
        ${keys.map(k => `<button class="gear-div-opt${k === tableDiv ? ' active' : ''}" data-div="${k}">${k} — ${divLabel(k)}</button>`).join('')}
      </div>
    </div>
  </div>` : ''
```

- [ ] **Step 3: In `panel.innerHTML`, replace the old planet card at the bottom:**

Old:
```js
  ${planetTable ? `<div class="card planet-positions-card" style="margin-top:1rem">${planetTable}</div>` : ''}
```

New:
```js
  ${planetCard}
```

- [ ] **Step 4: Add `section-label` typography to `src/style.css`. After the `.card { ... }` block add:**

```css
.section-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 0.75rem 0;
  font-weight: 600;
}
```

- [ ] **Step 5: Verify in browser — switch between 1/2/4 view modes. Planet table should always appear as a separate card below the chart, with the gear select visible in 2/4 modes.**

- [ ] **Step 6: Commit.**

```bash
git add src/tabs/chart.js src/style.css
git commit -m "feat: planet positions as separate card in all view modes (1/2/4)"
```

---

## Task 6: Chart screen — controls bar CSS + split alignment

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Fix split pane top alignment. Find `.chart-pane` and `.dasha-pane` rules in `style.css` and ensure both have `align-self: start; padding-top: 0;`. Search for `.chart-pane` and `.dasha-pane`. If they exist update them; if not add:**

```css
.chart-pane  { align-self: start; min-width: 0; }
.dasha-pane  { align-self: start; min-width: 0; overflow-y: auto; }
```

- [ ] **Step 2: Make the birth details line in the chart card match the new typography spec. In `src/tabs/chart.js` find the `<p>` tag for `maskedDetails` and update the inline style:**

Find:
```js
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${maskedDetails}</p>
```

Replace with:
```js
      <p style="color:var(--muted);font-size:0.8rem;margin-top:0.15rem;margin-bottom:1rem;line-height:1.5">${maskedDetails}</p>
```

And find the `<h2>` for `maskedName`:
```js
        <h2 style="margin:0">${maskedName}</h2>
```
Replace with:
```js
        <h2 style="margin:0;font-size:1.1rem;font-weight:600">${maskedName}</h2>
```

- [ ] **Step 3: Verify in browser — open Birth Chart tab, confirm the name is `1.1rem bold`, details line is `0.8rem muted`, chart pane and dasha pane tops are flush when dasha is open.**

- [ ] **Step 4: Commit.**

```bash
git add src/style.css src/tabs/chart.js
git commit -m "fix: chart/dasha pane alignment + typography hierarchy"
```

---

## Task 7: Vimshottari ⋮ menu — Dasha tab (`renderDasha`)

**Files:**
- Modify: `src/tabs/dasha.js`

- [ ] **Step 1: Create a helper function `renderDashaOptionsPopover` in `src/tabs/dasha.js`. Add it just before `renderYearMethodControls`:**

```js
function renderDashaOptionsPopover(ui, id = 'dasha') {
  const { yearMethod, customYearDays, ayanamsa } = getSettings()
  const focused = ui.focusedMode ?? true
  const ayanamsaName = AYANAMSA_OPTIONS.find(a => a.value === ayanamsa)?.label ?? 'Lahiri'
  let ayanamsaVal = ''
  try {
    const { dob, tob, timezone } = state.birth ?? {}
    if (dob && tob && timezone) {
      const jd  = toJulianDay(dob, tob, timezone)
      const raw = getSwe().get_ayanamsa_ut(jd)
      const deg = Math.floor(raw)
      const min = Math.floor((raw - deg) * 60)
      const sec = ((raw - deg) * 60 - min) * 60
      ayanamsaVal = ` (${deg}°${min}'${sec.toFixed(0)}")`
    }
  } catch (_) {}

  const yearOptions = YEAR_METHOD_OPTIONS.map(o =>
    `<option value="${o.value}"${o.value === yearMethod ? ' selected' : ''}>${o.label}</option>`
  ).join('')

  return `
    <div class="dasha-options-popover" id="${id}-options-popover">
      <div class="dasha-options-row">
        <span>Mode:</span>
        <div class="dasha-mode-radios">
          <label><input type="radio" name="${id}-mode" value="focused" ${focused ? 'checked' : ''}> Focused</label>
          <label><input type="radio" name="${id}-mode" value="full"    ${!focused ? 'checked' : ''}> Full</label>
        </div>
      </div>
      <div class="dasha-options-row">
        <span>Year:</span>
        <select id="${id}-year-method">${yearOptions}</select>
      </div>
      ${yearMethod === 'custom' ? `
      <div class="dasha-options-row">
        <span>Days/yr:</span>
        <input id="${id}-custom-days" type="number" min="300" max="400" step="0.001" value="${customYearDays}" style="width:6rem">
      </div>` : ''}
      <div class="dasha-options-info">Ayanamsa: <strong>${ayanamsaName}</strong>${ayanamsaVal} · TZ: ${state.birth?.timezone ?? 'UTC'}</div>
    </div>`
}
```

- [ ] **Step 2: In `renderDasha()`, find the `prog-card-title` div inside the `dasha-section` card:**

```js
          <div class="prog-card-title">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
            <h3>Vimshottari Dasha — ${birth.name}</h3>
            <button id="dasha-mode-btn" class="dasha-mode-btn${(ui.focusedMode ?? true) ? ' focused-active' : ''}">${(ui.focusedMode ?? true) ? 'Focused' : 'Full'}</button>
          </div>
```

Replace with (remove `dasha-mode-btn`, add ⋮ button + popover wrapper):

```js
          <div class="prog-card-title" style="position:relative">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
            <h3>Vimshottari Dasha — ${birth.name}</h3>
            <button id="dasha-options-btn" class="dasha-options-btn" title="Options">⋮</button>
            ${renderDashaOptionsPopover(ui, 'dasha')}
          </div>
```

- [ ] **Step 3: In `renderDasha()`, find the `dasha-body` div. Remove the `renderYearMethodControls()` call:**

Find:
```js
        <div id="dasha-body" style="display:${ui.dashaCollapsed ? 'none' : ''}">
          ${renderYearMethodControls()}
          <div id="dasha-breadcrumb-wrap">
```

Replace with:
```js
        <div id="dasha-body" style="display:${ui.dashaCollapsed ? 'none' : ''}">
          <div id="dasha-breadcrumb-wrap">
```

- [ ] **Step 4: In `panel.onclick`, find the `dasha-mode-btn` handler block:**

```js
    if (e.target.id === 'dasha-mode-btn') {
      const wasFocused = ui.focusedMode ?? true
      ui.focusedMode = !wasFocused
      if (ui.focusedMode) {
        ui.focusedPath = inferFocusedPath(dasha, ui)
      }
      e.target.textContent = ui.focusedMode ? 'Focused' : 'Full'
      e.target.classList.toggle('focused-active', ui.focusedMode)
      buildDashaRows(dasha, ui).then(rows => {
```

Replace the `dasha-mode-btn` click with a new `dasha-options-btn` popover toggle, and add radio/select handlers. Replace the whole block with:

```js
    if (e.target.id === 'dasha-options-btn') {
      const popover = document.getElementById('dasha-options-popover')
      if (popover) popover.classList.toggle('open')
      return
    }
    // Mode radio inside popover
    if (e.target.name === 'dasha-mode') {
      ui.focusedMode = e.target.value === 'focused'
      if (ui.focusedMode) ui.focusedPath = inferFocusedPath(dasha, ui)
      buildDashaRows(dasha, ui).then(rows => {
        document.querySelector('.dasha-table tbody').innerHTML = rows
        document.getElementById('dasha-breadcrumb-wrap').innerHTML =
          ui.focusedMode && ui.focusedPath?.length > 0 ? renderBreadcrumb(dasha, ui) : ''
      }).catch(console.error)
      return
    }
```

- [ ] **Step 5: In `panel.onchange`, find the `dasha-year-method` handler and update the id to match the new popover select id `dasha-year-method` (id is unchanged — same). Also add a handler for `dasha-custom-days` (id unchanged). These should still work as-is since the IDs are the same. Verify no changes needed.**

- [ ] **Step 6: Wire up outside-click close for the popover. At the end of `renderDasha()` event wiring (after `panel.onclick`, `panel.onchange`, `panel.oninput` are all set), add:**

```js
  document.addEventListener('mousedown', function closeDashaPopover(e) {
    const popover = document.getElementById('dasha-options-popover')
    const btn     = document.getElementById('dasha-options-btn')
    if (popover && !popover.contains(e.target) && e.target !== btn) {
      popover.classList.remove('open')
    }
  }, { once: false })
```

Note: attach this listener inside `renderDasha()` body after HTML is injected. To avoid accumulating listeners on re-renders, use a named function and re-assign: store it on the panel element:

```js
  if (panel._closeDashaPopover) document.removeEventListener('mousedown', panel._closeDashaPopover)
  panel._closeDashaPopover = e => {
    const popover = document.getElementById('dasha-options-popover')
    const btn     = document.getElementById('dasha-options-btn')
    if (popover && !popover.contains(e.target) && e.target !== btn) {
      popover.classList.remove('open')
    }
  }
  document.addEventListener('mousedown', panel._closeDashaPopover)
```

- [ ] **Step 7: Verify in browser — open Dasha tab, click ⋮ button, popover appears with Mode radios and Year dropdown showing all 5 options. Switch mode, confirm table updates. Change year method, confirm recalc. Click outside, popover closes.**

- [ ] **Step 8: Commit.**

```bash
git add src/tabs/dasha.js
git commit -m "feat: Vimshottari dasha ⋮ menu (Dasha tab) — mode + year method popover"
```

---

## Task 8: Vimshottari ⋮ menu — chart embedded panel (`renderDashaCards`)

**Files:**
- Modify: `src/tabs/dasha.js`

- [ ] **Step 1: In `renderDashaCards()`, find the `html` assembly. Replace:**

```js
  let html = renderYearMethodControls()
  if (cards.includes('vimshottari')) {
    const rows = await buildDashaRows(dasha, ui)
    html += `
      <div class="card" id="dasha-panel-vimshottari">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
          <button id="dasha-panel-mode-btn" class="dasha-mode-btn${(ui.focusedMode ?? true) ? ' focused-active' : ''}">${(ui.focusedMode ?? true) ? 'Focused' : 'Full'}</button>
          <h3 style="margin:0;font-size:0.95rem">Vimshottari Dasha</h3>
        </div>
        <div id="dasha-panel-breadcrumb-wrap">${(ui.focusedMode ?? true) && (ui.focusedPath?.length > 0) ? renderBreadcrumb(dasha, ui) : ''}</div>
        <div class="table-scroll"><table class="dasha-table">
          <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`
  }
```

With:

```js
  let html = ''
  if (cards.includes('vimshottari')) {
    const rows = await buildDashaRows(dasha, ui)
    html += `
      <div class="card" id="dasha-panel-vimshottari">
        <div style="display:flex;align-items:center;position:relative;margin-bottom:0.75rem">
          <h3 class="section-label" style="margin:0;flex:1">Vimshottari Dasha</h3>
          <button id="dasha-panel-options-btn" class="dasha-options-btn" title="Options">⋮</button>
          ${renderDashaOptionsPopover(ui, 'dasha-panel')}
        </div>
        <div id="dasha-panel-breadcrumb-wrap">${(ui.focusedMode ?? true) && (ui.focusedPath?.length > 0) ? renderBreadcrumb(dasha, ui) : ''}</div>
        <div class="table-scroll"><table class="dasha-table">
          <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`
  }
```

- [ ] **Step 2: Remove the `dasha-panel-mode-btn` wiring block in `renderDashaCards`. Find and remove:**

```js
    const modBtn = container.querySelector('#dasha-panel-mode-btn')
    if (modBtn) {
      modBtn.addEventListener('click', () => {
        const wasFocused = ui.focusedMode ?? true
        ui.focusedMode = !wasFocused
        if (ui.focusedMode) ui.focusedPath = inferFocusedPath(dasha, ui)
        modBtn.textContent = ui.focusedMode ? 'Focused' : 'Full'
        modBtn.classList.toggle('focused-active', ui.focusedMode)
        buildDashaRows(dasha, ui).then(rows => {
          container.querySelector('.dasha-table tbody').innerHTML = rows
          container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
            (ui.focusedMode && (ui.focusedPath?.length > 0)) ? renderBreadcrumb(dasha, ui) : ''
        }).catch(console.error)
      })
    }
```

- [ ] **Step 3: Add ⋮ popover wiring in `renderDashaCards`. After `container.innerHTML = html` and inside the `if (cards.includes('vimshottari'))` block, add:**

```js
    // ⋮ popover toggle
    const optBtn = container.querySelector('#dasha-panel-options-btn')
    const popover = container.querySelector('#dasha-panel-options-popover')
    if (optBtn && popover) {
      optBtn.addEventListener('click', () => popover.classList.toggle('open'))
      document.addEventListener('mousedown', function closePanelPopover(e) {
        if (!popover.contains(e.target) && e.target !== optBtn) popover.classList.remove('open')
      })
    }

    // Mode radio
    container.querySelector('#dasha-panel-vimshottari')?.addEventListener('change', e => {
      if (e.target.name === 'dasha-panel-mode') {
        const ui = chartD()
        ui.focusedMode = e.target.value === 'focused'
        if (ui.focusedMode) ui.focusedPath = inferFocusedPath(dasha, ui)
        buildDashaRows(state.dasha, ui).then(rows => {
          container.querySelector('.dasha-table tbody').innerHTML = rows
          container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
            ui.focusedMode && ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
        }).catch(console.error)
      }
      if (e.target.id === 'dasha-panel-year-method') {
        const yearMethod = e.target.value
        saveSettings({ yearMethod })
        if (yearMethod !== 'custom') renderDashaCards(container, cards).catch(console.error)
      }
      if (e.target.id === 'dasha-panel-custom-days') {
        clearTimeout(_customDaysTimer)
        _customDaysTimer = setTimeout(() => {
          const v = parseFloat(e.target.value)
          if (v >= 300 && v <= 400) { saveSettings({ customYearDays: v }); renderDashaCards(container, cards).catch(console.error) }
        }, 600)
      }
    })
```

- [ ] **Step 4: In `container.onchange` (already wired in `renderDashaCards`), remove the `dasha-year-method` and `dasha-custom-days` handlers since they are now handled by the delegated listener above. Find and remove from `container.onchange`:**

```js
    } else if (e.target.id === 'dasha-year-method') {
      const yearMethod = e.target.value
      saveSettings({ yearMethod })
      if (yearMethod !== 'custom') renderDashaCards(container, cards).catch(console.error)
    } else if (e.target.id === 'dasha-custom-days') {
      clearTimeout(_customDaysTimer)
      _customDaysTimer = setTimeout(() => {
        const v = parseFloat(e.target.value)
        if (v >= 300 && v <= 400) { saveSettings({ customYearDays: v }); renderDashaCards(container, cards).catch(console.error) }
      }, 600)
    }
```

- [ ] **Step 5: Verify in browser — go to Birth Chart tab, enable Dasha panel. Click ⋮ in the embedded Vimshottari card. Popover shows Mode radios and Year dropdown with all 5 options. Change mode/year, table updates correctly.**

- [ ] **Step 6: Commit.**

```bash
git add src/tabs/dasha.js
git commit -m "feat: Vimshottari dasha ⋮ menu (chart panel) — mode + year method popover"
```

---

## Task 9: Final push

- [ ] **Step 1: Full smoke test — load app, verify:**
  - Theme swatches work in settings modal; selected theme persists on reload
  - `branding.json` appName appears in page title
  - Planet table is a separate card in all 3 view modes
  - Chart and dasha pane tops are flush when dasha is open
  - ⋮ menu works on both Dasha tab and chart embedded panel
  - All 5 year methods present in ⋮ popover (including True Solar Return)
  - No console errors

- [ ] **Step 2: Push to remote.**

```bash
git push
```
