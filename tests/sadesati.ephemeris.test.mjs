// Real-ephemeris golden test for the Sade Sati scanner: verifies Saturn's
// sidereal (Lahiri) sign ingresses against documented dates, that retrograde
// re-entries are captured as separate phases inside one window, and that the
// 5-day scan step actually resolves the shortest real dips.
//
// Kept out of the fast `npm test` because it loads the 12 MB ephemeris.
// Run: npm run test:ephemeris

const SwissEph = (await import('swisseph-wasm')).default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0) // Lahiri — matches the app

const { calcSadeSati, scanSaturnSigns } = await import('../src/core/sadesati.js')

let failures = 0
const assert = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + msg); if (!cond) failures++ }

const jdOf = iso => Date.parse(iso) / 86400000 + 2440587.5
const fmt = d => (d instanceof Date ? d : new Date((d - 2440587.5) * 86400000)).toISOString().slice(0, 10)
const days = (a, b) => Math.abs(a - b)

console.log('\n[Saturn sidereal ingresses — known Lahiri dates]')
{
  const segs = scanSaturnSigns(jdOf('2015-01-01'), jdOf('2032-01-01'), { swe })
  // Widely published Lahiri ingress dates, incl. the 2022 retrograde return to Capricorn.
  const EXPECT = [
    [10, '2020-01-24', 'Capricorn'],
    [11, '2022-04-29', 'Aquarius'],
    [10, '2022-07-12', 'Aquarius → back to Capricorn (retrograde)'],
    [11, '2023-01-17', 'Aquarius again'],
    [12, '2025-03-29', 'Pisces'],
  ]
  for (const [sign, iso, label] of EXPECT) {
    const hit = segs.find(s => s.sign === sign && days(s.startJd, jdOf(iso)) < 2)
    assert(!!hit, `ingress → ${label} on ${iso}${hit ? ` (got ${fmt(hit.startJd)})` : ' — NOT FOUND'}`)
  }
}

console.log('\n[Sade Sati window — Moon in Aquarius]')
{
  // Saturn over Cp(12th) → Aq(1st) → Pi(2nd) from an Aquarius Moon.
  const res = calcSadeSati(11, {
    fromJd: jdOf('2015-01-01'), toJd: jdOf('2032-01-01'), swe, now: new Date('2024-06-01'),
  })
  const w = res.windows.find(x => x.current)
  assert(!!w, 'a Sade Sati window is running on 2024-06-01')
  assert(fmt(w.start) === '2020-01-24', `window opens at the Capricorn ingress (got ${fmt(w.start)})`)
  assert(fmt(w.end) === '2027-06-02', `window closes when Saturn leaves Pisces (got ${fmt(w.end)})`)

  const span = (w.endJd - w.startJd) / 365.25
  assert(Math.abs(span - 7.5) < 0.5, `window spans ~7.5 years (got ${span.toFixed(2)}y)`)

  // The 2022 retrograde bounce splits the phases: rising,peak,rising,peak,setting
  const phases = w.segments.map(s => s.phase).join(',')
  assert(phases === 'rising,peak,rising,peak,setting',
    `retrograde bounce shows as repeated phases inside ONE window (${phases})`)

  assert(res.current?.phase === 'peak' && res.current.signName === 'Aquarius',
    `2024-06-01 is the peak phase, Saturn over the natal Moon sign (got ${res.current?.phase})`)
}

console.log('\n[step resolution — the shortest real dips]')
{
  const from = jdOf('1990-01-01'), to = from + 90 * 365.25
  const fine   = scanSaturnSigns(from, to, { swe, stepDays: 1 })
  const actual = scanSaturnSigns(from, to, { swe })          // 5-day default
  assert(fine.length === actual.length,
    `the 5-day default finds every segment a 1-day scan does (${actual.length} vs ${fine.length})`)

  // A genuine 9.5-day retrograde dip into Libra — the shortest interior stay in
  // this 90-year span, and the reason the step must stay well under ~9 days.
  const dip = actual.find(s => s.sign === 7 && days(s.startJd, jdOf('2041-01-27')) < 2)
  assert(!!dip, `the 9.5-day Libra dip of Feb 2041 is resolved${dip ? ` (${fmt(dip.startJd)} → ${fmt(dip.endJd)})` : ''}`)
  assert(dip && (dip.endJd - dip.startJd) < 12, `…and is correctly measured as a brief stay (${dip ? (dip.endJd - dip.startJd).toFixed(1) : '?'}d)`)
}

console.log('\n[segments partition the scan range]')
{
  const from = jdOf('2000-01-01'), to = jdOf('2030-01-01')
  const segs = scanSaturnSigns(from, to, { swe })
  let contiguous = segs[0].startJd === from && segs.at(-1).endJd === to
  for (let i = 1; i < segs.length; i++) if (segs[i].startJd !== segs[i - 1].endJd) contiguous = false
  assert(contiguous, 'segments tile [from, to] with no gaps or overlaps')
  const adjacent = segs.every((s, i) => i === 0 || Math.abs(((s.sign - segs[i - 1].sign + 12) % 12)) === 1 ||
    ((segs[i - 1].sign - s.sign + 12) % 12) === 1)
  assert(adjacent, 'consecutive segments differ by exactly one sign (forward or retrograde)')
}

console.log(failures === 0 ? '\nALL SADESATI EPHEMERIS TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
