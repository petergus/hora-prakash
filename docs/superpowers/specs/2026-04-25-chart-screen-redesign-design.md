# Chart Screen Redesign + Theme + White-Label — Design Spec
**Date:** 2026-04-25
**Status:** Approved

---

## 1. Scope

Four independent deliverables, implemented together:

1. **Chart screen layout** — planet table as separate card in all view modes; controls bar reorganisation; split-pane alignment fix; modern card/typography polish
2. **Vimshottari ⋮ menu** — Focused/Full toggle and year method moved into a context popover
3. **Theme presets** — 5 named colour themes selectable in settings, applied via CSS vars
4. **White-label branding** — `public/branding.json` read at runtime; no rebuild required

---

## 2. Chart Screen Layout

### 2.1 Controls Bar

Two logical rows inside the existing `.card`:

**Row 1 — Identity**
```
[ App Name / Birth Name ]                    [ 👁 privacy ]
[ dob · tob · location · tz ]  (muted, 0.8rem)
```

**Row 2 — Controls**
```
[ Div select ] [ N | S ] [ 1 | 2 | 4 ] [ aspects ] | [ Dasha ] [ 40/50/60 ]
```
- Vertical separator `|` (`.ctrl-sep`) visually groups chart controls from dasha controls
- On mobile the row wraps naturally; separator is hidden on wrap via `flex-wrap: wrap`

### 2.2 Planet Positions Card

- Extracted to its own `<div class="card planet-positions-card">` **below** the split wrapper in **all** view modes (1, 2, 4)
- In view modes 2 and 4: card header contains `<h3>Planetary Positions</h3>` + a gear/select to choose which divisional chart's data to display (renders from `keys` array)
- In view mode 1: unchanged label, no gear needed (only one chart active)
- The `multi-planet-desktop` and `multi-planet-mobile` divs inside `chartArea` are **removed**; planet table always lives in the external card

### 2.3 Split Pane Alignment Fix

**Root cause:** the dasha pane had breadcrumb + mode controls rendered above the dasha card content, adding variable height and misaligning the top edge of the two panes.

**Fix:**
- Both `chart-pane` and `dasha-pane` use `align-self: start` with `padding-top: 0`
- The ⋮ menu (Section 3) absorbs the mode/year controls, so nothing sits above the dasha card header
- Breadcrumb moves **inside** the dasha card body, below the card header — not outside the pane

### 2.4 Visual Polish

**Cards:**
```css
border-radius: 12px;
box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05);
padding: 1.25rem;
```

**Typography hierarchy:**
- Birth name / screen title: `font-size: 1.1rem; font-weight: 600`
- Details line: `font-size: 0.8rem; color: var(--muted)`
- Section headings (Planetary Positions, etc.): `font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted)`
- Body / table: unchanged

---

## 3. Vimshottari ⋮ Menu

### 3.1 Trigger

A `⋮` button (`btn-dasha-options`) in the top-right of the Vimshottari dasha card header. Works on desktop (click) and mobile (tap). No long-press required.

### 3.2 Popover Content

```
Mode:        ● Focused   ○ Full
Year method: [ dropdown — all YEAR_METHOD_OPTIONS ]
             [ custom days input — shown only when Custom selected ]
```

- Popover is `position: absolute; right: 0; top: 100%` anchored to the ⋮ button
- Closes on outside click (`mousedown` on document) or `Escape` key
- `z-index: 200` to clear table rows and chart SVG

### 3.3 What Moves Out

The following are **removed** from the dasha card inline body:
- `#dasha-year-controls` div (year method select + custom input)
- `dasha-panel-mode-btn` / `dasha-mode-btn` (Focused/Full toggle button)

Breadcrumb (`#dasha-breadcrumb-wrap`) stays visible inline in the card body — it is navigation state, not a setting.

### 3.4 Scope

Applies to **both** the standalone Dasha tab and the embedded dasha panel in the chart split view (`renderDashaCards`). Both call `buildDashaRows` and share the same `ui` state object, so the popover reads/writes the same fields.

---

## 4. Theme Presets

### 4.1 CSS Structure

Five `[data-theme]` attribute blocks on `:root` in `style.css`. Each overrides only colour-bearing vars:

```css
:root { /* indigo — default */ }
[data-theme="indigo"]   { --primary: #4f46e5; --primary-hover: #4338ca; --highlight: #fef9c3; }
[data-theme="saffron"]  { --primary: #d97706; --primary-hover: #b45309; --highlight: #fef3c7; }
[data-theme="forest"]   { --primary: #059669; --primary-hover: #047857; --highlight: #d1fae5; }
[data-theme="rose"]     { --primary: #e11d48; --primary-hover: #be123c; --highlight: #ffe4e6; }
[data-theme="midnight"] { --primary: #7c3aed; --primary-hover: #6d28d9; --highlight: #ede9fe; }
```

`--primary-text` stays `#ffffff` for all themes.

### 4.2 Application

- `src/config/branding.js` sets `document.documentElement.dataset.theme` on load (from `branding.json` default)
- Settings modal "Appearance" section shows 5 clickable colour-dot swatches (16px circles, `background: <primary color>`, border when active)
- Selecting a swatch: calls `document.documentElement.dataset.theme = value` immediately (no reload), saves `{ theme: value }` to localStorage via `saveSettings`
- On `loadSettings`, if `theme` is present in localStorage it overrides `branding.json` default

### 4.3 Settings Integration

New section in `settings-modal.js` above existing Ayanamsa section:

```
── Appearance ──────────────────
Theme:  ⬤ ⬤ ⬤ ⬤ ⬤   (5 swatches, labelled on hover)
```

---

## 5. White-Label / Branding Config

### 5.1 File

`public/branding.json` — static JSON, fetched at runtime, not processed by Vite:

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

All fields optional with sensible fallbacks.

### 5.2 Loader — `src/config/branding.js`

```js
export async function loadBranding() {
  const json = await fetch(`${import.meta.env.BASE_URL}branding.json`)
    .then(r => r.json()).catch(() => ({}))
  // appName
  document.title = json.appName || 'Hora Prakash'
  document.querySelector('header h1')?....   // replace text node, preserve logo img
  // logoUrl
  const logoImg = document.querySelector('header h1 img')
  if (json.logoUrl && logoImg) logoImg.src = json.logoUrl
  // faviconUrl
  if (json.faviconUrl) {
    document.querySelector('link[rel="icon"]').href = json.faviconUrl
  }
  // theme (branding default — localStorage overrides in loadSettings)
  if (json.theme && !localStorage.getItem('hora-prakash-settings')?.includes('"theme"')) {
    document.documentElement.dataset.theme = json.theme
  }
  // footerText
  if (json.footerText) {
    const footer = document.createElement('footer')
    footer.className = 'app-footer'
    footer.textContent = json.footerText
    document.body.appendChild(footer)
  }
  // meta tags
  document.querySelector('meta[name="description"]')?.setAttribute('content', json.appTagline || '')
}
```

Called in `main.js` as the **first** thing before `loadSettings()`.

### 5.3 index.html additions

```html
<meta name="description" content="Vedic Astrology" />
<meta property="og:title" content="Hora Prakash" />
```
(`og:title` is static; description is overwritten by `loadBranding` at runtime.)

### 5.4 Deployer Workflow

1. Fork repo
2. Edit `public/branding.json`
3. Push → GitHub Actions builds and deploys
4. No JS changes needed

---

## 6. Files Changed

| File | Change |
|---|---|
| `public/branding.json` | **New** — default config |
| `src/config/branding.js` | **New** — runtime loader |
| `src/main.js` | Call `loadBranding()` first |
| `src/core/settings.js` | Add `theme` to `DEFAULTS`; persist/read theme |
| `src/ui/settings-modal.js` | Add Appearance section with theme swatches |
| `src/tabs/chart.js` | Layout refactor: planet card extraction, controls bar, alignment |
| `src/tabs/dasha.js` | ⋮ menu: remove inline controls, add popover |
| `src/style.css` | Theme vars, card polish, typography, alignment fixes |
| `index.html` | Add meta tags |

---

## 7. Out of Scope

- Dark mode (separate effort — requires inverting all background/text vars)
- Per-user theme persistence beyond localStorage
- Admin panel or server-side branding
- Changing chart SVG colour palettes per theme (charts use fixed planet colours)
