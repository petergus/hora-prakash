// src/tabs/dasha.js
import { state } from '../state.js'
import { isCurrentPeriod, calcDashaProgression, calcHouseActiveFromAge, calcAgeComponents, DASHA_YEARS, LEVEL_NAMES, ensureChildren } from '../core/dasha.js'
import { getSwe } from '../core/swisseph.js'
import { getSettings, saveSettings, buildCalcFlags, YEAR_METHOD_OPTIONS, AYANAMSA_OPTIONS } from '../core/settings.js'
import { PLANET_COLORS } from '../core/aspects.js'
import { getActiveSession, defaultDashaUI } from '../sessions.js'
import { toJulianDay } from '../utils/time.js'

const PLANET_ABBR = { Ketu:'Ke', Venus:'Ve', Sun:'Su', Moon:'Mo', Mars:'Ma', Rahu:'Ra', Jupiter:'Ju', Saturn:'Sa', Mercury:'Me' }

let _customDaysTimer = null

// Returns the UI state object for the active session's dasha tab.
// All reads and writes go through this reference — no module-level vars.
function d() {
  const s = getActiveSession()
  if (!s) return defaultDashaUI()
  s.uiState ??= {}
  s.uiState.dasha ??= defaultDashaUI()
  return s.uiState.dasha
}

function chartD() {
  const s = getActiveSession()
  if (!s) return defaultDashaUI()
  s.uiState ??= {}
  s.uiState.chart ??= {}
  s.uiState.chart.chartDasha ??= defaultDashaUI()
  return s.uiState.chart.chartDasha
}

function inferFocusedPath(dasha, ui) {
  // Pick MD: current-period if expanded, else first expanded MD
  const currentMD = dasha.find(m => isCurrentPeriod(m.start, m.end))
  let md = null
  if (currentMD && ui.expandedMahas.has(currentMD.planet)) {
    md = currentMD.planet
  } else {
    for (const m of dasha) {
      if (ui.expandedMahas.has(m.planet)) { md = m.planet; break }
    }
  }
  if (!md) return []

  // Pick AD within MD
  const antarSet = ui.expandedAntars.get(md)
  if (!antarSet || antarSet.size === 0) return [md]
  const mdNode = dasha.find(m => m.planet === md)
  const currentAD = mdNode?.children?.find(a => isCurrentPeriod(a.start, a.end))
  let ad = null
  if (currentAD && antarSet.has(currentAD.planet)) {
    ad = currentAD.planet
  } else {
    ad = [...antarSet][0] ?? null
  }
  if (!ad) return [md]

  // Pick PD and deeper via expandedPaths
  const path = []
  for (let depth = 2; depth <= 4; depth++) {
    const prefix = [md, ad, ...path].join('/')
    const match = [...ui.expandedPaths].find(p => p.startsWith(prefix + '/') && p.split('/').length === depth + 1)
    if (!match) break
    path.push(match.split('/')[depth])
  }

  return [md, ad, ...path]
}

function renderDashaOptionsPopover(ui, id = 'dasha') {
  const { yearMethod, customYearDays, ayanamsa } = getSettings()
  const focused = ui.focusedMode ?? true
  const ayanamsaName = AYANAMSA_OPTIONS.find(a => a.value === ayanamsa)?.label ?? 'Lahiri'
  let ayanamsaVal = ''
  try {
    const { dob, tob, timezone } = state.birth ?? {}
    if (dob && tob && timezone) {
      const jd  = toJulianDay(dob, tob, timezone)
      const raw = getSwe().get_ayanamsa_ut(jd)
      const deg = Math.floor(raw)
      const min = Math.floor((raw - deg) * 60)
      const sec = ((raw - deg) * 60 - min) * 60
      ayanamsaVal = ` (${deg}°${String(min).padStart(2,'0')}'${String(Math.round(sec)).padStart(2,'0')}")`
    }
  } catch (_) {}

  const yearOptions = YEAR_METHOD_OPTIONS.map(o =>
    `<option value="${o.value}"${o.value === yearMethod ? ' selected' : ''}>${o.label}</option>`
  ).join('')

  return `
    <div class="dasha-options-popover" id="${id}-options-popover">
      <div class="dasha-options-row">
        <span>Mode:</span>
        <div class="dasha-mode-radios">
          <label><input type="radio" name="${id}-mode" value="focused" ${focused ? 'checked' : ''}> Focused</label>
          <label><input type="radio" name="${id}-mode" value="full"    ${!focused ? 'checked' : ''}> Full</label>
        </div>
      </div>
      <div class="dasha-options-row">
        <span>Year:</span>
        <select id="${id}-year-method">${yearOptions}</select>
      </div>
      ${yearMethod === 'custom' ? `
      <div class="dasha-options-row">
        <span>Days/yr:</span>
        <input id="${id}-custom-days" type="number" min="300" max="400" step="0.001" value="${customYearDays}" style="width:6rem">
      </div>` : ''}
      <div class="dasha-options-info">Ayanamsa: <strong>${ayanamsaName}</strong>${ayanamsaVal} · TZ: ${state.birth?.timezone ?? 'UTC'}</div>
    </div>`
}


export async function renderDasha() {
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

  const rows = await buildDashaRows(dasha, ui)

  const progressionHtml = renderProgression(birth.dob, dasha)
  const ageRef = ui.ageAsOf ?? (ui.ageNavCycle !== null ? offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12) : new Date())
  const ageHtml = renderAgeProgression(birth.dob, ageRef)

  panel.innerHTML = `
    <div id="prog-drag-container" style="display:flex;flex-direction:column;gap:0">
      <div class="card prog-draggable" id="dasha-section" draggable="true">
        <div class="prog-card-header">
          <div class="prog-card-title" style="position:relative">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <button id="dasha-toggle-btn" class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
            <h3>Vimshottari Dasha — ${birth.name}</h3>
            <button id="dasha-options-btn" class="dasha-options-btn" title="Options">⋮</button>
            ${renderDashaOptionsPopover(ui, 'dasha')}
          </div>
        </div>
        <div id="dasha-body" style="display:${ui.dashaCollapsed ? 'none' : ''}">
          <div id="dasha-breadcrumb-wrap">${(ui.focusedMode ?? true) && (ui.focusedPath?.length > 0) ? renderBreadcrumb(dasha, ui) : ''}</div>
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
    if (e.target.name === 'dasha-mode') {
      ui.focusedMode = e.target.value === 'focused'
      if (ui.focusedMode) ui.focusedPath = inferFocusedPath(dasha, ui)
      buildDashaRows(dasha, ui).then(rows => {
        document.querySelector('.dasha-table tbody').innerHTML = rows
        document.getElementById('dasha-breadcrumb-wrap').innerHTML =
          ui.focusedMode && ui.focusedPath?.length > 0 ? renderBreadcrumb(dasha, ui) : ''
      }).catch(console.error)
      return
    }
    if (e.target.id === 'age-asof-input') {
      ui.ageAsOf    = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
      ui.ageNavCycle = null
      document.getElementById('age-prog-section').outerHTML = renderAgeProgression(birth.dob, ui.ageAsOf ?? new Date())
    } else if (e.target.id === 'prog-lord-select') {
      ui.selectedProgLord = e.target.value
      ui.progNavIndex     = dasha.findIndex(m => m.planet === ui.selectedProgLord)
      document.getElementById('prog-section').outerHTML = renderProgression(birth.dob, dasha)
    } else if (e.target.id === 'dasha-year-method') {
      const yearMethod = e.target.value
      saveSettings({ yearMethod })
      import('../tabs/input.js').then(m => m.recalcAll()).catch(err => console.error('recalcAll failed:', err))
    }
  }

  panel.oninput = e => {
    if (e.target.id !== 'dasha-custom-days') return
    clearTimeout(_customDaysTimer)
    _customDaysTimer = setTimeout(() => {
      const days = parseFloat(e.target.value)
      if (isNaN(days) || days < 300 || days > 400) return
      saveSettings({ customYearDays: days })
      import('../tabs/input.js').then(m => m.recalcAll()).catch(err => console.error('recalcAll failed:', err))
    }, 500)
  }

  panel.onclick = e => {
    const ui = d()
    const crumbBtn = e.target.closest('[data-crumb-depth]')
    if (crumbBtn) {
      const depth = parseInt(crumbBtn.dataset.crumbDepth)
      ui.focusedPath = depth < 0 ? [] : (ui.focusedPath ?? []).slice(0, depth + 1)
      buildDashaRows(state.dasha, ui).then(rows => {
        document.querySelector('.dasha-table tbody').innerHTML = rows
        document.getElementById('dasha-breadcrumb-wrap').innerHTML =
          ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
      }).catch(console.error)
      return
    }
    if (e.target.id === 'dasha-options-btn') {
      const popover = document.getElementById('dasha-options-popover')
      if (popover) popover.classList.toggle('open')
      return
    }
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

  // Dasha table row toggle — generic handler for all 5 levels
  panel.querySelector('.dasha-table tbody').addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-toggle]')
    if (!row) return
    const ui    = d()
    const path  = row.dataset.path
    const depth = parseInt(row.dataset.depth)
    const parts = path.split('/')

    if (ui.focusedMode ?? true) {
      // ── FOCUSED MODE: update focusedPath and rebuild ──
      const fp = ui.focusedPath ?? []
      const isExpanded = fp.length > depth && fp[depth] === parts[depth]

      if (isExpanded) {
        // Collapse: pop back to this level (show siblings)
        ui.focusedPath = fp.slice(0, depth)
      } else {
        // Expand: focus into this node
        ui.focusedPath = parts.slice(0, depth + 1)
      }

      const rows = await buildDashaRows(state.dasha, ui)
      document.querySelector('.dasha-table tbody').innerHTML = rows
      document.getElementById('dasha-breadcrumb-wrap').innerHTML =
        ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
      return
    }

    // ── FULL MODE: existing DOM-mutation behaviour ──
    let node = state.dasha.find(m => m.planet === parts[0])
    for (let i = 1; i < parts.length; i++) {
      node = node?.children.find(c => c.planet === parts[i])
    }
    if (!node) return

    const tbody    = row.closest('tbody')
    const allRows  = Array.from(tbody.querySelectorAll('tr'))
    const nextIdx  = allRows.indexOf(row) + 1
    const hasChild = nextIdx < allRows.length && parseInt(allRows[nextIdx].dataset.depth ?? '-1') === depth + 1
    const opening  = !hasChild

    if (opening) {
      insertChildRows(row, node, depth).catch(console.error)
    } else {
      removeChildRows(row)
    }
    setArrow(row, opening)

    if (depth === 0) {
      const mahaName = path
      if (opening) ui.expandedMahas.add(mahaName)
      else {
        ui.expandedMahas.delete(mahaName)
        ui.expandedAntars.delete(mahaName)
        for (const p of ui.expandedPaths) {
          if (p.startsWith(mahaName + '/')) ui.expandedPaths.delete(p)
        }
      }
    } else if (depth === 1) {
      const mahaName = parts[0]
      if (!ui.expandedAntars.has(mahaName)) ui.expandedAntars.set(mahaName, new Set())
      if (opening) ui.expandedAntars.get(mahaName).add(parts[1])
      else {
        ui.expandedAntars.get(mahaName).delete(parts[1])
        for (const p of ui.expandedPaths) {
          if (p.startsWith(path + '/')) ui.expandedPaths.delete(p)
        }
      }
    } else {
      if (opening) ui.expandedPaths.add(path)
      else {
        ui.expandedPaths.delete(path)
        for (const p of ui.expandedPaths) {
          if (p.startsWith(path + '/')) ui.expandedPaths.delete(p)
        }
      }
    }
  })

  if (panel._closeDashaPopover) document.removeEventListener('mousedown', panel._closeDashaPopover)
  panel._closeDashaPopover = e => {
    const popover = document.getElementById('dasha-options-popover')
    const btn     = document.getElementById('dasha-options-btn')
    if (popover && !popover.contains(e.target) && e.target !== btn) {
      popover.classList.remove('open')
    }
  }
  document.addEventListener('mousedown', panel._closeDashaPopover)
}

export async function renderDashaCards(container, cards) {
  if (!state.dasha || !state.birth) return
  const { dasha, birth } = state
  const ui = chartD()

  if (ui.selectedProgLord === null) {
    const currentMaha = dasha.find(m => isCurrentPeriod(m.start, m.end)) ?? dasha[0]
    ui.selectedProgLord = currentMaha.planet
    ui.progNavIndex     = dasha.findIndex(m => m.planet === ui.selectedProgLord)
  }

  let html = ''
  if (cards.includes('vimshottari')) {
    const rows = await buildDashaRows(dasha, ui)
    html += `
      <div class="card" id="dasha-panel-vimshottari">
        <div style="display:flex;align-items:center;position:relative;margin-bottom:0.75rem">
          <h3 class="section-label" style="margin:0;flex:1">Vimshottari Dasha</h3>
          <button id="dasha-panel-options-btn" class="dasha-options-btn" title="Options">⋮</button>
          ${renderDashaOptionsPopover(ui, 'dasha-panel')}
        </div>
        <div id="dasha-panel-breadcrumb-wrap">${(ui.focusedMode ?? true) && (ui.focusedPath?.length > 0) ? renderBreadcrumb(dasha, ui) : ''}</div>
        <div class="table-scroll"><table class="dasha-table">
          <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`
  }
  if (cards.includes('age')) {
    const ageRef = ui.ageAsOf ?? (ui.ageNavCycle !== null ? offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12) : new Date())
    html += renderAgeProgression(birth.dob, ageRef).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
  }
  if (cards.includes('progression')) {
    html += renderProgression(birth.dob, dasha).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
  }

  container.innerHTML = html

  // Wire up vimshottari interactions if rendered
  if (cards.includes('vimshottari')) {
    // ⋮ popover toggle
    const optBtn  = container.querySelector('#dasha-panel-options-btn')
    const popover = container.querySelector('#dasha-panel-options-popover')
    if (optBtn && popover) {
      optBtn.addEventListener('click', () => popover.classList.toggle('open'))
      if (container._closeChartPopover) document.removeEventListener('mousedown', container._closeChartPopover)
      container._closeChartPopover = e => {
        if (!popover.contains(e.target) && e.target !== optBtn) popover.classList.remove('open')
      }
      document.addEventListener('mousedown', container._closeChartPopover)
    }

    const vimsCard = container.querySelector('#dasha-panel-vimshottari')
    if (vimsCard) {
      vimsCard.addEventListener('change', e => {
        if (e.target.name === 'dasha-panel-mode') {
          const ui = chartD()
          ui.focusedMode = e.target.value === 'focused'
          if (ui.focusedMode) ui.focusedPath = inferFocusedPath(dasha, ui)
          buildDashaRows(state.dasha, ui).then(rows => {
            container.querySelector('.dasha-table tbody').innerHTML = rows
            container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
              ui.focusedMode && ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
          }).catch(console.error)
        }
        if (e.target.id === 'dasha-panel-year-method') {
          const yearMethod = e.target.value
          saveSettings({ yearMethod })
          if (yearMethod !== 'custom') {
            import('../tabs/input.js').then(m => m.recalcAll()).catch(console.error)
          }
        }
      })

      const customDaysInput = container.querySelector('#dasha-panel-custom-days')
      if (customDaysInput) {
        customDaysInput.addEventListener('input', () => {
          clearTimeout(_customDaysTimer)
          _customDaysTimer = setTimeout(() => {
            const v = parseFloat(customDaysInput.value)
            if (v >= 300 && v <= 400) {
              saveSettings({ customYearDays: v })
              import('../tabs/input.js').then(m => m.recalcAll()).catch(console.error)
            }
          }, 600)
        })
      }
    }

    container.querySelector('#dasha-panel-breadcrumb-wrap')?.addEventListener('click', e => {
      const crumbBtn = e.target.closest('[data-crumb-depth]')
      if (!crumbBtn) return
      const depth = parseInt(crumbBtn.dataset.crumbDepth)
      ui.focusedPath = depth < 0 ? [] : (ui.focusedPath ?? []).slice(0, depth + 1)
      buildDashaRows(state.dasha, ui).then(rows => {
        container.querySelector('.dasha-table tbody').innerHTML = rows
        container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
          ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
      }).catch(console.error)
    })

    container.querySelector('.dasha-table tbody')?.addEventListener('click', async (e) => {
      const row = e.target.closest('tr[data-toggle]')
      if (!row) return
      const ui    = chartD()
      const path  = row.dataset.path
      const depth = parseInt(row.dataset.depth)
      const parts = path.split('/')

      if (ui.focusedMode ?? true) {
        const fp = ui.focusedPath ?? []
        const isExpanded = fp.length > depth && fp[depth] === parts[depth]
        ui.focusedPath = isExpanded ? fp.slice(0, depth) : parts.slice(0, depth + 1)
        const rows = await buildDashaRows(state.dasha, ui)
        container.querySelector('.dasha-table tbody').innerHTML = rows
        container.querySelector('#dasha-panel-breadcrumb-wrap').innerHTML =
          ui.focusedPath?.length > 0 ? renderBreadcrumb(state.dasha, ui) : ''
        return
      }

      // Full mode: DOM-mutation behaviour
      let node = state.dasha.find(m => m.planet === parts[0])
      for (let i = 1; i < parts.length; i++) {
        node = node?.children.find(c => c.planet === parts[i])
      }
      if (!node) return

      const tbody    = row.closest('tbody')
      const allRows  = Array.from(tbody.querySelectorAll('tr'))
      const nextIdx  = allRows.indexOf(row) + 1
      const hasChild = nextIdx < allRows.length && parseInt(allRows[nextIdx].dataset.depth ?? '-1') === depth + 1
      const opening  = !hasChild

      if (opening) {
        insertChildRows(row, node, depth).catch(console.error)
      } else {
        removeChildRows(row)
      }
      setArrow(row, opening)

      if (depth === 0) {
        const mahaName = path
        if (opening) ui.expandedMahas.add(mahaName)
        else {
          ui.expandedMahas.delete(mahaName)
          ui.expandedAntars.delete(mahaName)
          for (const p of ui.expandedPaths) {
            if (p.startsWith(mahaName + '/')) ui.expandedPaths.delete(p)
          }
        }
      } else if (depth === 1) {
        const mahaName = parts[0]
        if (!ui.expandedAntars.has(mahaName)) ui.expandedAntars.set(mahaName, new Set())
        if (opening) ui.expandedAntars.get(mahaName).add(parts[1])
        else {
          ui.expandedAntars.get(mahaName).delete(parts[1])
          for (const p of ui.expandedPaths) {
            if (p.startsWith(path + '/')) ui.expandedPaths.delete(p)
          }
        }
      } else {
        if (opening) ui.expandedPaths.add(path)
        else {
          ui.expandedPaths.delete(path)
          for (const p of ui.expandedPaths) {
            if (p.startsWith(path + '/')) ui.expandedPaths.delete(p)
          }
        }
      }
    })
  }

  // Wire up toggle buttons for age and progression cards (collapse/expand)
  container.querySelector('#age-toggle-btn')?.addEventListener('click', e => {
    const ui = chartD()
    ui.ageCollapsed = !ui.ageCollapsed
    container.querySelector('#age-prog-body').style.display = ui.ageCollapsed ? 'none' : ''
    e.target.textContent = ui.ageCollapsed ? '▶' : '▼'
  })
  container.querySelector('#prog-toggle-btn')?.addEventListener('click', e => {
    const ui = chartD()
    ui.progCollapsed = !ui.progCollapsed
    container.querySelector('#prog-body').style.display = ui.progCollapsed ? 'none' : ''
    e.target.textContent = ui.progCollapsed ? '▶' : '▼'
  })
  container.addEventListener('click', e => {
    const btn = e.target.closest('button')
    if (!btn) return
    const ui = chartD()

    if (btn.id === 'age-prev-btn') {
      const curCycle = ui.ageNavCycle ?? Math.floor(calcAgeYearsFromDob(birth.dob) / 12)
      ui.ageNavCycle = Math.max(0, curCycle - 1)
      ui.ageAsOf = null
      container.querySelector('#age-prog-section').outerHTML = renderAgeProgression(birth.dob, offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12)).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    } else if (btn.id === 'age-next-btn') {
      const curCycle = ui.ageNavCycle ?? Math.floor(calcAgeYearsFromDob(birth.dob) / 12)
      ui.ageNavCycle = Math.min(9, curCycle + 1)
      ui.ageAsOf = null
      container.querySelector('#age-prog-section').outerHTML = renderAgeProgression(birth.dob, offsetYearsFromDob(birth.dob, ui.ageNavCycle * 12)).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    } else if (btn.id === 'age-reset-today') {
      ui.ageNavCycle = null
      ui.ageAsOf = null
      container.querySelector('#age-prog-section').outerHTML = renderAgeProgression(birth.dob, new Date()).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    } else if (btn.id === 'prog-prev-btn') {
      ui.progNavIndex = Math.max(0, (ui.progNavIndex ?? 0) - 1)
      ui.selectedProgLord = dasha[ui.progNavIndex].planet
      container.querySelector('#prog-section').outerHTML = renderProgression(birth.dob, dasha).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    } else if (btn.id === 'prog-next-btn') {
      ui.progNavIndex = Math.min(dasha.length - 1, (ui.progNavIndex ?? 0) + 1)
      ui.selectedProgLord = dasha[ui.progNavIndex].planet
      container.querySelector('#prog-section').outerHTML = renderProgression(birth.dob, dasha).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    }
  })
  container.onchange = e => {
    if (e.target.id === 'age-asof-input') {
      const ui = chartD()
      ui.ageAsOf = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
      ui.ageNavCycle = null
      container.querySelector('#age-prog-section').outerHTML = renderAgeProgression(birth.dob, ui.ageAsOf ?? new Date()).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    } else if (e.target.id === 'prog-lord-select') {
      const ui = chartD()
      ui.selectedProgLord = e.target.value
      ui.progNavIndex = dasha.findIndex(m => m.planet === ui.selectedProgLord)
      container.querySelector('#prog-section').outerHTML = renderProgression(birth.dob, dasha).replace(' draggable="true"', '').replace('<span class="drag-handle" title="Drag to reorder">⠿</span>', '')
    }
  }
}

const LEVEL_LABELS = ['MD','AD','PD','SD','PrD','DeD']
const INDENT = ['0.5rem','1.8rem','3.1rem','4.4rem','5.7rem','7.0rem']

async function buildDashaRows(dasha, ui) {
  const swe         = getSwe()
  const flags       = buildCalcFlags(getSettings())
  const rows        = []
  const focusedMode = ui.focusedMode ?? true

  if (!focusedMode) {
    // ── FULL MODE: unchanged behaviour ──────────────────────────────────────
    for (const maha of dasha) {
      const isCur0    = isCurrentPeriod(maha.start, maha.end)
      const expanded0 = ui.expandedMahas.has(maha.planet)
      rows.push(makeMdRow(maha, expanded0, isCur0))

      if (!expanded0) continue
      await ensureChildren(maha, swe, flags)
      for (const antar of maha.children) {
        const path1     = `${maha.planet}/${antar.planet}`
        const isCur1    = isCurrentPeriod(antar.start, antar.end)
        const expanded1 = ui.expandedAntars.get(maha.planet)?.has(antar.planet) ?? false
        rows.push(makeRow(antar, path1, 1, expanded1, isCur1, isCur1))

        if (!expanded1) continue
        await ensureChildren(antar, swe, flags)
        for (const prat of antar.children) {
          const path2     = `${path1}/${prat.planet}`
          const isCur2    = isCurrentPeriod(prat.start, prat.end)
          const expanded2 = ui.expandedPaths.has(path2)
          rows.push(makeRow(prat, path2, 2, expanded2, isCur2))

          if (!expanded2) continue
          await ensureChildren(prat, swe, flags)
          for (const sook of prat.children) {
            const path3     = `${path2}/${sook.planet}`
            const isCur3    = isCurrentPeriod(sook.start, sook.end)
            const expanded3 = ui.expandedPaths.has(path3)
            rows.push(makeRow(sook, path3, 3, expanded3, isCur3))

            if (!expanded3) continue
            await ensureChildren(sook, swe, flags)
            for (const prana of sook.children) {
              const path4     = `${path3}/${prana.planet}`
              const isCur4    = isCurrentPeriod(prana.start, prana.end)
              const expanded4 = ui.expandedPaths.has(path4)
              rows.push(makeRow(prana, path4, 4, expanded4, isCur4))

              if (!expanded4) continue
              await ensureChildren(prana, swe, flags)
              for (const deha of prana.children) {
                const path5  = `${path4}/${deha.planet}`
                const isCur5 = isCurrentPeriod(deha.start, deha.end)
                rows.push(makeLeafRow(deha, path5, isCur5))
              }
            }
          }
        }
      }
    }
    return rows.join('')
  }

  // ── FOCUSED MODE ──────────────────────────────────────────────────────────
  const fp = ui.focusedPath ?? []
  // fp = []         → show all MDs collapsed
  // fp = [md]       → show only that MD expanded (all its ADs)
  // fp = [md, ad]   → show that MD (only that AD visible) + that AD expanded (all its PDs)
  // etc.

  if (fp.length === 0) {
    // All MDs, all collapsed
    for (const maha of dasha) {
      rows.push(makeMdRow(maha, false, isCurrentPeriod(maha.start, maha.end)))
    }
    return rows.join('')
  }

  // Render the focused MD row (expanded)
  const focusedMD = dasha.find(m => m.planet === fp[0])
  if (!focusedMD) return rows.join('')
  rows.push(makeMdRow(focusedMD, true, isCurrentPeriod(focusedMD.start, focusedMD.end)))

  await ensureChildren(focusedMD, swe, flags)

  if (fp.length === 1) {
    // Show all ADs of this MD
    for (const antar of focusedMD.children) {
      const path1  = `${fp[0]}/${antar.planet}`
      const isCur1 = isCurrentPeriod(antar.start, antar.end)
      rows.push(makeRow(antar, path1, 1, false, isCur1, isCur1))
    }
    return rows.join('')
  }

  // Render the focused AD row (expanded), all other ADs hidden
  const focusedAD = focusedMD.children.find(a => a.planet === fp[1])
  if (!focusedAD) return rows.join('')
  const path1AD = `${fp[0]}/${fp[1]}`
  rows.push(makeRow(focusedAD, path1AD, 1, true, isCurrentPeriod(focusedAD.start, focusedAD.end), isCurrentPeriod(focusedAD.start, focusedAD.end)))

  await ensureChildren(focusedAD, swe, flags)

  if (fp.length === 2) {
    for (const prat of focusedAD.children) {
      const path2  = `${path1AD}/${prat.planet}`
      const isCur2 = isCurrentPeriod(prat.start, prat.end)
      rows.push(makeRow(prat, path2, 2, false, isCur2))
    }
    return rows.join('')
  }

  // Render focused PD row (expanded), all other PDs hidden
  const focusedPD = focusedAD.children.find(p => p.planet === fp[2])
  if (!focusedPD) return rows.join('')
  const path2PD = `${path1AD}/${fp[2]}`
  rows.push(makeRow(focusedPD, path2PD, 2, true, isCurrentPeriod(focusedPD.start, focusedPD.end)))

  await ensureChildren(focusedPD, swe, flags)

  if (fp.length === 3) {
    for (const sook of focusedPD.children) {
      const path3  = `${path2PD}/${sook.planet}`
      const isCur3 = isCurrentPeriod(sook.start, sook.end)
      rows.push(makeRow(sook, path3, 3, false, isCur3))
    }
    return rows.join('')
  }

  // Render focused SD row (expanded), all other SDs hidden
  const focusedSD = focusedPD.children.find(s => s.planet === fp[3])
  if (!focusedSD) return rows.join('')
  const path3SD = `${path2PD}/${fp[3]}`
  rows.push(makeRow(focusedSD, path3SD, 3, true, isCurrentPeriod(focusedSD.start, focusedSD.end)))

  await ensureChildren(focusedSD, swe, flags)

  if (fp.length === 4) {
    for (const prana of focusedSD.children) {
      const path4  = `${path3SD}/${prana.planet}`
      const isCur4 = isCurrentPeriod(prana.start, prana.end)
      rows.push(makeRow(prana, path4, 4, false, isCur4))
    }
    return rows.join('')
  }

  // Render focused PrD row (expanded), all other PrDs hidden
  const focusedPrD = focusedSD.children.find(p => p.planet === fp[4])
  if (!focusedPrD) return rows.join('')
  const path4PrD = `${path3SD}/${fp[4]}`
  rows.push(makeRow(focusedPrD, path4PrD, 4, true, isCurrentPeriod(focusedPrD.start, focusedPrD.end)))

  await ensureChildren(focusedPrD, swe, flags)
  for (const deha of focusedPrD.children) {
    const path5  = `${path4PrD}/${deha.planet}`
    const isCur5 = isCurrentPeriod(deha.start, deha.end)
    rows.push(makeLeafRow(deha, path5, isCur5))
  }

  return rows.join('')
}

function makeMdRow(node, expanded, isCurrent) {
  return `<tr data-toggle data-depth="0" data-path="${node.planet}" class="dasha-d0${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:0.5rem">${expanded ? '▼' : '▶'} <strong>${node.planet}</strong> <span class="dasha-level-label">MD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}

function makeRow(node, path, depth, expanded, isCurrent, isNow = false) {
  const label = LEVEL_LABELS[depth]
  const indent = INDENT[depth]
  const startCell = fmt(node.start)
  const endCell   = fmt(node.end)
  const nowBadge  = isNow ? ' <span class="dasha-now-badge">★ now</span>' : ''
  return `<tr data-toggle data-depth="${depth}" data-path="${path}" class="dasha-d${depth}${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${indent}">${expanded ? '▼' : '▶'} ${node.planet}${nowBadge} <span class="dasha-level-label">${label}</span></td>
    <td>${startCell}</td><td>${endCell}</td></tr>`
}

function makeLeafRow(node, path, isCurrent) {
  return `<tr data-depth="5" data-path="${path}" class="dasha-d5${isCurrent ? ' current-period' : ''}">
    <td style="padding-left:${INDENT[5]}">${node.planet} <span class="dasha-level-label">DeD</span></td>
    <td>${fmt(node.start)}</td><td>${fmt(node.end)}</td></tr>`
}

// Lazily compute children of node and insert their <tr> elements after parentRow.
async function insertChildRows(parentRow, node, depth) {
  await ensureChildren(node, getSwe(), buildCalcFlags(getSettings()))

  const childDepth = depth + 1
  const isLeaf     = childDepth === 5
  const path       = parentRow.dataset.path

  const fragment = document.createDocumentFragment()
  for (const child of node.children) {
    const childPath = `${path}/${child.planet}`
    const isCur     = isCurrentPeriod(child.start, child.end)
    const tr        = document.createElement('tr')
    tr.dataset.depth = String(childDepth)
    tr.dataset.path  = childPath
    if (!isLeaf) tr.dataset.toggle = ''
    tr.className = `dasha-d${childDepth}${isCur ? ' current-period' : ''}`
    const startCell = fmt(child.start)
    const endCell   = fmt(child.end)
    const label     = LEVEL_LABELS[childDepth]
    const indent    = INDENT[childDepth]
    const arrow     = isLeaf ? '' : '▶ '
    tr.innerHTML = `<td style="padding-left:${indent}">${arrow}${child.planet} <span class="dasha-level-label">${label}</span></td><td>${startCell}</td><td>${endCell}</td>`
    fragment.appendChild(tr)
  }

  parentRow.after(fragment)
}

// Remove all descendant rows of parentRow from the DOM.
function removeChildRows(parentRow) {
  const parentDepth = parseInt(parentRow.dataset.depth)
  const tbody       = parentRow.closest('tbody')
  const allRows     = Array.from(tbody.querySelectorAll('tr'))
  const parentIdx   = allRows.indexOf(parentRow)
  const toRemove    = []
  for (let i = parentIdx + 1; i < allRows.length; i++) {
    const d = parseInt(allRows[i].dataset.depth ?? '-1')
    if (d <= parentDepth) break
    toRemove.push(allRows[i])
  }
  toRemove.forEach(r => r.remove())
}

function setArrow(row, open) {
  const td = row.querySelector('td')
  if (!td) return
  const textNode = td.firstChild
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    textNode.textContent = textNode.textContent.replace(/^[▶▼] /, open ? '▼ ' : '▶ ')
  }
}

function getTzOffsetMs() {
  const tz = state.birth?.timezone ?? '+00:00'
  const m = tz.match(/^([+-])(\d{1,2}):(\d{2})$/)
  if (!m) return 0
  const mins = parseInt(m[2]) * 60 + parseInt(m[3])
  return (m[1] === '+' ? 1 : -1) * mins * 60000
}

function renderBreadcrumb(dasha, ui) {
  const fp = ui.focusedPath ?? []

  // Build time-left annotation when the focused AD is the current period AD
  let timeLeft = ''
  if (fp.length >= 2) {
    const md = dasha.find(m => m.planet === fp[0])
    const ad = md?.children?.find(a => a.planet === fp[1])
    if (ad && isCurrentPeriod(ad.start, ad.end)) {
      const daysLeft = Math.round((ad.end - new Date()) / 86400000)
      if (daysLeft >= 30) timeLeft = `· ${Math.round(daysLeft / 30.4)}mo left in AD`
      else if (daysLeft > 0) timeLeft = `· ${daysLeft}d left in AD`
    }
  }

  const LEVEL_CRUMB = ['MD','AD','PD','SD','PrD']

  let chips = `<button class="dasha-crumb-btn${fp.length === 0 ? ' active' : ''}" data-crumb-depth="-1">All MDs</button>`

  for (let i = 0; i < fp.length; i++) {
    const abbr    = PLANET_ABBR[fp[i]] ?? fp[i]
    const label   = LEVEL_CRUMB[i] ?? ''
    const isLast  = i === fp.length - 1
    chips += `<span class="dasha-crumb-sep">›</span>`
    chips += `<button class="dasha-crumb-btn${isLast ? ' active' : ''}" data-crumb-depth="${i}">${abbr} <span class="dasha-level-label">${label}</span></button>`
  }

  if (timeLeft) chips += `<span class="dasha-crumb-sep">${timeLeft}</span>`

  return `<div class="dasha-breadcrumb">${chips}</div>`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmt(date) {
  const d = new Date(date.getTime() + getTzOffsetMs()).toISOString()
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${y}-${MONTHS[+m - 1]}-${day} <span class="dasha-time">${d.slice(11, 16)}</span>`
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
