// src/tabs/dasha.js
import { state } from '../state.js'
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, calcAgeComponents, DASHA_YEARS } from '../core/dasha.js'
import { PLANET_COLORS } from '../core/aspects.js'

const PLANET_ABBR = { Ketu:'Ke', Venus:'Ve', Sun:'Su', Moon:'Mo', Mars:'Ma', Rahu:'Ra', Jupiter:'Ju', Saturn:'Sa', Mercury:'Me' }

let selectedProgLord = null   // persists across re-renders; null = use current MD lord
let ageAsOf = null            // null = today; set to Date when user picks a date
let dashaCollapsed = false
let ageCollapsed = true
let progCollapsed = true

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
    <div id="prog-drag-container" style="display:flex;flex-direction:column;gap:0">
      <div class="card prog-draggable" id="dasha-section" draggable="true">
        <div class="prog-card-header">
          <div class="prog-card-title">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <button id="dasha-toggle-btn" class="toggle-btn">${dashaCollapsed ? '▶' : '▼'}</button>
            <h3>Vimshottari Dasha — ${birth.name}</h3>
          </div>
        </div>
        <div id="dasha-body" style="display:${dashaCollapsed ? 'none' : ''}">
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

  panel.addEventListener('click', e => {
    if (e.target.id === 'dasha-toggle-btn') {
      dashaCollapsed = !dashaCollapsed
      document.getElementById('dasha-body').style.display = dashaCollapsed ? 'none' : ''
      e.target.textContent = dashaCollapsed ? '▶' : '▼'
    } else if (e.target.id === 'age-toggle-btn') {
      ageCollapsed = !ageCollapsed
      document.getElementById('age-prog-body').style.display = ageCollapsed ? 'none' : ''
      e.target.textContent = ageCollapsed ? '▶' : '▼'
    } else if (e.target.id === 'prog-toggle-btn') {
      progCollapsed = !progCollapsed
      document.getElementById('prog-body').style.display = progCollapsed ? 'none' : ''
      e.target.textContent = progCollapsed ? '▶' : '▼'
    }
  })

  initDragReorder(document.getElementById('prog-drag-container'))

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
  const isPrat = attr === 'data-prat'

  // Find first matching sibling; for prat, don't cross an antar boundary
  let probe = row.nextElementSibling
  while (probe && !probe.hasAttribute(attr)) {
    if (isPrat && probe.hasAttribute('data-antar')) return false
    probe = probe.nextElementSibling
  }
  if (!probe) return false

  const willShow = probe.style.display === 'none'

  let cur = row.nextElementSibling
  while (cur) {
    if (isPrat && cur.hasAttribute('data-antar')) break  // stop at next antar sibling
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
    <div class="card prog-draggable" id="age-prog-section" draggable="true">
      <div class="prog-card-header">
        <div class="prog-card-title">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <button id="age-toggle-btn" class="toggle-btn">${ageCollapsed ? '▶' : '▼'}</button>
          <h3>Age Progression</h3>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:0.78rem;color:var(--muted)">As of:</span>
          <input type="date" id="age-asof-input" value="${asOfStr}"
            style="font-size:0.82rem;padding:0.2rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)" />
          ${!isToday ? `<button id="age-reset-today" style="font-size:0.75rem;padding:0.15rem 0.45rem;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:none;color:var(--muted)">Today</button>` : ''}
        </div>
      </div>
      <div id="age-prog-body" style="display:${ageCollapsed ? 'none' : ''}">
        <div class="age-stats">
          <div class="age-chip"><span class="age-chip-num">${years}</span><span class="age-chip-label">Years</span></div>
          <div class="age-chip"><span class="age-chip-num">${months}</span><span class="age-chip-label">Months</span></div>
          <div class="age-chip"><span class="age-chip-num">${days}</span><span class="age-chip-label">Days</span></div>
          <div class="age-cycle-badge">Cycle ${cycleNum + 1}</div>
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

function renderProgression(dobStr, planetByName) {
  const lordNames = Object.keys(DASHA_YEARS)
  const lordHouse = planetByName[selectedProgLord]?.house ?? 1
  const mdYears   = DASHA_YEARS[selectedProgLord] ?? 1
  const mdEntry   = (state.dasha ?? []).find(m => m.planet === selectedProgLord)
  const mdStart   = mdEntry?.start ?? new Date()

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

  const lordColor = PLANET_COLORS[PLANET_ABBR[selectedProgLord]] ?? '#94a3b8'
  return `
    <div class="card prog-draggable" id="prog-section" draggable="true">
      <div class="prog-card-header">
        <div class="prog-card-title">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <button id="prog-toggle-btn" class="toggle-btn">${progCollapsed ? '▶' : '▼'}</button>
          <h3>Dasha Progression</h3>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:0.78rem;color:var(--muted)">MD Lord:</span>
          <select id="prog-lord-select" class="div-select" style="font-size:0.82rem;padding:0.2rem 0.5rem">${lordOptions}</select>
        </div>
      </div>
      <div id="prog-body" style="display:${progCollapsed ? 'none' : ''}">
        <div class="prog-meta">
          <span class="planet-dot" style="background:${lordColor}"></span>
          <span>${selectedProgLord} in H${lordHouse}</span>
          <span class="prog-meta-sep">·</span>
          <span>${mdYears} months per house</span>
          <span class="prog-meta-sep">·</span>
          <span>MD starts ${fmt(mdStart)}</span>
        </div>
        <div class="table-scroll"><table class="dasha-table">
          <thead><tr>
            <th style="text-align:center">#</th>
            <th style="text-align:center">Prog. House →</th>
            <th style="text-align:center">Regr. House ←</th>
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
