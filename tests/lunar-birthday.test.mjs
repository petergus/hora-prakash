// Unit test for the pure Purnimanta lunar-date derivation (no WASM/ephemeris).
// Run: node tests/lunar-birthday.test.mjs

// ── Browser global stubs (before importing app modules) ──
globalThis.window = { innerWidth: 1200 }
globalThis.document = { querySelector: () => null, getElementById: () => null }

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { deriveLunarDate, computeLunarBirthday } = await import('../src/core/lunar-birthday.js')
const { toJulianDay } = await import('../src/utils/time.js')

console.log('\n[lunar birthday — Purnimanta derivation]')

// Shukla paksha keeps the same month in both systems.
// Sun 0° (Aries → Chaitra), Moon 54° → diff 54° → tithi 5 (Shukla Panchami).
{
  const d = deriveLunarDate(0, 54)
  assert(d.paksha === 'Shukla', 'Shukla paksha detected')
  assert(d.tithiName === 'Panchami', 'tithi 5 → Panchami')
  assert(d.monthName === 'Chaitra' && d.monthNameAmanta === 'Chaitra', 'Shukla: Purnimanta month == Amanta month')
  assert(d.label === 'Chaitra Shukla Panchami', 'label: Chaitra Shukla Panchami')
}

// Krishna paksha shifts to the *following* month in Purnimanta.
// Sun 135° (Leo → Amanta Shravana), diff 270° → Krishna Ashtami.
// Janmashtami convention: Shravana (Amanta) == Bhadrapada (Purnimanta).
{
  const d = deriveLunarDate(135, 45)
  assert(d.paksha === 'Krishna', 'Krishna paksha detected')
  assert(d.tithiName === 'Ashtami', 'diff 270° → Ashtami')
  assert(d.monthNameAmanta === 'Shravana', 'Amanta month is Shravana')
  assert(d.monthName === 'Bhadrapada', 'Krishna: Purnimanta month == Amanta + 1 (Bhadrapada)')
  assert(d.label === 'Bhadrapada Krishna Ashtami', 'label: Bhadrapada Krishna Ashtami')
}

// Purnima (tithi 15) is Shukla; Amavasya (tithi 30) is Krishna (→ +1 month).
{
  const purnima = deriveLunarDate(0, 170)
  assert(purnima.tithiName === 'Purnima' && purnima.paksha === 'Shukla', 'diff 170° → Shukla Purnima')
  const amavasya = deriveLunarDate(0, 350)
  assert(amavasya.tithiName === 'Amavasya' && amavasya.paksha === 'Krishna', 'diff 350° → Krishna Amavasya')
  assert(amavasya.monthName === 'Vaisakha', 'Amavasya after Chaitra → Purnimanta Vaisakha')
}

// Krishna paksha wraps Phalguna (11) → Chaitra (0). (Holi: Phalguna Purnima, then
// Chaitra Krishna paksha in Purnimanta.)
{
  const d = deriveLunarDate(330, 240)
  assert(d.monthNameAmanta === 'Phalguna', 'Amanta Phalguna')
  assert(d.monthName === 'Chaitra', 'Krishna wrap: Phalguna + 1 → Chaitra')
}

// ── Birthday finder (synthetic linear ephemeris; validates mechanics, not
//    astronomical accuracy — no adhika masa / equation-of-centre here) ──
console.log('\n[lunar birthday — upcoming-date finder]')
{
  const EPOCH = 2447892.5
  const fakeSwe = {
    calc_ut(jd, body) {
      const sun  = ((100 + 0.98565 * (jd - EPOCH)) % 360 + 360) % 360
      const moon = ((200 + 13.176  * (jd - EPOCH)) % 360 + 360) % 360
      return body === 0 ? [sun, 0, 0, 0.98565] : [moon, 0, 0, 13.176]
    },
    // no SweModule → the sunrise call fails safely and falls back to ~06:00 local
  }
  const birth = { dob: '1990-08-14', tob: '12:00', timezone: '+05:30', lat: 28.6, lon: 77.2 }
  const birthJd = toJulianDay(birth.dob, birth.tob, birth.timezone)
  const birthTithiIdx = deriveLunarDate(fakeSwe.calc_ut(birthJd, 0)[0], fakeSwe.calc_ut(birthJd, 1)[0]).tithiIdx

  const { upcoming } = computeLunarBirthday(birth, { swe: fakeSwe, today: new Date(Date.UTC(2026, 0, 1)), years: 10 })
  assert(upcoming.length === 10, 'finds 10 upcoming birthdays')

  let consecutive = true, tithiMatches = true, inSeason = true, prevY = 2025
  for (const u of upcoming) {
    if (u.year !== prevY + 1) consecutive = false
    prevY = u.year
    if (u.month < 7 || u.month > 9) inSeason = false  // anchored near the Aug 14 solar return
    const dayStart = toJulianDay(u.iso, '00:00', birth.timezone)
    const t6  = deriveLunarDate(fakeSwe.calc_ut(dayStart + 0.25, 0)[0], fakeSwe.calc_ut(dayStart + 0.25, 1)[0]).tithiIdx
    const t12 = deriveLunarDate(fakeSwe.calc_ut(dayStart + 0.5,  0)[0], fakeSwe.calc_ut(dayStart + 0.5,  1)[0]).tithiIdx
    if (t6 !== birthTithiIdx && t12 !== birthTithiIdx) tithiMatches = false
  }
  assert(consecutive, 'upcoming years are consecutive')
  assert(inSeason, 'dates stay anchored to the solar anniversary season')
  assert(tithiMatches, 'each chosen day carries the birth tithi')
}

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nALL LUNAR BIRTHDAY TESTS PASSED')
