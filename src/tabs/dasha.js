// src/tabs/dasha.js
import { state } from '../state.js'
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, DASHA_YEARS } from '../core/dasha.js'

let selectedProgLord = null   // persists across re-renders; null = use current MD lord

export function renderDasha() {
  const panel = document.getElementById('tab-dasha')
  if (!state.dasha || !state.birth) return
  const { dasha, birth } = state

  const rows = dasha.map(maha => {
    const isMahaCurrent = isCurrentPeriod(maha.start, maha.end)
    const antarRows = maha.antars.map(antar => {
      const isAntarCurrent = isCurrentPeriod(antar.start, antar.end)
      const pratRows = antar.pratyantars.map(prat => {
        const isPratCurrent = isCurrentPeriod(prat.start, prat.end)
        return `<tr class="${isPratCurrent ? 'current-period' : ''}" style="display:none" data-prat>
          <td style="padding-left:3rem">↳ ${prat.planet}</td>
          <td>${fmt(prat.start)}</td>
          <td>${fmt(prat.end)}</td>
        </tr>`
      }).join('')

      return `<tr class="${isAntarCurrent ? 'current-period' : ''}" style="display:none" data-antar data-toggle-prat>
          <td style="padding-left:1.5rem; cursor:pointer">▶ ${antar.planet}</td>
          <td>${fmt(antar.start)}</td>
          <td>${fmt(antar.end)}</td>
        </tr>${pratRows}`
    }).join('')

    return `<tr class="${isMahaCurrent ? 'current-period' : ''}" data-toggle-antar style="cursor:pointer">
        <td><strong>▶ ${maha.planet}</strong></td>
        <td>${fmt(maha.start)}</td>
        <td>${fmt(maha.end)}</td>
      </tr>${antarRows}`
  }).join('')

  // Determine current MD lord for default selection
  const currentMaha = dasha.find(m => isCurrentPeriod(m.start, m.end)) ?? dasha[0]
  if (!selectedProgLord) selectedProgLord = currentMaha.planet

  // Build progression section
  const planetByName = Object.fromEntries((state.planets ?? []).map(p => [p.name, p]))
  const progressionHtml = renderProgression(birth.dob, planetByName)

  panel.innerHTML = `
    <div class="card">
      <h2>Vimshottari Dasha — ${birth.name}</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">Click a Mahadasha row to expand Antardashas</p>
      <div class="table-scroll"><table class="dasha-table">
        <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    ${progressionHtml}
  `

  panel.addEventListener('change', e => {
    if (e.target.id !== 'prog-lord-select') return
    selectedProgLord = e.target.value
    const pb = Object.fromEntries((state.planets ?? []).map(p => [p.name, p]))
    document.getElementById('prog-section').outerHTML = renderProgression(birth.dob, pb)
  })

  panel.querySelector('.dasha-table tbody').addEventListener('click', (e) => {
    const row = e.target.closest('tr')
    if (!row) return
    if (row.hasAttribute('data-toggle-antar')) {
      const opening = toggleSiblings(row, 'data-antar')
      setArrow(row, opening)
      if (!opening) {
        // collapse all pratyantar rows when closing the maha
        let next = row.nextElementSibling
        while (next && next.hasAttribute('data-antar')) {
          next.style.display = 'none'
          setArrow(next, false)
          let prat = next.nextElementSibling
          while (prat && prat.hasAttribute('data-prat')) {
            prat.style.display = 'none'
            prat = prat.nextElementSibling
          }
          next = prat
        }
      }
    } else if (row.hasAttribute('data-toggle-prat')) {
      const opening = toggleSiblings(row, 'data-prat')
      setArrow(row, opening)
    }
  })
}

function toggleSiblings(row, attr) {
  // Find first matching sibling (may be preceded by interleaved rows of other types)
  let probe = row.nextElementSibling
  while (probe && !probe.hasAttribute(attr)) probe = probe.nextElementSibling
  if (!probe) return false

  const willShow = probe.style.display === 'none'

  // Walk all siblings until we hit a row that belongs to neither antar nor prat level
  let cur = row.nextElementSibling
  while (cur) {
    if (cur.hasAttribute(attr)) {
      cur.style.display = willShow ? '' : 'none'
    } else if (cur.hasAttribute('data-prat') || cur.hasAttribute('data-antar')) {
      // interleaved child rows — hide when collapsing, leave hidden when expanding
      if (!willShow) cur.style.display = 'none'
    } else {
      break // reached the next maha row
    }
    cur = cur.nextElementSibling
  }
  return willShow
}

function setArrow(row, open) {
  const td = row.querySelector('td')
  if (!td) return
  td.textContent = td.textContent.replace(/^[▶▼] /, (open ? '▼ ' : '▶ '))
}

function fmt(date) {
  return date.toISOString().slice(0, 10)
}

function renderProgression(dobStr, planetByName) {
  const lordNames = Object.keys(DASHA_YEARS)
  const lordHouse = planetByName[selectedProgLord]?.house ?? 1
  const mdYears   = DASHA_YEARS[selectedProgLord] ?? 1
  const mdEntry   = (state.dasha ?? []).find(m => m.planet === selectedProgLord)
  const mdStart   = mdEntry?.start ?? new Date()

  const houseActive = calcHouseActiveFromAge(dobStr)
  const periods     = calcDashaProgression(lordHouse, mdStart, mdYears)

  const lordOptions = lordNames.map(name => {
    const h = planetByName[name]?.house ?? '?'
    return `<option value="${name}"${name === selectedProgLord ? ' selected' : ''}>${name} — H${h}</option>`
  }).join('')

  const periodRows = periods.map(p => `
    <tr class="${p.isActive ? 'current-period' : ''}">
      <td style="text-align:center">${p.houseFromMDL}</td>
      <td style="text-align:center;font-weight:${p.isActive ? '700' : '400'}">H${p.progressionHouse}</td>
      <td style="text-align:center;color:var(--muted)">H${p.regressionHouse}</td>
      <td>${fmt(p.start)}</td>
      <td>${fmt(p.end)}</td>
      <td style="text-align:center">${p.isActive ? '★ Active' : ''}</td>
    </tr>`).join('')

  return `
    <div class="card" id="prog-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
        <h3 style="margin:0">Dasha Progression</h3>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:0.82rem;color:var(--muted)">MD Lord:</span>
          <select id="prog-lord-select" class="div-select" style="font-size:0.82rem;padding:0.2rem 0.5rem">${lordOptions}</select>
        </div>
      </div>
      <p style="font-size:0.82rem;color:var(--muted);margin:0 0 0.9rem">
        ${selectedProgLord} in H${lordHouse} &nbsp;·&nbsp; ${mdYears} months per house
        &nbsp;·&nbsp; MD starts ${fmt(mdStart)}
        &nbsp;·&nbsp; <strong style="color:var(--text)">House active from age: H${houseActive}</strong>
      </p>
      <div class="table-scroll"><table class="dasha-table">
        <thead><tr>
          <th style="text-align:center">#</th>
          <th style="text-align:center">Prog. House →</th>
          <th style="text-align:center">Regr. House ←</th>
          <th>From</th><th>To</th><th></th>
        </tr></thead>
        <tbody>${periodRows}</tbody>
      </table></div>
    </div>`
}
