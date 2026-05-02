import { state } from '../state.js'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

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

export { renderPanchangCard }

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
  }

  panel.innerHTML = html
}
