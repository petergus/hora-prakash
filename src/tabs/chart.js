// src/tabs/chart.js
import { state } from '../state.js'
import { renderChartSVG, CHALIT_LABELS } from '../ui/chart-svg.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

let chartStyle  = 'north'
let divisional  = 'D1'

function divLabel() {
  return DIVISIONAL_OPTIONS.find(o => o.value === divisional)?.label ?? divisional
}

export function renderChart() {
  const panel = document.getElementById('tab-chart')
  const { planets, lagna, birth } = state

  const { planets: dPlanets, lagna: dLagna } = calcDivisional(planets, lagna, divisional)
  const signLabels = divisional === 'Chalit' ? CHALIT_LABELS : undefined

  const heading = divisional === 'D1'
    ? `${birth.name} — Birth Chart`
    : `${birth.name} — ${divLabel()}`

  panel.innerHTML = `
    <div class="card">
      <h2>${heading}</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">${birth.dob} &nbsp;${birth.tob} &nbsp;·&nbsp; ${birth.location || birth.lat + '°, ' + birth.lon + '°'}</p>
      <div style="margin-bottom:0.75rem">
        <select id="div-select" class="div-select">
          ${DIVISIONAL_OPTIONS.map(o => `<option value="${o.value}"${o.value === divisional ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:1rem">
        <button id="btn-north" class="chart-style-btn${chartStyle === 'north' ? ' active' : ''}">North Indian</button>
        <button id="btn-south" class="chart-style-btn${chartStyle === 'south' ? ' active' : ''}">South Indian</button>
      </div>
      <div id="chart-container">
        ${renderChartSVG(dPlanets, dLagna, chartStyle, signLabels)}
      </div>
      <h3>Planetary Positions${divisional !== 'D1' ? ' — ' + divLabel() : ''}</h3>
      <div class="table-scroll"><table class="planet-table">
        <thead>
          <tr><th>Planet</th><th>Sign</th><th>Deg</th><th>House</th><th>Nakshatra</th><th>Pada</th><th>R</th></tr>
        </thead>
        <tbody>
          ${dPlanets.map((p, i) => {
            const signLabel = divisional === 'Chalit'
              ? `H${p.sign}`
              : SIGN_NAMES[p.sign - 1]
            const origHouse = planets[i].house
            return `<tr>
              <td>${p.name}</td>
              <td>${signLabel}</td>
              <td>${p.degree.toFixed(2)}°</td>
              <td>${origHouse}</td>
              <td>${planets[i].nakshatra}</td>
              <td>${planets[i].pada}</td>
              <td style="color:#c00">${p.retrograde ? '℞' : ''}</td>
            </tr>`
          }).join('')}
          <tr style="background:#fef3ff">
            <td><strong>Lagna</strong></td>
            <td>${divisional === 'Chalit' ? 'H1' : SIGN_NAMES[dLagna.sign - 1]}</td>
            <td>${dLagna.degree.toFixed(2)}°</td>
            <td>1</td>
            <td>${lagna.nakshatra}</td>
            <td>${lagna.pada}</td>
            <td></td>
          </tr>
        </tbody>
      </table></div>
    </div>
  `

  panel.querySelector('#div-select').addEventListener('change', e => {
    divisional = e.target.value
    renderChart()
  })
  panel.querySelector('#btn-north').addEventListener('click', () => { chartStyle = 'north'; renderChart() })
  panel.querySelector('#btn-south').addEventListener('click', () => { chartStyle = 'south'; renderChart() })
}
