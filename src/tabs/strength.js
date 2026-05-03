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
  else if (activeSubTab === 'shadbala') panel.innerHTML = '<p style="padding:1rem">Shadbala coming soon.</p>'
  else panel.innerHTML = '<p style="padding:1rem">Bar Graph coming soon.</p>'
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
