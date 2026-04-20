// src/tabs/dasha.js
import { state } from '../state.js'
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, calcAgeComponents, DASHA_YEARS } from '../core/dasha.js'
import { PLANET_COLORS } from '../core/aspects.js'
import { getActiveSession, defaultDashaUI } from '../sessions.js'

const PLANET_ABBR = { Ketu:'Ke', Venus:'Ve', Sun:'Su', Moon:'Mo', Mars:'Ma', Rahu:'Ra', Jupiter:'Ju', Saturn:'Sa', Mercury:'Me' }

// Returns the UI state object for the active session's dasha tab.
// All reads and writes go through this reference — no module-level vars.
function d() {
  const s = getActiveSession()
  if (!s) return defaultDashaUI()
  s.uiState ??= {}
  s.uiState.dasha ??= defaultDashaUI()
  return s.uiState.dasha
}

export function renderDasha() {
  const panel = document.getElementById('tab-dasha')
  if (!state.dasha || !state.birth) return
  const { dasha, birth } = state
  const ui = d()

  // Initialise defaults for this session if not yet set
  if (ui.selectedProgLord === null) {
    const currentMaha = dasha.find(m => isCurrentPeriod(m.start, m.end)) ?? dasha[0]
    ui.selectedProgLord = currentMaha.planet
    ui.progNavIndex     = dasha.findIndex(m => m.planet === ui.selectedProgLord)
  }

  const rows = dasha.map(maha => {
    const isMahaCurrent  = isCurrentPeriod(maha.start, maha.end)
    const isMahaExpanded = ui.expandedMahas.has(maha.planet)
    const antarRows = maha.antars.map(antar => {
      const isAntarCurrent  = isCurrentPeriod(antar.start, antar.end)
      const isAntarExpanded = ui.expandedAntars.get(maha.planet)?.has(antar.planet) ?? false
      const pratRows = antar.pratyantars.map(prat => {
        const isPratCurrent = isCurrentPeriod(prat.start, prat.end)
        return `<tr class="${isPratCurrent ? 'current-period' : ''}"
          style="display:${isAntarExpanded ? '' : 'none'}" data-prat>
          <td style="padding-left:3rem">↳ ${prat.planet}</td>
          <td>${fmt(prat.start)}</td>
          <td>${fmt(prat.end)}</td>
        </tr>`
      }).join('')

      return `<tr class="${isAntarCurrent ? 'current-period' : ''}"
          style="display:${isMahaExpanded ? '' : 'none'}"
          data-antar data-toggle-prat data-maha="${maha.planet}" data-antar-name="${antar.planet}">
          <td style="padding-left:1.5rem; cursor:pointer">${isAntarExpanded ? '▼' : '▶'} ${antar.planet}</td>
          <td>${fmt(antar.start)}</td>
          <td>${fmt(antar.end)}</td>
        </tr>${pratRows}`
    }).join('')

    return `<tr class="${isMahaCurrent ? 'current-period' : ''}"
        data-toggle-antar data-maha="${maha.planet}" style="cursor:pointer">
        <td><strong>${isMahaExpanded ? '▼' : '▶'} ${maha.planet}</strong></td>
        <td>${fmt(maha.start)}</td>
        <td>${fmt(maha.end)}</td>
      </tr>${antarRows}`
  }).join('')

  const progressionHtml = renderProgression(birth.dob, dasha)
  const ageRef = ui.ageAsOf ?? (ui.ageNavCycle !== null ? offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12) : new Date())
  const ageHtml = renderAgeProgression(birth.dob, ageRef)

  panel.innerHTML = `
    <div id="prog-drag-container" style="display:flex;flex-direction:column;gap:0">
      <div class="card prog-draggable" id="dasha-section" draggable="true">
        <div class="prog-card-header">
          <div class="prog-card-title">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
            <h3>Vimshottari Dasha — ${birth.name}</h3>
          </div>
        </div>
        <div id="dasha-body" style="display:${ui.dashaCollapsed ? 'none' : ''}">
          <p style="color:var(--muted);font-size:0.82rem;margin-bottom:0.85rem">Click a Mahadasha row to expand Antardashas</p>
          <div class="table-scroll"><table class="dasha-table">
            <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
      </div>
      ${ageHtml}
      ${progressionHtml}
    </div>
  `

  panel.onchange = e => {
    const ui = d()
    if (e.target.id === 'age-asof-input') {
      ui.ageAsOf    = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
      ui.ageNavCycle = null
      document.getElementById('age-prog-section').outerHTML = renderAgeProgression(birth.dob, ui.ageAsOf ?? new Date())
    } else if (e.target.id === 'prog-lord-select') {
      ui.selectedProgLord = e.target.value
      ui.progNavIndex     = dasha.findIndex(m => m.planet === ui.selectedProgLord)
      document.getElementById('prog-section').outerHTML = renderProgression(birth.dob, dasha)
    }
  }

  panel.onclick = e => {
    const ui = d()
    if (e.target.id === 'dasha-toggle-btn') {
      ui.dashaCollapsed = !ui.dashaCollapsed
      document.getElementById('dasha-body').style.display = ui.dashaCollapsed ? 'none' : ''
      e.target.textContent = ui.dashaCollapsed ? '▶' : '▼'
    } else if (e.target.id === 'age-toggle-btn') {
      ui.ageCollapsed = !ui.ageCollapsed
      document.getElementById('age-prog-body').style.display = ui.ageCollapsed ? 'none' : ''
      e.target.textContent = ui.ageCollapsed ? '▶' : '▼'
    } else if (e.target.id === 'prog-toggle-btn') {
      ui.progCollapsed = !ui.progCollapsed
      document.getElementById('prog-body').style.display = ui.progCollapsed ? 'none' : ''
      e.target.textContent = ui.progCollapsed ? '▶' : '▼'
    } else if (e.target.id === 'age-prev-btn') {
      const curCycle = ui.ageNavCycle ?? Math.floor(calcAgeYearsFromDob(birth.dob) / 12)
      ui.ageNavCycle = Math.max(0, curCycle - 1)
      ui.ageAsOf = null
      document.getElementById('age-prog-section').outerHTML = renderAgeProgression(birth.dob, offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12))
    } else if (e.target.id === 'age-next-btn') {
      const curCycle = ui.ageNavCycle ?? Math.floor(calcAgeYearsFromDob(birth.dob) / 12)
      ui.ageNavCycle = Math.min(9, curCycle + 1)
      ui.ageAsOf = null
      document.getElementById('age-prog-section').outerHTML = renderAgeProgression(birth.dob, offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12))
    } else if (e.target.id === 'age-reset-today') {
      ui.ageNavCycle = null
      ui.ageAsOf = null
      document.getElementById('age-prog-section').outerHTML = renderAgeProgression(birth.dob, new Date())
    } else if (e.target.id === 'prog-prev-btn') {
      ui.progNavIndex     = Math.max(0, (ui.progNavIndex ?? 0) - 1)
      ui.selectedProgLord = dasha[ui.progNavIndex].planet
      document.getElementById('prog-section').outerHTML = renderProgression(birth.dob, dasha)
    } else if (e.target.id === 'prog-next-btn') {
      ui.progNavIndex     = Math.min(dasha.length - 1, (ui.progNavIndex ?? 0) + 1)
      ui.selectedProgLord = dasha[ui.progNavIndex].planet
      document.getElementById('prog-section').outerHTML = renderProgression(birth.dob, dasha)
    }
  }

  initDragReorder(document.getElementById('prog-drag-container'))

  // Dasha table row toggle — tracks expanded state in session
  panel.querySelector('.dasha-table tbody').addEventListener('click', (e) => {
    const row = e.target.closest('tr')
    if (!row) return
    const ui = d()

    if (row.hasAttribute('data-toggle-antar')) {
      const mahaName = row.dataset.maha
      const opening  = toggleSiblings(row, 'data-antar')
      setArrow(row, opening)
      if (opening) {
        ui.expandedMahas.add(mahaName)
      } else {
        ui.expandedMahas.delete(mahaName)
        ui.expandedAntars.delete(mahaName)
        // Collapse all pratyantar rows visually
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
      const mahaName  = row.dataset.maha
      const antarName = row.dataset.antarName
      const opening   = toggleSiblings(row, 'data-prat')
      setArrow(row, opening)
      if (!ui.expandedAntars.has(mahaName)) ui.expandedAntars.set(mahaName, new Set())
      if (opening) ui.expandedAntars.get(mahaName).add(antarName)
      else         ui.expandedAntars.get(mahaName).delete(antarName)
    }
  })
}

function toggleSiblings(row, attr) {
  const isPrat = attr === 'data-prat'
  let probe = row.nextElementSibling
  while (probe && !probe.hasAttribute(attr)) {
    if (isPrat && probe.hasAttribute('data-antar')) return false
    probe = probe.nextElementSibling
  }
  if (!probe) return false

  const willShow = probe.style.display === 'none'
  let cur = row.nextElementSibling
  while (cur) {
    if (isPrat && cur.hasAttribute('data-antar')) break
    if (cur.hasAttribute(attr)) {
      cur.style.display = willShow ? '' : 'none'
    } else if (cur.hasAttribute('data-prat') || cur.hasAttribute('data-antar')) {
      if (!willShow) cur.style.display = 'none'
    } else {
      break
    }
    cur = cur.nextElementSibling
  }
  return willShow
}

function setArrow(row, open) {
  const td = row.querySelector('td')
  if (!td) return
  td.textContent = td.textContent.replace(/^[▶▼] /, open ? '▼ ' : '▶ ')
}

function fmt(date) {
  return date.toISOString().slice(0, 10)
}

function offsetYearsFromDob(dobStr, years) {
  const d = new Date(dobStr + 'T00:00:00')
  d.setFullYear(d.getFullYear() + years)
  return d
}

function calcAgeYearsFromDob(dobStr) {
  const dob = new Date(dobStr + 'T00:00:00')
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) years--
  return Math.max(0, years)
}

function renderAgeProgression(dobStr, asOf) {
  const ui = d()
  const { years, months, days } = calcAgeComponents(dobStr, asOf)
  const houseActive = calcHouseActiveFromAge(dobStr, asOf)
  const todayStr = new Date().toISOString().slice(0, 10)
  const asOfStr  = asOf instanceof Date ? asOf.toISOString().slice(0, 10) : todayStr
  const isToday  = asOfStr === todayStr
  const shownCycle = Math.floor(years / 12)
  const atMin = shownCycle <= 0
  const atMax = shownCycle >= 9

  const houseRows = Array.from({ length: 12 }, (_, i) => {
    const h = i + 1
    const ageStart = shownCycle * 12 + i
    const isActive = h === houseActive
    return `<tr class="${isActive ? 'current-period' : ''}">
      <td style="text-align:center;font-weight:${isActive ? '700' : '400'}">H${h}</td>
      <td style="text-align:center;color:var(--muted)">${ageStart}–${ageStart + 1}</td>
      <td style="text-align:center">${isActive ? '★ Active' : ''}</td>
    </tr>`
  }).join('')

  return `
    <div class="card prog-draggable" id="age-prog-section" draggable="true">
      <div class="prog-card-header">
        <div class="prog-card-title">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <button id="age-toggle-btn" class="toggle-btn">${ui.ageCollapsed ? '▶' : '▼'}</button>
          <h3>Age Progression</h3>
        </div>
        <div class="prog-card-controls">
          <button id="age-prev-btn" class="prog-nav-btn" ${atMin ? 'disabled' : ''}>←</button>
          <span style="font-size:0.78rem;color:var(--muted);min-width:4rem;text-align:center">Cycle ${shownCycle + 1}</span>
          <button id="age-next-btn" class="prog-nav-btn" ${atMax ? 'disabled' : ''}>→</button>
          <span style="font-size:0.78rem;color:var(--muted)">As of:</span>
          <input type="date" id="age-asof-input" value="${asOfStr}"
            style="font-size:0.82rem;padding:0.2rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);min-width:0;flex:1 1 auto;max-width:160px" />
          ${!isToday ? `<button id="age-reset-today" class="prog-nav-btn">Today</button>` : ''}
        </div>
      </div>
      <div id="age-prog-body" style="display:${ui.ageCollapsed ? 'none' : ''}">
        <div class="age-stats">
          <div class="age-chip"><span class="age-chip-num">${years}</span><span class="age-chip-label">Years</span></div>
          <div class="age-chip"><span class="age-chip-num">${months}</span><span class="age-chip-label">Months</span></div>
          <div class="age-chip"><span class="age-chip-num">${days}</span><span class="age-chip-label">Days</span></div>
          <div class="age-cycle-badge">Cycle ${shownCycle + 1} · Age ${shownCycle * 12}–${shownCycle * 12 + 12}</div>
          <div class="age-active-badge">★ House ${houseActive} active</div>
        </div>
        <div class="table-scroll"><table class="dasha-table">
          <thead><tr>
            <th style="text-align:center">House</th>
            <th style="text-align:center">Age Range (yrs)</th>
            <th style="text-align:center">Status</th>
          </tr></thead>
          <tbody>${houseRows}</tbody>
        </table></div>
      </div>
    </div>`
}

function renderProgression(dobStr, dashaSeq) {
  const ui = d()
  const rashiByName = Object.fromEntries((state.planets ?? []).map(p => [p.name, p]))
  const lordHouse   = rashiByName[ui.selectedProgLord]?.house ?? 1
  const mdYears     = DASHA_YEARS[ui.selectedProgLord] ?? 1
  const mdEntry     = (dashaSeq ?? state.dasha ?? []).find(m => m.planet === ui.selectedProgLord)
  const mdStart     = mdEntry?.start ?? new Date()

  const periods = calcDashaProgression(lordHouse, mdStart, mdYears)
  const currentMaha = (dashaSeq ?? state.dasha ?? []).find(m => isCurrentPeriod(m.start, m.end))
  const isCurrentMD = currentMaha?.planet === ui.selectedProgLord
  const activePeriod = isCurrentMD ? periods.find(p => p.isActive) : null

  const atMin = (ui.progNavIndex ?? 0) <= 0
  const atMax = (ui.progNavIndex ?? 0) >= (dashaSeq ?? state.dasha ?? []).length - 1

  const lordOptions = (dashaSeq ?? state.dasha ?? []).map(m => {
    const h = rashiByName[m.planet]?.house ?? '?'
    return `<option value="${m.planet}"${m.planet === ui.selectedProgLord ? ' selected' : ''}>${m.planet} — H${h}</option>`
  }).join('')

  const periodRows = periods.map(p => {
    const showActive = isCurrentMD && p.isActive
    return `<tr class="${showActive ? 'current-period' : ''}">
      <td style="text-align:center">${p.houseFromMDL}</td>
      <td style="text-align:center;font-weight:${showActive ? '700' : '400'}">H${p.progressionHouse} <span style="color:var(--muted);font-size:0.75em">(P)</span></td>
      <td style="text-align:center;color:var(--muted)">H${p.regressionHouse} <span style="font-size:0.75em">(R)</span></td>
      <td>${fmt(p.start)}</td>
      <td>${fmt(p.end)}</td>
      <td style="text-align:center">${showActive ? '★ Active' : ''}</td>
    </tr>`
  }).join('')

  const lordColor  = PLANET_COLORS[PLANET_ABBR[ui.selectedProgLord]] ?? '#94a3b8'
  const activeBadge = activePeriod
    ? `<span class="prog-meta-sep">·</span><span class="age-active-badge" style="font-size:0.78rem">★ H${activePeriod.progressionHouse}(P) · H${activePeriod.regressionHouse}(R) active</span>`
    : ''
  return `
    <div class="card prog-draggable" id="prog-section" draggable="true">
      <div class="prog-card-header">
        <div class="prog-card-title">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <button id="prog-toggle-btn" class="toggle-btn">${ui.progCollapsed ? '▶' : '▼'}</button>
          <h3>Dasha Progression</h3>
        </div>
        <div class="prog-card-controls">
          <button id="prog-prev-btn" class="prog-nav-btn" ${atMin ? 'disabled' : ''}>←</button>
          <button id="prog-next-btn" class="prog-nav-btn" ${atMax ? 'disabled' : ''}>→</button>
          <span style="font-size:0.78rem;color:var(--muted)">MD Lord:</span>
          <select id="prog-lord-select" class="div-select" style="font-size:0.82rem;padding:0.2rem 0.5rem;flex:1 1 auto;min-width:0;max-width:200px">${lordOptions}</select>
        </div>
      </div>
      <div id="prog-body" style="display:${ui.progCollapsed ? 'none' : ''}">
        <div class="prog-meta">
          <span class="planet-dot" style="background:${lordColor}"></span>
          <span>${ui.selectedProgLord} in H${lordHouse}</span>
          <span class="prog-meta-sep">·</span>
          <span>${mdYears} months per house</span>
          <span class="prog-meta-sep">·</span>
          <span>MD ${fmt(mdStart)} – ${fmt(mdEntry?.end ?? mdStart)}</span>
          ${activeBadge}
        </div>
        <div class="table-scroll"><table class="dasha-table">
          <thead><tr>
            <th style="text-align:center">#</th>
            <th style="text-align:center">Prog. House (P)</th>
            <th style="text-align:center">Regr. House (R)</th>
            <th>From</th><th>To</th><th></th>
          </tr></thead>
          <tbody>${periodRows}</tbody>
        </table></div>
      </div>
    </div>`
}

function initDragReorder(container) {
  if (!container) return
  let dragged = null

  container.addEventListener('dragstart', e => {
    dragged = e.target.closest('.prog-draggable')
    if (!dragged) return
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { if (dragged) dragged.style.opacity = '0.4' }, 0)
  })

  container.addEventListener('dragend', () => {
    if (dragged) dragged.style.opacity = ''
    container.querySelectorAll('.prog-draggable').forEach(el => el.style.boxShadow = '')
    dragged = null
  })

  container.addEventListener('dragover', e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const target = e.target.closest('.prog-draggable')
    if (!target || target === dragged) return
    const rect = target.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    container.querySelectorAll('.prog-draggable').forEach(el => el.style.boxShadow = '')
    target.style.boxShadow = after
      ? '0 4px 0 0 var(--accent, #6366f1)'
      : '0 -4px 0 0 var(--accent, #6366f1)'
  })

  container.addEventListener('dragleave', e => {
    const target = e.target.closest('.prog-draggable')
    if (target) target.style.boxShadow = ''
  })

  container.addEventListener('drop', e => {
    e.preventDefault()
    const target = e.target.closest('.prog-draggable')
    if (!target || target === dragged || !dragged) return
    target.style.boxShadow = ''
    const rect = target.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    if (after) container.insertBefore(dragged, target.nextSibling)
    else container.insertBefore(dragged, target)
  })
}
