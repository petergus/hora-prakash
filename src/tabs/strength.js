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
  if (activeSubTab === 'ashtakavarga') panel.innerHTML = '<p style="padding:1rem">Ashtakavarga coming soon.</p>'
  else if (activeSubTab === 'shadbala') panel.innerHTML = '<p style="padding:1rem">Shadbala coming soon.</p>'
  else panel.innerHTML = '<p style="padding:1rem">Bar Graph coming soon.</p>'
}
