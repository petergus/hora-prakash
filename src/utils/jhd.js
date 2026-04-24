// src/utils/jhd.js

export function parseJhdFile(text, filename) {
  const lines = text.split(/\r?\n/)
  if (lines.length < 14) throw new Error(`${filename}: too few lines (need ≥14, got ${lines.length})`)

  const num = (i) => {
    const v = parseFloat(lines[i])
    if (isNaN(v)) throw new Error(`${filename}: line ${i} is not a number ("${lines[i]}")`)
    return v
  }

  const month = num(0)
  const day   = num(1)
  const year  = num(2)

  // Line 3 is H.MM format (not decimal fractional hours)
  const rawTime = num(3)
  const h = Math.floor(rawTime)
  const m = Math.round((rawTime - h) * 100)
  const tob = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  const dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Line 5: JHora East=negative → negate for standard East-positive
  const lon = -num(5)
  const lat =  num(6)

  // Line 8: JHora East=negative UTC offset → negate
  const utcHours = -num(8)
  const sign     = utcHours >= 0 ? '+' : '-'
  const absH     = Math.floor(Math.abs(utcHours))
  const absM     = Math.round((Math.abs(utcHours) - absH) * 60)
  const timezone = `${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`

  const city    = lines[12].trim()
  const country = lines[13].trim()
  const location = city && country ? `${city}, ${country}` : city || country

  const rawName = filename.replace(/\.jhd$/i, '')
  const name    = rawName.replace(/[_-]+/g, ' ').trim()

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

  return { id, name, dob, tob, lat, lon, timezone, location }
}
