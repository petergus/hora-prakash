// src/tabs/strength.js
import { state } from '../state.js'

const SIGN_ABBR = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']
const PLANETS_ORDER = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']

let activeSubTab = 'ashtakavarga'

export function renderStrength() {
  const el = document.getElementById('tab-strength')
  if (!el) return
  if (!state.strength) {
    el.innerHTML = '<p class="panchang-empty">Calculate a birth chart first.</p>'
    return
  }
  el.innerHTML = `
    <div class="strength-wrap">
      <div class="strength-subtab-bar">
        <button class="chart-style-btn${activeSubTab === 'ashtakavarga' ? ' active' : ''}" data-subtab="ashtakavarga">Ashtakavarga</button>
        <button class="chart-style-btn${activeSubTab === 'shadbala' ? ' active' : ''}" data-subtab="shadbala">Shadbala</button>
        <button class="chart-style-btn${activeSubTab === 'bargraph' ? ' active' : ''}" data-subtab="bargraph">Bar Graph</button>
      </div>
      <div id="strength-panel"></div>
    </div>
  `
  el.querySelectorAll('.chart-style-btn[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.subtab
      renderStrength()
    })
  })
  renderSubTab()
}

function renderSubTab() {
  const panel = document.getElementById('strength-panel')
  if (!panel) return
  if (activeSubTab === 'ashtakavarga') renderAshtakavarga(panel)
  else if (activeSubTab === 'shadbala') renderShadbala(panel)
  else renderBarGraph(panel)
}

function renderAshtakavarga(panel) {
  const { bhinna, sarva } = state.strength
  const planetMap = Object.fromEntries(state.planets.map(p => [p.name, p]))

  const sections = PLANETS_ORDER.map(pname => {
    const scores = bhinna[pname]
    const ownSign0 = (planetMap[pname]?.sign ?? 1) - 1
    const total = scores.reduce((a, b) => a + b, 0)
    const headerCells = SIGN_ABBR.map(s => `<div class="avarga-cell">${s}</div>`).join('')
    const scoreCells = scores.map((s, i) => {
      let cls = 'avarga-cell'
      if (i === ownSign0) cls += ' own-sign'
      else if (s >= 6) cls += ' score-high'
      else if (s <= 2) cls += ' score-low'
      return `<div class="${cls}">${s}</div>`
    }).join('')
    return `
      <div class="avarga-section">
        <h4>${pname} Bhinnashtakavarga (total ${total})</h4>
        <div class="avarga-row header">${headerCells}</div>
        <div class="avarga-row">${scoreCells}</div>
      </div>
    `
  }).join('')

  const sarvaTotal = sarva.reduce((a, b) => a + b, 0)
  const sarvaCells = sarva.map(s => {
    let cls = 'avarga-cell'
    if (s >= 30) cls += ' score-high'
    else if (s <= 18) cls += ' score-low'
    return `<div class="${cls}">${s}</div>`
  }).join('')

  panel.innerHTML = `
    <div class="avarga-table-grid">
      ${sections}
      <div class="avarga-section avarga-sarva">
        <h4>Sarvashtakavarga (total ${sarvaTotal})</h4>
        <div class="avarga-row header">${SIGN_ABBR.map(s => `<div class="avarga-cell">${s}</div>`).join('')}</div>
        <div class="avarga-row">${sarvaCells}</div>
      </div>
    </div>
  `
}

function renderShadbala(panel) {
  const { shadbala } = state.strength
  const rows = PLANETS_ORDER.map(name => {
    const d = shadbala[name]
    if (!d) return ''
    const ratioClass = d.ratio >= 1.0 ? 'ratio-strong' : d.ratio >= 0.8 ? 'ratio-weak' : 'ratio-low'
    return `
      <tr class="${ratioClass}">
        <td>${name}</td>
        <td>${d.sthanaBala}</td>
        <td>${d.digBala}</td>
        <td>${d.kalaBala}</td>
        <td>${d.chestaBala}</td>
        <td>${d.naisargikaBala}</td>
        <td>${d.drikBala}</td>
        <td class="total-col">${d.total}</td>
        <td>${d.required}</td>
        <td class="ratio-val">${d.ratio.toFixed(2)}×</td>
      </tr>
    `
  }).join('')

  panel.innerHTML = `
    <div class="shadbala-wrap">
      <div class="table-scroll">
        <table class="shadbala-table">
          <thead>
            <tr>
              <th>Planet</th><th>Sthana</th><th>Dig</th><th>Kala</th>
              <th>Chesta</th><th>Naisargika</th><th>Drik</th>
              <th>Total</th><th>Required</th><th>Ratio</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `
}

function renderBarGraph(panel) {
  const { shadbala } = state.strength
  const maxTotal = Math.max(...PLANETS_ORDER.map(n => shadbala[n]?.total ?? 0))

  const rows = PLANETS_ORDER.map(name => {
    const d = shadbala[name]
    if (!d) return ''
    const barPct  = (d.total    / maxTotal) * 100
    const reqPct  = (d.required / maxTotal) * 100
    const barClass = d.ratio >= 1.0 ? 'bar-strong' : d.ratio >= 0.8 ? 'bar-weak' : 'bar-low'
    return `
      <div class="bargraph-row">
        <div class="bargraph-label">${name}</div>
        <div class="bargraph-track">
          <div class="bargraph-bar ${barClass}" style="width:${barPct.toFixed(1)}%"></div>
          <div class="bargraph-required" style="left:${reqPct.toFixed(1)}%" title="Required: ${d.required}"></div>
        </div>
        <div class="bargraph-value">${d.total} / ${d.required} = ${d.ratio.toFixed(2)}×</div>
      </div>
    `
  }).join('')

  panel.innerHTML = `<div class="bargraph-wrap">${rows}</div>`
}
