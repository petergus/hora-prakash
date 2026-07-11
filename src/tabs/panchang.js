import { state } from '../state.js'
import { calcPanchang } from '../core/panchang.js'
import { computeLunarBirthday } from '../core/lunar-birthday.js'
import { dateToJd } from '../utils/time.js'
import { getTimezone } from '../utils/geocoding.js'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

let todayLocation = null   // { lat, lon, locationName, timezone }
let lastTodayCalc = 0      // ms timestamp of last calculation
let todayPanchang = null

try {
  const saved = localStorage.getItem('hora-prakash-today-location')
  if (saved) todayLocation = JSON.parse(saved)
} catch {}

function fmtPct(n) { return n != null ? `${n.toFixed(1)}% left` : '' }

function fmtTimeFull(d, timezone) {
  if (!d) return '—'
  try {
    const tz = timezone?.match(/^[+-]/) ? undefined : timezone
    const opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }
    if (tz) opts.timeZone = tz
    return d.toLocaleTimeString('en-US', opts).toLowerCase()
  } catch {
    // fallback for numeric offset strings — approximate via UTC offset
    try {
      const m = timezone?.match(/^([+-])(\d{1,2}):(\d{2})$/)
      if (m) {
        const sign = m[1] === '+' ? 1 : -1
        const offsetMs = sign * (parseInt(m[2]) * 60 + parseInt(m[3])) * 60000
        const local = new Date(d.getTime() + offsetMs)
        const hh = local.getUTCHours()
        const mm = String(local.getUTCMinutes()).padStart(2,'0')
        const ss = String(local.getUTCSeconds()).padStart(2,'0')
        const period = hh >= 12 ? 'pm' : 'am'
        const h12 = hh % 12 || 12
        return `${String(h12).padStart(2,'0')}:${mm}:${ss} ${period}`
      }
    } catch {}
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()
  }
}

function renderRow(label, value) {
  return `<tr><th>${esc(label)}</th><td>${value}</td></tr>`
}

function renderPanchangCard(panchang, meta, { title, showRefresh = false } = {}) {
  const p = panchang
  const tz = meta.timezone || '+00:00'
  const loc = meta.location || (meta.lat != null ? `${meta.lat}, ${meta.lon}` : '')

  const dateStr = meta.dob || (p.sunrise ? p.sunrise.toISOString().slice(0,10) : '—')
  const timeStr = meta.tob || ''

  const rows = [
    p.lunarYearMonth ? renderRow('Lunar Year-Month', `${esc(p.lunarYearMonth.year)} — ${esc(p.lunarYearMonth.month)}`) : null,
    renderRow('Tithi', `${esc(p.tithi.name)} · ${fmtPct(p.tithi.percentLeft)}`),
    renderRow('Vedic Weekday', `${esc(p.vara.name)} (${esc(p.vara.lord.slice(0,2))})`),
    renderRow('Nakshatra', `${esc(p.nakshatra.name)} Pada ${p.nakshatra.pada} (${esc(p.nakshatra.lord.slice(0,2))}) · ${fmtPct(p.nakshatra.percentLeft)}`),
    renderRow('Yoga', `${esc(p.yoga.name)} · ${fmtPct(p.yoga.percentLeft)}`),
    renderRow('Karana', `${esc(p.karana.name)} · ${fmtPct(p.karana.percentLeft)}`),
    p.horaLord ? renderRow('Hora Lord', esc(p.horaLord)) : null,
    p.kaalaLord ? renderRow('Kaala Lord', esc(p.kaalaLord)) : null,
    renderRow('Sunrise', fmtTimeFull(p.sunrise, tz)),
    renderRow('Sunset', fmtTimeFull(p.sunset, tz)),
    renderRow('Rahu Kalam', `${fmtTimeFull(p.rahuKalam.start, tz)} – ${fmtTimeFull(p.rahuKalam.end, tz)}`),
    renderRow('Gulika Kalam', `${fmtTimeFull(p.gulikaKalam.start, tz)} – ${fmtTimeFull(p.gulikaKalam.end, tz)}`),
    p.ghatisSinceSunrise != null ? renderRow(meta.isToday ? 'Ghatis Since Sunrise' : 'Janma Ghatis', p.ghatisSinceSunrise.toFixed(4)) : null,
    p.ayanamsa ? renderRow('Ayanamsa', esc(p.ayanamsa.formatted)) : null,
    p.siderealTime ? renderRow('Sidereal Time', esc(p.siderealTime)) : null,
  ].filter(Boolean).join('\n')

  const refreshBtn = showRefresh
    ? `<button id="panchang-refresh" style="margin-left:auto;font-size:0.8rem;padding:0.2rem 0.6rem;">↻ Refresh</button>`
    : ''

  return `
    <div class="card" style="margin-bottom:1.2rem">
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <h2 style="margin:0">${esc(title)}</h2>
        ${refreshBtn}
      </div>
      <p style="color:var(--muted);font-size:0.85rem;margin:0.2rem 0 0.3rem">
        ${esc(dateStr)}${timeStr ? ' · ' + esc(timeStr) : ''} · ${esc(tz)}
      </p>
      <p style="color:var(--muted);font-size:0.85rem;margin:0 0 1rem">${esc(loc)}</p>
      <div class="table-scroll"><table class="panchang-table"><tbody>
        ${rows}
      </tbody></table></div>
    </div>
  `
}

async function getTodayTimezone(lat, lon) {
  try {
    return await getTimezone(lat, lon)
  } catch {
    return '+00:00'
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const j = await r.json()
    return j.display_name?.split(',').slice(0,2).join(', ') || `${lat.toFixed(2)}, ${lon.toFixed(2)}`
  } catch {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`
  }
}

async function setupTodayLocation(lat, lon) {
  const [locationName, timezone] = await Promise.all([
    reverseGeocode(lat, lon),
    getTodayTimezone(lat, lon),
  ])
  todayLocation = { lat, lon, locationName, timezone }
  localStorage.setItem('hora-prakash-today-location', JSON.stringify(todayLocation))
  await refreshTodayPanchang()
}

async function refreshTodayPanchang() {
  if (!todayLocation) return
  const now = new Date()
  const jd = dateToJd(now)
  todayPanchang = calcPanchang(jd, todayLocation.lat, todayLocation.lon, {
    timezone: todayLocation.timezone
  })
  lastTodayCalc = Date.now()
  renderTodaySection()
}

function renderLocationInput() {
  return `
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
      <input id="today-loc-input" type="text" placeholder="Enter city name…"
        style="flex:1;min-width:160px;padding:0.3rem 0.5rem;font-size:0.9rem">
      <button id="today-loc-search" style="padding:0.3rem 0.7rem;font-size:0.9rem">Search</button>
    </div>
    <div id="today-loc-results" style="margin-top:0.4rem"></div>
  `
}

// Called only after innerHTML replacement, so listeners are always attached to fresh elements.
function wireLocationForm() {
  document.getElementById('today-loc-search')?.addEventListener('click', searchTodayLocation)
  document.getElementById('today-loc-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchTodayLocation()
  })
}

async function searchTodayLocation() {
  const q = document.getElementById('today-loc-input')?.value?.trim()
  if (!q) return
  const resultsEl = document.getElementById('today-loc-results')
  if (resultsEl) resultsEl.textContent = 'Searching…'
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const results = await r.json()
    if (!resultsEl) return
    if (!results.length) { resultsEl.textContent = 'No results.'; return }
    resultsEl.innerHTML = results.map(loc =>
      `<div style="padding:0.2rem 0;cursor:pointer;font-size:0.85rem" data-lat="${loc.lat}" data-lon="${loc.lon}">
        📍 ${esc(loc.display_name.split(',').slice(0,3).join(', '))}
      </div>`
    ).join('')
    resultsEl.querySelectorAll('div[data-lat]').forEach(el => {
      el.addEventListener('click', () => {
        setupTodayLocation(parseFloat(el.dataset.lat), parseFloat(el.dataset.lon))
      })
    })
  } catch {
    if (resultsEl) resultsEl.textContent = 'Search failed.'
  }
}

function showLocationOverride() {
  const section = document.getElementById('today-panchang-section')
  if (!section) return
  section.innerHTML = `
    <div class="card" style="margin-bottom:1.2rem">
      <h2>Today's Panchang — Change Location</h2>
      ${renderLocationInput()}
    </div>
  `
  wireLocationForm()
}

function renderTodaySection() {
  const section = document.getElementById('today-panchang-section')
  if (!section) return

  if (!todayLocation) {
    section.innerHTML = `
      <div class="card" style="margin-bottom:1.2rem">
        <h2>Today's Panchang</h2>
        <p style="color:var(--muted);font-size:0.85rem">Detecting location…</p>
        <div id="today-location-form" style="margin-top:0.8rem">${renderLocationInput()}</div>
      </div>
    `
    wireLocationForm()
    return
  }

  const meta = {
    dob: new Date().toISOString().slice(0, 10),
    timezone: todayLocation.timezone,
    location: todayLocation.locationName,
    isToday: true,
  }
  const cardHtml = todayPanchang
    ? renderPanchangCard(todayPanchang, meta, { title: "Today's Panchang", showRefresh: true })
    : `<div class="card" style="margin-bottom:1.2rem"><p style="color:var(--muted)">Calculating…</p></div>`

  section.innerHTML = cardHtml + `
    <div style="font-size:0.8rem;color:var(--muted);margin:-0.8rem 0 1rem;padding:0 0.2rem">
      <a href="#" id="change-today-location" style="color:var(--muted)">Change location</a>
    </div>
  `
  // No listener accumulation: section.innerHTML is replaced above, so these are always fresh elements.
  document.getElementById('panchang-refresh')?.addEventListener('click', refreshTodayPanchang)
  document.getElementById('change-today-location')?.addEventListener('click', e => {
    e.preventDefault()
    showLocationOverride()
  })
}

export { renderPanchangCard }

function renderLunarBirthdayCard() {
  let result
  try {
    result = computeLunarBirthday(state.birth)
  } catch (err) {
    console.error('Lunar birthday computation failed:', err)
    return ''
  }
  if (!result) return ''
  const { lunar, upcoming } = result
  const ADHIKA_BADGE = `<span class="adhika-badge" title="Adhika (Purushottam) masa — the leap month">Adhika</span>`

  // Show the Amanta month only when it differs (i.e. during Krishna paksha),
  // so the Purnimanta convention is transparent.
  const amantaNote = lunar.monthIndex !== lunar.monthIndexAmanta
    ? ` · <span title="Amanta (new-moon-ending) equivalent">Amanta: ${esc(lunar.monthNameAmanta)} ${esc(lunar.paksha)}</span>`
    : ''

  const bornAdhikaNote = lunar.isAdhika
    ? `<p class="lunar-bday-adhika-note">This birth fell in an <strong>Adhika (Purushottam) masa</strong> — the leap month inserted about every 2½–3 years. In most years it is observed in the regular (Nija) month; the Adhika occurrence is listed only in the years it returns.</p>`
    : ''

  const anyAdhika = upcoming.some(u => u.isAdhika)
  const rows = upcoming.length
    ? upcoming.map(u => `
        <tr>
          <td>${esc(u.label)}${u.isAdhika ? ' ' + ADHIKA_BADGE : ''}</td>
          <td style="text-align:center">${u.turns}</td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="color:var(--muted)">Could not determine upcoming dates.</td></tr>`

  const adhikaLegend = anyAdhika
    ? `<p class="lunar-bday-legend">${ADHIKA_BADGE} marks the leap-month occurrence — some observe the birthday then instead of (or as well as) the regular month.</p>`
    : ''

  return `
    <div class="card" style="margin-bottom:1.2rem">
      <h2 style="margin:0 0 0.15rem">Lunar Birthday
        <span style="font-size:0.7rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">Purnimanta</span>
      </h2>
      <div class="lunar-bday-headline">${esc(lunar.label)}</div>
      <p style="color:var(--muted);font-size:0.85rem;margin:0.15rem 0 ${bornAdhikaNote ? '0.6rem' : '1rem'}">
        ${esc(lunar.paksha)} Paksha · ${esc(lunar.tithiName)} tithi${amantaNote}
      </p>
      ${bornAdhikaNote}
      <div class="lunar-bday-sub">Upcoming Gregorian dates</div>
      <div class="table-scroll">
        <table class="panchang-table lunar-bday-table">
          <thead><tr><th>Gregorian date</th><th style="text-align:center">Turns</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${adhikaLegend}
    </div>
  `
}

export function renderPanchang() {
  const panel = document.getElementById('tab-panchang')
  let html = ''

  // Placeholder for today's panchang (populated by initTodayPanchang)
  html += `<div id="today-panchang-section"></div>`

  // Birth panchang card (only shown after chart is calculated)
  if (state.panchang && state.birth) {
    const birthMeta = {
      dob: state.birth.dob,
      tob: state.birth.tob,
      timezone: state.birth.timezone,
      location: state.birth.location || `${state.birth.lat}, ${state.birth.lon}`,
    }
    const title = `Birth Panchang — ${state.birth.name || state.birth.dob}`
    html += renderPanchangCard(state.panchang, birthMeta, { title })
    html += renderLunarBirthdayCard()
  }

  panel.innerHTML = html
  initTodayPanchang()
}

export async function initTodayPanchang() {
  // Auto-refresh if stale (> 5 min)
  if (todayLocation && Date.now() - lastTodayCalc > 5 * 60 * 1000) {
    await refreshTodayPanchang()
    return
  }
  if (todayLocation && todayPanchang) {
    renderTodaySection()
    return
  }
  // First time — render placeholder then try geolocation
  renderTodaySection()
  navigator.geolocation?.getCurrentPosition(
    pos => setupTodayLocation(pos.coords.latitude, pos.coords.longitude),
    () => { /* user denied — leave manual form visible */ }
  )
}
