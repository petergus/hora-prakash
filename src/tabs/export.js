// src/tabs/export.js
import { state } from '../state.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { getSettings, buildCalcFlags } from '../core/settings.js'
import { getAspectedSigns } from '../core/aspects.js'
import { ensureChildren } from '../core/dasha.js'
import { getSwe } from '../core/swisseph.js'
import { getActiveSession } from '../sessions.js'
import { copyText } from '../utils/clipboard.js'

const APP_VERSION = '1.2.0'
const PRESETS_KEY = 'hora-prakash-export-presets'
const ACTIVE_KEY  = 'hora-prakash-export-active-preset'

// Optional planet fields. name/abbr/sign/degree/house/lon are always included.
const PLANET_FIELD_OPTIONS = [
  { key: 'nakshatra',     label: 'Nakshatra' },
  { key: 'nakshatraLord', label: 'Nakshatra Lord' },
  { key: 'pada',          label: 'Pada' },
  { key: 'retrograde',    label: 'Retrograde' },
  { key: 'combust',       label: 'Combust' },
]

export function defaultConfig() {
  const divisionals = {}
  for (const { value } of DIVISIONAL_OPTIONS) divisionals[value] = true
  return {
    sections: {
      meta: true, birth: true, lagna: true, houses: true,
      planets: true, aspects: true, divisionals: true,
      dasha: true, panchang: true, strength: true,
    },
    planetFields: { nakshatra: true, nakshatraLord: true, pada: true, retrograde: true, combust: true },
    divisionals,
    dashaDepth: 3,
    strengthDetail: 'full',
    decimals: 4,
  }
}

function litePreset() {
  const cfg = defaultConfig()
  cfg.sections.aspects = false
  cfg.sections.strength = false
  cfg.sections.panchang = false
  for (const k of Object.keys(cfg.divisionals)) cfg.divisionals[k] = false
  cfg.divisionals.D1 = true
  cfg.divisionals.D9 = true
  cfg.planetFields.nakshatraLord = false
  cfg.planetFields.pada = false
  cfg.dashaDepth = 1
  cfg.strengthDetail = 'none'
  cfg.decimals = 2
  return cfg
}

const BUILTIN_PRESETS = [
  { id: 'full', name: 'Full', builtin: true, config: defaultConfig() },
  { id: 'lite', name: 'Lite', builtin: true, config: litePreset() },
]

// Presets saved by older app versions may miss keys added since (new sections,
// new divisional charts, decimals). Missing decimals would make roundNum produce
// NaN → every number in the JSON serialized as null. Backfill from defaults.
export function normalizeConfig(raw) {
  const def = defaultConfig()
  const cfg = { ...def, ...(raw ?? {}) }
  cfg.sections     = { ...def.sections,     ...(raw?.sections     ?? {}) }
  cfg.planetFields = { ...def.planetFields, ...(raw?.planetFields ?? {}) }
  cfg.divisionals  = { ...def.divisionals,  ...(raw?.divisionals  ?? {}) }
  if (![1, 2, 3].includes(cfg.dashaDepth)) cfg.dashaDepth = def.dashaDepth
  if (!['none', 'totals', 'full'].includes(cfg.strengthDetail)) cfg.strengthDetail = def.strengthDetail
  if (!Number.isInteger(cfg.decimals) || cfg.decimals < 0 || cfg.decimals > 8) cfg.decimals = def.decimals
  return cfg
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    const user = raw ? JSON.parse(raw) : []
    return [...BUILTIN_PRESETS, ...user.map(p => ({ ...p, config: normalizeConfig(p.config) }))]
  } catch {
    return [...BUILTIN_PRESETS]
  }
}

function saveUserPresets(presets) {
  const user = presets.filter(p => !p.builtin)
  localStorage.setItem(PRESETS_KEY, JSON.stringify(user))
}

function loadActiveId() {
  return localStorage.getItem(ACTIVE_KEY) || 'full'
}
function saveActiveId(id) {
  localStorage.setItem(ACTIVE_KEY, id)
}

// ---------- payload filtering ----------

function roundNum(n, decimals) {
  if (typeof n !== 'number' || !isFinite(n)) return n
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

function deepRound(obj, decimals) {
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(v => deepRound(v, decimals))
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const k of Object.keys(obj)) out[k] = deepRound(obj[k], decimals)
    return out
  }
  return typeof obj === 'number' ? roundNum(obj, decimals) : obj
}

function filterPlanet(p, fields) {
  const base = {
    id: p.id, name: p.name, abbr: p.abbr,
    lon: p.lon, sign: p.sign, degree: p.degree, house: p.house,
  }
  for (const { key } of PLANET_FIELD_OPTIONS) {
    if (fields[key] && key in p) base[key] = p[key]
  }
  if (fields.nakshatra && 'nakshatraIndex' in p) base.nakshatraIndex = p.nakshatraIndex
  return base
}

function trimDasha(nodes, depth) {
  if (!Array.isArray(nodes) || depth <= 0) return []
  return nodes.map(n => {
    const out = { ...n }
    if (depth > 1 && Array.isArray(n.children)) {
      out.children = trimDasha(n.children, depth - 1)
    } else {
      delete out.children
    }
    return out
  })
}

// strength = { bhinna: {planet: number[12]}, sarva: number[12], shadbala: {planet: {…balas, total, required, ratio}} }
function filterStrength(strength, mode) {
  if (!strength || mode === 'none') return undefined
  if (mode === 'full') return strength
  // totals: keep BAV/SAV score arrays as-is; reduce shadbala to totals
  const out = { ...strength }
  if (strength.shadbala && typeof strength.shadbala === 'object') {
    out.shadbala = Object.fromEntries(
      Object.entries(strength.shadbala).map(([planet, row]) => [
        planet,
        { total: row.total, required: row.required, ratio: row.ratio },
      ])
    )
  }
  return out
}

// The dasha tree is built eagerly only 2 levels deep (maha → antar); pratyantar
// nodes are lazily computed on UI expansion. Exporting at depth 3 must compute
// the missing level first or antardashas serialize with empty children arrays.
async function expandDashaForExport(nodes, depth) {
  if (depth < 3 || !Array.isArray(nodes)) return
  let swe = null, flags = null
  try { swe = getSwe(); flags = buildCalcFlags(getSettings()) } catch { /* WASM not ready — linear fallback inside ensureChildren */ }
  for (const maha of nodes) {
    for (const antar of maha.children ?? []) {
      try { await ensureChildren(antar, swe, flags) } catch (e) { console.error('Dasha expansion failed for export:', e) }
    }
  }
}

export async function buildPayload(cfg) {
  const { planets, lagna, houses, dasha, panchang, strength, birth } = state
  const payload = {}

  if (cfg.sections.meta) {
    const s = getSettings()
    payload.meta = {
      generatedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      preset: cfg.__presetName || undefined,
      settings: {
        ayanamsa: s.ayanamsa,
        yearMethod: s.yearMethod,
        ...(s.yearMethod === 'custom' ? { customYearDays: s.customYearDays } : {}),
        planetPositions: s.planetPositions,
        observerType: s.observerType,
      },
    }
  }

  if (cfg.sections.birth) payload.birth = birth
  if (cfg.sections.lagna) payload.lagna = lagna
  if (cfg.sections.houses) payload.houses = houses

  const filteredPlanets = planets ? planets.map(p => filterPlanet(p, cfg.planetFields)) : null

  if (cfg.sections.planets) payload.planets = filteredPlanets

  if (cfg.sections.aspects && planets && lagna) {
    const aspects = {}
    for (const p of planets) {
      const signs = getAspectedSigns(p.sign, p.abbr)
      aspects[p.name] = {
        aspectedSigns: signs,
        aspectedHouses: signs.map(s => ((s - lagna.sign + 12) % 12) + 1),
      }
    }
    payload.aspects = aspects
  }

  if (cfg.sections.divisionals && planets && lagna) {
    // Match the Chart tab's Chalit house method (equal/placidus/sripati)
    const chalitOpts = {
      chalitMethod: getActiveSession()?.uiState?.chart?.chalitMethod ?? 'equal',
      houses: state.houses,
      sripatiHouses: state.sripatiHouses,
    }
    const divisionals = {}
    for (const { value } of DIVISIONAL_OPTIONS) {
      if (!cfg.divisionals[value]) continue
      const d = calcDivisional(planets, lagna, value, chalitOpts)
      const dLagnaSign = d.lagna.sign
      divisionals[value] = {
        lagna: d.lagna,
        planets: d.planets.map(p => {
          const divHouse = ((p.sign - dLagnaSign + 12) % 12) + 1
          return filterPlanet({ ...p, house: divHouse }, cfg.planetFields)
        }),
      }
    }
    payload.divisionals = divisionals
  }

  if (cfg.sections.dasha && dasha) {
    await expandDashaForExport(dasha, cfg.dashaDepth)
    payload.dasha = trimDasha(dasha, cfg.dashaDepth)
  }

  if (cfg.sections.panchang) payload.panchang = panchang
  if (cfg.sections.strength) {
    const f = filterStrength(strength, cfg.strengthDetail)
    if (f !== undefined) payload.strength = f
  }

  return deepRound(payload, cfg.decimals)
}

// Lightweight JSON syntax highlighter — escapes HTML first, then wraps tokens.
function highlight(json) {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(
    /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        return /:$/.test(match)
          ? `<span class="xj-key">${match}</span>`
          : `<span class="xj-str">${match}</span>`
      }
      if (/true|false/.test(match)) return `<span class="xj-bool">${match}</span>`
      if (match === 'null')         return `<span class="xj-null">${match}</span>`
      return `<span class="xj-num">${match}</span>`
    }
  )
}

// ---------- UI ----------

let presets = loadPresets()
let activeId = loadActiveId()
let workingConfig = null    // currently edited config (clone of preset's config)
let panelOpen = false
let dirty = false

function getActivePreset() {
  return presets.find(p => p.id === activeId) || presets[0]
}

function ensureWorking() {
  if (!workingConfig) workingConfig = structuredClone(getActivePreset().config)
}

function setActive(id) {
  activeId = id
  saveActiveId(id)
  workingConfig = structuredClone(getActivePreset().config)
  dirty = false
}

function renderPresetOptions() {
  return presets.map(p =>
    `<option value="${p.id}"${p.id === activeId ? ' selected' : ''}>${p.builtin ? '★ ' : ''}${escapeAttr(p.name)}</option>`
  ).join('')
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}

function checkbox(id, label, checked) {
  return `<label class="xp-chk"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}> <span>${label}</span></label>`
}

function renderPanel() {
  const cfg = workingConfig
  const divChecks = DIVISIONAL_OPTIONS.map(o =>
    checkbox(`xp-div-${o.value}`, o.label, cfg.divisionals[o.value])
  ).join('')

  const planetFieldChecks = PLANET_FIELD_OPTIONS.map(f =>
    checkbox(`xp-pf-${f.key}`, f.label, cfg.planetFields[f.key])
  ).join('')

  const sectionChecks = [
    ['meta','Meta / settings'], ['birth','Birth details'],
    ['lagna','Lagna'], ['houses','Houses'], ['planets','Planets'],
    ['aspects','Aspects'], ['divisionals','Divisional charts'],
    ['dasha','Dasha'], ['panchang','Panchang'], ['strength','Strength (Shadbala / Ashtakavarga)'],
  ].map(([k, l]) => checkbox(`xp-sec-${k}`, l, cfg.sections[k])).join('')

  return `
    <div class="xp-panel">
      <div class="xp-grid">
        <div class="xp-col">
          <h4>Sections</h4>
          ${sectionChecks}
        </div>
        <div class="xp-col">
          <h4>Planet fields <span class="xp-hint">(name, sign, degree, house always included)</span></h4>
          ${planetFieldChecks}
          <h4 style="margin-top:1rem;">Dasha depth</h4>
          <label class="xp-chk"><input type="radio" name="xp-dd" value="1"${cfg.dashaDepth===1?' checked':''}> <span>1 — Mahadasha only</span></label>
          <label class="xp-chk"><input type="radio" name="xp-dd" value="2"${cfg.dashaDepth===2?' checked':''}> <span>2 — + Antardasha</span></label>
          <label class="xp-chk"><input type="radio" name="xp-dd" value="3"${cfg.dashaDepth===3?' checked':''}> <span>3 — + Pratyantar</span></label>
          <h4 style="margin-top:1rem;">Strength detail</h4>
          <label class="xp-chk"><input type="radio" name="xp-sd" value="none"${cfg.strengthDetail==='none'?' checked':''}> <span>None</span></label>
          <label class="xp-chk"><input type="radio" name="xp-sd" value="totals"${cfg.strengthDetail==='totals'?' checked':''}> <span>Totals only</span></label>
          <label class="xp-chk"><input type="radio" name="xp-sd" value="full"${cfg.strengthDetail==='full'?' checked':''}> <span>Full (with components)</span></label>
          <h4 style="margin-top:1rem;">Decimal precision</h4>
          <label class="xp-chk"><input type="range" id="xp-dec" min="0" max="8" step="1" value="${cfg.decimals}"> <span id="xp-dec-val">${cfg.decimals}</span></label>
        </div>
        <div class="xp-col">
          <h4>Divisional charts <button class="xp-mini" id="xp-div-all">All</button><button class="xp-mini" id="xp-div-none">None</button></h4>
          <div class="xp-div-grid">${divChecks}</div>
        </div>
      </div>
    </div>
  `
}

function readPanel() {
  const cfg = workingConfig
  for (const k of Object.keys(cfg.sections)) {
    const el = document.getElementById(`xp-sec-${k}`)
    if (el) cfg.sections[k] = el.checked
  }
  for (const f of PLANET_FIELD_OPTIONS) {
    const el = document.getElementById(`xp-pf-${f.key}`)
    if (el) cfg.planetFields[f.key] = el.checked
  }
  for (const o of DIVISIONAL_OPTIONS) {
    const el = document.getElementById(`xp-div-${o.value}`)
    if (el) cfg.divisionals[o.value] = el.checked
  }
  const dd = document.querySelector('input[name="xp-dd"]:checked')
  if (dd) cfg.dashaDepth = parseInt(dd.value, 10)
  const sd = document.querySelector('input[name="xp-sd"]:checked')
  if (sd) cfg.strengthDetail = sd.value
  const dec = document.getElementById('xp-dec')
  if (dec) cfg.decimals = parseInt(dec.value, 10)
}

export async function renderExport() {
  const el = document.getElementById('tab-export')
  if (!el) return

  if (!state.planets) {
    el.innerHTML = '<p class="export-empty">Calculate a birth chart first.</p>'
    return
  }

  ensureWorking()
  const active = getActivePreset()
  const cfg = { ...workingConfig, __presetName: active.name + (dirty ? ' (modified)' : '') }
  const payload = await buildPayload(cfg)
  const jsonStr = JSON.stringify(payload, null, 2)
  const sizeKB  = (jsonStr.length / 1024).toFixed(1)
  const label   = state.birth?.name || 'Chart'
  const enabledDivs = Object.values(workingConfig.divisionals).filter(Boolean).length
  const filename = `${(state.birth?.name || 'chart').toLowerCase().replace(/\s+/g, '-')}-${state.birth?.dob || 'horoscope'}.json`

  el.innerHTML = `
    <div class="export-wrap">
      <div class="export-toolbar">
        <div class="export-preset-bar">
          <label class="xp-label">Preset:</label>
          <select id="xp-preset" class="xp-select">${renderPresetOptions()}</select>
          <button class="export-btn" id="xp-toggle">${panelOpen ? 'Hide options' : 'Customize'}</button>
          <button class="export-btn" id="xp-save"${active.builtin && !dirty ? ' disabled' : ''}>Save</button>
          <button class="export-btn" id="xp-saveas">Save as…</button>
          <button class="export-btn" id="xp-rename"${active.builtin ? ' disabled' : ''}>Rename</button>
          <button class="export-btn" id="xp-delete"${active.builtin ? ' disabled' : ''}>Delete</button>
        </div>
        <div class="export-actions">
          <button class="export-btn" id="xbtn-copy">Copy JSON</button>
          <button class="export-btn export-btn-primary" id="xbtn-download">Download .json</button>
        </div>
      </div>
      ${panelOpen ? renderPanel() : ''}
      <div class="export-meta-row">
        <span class="export-meta">${escapeAttr(label)} &mdash; ${sizeKB} KB &mdash; ${enabledDivs} divisional chart${enabledDivs===1?'':'s'} &mdash; preset: ${escapeAttr(active.name)}${dirty ? ' <em>(unsaved)</em>' : ''}</span>
      </div>
      <pre class="export-pre" id="export-pre"><code>${highlight(jsonStr)}</code></pre>
    </div>
  `

  wireEvents(jsonStr, filename)
}

function rerender() { renderExport().catch(console.error) }

function wireEvents(jsonStr, filename) {
  document.getElementById('xp-preset').addEventListener('change', (e) => {
    setActive(e.target.value)
    rerender()
  })

  document.getElementById('xp-toggle').addEventListener('click', () => {
    panelOpen = !panelOpen
    rerender()
  })

  document.getElementById('xp-save').addEventListener('click', () => {
    const active = getActivePreset()
    if (active.builtin) {
      // Save changes to a builtin → prompt for new name (save as)
      const name = prompt('Save modified built-in as new preset name:', active.name + ' (custom)')
      if (!name) return
      const id = 'p_' + Date.now()
      presets.push({ id, name, builtin: false, config: structuredClone(workingConfig) })
      saveUserPresets(presets)
      activeId = id
      saveActiveId(id)
      dirty = false
    } else {
      active.config = structuredClone(workingConfig)
      saveUserPresets(presets)
      dirty = false
    }
    rerender()
  })

  document.getElementById('xp-saveas').addEventListener('click', () => {
    const name = prompt('New preset name:')
    if (!name) return
    const id = 'p_' + Date.now()
    presets.push({ id, name, builtin: false, config: structuredClone(workingConfig) })
    saveUserPresets(presets)
    activeId = id
    saveActiveId(id)
    dirty = false
    rerender()
  })

  document.getElementById('xp-rename').addEventListener('click', () => {
    const active = getActivePreset()
    if (active.builtin) return
    const name = prompt('Rename preset:', active.name)
    if (!name) return
    active.name = name
    saveUserPresets(presets)
    rerender()
  })

  document.getElementById('xp-delete').addEventListener('click', () => {
    const active = getActivePreset()
    if (active.builtin) return
    if (!confirm(`Delete preset "${active.name}"?`)) return
    presets = presets.filter(p => p.id !== active.id)
    saveUserPresets(presets)
    activeId = 'full'
    saveActiveId(activeId)
    workingConfig = structuredClone(getActivePreset().config)
    dirty = false
    rerender()
  })

  if (panelOpen) {
    const panel = document.querySelector('.xp-panel')
    panel.addEventListener('change', () => {
      readPanel()
      dirty = true
      rerender()
    })
    panel.addEventListener('input', (e) => {
      if (e.target.id === 'xp-dec') {
        document.getElementById('xp-dec-val').textContent = e.target.value
      }
    })
    document.getElementById('xp-div-all').addEventListener('click', () => {
      for (const o of DIVISIONAL_OPTIONS) workingConfig.divisionals[o.value] = true
      dirty = true
      rerender()
    })
    document.getElementById('xp-div-none').addEventListener('click', () => {
      for (const o of DIVISIONAL_OPTIONS) workingConfig.divisionals[o.value] = false
      dirty = true
      rerender()
    })
  }

  document.getElementById('xbtn-copy').addEventListener('click', async () => {
    const btn = document.getElementById('xbtn-copy')
    if (await copyText(jsonStr)) {
      btn.textContent = 'Copied!'
      btn.classList.add('export-btn-ok')
    } else {
      // Last resort: select the <pre> so the user can hit Ctrl+C
      const pre = document.getElementById('export-pre')
      const range = document.createRange()
      range.selectNodeContents(pre)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      btn.textContent = 'Selected — Ctrl+C to copy'
    }
    setTimeout(() => {
      if (btn) { btn.textContent = 'Copy JSON'; btn.classList.remove('export-btn-ok') }
    }, 2500)
  })

  document.getElementById('xbtn-download').addEventListener('click', () => {
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  })
}
