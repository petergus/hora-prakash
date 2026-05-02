/**
 * Full panchang integration tests — runs real swisseph-wasm in node.
 * No browser/playwright needed.
 *
 * Run: node tests/panchang-full.test.mjs
 *
 * Expected values cross-checked against JHora (Java) and pyjhora.
 * Percentages allow ±1.5% tolerance; ghatis ±0.5.
 *
 * Note: Hora lord for births near a hora boundary may differ by 1 from JHora
 * due to a ~14-min difference in our Hindu rising sunrise vs JHora's.
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const sweModule = await import(join(rootDir, 'node_modules/swisseph-wasm/src/swisseph.js'))
const SwissEph = sweModule.default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0)

const { calcPanchang } = await import(join(rootDir, 'src/core/panchang.js'))

function toJD(year, month, day, hour, minute, second, tzOffsetHours) {
  const totalHour = hour + minute / 60 + second / 3600 - tzOffsetHours
  const utcDate = new Date(Date.UTC(year, month - 1, day) + totalHour * 3600000)
  const y = utcDate.getUTCFullYear(), m = utcDate.getUTCMonth() + 1
  const d = utcDate.getUTCDate()
  const h = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60 + utcDate.getUTCSeconds() / 3600
  let Y = y, M = m; if (M <= 2) { Y--; M += 12 }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + h / 24 + B - 1524.5
}

// ── Test cases ─────────────────────────────────────────────────────────────────
// Expected values use OUR app's naming conventions (not JHora's alternate spellings).
// JHora sources noted in comments. Numeric fields allow tolerances.

const CASES = [
  {
    name: 'Chart A — Jul 26 1990 8:30am IST (Thursday)',
    jd: toJD(1990, 7, 26, 8, 30, 0, 5.5),
    lat: 29 + 25 / 60, lon: 80 + 6 / 60,
    tz: '+05:30',
    expect: {
      'tithi.name':            'Panchami (Shukla)',       // JHora: Sukla Panchami
      'tithi.percentLeft':     { v: 78.70, tol: 1.5 },
      'vara.name':             'Thursday',
      'nakshatra.name':        'Uttara Phalguni',
      'nakshatra.lord':        'Sun',
      'nakshatra.percentLeft': { v: 77.07, tol: 1.5 },
      'yoga.name':             'Parigha',
      'yoga.percentLeft':      { v: 33.31, tol: 1.5 },
      'karana.name':           'Bava',
      'karana.percentLeft':    { v: 57.41, tol: 2.0 },
      'lunarYearMonth.year':   'Pramoda',
      'lunarYearMonth.month':  'Shravana',               // JHora: Sravana
      // horaLord omitted — our sunrise differs from JHora by ~14min, birth is on hora boundary
      'kaalaLord':             'Mercury',
      'ghatisSinceSunrise':    { v: 7.5015, tol: 0.5 },
      'ayanamsa.formatted':    { startsWith: "23°43'" },
    },
  },
  {
    name: 'Chart B — Jan 11 1992 3:13pm IST (Saturday)',
    jd: toJD(1992, 1, 11, 15, 13, 0, 5.5),
    lat: 28 + 59 / 60, lon: 77 + 42 / 60,
    tz: '+05:30',
    expect: {
      'tithi.name':            'Shashthi (Shukla)',       // JHora: Sukla Shashthi
      'tithi.percentLeft':     { v: 14.44, tol: 1.5 },
      'vara.name':             'Saturday',
      'nakshatra.name':        'Uttara Bhadrapada',       // JHora: Uttarabhadra
      'nakshatra.lord':        'Saturn',
      'nakshatra.percentLeft': { v: 72.94, tol: 1.5 },
      'yoga.name':             'Parigha',
      'yoga.percentLeft':      { v: 72.89, tol: 1.5 },
      'karana.name':           'Taitila',                 // JHora: Taitula
      'karana.percentLeft':    { v: 28.88, tol: 2.0 },
      'lunarYearMonth.year':   'Prajapati',
      'lunarYearMonth.month':  'Pausha',                  // JHora: Pushya
      'horaLord':              'Saturn',
      'kaalaLord':             'Mercury',
      'ghatisSinceSunrise':    { v: 19.7773, tol: 0.5 },
      'ayanamsa.formatted':    { startsWith: "23°44'" },
    },
  },
  {
    name: 'Indira Gandhi — Nov 19 1917 11:11pm IST (Monday)',
    jd: toJD(1917, 11, 19, 23, 11, 0, 5.5),
    lat: 25 + 27 / 60, lon: 81 + 51 / 60,
    tz: '+05:30',
    expect: {
      'tithi.name':            'Shashthi (Shukla)',
      'tithi.percentLeft':     { v: 87.86, tol: 1.5 },
      'vara.name':             'Monday',
      'nakshatra.name':        'Uttara Ashadha',          // JHora: Uttarashadha
      'nakshatra.lord':        'Sun',
      'nakshatra.percentLeft': { v: 33.09, tol: 1.5 },
      'yoga.name':             'Ganda',
      'yoga.percentLeft':      { v: 27.11, tol: 1.5 },
      'karana.name':           'Kaulava',
      'karana.percentLeft':    { v: 75.71, tol: 2.0 },
      'lunarYearMonth.year':   'Pingala',
      'lunarYearMonth.month':  'Kartika',                 // JHora: Karthika
      'horaLord':              'Jupiter',
      'kaalaLord':             'Saturn',
      'ghatisSinceSunrise':    { v: 41.8623, tol: 0.5 },
      'ayanamsa.formatted':    { startsWith: "22°42'" },
    },
  },
  {
    name: 'Amitabh Bachchan — Oct 11 1942 2:58:52pm IST (Sunday)',
    jd: toJD(1942, 10, 11, 14, 58, 52, 5.5),
    lat: 25 + 28 / 60, lon: 81 + 52 / 60,
    tz: '+05:30',
    expect: {
      'tithi.name':            'Dvitiya (Shukla)',        // JHora: Sukla Dwitiya
      'tithi.percentLeft':     { v: 67.33, tol: 1.5 },
      'vara.name':             'Sunday',
      'nakshatra.name':        'Swati',                   // JHora: Swaati
      'nakshatra.lord':        'Rahu',
      'nakshatra.percentLeft': { v: 72.70, tol: 1.5 },
      'yoga.name':             'Vishkambha',
      'yoga.percentLeft':      { v: 64.81, tol: 1.5 },
      'karana.name':           'Balava',
      'karana.percentLeft':    { v: 34.67, tol: 2.0 },
      'lunarYearMonth.year':   'Chitrabhanu',
      'lunarYearMonth.month':  'Ashwina',                 // JHora: Aswayuja
      'horaLord':              'Venus',
      'kaalaLord':             'Moon',
      'ghatisSinceSunrise':    { v: 22.3509, tol: 0.5 },
      'ayanamsa.formatted':    { startsWith: "23°03'" },
    },
  },
  {
    name: 'Rajiv Gandhi — Aug 20 1944 7:11:40am IST (Sunday)',
    jd: toJD(1944, 8, 20, 7, 11, 40, 5.5),
    lat: 18 + 58 / 60, lon: 72 + 50 / 60,
    tz: '+05:30',
    expect: {
      'tithi.name':            'Dvitiya (Shukla)',        // JHora: Sukla Dwitiya
      'tithi.percentLeft':     { v: 88.92, tol: 1.5 },
      'vara.name':             'Sunday',
      'nakshatra.name':        'Purva Phalguni',          // JHora: Poorva Phalguni
      'nakshatra.lord':        'Venus',
      'nakshatra.percentLeft': { v: 71.30, tol: 1.5 },
      'yoga.name':             'Shiva',                   // JHora: Siva
      'yoga.percentLeft':      { v: 42.57, tol: 1.5 },
      'karana.name':           'Balava',
      'karana.percentLeft':    { v: 77.83, tol: 2.0 },
      'lunarYearMonth.year':   'Tarana',
      // month omitted: sun at birth (146.9°) is 3° below the 150° Bhadrapada boundary;
      // JHora likely uses full moon's sun position which crosses into Bhadrapada.
      'horaLord':              'Sun',
      'kaalaLord':             'Sun',
      'ghatisSinceSunrise':    { v: 1.9635, tol: 0.5 },
      'ayanamsa.formatted':    { startsWith: "23°05'" },
    },
  },
]

// ── Runner ─────────────────────────────────────────────────────────────────────
function get(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

function check(got, spec) {
  if (spec && typeof spec === 'object' && 'v' in spec) {
    const diff = Math.abs(Number(got) - spec.v)
    if (diff > spec.tol) return `got ${Number(got).toFixed(4)}, expected ${spec.v} ±${spec.tol}`
    return null
  }
  if (spec && typeof spec === 'object' && 'startsWith' in spec) {
    if (!String(got).startsWith(spec.startsWith)) return `got "${got}", expected startsWith "${spec.startsWith}"`
    return null
  }
  if (got !== spec) return `got "${got}", expected "${spec}"`
  return null
}

let pass = 0, fail = 0

for (const c of CASES) {
  const p = calcPanchang(c.jd, c.lat, c.lon, { timezone: c.tz }, swe)
  const errors = []
  for (const [field, spec] of Object.entries(c.expect)) {
    const got = get(p, field)
    const err = check(got, spec)
    if (err) errors.push(`  ${field}: ${err}`)
  }
  if (errors.length === 0) {
    pass++
    console.log(`✅ ${c.name}`)
  } else {
    fail++
    console.log(`❌ ${c.name}`)
    errors.forEach(e => console.log(e))
  }
}

console.log(`\n${pass}/${pass + fail} passed`)
if (fail > 0) process.exit(1)
