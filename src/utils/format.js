// src/utils/format.js — coordinate and timezone display helpers

export function fmtLat(dec) {
  const abs = Math.abs(dec)
  const d   = Math.floor(abs)
  const m   = Math.floor((abs - d) * 60)
  return `${d}°${String(m).padStart(2,'0')}'${dec >= 0 ? 'N' : 'S'}`
}

export function fmtLon(dec) {
  const abs = Math.abs(dec)
  const d   = Math.floor(abs)
  const m   = Math.floor((abs - d) * 60)
  return `${d}°${String(m).padStart(2,'0')}'${dec >= 0 ? 'E' : 'W'}`
}

// IANA timezone name or already-offset string → "+05:30" / "-04:00"
export function ianaToOffset(iana) {
  if (!iana) return ''
  if (/^[+-]\d{2}:\d{2}$/.test(iana)) return iana
  try {
    const date    = new Date()
    const utcStr  = date.toLocaleString('en-US', { timeZone: 'UTC' })
    const tzStr   = date.toLocaleString('en-US', { timeZone: iana })
    const totalMin = (new Date(tzStr) - new Date(utcStr)) / 60000
    const sign    = totalMin >= 0 ? '+' : '-'
    const abs     = Math.abs(totalMin)
    const h       = String(Math.floor(abs / 60)).padStart(2, '0')
    const m       = String(abs % 60).padStart(2, '0')
    return `${sign}${h}:${m}`
  } catch { return iana }
}

// "28°36'N" / "28N36" / "28.61" → decimal degrees
export function parseDMSLat(str) {
  str = str.trim().toUpperCase()
  const r = str.match(/^(\d+)[°\s]*(\d*)['\s]*([NS]?)/)
  if (!r) return parseFloat(str)
  const dec = parseInt(r[1]) + (r[2] ? parseInt(r[2]) / 60 : 0)
  return r[3] === 'S' ? -dec : dec
}

// "77°12'E" / "77E12" / "77.209" → decimal degrees
export function parseDMSLon(str) {
  str = str.trim().toUpperCase()
  const r = str.match(/^(\d+)[°\s]*(\d*)['\s]*([EW]?)/)
  if (!r) return parseFloat(str)
  const dec = parseInt(r[1]) + (r[2] ? parseInt(r[2]) / 60 : 0)
  return r[3] === 'W' ? -dec : dec
}
