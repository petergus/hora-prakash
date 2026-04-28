// src/tabs/chart.js
import { state } from '../state.js'
import { renderChartSVG, CHALIT_LABELS } from '../ui/chart-svg.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { PLANET_COLORS, getAspectedSigns } from '../core/aspects.js'
import { getActiveSession, defaultChartUI, defaultDashaUI } from '../sessions.js'
import { DashaPanel } from '../components/dasha-panel.js'
import { fmtLat, fmtLon, ianaToOffset } from '../utils/format.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

// Parashari exaltation/debilitation signs (1-based)
const EXALT_SIGN  = { Sun:1, Moon:2, Mars:10, Mercury:6, Jupiter:4, Venus:12, Saturn:7 }
const DEBIL_SIGN  = { Sun:7, Moon:8, Mars:4,  Mercury:12, Jupiter:10, Venus:6,  Saturn:1 }

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
let _splitDragRatio = null
let _chartDashaPanel = null

function getChartDashaState() {
  const s = getActiveSession()
  if (!s) return defaultDashaUI()
  s.uiState ??= {}
  s.uiState.chart ??= defaultChartUI()
  s.uiState.chart.chartDasha ??= defaultDashaUI()
  return s.uiState.chart.chartDasha
}

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
          const isExalt = isD1 && EXALT_SIGN[p.name] === p.sign
          const isDebil = isD1 && DEBIL_SIGN[p.name] === p.sign
          const rowCls = isExalt ? ' class="row-exalt"' : isDebil ? ' class="row-debil"' : ''
          const badges = [
            p.retrograde ? '<span class="planet-chip chip-retro">R</span>' : '',
            p.combust    ? '<span class="planet-chip chip-combust">C</span>' : '',
            isExalt      ? '<span class="planet-chip chip-exalt">Exalt</span>' : '',
            isDebil      ? '<span class="planet-chip chip-debil">Debil</span>' : '',
          ].join('')
          return `<tr${rowCls}>
            <td><span class="planet-name-cell">${esc(p.name)}${badges}</span></td>
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
  const { chartStyle, activePlanets, fromHouseSign } = c()
  const planets = fromHouseSign ? _dPlanets : _dPlanets
  const lagna   = fromHouseSign ? { ..._dLagna, sign: fromHouseSign } : _dLagna
  const activeAspects = _dPlanets
    .filter(p => activePlanets.has(p.abbr))
    .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
  const activePlanetColors = Object.fromEntries(
    _dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]])
  )
  document.getElementById('chart-container').innerHTML =
    renderChartSVG(planets, lagna, chartStyle, _signLabels, _centerLabel, activeAspects, activePlanetColors)

  // Show/hide the "from house" reset chip
  const chip = document.getElementById('from-house-chip')
  if (chip) chip.style.display = fromHouseSign ? 'inline-flex' : 'none'
}

function divSelectHtml(id, selected) {
  return `<select id="${id}" class="div-select" style="font-size:0.78rem;padding:0.2rem 0.4rem">
    ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${o.value}</option>`).join('')}
  </select>`
}

function renderMultiTabNav(keys, activeIdx) {
  return `<div class="multi-tab-nav" data-count="${keys.length}">
    ${keys.map((key, i) => `<button class="multi-tab-btn${activeIdx === i ? ' active' : ''}" data-tab="${i}">${key}</button>`).join('')}
  </div>`
}

export function renderChart() {
  const panel = document.getElementById('tab-chart')
  const { planets, lagna, birth } = state
  if (!planets || !lagna || !birth) return
  if (_chartDashaPanel) { _chartDashaPanel.destroy(); _chartDashaPanel = null }

  const ui = c()
  const { chartStyle, viewMode, divisional, multiDivs, activeMultiTab, tableDiv: _tableDiv,
          activePlanets, multiActivePlanets: _map } = ui
  // Ensure per-slot Sets exist (backward compat)
  const multiActivePlanets = _map ?? [new Set(), new Set(), new Set(), new Set()]
  if (!_map) ui.multiActivePlanets = multiActivePlanets

  const slots = viewMode === '1' ? 1 : viewMode === '2' ? 2 : 4
  const keys  = multiDivs.slice(0, slots)
  const showDasha = ui.showDasha && viewMode !== '4'

  // Clamp tableDiv to one of the active slots (if not already)
  if (viewMode !== '1' && !keys.includes(_tableDiv)) ui.tableDiv = keys[0]
  const tableDiv = ui.tableDiv

  // Single view — maintain _dPlanets for aspect toggling
  if (viewMode === '1') {
    const { dPlanets, dLagna, signLabels, label } = buildSingleChart(planets, lagna, divisional)
    _dPlanets = dPlanets; _dLagna = dLagna; _signLabels = signLabels; _centerLabel = label
  }

  const heading = viewMode === '1'
    ? (divisional === 'D1' ? 'Birth Chart' : divLabel(divisional))
    : 'Birth Charts'

  const maskedName    = privacyOn ? MASK : heading
  const maskedDetails = privacyOn
    ? `${MASK} &nbsp;${MASK} &nbsp;·&nbsp; ${MASK}`
    : `${birth.dob} &nbsp;${birth.tob} &nbsp;·&nbsp; ${esc(birth.location) || fmtLat(birth.lat) + ' ' + fmtLon(birth.lon)} &nbsp;·&nbsp; ${ianaToOffset(birth.timezone)}`

  // Unified div select — works for both single (divisional) and multi (active slot)
  const activeSlotKey = viewMode === '1' ? divisional : (keys[ui.activeMultiTab] ?? keys[0])
  const divSelectHtmlUnified = `<select id="div-select" class="div-select" style="font-size:0.8rem;padding:0.25rem 0.5rem;min-width:0;max-width:170px">
    ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === activeSlotKey ? ' selected' : ''}>${o.label}</option>`).join('')}
  </select>`

  const SHOW_SVG = `<svg width="14" height="14" viewBox="0 0 17 17" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8.5" cy="8.5" r="2"/>
    <g stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2.5 1.5">
      <line x1="8.5" y1="6.5" x2="8.5" y2="1"/><line x1="8.5" y1="10.5" x2="8.5" y2="16"/>
      <line x1="6.5" y1="8.5" x2="1" y2="8.5"/><line x1="10.5" y1="8.5" x2="16" y2="8.5"/>
      <line x1="7.1" y1="7.1" x2="2.5" y2="2.5"/><line x1="9.9" y1="9.9" x2="14.5" y2="14.5"/>
      <line x1="9.9" y1="7.1" x2="14.5" y2="2.5"/><line x1="7.1" y1="9.9" x2="2.5" y2="14.5"/>
    </g>
  </svg>`
  const CLEAR_SVG = `<svg width="14" height="14" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8.5" cy="8.5" r="2" fill="currentColor" opacity="0.35"/>
    <g stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2.5 1.5" opacity="0.35">
      <line x1="8.5" y1="6.5" x2="8.5" y2="1"/><line x1="8.5" y1="10.5" x2="8.5" y2="16"/>
      <line x1="6.5" y1="8.5" x2="1" y2="8.5"/><line x1="10.5" y1="8.5" x2="16" y2="8.5"/>
    </g>
    <line x1="2" y1="2" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`

  // aspect buttons: always in DOM; hidden on desktop when multi-chart via CSS
  const aspectBtns = `<div class="chart-style-group aspect-btns${viewMode !== '1' ? ' aspect-btns--multi' : ''}">
    <button id="btn-show-all" class="chart-style-btn chart-icon-btn" title="Show all aspects">${SHOW_SVG}</button>
    <button id="btn-hide-all" class="chart-style-btn chart-icon-btn" title="Clear aspects">${CLEAR_SVG}</button>
  </div>`

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

    // Desktop: plain grid — no aspects (aspects only in single view on desktop)
    const gridCells = keys.map((key, i) => {
      const { dPlanets, dLagna, signLabels, label } = buildSingleChart(planets, lagna, key)
      return `<div class="multi-chart-cell">
        <div class="multi-chart-label">${divSelectHtml('multi-div-' + i, key)}</div>
        ${renderChartSVG(dPlanets, dLagna, chartStyle, signLabels, label, [], {})}
      </div>`
    }).join('')

    const mobileAP = multiActivePlanets[ui.activeMultiTab] ?? new Set()
    const activeAspects = activeDP
      .filter(p => mobileAP.has(p.abbr))
      .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
    const activePlanetColors = Object.fromEntries(
      activeDP.filter(p => mobileAP.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]])
    )

    chartArea = `
      ${renderMultiTabNav(keys, ui.activeMultiTab)}
      <div class="multi-chart-grid multi-chart-grid-${slots}${slots === 2 && showDasha ? ' multi-chart-grid-2--dasha' : ''}">
        ${gridCells}
      </div>
      <div id="chart-container" class="multi-chart-mobile-view">
        ${renderChartSVG(activeDP, activeDL, chartStyle, activeLabels, activeLabel, activeAspects, activePlanetColors)}
      </div>`
  }

  // ── Planet table ──
  const tableDivSelect = viewMode !== '1' ? `<div class="multi-table-header">
    <h3 class="section-label">Planetary Positions — ${divLabel(tableDiv)}</h3>
    <div class="multi-table-gear" id="multi-table-gear-wrapper">
      <button id="btn-table-gear" class="chart-style-btn" title="Change division" style="padding:0.3rem 0.5rem;margin:0">${GEAR_ICON}</button>
      <div id="multi-table-div-select" class="multi-table-gear-popover" style="display:none">
        ${keys.map(k => `<button class="gear-div-opt${k === tableDiv ? ' active' : ''}" data-div="${k}">${k} — ${divLabel(k)}</button>`).join('')}
      </div>
    </div>
  </div>` : ''

  const planetCardInner = viewMode === '1'
    ? `<h3 class="section-label">Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel(divisional) : ''}</h3>
       ${buildPlanetTable(divisional, planets, lagna)}`
    : `${tableDivSelect}
       ${buildPlanetTable(tableDiv, planets, lagna)}`

  const planetCard = `<div class="card planet-positions-card">${planetCardInner}</div>`

  const splitRatio = ui.splitRatio ?? 0.55
  const gridCols = `${splitRatio}fr 6px ${1 - splitRatio}fr`

  panel.classList.toggle('has-dasha', showDasha)

  panel.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem">
        <h2 style="margin:0;font-size:1.1rem;font-weight:600">${maskedName}</h2>
        <button id="btn-privacy" title="${privacyOn ? 'Show details' : 'Hide details'}" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0.2rem;margin-top:0.1rem;border-radius:4px;line-height:1;display:flex;align-items:center" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">${privacyOn ? EYE_SHUT : EYE_OPEN}</button>
      </div>
      <p style="color:var(--muted);font-size:0.8rem;margin-top:0.15rem;margin-bottom:1rem;line-height:1.5">${maskedDetails}</p>
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
        <span id="from-house-chip" style="display:${ui.fromHouseSign ? 'inline-flex' : 'none'};align-items:center;gap:0.3rem;background:var(--accent,#6366f1);color:#fff;font-size:0.72rem;padding:0.2rem 0.5rem;border-radius:999px;cursor:pointer" title="Reset to natal lagna">H${ui.fromHouseSign ? ((ui.fromHouseSign - (state.lagna?.sign ?? 1) + 12) % 12) + 1 : ''} view &times;</span>
        ${viewMode !== '4' ? `
          <span class="ctrl-sep"></span>
          <div class="dasha-toggle-btn" id="dasha-toggle-wrapper" style="position:relative">
            <button id="btn-dasha-toggle" class="chart-style-btn${showDasha ? ' active' : ''}" title="Show Dasha panel">Dasha</button>
            <div id="dasha-card-popover" class="dasha-card-popover" style="display:none">
              <label><input type="checkbox" id="dasha-card-vimshottari" value="vimshottari" ${ui.dashaCards.includes('vimshottari') ? 'checked' : ''}> Vimshottari</label>
              <label><input type="checkbox" id="dasha-card-age" value="age" ${ui.dashaCards.includes('age') ? 'checked' : ''}> Age Progression</label>
              <label><input type="checkbox" id="dasha-card-progression" value="progression" ${ui.dashaCards.includes('progression') ? 'checked' : ''}> Dasha Progression</label>
            </div>
          </div>
          ${showDasha ? `
            <div class="split-preset-group">
              <button class="split-preset-btn${Math.abs((ui.splitRatio ?? 0.55) - 0.40) < 0.02 ? ' active' : ''}" data-ratio="0.4">40/60</button>
              <button class="split-preset-btn${Math.abs((ui.splitRatio ?? 0.55) - 0.50) < 0.02 ? ' active' : ''}" data-ratio="0.5">50/50</button>
              <button class="split-preset-btn${Math.abs((ui.splitRatio ?? 0.55) - 0.60) < 0.02 ? ' active' : ''}" data-ratio="0.6">60/40</button>
            </div>` : ''}
        ` : ''}
      </div>
      ${showDasha ? `
        <div class="chart-dasha-tabs" id="chart-dasha-tabs">
          <button class="chart-dasha-tab-btn${ui.mobileDashaTab !== 'dasha' ? ' active' : ''}" data-panel="chart">Chart</button>
          <button class="chart-dasha-tab-btn${ui.mobileDashaTab === 'dasha' ? ' active' : ''}" data-panel="dasha">Dasha</button>
        </div>` : ''}
      <div class="chart-split-wrapper" id="chart-split-wrapper"${showDasha ? ` style="grid-template-columns:${gridCols}"` : ''}>
        <div class="chart-pane" id="chart-pane" data-mobile-panel="chart">
          ${chartArea}
        </div>
        ${showDasha ? `<div class="split-handle" id="split-handle"></div><div class="dasha-pane" id="dasha-pane" data-mobile-panel="dasha"></div>` : ''}
      </div>
    </div>
  ${planetCard}
  `

  if (showDasha) {
    const dashaPane = panel.querySelector('#dasha-pane')
    if (dashaPane && state.dasha && state.birth) {
      if (_chartDashaPanel) _chartDashaPanel.destroy()
      _chartDashaPanel = new DashaPanel(dashaPane, getChartDashaState)
      _chartDashaPanel.render(state.dasha, state.birth, { cards: ui.dashaCards }).catch(console.error)
    }
  }

  const handle = panel.querySelector('#split-handle')
  const wrapper = panel.querySelector('#chart-split-wrapper')
  if (handle && wrapper) {
    const SNAP_POINTS = [0.40, 0.50, 0.60]
    const SNAP_THRESHOLD = 0.03

    handle.addEventListener('mousedown', e => {
      e.preventDefault()
      handle.classList.add('dragging')

      function onMove(ev) {
        const rect = wrapper.getBoundingClientRect()
        let ratio = (ev.clientX - rect.left) / rect.width
        ratio = Math.max(0.2, Math.min(0.8, ratio))
        wrapper.style.gridTemplateColumns = `${ratio}fr 6px ${1 - ratio}fr`
        _splitDragRatio = ratio
      }

      function onUp() {
        handle.classList.remove('dragging')
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        let ratio = _splitDragRatio ?? c().splitRatio
        _splitDragRatio = null
        const snap = SNAP_POINTS.find(s => Math.abs(ratio - s) <= SNAP_THRESHOLD)
        if (snap !== undefined) ratio = snap
        ratio = Math.round(ratio * 1000) / 1000
        c().splitRatio = ratio
        wrapper.style.gridTemplateColumns = `${ratio}fr 6px ${1 - ratio}fr`
        panel.querySelectorAll('.split-preset-btn').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.ratio) === ratio))
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  // Dasha toggle button
  const dashaToggleBtn = panel.querySelector('#btn-dasha-toggle')
  const dashaPopover   = panel.querySelector('#dasha-card-popover')
  const dashaWrapper   = panel.querySelector('#dasha-toggle-wrapper')

  if (dashaToggleBtn) {
    dashaToggleBtn.addEventListener('click', e => {
      e.stopPropagation()
      c().showDasha = !c().showDasha
      renderChart()
    })
  }

  if (dashaPopover && dashaWrapper) {
    dashaWrapper.addEventListener('contextmenu', e => {
      e.preventDefault()
      const opening = dashaPopover.style.display === 'none'
      dashaPopover.style.display = opening ? 'flex' : 'none'
      if (opening) {
        document.addEventListener('click', function closePop(ev) {
          if (!dashaWrapper?.contains(ev.target)) {
            if (dashaPopover) dashaPopover.style.display = 'none'
            document.removeEventListener('click', closePop)
          }
        })
      }
    })

    dashaPopover.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', e => {
        e.stopPropagation()
        const ui3 = c()
        const val = e.target.value
        if (e.target.checked) {
          if (!ui3.dashaCards.includes(val)) ui3.dashaCards = [...ui3.dashaCards, val]
        } else {
          const next = ui3.dashaCards.filter(v => v !== val)
          if (next.length === 0) { e.target.checked = true; return }
          ui3.dashaCards = next
        }
        const dashaPane = panel.querySelector('#dasha-pane')
        if (dashaPane && state.dasha && state.birth) {
          if (_chartDashaPanel) _chartDashaPanel.destroy()
          _chartDashaPanel = new DashaPanel(dashaPane, getChartDashaState)
          _chartDashaPanel.render(state.dasha, state.birth, { cards: ui3.dashaCards }).catch(console.error)
        }
      })
    })
  }

  // Split preset buttons
  panel.querySelectorAll('.split-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ratio = parseFloat(btn.dataset.ratio)
      c().splitRatio = ratio
      const w = panel.querySelector('#chart-split-wrapper')
      if (w) w.style.gridTemplateColumns = `${ratio}fr 6px ${1 - ratio}fr`
      panel.querySelectorAll('.split-preset-btn').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.ratio) === ratio))
    })
  })

  function applyMobilePanelVisibility() {
    const isMobile = window.innerWidth <= 600
    if (!isMobile || !c().showDasha) return
    const active = c().mobileDashaTab ?? 'chart'
    panel.querySelectorAll('[data-mobile-panel]').forEach(el => {
      el.style.display = el.dataset.mobilePanel === active ? '' : 'none'
    })
  }
  applyMobilePanelVisibility()

  // Mobile pill tabs
  panel.querySelectorAll('.chart-dasha-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      c().mobileDashaTab = btn.dataset.panel
      panel.querySelectorAll('.chart-dasha-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === btn.dataset.panel))
      applyMobilePanelVisibility()
    })
  })

  // Swipe gesture for chart/dasha split panel (mobile) — same hard-swipe rules as tab nav
  const splitWrapper = panel.querySelector('#chart-split-wrapper')
  if (splitWrapper && showDasha) {
    let touchStartX = 0, touchStartY = 0, touchStartTime = 0, swipeCancelled = false

    function insideHorizScrollable(el) {
      while (el && el !== splitWrapper) {
        if (el.scrollWidth > el.clientWidth + 4) return true
        el = el.parentElement
      }
      return false
    }

    splitWrapper.addEventListener('touchstart', e => {
      e.stopPropagation()
      const t = e.changedTouches[0]
      touchStartX    = t.clientX
      touchStartY    = t.clientY
      touchStartTime = Date.now()
      swipeCancelled = insideHorizScrollable(e.target)
    }, { passive: true })

    splitWrapper.addEventListener('touchmove', e => {
      if (swipeCancelled) return
      const t  = e.changedTouches[0]
      const dx = Math.abs(t.clientX - touchStartX)
      const dy = Math.abs(t.clientY - touchStartY)
      if (dy > 10 && dy > dx) swipeCancelled = true
    }, { passive: true })

    splitWrapper.addEventListener('touchend', e => {
      e.stopPropagation()
      if (swipeCancelled) return
      const t   = e.changedTouches[0]
      const dx  = t.clientX - touchStartX
      const adx = Math.abs(dx)
      const ady = Math.abs(t.clientY - touchStartY)
      const ms  = Date.now() - touchStartTime
      if (adx < 80 || ady > adx * 0.4 || ms > 400) return
      const current = c().mobileDashaTab ?? 'chart'
      const next = dx < 0 ? 'dasha' : 'chart'
      if (next === current) return
      c().mobileDashaTab = next
      panel.querySelectorAll('.chart-dasha-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === next))
      applyMobilePanelVisibility()
    }, { passive: true })
  }

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

  // Aspect helpers — for single view use activePlanets; mobile multi uses multiActivePlanets[activeTab]
  function getActiveAP() {
    const ui = c()
    return ui.viewMode === '1' ? ui.activePlanets : (ui.multiActivePlanets[ui.activeMultiTab] ?? new Set())
  }
  function setActiveAP(set) {
    const ui = c()
    if (ui.viewMode === '1') ui.activePlanets = set
    else ui.multiActivePlanets[ui.activeMultiTab] = set
  }

  panel.querySelector('#btn-show-all').addEventListener('click', () => {
    if (_dPlanets) _dPlanets.forEach(p => getActiveAP().add(p.abbr))
    renderSVGOnly()
  })
  panel.querySelector('#btn-hide-all').addEventListener('click', () => {
    setActiveAP(new Set()); renderSVGOnly()
  })

  // Planet click — single view only
  document.getElementById('chart-container')?.addEventListener('click', e => {
    if (c().viewMode !== '1') return
    const el = e.target.closest('[data-planet]')
    if (!el) return
    const ap = getActiveAP()
    const abbr = el.dataset.planet
    if (ap.has(abbr)) { ap.delete(abbr) } else { ap.add(abbr) }
    renderSVGOnly()
  })

  // Right-click context menu on chart cells
  document.getElementById('chart-container')?.addEventListener('contextmenu', e => {
    if (c().viewMode !== '1') return
    const cell = e.target.closest('[data-sign]')
    if (!cell) return
    e.preventDefault()
    document.getElementById('chart-ctx-menu')?.remove()
    const sign = parseInt(cell.dataset.sign, 10)
    const lagnaSign = state.lagna?.sign ?? 1
    const house = ((sign - lagnaSign + 12) % 12) + 1
    const menu = document.createElement('div')
    menu.id = 'chart-ctx-menu'
    menu.style.cssText = `position:fixed;z-index:9999;background:var(--card-bg,#fff);border:1px solid var(--border,#e2e8f0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.13);padding:0.3rem 0;min-width:180px;font-size:0.85rem`
    menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px'
    menu.style.top  = Math.min(e.clientY, window.innerHeight - 60) + 'px'
    menu.innerHTML = `<div style="padding:0.35rem 0.9rem;cursor:pointer;color:var(--text);border-radius:4px" id="ctx-from-house">Show chart from House ${house}</div>`
    document.body.appendChild(menu)
    menu.querySelector('#ctx-from-house').addEventListener('click', () => {
      menu.remove()
      c().fromHouseSign = sign
      renderSVGOnly()
    })
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close) } }
    setTimeout(() => document.addEventListener('click', close), 0)
  })

  // Reset chip click
  document.getElementById('from-house-chip')?.addEventListener('click', () => {
    c().fromHouseSign = null
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
