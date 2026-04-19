// src/tabs/dasha.js
import { state } from '../state.js'
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, calcAgeComponents, DASHA_YEARS } from '../core/dasha.js'

let selectedProgLord = null   // persists across re-renders; null = use current MD lord
let ageAsOf = null            // null = today; set to Date when user picks a date

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

  const ageRef = ageAsOf ?? new Date()
  const ageHtml = renderAgeProgression(birth.dob, ageRef)

  panel.innerHTML = `
    <div class="card">
      <h2>Vimshottari Dasha — ${birth.name}</h2>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem;margin-bottom:1rem">Click a Mahadasha row to expand Antardashas</p>
      <div class="table-scroll"><table class="dasha-table">
        <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    ${ageHtml}
    ${progressionHtml}
  `

  panel.addEventListener('change', e => {
    if (e.target.id === 'age-asof-input') {
      ageAsOf = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
      const ref = ageAsOf ?? new Date()
      document.getElementById('age-prog-section').outerHTML = renderAgeProgression(birth.dob, ref)
    } else if (e.target.id === 'prog-lord-select') {
      selectedProgLord = e.target.value
      const pb = Object.fromEntries((state.planets ?? []).map(p => [p.name, p]))
      document.getElementById('prog-section').outerHTML = renderProgression(birth.dob, pb)
    }
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

function renderAgeProgression(dobStr, asOf) {
  const { years, months, days } = calcAgeComponents(dobStr, asOf)
  const houseActive = calcHouseActiveFromAge(dobStr, asOf)
  const todayStr = new Date().toISOString().slice(0, 10)
  const asOfStr  = asOf.toISOString ? asOf.toISOString().slice(0, 10) : todayStr
  const isToday  = asOfStr === todayStr

  // 12 house cycles — mark which one contains the current age
  const cycleNum   = Math.floor(years / 12)        // 0-based cycle (0 = first 12 years)
  const houseRows  = Array.from({ length: 12 }, (_, i) => {
    const h = i + 1
    const ageStart = cycleNum * 12 + i
    const ageEnd   = ageStart + 1
    const isActive = h === houseActive
    return `<tr class="${isActive ? 'current-period' : ''}">
      <td style="text-align:center;font-weight:${isActive ? '700' : '400'}">H${h}</td>
      <td style="text-align:center;color:var(--muted)">${ageStart}–${ageEnd}</td>
      <td style="text-align:center">${isActive ? '★ Active' : ''}</td>
    </tr>`
  }).join('')

  return `
    <div class="card" id="age-prog-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem">
        <h3 style="margin:0">Age Progression</h3>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:0.82rem;color:var(--muted)">As of:</span>
          <input type="date" id="age-asof-input" value="${asOfStr}"
            style="font-size:0.82rem;padding:0.2rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)" />
          ${!isToday ? `<button id="age-reset-today" style="font-size:0.78rem;padding:0.2rem 0.5rem;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:none;color:var(--muted)">Today</button>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:baseline;gap:1.2rem;margin-bottom:0.9rem;flex-wrap:wrap">
        <span style="font-size:1.5rem;font-weight:700;color:var(--text)">${years}<span style="font-size:0.85rem;font-weight:400;color:var(--muted);margin-left:0.2rem">yrs</span></span>
        <span style="font-size:1.5rem;font-weight:700;color:var(--text)">${months}<span style="font-size:0.85rem;font-weight:400;color:var(--muted);margin-left:0.2rem">mo</span></span>
        <span style="font-size:1.5rem;font-weight:700;color:var(--text)">${days}<span style="font-size:0.85rem;font-weight:400;color:var(--muted);margin-left:0.2rem">days</span></span>
        <span style="font-size:0.88rem;color:var(--muted);margin-left:0.3rem">→ Cycle ${cycleNum + 1} &nbsp;·&nbsp; <strong style="color:var(--text)">House ${houseActive} active</strong></span>
      </div>
      <div class="table-scroll"><table class="dasha-table">
        <thead><tr>
          <th style="text-align:center">House</th>
          <th style="text-align:center">Age Range (yrs)</th>
          <th style="text-align:center">Status</th>
        </tr></thead>
        <tbody>${houseRows}</tbody>
      </table></div>
    </div>`
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
