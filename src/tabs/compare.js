// src/tabs/compare.js
// Synastry: compare the active profile's chart with another open profile tab.
// Whole-sign overlay (B's planets in A's houses) plus inter-chart sign aspects.
import { state } from '../state.js'
import { getSessions, getActiveId } from '../sessions.js'
import { renderChartSVG } from '../ui/chart-svg.js'
import { getAspectedSigns } from '../core/aspects.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

let _otherId    = null      // compared session id (module-level UI pref)
let _chartStyle = 'north'

function chartsWithData() {
  const activeId = getActiveId()
  return getSessions()
    .map(s => ({
      id: s.id,
      label: s.label,
      data: s.id === activeId ? state : s.snap,
    }))
    .filter(c => c.data?.planets && c.data?.lagna)
}

function houseIn(lagna, sign) {
  return ((sign - lagna.sign + 12) % 12) + 1
}

function fmtDeg(dec) {
  const d = Math.floor(dec)
  const m = Math.floor((dec - d) * 60)
  return `${d}°${String(m).padStart(2, '0')}'`
}

// Table of `who`'s planets placed into `into`'s houses
function overlayTable(who, into) {
  const rows = who.data.planets.map(p => {
    const h = houseIn(into.data.lagna, p.sign)
    return `<tr>
      <td>${esc(p.name)}${p.retrograde ? ' (R)' : ''}</td>
      <td>${SIGN_NAMES[p.sign - 1]} ${fmtDeg(p.degree)}</td>
      <td>${h}</td>
    </tr>`
  }).join('')
  return `
    <div class="card" style="min-width:0">
      <h3 class="section-label">${esc(who.label)}'s planets in ${esc(into.label)}'s houses</h3>
      <div class="table-scroll"><table class="planet-table">
        <thead><tr><th>Planet</th><th>Position</th><th>House of ${esc(into.label)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`
}

// Inter-chart aspects: which of `to`'s planets sit in signs aspected by `from`'s planets
function interAspects(from, to) {
  const items = []
  for (const p of from.data.planets) {
    const aspSigns = getAspectedSigns(p.sign, p.abbr)
    const hit = to.data.planets.filter(q => aspSigns.includes(q.sign))
    const conj = to.data.planets.filter(q => q.sign === p.sign)
    if (conj.length) items.push(`<strong>${esc(p.name)}</strong> conjunct (same sign) ${conj.map(q => esc(q.name)).join(', ')}`)
    if (hit.length)  items.push(`<strong>${esc(p.name)}</strong> aspects ${hit.map(q => esc(q.name)).join(', ')}`)
  }
  return items.length
    ? `<ul style="margin:0.25rem 0 0 1.1rem;padding:0;font-size:0.85rem;line-height:1.7">${items.map(i => `<li>${i}</li>`).join('')}</ul>`
    : '<p style="font-size:0.85rem;color:var(--muted)">None.</p>'
}

export function renderCompare() {
  const el = document.getElementById('tab-compare')
  if (!el) return

  const charts = chartsWithData()
  const activeId = getActiveId()
  const a = charts.find(c => c.id === activeId)

  if (!a) {
    el.innerHTML = '<p class="panchang-empty">Calculate a birth chart first.</p>'
    return
  }

  const others = charts.filter(c => c.id !== activeId)
  if (!others.length) {
    el.innerHTML = `
      <div class="card">
        <h3 class="section-label">Compare charts</h3>
        <p style="font-size:0.9rem;color:var(--muted)">
          Open a second profile tab (the <strong>+</strong> button in the profile bar) and calculate
          its chart to compare it with <strong>${esc(a.label)}</strong>.
        </p>
      </div>`
    return
  }

  if (!others.some(o => o.id === _otherId)) _otherId = others[0].id
  const b = others.find(o => o.id === _otherId)

  const chartCell = (c) => `
    <div class="multi-chart-cell">
      <div class="multi-chart-label" style="text-align:center;font-weight:600">${esc(c.label)}</div>
      ${renderChartSVG(c.data.planets, c.data.lagna, _chartStyle, undefined,
        `${c.label}\n${c.data.birth?.dob ?? ''}`.trim(), [], {})}
    </div>`

  el.innerHTML = `
    <div class="card">
      <div class="chart-controls" style="margin-bottom:0.75rem">
        <label style="font-size:0.85rem;display:flex;align-items:center;gap:0.4rem">
          Compare <strong>${esc(a.label)}</strong> with
          <select id="compare-other" class="div-select">
            ${others.map(o => `<option value="${o.id}"${o.id === _otherId ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
          </select>
        </label>
        <div class="chart-style-group">
          <button id="compare-north" class="chart-style-btn${_chartStyle === 'north' ? ' active' : ''}">North</button>
          <button id="compare-south" class="chart-style-btn${_chartStyle === 'south' ? ' active' : ''}">South</button>
        </div>
      </div>
      <div class="multi-chart-grid multi-chart-grid-2">
        ${chartCell(a)}
        ${chartCell(b)}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;margin-top:1rem">
      ${overlayTable(b, a)}
      ${overlayTable(a, b)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;margin-top:1rem">
      <div class="card" style="min-width:0">
        <h3 class="section-label">${esc(a.label)} → ${esc(b.label)} aspects</h3>
        ${interAspects(a, b)}
      </div>
      <div class="card" style="min-width:0">
        <h3 class="section-label">${esc(b.label)} → ${esc(a.label)} aspects</h3>
        ${interAspects(b, a)}
      </div>
    </div>
    <p style="font-size:0.75rem;color:var(--muted,#94a3b8);margin-top:0.75rem">
      Whole-sign synastry: houses are counted sign-to-sign from the other chart's lagna;
      aspects use full Parashari sign aspects (Mars 4/7/8, Jupiter 5/7/9, Saturn 3/7/10, nodes 5/7/9, others 7th).
    </p>`

  el.querySelector('#compare-other').addEventListener('change', e => {
    _otherId = e.target.value
    renderCompare()
  })
  el.querySelector('#compare-north').addEventListener('click', () => { _chartStyle = 'north'; renderCompare() })
  el.querySelector('#compare-south').addEventListener('click', () => { _chartStyle = 'south'; renderCompare() })
}
