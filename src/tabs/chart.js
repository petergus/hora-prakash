// src/tabs/chart.js
import { state } from '../state.js'
import { renderChartSVG, CHALIT_LABELS } from '../ui/chart-svg.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { PLANET_COLORS, getAspectedSigns } from '../core/aspects.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

let chartStyle    = 'north'
let viewMode      = '1'          // '1' | '2' | '4'
let divisional    = 'D1'
let multiDivs     = ['D1','D9','D3','D10']   // slot selections for multi-view
let activeMultiTab = 0           // which chart tab is shown in multi-view (mobile)
let activePlanets = new Set()
let privacyOn     = false
let _dPlanets = null, _dLagna = null, _signLabels = null, _centerLabel = null

const VIEW_DEFAULTS = { '1': ['D1'], '2': ['D1','D9'], '4': ['D1','D9','D3','D10'] }

const MASK = '••••••••'
const EYE_OPEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`
const EYE_SHUT = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`

function divLabel(key) {
  return DIVISIONAL_OPTIONS.find(o => o.value === key)?.label ?? key
}

function renderSVGOnly() {
  if (!_dPlanets) return
  const activeAspects = _dPlanets
    .filter(p => activePlanets.has(p.abbr))
    .map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] }))
  const activePlanetColors = Object.fromEntries(
    _dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]])
  )
  document.getElementById('chart-container').innerHTML =
    renderChartSVG(_dPlanets, _dLagna, chartStyle, _signLabels, _centerLabel, activeAspects, activePlanetColors)
}

function buildSingleChart(planets, lagna, key, compact = false) {
  const { planets: dPlanets, lagna: dLagna } = calcDivisional(planets, lagna, key)
  const signLabels  = key === 'Chalit' ? CHALIT_LABELS : undefined
  const label       = key === 'D1' ? 'Rashi\nChart' : divLabel(key).replace(' – ', '\n')
  return { dPlanets, dLagna, signLabels, label }
}

function divSelectHtml(id, selected, label) {
  return `<div style="display:flex;align-items:center;gap:0.4rem">
    <span style="font-size:0.75rem;color:var(--muted)">${label}</span>
    <select id="${id}" class="div-select" style="font-size:0.78rem;padding:0.2rem 0.4rem">
      ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${o.value}</option>`).join('')}
    </select>
  </div>`
}

function renderMultiChartSVG(planets, lagna, keys) {
  return keys.map((key, i) => {
    const { dPlanets, dLagna, signLabels, label } = buildSingleChart(planets, lagna, key)
    return `<div class="multi-chart-cell">
      <div class="multi-chart-label">${divSelectHtml('multi-div-' + i, key, '')}</div>
      ${renderChartSVG(dPlanets, dLagna, chartStyle, signLabels, label, [], {})}
    </div>`
  }).join('')
}

function renderMultiTabNav(keys) {
  return `<div class="multi-tab-nav">
    ${keys.map((key, i) => `<button class="multi-tab-btn${activeMultiTab === i ? ' active' : ''}" data-tab="${i}">${key}</button>`).join('')}
  </div>`
}

export function renderChart() {
  const panel = document.getElementById('tab-chart')
  const { planets, lagna, birth } = state
  if (!planets || !lagna || !birth) return

  const slots = viewMode === '1' ? 1 : viewMode === '2' ? 2 : 4
  const keys  = multiDivs.slice(0, slots)

  // For single view, maintain legacy _dPlanets for aspect toggling
  if (viewMode === '1') {
    const { dPlanets, dLagna, signLabels, label } = buildSingleChart(planets, lagna, divisional)
    _dPlanets = dPlanets
    _dLagna   = dLagna
    _signLabels = signLabels
    _centerLabel = label
  }

  const heading = viewMode === '1'
    ? (divisional === 'D1' ? `${esc(birth.name)} — Birth Chart` : `${esc(birth.name)} — ${divLabel(divisional)}`)
    : `${esc(birth.name)} — Charts`

  const maskedName    = privacyOn ? MASK : heading
  const maskedDetails = privacyOn
    ? `${MASK} &nbsp;${MASK} &nbsp;·&nbsp; ${MASK}`
    : `${birth.dob} &nbsp;${birth.tob} &nbsp;·&nbsp; ${esc(birth.location) || birth.lat + '°, ' + birth.lon + '°'}`

  // ── Controls row ──
  const singleDivSelect = viewMode === '1' ? `
    <select id="div-select" class="div-select">
      ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === divisional ? ' selected' : ''}>${o.label}</option>`).join('')}
    </select>` : ''

  const aspectBtns = viewMode === '1' ? `
    <div class="chart-style-group">
      <button id="btn-show-all" class="chart-style-btn" title="Show all planetary aspects">
        <svg width="17" height="17" viewBox="0 0 17 17" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8.5" cy="8.5" r="2"/>
          <g stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2.5 1.5">
            <line x1="8.5" y1="6.5" x2="8.5" y2="1"/>
            <line x1="8.5" y1="10.5" x2="8.5" y2="16"/>
            <line x1="6.5" y1="8.5" x2="1" y2="8.5"/>
            <line x1="10.5" y1="8.5" x2="16" y2="8.5"/>
            <line x1="7.1" y1="7.1" x2="2.5" y2="2.5"/>
            <line x1="9.9" y1="9.9" x2="14.5" y2="14.5"/>
            <line x1="9.9" y1="7.1" x2="14.5" y2="2.5"/>
            <line x1="7.1" y1="9.9" x2="2.5" y2="14.5"/>
          </g>
        </svg>
      </button>
      <button id="btn-hide-all" class="chart-style-btn" title="Hide all planetary aspects">
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8.5" cy="8.5" r="2" fill="currentColor" opacity="0.35"/>
          <g stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2.5 1.5" opacity="0.35">
            <line x1="8.5" y1="6.5" x2="8.5" y2="1"/>
            <line x1="8.5" y1="10.5" x2="8.5" y2="16"/>
            <line x1="6.5" y1="8.5" x2="1" y2="8.5"/>
            <line x1="10.5" y1="8.5" x2="16" y2="8.5"/>
          </g>
          <line x1="2" y1="2" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>` : ''

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
    // Tab nav for mobile; grid for desktop — both always rendered, CSS handles visibility
    const activeKey = keys[activeMultiTab] ?? keys[0]
    const { dPlanets: activeDP, dLagna: activeDL, signLabels: activeLabels, label: activeLabel } = buildSingleChart(planets, lagna, activeKey)
    chartArea = `
      ${renderMultiTabNav(keys)}
      <div class="multi-chart-grid multi-chart-grid-${slots}">
        ${renderMultiChartSVG(planets, lagna, keys)}
      </div>
      <div class="multi-chart-mobile-view">
        ${renderChartSVG(activeDP, activeDL, chartStyle, activeLabels, activeLabel, [], {})}
      </div>`
  }

  // ── Planet table (single view only) ──
  const planetTable = viewMode === '1' ? (() => {
    const { dPlanets, dLagna } = { dPlanets: _dPlanets, dLagna: _dLagna }
    const origByName = Object.fromEntries(planets.map(p => [p.name, p]))
    return `
      <h3>Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel(divisional) : ''}</h3>
      <div class="table-scroll"><table class="planet-table">
        <thead>
          <tr><th>Planet</th><th>Sign</th><th>Deg</th><th>D1 House</th><th>Nakshatra</th><th>Pada</th></tr>
        </thead>
        <tbody>
          ${dPlanets.map(p => {
            const signLabel = divisional === 'Chalit' ? `H${p.sign}` : SIGN_NAMES[p.sign - 1]
            const orig = origByName[p.name]
            return `<tr>
              <td>${esc(p.name)}${p.retrograde ? ' <span style="color:#c00;font-size:0.8em">(R)</span>' : ''}${p.combust ? ' <span style="color:#b45309;font-size:0.8em">(C)</span>' : ''}</td>
              <td>${signLabel}</td>
              <td>${p.degree.toFixed(2)}°</td>
              <td>${orig?.house ?? '—'}</td>
              <td>${orig?.nakshatra ?? '—'}</td>
              <td>${orig?.pada ?? '—'}</td>
            </tr>`
          }).join('')}
          <tr style="background:#fef3ff">
            <td><strong>Lagna</strong></td>
            <td>${divisional === 'Chalit' ? 'H1' : SIGN_NAMES[dLagna.sign - 1]}</td>
            <td>${dLagna.degree.toFixed(2)}°</td>
            <td>1</td>
            <td>${lagna.nakshatra}</td>
            <td>${lagna.pada}</td>
          </tr>
        </tbody>
      </table></div>`
  })() : ''

  panel.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem">
        <h2 style="margin:0">${maskedName}</h2>
        <button id="btn-privacy" title="${privacyOn ? 'Show details' : 'Hide details'}" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0.2rem;margin-top:0.1rem;border-radius:4px;line-height:1;display:flex;align-items:center" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">${privacyOn ? EYE_SHUT : EYE_OPEN}</button>
      </div>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${maskedDetails}</p>
      <div class="chart-controls">
        ${singleDivSelect}
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
  panel.querySelector('#btn-privacy').addEventListener('click', () => {
    privacyOn = !privacyOn
    renderChart()
  })

  if (viewMode === '1') {
    panel.querySelector('#div-select').addEventListener('change', e => {
      divisional = e.target.value
      activePlanets = new Set()
      renderChart()
    })
    panel.querySelector('#btn-show-all').addEventListener('click', () => {
      _dPlanets.forEach(p => activePlanets.add(p.abbr))
      renderSVGOnly()
    })
    panel.querySelector('#btn-hide-all').addEventListener('click', () => {
      activePlanets = new Set()
      renderSVGOnly()
    })
    document.getElementById('chart-container').addEventListener('click', e => {
      const el = e.target.closest('[data-planet]')
      if (!el) return
      const abbr = el.dataset.planet
      if (activePlanets.has(abbr)) activePlanets.delete(abbr)
      else activePlanets.add(abbr)
      renderSVGOnly()
    })
  } else {
    // Multi-div select changes
    panel.querySelectorAll('[id^="multi-div-"]').forEach(sel => {
      sel.addEventListener('change', e => {
        const i = parseInt(e.target.id.replace('multi-div-', ''), 10)
        multiDivs[i] = e.target.value
        renderChart()
      })
    })
    // Tab nav (mobile)
    panel.querySelectorAll('.multi-tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        activeMultiTab = parseInt(e.currentTarget.dataset.tab, 10)
        renderChart()
      })
    })
  }

  panel.querySelector('#btn-north').addEventListener('click', () => { chartStyle = 'north'; renderChart() })
  panel.querySelector('#btn-south').addEventListener('click', () => { chartStyle = 'south'; renderChart() })

  panel.querySelector('#btn-view-1').addEventListener('click', () => {
    if (viewMode === '1') return
    viewMode = '1'; activePlanets = new Set(); renderChart()
  })
  panel.querySelector('#btn-view-2').addEventListener('click', () => {
    if (viewMode === '2') return
    viewMode = '2'
    // Fill missing slots from defaults, preserve existing selections
    const def = VIEW_DEFAULTS['2']
    multiDivs = def.map((d, i) => multiDivs[i] ?? d)
    activeMultiTab = 0
    renderChart()
  })
  panel.querySelector('#btn-view-4').addEventListener('click', () => {
    if (viewMode === '4') return
    viewMode = '4'
    const def = VIEW_DEFAULTS['4']
    multiDivs = def.map((d, i) => multiDivs[i] ?? d)
    activeMultiTab = 0
    renderChart()
  })
}
