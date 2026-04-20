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

// Display helpers kept for chart.js birth details line
export function fmtLat(dec) {
  const { d, m, s } = decToDMS(dec)
  return `${d}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"${dec >= 0 ? 'N' : 'S'}`
}

export function fmtLon(dec) {
  const { d, m, s } = decToDMS(dec)
  return `${d}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"${dec >= 0 ? 'E' : 'W'}`
}
