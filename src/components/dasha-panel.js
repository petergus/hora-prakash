// src/components/dasha-panel.js
// Self-contained dasha component. Each instance owns its DOM scope and state.
// Instantiate with (el, getStateFn) — state lives in the session, not the instance.

import { getSwe } from '../core/swisseph.js'
import {
  getSettings, saveSettings, buildCalcFlags,
  YEAR_METHOD_OPTIONS, AYANAMSA_OPTIONS,
} from '../core/settings.js'
import {
  isCurrentPeriod, calcDashaProgression,
  calcHouseActiveFromAge, calcAgeComponents,
  DASHA_YEARS, ensureChildren,
} from '../core/dasha.js'
import { PLANET_COLORS } from '../core/aspects.js'
import { state } from '../state.js'
import { toJulianDay } from '../utils/time.js'

const PLANET_ABBR = {
  Ketu:'Ke', Venus:'Ve', Sun:'Su', Moon:'Mo', Mars:'Ma',
  Rahu:'Ra', Jupiter:'Ju', Saturn:'Sa', Mercury:'Me',
}
const LEVEL_LABELS  = ['MD','AD','PD','SD','PrD','DeD']
const LEVEL_CRUMB   = ['MD','AD','PD','SD','PrD']
const INDENT        = ['0.5rem','1.8rem','3.1rem','4.4rem','5.7rem','7.0rem']
const MONTHS        = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export class DashaPanel {
  constructor(el, getState) {
    this.el = el
    this._getState   = getState
    this._timer      = null
    // stored handlers for removeEventListener on destroy
    this._onClick    = null
    this._onChange   = null
    this._onInput    = null
    this._closePopover = null
  }

  get ui() { return this._getState() }

  destroy() {
    if (this._onClick)      this.el.removeEventListener('click',  this._onClick)
    if (this._onChange)     this.el.removeEventListener('change', this._onChange)
    if (this._onInput)      this.el.removeEventListener('input',  this._onInput)
    if (this._closePopover) document.removeEventListener('mousedown', this._closePopover)
    this._onClick = this._onChange = this._onInput = this._closePopover = null
  }

  async render(dasha, birth, { cards = ['vimshottari'], draggable = false } = {}) {
    this.destroy() // clear any previous listeners before re-rendering

    this._dasha    = dasha
    this._birth    = birth
    this._cards    = cards
    this._draggable = draggable

    const ui = this.ui
    if (ui.selectedProgLord === null) {
      const cur = dasha.find(m => isCurrentPeriod(m.start, m.end)) ?? dasha[0]
      ui.selectedProgLord = cur.planet
      ui.progNavIndex = dasha.findIndex(m => m.planet === ui.selectedProgLord)
    }

    let html = ''
    if (cards.includes('vimshottari')) {
      const rows = await this._buildDashaRows(dasha, ui)
      html += this._vimsHtml(dasha, birth, ui, rows, draggable)
    }
    if (cards.includes('age')) {
      const ref = ui.ageAsOf
        ?? (ui.ageNavCycle !== null ? this._offsetYears(birth.dob, ui.ageNavCycle * 12) : new Date())
      html += this._ageHtml(birth.dob, ref, draggable)
    }
    if (cards.includes('progression')) {
      html += this._progHtml(birth.dob, dasha, draggable)
    }

    this.el.innerHTML = draggable
      ? `<div class="prog-drag-container" data-drag-root>${html}</div>`
      : html

    this._wireEvents()
    if (draggable) this._initDragReorder()
  }

  // ── Partial re-renders (scoped to this.el) ─────────────────────────────────

  async _refreshVims(dasha, ui) {
    const rows = await this._buildDashaRows(dasha, ui)
    const tbody = this.el.querySelector('[data-vims-body] .dasha-table tbody')
    if (tbody) tbody.innerHTML = rows
    const bw = this.el.querySelector('[data-breadcrumb-wrap]')
    if (bw) {
      const fp = ui.focusedPath ?? []
      bw.innerHTML = (ui.focusedMode ?? true) && fp.length > 0
        ? `<div class="dasha-breadcrumb">${this._breadcrumbHtml(dasha, ui)}</div>`
        : ''
    }
  }

  _refreshAge(dobStr, asOf) {
    const section = this.el.querySelector('[data-age-section]')
    if (!section) return
    section.outerHTML = this._ageHtml(dobStr, asOf, this._draggable)
    // no need to re-wire — event delegation from this.el still works
  }

  _refreshProg(dobStr, dasha) {
    const section = this.el.querySelector('[data-prog-section]')
    if (!section) return
    section.outerHTML = this._progHtml(dobStr, dasha, this._draggable)
  }

  // ── HTML builders ──────────────────────────────────────────────────────────

  _vimsHtml(dasha, birth, ui, rows, draggable) {
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

    const customRow = yearMethod === 'custom' ? `
      <div class="dasha-options-row">
        <span>Days/yr:</span>
        <input data-custom-days type="number" min="300" max="400" step="0.001" value="${customYearDays}" style="width:6rem">
      </div>` : ''

    const breadcrumbInner = (focused && (ui.focusedPath?.length > 0))
      ? `<div class="dasha-breadcrumb">${this._breadcrumbHtml(dasha, ui)}</div>` : ''

    return `
      <div class="card${draggable ? ' prog-draggable' : ''}" data-vims-card${draggable ? ' id="dasha-section" draggable="true"' : ''}>
        <div class="prog-card-header">
          <div class="prog-card-title" style="position:relative">
            ${draggable ? '<span class="drag-handle" title="Drag to reorder">⠿</span>' : ''}
            <button data-toggle-vims class="toggle-btn">${ui.dashaCollapsed ? '▶' : '▼'}</button>
            <h3>${draggable ? `Vimshottari Dasha — ${birth.name}` : 'Vimshottari Dasha'}</h3>
            <button data-options-btn class="dasha-options-btn" title="Options">⋮</button>
            <div class="dasha-options-popover" data-options-popover>
              <div class="dasha-options-row">
                <span>Mode:</span>
                <div class="dasha-mode-radios">
                  <label><input type="radio" name="dasha-mode" value="focused" ${focused ? 'checked' : ''}> Focused</label>
                  <label><input type="radio" name="dasha-mode" value="full"    ${!focused ? 'checked' : ''}> Full</label>
                </div>
              </div>
              <div class="dasha-options-row">
                <span>Year:</span>
                <select data-year-method>${yearOptions}</select>
              </div>
              ${customRow}
              <div class="dasha-options-info">Ayanamsa: <strong>${ayanamsaName}</strong>${ayanamsaVal} · TZ: ${state.birth?.timezone ?? 'UTC'}</div>
            </div>
          </div>
        </div>
        <div data-vims-body style="display:${ui.dashaCollapsed ? 'none' : ''}">
          <div data-breadcrumb-wrap>${breadcrumbInner}</div>
          <div class="table-scroll"><table class="dasha-table">
            <thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
      </div>`
  }

  _ageHtml(dobStr, asOf, draggable) {
    const ui = this.ui
    const { years, months, days } = calcAgeComponents(dobStr, asOf)
    const houseActive = calcHouseActiveFromAge(dobStr, asOf)
    const todayStr = new Date().toISOString().slice(0, 10)
    const asOfStr  = asOf instanceof Date ? asOf.toISOString().slice(0, 10) : todayStr
    const isToday  = asOfStr === todayStr
    const shownCycle = Math.floor(years / 12)

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
      <div class="card${draggable ? ' prog-draggable' : ''}" data-age-section${draggable ? ' draggable="true"' : ''}>
        <div class="prog-card-header">
          <div class="prog-card-title">
            ${draggable ? '<span class="drag-handle" title="Drag to reorder">⠿</span>' : ''}
            <button data-toggle-age class="toggle-btn">${ui.ageCollapsed ? '▶' : '▼'}</button>
            <h3>Age Progression</h3>
          </div>
          <div class="prog-card-controls">
            <button data-age-prev class="prog-nav-btn" ${shownCycle <= 0 ? 'disabled' : ''}>←</button>
            <span style="font-size:0.78rem;color:var(--muted);min-width:4rem;text-align:center">Cycle ${shownCycle + 1}</span>
            <button data-age-next class="prog-nav-btn" ${shownCycle >= 9 ? 'disabled' : ''}>→</button>
            <span style="font-size:0.78rem;color:var(--muted)">As of:</span>
            <input type="date" data-age-asof value="${asOfStr}"
              style="font-size:0.82rem;padding:0.2rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);min-width:0;flex:1 1 auto;max-width:160px" />
            ${!isToday ? `<button data-age-reset class="prog-nav-btn">Today</button>` : ''}
          </div>
        </div>
        <div data-age-body style="display:${ui.ageCollapsed ? 'none' : ''}">
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

  _progHtml(dobStr, dasha, draggable) {
    const ui = this.ui
    const rashiByName = Object.fromEntries((state.planets ?? []).map(p => [p.name, p]))
    const lordHouse   = rashiByName[ui.selectedProgLord]?.house ?? 1
    const mdYears     = DASHA_YEARS[ui.selectedProgLord] ?? 1
    const mdEntry     = dasha.find(m => m.planet === ui.selectedProgLord)
    const mdStart     = mdEntry?.start ?? new Date()

    const periods = calcDashaProgression(lordHouse, mdStart, mdYears)
    const currentMaha = dasha.find(m => isCurrentPeriod(m.start, m.end))
    const isCurrentMD = currentMaha?.planet === ui.selectedProgLord
    const activePeriod = isCurrentMD ? periods.find(p => p.isActive) : null

    const atMin = (ui.progNavIndex ?? 0) <= 0
    const atMax = (ui.progNavIndex ?? 0) >= dasha.length - 1

    const lordOptions = dasha.map(m => {
      const h = rashiByName[m.planet]?.house ?? '?'
      return `<option value="${m.planet}"${m.planet === ui.selectedProgLord ? ' selected' : ''}>${m.planet} — H${h}</option>`
    }).join('')

    const periodRows = periods.map(p => {
      const showActive = isCurrentMD && p.isActive
      return `<tr class="${showActive ? 'current-period' : ''}">
        <td style="text-align:center">${p.houseFromMDL}</td>
        <td style="text-align:center;font-weight:${showActive ? '700' : '400'}">H${p.progressionHouse} <span style="color:var(--muted);font-size:0.75em">(P)</span></td>
        <td style="text-align:center;color:var(--muted)">H${p.regressionHouse} <span style="font-size:0.75em">(R)</span></td>
        <td>${this._fmt(p.start)}</td>
        <td>${this._fmt(p.end)}</td>
        <td style="text-align:center">${showActive ? '★ Active' : ''}</td>
      </tr>`
    }).join('')

    const lordColor  = PLANET_COLORS[PLANET_ABBR[ui.selectedProgLord]] ?? '#94a3b8'
    const activeBadge = activePeriod
      ? `<span class="prog-meta-sep">·</span><span class="age-active-badge" style="font-size:0.78rem">★ H${activePeriod.progressionHouse}(P) · H${activePeriod.regressionHouse}(R) active</span>`
      : ''

    return `
      <div class="card${draggable ? ' prog-draggable' : ''}" data-prog-section${draggable ? ' draggable="true"' : ''}>
        <div class="prog-card-header">
          <div class="prog-card-title">
            ${draggable ? '<span class="drag-handle" title="Drag to reorder">⠿</span>' : ''}
            <button data-toggle-prog class="toggle-btn">${ui.progCollapsed ? '▶' : '▼'}</button>
            <h3>Dasha Progression</h3>
          </div>
          <div class="prog-card-controls">
            <button data-prog-prev class="prog-nav-btn" ${atMin ? 'disabled' : ''}>←</button>
            <button data-prog-next class="prog-nav-btn" ${atMax ? 'disabled' : ''}>→</button>
            <span style="font-size:0.78rem;color:var(--muted)">MD Lord:</span>
            <select data-prog-lord class="div-select" style="font-size:0.82rem;padding:0.2rem 0.5rem;flex:1 1 auto;min-width:0;max-width:200px">${lordOptions}</select>
          </div>
        </div>
        <div data-prog-body style="display:${ui.progCollapsed ? 'none' : ''}">
          <div class="prog-meta">
            <span class="planet-dot" style="background:${lordColor}"></span>
            <span>${ui.selectedProgLord} in H${lordHouse}</span>
            <span class="prog-meta-sep">·</span>
            <span>${mdYears} months per house</span>
            <span class="prog-meta-sep">·</span>
            <span>MD ${this._fmt(mdStart)} – ${this._fmt(mdEntry?.end ?? mdStart)}</span>
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

  _breadcrumbHtml(dasha, ui) {
    const fp = ui.focusedPath ?? []
    let timeLeft = ''
    if (fp.length >= 2) {
      const md = dasha.find(m => m.planet === fp[0])
      const ad = md?.children?.find(a => a.planet === fp[1])
      if (ad && isCurrentPeriod(ad.start, ad.end)) {
        const daysLeft = Math.round((ad.end - new Date()) / 86400000)
        if (daysLeft >= 30)   timeLeft = `· ${Math.round(daysLeft / 30.4)}mo left in AD`
        else if (daysLeft > 0) timeLeft = `· ${daysLeft}d left in AD`
      }
    }
    let chips = `<button class="dasha-crumb-btn${fp.length === 0 ? ' active' : ''}" data-crumb="-1">All MDs</button>`
    for (let i = 0; i < fp.length; i++) {
      const abbr   = PLANET_ABBR[fp[i]] ?? fp[i]
      const isLast = i === fp.length - 1
      chips += `<span class="dasha-crumb-sep">›</span>`
      chips += `<button class="dasha-crumb-btn${isLast ? ' active' : ''}" data-crumb="${i}">${abbr} <span class="dasha-level-label">${LEVEL_CRUMB[i] ?? ''}</span></button>`
    }
    if (timeLeft) chips += `<span class="dasha-crumb-sep">${timeLeft}</span>`
    return chips
  }

  // ── Dasha table rows ───────────────────────────────────────────────────────

  async _buildDashaRows(dasha, ui) {
    const swe        = getSwe()
    const flags      = buildCalcFlags(getSettings())
    const rows       = []
    const focused    = ui.focusedMode ?? true

    if (!focused) {
      for (const maha of dasha) {
        const isCur0    = isCurrentPeriod(maha.start, maha.end)
        const expanded0 = ui.expandedMahas.has(maha.planet)
        rows.push(this._makeMdRow(maha, expanded0, isCur0))
        if (!expanded0) continue
        await ensureChildren(maha, swe, flags)
        for (const antar of maha.children) {
          const path1     = `${maha.planet}/${antar.planet}`
          const isCur1    = isCurrentPeriod(antar.start, antar.end)
          const expanded1 = ui.expandedAntars.get(maha.planet)?.has(antar.planet) ?? false
          rows.push(this._makeRow(antar, path1, 1, expanded1, isCur1, isCur1))
          if (!expanded1) continue
          await ensureChildren(antar, swe, flags)
          for (const prat of antar.children) {
            const path2     = `${path1}/${prat.planet}`
            const isCur2    = isCurrentPeriod(prat.start, prat.end)
            const expanded2 = ui.expandedPaths.has(path2)
            rows.push(this._makeRow(prat, path2, 2, expanded2, isCur2))
            if (!expanded2) continue
            await ensureChildren(prat, swe, flags)
            for (const sook of prat.children) {
              const path3     = `${path2}/${sook.planet}`
              const isCur3    = isCurrentPeriod(sook.start, sook.end)
              const expanded3 = ui.expandedPaths.has(path3)
              rows.push(this._makeRow(sook, path3, 3, expanded3, isCur3))
              if (!expanded3) continue
              await ensureChildren(sook, swe, flags)
              for (const prana of sook.children) {
                const path4     = `${path3}/${prana.planet}`
                const isCur4    = isCurrentPeriod(prana.start, prana.end)
                const expanded4 = ui.expandedPaths.has(path4)
                rows.push(this._makeRow(prana, path4, 4, expanded4, isCur4))
                if (!expanded4) continue
                await ensureChildren(prana, swe, flags)
                for (const deha of prana.children) {
                  const path5  = `${path4}/${deha.planet}`
                  const isCur5 = isCurrentPeriod(deha.start, deha.end)
                  rows.push(this._makeLeafRow(deha, path5, isCur5))
                }
              }
            }
          }
        }
      }
      return rows.join('')
    }

    // Focused mode
    const fp = ui.focusedPath ?? []

    if (fp.length === 0) {
      for (const maha of dasha) rows.push(this._makeMdRow(maha, false, isCurrentPeriod(maha.start, maha.end)))
      return rows.join('')
    }

    const focusedMD = dasha.find(m => m.planet === fp[0])
    if (!focusedMD) return rows.join('')
    rows.push(this._makeMdRow(focusedMD, true, isCurrentPeriod(focusedMD.start, focusedMD.end)))
    await ensureChildren(focusedMD, swe, flags)

    if (fp.length === 1) {
      for (const antar of focusedMD.children) {
        const path1  = `${fp[0]}/${antar.planet}`
        rows.push(this._makeRow(antar, path1, 1, false, isCurrentPeriod(antar.start, antar.end), isCurrentPeriod(antar.start, antar.end)))
      }
      return rows.join('')
    }

    const focusedAD = focusedMD.children.find(a => a.planet === fp[1])
    if (!focusedAD) return rows.join('')
    const path1AD = `${fp[0]}/${fp[1]}`
    rows.push(this._makeRow(focusedAD, path1AD, 1, true, isCurrentPeriod(focusedAD.start, focusedAD.end), isCurrentPeriod(focusedAD.start, focusedAD.end)))
    await ensureChildren(focusedAD, swe, flags)

    if (fp.length === 2) {
      for (const prat of focusedAD.children) {
        const path2 = `${path1AD}/${prat.planet}`
        rows.push(this._makeRow(prat, path2, 2, false, isCurrentPeriod(prat.start, prat.end)))
      }
      return rows.join('')
    }

    const focusedPD = focusedAD.children.find(p => p.planet === fp[2])
    if (!focusedPD) return rows.join('')
    const path2PD = `${path1AD}/${fp[2]}`
    rows.push(this._makeRow(focusedPD, path2PD, 2, true, isCurrentPeriod(focusedPD.start, focusedPD.end)))
    await ensureChildren(focusedPD, swe, flags)

    if (fp.length === 3) {
      for (const sook of focusedPD.children) {
        const path3 = `${path2PD}/${sook.planet}`
        rows.push(this._makeRow(sook, path3, 3, false, isCurrentPeriod(sook.start, sook.end)))
      }
      return rows.join('')
    }

    const focusedSD = focusedPD.children.find(s => s.planet === fp[3])
    if (!focusedSD) return rows.join('')
    const path3SD = `${path2PD}/${fp[3]}`
    rows.push(this._makeRow(focusedSD, path3SD, 3, true, isCurrentPeriod(focusedSD.start, focusedSD.end)))
    await ensureChildren(focusedSD, swe, flags)

    if (fp.length === 4) {
      for (const prana of focusedSD.children) {
        const path4 = `${path3SD}/${prana.planet}`
        rows.push(this._makeRow(prana, path4, 4, false, isCurrentPeriod(prana.start, prana.end)))
      }
      return rows.join('')
    }

    const focusedPrD = focusedSD.children.find(p => p.planet === fp[4])
    if (!focusedPrD) return rows.join('')
    const path4PrD = `${path3SD}/${fp[4]}`
    rows.push(this._makeRow(focusedPrD, path4PrD, 4, true, isCurrentPeriod(focusedPrD.start, focusedPrD.end)))
    await ensureChildren(focusedPrD, swe, flags)
    for (const deha of focusedPrD.children) {
      const path5 = `${path4PrD}/${deha.planet}`
      rows.push(this._makeLeafRow(deha, path5, isCurrentPeriod(deha.start, deha.end)))
    }
    return rows.join('')
  }

  _makeMdRow(node, expanded, isCurrent) {
    return `<tr data-toggle data-depth="0" data-path="${node.planet}" class="dasha-d0${isCurrent ? ' current-period' : ''}">
      <td style="padding-left:0.5rem">${expanded ? '▼' : '▶'} <strong>${node.planet}</strong> <span class="dasha-level-label">MD</span></td>
      <td>${this._fmt(node.start)}</td><td>${this._fmt(node.end)}</td></tr>`
  }

  _makeRow(node, path, depth, expanded, isCurrent, isNow = false) {
    const nowBadge = isNow ? ' <span class="dasha-now-badge">★ now</span>' : ''
    return `<tr data-toggle data-depth="${depth}" data-path="${path}" class="dasha-d${depth}${isCurrent ? ' current-period' : ''}">
      <td style="padding-left:${INDENT[depth]}">${expanded ? '▼' : '▶'} ${node.planet}${nowBadge} <span class="dasha-level-label">${LEVEL_LABELS[depth]}</span></td>
      <td>${this._fmt(node.start)}</td><td>${this._fmt(node.end)}</td></tr>`
  }

  _makeLeafRow(node, path, isCurrent) {
    return `<tr data-depth="5" data-path="${path}" class="dasha-d5${isCurrent ? ' current-period' : ''}">
      <td style="padding-left:${INDENT[5]}">${node.planet} <span class="dasha-level-label">DeD</span></td>
      <td>${this._fmt(node.start)}</td><td>${this._fmt(node.end)}</td></tr>`
  }

  // ── DOM mutation helpers for full mode ─────────────────────────────────────

  async _insertChildRows(parentRow, node, depth) {
    await ensureChildren(node, getSwe(), buildCalcFlags(getSettings()))
    const childDepth = depth + 1
    const isLeaf     = childDepth === 5
    const path       = parentRow.dataset.path
    const fragment   = document.createDocumentFragment()
    for (const child of node.children) {
      const childPath = `${path}/${child.planet}`
      const isCur     = isCurrentPeriod(child.start, child.end)
      const tr        = document.createElement('tr')
      tr.dataset.depth = String(childDepth)
      tr.dataset.path  = childPath
      if (!isLeaf) tr.dataset.toggle = ''
      tr.className = `dasha-d${childDepth}${isCur ? ' current-period' : ''}`
      const arrow = isLeaf ? '' : '▶ '
      tr.innerHTML = `<td style="padding-left:${INDENT[childDepth]}">${arrow}${child.planet} <span class="dasha-level-label">${LEVEL_LABELS[childDepth]}</span></td><td>${this._fmt(child.start)}</td><td>${this._fmt(child.end)}</td>`
      fragment.appendChild(tr)
    }
    parentRow.after(fragment)
  }

  _removeChildRows(parentRow) {
    const parentDepth = parseInt(parentRow.dataset.depth)
    const tbody       = parentRow.closest('tbody')
    const allRows     = Array.from(tbody.querySelectorAll('tr'))
    const parentIdx   = allRows.indexOf(parentRow)
    for (let i = parentIdx + 1; i < allRows.length; i++) {
      const d = parseInt(allRows[i].dataset.depth ?? '-1')
      if (d <= parentDepth) break
      allRows[i].remove()
    }
  }

  _setArrow(row, open) {
    const td       = row.querySelector('td')
    const textNode = td?.firstChild
    if (textNode?.nodeType === Node.TEXT_NODE) {
      textNode.textContent = textNode.textContent.replace(/^[▶▼] /, open ? '▼ ' : '▶ ')
    }
  }

  // ── Event wiring (all scoped via this.el) ─────────────────────────────────

  _wireEvents() {
    const dasha = this._dasha
    const birth = this._birth

    this._onClick = async (e) => {
      const ui = this.ui

      // Options popover toggle
      if (e.target.closest('[data-options-btn]')) {
        e.stopPropagation()
        this.el.querySelector('[data-options-popover]')?.classList.toggle('open')
        return
      }

      // Breadcrumb nav
      const crumb = e.target.closest('[data-crumb]')
      if (crumb) {
        const depth = parseInt(crumb.dataset.crumb)
        ui.focusedPath = depth < 0 ? [] : (ui.focusedPath ?? []).slice(0, depth + 1)
        await this._refreshVims(dasha, ui)
        return
      }

      // Collapse toggles
      if (e.target.closest('[data-toggle-vims]')) {
        ui.dashaCollapsed = !ui.dashaCollapsed
        const body = this.el.querySelector('[data-vims-body]')
        if (body) body.style.display = ui.dashaCollapsed ? 'none' : ''
        e.target.textContent = ui.dashaCollapsed ? '▶' : '▼'
        return
      }
      if (e.target.closest('[data-toggle-age]')) {
        ui.ageCollapsed = !ui.ageCollapsed
        const body = this.el.querySelector('[data-age-body]')
        if (body) body.style.display = ui.ageCollapsed ? 'none' : ''
        e.target.textContent = ui.ageCollapsed ? '▶' : '▼'
        return
      }
      if (e.target.closest('[data-toggle-prog]')) {
        ui.progCollapsed = !ui.progCollapsed
        const body = this.el.querySelector('[data-prog-body]')
        if (body) body.style.display = ui.progCollapsed ? 'none' : ''
        e.target.textContent = ui.progCollapsed ? '▶' : '▼'
        return
      }

      // Age nav
      if (e.target.closest('[data-age-prev]')) {
        const cur = ui.ageNavCycle ?? Math.floor(this._calcAgeYears(birth.dob) / 12)
        ui.ageNavCycle = Math.max(0, cur - 1)
        ui.ageAsOf = null
        this._refreshAge(birth.dob, this._offsetYears(birth.dob, ui.ageNavCycle * 12))
        return
      }
      if (e.target.closest('[data-age-next]')) {
        const cur = ui.ageNavCycle ?? Math.floor(this._calcAgeYears(birth.dob) / 12)
        ui.ageNavCycle = Math.min(9, cur + 1)
        ui.ageAsOf = null
        this._refreshAge(birth.dob, this._offsetYears(birth.dob, ui.ageNavCycle * 12))
        return
      }
      if (e.target.closest('[data-age-reset]')) {
        ui.ageNavCycle = null
        ui.ageAsOf = null
        this._refreshAge(birth.dob, new Date())
        return
      }

      // Progression nav
      if (e.target.closest('[data-prog-prev]')) {
        ui.progNavIndex = Math.max(0, (ui.progNavIndex ?? 0) - 1)
        ui.selectedProgLord = dasha[ui.progNavIndex].planet
        this._refreshProg(birth.dob, dasha)
        return
      }
      if (e.target.closest('[data-prog-next]')) {
        ui.progNavIndex = Math.min(dasha.length - 1, (ui.progNavIndex ?? 0) + 1)
        ui.selectedProgLord = dasha[ui.progNavIndex].planet
        this._refreshProg(birth.dob, dasha)
        return
      }

      // Dasha table row toggle
      const row = e.target.closest('tr[data-toggle]')
      if (!row) return
      const path  = row.dataset.path
      const depth = parseInt(row.dataset.depth)
      const parts = path.split('/')

      if (ui.focusedMode ?? true) {
        const fp = ui.focusedPath ?? []
        const isExpanded = fp.length > depth && fp[depth] === parts[depth]
        ui.focusedPath = isExpanded ? fp.slice(0, depth) : parts.slice(0, depth + 1)
        await this._refreshVims(dasha, ui)
        return
      }

      // Full mode: DOM-mutation
      let node = dasha.find(m => m.planet === parts[0])
      for (let i = 1; i < parts.length; i++) node = node?.children.find(c => c.planet === parts[i])
      if (!node) return

      const tbody   = row.closest('tbody')
      const allRows = Array.from(tbody.querySelectorAll('tr'))
      const nextIdx = allRows.indexOf(row) + 1
      const hasChild = nextIdx < allRows.length && parseInt(allRows[nextIdx].dataset.depth ?? '-1') === depth + 1
      const opening  = !hasChild

      if (opening) await this._insertChildRows(row, node, depth)
      else this._removeChildRows(row)
      this._setArrow(row, opening)

      if (depth === 0) {
        if (opening) ui.expandedMahas.add(path)
        else {
          ui.expandedMahas.delete(path)
          ui.expandedAntars.delete(path)
          for (const p of ui.expandedPaths) { if (p.startsWith(path + '/')) ui.expandedPaths.delete(p) }
        }
      } else if (depth === 1) {
        const mn = parts[0]
        if (!ui.expandedAntars.has(mn)) ui.expandedAntars.set(mn, new Set())
        if (opening) ui.expandedAntars.get(mn).add(parts[1])
        else {
          ui.expandedAntars.get(mn).delete(parts[1])
          for (const p of ui.expandedPaths) { if (p.startsWith(path + '/')) ui.expandedPaths.delete(p) }
        }
      } else {
        if (opening) ui.expandedPaths.add(path)
        else {
          ui.expandedPaths.delete(path)
          for (const p of ui.expandedPaths) { if (p.startsWith(path + '/')) ui.expandedPaths.delete(p) }
        }
      }
    }

    this._onChange = (e) => {
      const ui = this.ui
      if (e.target.name === 'dasha-mode') {
        ui.focusedMode = e.target.value === 'focused'
        if (ui.focusedMode) ui.focusedPath = this._inferFocusedPath(dasha, ui)
        this._refreshVims(dasha, ui).catch(console.error)
        return
      }
      if (e.target.closest('[data-year-method]')) {
        const yearMethod = e.target.value
        saveSettings({ yearMethod })
        if (yearMethod !== 'custom') {
          import('../tabs/input.js').then(m => m.recalcAll()).catch(console.error)
        }
        return
      }
      if (e.target.closest('[data-age-asof]')) {
        ui.ageAsOf = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
        ui.ageNavCycle = null
        this._refreshAge(birth.dob, ui.ageAsOf ?? new Date())
        return
      }
      if (e.target.closest('[data-prog-lord]')) {
        ui.selectedProgLord = e.target.value
        ui.progNavIndex = dasha.findIndex(m => m.planet === ui.selectedProgLord)
        this._refreshProg(birth.dob, dasha)
        return
      }
    }

    this._onInput = (e) => {
      if (!e.target.closest('[data-custom-days]')) return
      clearTimeout(this._timer)
      this._timer = setTimeout(() => {
        const v = parseFloat(e.target.value)
        if (v >= 300 && v <= 400) {
          saveSettings({ customYearDays: v })
          import('../tabs/input.js').then(m => m.recalcAll()).catch(console.error)
        }
      }, 500)
    }

    this.el.addEventListener('click',  this._onClick)
    this.el.addEventListener('change', this._onChange)
    this.el.addEventListener('input',  this._onInput)

    // Document-level popover close — scoped via this.el
    this._closePopover = (e) => {
      const pop = this.el.querySelector('[data-options-popover]')
      const btn = this.el.querySelector('[data-options-btn]')
      if (pop && !pop.contains(e.target) && e.target !== btn) pop.classList.remove('open')
    }
    document.addEventListener('mousedown', this._closePopover)
  }

  // ── Drag reorder (dasha tab only) ──────────────────────────────────────────

  _initDragReorder() {
    const container = this.el.querySelector('[data-drag-root]')
    if (!container) return
    let dragged = null

    container.addEventListener('dragstart', e => {
      dragged = e.target.closest('.prog-draggable')
      if (dragged) {
        e.dataTransfer.effectAllowed = 'move'
        setTimeout(() => { if (dragged) dragged.style.opacity = '0.4' }, 0)
      }
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
      const rect  = target.getBoundingClientRect()
      const after = e.clientY > rect.top + rect.height / 2
      container.querySelectorAll('.prog-draggable').forEach(el => el.style.boxShadow = '')
      target.style.boxShadow = after ? '0 4px 0 0 var(--accent,#6366f1)' : '0 -4px 0 0 var(--accent,#6366f1)'
    })
    container.addEventListener('dragleave', e => {
      e.target.closest('.prog-draggable')?.style.setProperty('box-shadow', '')
    })
    container.addEventListener('drop', e => {
      e.preventDefault()
      const target = e.target.closest('.prog-draggable')
      if (!target || target === dragged || !dragged) return
      target.style.boxShadow = ''
      const after = e.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2
      container.insertBefore(dragged, after ? target.nextSibling : target)
    })
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  _inferFocusedPath(dasha, ui) {
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

    const antarSet = ui.expandedAntars.get(md)
    if (!antarSet || antarSet.size === 0) return [md]
    const mdNode = dasha.find(m => m.planet === md)
    const currentAD = mdNode?.children?.find(a => isCurrentPeriod(a.start, a.end))
    let ad = (currentAD && antarSet.has(currentAD.planet)) ? currentAD.planet : ([...antarSet][0] ?? null)
    if (!ad) return [md]

    const path = []
    for (let depth = 2; depth <= 4; depth++) {
      const prefix = [md, ad, ...path].join('/')
      const match = [...ui.expandedPaths].find(p => p.startsWith(prefix + '/') && p.split('/').length === depth + 1)
      if (!match) break
      path.push(match.split('/')[depth])
    }
    return [md, ad, ...path]
  }

  _fmt(date) {
    const tz = state.birth?.timezone ?? '+00:00'
    const m  = tz.match(/^([+-])(\d{1,2}):(\d{2})$/)
    const offsetMs = m ? (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) * 60 + parseInt(m[3])) * 60000 : 0
    const d = new Date(date.getTime() + offsetMs).toISOString()
    const [y, mo, day] = d.slice(0, 10).split('-')
    return `${y}-${MONTHS[+mo - 1]}-${day} <span class="dasha-time">${d.slice(11, 16)}</span>`
  }

  _offsetYears(dobStr, years) {
    const d = new Date(dobStr + 'T00:00:00')
    d.setFullYear(d.getFullYear() + years)
    return d
  }

  _calcAgeYears(dobStr) {
    const dob = new Date(dobStr + 'T00:00:00')
    const now = new Date()
    let y = now.getFullYear() - dob.getFullYear()
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) y--
    return Math.max(0, y)
  }
}
