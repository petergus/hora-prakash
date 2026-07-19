// Real-ephemeris test for the timeline scanners (src/core/timeline.js): the
// slow-planet sign-ingress scanner against published Lahiri dates, and the
// return scanner's cluster-collapsing (retrograde re-crossings and the
// birth-adjacent wobble must NOT each become a marker).
//
// Kept out of the fast `npm test` because it loads the 12 MB ephemeris.
// Run: npm run test:ephemeris

const SwissEph = (await import('swisseph-wasm')).default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0) // Lahiri

const { scanIngresses, planetaryReturns, buildTransitMarkers } = await import('../src/core/timeline.js')

let failures = 0
const assert = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + msg); if (!cond) failures++ }
const jdOf = iso => Date.parse(iso) / 86400000 + 2440587.5
const fmt = d => d.toISOString().slice(0, 10)
const days = (a, b) => Math.abs(a - b)

console.log('\n[Saturn sign ingresses — published Lahiri dates]')
{
  const ing = scanIngresses(swe, 6, jdOf('2015-01-01'), jdOf('2028-01-01'))
  const has = (sign, iso) => ing.some(e => e.signName === sign && days(e.jd, jdOf(iso)) < 2)
  assert(has('Capricorn', '2020-01-24'), 'Saturn → Capricorn on 2020-01-24')
  assert(has('Aquarius',  '2022-04-29'), 'Saturn → Aquarius on 2022-04-29')
  assert(has('Capricorn', '2022-07-12'), 'Saturn retrogrades back to Capricorn on 2022-07-12')
  assert(has('Pisces',    '2025-03-29'), 'Saturn → Pisces on 2025-03-29')
  assert(has('Aries',     '2027-06-02'), 'Saturn → Aries on 2027-06-02')
  assert(ing.every((e, i) => i === 0 || e.jd > ing[i - 1].jd), 'ingresses are chronological')
}

console.log('\n[Rahu ingresses move retrograde]')
{
  const ing = scanIngresses(swe, 10, jdOf('2020-01-01'), jdOf('2024-01-01'))
  assert(ing.length >= 2, `Rahu changes sign within 4 years (${ing.length})`)
  // Rahu is retrograde, so it enters signs in DESCENDING order.
  const desc = ing.every((e, i) => i === 0 || ((ing[i - 1].sign - e.sign + 12) % 12) === 1)
  assert(desc, 'Rahu ingresses step backward one sign at a time')
}

console.log('\n[Saturn returns — clusters collapse to one marker each]')
{
  const natalSat = swe.calc_ut(jdOf('1958-06-15'), 6, 65536 | 256)[0]
  const rets = planetaryReturns(swe, 6, natalSat, jdOf('1958-06-15'), jdOf('2050-01-01'))
  assert(rets.length === 3, `three Saturn returns in 92 years, not the raw retrograde crossings (${rets.length}: ${rets.map(r => fmt(r.date)).join(', ')})`)
  // First return ~29.4 years after birth; spacing ~29.4 years.
  assert(Math.abs((rets[0].jd - jdOf('1958-06-15')) / 365.25 - 29.4) < 1, `first return ~29.4y after birth (${fmt(rets[0].date)})`)
  const gap = (rets[1].jd - rets[0].jd) / 365.25
  assert(Math.abs(gap - 29.4) < 0.6, `returns ~29.4y apart (got ${gap.toFixed(2)}y)`)
  // No marker inside the first year (the birth-adjacent wobble must be dropped).
  assert(!rets.some(r => (r.jd - jdOf('1958-06-15')) < 400), 'no birth-adjacent false return')
}

console.log('\n[Jupiter returns ~11.9y apart]')
{
  const natalJup = swe.calc_ut(jdOf('1958-06-15'), 5, 65536 | 256)[0]
  const rets = planetaryReturns(swe, 5, natalJup, jdOf('1958-06-15'), jdOf('2006-01-01'))
  assert(rets.length === 4, `~4 Jupiter returns in 48 years (${rets.length})`)
  const gap = (rets[1].jd - rets[0].jd) / 365.25
  assert(Math.abs(gap - 11.9) < 0.7, `Jupiter returns ~11.9y apart (got ${gap.toFixed(2)}y)`)
}

console.log('\n[buildTransitMarkers integrates the set]')
{
  const natalPlanets = [
    { name: 'Jupiter', lon: swe.calc_ut(jdOf('1958-06-15'), 5, 65536 | 256)[0] },
    { name: 'Saturn',  lon: swe.calc_ut(jdOf('1958-06-15'), 6, 65536 | 256)[0] },
  ]
  const markers = buildTransitMarkers(natalPlanets, jdOf('1958-06-15'), jdOf('2050-01-01'), swe)
  assert(markers.length > 0, `produces markers (${markers.length})`)
  assert(markers.every((m, i) => i === 0 || m.date >= markers[i - 1].date), 'markers are chronological')
  assert(markers.some(m => m.kind === 'ingress' && m.planet === 'Saturn'), 'includes Saturn ingresses')
  assert(markers.some(m => m.kind === 'return' && m.planet === 'Saturn'), 'includes Saturn returns')
  assert(markers.some(m => m.kind === 'return' && m.planet === 'Jupiter'), 'includes Jupiter returns')
  assert(markers.every(m => m.color && m.label && m.date instanceof Date), 'every marker is well-formed')
}

console.log(failures === 0 ? '\nALL TIMELINE EPHEMERIS TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
