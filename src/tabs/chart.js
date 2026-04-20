// src/tabs/chart.js
import { state } from '../state.js'
import { renderChartSVG, CHALIT_LABELS } from '../ui/chart-svg.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { PLANET_COLORS, getAspectedSigns } from '../core/aspects.js'
import { getActiveSession, defaultChartUI } from '../sessions.js'
import { fmtLat, fmtLon, ianaToOffset } from '../utils/format.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

function fmtDeg(dec) {
  const d = Math.floor(dec)
  const mTotal = (dec - d) * 60
  const m = Math.floor(mTotal)
  const s = Math.round((mTotal - m) * 60)
  return `${d}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"`
}

let privacyOn = false   // global UI pref, not per-session
let _dPlanets = null, _dLagna = null, _signLabels = null, _centerLabel = null

function c() {
  const s = getActiveSession()
  if (!s) return defaultChartUI()
  s.uiState ??= {}
  s.uiState.chart ??= defaultChartUI()
  return s.uiState.chart
}

const VIEW_DEFAULTS = { '1': ['D1'], '2': ['D1','D9'], '4': ['D1','D9','D3','D10'] }

const MASK = '••••••••'
const EYE_OPEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`
const EYE_SHUT = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`
const GEAR_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/></svg>`

function divLabel(key) {
  return DIVISIONAL_OPTIONS.find(o => o.value === key)?.label ?? key
}

function buildSingleChart(planets, lagna, key) {
  const { planets: dPlanets, lagna: dLagna } = calcDivisional(planets, lagna, key)
  const signLabels = key === 'Chalit' ? CHALIT_LABELS : undefined
  const label      = key === 'D1' ? 'Rashi\nChart' : divLabel(key).replace(' – ', '\n')
  return { dPlanets, dLagna, signLabels, label }
}

function buildPlanetTable(key, planets, lagna) {
  const { planets: dPlanets, lagna: dLagna } = calcDivisional(planets, lagna, key)
  const origByName = Object.fromEntries(planets.map(p => [p.name, p]))
  const isD1 = key === 'D1'
  const isChalit = key === 'Chalit'
  return `
    <div class="table-scroll"><table class="planet-table">
      <thead>
        <tr><th>Planet</th><th>Sign</th><th>Deg</th><th>D1 House</th><th>Nakshatra</th><th>Pada</th></tr>
      </thead>
      <tbody>
        ${dPlanets.map(p => {
          const signLabel = isChalit ? `H${p.sign}` : SIGN_NAMES[p.sign - 1]
          const orig = origByName[p.name]
          return `<tr>
            <td>${esc(p.name)}${p.retrograde ? ' <span style="color:#c00;font-size:0.8em">(R)</span>' : ''}${p.combust ? ' <span style="color:#b45309;font-size:0.8em">(C)</span>' : ''}</td>
            <td>${signLabel}</td>
            <td>${fmtDeg(p.degree)}</td>
            <td>${orig?.house ?? '—'}</td>
            <td>${orig?.nakshatra ?? '—'}</td>
            <td>${orig?.pada ?? '—'}</td>
          </tr>`
        }).join('')}
        <tr style="background:#fef3ff">
          <td><strong>Lagna</strong></td>
          <td>${isChalit ? 'H1' : SIGN_NAMES[dLagna.sign - 1]}</td>
          <td>${fmtDeg(dLagna.degree)}</td>
          <td>1</td>
          <td>${lagna.nakshatra}</td>
          <td>${lagna.pada}</td>
        </tr>
      </tbody>
    </table></div>`
}

function renderSVGOnly() {
  if (!_dPlanets) return
  const { chartStyle, activePlanets } = c()
  const activeAspects = _dPlanets
    .filter(p => activePlanets.has(p.abbr))
    .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
  const activePlanetColors = Object.fromEntries(
    _dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]])
  )
  document.getElementById('chart-container').innerHTML =
    renderChartSVG(_dPlanets, _dLagna, chartStyle, _signLabels, _centerLabel, activeAspects, activePlanetColors)
}

function divSelectHtml(id, selected) {
  return `<select id="${id}" class="div-select" style="font-size:0.78rem;padding:0.2rem 0.4rem">
    ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${o.value}</option>`).join('')}
  </select>`
}

function renderMultiTabNav(keys, activeIdx) {
  return `<div class="multi-tab-nav">
    ${keys.map((key, i) => `<button class="multi-tab-btn${activeIdx === i ? ' active' : ''}" data-tab="${i}">${key}</button>`).join('')}
  </div>`
}

export function renderChart() {
  const panel = document.getElementById('tab-chart')
  const { planets, lagna, birth } = state
  if (!planets || !lagna || !birth) return

  const ui = c()
  const { chartStyle, viewMode, divisional, multiDivs, activeMultiTab, tableDiv: _tableDiv,
          activePlanets, multiActivePlanets: _map } = ui
  // Ensure per-slot Sets exist (backward compat)
  const multiActivePlanets = _map ?? [new Set(), new Set(), new Set(), new Set()]
  if (!_map) ui.multiActivePlanets = multiActivePlanets

  const slots = viewMode === '1' ? 1 : viewMode === '2' ? 2 : 4
  const keys  = multiDivs.slice(0, slots)

  // Clamp tableDiv to one of the active slots (if not already)
  if (viewMode !== '1' && !keys.includes(_tableDiv)) ui.tableDiv = keys[0]
  const tableDiv = ui.tableDiv

  // Single view — maintain _dPlanets for aspect toggling
  if (viewMode === '1') {
    const { dPlanets, dLagna, signLabels, label } = buildSingleChart(planets, lagna, divisional)
    _dPlanets = dPlanets; _dLagna = dLagna; _signLabels = signLabels; _centerLabel = label
  }

  const heading = viewMode === '1'
    ? (divisional === 'D1' ? `${esc(birth.name)} — Birth Chart` : `${esc(birth.name)} — ${divLabel(divisional)}`)
    : `${esc(birth.name)} — Charts`

  const maskedName    = privacyOn ? MASK : heading
  const maskedDetails = privacyOn
    ? `${MASK} &nbsp;${MASK} &nbsp;·&nbsp; ${MASK}`
    : `${birth.dob} &nbsp;${birth.tob} &nbsp;·&nbsp; ${esc(birth.location) || fmtLat(birth.lat) + ' ' + fmtLon(birth.lon)} &nbsp;·&nbsp; ${ianaToOffset(birth.timezone)}`

  // Unified div select — works for both single (divisional) and multi (active slot)
  const activeSlotKey = viewMode === '1' ? divisional : (keys[ui.activeMultiTab] ?? keys[0])
  const divSelectHtmlUnified = `<select id="div-select" class="div-select" style="font-size:0.8rem;padding:0.25rem 0.5rem;min-width:0;max-width:170px">
    ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === activeSlotKey ? ' selected' : ''}>${o.label}</option>`).join('')}
  </select>`

  const CLEAR_ASPECTS_SVG = `<svg width="14" height="14" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8.5" cy="8.5" r="2" fill="currentColor" opacity="0.35"/>
    <g stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2.5 1.5" opacity="0.35">
      <line x1="8.5" y1="6.5" x2="8.5" y2="1"/><line x1="8.5" y1="10.5" x2="8.5" y2="16"/>
      <line x1="6.5" y1="8.5" x2="1" y2="8.5"/><line x1="10.5" y1="8.5" x2="16" y2="8.5"/>
    </g>
    <line x1="2" y1="2" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`

  const aspectBtns = `<button id="btn-hide-all" class="chart-style-btn chart-icon-btn" title="Clear aspects">${CLEAR_ASPECTS_SVG}</button>`

  // ── Chart area ──
  let chartArea = ''
  if (viewMode === '1') {
    chartArea = `<div id="chart-container">
      ${renderChartSVG(_dPlanets, _dLagna, chartStyle, _signLabels, _centerLabel,
        _dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] })),
        Object.fromEntries(_dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]]))
      )}
    </div>`
  } else {
    const activeKey = keys[ui.activeMultiTab] ?? keys[0]
    const { dPlanets: activeDP, dLagna: activeDL, signLabels: activeLabels, label: activeLabel } = buildSingleChart(planets, lagna, activeKey)
    _dPlanets = activeDP; _dLagna = activeDL; _signLabels = activeLabels; _centerLabel = activeLabel

    // Desktop: grid of charts with per-slot div selects + per-cell aspect clear
    const gridCells = keys.map((key, i) => {
      const { dPlanets, dLagna, signLabels, label } = buildSingleChart(planets, lagna, key)
      const slotSet = multiActivePlanets[i] ?? new Set()
      const aspects = dPlanets
        .filter(p => slotSet.has(p.abbr))
        .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
      const colors = Object.fromEntries(
        dPlanets.filter(p => slotSet.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]])
      )
      return `<div class="multi-chart-cell" data-slot="${i}">
        <div class="multi-chart-label">
          ${divSelectHtml('multi-div-' + i, key)}
          <button class="chart-style-btn chart-icon-btn multi-clear-aspects" data-slot="${i}" title="Clear aspects">${CLEAR_ASPECTS_SVG}</button>
        </div>
        ${renderChartSVG(dPlanets, dLagna, chartStyle, signLabels, label, aspects, colors)}
      </div>`
    }).join('')

    // Mobile: tab nav + active chart + active division's planet table
    const mobileDivKey = keys[ui.activeMultiTab] ?? keys[0]
    const mobileTable = buildPlanetTable(mobileDivKey, planets, lagna)

    // Desktop: planet table heading with gear icon + select for choosing which division
    const tableDivSelect = `<div class="multi-table-header">
      <h3 style="margin:0">Planetary Positions — ${divLabel(tableDiv)}</h3>
      <div class="multi-table-gear" id="multi-table-gear-wrapper">
        <button id="btn-table-gear" class="chart-style-btn" title="Change division" style="padding:0.3rem 0.5rem;margin:0">${GEAR_ICON}</button>
        <div id="multi-table-div-select" class="multi-table-gear-popover" style="display:none">
          ${keys.map(k => `<button class="gear-div-opt${k === tableDiv ? ' active' : ''}" data-div="${k}">${k} — ${divLabel(k)}</button>`).join('')}
        </div>
      </div>
    </div>`

    const activeAspects = activeDP
      .filter(p => activePlanets.has(p.abbr))
      .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
    const activePlanetColors = Object.fromEntries(
      activeDP.filter(p => activePlanets.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]])
    )

    chartArea = `
      ${renderMultiTabNav(keys, ui.activeMultiTab)}
      <div class="multi-chart-grid multi-chart-grid-${slots}">
        ${gridCells}
      </div>
      <div id="chart-container" class="multi-chart-mobile-view">
        ${renderChartSVG(activeDP, activeDL, chartStyle, activeLabels, activeLabel, activeAspects, activePlanetColors)}
      </div>
      <div class="multi-planet-desktop">
        ${tableDivSelect}
        ${buildPlanetTable(tableDiv, planets, lagna)}
      </div>
      <div class="multi-planet-mobile">
        <h3>Planetary Positions — ${divLabel(mobileDivKey)}</h3>
        ${mobileTable}
      </div>`
  }

  // ── Planet table (single view) ──
  const planetTable = viewMode === '1' ? `
    <h3>Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel(divisional) : ''}</h3>
    ${buildPlanetTable(divisional, planets, lagna)}` : ''

  panel.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem">
        <h2 style="margin:0">${maskedName}</h2>
        <button id="btn-privacy" title="${privacyOn ? 'Show details' : 'Hide details'}" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0.2rem;margin-top:0.1rem;border-radius:4px;line-height:1;display:flex;align-items:center" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">${privacyOn ? EYE_SHUT : EYE_OPEN}</button>
      </div>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${maskedDetails}</p>
      <div class="chart-controls">
        ${divSelectHtmlUnified}
        <div class="chart-style-group">
          <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North</button>
          <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South</button>
        </div>
        <div class="chart-style-group view-mode-group">
          <button id="btn-view-1" class="chart-style-btn${viewMode === '1' ? ' active' : ''}" title="Single chart">1</button>
          <button id="btn-view-2" class="chart-style-btn${viewMode === '2' ? ' active' : ''}" title="Two charts">2</button>
          <button id="btn-view-4" class="chart-style-btn${viewMode === '4' ? ' active' : ''}" title="Four charts">4</button>
        </div>
        ${aspectBtns}
      </div>
      ${chartArea}
      ${planetTable}
    </div>
  `

  // ── Events ──
  panel.querySelector('#btn-privacy').addEventListener('click', () => { privacyOn = !privacyOn; renderChart() })
  panel.querySelector('#btn-north').addEventListener('click', () => { c().chartStyle = 'north'; renderChart() })
  panel.querySelector('#btn-south').addEventListener('click', () => { c().chartStyle = 'south'; renderChart() })

  panel.querySelector('#btn-view-1').addEventListener('click', () => {
    const ui = c(); if (ui.viewMode === '1') return
    ui.viewMode = '1'; ui.activePlanets = new Set(); renderChart()
  })
  panel.querySelector('#btn-view-2').addEventListener('click', () => {
    const ui = c(); if (ui.viewMode === '2') return
    ui.viewMode = '2'
    const def = VIEW_DEFAULTS['2']
    ui.multiDivs = def.map((d, i) => ui.multiDivs[i] ?? d)
    ui.tableDiv = ui.multiDivs[0]; ui.activeMultiTab = 0; renderChart()
  })
  panel.querySelector('#btn-view-4').addEventListener('click', () => {
    const ui = c(); if (ui.viewMode === '4') return
    ui.viewMode = '4'
    const def = VIEW_DEFAULTS['4']
    ui.multiDivs = def.map((d, i) => ui.multiDivs[i] ?? d)
    ui.tableDiv = ui.multiDivs[0]; ui.activeMultiTab = 0; renderChart()
  })

  // Unified div-select: single view → divisional; multi view → active slot
  panel.querySelector('#div-select').addEventListener('change', e => {
    const ui = c()
    if (ui.viewMode === '1') {
      ui.divisional = e.target.value; ui.activePlanets = new Set()
    } else {
      const i = ui.activeMultiTab
      ui.multiDivs[i] = e.target.value
      if (i === 0) ui.tableDiv = e.target.value
    }
    renderChart()
  })

  // Clear aspects — single view or mobile multi: clears active slot
  panel.querySelector('#btn-hide-all').addEventListener('click', () => {
    const ui = c()
    if (ui.viewMode === '1') {
      ui.activePlanets = new Set()
    } else {
      ui.multiActivePlanets[ui.activeMultiTab] = new Set()
    }
    renderSVGOnly()
  })

  // Planet click — single view and mobile multi (chart-container)
  document.getElementById('chart-container')?.addEventListener('click', e => {
    const el = e.target.closest('[data-planet]')
    if (!el) return
    const ui = c()
    const ap = ui.viewMode === '1' ? ui.activePlanets : ui.multiActivePlanets[ui.activeMultiTab]
    const abbr = el.dataset.planet
    if (ap.has(abbr)) { ap.delete(abbr) } else { ap.add(abbr) }
    renderSVGOnly()
  })

  if (viewMode !== '1') {
    // Per-slot div selects (desktop grid)
    panel.querySelectorAll('[id^="multi-div-"]').forEach(sel => {
      sel.addEventListener('change', e => {
        const ui = c()
        const i = parseInt(e.target.id.replace('multi-div-', ''), 10)
        ui.multiDivs[i] = e.target.value
        if (keys[i] === ui.tableDiv || i === 0) ui.tableDiv = e.target.value
        renderChart()
      })
    })

    // Mobile tab nav
    panel.querySelectorAll('.multi-tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        c().activeMultiTab = parseInt(e.currentTarget.dataset.tab, 10)
        renderChart()
      })
    })

    // Desktop grid: planet click per cell → toggle that cell's aspects inline
    panel.querySelector('.multi-chart-grid')?.addEventListener('click', e => {
      const el = e.target.closest('[data-planet]')
      if (!el) return
      const cell = e.target.closest('.multi-chart-cell[data-slot]')
      if (!cell) return
      const ui   = c()
      const i    = parseInt(cell.dataset.slot, 10)
      const ap   = ui.multiActivePlanets[i] ?? (ui.multiActivePlanets[i] = new Set())
      const abbr = el.dataset.planet
      if (ap.has(abbr)) { ap.delete(abbr) } else { ap.add(abbr) }
      // Re-render just this cell's SVG
      const key  = ui.multiDivs[i]
      const { dPlanets, dLagna, signLabels, label } = buildSingleChart(planets, lagna, key)
      const aspects = dPlanets.filter(p => ap.has(p.abbr))
        .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
      const colors = Object.fromEntries(dPlanets.filter(p => ap.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]]))
      cell.querySelector('svg')?.replaceWith(
        (() => { const tmp = document.createElement('div'); tmp.innerHTML = renderChartSVG(dPlanets, dLagna, chartStyle, signLabels, label, aspects, colors); return tmp.firstElementChild })()
      )
    })

    // Desktop grid: clear aspects per cell
    panel.querySelectorAll('.multi-clear-aspects').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.slot, 10)
        c().multiActivePlanets[i] = new Set()
        renderChart()
      })
    })

    // Gear icon toggle
    const gearBtn = panel.querySelector('#btn-table-gear')
    const gearPopover = panel.querySelector('#multi-table-div-select')
    if (gearBtn && gearPopover) {
      gearBtn.addEventListener('click', e => {
        e.stopPropagation()
        gearPopover.style.display = gearPopover.style.display === 'none' ? 'flex' : 'none'
      })
      // Gear options
      panel.querySelectorAll('.gear-div-opt').forEach(btn => {
        btn.addEventListener('click', e => {
          c().tableDiv = e.currentTarget.dataset.div
          gearPopover.style.display = 'none'
          renderChart()
        })
      })
      // Close popover on outside click
      document.addEventListener('click', function closeGear(e) {
        if (!panel.querySelector('#multi-table-gear-wrapper')?.contains(e.target)) {
          gearPopover.style.display = 'none'
          document.removeEventListener('click', closeGear)
        }
      })
    }
  }
}
