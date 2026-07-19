// Unit tests for the timeline data builders (src/core/timeline.js). Dasha and
// Sade Sati lanes are pure; the ingress/return scanners use a synthetic
// ephemeris. No WASM.
// Run: node tests/timeline.test.mjs

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.window ??= { innerWidth: 1200 }

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const {
  buildDashaLanes, buildSadeSatiLane, scanIngresses, planetaryReturns,
  dashaStackAt, planetColor, dateToJd, dashaSynchrony,
} = await import('../src/core/timeline.js')
const { functionalNature, housesRuled, isFunctionalBenefic } =
  await import('../src/content/functional-nature.js')

const d = iso => new Date(iso + 'T00:00:00Z')

console.log('\n[buildDashaLanes]')
{
  const dasha = [
    { planet: 'Sun', start: d('1917-11-19'), end: d('1919-11-15'), children: [
      { planet: 'Sun', start: d('1917-11-19'), end: d('1918-03-01'), children: [] },
      { planet: 'Moon', start: d('1918-03-01'), end: d('1918-09-01'), children: [] },
    ] },
    { planet: 'Moon', start: d('1919-11-15'), end: d('1929-11-15'), children: [] },
  ]
  const { md, ad } = buildDashaLanes(dasha)
  assert(md.length === 2, 'two MD bands')
  assert(md[0].planet === 'Sun' && md[0].color === planetColor('Sun'), 'MD band carries planet + colour')
  assert(md[0].start.getTime() === d('1917-11-19').getTime() && md[0].end.getTime() === d('1919-11-15').getTime(), 'MD band spans the period')
  assert(ad.length === 2, 'AD bands only for computed children (Sun MD had 2, Moon MD had none)')
  assert(ad[0].parent === 'Sun', 'AD band records its parent MD')

  assert(buildDashaLanes(null).md.length === 0, 'null tree → empty lanes, no throw')
}

console.log('\n[buildSadeSatiLane]')
{
  const report = { segments: [
    { kind: null, signName: 'Leo', start: d('2015-01-01'), end: d('2016-01-01') },
    { kind: 'sadesati', phase: 'rising', signName: 'Virgo', start: d('2016-01-01'), end: d('2018-01-01') },
    { kind: 'kantaka', phase: null, signName: 'Sagittarius', start: d('2030-01-01'), end: d('2032-01-01') },
  ] }
  const lane = buildSadeSatiLane(report)
  assert(lane.length === 2, 'only classified segments become bands')
  assert(lane[0].kind === 'sadesati' && lane[0].label.includes('rising'), 'Sade Sati band labels its phase')
  assert(lane[1].kind === 'kantaka', 'Kantaka band present')
  assert(lane.every(b => b.color), 'every band has a colour')
  assert(buildSadeSatiLane(null).length === 0, 'null report → empty lane')
}

console.log('\n[dashaStackAt]')
{
  const dasha = [
    { planet: 'Rahu', start: d('1966-01-01'), end: d('1984-01-01'), children: [
      { planet: 'Jupiter', start: d('1980-01-01'), end: d('1982-06-01'), children: [
        { planet: 'Saturn', start: d('1981-01-01'), end: d('1981-08-01'), children: [] },
      ] },
    ] },
  ]
  const s = dashaStackAt(dasha, d('1981-03-01'))
  assert(s.md === 'Rahu' && s.ad === 'Jupiter' && s.pd === 'Saturn', 'resolves MD/AD/PD at a date')
  const s2 = dashaStackAt(dasha, d('1990-01-01'))
  assert(s2.md === null, 'outside the tree → nulls')
}

// ── Synthetic ephemeris: linear bodies ──
const EPOCH = 2450000
// A body at `lon0` moving `rate`°/day.
const linear = (lon0, rate) => ({ lon0, rate })
const mkSwe = (bodies) => ({
  calc_ut(jd, id) {
    const b = bodies[id]
    if (!b) throw new Error('no body ' + id)
    const lon = ((b.lon0 + b.rate * (jd - EPOCH)) % 360 + 360) % 360
    return [lon, 0, 0, b.rate]
  },
})

console.log('\n[scanIngresses — synthetic]')
{
  // Saturn (id 6) at 15° Aries, 0.03°/day → 1000 d/sign; 8000 d → 8 ingresses.
  const swe = mkSwe({ 6: linear(15, 0.03) })
  const ing = scanIngresses(swe, 6, EPOCH, EPOCH + 8000)
  assert(ing.length === 8, `8 ingresses in 8000 days (${ing.length})`)
  assert(ing[0].fromSign === 1 && ing[0].sign === 2, 'first ingress Aries → Taurus')
  assert(Math.abs(ing[0].jd - (EPOCH + 500)) < 1, `first ingress at +500d (15° to leave Aries)`)
  assert(ing.every((e, i) => i === 0 || e.jd > ing[i - 1].jd), 'ingresses are chronological')
  assert(ing[0].signName === 'Taurus', 'ingress carries the sign name')
}

console.log('\n[scanIngresses — Ketu offset]')
{
  // Rahu id 10 at 0° Aries; Ketu = +180° = 0° Libra (sign 7).
  const swe = mkSwe({ 10: linear(0, -0.05) })  // nodes move retrograde
  const rahu = scanIngresses(swe, 10, EPOCH, EPOCH + 700)
  const ketu = scanIngresses(swe, 10, EPOCH, EPOCH + 700, { isKetu: true })
  assert(rahu.length >= 1 && ketu.length >= 1, 'both nodes produce ingresses')
  assert(rahu[0].sign !== ketu[0].sign, 'Ketu ingress is 180° from Rahu (different sign)')
}

console.log('\n[planetaryReturns — synthetic]')
{
  // Jupiter (id 5) at 100°, 360/4332 ≈ 0.0831°/day → returns every ~11.9y.
  const rate = 360 / 4332
  const swe = mkSwe({ 5: linear(100, rate) })
  // +100d margin so the 3rd return (at exactly +4332×3) sits inside the range,
  // not on the boundary where the final sample would miss it.
  const returns = planetaryReturns(swe, 5, 100, EPOCH, EPOCH + 4332 * 3 + 100)
  assert(returns.length === 3, `3 returns over 3 Jupiter cycles (${returns.length})`)
  const gap = returns[1].jd - returns[0].jd
  assert(Math.abs(gap - 4332) < 3, `returns ~4332d apart (got ${gap.toFixed(0)})`)
  assert(Math.abs((returns[0].jd - EPOCH) - 4332) < 3, 'first return one full cycle after epoch')
}

console.log('\n[dateToJd round-trip]')
{
  const jd = dateToJd(d('2000-01-01'))
  assert(Math.abs(jd - 2451544.5) < 1e-6, 'JD of 2000-01-01 00:00 UTC is 2451544.5')
}

console.log('\n[functional nature — classic yogakarakas]')
{
  // The textbook single-planet yogakarakas.
  assert(functionalNature('Mars', 4) === 'yogakaraka', 'Mars is yogakaraka for Cancer lagna (rules 5 & 10)')
  assert(functionalNature('Mars', 5) === 'yogakaraka', 'Mars is yogakaraka for Leo lagna (rules 4 & 9)')
  assert(functionalNature('Saturn', 2) === 'yogakaraka', 'Saturn is yogakaraka for Taurus lagna (rules 9 & 10)')
  assert(functionalNature('Saturn', 7) === 'yogakaraka', 'Saturn is yogakaraka for Libra lagna (rules 4 & 5)')
  assert(functionalNature('Venus', 10) === 'yogakaraka', 'Venus is yogakaraka for Capricorn lagna (rules 5 & 10)')
  assert(functionalNature('Venus', 11) === 'yogakaraka', 'Venus is yogakaraka for Aquarius lagna (rules 4 & 9)')

  // Lagna lord is benefic (1st-house rulership counts as a trikona and overrides
  // a simultaneous dusthana rulership).
  assert(functionalNature('Sun', 5) === 'benefic', 'Sun (Leo lagna lord) is benefic')
  assert(functionalNature('Mars', 1) === 'benefic', 'Mars for Aries rules 1 & 8 — the trikona(1) wins → benefic')
  // A pure dusthana lord with no trikona is malefic: Mercury for Aries rules 3 & 6.
  assert(functionalNature('Mercury', 1) === 'malefic', 'Mercury for Aries (3rd/6th lord) is malefic')

  // Rahu/Ketu → neutral (no rulership).
  assert(functionalNature('Rahu', 1) === 'neutral' && functionalNature('Ketu', 7) === 'neutral', 'nodes are neutral')

  // housesRuled sanity
  assert(housesRuled('Mars', 4).sort((a, b) => a - b).join() === '5,10', 'Mars rules the 5th & 10th from Cancer')
  assert(isFunctionalBenefic('Mars', 4) && !isFunctionalBenefic('Saturn', 5),
    'yogakaraka is benefic; a Leo-lagna Saturn (6th/7th lord) is not')
}

console.log('\n[dashaSynchrony]')
{
  const d = iso => new Date(iso + 'T00:00:00Z')
  // Person A: Cancer lagna (Mars yogakaraka). Person B: Leo lagna (Mars yogakaraka).
  const dashaA = [
    { planet: 'Mars',   start: d('2020-01-01'), end: d('2027-01-01'), children: [] }, // benefic for Cancer
    { planet: 'Rahu',   start: d('2027-01-01'), end: d('2045-01-01'), children: [] }, // neutral
  ]
  const dashaB = [
    { planet: 'Mars',    start: d('2018-01-01'), end: d('2025-01-01'), children: [] }, // benefic for Leo
    { planet: 'Saturn',  start: d('2025-01-01'), end: d('2044-01-01'), children: [] }, // Leo: 6th/7th lord → malefic
  ]
  const sync = dashaSynchrony(dashaA, 4, dashaB, 5, d('2021-01-01'), d('2030-01-01'))
  assert(sync.length >= 2, `produces overlap intervals (${sync.length})`)
  assert(sync.every(s => s.start < s.end), 'every interval has positive duration')
  assert(sync[0].tone === 'harmonious', 'both in yogakaraka-Mars → harmonious')

  // Find the interval where A=Mars(benefic) and B=Saturn(malefic for Leo) → mixed
  const mixed = sync.find(s => s.p1Lord === 'Mars' && s.p2Lord === 'Saturn')
  assert(mixed && mixed.tone === 'mixed', 'one benefic + one malefic → mixed')

  // Whole window is covered contiguously.
  const first = sync[0], last = sync[sync.length - 1]
  assert(first.start.getTime() === d('2021-01-01').getTime(), 'coverage starts at the window start')
  assert(last.end.getTime() === d('2030-01-01').getTime(), 'coverage ends at the window end')
  let contiguous = true
  for (let i = 1; i < sync.length; i++) if (sync[i].start.getTime() !== sync[i-1].end.getTime()) contiguous = false
  assert(contiguous, 'intervals tile the window with no gaps')

  assert(dashaSynchrony(null, 1, dashaB, 5, d('2021-01-01'), d('2030-01-01')).length === 0, 'null tree → empty')
}

console.log(failures === 0 ? '\nALL TIMELINE TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
