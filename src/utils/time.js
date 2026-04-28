// src/utils/time.js

/**
 * Convert local datetime + IANA timezone to UTC Julian Day Number.
 * swisseph expects UT (Universal Time) Julian Day.
 *
 * @param {string} dateStr  "YYYY-MM-DD"
 * @param {string} timeStr  "HH:MM"
 * @param {string} timezone IANA timezone, e.g. "Asia/Kolkata"
 * @returns {number} Julian Day (UT)
 */
export function toJulianDay(dateStr, timeStr, timezone) {
  const utcDate = localToUTC(`${dateStr}T${timeStr}:00`, timezone)
  return dateToJD(utcDate)
}

export function localToUTC(localISO, timezone) {
  const parts = localISO.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!parts) throw new Error(`Invalid date/time string: "${localISO}"`)
  const [, y, mo, d, h, m] = parts.map(Number)
  const probe = new Date(Date.UTC(y, mo - 1, d, h, m))
  const tzOffset = getTZOffsetMinutes(probe, timezone)
  const candidate = new Date(probe.getTime() - tzOffset * 60000)
  // Re-apply offset at the corrected UTC instant to handle DST transitions
  const tzOffset2 = getTZOffsetMinutes(candidate, timezone)
  return new Date(probe.getTime() - tzOffset2 * 60000)
}

export function getTZOffsetMinutes(date, timezone) {
  // Handle numeric offset strings like "+05:30" or "-04:00"
  const offsetMatch = timezone.match(/^([+-])(\d{1,2}):(\d{2})$/)
  if (offsetMatch) {
    const sign = offsetMatch[1] === '+' ? 1 : -1
    return sign * (parseInt(offsetMatch[2]) * 60 + parseInt(offsetMatch[3]))
  }
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr  = date.toLocaleString('en-US', { timeZone: timezone })
  return (new Date(tzStr) - new Date(utcStr)) / 60000
}

export function getLocalDateParts(date, timezone) {
  const offsetMatch = timezone?.match(/^([+-])(\d{1,2}):(\d{2})$/)
  if (offsetMatch) {
    const offsetMin = getTZOffsetMinutes(date, timezone)
    const local = new Date(date.getTime() + offsetMin * 60000)
    return {
      year: local.getUTCFullYear(),
      month: local.getUTCMonth() + 1,
      day: local.getUTCDate(),
      weekday: local.getUTCDay(),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
    }
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const val = type => parts.find(p => p.type === type)?.value
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year: parseInt(val('year'), 10),
    month: parseInt(val('month'), 10),
    day: parseInt(val('day'), 10),
    weekday: weekdayMap[val('weekday')],
    hour: parseInt(val('hour'), 10) % 24,
    minute: parseInt(val('minute'), 10),
  }
}

export function formatTimeInZone(date, timezone) {
  if (!date) return '—'
  const { hour, minute } = getLocalDateParts(date, timezone)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function dateToJD(date) {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  let Y = y, M = m
  if (M <= 2) { Y -= 1; M += 12 }
  const A = Math.floor(Y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + h / 24 + B - 1524.5
}

/**
 * Format a Julian Day back to a JS Date (UTC).
 */
export function jdToDate(jd) {
  const z = Math.floor(jd + 0.5)
  const f = jd + 0.5 - z
  let a = z
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25)
    a = z + 1 + alpha - Math.floor(alpha / 4)
  }
  const b = a + 1524
  const c = Math.floor((b - 122.1) / 365.25)
  const dd = Math.floor(365.25 * c)
  const e = Math.floor((b - dd) / 30.6001)
  const day = b - dd - Math.floor(30.6001 * e)
  const month = e < 14 ? e - 1 : e - 13
  const year = month > 2 ? c - 4716 : c - 4715
  const totalSeconds = f * 86400
  const hh   = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = Math.floor(totalSeconds % 60)
  return new Date(Date.UTC(year, month - 1, day, hh, mins, secs))
}
