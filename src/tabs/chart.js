// src/tabs/chart.js
import { state } from '../state.js'
import { renderChartSVG, CHALIT_LABELS } from '../ui/chart-svg.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { PLANET_COLORS, getAspectedSigns } from '../core/aspects.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

let chartStyle    = 'north'
let divisional    = 'D1'
let activePlanets = new Set()
let privacyOn     = false
let _dPlanets = null, _dLagna = null, _signLabels = null, _centerLabel = null

const MASK = '••••••••'
const EYE_OPEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`
const EYE_SHUT = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`

function divLabel() {
  return DIVISIONAL_OPTIONS.find(o => o.value === divisional)?.label ?? divisional
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

export function renderChart() {
  const panel = document.getElementById('tab-chart')
  const { planets, lagna, birth } = state
  if (!planets || !lagna || !birth) return

  const { planets: dPlanets, lagna: dLagna } = calcDivisional(planets, lagna, divisional)
  const signLabels  = divisional === 'Chalit' ? CHALIT_LABELS : undefined
  const centerLabel = divisional === 'D1' ? 'Rashi\nChart'
    : divLabel().replace(' – ', '\n')

  _dPlanets = dPlanets
  _dLagna = dLagna
  _signLabels = signLabels
  _centerLabel = centerLabel

  const heading = divisional === 'D1'
    ? `${esc(birth.name)} — Birth Chart`
    : `${esc(birth.name)} — ${divLabel()}`

  const maskedName    = privacyOn ? MASK : heading
  const maskedDetails = privacyOn
    ? `${MASK} &nbsp;${MASK} &nbsp;·&nbsp; ${MASK}`
    : `${birth.dob} &nbsp;${birth.tob} &nbsp;·&nbsp; ${esc(birth.location) || birth.lat + '°, ' + birth.lon + '°'}`

  panel.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem">
        <h2 style="margin:0">${maskedName}</h2>
        <button id="btn-privacy" title="${privacyOn ? 'Show details' : 'Hide details'}" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0.2rem;margin-top:0.1rem;border-radius:4px;line-height:1;display:flex;align-items:center" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">${privacyOn ? EYE_SHUT : EYE_OPEN}</button>
      </div>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${maskedDetails}</p>
      <div class="chart-controls">
        <select id="div-select" class="div-select">
          ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === divisional ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
        <div class="chart-style-group">
          <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North</button>
          <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South</button>
        </div>
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
        </div>
      </div>
      <div id="chart-container">
        ${renderChartSVG(dPlanets, dLagna, chartStyle, signLabels, centerLabel,
          dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => ({ fromSign: p.sign, toSigns: getAspectedSigns(p.sign, p.abbr), color: PLANET_COLORS[p.abbr] })),
          Object.fromEntries(dPlanets.filter(p => activePlanets.has(p.abbr)).map(p => [p.abbr, PLANET_COLORS[p.abbr]]))
        )}
      </div>
      <h3>Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel() : ''}</h3>
      <div class="table-scroll"><table class="planet-table">
        <thead>
          <tr><th>Planet</th><th>Sign</th><th>Deg</th><th>D1 House</th><th>Nakshatra</th><th>Pada</th></tr>
        </thead>
        <tbody>
          ${(() => {
            const origByName = Object.fromEntries(planets.map(p => [p.name, p]))
            return dPlanets.map(p => {
              const signLabel = divisional === 'Chalit'
                ? `H${p.sign}`
                : SIGN_NAMES[p.sign - 1]
              const orig = origByName[p.name]
              const origHouse = orig?.house ?? '—'
              return `<tr>
              <td>${esc(p.name)}${p.retrograde ? ' <span style="color:#c00;font-size:0.8em">(R)</span>' : ''}${p.combust ? ' <span style="color:#b45309;font-size:0.8em">(C)</span>' : ''}</td>
              <td>${signLabel}</td>
              <td>${p.degree.toFixed(2)}°</td>
              <td>${origHouse}</td>
              <td>${orig?.nakshatra ?? '—'}</td>
              <td>${orig?.pada ?? '—'}</td>
            </tr>`
            }).join('')
          })()}
          <tr style="background:#fef3ff">
            <td><strong>Lagna</strong></td>
            <td>${divisional === 'Chalit' ? 'H1' : SIGN_NAMES[dLagna.sign - 1]}</td>
            <td>${dLagna.degree.toFixed(2)}°</td>
            <td>1</td>
            <td>${lagna.nakshatra}</td>
            <td>${lagna.pada}</td>
          </tr>
        </tbody>
      </table></div>
    </div>
  `

  panel.querySelector('#btn-privacy').addEventListener('click', () => {
    privacyOn = !privacyOn
    renderChart()
  })

  panel.querySelector('#div-select').addEventListener('change', e => {
    divisional = e.target.value
    activePlanets = new Set()
    renderChart()
  })
  panel.querySelector('#btn-north').addEventListener('click', () => { chartStyle = 'north'; renderChart() })
  panel.querySelector('#btn-south').addEventListener('click', () => { chartStyle = 'south'; renderChart() })

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
}
