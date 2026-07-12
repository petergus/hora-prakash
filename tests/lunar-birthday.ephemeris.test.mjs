// Real-ephemeris golden test for the Purnimanta lunar-date model. Unlike the
// other suites this loads the actual Swiss Ephemeris WASM (Node-native) and
// checks against documented festival dates, so it is NOT part of the fast
// `npm test`. Run: npm run test:ephemeris
//
// References are Lahiri-ayanamsa panchang dates for New Delhi. Sunrise-tithi
// (udaya vyapini) festivals are sampled near sunrise; Maha Shivaratri is a
// nishita (midnight) festival and is checked at night on purpose.

const SwissEph = (await import('swisseph-wasm')).default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0)  // Lahiri — matches the app (src/core/swisseph.js)

const { deriveTithi, amantaMonth, purnimantaIndex, MONTH_NAMES, computeLunarBirthday } =
  await import('../src/core/lunar-birthday.js')
const { toJulianDay } = await import('../src/utils/time.js')

const TROP = 2 | 256
const SID  = 2 | 65536 | 256
const DELHI = { lat: 28.6139, lon: 77.209, tz: '+05:30' }

let failures = 0
const assert = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + msg); if (!cond) failures++ }

function lunarAt(dateStr, timeStr) {
  const jd = toJulianDay(dateStr, timeStr, DELHI.tz)
  const tithi = deriveTithi(swe.calc_ut(jd, 0, TROP)[0], swe.calc_ut(jd, 1, TROP)[0])
  const am = amantaMonth(swe, jd)
  return {
    ...tithi, isAdhika: am.isAdhika,
    amanta: MONTH_NAMES[am.amantaIndex],
    purnimanta: MONTH_NAMES[purnimantaIndex(am.amantaIndex, tithi.paksha)],
    str: `${MONTH_NAMES[purnimantaIndex(am.amantaIndex, tithi.paksha)]}${am.isAdhika ? ' (Adhika)' : ''} ${tithi.paksha} ${tithi.tithiName}`,
  }
}
const sidRashi = (dateStr, timeStr) =>
  Math.floor((((swe.calc_ut(toJulianDay(dateStr, timeStr, DELHI.tz), 0, SID)[0] % 360) + 360) % 360) / 30)

console.log('\n[sidereal Sun — Makar Sankranti (Sun enters Makara = rashi 9)]')
assert(sidRashi('2024-01-14', '12:00') === 8, 'Jan 14 2024 → Dhanu (8)')
assert(sidRashi('2024-01-15', '18:00') === 9, 'Jan 15 2024 eve → Makara (9)')

console.log('\n[sunrise-tithi festivals 2024 → Purnimanta masa / paksha / tithi]')
for (const [name, d, t, mo, pk, ti] of [
  ['Rama Navami',      '2024-04-17', '06:00', 'Chaitra',    'Shukla',  'Navami'],
  ['Hanuman Jayanti',  '2024-04-23', '06:00', 'Chaitra',    'Shukla',  'Purnima'],
  ['Akshaya Tritiya',  '2024-05-10', '06:00', 'Vaisakha',   'Shukla',  'Tritiya'],
  ['Guru Purnima',     '2024-07-21', '06:00', 'Ashadha',    'Shukla',  'Purnima'],
  ['Janmashtami',      '2024-08-26', '05:30', 'Bhadrapada', 'Krishna', 'Ashtami'],
  ['Ganesh Chaturthi', '2024-09-07', '06:00', 'Bhadrapada', 'Shukla',  'Chaturthi'],
  ['Kartik Purnima',   '2024-11-15', '06:30', 'Kartika',    'Shukla',  'Purnima'],
]) {
  const r = lunarAt(d, t)
  assert(r.purnimanta === mo && r.paksha === pk && r.tithiName === ti, `${name} ${d} → ${mo} ${pk} ${ti}  (${r.str})`)
}

console.log('\n[Maha Shivaratri 2024 — nishita (midnight), not sunrise]')
assert(lunarAt('2024-03-08', '06:30').tithiName === 'Trayodashi', 'sunrise → Trayodashi (festival is at night)')
assert(lunarAt('2024-03-08', '23:30').tithiName === 'Chaturdashi', 'midnight → Krishna Chaturdashi')

console.log('\n[Adhika (Purushottam) masa — real Adhika Shravana was ~18 Jul–16 Aug 2023]')
assert(lunarAt('2023-08-01', '12:00').isAdhika === true, 'Aug 1 2023 is Adhika')
assert(lunarAt('2023-08-01', '12:00').amanta === 'Shravana', 'Aug 1 2023 Adhika month is Shravana')
assert(lunarAt('2023-08-25', '12:00').isAdhika === false, 'Aug 25 2023 is the Nija (regular) month')

console.log('\n[finder — Shravana-born; observed in Nija, 2023 flagged leap]')
const birth = { dob: '1985-09-07', tob: '05:30', timezone: DELHI.tz, lat: DELHI.lat, lon: DELHI.lon }
const { lunar, upcoming } = computeLunarBirthday(birth, { swe, today: new Date(Date.UTC(2023, 0, 1)), years: 5 })
assert(lunar.monthNameAmanta === 'Shravana', 'birth amanta month is Shravana')
const byYear = Object.fromEntries(upcoming.map(u => [u.year, u]))
// Documented Krishna Janmashtami dates (janma-tithi / udaya reckoning).
assert(byYear[2024]?.iso === '2024-08-26', `2024 observed ${byYear[2024]?.iso} (expect 2024-08-26)`)
assert(byYear[2025]?.iso === '2025-08-16', `2025 observed ${byYear[2025]?.iso} (expect 2025-08-16)`)
assert(byYear[2026]?.iso === '2026-09-04', `2026 observed ${byYear[2026]?.iso} (expect 2026-09-04)`)
assert(byYear[2023]?.leapMonth === true, '2023 flagged as a leap (Adhika Shravana) year')
assert(upcoming.every(u => {
  const am = amantaMonth(swe, toJulianDay(u.iso, '00:00', DELHI.tz) + 0.25)
  return !am.isAdhika
}), 'every observed date is a Nija month, never Adhika')

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1) }
console.log('\nALL REAL-EPHEMERIS CHECKS PASSED')
