// src/tabs/calendar.js
// The Calendar page: a month grid of everything the app can date for this
// person (transit forecast events, dasha changes, Sade Sati phases, lunar
// birthdays), an iCal export, and a "find an auspicious time" (muhurta) mode.

import { state } from '../state.js'
import { getActiveSession, defaultCalendarUI } from '../sessions.js'
import { getSwe } from '../core/swisseph.js'
import { getSettings } from '../core/settings.js'
import { buildCalendarEvents, groupByDay, eventsToIcs, EVENT_TYPES, localIso } from '../core/calendar-events.js'
import { calcSadeSati } from '../core/sadesati.js'
import { computeLunarBirthday } from '../core/lunar-birthday.js'
import { findMuhurta } from '../core/muhurta.js'
import { ACTIVITY_OPTIONS, ACTIVITIES } from '../content/muhurta-activities.js'
import { buildIcs, downloadIcs } from '../utils/ics.js'
import { toJulianDay, dateToJd } from '../utils/time.js'
import { isPrivacyOn } from '../ui/person-header.js'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function ui() {
  const s = getActiveSession()
  if (!s) return defaultCalendarUI()
  s.uiState ??= {}
  s.uiState.calendar ??= defaultCalendarUI()
  return s.uiState.calendar
}

const tz = () => state.birth?.timezone ?? '+00:00'

/** "YYYY-MM" of the month currently shown (defaults to the current month). */
function currentMonth() {
  const u = ui()
  if (u.month) return u.month
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number)
  return {
    first: new Date(Date.UTC(y, m - 1, 1)),
    last:  new Date(Date.UTC(y, m, 0, 23, 59, 59)),
    y, m,
  }
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function fmtTime(date) {
  const off = tz().match(/^([+-])(\d{1,2}):(\d{2})$/)
  let d = date
  if (off) {
    const sign = off[1] === '+' ? 1 : -1
    d = new Date(date.getTime() + sign * (parseInt(off[2]) * 60 + parseInt(off[3])) * 60000)
    return d.toISOString().slice(11, 16)
  }
  try {
    return date.toLocaleTimeString('en-GB', { timeZone: tz(), hour: '2-digit', minute: '2-digit' })
  } catch {
    return date.toISOString().slice(11, 16)
  }
}

// ── Event sourcing ──────────────────────────────────────────────────────────
// Sade Sati and the lunar birthday span a lifetime, so they are computed once
// per chart rather than per month view. The key carries the ayanamsa because a
// settings change re-derives both — without it, switching ayanamsa would keep
// serving the previous setting's Saturn ingress dates.
let _extrasCache = null
let _extrasKey   = null

function getExtras() {
  const b = state.birth
  const moon = state.planets?.find(p => p.name === 'Moon')
  if (!b || !moon) return { sadesati: null, lunar: null }
  const key = `${b.dob}|${b.tob}|${b.timezone}|${moon.sign}|${getSettings().ayanamsa}`
  if (_extrasKey === key && _extrasCache) return _extrasCache

  let sadesati = null, lunar = null
  const birthJd = toJulianDay(b.dob, b.tob, b.timezone ?? '+00:00')
  try {
    sadesati = calcSadeSati(moon.sign, { fromJd: birthJd, toJd: birthJd + 90 * 365.25 })
  } catch (e) { console.error('calendar: sadesati', e) }
  try {
    lunar = computeLunarBirthday(b, { years: 30 })
  } catch (e) { console.error('calendar: lunar birthday', e) }

  _extrasCache = { sadesati, lunar }
  _extrasKey = key
  return _extrasCache
}

function eventsForMonth(ym) {
  const { first, last } = monthBounds(ym)
  const { sadesati, lunar } = getExtras()
  // The forecast scans forward from `fromJd`, so anchor it at the month start.
  const fromJd = dateToJd(first)
  return buildCalendarEvents({
    from: first, to: last,
    planets: state.planets, lagna: state.lagna,
    dasha: state.dasha, sadesati, lunar,
    timezone: tz(), fromJd,
  })
}

// ── Rendering ───────────────────────────────────────────────────────────────

function filterChips(active) {
  return `<div class="cal-chips">
    ${Object.entries(EVENT_TYPES).map(([key, t]) => `
      <button class="cal-chip${active.has(key) ? ' active' : ''}" data-filter="${key}">
        <span aria-hidden="true">${t.emoji}</span> ${esc(t.label)}
      </button>`).join('')}
    <button class="cal-chip cal-chip--all" data-filter-all>All</button>
    <button class="cal-chip cal-chip--all" data-filter-none>None</button>
  </div>`
}

function monthGrid(ym, byDay, selectedIso) {
  const { first, y, m } = monthBounds(ym)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const startDow = first.getUTCDay()
  const todayIso = localIso(new Date(), tz())

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push('<div class="cal-cell cal-cell--empty"></div>')

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const evs = byDay.get(iso) ?? []
    const cls = [
      'cal-cell',
      iso === todayIso ? 'is-today' : '',
      iso === selectedIso ? 'is-selected' : '',
      evs.length ? 'has-events' : '',
    ].filter(Boolean).join(' ')
    const dots = evs.slice(0, 4).map(e =>
      `<span class="cal-dot cal-dot--${e.type}" title="${esc(e.label)}">${EVENT_TYPES[e.type]?.emoji ?? '•'}</span>`
    ).join('')
    const more = evs.length > 4 ? `<span class="cal-more">+${evs.length - 4}</span>` : ''
    const zap = evs.some(e => e.activation) ? '<span class="cal-zap" title="Dasha activation">⚡</span>' : ''
    cells.push(`<button class="${cls}" data-day="${iso}">
      <span class="cal-daynum">${day}${zap}</span>
      <span class="cal-dots">${dots}${more}</span>
    </button>`)
  }

  return `
    <div class="cal-grid-head">${DOW.map(d => `<div>${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>`
}

function dayDetail(iso, byDay) {
  if (!iso) return `<p class="cal-hint">Select a day to see its events.</p>`
  const evs = byDay.get(iso) ?? []
  if (!evs.length) return `<p class="cal-hint">No events on ${esc(iso)}.</p>`
  return `
    <h4 class="cal-detail-title">${esc(iso)}</h4>
    <ul class="cal-detail-list">
      ${evs.map(e => `<li>
        <span class="cal-detail-time">${e.allDay ? 'all day' : esc(fmtTime(e.date))}</span>
        <span class="cal-detail-emoji" aria-hidden="true">${EVENT_TYPES[e.type]?.emoji ?? '•'}</span>
        <span class="cal-detail-label">${esc(e.label)}
          ${e.activation ? `<span class="transit-exp-zap" title="Involves a running dasha lord">⚡ ${e.activation.levels.join('·')}</span>` : ''}
          ${e.detail ? `<span class="cal-detail-sub">${esc(e.detail)}</span>` : ''}
        </span>
      </li>`).join('')}
    </ul>`
}

function muhurtaPanel(u) {
  const res = u.muhurtaResult
  const act = ACTIVITIES[u.muhurtaActivity]
  return `
    <div class="card cal-muhurta">
      <h3 class="section-label">Find an auspicious time</h3>
      <div class="cal-muhurta-controls">
        <label>Activity
          <select id="mu-activity" class="div-select">
            ${ACTIVITY_OPTIONS.map(o => `<option value="${o.value}"${o.value === u.muhurtaActivity ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
          </select>
        </label>
        <label>From <input type="date" id="mu-from" value="${esc(u.muhurtaFrom ?? '')}"></label>
        <label>To <input type="date" id="mu-to" value="${esc(u.muhurtaTo ?? '')}"></label>
        <button id="mu-run" class="btn-secondary">Search</button>
      </div>
      ${act ? `<p class="cal-muhurta-note">${esc(act.note)}</p>` : ''}
      <div id="mu-results">
        ${res ? muhurtaResults(res) : '<p class="cal-hint">Pick an activity and a date range.</p>'}
      </div>
    </div>`
}

function muhurtaResults(res) {
  if (!res.windows.length) {
    return `<p class="cal-hint">No window cleared the bar in that range (${res.scanned} moments checked).
      Every candidate hit a rejection — Rikta tithi, Vishti karana, Rahu/Gulika kalam,
      Chandrashtama or a Vadha tara. Try a wider range.</p>`
  }
  return `
    <p class="cal-hint">${res.windows.length} window${res.windows.length === 1 ? '' : 's'} from ${res.scanned} moments checked, best first.</p>
    <div class="cal-mu-list">
      ${res.windows.map((w, i) => `
        <details class="cal-mu-item cal-mu--${w.grade}"${i === 0 ? ' open' : ''}>
          <summary>
            <span class="cal-mu-date">${esc(w.dateStr)}</span>
            <span class="cal-mu-time">${esc(fmtTime(w.start))}–${esc(fmtTime(w.end))}</span>
            <span class="cal-mu-grade">${esc(w.grade)}</span>
            <span class="cal-mu-pct">${Math.round(w.pct * 100)}%</span>
          </summary>
          <div class="cal-mu-body">
            <div class="cal-mu-meta">${esc(w.nakshatra)} · ${esc(w.tithi)}</div>
            <table class="planet-table cal-mu-table">
              <tbody>
                ${w.factors.map(f => `<tr>
                  <td>${esc(f.label)}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums${f.points === 0 ? ';color:var(--danger,#dc2626)' : ''}">${f.points}/${f.max}</td>
                  <td>${esc(f.note)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </details>`).join('')}
    </div>`
}

// ── Main render ─────────────────────────────────────────────────────────────

export async function renderCalendar() {
  const el = document.getElementById('tab-calendar')
  if (!el || !state.planets || !state.lagna || !state.birth) return

  const u = ui()
  const ym = currentMonth()
  u.month = ym

  let events = []
  try {
    events = eventsForMonth(ym)
  } catch (err) {
    console.error('calendar: events', err)
  }
  const active = u.filters instanceof Set ? u.filters : new Set(Object.keys(EVENT_TYPES))
  u.filters = active
  const shown = events.filter(e => active.has(e.type))
  const byDay = groupByDay(shown)
  const { y, m } = monthBounds(ym)

  el.innerHTML = `
    <div class="card">
      <div class="cal-header">
        <div class="cal-nav">
          <button id="cal-prev" class="prog-nav-btn" title="Previous month">←</button>
          <h3 class="cal-title">${MONTHS[m - 1]} ${y}</h3>
          <button id="cal-next" class="prog-nav-btn" title="Next month">→</button>
          <button id="cal-today" class="btn-secondary cal-today-btn">Today</button>
        </div>
        <div class="cal-actions">
          <span class="cal-count">${shown.length} event${shown.length === 1 ? '' : 's'}</span>
          <button id="cal-ics" class="btn-secondary" title="Download this month as an .ics calendar file">⤓ iCal</button>
        </div>
      </div>
      ${filterChips(active)}
      ${monthGrid(ym, byDay, u.selectedDay)}
    </div>
    <div class="card cal-detail">${dayDetail(u.selectedDay, byDay)}</div>
    ${muhurtaPanel(u)}
  `

  wire(el, ym, shown, byDay)
}

function wire(el, ym, shown, byDay) {
  const u = ui()

  el.querySelector('#cal-prev')?.addEventListener('click', () => {
    u.month = shiftMonth(ym, -1); u.selectedDay = null; renderCalendar()
  })
  el.querySelector('#cal-next')?.addEventListener('click', () => {
    u.month = shiftMonth(ym, 1); u.selectedDay = null; renderCalendar()
  })
  el.querySelector('#cal-today')?.addEventListener('click', () => {
    const now = new Date()
    u.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    u.selectedDay = localIso(now, tz())
    renderCalendar()
  })

  el.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.filter
    if (u.filters.has(k)) u.filters.delete(k); else u.filters.add(k)
    renderCalendar()
  }))
  el.querySelector('[data-filter-all]')?.addEventListener('click', () => {
    u.filters = new Set(Object.keys(EVENT_TYPES)); renderCalendar()
  })
  el.querySelector('[data-filter-none]')?.addEventListener('click', () => {
    u.filters = new Set(); renderCalendar()
  })

  el.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => {
    u.selectedDay = u.selectedDay === b.dataset.day ? null : b.dataset.day
    renderCalendar()
  }))

  el.querySelector('#cal-ics')?.addEventListener('click', () => {
    if (!shown.length) return
    const name = isPrivacyOn() ? '' : (state.birth?.name ?? '')
    const text = buildIcs(eventsToIcs(shown, { personName: name }), {
      calName: `Hora Prakash${name ? ' — ' + name : ''}`,
    })
    downloadIcs(text, `hora-prakash-${ym}.ics`)
  })

  // ── Muhurta ──
  const setFromInputs = () => {
    u.muhurtaActivity = el.querySelector('#mu-activity')?.value ?? u.muhurtaActivity
    u.muhurtaFrom = el.querySelector('#mu-from')?.value || u.muhurtaFrom
    u.muhurtaTo   = el.querySelector('#mu-to')?.value   || u.muhurtaTo
  }
  el.querySelector('#mu-activity')?.addEventListener('change', () => { setFromInputs(); renderCalendar() })

  el.querySelector('#mu-run')?.addEventListener('click', async () => {
    setFromInputs()
    if (!u.muhurtaFrom || !u.muhurtaTo) {
      el.querySelector('#mu-results').innerHTML = '<p class="cal-hint">Choose both a start and an end date.</p>'
      return
    }
    if (u.muhurtaFrom > u.muhurtaTo) {
      el.querySelector('#mu-results').innerHTML = '<p class="cal-hint">The start date must come before the end date.</p>'
      return
    }
    const results = el.querySelector('#mu-results')
    results.innerHTML = '<p class="cal-hint">Scanning…</p>'
    // Yield a frame so the "Scanning…" paint lands before the sweep blocks.
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))
    try {
      const moon = state.planets.find(p => p.name === 'Moon')
      u.muhurtaResult = findMuhurta({
        activity: u.muhurtaActivity,
        from: u.muhurtaFrom, to: u.muhurtaTo,
        lat: state.birth.lat, lon: state.birth.lon, timezone: tz(),
        natal: moon ? { janmaNak: moon.nakshatraIndex, moonSign: moon.sign } : null,
        swe: getSwe(),
      })
      // Swap the results in place rather than re-rendering: a full render would
      // recompute the month's events for nothing. The results are <details>
      // elements, so they need no listeners of their own.
      results.innerHTML = muhurtaResults(u.muhurtaResult)
    } catch (err) {
      console.error('muhurta:', err)
      results.innerHTML = `<p class="cal-hint">Could not complete the search: ${esc(err.message)}</p>`
    }
  })
}
