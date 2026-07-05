// Node smoke test for export payload + divisional/dasha logic (no browser, no WASM).
// Run: npm test  (or: node tests/export-payload.test.mjs)

// ── Browser global stubs (before importing app modules) ──
const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
globalThis.window = { innerWidth: 1200 }
globalThis.document = { querySelector: () => null, getElementById: () => null }

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

// ── Divisional tests ──
const { calcDivisional } = await import('../src/core/divisional.js')

console.log('\n[divisional]')
function tf(lon, key) {
  const { planets } = calcDivisional([{ lon, name: 'X' }], { lon: 0, sign: 1, degree: 0 }, key)
  return planets[0]
}

// D9: 10° Aries → 4th navamsa → Cancer (sign 4)
assert(tf(10, 'D9').sign === 4, 'D9: Aries 10° → Cancer')
// D9: 15° Cancer (lon 105) → part floor(15*9/30)=4, water seed Cancer(3) → 3+4=7 → Scorpio(8)
assert(tf(105, 'D9').sign === 8, 'D9: Cancer 15° → Scorpio')
// D60 counts from own sign: 1° Taurus (lon 31) → part floor(1*60/30)=2 → Taurus+2 = Cancer(4)
assert(tf(31, 'D60').sign === 4, 'D60: Taurus 1° → Cancer (own-sign seeded)')
// D60: 0°15' Aries → part 0 → Aries itself
assert(tf(0.25, 'D60').sign === 1, 'D60: Aries 0°15\' → Aries')
// D60: 29.9° Pisces (lon 359.9) → part 59 → (11+59)%12=10 → Aquarius(11)
assert(tf(359.9, 'D60').sign === 11, 'D60: Pisces 29.9° → Aquarius')
// All keys: sign 1..12, degree [0,30)
const keys = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D16','D20','D24','D27','D30','D40','D45','D60']
let ok = true
for (const key of keys) {
  for (let lon = 0.05; lon < 360; lon += 7.31) {
    const { sign, degree } = tf(lon, key)
    if (!(sign >= 1 && sign <= 12) || !(degree >= 0 && degree < 30.000001)) {
      ok = false; console.error('   bad', key, lon, sign, degree)
    }
  }
}
assert(ok, 'all divisionals: sign∈[1,12], degree∈[0,30) across full zodiac')

// ── Dasha (non-TSSY, no WASM needed) ──
const { calcDasha } = await import('../src/core/dasha.js')
console.log('\n[dasha]')
const moon = { lon: 123.456, nakshatraIndex: Math.floor(123.456 / (360 / 27)) }
const dasha = await calcDasha(moon, '1990-05-15')
assert(dasha.length === 9, '9 mahadashas')
assert(dasha.every(m => m.children.length >= 1), 'antardashas eagerly built')
assert(dasha.every(m => m.children.every(a => a.children.length === 0)), 'pratyantar initially lazy (empty)')
// First maha is the balance at birth: cycle spans 120y minus elapsed portion
const elapsed = ((123.456 % (360 / 27)) / (360 / 27)) * 7
const span = (dasha[8].end - dasha[0].start) / 86400000 / 365.256363004
assert(Math.abs(span - (120 - elapsed)) < 0.05, `cycle ≈ ${(120 - elapsed).toFixed(2)}y (got ${span.toFixed(2)})`)

// ── Dasha sandhi ──
const { getDashaSandhi } = await import('../src/core/dasha.js')
console.log('\n[dasha sandhi]')
{
  const now = new Date()
  const d = days => new Date(now.getTime() + days * 86400000)
  const node = (planet, startD, endD, children = []) => ({ planet, start: d(startD), end: d(endD), children })
  // Saturn maha 98% elapsed (ends in 20d of a 1020d period); its Mercury antar 96% elapsed
  const tree = [
    node('Saturn', -1000, 20, [node('Venus', -1000, -52), node('Mercury', -52, 2)]),
    node('Mercury', 20, 3000),
  ]
  const s = getDashaSandhi(tree)
  assert(s.some(x => x.level === 'Mahadasha' && x.planet === 'Saturn' && x.phase === 'ending' && x.nextPlanet === 'Mercury'),
    'maha ending sandhi detected with next lord')
  assert(s.some(x => x.level === 'Antardasha' && x.planet === 'Mercury' && x.phase === 'ending'),
    'antar ending sandhi detected')
  // Freshly begun maha
  const tree2 = [node('Venus', -3, 7000)]
  const s2 = getDashaSandhi(tree2)
  assert(s2.length === 1 && s2[0].phase === 'beginning', 'fresh maha flagged as beginning sandhi')
  // Mid-period → no sandhi
  const tree3 = [node('Venus', -3000, 3000)]
  assert(getDashaSandhi(tree3).length === 0, 'mid-period produces no sandhi')
  assert(getDashaSandhi(null).length === 0, 'handles missing tree')
}

// ── Yogas ──
const { detectYogas } = await import('../src/core/yogas.js')
console.log('\n[yogas]')
{
  // Crafted chart: Cancer lagna; Jupiter exalted in Cancer (house 1) → Hamsa +
  // Gaja-Kesari (with Moon in Cancer); Mars exalted in Capricorn (house 7) →
  // Ruchaka + Chandra-Mangala (mutual 7th aspect); Sun+Mercury in Leo → Budhaditya.
  const yLagna = { lon: 95, sign: 4, degree: 5 }
  const mk = (name, abbr, sign, lon) => ({ name, abbr, sign, lon, degree: lon % 30,
    house: ((sign - yLagna.sign + 12) % 12) + 1, combust: false })
  const yPlanets = [
    mk('Sun', 'Su', 5, 125), mk('Moon', 'Mo', 4, 100), mk('Mercury', 'Me', 5, 128),
    mk('Venus', 'Ve', 6, 155), mk('Mars', 'Ma', 10, 285), mk('Jupiter', 'Ju', 4, 97),
    mk('Saturn', 'Sa', 11, 310), mk('Rahu', 'Ra', 1, 10), mk('Ketu', 'Ke', 7, 190),
  ]
  const found = detectYogas(yPlanets, yLagna)
  const keys = new Set(found.map(y => y.key))
  assert(keys.has('mahapurusha-jupiter'), 'Hamsa: exalted Jupiter in kendra detected')
  assert(keys.has('mahapurusha-mars'), 'Ruchaka: exalted Mars in kendra detected')
  assert(keys.has('gaja-kesari'), 'Gaja-Kesari: Jupiter in kendra from Moon detected')
  assert(keys.has('budhaditya'), 'Budhaditya: Sun–Mercury conjunction detected')
  assert(keys.has('chandra-mangala'), 'Chandra-Mangala: Moon–Mars mutual aspect detected')
  assert(!keys.has('kemadruma'), 'Kemadruma not falsely detected (Jupiter with Moon)')
  assert(found.every(y => y.name && y.category && y.description), 'all yogas carry name/category/description')
  assert(detectYogas(null, null).length === 0, 'detectYogas handles missing data')
}

// ── Export payload ──
console.log('\n[export payload]')
// Simulate an OLD saved preset missing decimals/new sections (the NaN→null bug)
store.set('hora-prakash-export-presets', JSON.stringify([
  { id: 'p_old', name: 'Old preset', builtin: false,
    config: { sections: { planets: true, dasha: true }, planetFields: { nakshatra: true }, divisionals: { D1: true, D9: true }, dashaDepth: 3 } },
]))
store.set('hora-prakash-export-active-preset', 'p_old')

const { state } = await import('../src/state.js')
const exportMod = await import('../src/tabs/export.js')
const { buildPayload, normalizeConfig } = exportMod

// Fabricate a plausible state
const names = [['Sun','Su'],['Moon','Mo'],['Mercury','Me'],['Venus','Ve'],['Mars','Ma'],['Jupiter','Ju'],['Saturn','Sa'],['Rahu','Ra'],['Ketu','Ke']]
state.birth  = { name: 'Test Person', dob: '1990-05-15', tob: '06:30', lat: 28.61, lon: 77.21, timezone: '+05:30', location: 'New Delhi, India' }
state.lagna  = { lon: 95.5, sign: 4, degree: 5.5, house: 1, nakshatra: 'Pushya', nakshatraLord: 'Saturn', pada: 1 }
state.planets = names.map(([name, abbr], i) => {
  const lon = (i * 41.77 + 3.21) % 360
  return { id: i, name, abbr, lon, sign: Math.floor(lon / 30) + 1, degree: lon % 30,
    house: ((Math.floor(lon / 30) + 1 - state.lagna.sign + 12) % 12) + 1,
    nakshatra: 'Ashwini', nakshatraLord: 'Ketu', nakshatraIndex: 0, pada: 1,
    retrograde: i === 6, combust: i === 2, speed: 1.0 }
})
state.houses = Array.from({ length: 12 }, (_, i) => (95.5 + i * 30) % 360)
state.sripatiHouses = state.houses.slice()
state.dasha = dasha
state.panchang = { tithi: { num: 5, name: 'Panchami (Shukla)', percentLeft: 42.5 }, sunrise: new Date('1990-05-15T00:12:00Z'), sunset: new Date('1990-05-15T13:11:00Z') }
state.strength = {
  bhinna: { Sun: Array(12).fill(4), Moon: Array(12).fill(4), Lagna: Array(12).fill(4) },
  sarva: Array(12).fill(28),
  shadbala: { Sun: { sthanaBala: 100.1, digBala: 30, kalaBala: 90, chestaBala: 40, naisargikaBala: 60, drikBala: -5, total: 315.1, required: 390, ratio: 0.81 } },
}

// 1. normalizeConfig backfills the old preset
const cfg = normalizeConfig(JSON.parse(store.get('hora-prakash-export-presets'))[0].config)
assert(cfg.decimals === 4, 'normalize: missing decimals backfilled')
assert(cfg.strengthDetail === 'full', 'normalize: missing strengthDetail backfilled')
assert(cfg.sections.meta === true && cfg.sections.planets === true, 'normalize: sections merged')

// 2. full payload has no nulls-from-NaN, dates as ISO, pratyantar filled
const payload = await buildPayload(cfg)
const json = JSON.stringify(payload)
assert(!json.includes('null,null'), 'no NaN→null number arrays')
assert(payload.planets.length === 9, '9 planets exported')
assert(typeof payload.dasha[0].start === 'string' && payload.dasha[0].start.includes('T'), 'dasha dates serialized as ISO strings')
assert(payload.dasha.every(m => m.children.every(a => Array.isArray(a.children) && a.children.length === 9)),
  'depth-3 export: pratyantar levels computed (9 children per antar)')
assert(payload.dasha[0].children[0].children[0].children === undefined, 'depth-3 export: no level-4 leakage')
assert(payload.divisionals.D9 && payload.divisionals.D1, 'divisionals D1+D9 present')
assert(Array.isArray(payload.sripatiHouses) && payload.sripatiHouses.length === 12, 'sripatiHouses exported with houses section')
assert(Array.isArray(payload.yogas), 'yogas section exported')
assert(payload.divisionals.D9.planets.every(p => p.house >= 1 && p.house <= 12), 'divisional houses in 1..12')
const rounded = payload.planets.every(p => String(p.lon).split('.')[1]?.length <= 4 || Number.isInteger(p.lon))
assert(rounded, 'numbers rounded to 4 decimals')

// 3. strength totals mode
const cfgTotals = normalizeConfig({ strengthDetail: 'totals' })
const p2 = await buildPayload(cfgTotals)
assert(Array.isArray(p2.strength.sarva) && p2.strength.sarva.every(n => typeof n === 'number'),
  'totals mode: SAV stays a number array (was becoming [{}...])')
assert(p2.strength.shadbala.Sun.total === 315.1 && p2.strength.shadbala.Sun.sthanaBala === undefined,
  'totals mode: shadbala reduced to total/required/ratio')
const p3 = await buildPayload(normalizeConfig({ strengthDetail: 'none' }))
assert(p3.strength === undefined, 'none mode: strength omitted')

// 4. Chalit divisional exports without error (equal method fallback, no session)
const cfgChalit = normalizeConfig({})
const p4 = await buildPayload(cfgChalit)
assert(p4.divisionals.Chalit.planets.every(p => p.house >= 1 && p.house <= 12), 'Chalit divisional exports valid houses')

// 5. round-trip: JSON parses
assert(JSON.parse(JSON.stringify(payload)) !== null, 'payload JSON round-trips')

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
