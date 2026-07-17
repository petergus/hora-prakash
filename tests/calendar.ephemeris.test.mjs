// Real-ephemeris test for the Calendar pipeline end to end: a real chart →
// transit forecast + dasha changes + Sade Sati + lunar birthdays → merged,
// day-bucketed events → a valid .ics document.
//
// This is also the first coverage of `findNextEvents` itself (the forecast
// engine), which was previously untestable in Node because it reached for the
// WASM singleton; it now takes the same injectable `swe` seam as the other
// core modules.
//
// Run: npm run test:ephemeris

const SwissEph = (await import('swisseph-wasm')).default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0) // Lahiri — matches the app

const { calcBirthChart } = await import('../src/core/calculations.js')
const { calcDasha } = await import('../src/core/dasha.js')
const { calcSadeSati } = await import('../src/core/sadesati.js')
const { computeLunarBirthday } = await import('../src/core/lunar-birthday.js')
const { findNextEvents } = await import('../src/core/transitForecast.js')
const { PLANETS } = await import('../src/core/swisseph.js')
const { buildCalendarEvents, groupByDay, eventsToIcs } = await import('../src/core/calendar-events.js')
const { buildIcs } = await import('../src/utils/ics.js')
const { toJulianDay, dateToJd } = await import('../src/utils/time.js')

let failures = 0
const assert = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + msg); if (!cond) failures++ }

// calcBirthChart uses the singleton, so build the natal chart from longitudes
// directly — the same approach the upagraha ephemeris test takes.
const FLAGS = 65536 | 256
const { getNakshatraInfo, COMBUST_ORBS } = await import('../src/core/calculations.js')
const birth = { dob: '1990-06-15', tob: '14:30', timezone: '+05:30', lat: 28.61, lon: 77.21, name: 'Test' }
const jd = toJulianDay(birth.dob, birth.tob, birth.timezone)

const asc = ((swe.houses_ex(jd, 65536, birth.lat, birth.lon, 'P').ascmc[0] % 360) + 360) % 360
const lagna = { lon: asc, sign: Math.floor(asc / 30) + 1, degree: asc % 30 }
const planets = PLANETS.map(p => {
  const r = swe.calc_ut(jd, p.id, FLAGS)
  const lon = p.isKetu ? (r[0] + 180) % 360 : r[0]
  const nak = getNakshatraInfo(lon)
  return {
    id: p.id, name: p.name, abbr: p.abbr, lon,
    sign: Math.floor(lon / 30) + 1, degree: lon % 30,
    house: ((Math.floor(lon / 30) + 1 - lagna.sign + 12) % 12) + 1,
    nakshatra: nak.name, nakshatraLord: nak.lord, nakshatraIndex: nak.index, pada: nak.pada,
    retrograde: r[3] < 0, speed: r[3], combust: false,
  }
})
const moon = planets.find(p => p.name === 'Moon')

console.log('\n[findNextEvents — the forecast engine, now injectable]')
{
  const sat = PLANETS.find(p => p.abbr === 'Sa')
  const fromJd = dateToJd(new Date(Date.UTC(2026, 0, 1)))
  const evs = findNextEvents(sat, fromJd, planets, lagna.sign, swe)

  assert(evs.length > 0, `Saturn produces events over its 730-day window (${evs.length})`)
  assert(evs.every((e, i) => i === 0 || evs[i - 1].date <= e.date), 'events come back sorted')
  assert(evs.every(e => e.date instanceof Date && !isNaN(e.date)), 'every event has a real Date')

  // Saturn's 730-day scan from 2026-01-01 must contain its known ingresses and
  // at least one retrograde station (it stations twice a year).
  const types = new Set(evs.map(e => e.type))
  assert(types.has('sign'), 'includes a sign ingress')
  assert(types.has('retro') && types.has('direct'), 'includes both retrograde and direct stations')

  const iso = d => d.toISOString().slice(0, 10)
  // Lahiri: Saturn enters Aries 2027-06-03 (±2d) inside this window.
  const aries = evs.find(e => e.type === 'sign' && e.detail === 'Aries')
  assert(aries && Math.abs(aries.date - new Date('2027-06-03')) < 3 * 86400000,
    `Saturn's Aries ingress lands 2027-06-03${aries ? ` (got ${iso(aries.date)})` : ' — MISSING'}`)

  // Every event must fall inside the declared scan window
  const past = fromJd + 730 + 1
  assert(evs.every(e => dateToJd(e.date) <= past), 'no event escapes the 730-day scan window')

  // The Moon's window is 30 days — a much shorter reach, by design.
  const mo = findNextEvents(PLANETS.find(p => p.abbr === 'Mo'), fromJd, planets, lagna.sign, swe)
  assert(mo.every(e => dateToJd(e.date) <= fromJd + 31), 'the Moon scan stays inside its 30-day window')
  assert(!mo.some(e => e.type === 'nakshatra'), 'Moon nakshatra changes are suppressed (Panchang covers them)')
}

console.log('\n[buildCalendarEvents — a real month]')
const dasha = await calcDasha(moon, birth.dob, { jd })
const sadesati = calcSadeSati(moon.sign, { fromJd: jd, toJd: jd + 90 * 365.25, swe })
const lunar = computeLunarBirthday(birth, { years: 30, swe })

const from = new Date(Date.UTC(2026, 6, 1))
const to   = new Date(Date.UTC(2026, 6, 31, 23, 59, 59))
const events = buildCalendarEvents({
  from, to, planets, lagna, dasha, sadesati, lunar,
  timezone: birth.timezone, fromJd: dateToJd(from), swe,
})
{
  assert(events.length > 0, `July 2026 has events (${events.length})`)
  assert(events.every(e => e.date >= from && e.date <= to), 'every event falls inside the requested month')
  assert(events.every((e, i) => i === 0 || events[i - 1].date <= e.date), 'merged stream is chronological')
  assert(events.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.iso)), 'every event carries an ISO day bucket')
  assert(events.every(e => e.iso.startsWith('2026-07')), 'day buckets all land in July (timezone applied)')

  const types = new Set(events.map(e => e.type))
  assert(types.size > 1, `several event families present (${[...types].join(', ')})`)

  const grouped = groupByDay(events)
  assert(grouped.size > 0 && grouped.size <= 31, `bucketed into ≤31 days (${grouped.size})`)
  assert([...grouped.values()].flat().length === events.length, 'grouping loses nothing')
}

console.log('\n[dasha activations are flagged in the stream]')
{
  // Over a whole year there should be at least one transit event touching a
  // running dasha lord — that is the whole point of the ⚡ badge.
  const yFrom = new Date(Date.UTC(2026, 0, 1))
  const yTo   = new Date(Date.UTC(2026, 11, 31))
  const yEvents = buildCalendarEvents({
    from: yFrom, to: yTo, planets, lagna, dasha, sadesati: null, lunar: null,
    timezone: birth.timezone, fromJd: dateToJd(yFrom), swe,
  })
  const zapped = yEvents.filter(e => e.activation)
  assert(zapped.length > 0, `2026 contains dasha-activated transits (${zapped.length}/${yEvents.length})`)
  assert(zapped.every(e => e.activation.levels.length > 0), 'each activation names its levels')
  assert(zapped.every(e => ['MD','AD','PD'].includes(e.activation.levels[0])), 'levels are MD/AD/PD')
}

console.log('\n[ics export of a real month]')
{
  const ics = buildIcs(eventsToIcs(events, { personName: 'Test' }), { calName: 'Hora Prakash — Test' })
  const vevents = (ics.match(/BEGIN:VEVENT/g) || []).length
  assert(vevents === events.length, `one VEVENT per event (${vevents}/${events.length})`)
  assert(ics.startsWith('BEGIN:VCALENDAR') && ics.endsWith('END:VCALENDAR\r\n'), 'well-formed document')
  assert((ics.match(/BEGIN:VEVENT/g) || []).length === (ics.match(/END:VEVENT/g) || []).length,
    'every VEVENT is closed')
  assert(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75),
    'every line respects the 75-octet fold limit')
  const uids = ics.split('\r\n').filter(l => l.startsWith('UID:'))
  assert(new Set(uids).size === uids.length, 'no duplicate UIDs across a real month')
}

console.log(failures === 0 ? '\nALL CALENDAR EPHEMERIS TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
