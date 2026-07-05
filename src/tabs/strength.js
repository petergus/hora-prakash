// src/tabs/strength.js
import { state } from '../state.js'
import { detectYogas } from '../core/yogas.js'

const SIGN_ABBR = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']
const PLANETS_ORDER = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']
const BAV_ORDER = ['Lagna', ...PLANETS_ORDER]

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
        <button class="chart-style-btn${activeSubTab === 'yogas' ? ' active' : ''}" data-subtab="yogas">Yogas</button>
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
  else if (activeSubTab === 'yogas') renderYogas(panel)
  else renderBarGraph(panel)
}

function renderYogas(panel) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const yogas = detectYogas(state.planets, state.lagna)
  if (!yogas.length) {
    panel.innerHTML = '<p class="panchang-empty">No classical yogas from the checked set were detected in this chart.</p>'
    return
  }
  const CHIP = {
    benefic:     ['Benefic',     'background:#dcfce7;color:#166534'],
    challenging: ['Challenging', 'background:#fee2e2;color:#991b1b'],
    neutral:     ['Neutral',     'background:#e2e8f0;color:#334155'],
  }
  const order = { benefic: 0, neutral: 1, challenging: 2 }
  const rows = [...yogas].sort((a, b) => order[a.category] - order[b.category]).map(y => {
    const [label, style] = CHIP[y.category] ?? CHIP.neutral
    return `
      <div class="card" style="padding:0.75rem 1rem;margin-bottom:0.6rem">
        <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap">
          <strong>${esc(y.name)}</strong>
          <span style="font-size:0.7rem;padding:0.1rem 0.5rem;border-radius:999px;${style}">${label}</span>
        </div>
        <div style="font-size:0.85rem;color:var(--muted,#64748b);margin-top:0.3rem">${esc(y.description)}</div>
      </div>`
  }).join('')
  panel.innerHTML = `
    <div class="yogas-wrap">
      ${rows}
      <p style="font-size:0.75rem;color:var(--muted,#94a3b8);margin-top:0.75rem">
        Detected with whole-sign rules (conjunction = same sign, full sign aspects).
        Checked: Pancha Mahapurusha, Gaja-Kesari, Budhaditya, Chandra-Mangala, Raj (kendra–trikona),
        Dhana, Parivartana, Vipreet Raj, Neecha Bhanga, Sunapha/Anapha/Durudhara/Kemadruma, Amala, Kala Sarpa.
      </p>
    </div>`
}

function renderAshtakavarga(panel) {
  const { bhinna, sarva } = state.strength
  const planetMap = Object.fromEntries(state.planets.map(p => [p.name, p]))

  const sections = BAV_ORDER.map(pname => {
    const scores = bhinna[pname]
    const ownSign0 = pname === 'Lagna'
      ? (state.lagna?.sign ?? 1) - 1
      : (planetMap[pname]?.sign ?? 1) - 1
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
      <div class="avarga-section avarga-sarva">
        <h4>Sarvashtakavarga (total ${sarvaTotal})</h4>
        <div class="avarga-row header">${SIGN_ABBR.map(s => `<div class="avarga-cell">${s}</div>`).join('')}</div>
        <div class="avarga-row">${sarvaCells}</div>
      </div>
      ${sections}
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
