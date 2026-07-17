// Unit tests for planetary avasthas (src/core/avastha.js): Baladi boundaries,
// panchadha (compound) friendship, and Deeptadi/Jagradadi against the
// Indira Gandhi fixture positions (hand-derived expectations).
// Run: node tests/avastha.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const {
  calcBaladi, calcAvasthas, naturalRelation, temporalRelation, compoundRelation,
} = await import('../src/core/avastha.js')

console.log('\n[Baladi — degree bands & even-sign reversal]')
{
  assert(calcBaladi(1, 0).key === 'bala',      'odd sign 0° → Bala')
  assert(calcBaladi(1, 6).key === 'kumara',    'odd sign 6° → Kumara (band edge)')
  assert(calcBaladi(1, 14).key === 'yuva',     'odd sign 14° → Yuva')
  assert(calcBaladi(1, 29.99).key === 'mrita', 'odd sign 29.99° → Mrita')
  assert(calcBaladi(2, 0).key === 'mrita',     'even sign 0° → Mrita (reversed)')
  assert(calcBaladi(2, 14).key === 'yuva',     'even sign 14° → Yuva')
  assert(calcBaladi(2, 29.99).key === 'bala',  'even sign 29.99° → Bala')
}

console.log('\n[friendship — natural, temporal, compound]')
{
  assert(naturalRelation('Sun', 'Mars') === 'friend',      'Sun–Mars natural friends')
  assert(naturalRelation('Moon', 'Saturn') === 'neutral',  'Moon–Saturn natural neutral')
  assert(naturalRelation('Jupiter', 'Venus') === 'enemy',  'Jupiter–Venus natural enemies')
  assert(naturalRelation('Rahu', 'Sun') === null,          'nodes have no natural table')

  assert(temporalRelation(8, 5) === 'friend', 'planet 10 signs away → temporal friend')
  assert(temporalRelation(4, 10) === 'enemy', 'planet 7 signs away → temporal enemy')

  assert(compoundRelation('Sun', 'Mars', 8, 5) === 'great-friend',    'F + F → great friend')
  assert(compoundRelation('Moon', 'Saturn', 10, 4) === 'enemy',       'N + E → enemy')
  assert(compoundRelation('Jupiter', 'Venus', 2, 9) === 'great-enemy','E + E → great enemy')
  assert(compoundRelation('Mercury', 'Mars', 8, 5) === 'friend',      'N + F → friend')
  assert(compoundRelation('Sun', 'Saturn', 5, 6) === 'neutral',       'E + F → neutral')
}

console.log('\n[Indira Gandhi fixture — Deeptadi / Baladi / Jagradadi]')
{
  // Sidereal positions from jhora/Indira_Gandhi.md (sign 1–12, degree in sign).
  // combust flags follow the app's Parashari orbs (Mercury 9.1° from Sun → combust).
  const planets = [
    { name: 'Sun',     sign: 8,  degree:  4 + 7/60,  combust: false },
    { name: 'Moon',    sign: 10, degree:  5 + 35/60, combust: false },
    { name: 'Mars',    sign: 5,  degree: 16 + 22/60, combust: false },
    { name: 'Mercury', sign: 8,  degree: 13 + 14/60, combust: true  },
    { name: 'Jupiter', sign: 2,  degree: 14 + 59/60, combust: false },
    { name: 'Venus',   sign: 9,  degree: 21 + 0/60,  combust: false },
    { name: 'Saturn',  sign: 4,  degree: 21 + 47/60, combust: false },
    { name: 'Rahu',    sign: 9,  degree: 10 + 33/60, combust: false },
    { name: 'Ketu',    sign: 3,  degree: 10 + 33/60, combust: false },
  ]
  const av = calcAvasthas(planets)

  const exp = {
    //          deeptadi     baladi     jagradadi
    Sun:     ['mudita',   'mrita',   'svapna'],   // in great-friend Mars's sign
    Moon:    ['duhkhita', 'mrita',   'sushupti'], // Saturn compound-enemy dispositor
    Mars:    ['mudita',   'yuva',    'svapna'],   // in great-friend Sun's sign
    Mercury: ['kopa',     'yuva',    'svapna'],   // combust trumps residence
    Jupiter: ['vikala',   'yuva',    'sushupti'], // Venus great-enemy dispositor
    Venus:   ['duhkhita', 'vriddha', 'sushupti'], // Jupiter compound-enemy dispositor
    Saturn:  ['vikala',   'kumara',  'sushupti'], // Moon great-enemy dispositor
  }
  for (const [name, [deep, bal, jag]] of Object.entries(exp)) {
    const a = av[name]
    assert(a?.deeptadi.key === deep, `${name} Deeptadi = ${deep} (got ${a?.deeptadi.key})`)
    assert(a?.baladi.key === bal,    `${name} Baladi = ${bal} (got ${a?.baladi.key})`)
    assert(a?.jagradadi.key === jag, `${name} Jagradadi = ${jag} (got ${a?.jagradadi.key})`)
  }
  assert(av.Rahu === null && av.Ketu === null, 'nodes carry no avastha')
  assert(av.Sun.dispositor === 'Mars' && av.Sun.relation === 'great-friend', 'dispositor + relation exposed')
}

console.log('\n[Deeptadi precedence — dignity beats residence]')
{
  // Exalted Sun in Aries (dispositor Mars) → Deepta, not a friendship state.
  const planets = [
    { name: 'Sun',  sign: 1, degree: 10, combust: false },
    { name: 'Mars', sign: 1, degree: 20, combust: false },
    { name: 'Moon', sign: 8, degree: 3,  combust: false },
  ]
  const av = calcAvasthas(planets)
  assert(av.Sun.deeptadi.key === 'deepta',  'exalted → Deepta')
  assert(av.Moon.deeptadi.key === 'khala',  'debilitated → Khala')
  assert(av.Mars.deeptadi.key === 'svastha','own sign → Svastha')
  assert(av.Mars.dispositor === null,       'own sign → no dispositor relation')
  assert(av.Sun.jagradadi.key === 'jagrat' && av.Moon.jagradadi.key === 'sushupti',
    'Jagradadi: exalted awake, debilitated asleep')
}

console.log(failures === 0 ? '\nALL AVASTHA TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
