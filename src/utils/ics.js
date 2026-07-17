// src/utils/ics.js
// Minimal RFC 5545 (iCalendar) writer — no dependencies.
//
// Scope: the app only emits simple one-shot events (all-day or timed, no
// recurrence, no attendees, no timezone definitions). Timed events are written
// in UTC (a `Z` suffix), which needs no VTIMEZONE block and is unambiguous in
// every client; all-day events use a floating DATE value per spec.
//
// Node-safe (pure string building) — see tests/ics.test.mjs.

const CRLF = '\r\n'

/** RFC 5545 §3.3.11 — escape TEXT values. Order matters: backslash first. */
export function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * RFC 5545 §3.1 — fold lines at 75 OCTETS (not characters).
 * Continuation lines start with a single space. Multi-byte UTF-8 sequences
 * must never be split across a fold, so measure in encoded bytes.
 */
export function foldLine(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const out = []
  let cur = ''
  let curBytes = 0
  // First line holds 75 octets; continuations hold 74 (one is the leading space).
  let limit = 75
  for (const ch of line) {              // iterate by code point, not UTF-16 unit
    const size = new TextEncoder().encode(ch).length
    if (curBytes + size > limit) {
      out.push(cur)
      cur = ''
      curBytes = 0
      limit = 74
    }
    cur += ch
    curBytes += size
  }
  if (cur) out.push(cur)
  return out[0] + out.slice(1).map(l => CRLF + ' ' + l).join('')
}

const pad = (n, w = 2) => String(n).padStart(w, '0')

/** Date → "YYYYMMDDTHHMMSSZ" (UTC form). */
export function toIcsUtc(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
         `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

/** "YYYY-MM-DD" → "YYYYMMDD" (all-day DATE form). */
export function toIcsDate(iso) {
  return String(iso).slice(0, 10).replace(/-/g, '')
}

/** Add one day to a "YYYY-MM-DD" string (DTEND of an all-day event is exclusive). */
function nextDay(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Build an .ics document.
 *
 * @param {object[]} events each:
 *   { uid?, summary, description?, location?,
 *     start: Date | "YYYY-MM-DD",   // a string means an all-day event
 *     end?:  Date | "YYYY-MM-DD",   // defaults: timed → start, all-day → start
 *     url? }
 * @param {object} [opts] { calName, prodId, now }
 * @returns {string} the .ics text (CRLF line endings)
 */
export function buildIcs(events, opts = {}) {
  const {
    calName = 'Hora Prakash',
    prodId  = '-//Hora Prakash//Vedic Astrology//EN',
    now     = new Date(),
  } = opts

  const stamp = toIcsUtc(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeText(prodId)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ]

  events.forEach((ev, i) => {
    const allDay = typeof ev.start === 'string'
    const uid = ev.uid ?? `hp-${stamp}-${i}@hora-prakash`

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${escapeText(uid)}`)
    lines.push(`DTSTAMP:${stamp}`)

    if (allDay) {
      // DTEND is exclusive for DATE values: a single-day event ends the next day.
      const endIso = typeof ev.end === 'string' ? nextDay(ev.end) : nextDay(ev.start)
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(ev.start)}`)
      lines.push(`DTEND;VALUE=DATE:${toIcsDate(endIso)}`)
    } else {
      lines.push(`DTSTART:${toIcsUtc(ev.start)}`)
      lines.push(`DTEND:${toIcsUtc(ev.end ?? ev.start)}`)
    }

    lines.push(`SUMMARY:${escapeText(ev.summary)}`)
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`)
    if (ev.location)    lines.push(`LOCATION:${escapeText(ev.location)}`)
    if (ev.url)         lines.push(`URL:${escapeText(ev.url)}`)
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join(CRLF) + CRLF
}

/** Trigger a browser download of an .ics document. */
export function downloadIcs(text, filename = 'hora-prakash.ics') {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
