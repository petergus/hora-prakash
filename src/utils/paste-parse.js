// src/utils/paste-parse.js — heuristic parser for free-form pasted birth data.
// Extracts { name, dob, tob, location, lat, lon, tz } where possible.
// All fields are optional in the result; consumer fills whatever is found.

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
}

// Common timezone abbreviations → "+HH:MM"
const TZ_ABBR = {
  IST: '+05:30', UTC: '+00:00', GMT: '+00:00',
  EST: '-05:00', EDT: '-04:00', CST: '-06:00', CDT: '-05:00',
  MST: '-07:00', MDT: '-06:00', PST: '-08:00', PDT: '-07:00',
  CET: '+01:00', CEST: '+02:00', BST: '+01:00',
  JST: '+09:00', AEST: '+10:00', AEDT: '+11:00',
  NZST: '+12:00', SGT: '+08:00', HKT: '+08:00', KST: '+09:00',
}

const pad2 = n => String(n).padStart(2, '0')

function parseDate(text) {
  // ISO: YYYY-MM-DD or YYYY/MM/DD
  let m = text.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3]
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { dob: `${y}-${pad2(mo)}-${pad2(d)}`, raw: m[0] }
  }
  // DD-MM-YYYY or DD/MM/YYYY (also DD.MM.YYYY) — assume day-first when ambiguous
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/)
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3]
    let day, mo
    if (a > 12 && b <= 12) { day = a; mo = b }
    else if (b > 12 && a <= 12) { mo = a; day = b }
    else { day = a; mo = b } // ambiguous → day-first
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) return { dob: `${y}-${pad2(mo)}-${pad2(day)}`, raw: m[0] }
  }
  // "5 January 1990" / "January 5, 1990" / "5-Jan-1990"
  m = text.match(/\b(\d{1,2})[\s.\-/]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s.\-/,]+(\d{4})\b/i)
  if (m) {
    const day = +m[1], mo = MONTHS[m[2].toLowerCase()], y = +m[3]
    if (mo) return { dob: `${y}-${pad2(mo)}-${pad2(day)}`, raw: m[0] }
  }
  m = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s.\-/]+(\d{1,2})[\s.\-/,]+(\d{4})\b/i)
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()], day = +m[2], y = +m[3]
    if (mo) return { dob: `${y}-${pad2(mo)}-${pad2(day)}`, raw: m[0] }
  }
  return null
}

function parseTime(text) {
  // "14:35", "14:35:22", "2:35 PM", "2:35pm", "02.35 AM"
  const m = text.match(/\b(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i)
  if (!m) return null
  let h = +m[1], min = +m[2]
  if (h > 23 || min > 59) return null
  const ap = (m[4] || '').toLowerCase().replace(/\./g, '')
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return { tob: `${pad2(h)}:${pad2(min)}`, raw: m[0] }
}

function parseTz(text) {
  // Explicit offset: "+05:30", "GMT+5:30", "UTC -8", "+0530"
  let m = text.match(/(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i)
  if (m) return { tz: `${m[1]}${pad2(+m[2])}:${pad2(+(m[3] || 0))}`, raw: m[0] }
  m = text.match(/(?<![\d.])([+-])(\d{1,2}):(\d{2})(?!\d)/)
  if (m) return { tz: `${m[1]}${pad2(+m[2])}:${pad2(+m[3])}`, raw: m[0] }
  m = text.match(/(?<![\d.])([+-])(\d{2})(\d{2})(?!\d)/)
  if (m) return { tz: `${m[1]}${pad2(+m[2])}:${pad2(+m[3])}`, raw: m[0] }
  // Abbreviation
  m = text.match(/\b(IST|UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|CET|CEST|BST|JST|AEST|AEDT|NZST|SGT|HKT|KST)\b/)
  if (m && TZ_ABBR[m[1]]) return { tz: TZ_ABBR[m[1]], raw: m[0] }
  return null
}

function parseCoords(text) {
  // Decimal pair: "28.6139, 77.209" or "28.6139 N, 77.209 E"
  let m = text.match(/(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?/i)
  if (m) {
    let lat = parseFloat(m[1])
    let lon = parseFloat(m[3])
    if (m[2] && m[2].toUpperCase() === 'S') lat = -Math.abs(lat)
    if (m[2] && m[2].toUpperCase() === 'N') lat = Math.abs(lat)
    if (m[4] && m[4].toUpperCase() === 'W') lon = -Math.abs(lon)
    if (m[4] && m[4].toUpperCase() === 'E') lon = Math.abs(lon)
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon, raw: m[0] }
  }
  // DMS pair: 28°36'N 77°12'E or 28°36'30"N, 77°12'10"E
  const dmsRe = /(\d{1,3})\s*°\s*(\d{1,2})?\s*['′]?\s*(\d{1,2}(?:\.\d+)?)?\s*["″]?\s*([NSEW])/gi
  const matches = [...text.matchAll(dmsRe)]
  if (matches.length >= 2) {
    const toDec = ([, d, mn, s, dir]) => {
      const v = +d + (+(mn || 0)) / 60 + (+(s || 0)) / 3600
      return /[SW]/i.test(dir) ? -v : v
    }
    const latM = matches.find(x => /[NS]/i.test(x[4]))
    const lonM = matches.find(x => /[EW]/i.test(x[4]))
    if (latM && lonM) {
      const lat = toDec(latM), lon = toDec(lonM)
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { lat, lon, raw: `${latM[0]} ${lonM[0]}` }
      }
    }
  }
  return null
}

const FIELD_LABELS = /^\s*(name|full\s*name|dob|date(?:\s*of\s*birth)?|birth\s*date|tob|time(?:\s*of\s*birth)?|birth\s*time|pob|place(?:\s*of\s*birth)?|birth\s*place|location|city|tz|timezone|time\s*zone|lat(?:itude)?|lon(?:gitude)?|long(?:itude)?|coords?|coordinates)\s*[:=\-–]\s*(.+)$/i

export function parseBirthPaste(text) {
  if (!text) return {}
  const result = {}
  const usedRanges = []  // [start, end) substrings already consumed

  // Pass 1: labelled "key: value" lines
  const lines = text.split(/\r?\n/)
  const remaining = []
  for (const line of lines) {
    const m = line.match(FIELD_LABELS)
    if (!m) { remaining.push(line); continue }
    const key = m[1].toLowerCase().replace(/\s+/g, '')
    const val = m[2].trim()
    if (/^name|^fullname/.test(key)) result.name = val
    else if (/^dob|^date|^birthdate/.test(key)) {
      const d = parseDate(val); if (d) result.dob = d.dob
    }
    else if (/^tob|^time|^birthtime/.test(key)) {
      const t = parseTime(val); if (t) result.tob = t.tob
      // Time line may also contain a tz — check after
      const tz = parseTz(val); if (tz && !result.tz) result.tz = tz.tz
    }
    else if (/^pob|^place|^birthplace|^location|^city/.test(key)) result.location = val
    else if (/^tz|^timezone/.test(key)) {
      const tz = parseTz(val); if (tz) result.tz = tz.tz
    }
    else if (/^lat/.test(key)) {
      const c = parseCoords(val + ', 0E')
      if (c) result.lat = c.lat
      else { const n = parseFloat(val); if (!isNaN(n)) result.lat = /\bs\b/i.test(val) ? -Math.abs(n) : n }
    }
    else if (/^lon|^long/.test(key)) {
      const c = parseCoords('0N, ' + val)
      if (c) result.lon = c.lon
      else { const n = parseFloat(val); if (!isNaN(n)) result.lon = /\bw\b/i.test(val) ? -Math.abs(n) : n }
    }
    else if (/^coord/.test(key)) {
      const c = parseCoords(val); if (c) { result.lat = c.lat; result.lon = c.lon }
    }
  }

  // Pass 2: scan remaining unlabelled text for date/time/coords/tz
  const blob = remaining.join('\n')
  let scratch = blob

  if (!result.dob) {
    const d = parseDate(scratch)
    if (d) { result.dob = d.dob; scratch = scratch.replace(d.raw, ' ') }
  } else {
    // Strip date matches from scratch so we don't grab them as time/etc later
    const d = parseDate(scratch); if (d) scratch = scratch.replace(d.raw, ' ')
  }
  if (!result.tob) {
    const t = parseTime(scratch)
    if (t) { result.tob = t.tob; scratch = scratch.replace(t.raw, ' ') }
  }
  if (!result.tz) {
    const tz = parseTz(scratch)
    if (tz) { result.tz = tz.tz; scratch = scratch.replace(tz.raw, ' ') }
  }
  if (result.lat === undefined || result.lon === undefined) {
    const c = parseCoords(scratch)
    if (c) { result.lat = c.lat; result.lon = c.lon; scratch = scratch.replace(c.raw, ' ') }
  }

  // Pass 3: name + location heuristic from leftover text.
  // Split by both newlines and commas so single-line CSV-style input works.
  const leftover = scratch
    .split(/[\r\n,]+/)
    .map(s => s.replace(/^[\s•\-*;:]+|[\s•\-*;:]+$/g, '').trim())
    .filter(s => s && /[A-Za-z]/.test(s))
    .filter(s => !/^\d+[\s.,;:°'"-]*$/.test(s))

  if (!result.name && leftover.length) {
    const nameLine = leftover.find(s => s.length <= 60 && !/\d{3,}/.test(s))
    if (nameLine) {
      result.name = nameLine
      const idx = leftover.indexOf(nameLine)
      if (idx >= 0) leftover.splice(idx, 1)
    }
  }
  if (!result.location && leftover.length) {
    // Join remaining alphabetic chunks — handles "New Delhi, India" split by commas
    const locParts = leftover.filter(s => !/\d{3,}/.test(s))
    if (locParts.length) result.location = locParts.join(', ')
  }

  return result
}
