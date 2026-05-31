// src/utils/format.js — coordinate and timezone display helpers

// Decimal degrees → { d, m, s } (integer parts)
export function decToDMS(dec) {
  const abs    = Math.abs(dec)
  const d      = Math.floor(abs)
  const mTotal = (abs - d) * 60
  const m      = Math.floor(mTotal)
  const s      = Math.round((mTotal - m) * 60)
  return { d, m: s === 60 ? m + 1 : m, s: s === 60 ? 0 : s }
}

// { d, m, s } → decimal degrees
export function dmsToDec(d, m, s) {
  return parseInt(d) + parseInt(m) / 60 + parseInt(s) / 3600
}

// IANA timezone name or "+05:30" string → { sign: '+' | '-', h: number, m: number }
export function offsetParts(iana) {
  if (!iana) return { sign: '+', h: 0, m: 0 }
  const direct = iana.match(/^([+-])(\d{1,2}):(\d{2})$/)
  if (direct) return { sign: direct[1], h: parseInt(direct[2]), m: parseInt(direct[3]) }
  try {
    const date     = new Date()
    const utcStr   = date.toLocaleString('en-US', { timeZone: 'UTC' })
    const tzStr    = date.toLocaleString('en-US', { timeZone: iana })
    const totalMin = (new Date(tzStr) - new Date(utcStr)) / 60000
    const sign     = totalMin >= 0 ? '+' : '-'
    const abs      = Math.abs(totalMin)
    return { sign, h: Math.floor(abs / 60), m: abs % 60 }
  } catch { return { sign: '+', h: 0, m: 0 } }
}

// { sign, h, m } → "+05:30"
export function offsetStr({ sign, h, m }) {
  return `${sign}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

// Convenience: IANA or offset string → "+05:30"
export function ianaToOffset(iana) {
  return offsetStr(offsetParts(iana))
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// IANA timezone → { offsetMin, abbr }
export function parseTzInfo(iana) {
  if (!iana) return { offsetMin: 0, abbr: 'UTC' }
  try {
    const ref   = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: iana, timeZoneName: 'short',
      hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(ref)
    const abbr       = parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC'
    const localStr   = ref.toLocaleString('en-US', { timeZone: iana })
    const offsetMin  = Math.round((new Date(localStr) - new Date(ref.toLocaleString('en-US', { timeZone: 'UTC' }))) / 60000)
    return { offsetMin, abbr }
  } catch {
    return { offsetMin: 0, abbr: 'UTC' }
  }
}

// Browser local timezone offset in minutes
export function browserOffsetMin() {
  return -new Date().getTimezoneOffset()
}

// Format a Date into transit display string.
// tzAbbr omitted when birth tz offset matches browser local offset.
export function fmtTransitDate(date, tzOffsetMin = 0, tzAbbr = 'UTC') {
  const local = new Date(date.getTime() + tzOffsetMin * 60000)
  const h = String(local.getUTCHours()).padStart(2, '0')
  const m = String(local.getUTCMinutes()).padStart(2, '0')
  const showTz = tzOffsetMin !== browserOffsetMin()
  return `${MONTH_ABBR[local.getUTCMonth()]} ${local.getUTCDate()} ${local.getUTCFullYear()}, ${h}:${m}${showTz ? ' ' + tzAbbr : ''}`
}

// Display helpers kept for chart.js birth details line
export function fmtLat(dec) {
  const { d, m, s } = decToDMS(dec)
  return `${d}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"${dec >= 0 ? 'N' : 'S'}`
}

export function fmtLon(dec) {
  const { d, m, s } = decToDMS(dec)
  return `${d}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"${dec >= 0 ? 'E' : 'W'}`
}
