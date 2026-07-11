// Unit tests for the Purnimanta lunar-date model: tithi, sankranti-based amanta
// month naming, Adhika (Purushottam) masa detection, and the birthday finder.
// Pure pieces run without WASM; the finder runs against a synthetic ephemeris.
// Run: node tests/lunar-birthday.test.mjs

globalThis.window = { innerWidth: 1200 }
globalThis.document = { querySelector: () => null, getElementById: () => null }

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const {
  deriveTithi, amantaNameAndAdhika, purnimantaIndex, MONTH_NAMES,
  amantaMonth, computeLunarBirthday,
} = await import('../src/core/lunar-birthday.js')
const { toJulianDay } = await import('../src/utils/time.js')

console.log('\n[tithi + paksha]')
{
  const p = deriveTithi(0, 54)   // diff 54° → 5th tithi
  assert(p.paksha === 'Shukla' && p.tithiName === 'Panchami', 'diff 54° → Shukla Panchami')
  const k = deriveTithi(135, 45) // diff 270° → Krishna Ashtami
  assert(k.paksha === 'Krishna' && k.tithiName === 'Ashtami', 'diff 270° → Krishna Ashtami')
  assert(deriveTithi(0, 170).tithiName === 'Purnima', 'diff 170° → Purnima')
  assert(deriveTithi(0, 350).tithiName === 'Amavasya', 'diff 350° → Amavasya')
}

console.log('\n[amanta month naming — sidereal sankranti]')
{
  // rashi at starting new moon → month = (rashi + 1) mod 12
  assert(amantaNameAndAdhika(11, 0).amantaIndex === 0, 'Sun in Meena at NM → Chaitra')
  assert(MONTH_NAMES[amantaNameAndAdhika(11, 0).amantaIndex] === 'Chaitra', 'Chaitra name')
  assert(amantaNameAndAdhika(0, 1).amantaIndex === 1, 'Sun in Mesha at NM → Vaishakha')
  assert(MONTH_NAMES[amantaNameAndAdhika(3, 4).amantaIndex] === 'Shravana', 'Sun Karka→Simha → Shravana')
}

console.log('\n[Adhika (Purushottam) masa detection]')
{
  // No sankranti during the month (same rashi at both new moons) → Adhika.
  const adhika = amantaNameAndAdhika(3, 3)  // Karka both ends → Adhika Shravana
  assert(adhika.isAdhika === true, 'no sankranti → Adhika')
  assert(MONTH_NAMES[adhika.amantaIndex] === 'Shravana', 'Adhika repeats following month name (Shravana)')
  const nija = amantaNameAndAdhika(3, 4)     // Karka → Simha → Nija Shravana
  assert(nija.isAdhika === false, 'sankranti present → Nija')
  assert(MONTH_NAMES[nija.amantaIndex] === 'Shravana', 'Nija Shravana follows the Adhika one')
}

console.log('\n[Purnimanta shift]')
{
  assert(purnimantaIndex(4, 'Shukla') === 4, 'Shukla: Purnimanta == amanta')
  assert(MONTH_NAMES[purnimantaIndex(4, 'Krishna')] === 'Bhadrapada', 'Krishna: Shravana(amanta) → Bhadrapada (Janmashtami)')
  assert(purnimantaIndex(11, 'Krishna') === 0, 'Krishna wrap: Phalguna → Chaitra')
}

// ── Finder against a synthetic linear ephemeris ──
// Moon 13.176°/day; sidereal == tropical. Sun rate is a knob: the real ~0.986°/d
// gives a ~29.53 d synodic month; a slower sun packs less solar motion into each
// month so Adhika (no-sankranti) months occur often — exercising that path.
const EPOCH = 2447892.5
const mkSwe = sunRate => ({
  calc_ut(jd, body) {
    const sun  = ((100 + sunRate * (jd - EPOCH)) % 360 + 360) % 360
    const moon = ((200 + 13.176  * (jd - EPOCH)) % 360 + 360) % 360
    return body === 0 ? [sun, 0, 0, sunRate] : [moon, 0, 0, 13.176]
  },
  // no SweModule → sunrise falls back to ~06:00 local
})

console.log('\n[birthday finder — synthetic ephemeris]')
{
  const fakeSwe = mkSwe(0.98565)
  const tithiIdxAt = jd => Math.floor(((((fakeSwe.calc_ut(jd,1)[0] - fakeSwe.calc_ut(jd,0)[0]) % 360) + 360) % 360) / 12)
  const birth = { dob: '1990-08-14', tob: '12:00', timezone: '+05:30', lat: 28.6, lon: 77.2 }
  const birthJd = toJulianDay(birth.dob, birth.tob, birth.timezone)
  const birthTithiIdx = tithiIdxAt(birthJd)

  const { lunar, upcoming } = computeLunarBirthday(birth, { swe: fakeSwe, today: new Date(Date.UTC(2026,0,1)), years: 10 })

  assert(upcoming.length >= 10 && upcoming.length <= 14, `emits ~10 birthdays (${upcoming.length})`)

  let monotonic = true, tithiOk = true, monthOk = true, nijaOnly = true
  let prev = 0
  for (const u of upcoming) {
    if (u.date.getTime() <= prev) monotonic = false
    prev = u.date.getTime()
    const dayStart = toJulianDay(u.iso, '00:00', birth.timezone)
    const t = tithiIdxAt(dayStart + 0.25)
    if (t !== birthTithiIdx && tithiIdxAt(dayStart + 0.5) !== birthTithiIdx) tithiOk = false
    const am = amantaMonth(fakeSwe, dayStart + 0.5)
    if (am.amantaIndex !== lunar.monthIndexAmanta) monthOk = false  // right month name
    if (am.isAdhika) nijaOnly = false                                // never Adhika
  }
  assert(monotonic, 'dates are strictly increasing')
  assert(tithiOk, 'each date carries the birth tithi')
  assert(monthOk, 'each date falls in a month of the birth month name')
  assert(nijaOnly, 'each date is a regular (Nija) month, never Adhika')
}

// Dharma Sindhu: a birth in an Adhika masa is still observed in the regular
// (Nija) month every year — the Adhika month is never used for the birthday.
console.log('\n[birthday finder — born in Adhika → observe in Nija]')
{
  const swe = mkSwe(0.72)  // frequent Adhika months
  // Find a synthetic birth inside an Adhika masa, on a mid-month tithi so the
  // independent re-check below isn't confused by the Amavasya/new-moon boundary.
  let birth = null
  for (let d = 1; d <= 400 && !birth; d++) {
    const iso = new Date(Date.UTC(1987, 0, d)).toISOString().slice(0, 10)
    const cand = { dob: iso, tob: '12:00', timezone: '+05:30', lat: 28.6, lon: 77.2 }
    const jd = toJulianDay(cand.dob, cand.tob, cand.timezone)
    const tIdx = Math.floor(((((swe.calc_ut(jd,1)[0] - swe.calc_ut(jd,0)[0]) % 360) + 360) % 360) / 12)
    if (tIdx >= 5 && tIdx <= 24 && amantaMonth(swe, jd).isAdhika) birth = cand
  }
  assert(!!birth, 'found a synthetic birth inside an Adhika masa')

  const { lunar, upcoming } = computeLunarBirthday(birth, { swe, today: new Date(Date.UTC(2026,0,1)), years: 10 })
  assert(lunar.isAdhika === true, 'birth is flagged as Adhika')
  assert(upcoming.length >= 3, `still yields upcoming (Nija) dates (${upcoming.length})`)
  const allNija = upcoming.every(u => {
    const am = amantaMonth(swe, toJulianDay(u.iso, '00:00', birth.timezone) + 0.5)
    return am.isAdhika === false && am.amantaIndex === lunar.monthIndexAmanta
  })
  assert(allNija, 'every observed date is the regular (Nija) month, never the Adhika month')
}

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nALL LUNAR BIRTHDAY TESTS PASSED')
