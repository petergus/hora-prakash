// Golden fixture test against JHora reference output (jhora/Indira_Gandhi.md).
// Verifies D1/D9 divisional placements, nakshatra/pada, and Vimshottari balance
// against Jagannatha Hora's published values. Pure math — no browser, no WASM.
// Run: npm test  (or: node tests/jhora-golden.test.mjs)

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.window ??= { innerWidth: 1200 }
globalThis.document ??= { querySelector: () => null, getElementById: () => null }

const { calcDivisional } = await import('../src/core/divisional.js')
const { getNakshatraInfo } = await import('../src/core/calculations.js')
const { calcDasha } = await import('../src/core/dasha.js')
const { toJulianDay } = await import('../src/utils/time.js')

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const SIGN = { Ar:1, Ta:2, Ge:3, Cn:4, Le:5, Vi:6, Li:7, Sc:8, Sg:9, Cp:10, Aq:11, Pi:12 }
const lon = (sign, d, m, s) => (SIGN[sign] - 1) * 30 + d + m / 60 + s / 3600

// JHora: Indira Gandhi, 1917-11-19 23:11 IST, 25N27 81E51, Lahiri.
// Columns from the "Planetry Position" table: sidereal longitude, Rasi, Navamsa.
const FIXTURE = [
  //  name        longitude                      rasi navamsa  nakshatra          pada
  { name: 'Lagna',   lon: lon('Cn', 27, 22, 38.31), rasi: 'Cn', d9: 'Pi', nak: 'Ashlesha',        pada: 4 },
  { name: 'Sun',     lon: lon('Sc',  4,  7, 51.48), rasi: 'Sc', d9: 'Le', nak: 'Anuradha',        pada: 1 },
  { name: 'Moon',    lon: lon('Cp',  5, 35, 17.97), rasi: 'Cp', d9: 'Aq', nak: 'Uttara Ashadha',  pada: 3 },
  { name: 'Mars',    lon: lon('Le', 16, 22, 46.03), rasi: 'Le', d9: 'Le', nak: 'Purva Phalguni',  pada: 1 },
  { name: 'Mercury', lon: lon('Sc', 13, 14, 31.25), rasi: 'Sc', d9: 'Li', nak: 'Anuradha',        pada: 3 },
  { name: 'Jupiter', lon: lon('Ta', 14, 59, 55.70), rasi: 'Ta', d9: 'Ta', nak: 'Rohini',          pada: 2 },
  { name: 'Venus',   lon: lon('Sg', 21,  0, 36.20), rasi: 'Sg', d9: 'Li', nak: 'Purva Ashadha',   pada: 3 },
  { name: 'Saturn',  lon: lon('Cn', 21, 47, 16.74), rasi: 'Cn', d9: 'Cp', nak: 'Ashlesha',        pada: 2 },
  { name: 'Rahu',    lon: lon('Sg', 10, 33, 55.86), rasi: 'Sg', d9: 'Cn', nak: 'Mula',            pada: 4 },
  { name: 'Ketu',    lon: lon('Ge', 10, 33, 55.86), rasi: 'Ge', d9: 'Cp', nak: 'Ardra',           pada: 2 },
]

console.log('\n[JHora golden — D1 / D9]')
{
  const planets = FIXTURE.map(f => ({ name: f.name, lon: f.lon }))
  const lagna = { lon: FIXTURE[0].lon, sign: SIGN[FIXTURE[0].rasi], degree: FIXTURE[0].lon % 30 }

  const d1 = calcDivisional(planets, lagna, 'D1')
  const d9 = calcDivisional(planets, lagna, 'D9')

  let d1ok = true, d9ok = true
  FIXTURE.forEach((f, i) => {
    if (d1.planets[i].sign !== SIGN[f.rasi]) { d1ok = false; console.error(`   D1 ${f.name}: got ${d1.planets[i].sign}, JHora ${SIGN[f.rasi]}`) }
    if (d9.planets[i].sign !== SIGN[f.d9])   { d9ok = false; console.error(`   D9 ${f.name}: got ${d9.planets[i].sign}, JHora ${SIGN[f.d9]}`) }
  })
  assert(d1ok, 'all 10 bodies match JHora rasi (D1)')
  assert(d9ok, 'all 10 bodies match JHora navamsa (D9)')
  assert(d9.lagna.sign === SIGN[FIXTURE[0].d9], 'lagna navamsa matches JHora (Pisces)')
}

console.log('\n[JHora golden — nakshatra/pada]')
{
  let ok = true
  for (const f of FIXTURE) {
    const info = getNakshatraInfo(f.lon)
    if (info.name !== f.nak || info.pada !== f.pada) {
      ok = false
      console.error(`   ${f.name}: got ${info.name} p${info.pada}, JHora ${f.nak} p${f.pada}`)
    }
  }
  assert(ok, 'all nakshatras and padas match JHora')
}

console.log('\n[JHora golden — Vimshottari balance]')
{
  // JHora: Sun mahadasha (birth balance) ends 1919-11-15 05:12 IST.
  const moonLon = FIXTURE[2].lon
  const moon = { lon: moonLon, nakshatraIndex: getNakshatraInfo(moonLon).index }
  const jd = toJulianDay('1917-11-19', '23:11', '+05:30')
  const dasha = await calcDasha(moon, '1917-11-19', { jd })

  assert(dasha[0].planet === 'Sun', 'first mahadasha is Sun (Uttara Ashadha moon)')
  const order = dasha.map(m => m.planet).join(',')
  assert(order === 'Sun,Moon,Mars,Rahu,Jupiter,Saturn,Mercury,Ketu,Venus',
    'mahadasha sequence matches JHora')

  // JHora computes boundaries with true solar years; the app default is the
  // mean sidereal year — allow a 2-day tolerance on a ~2-year balance.
  const jhoraSunEnd = Date.UTC(1919, 10, 15) - 5.5 * 3600000 + 5.2 * 3600000
  const diffDays = Math.abs(dasha[0].end.getTime() - jhoraSunEnd) / 86400000
  assert(diffDays < 2, `Sun dasha balance end within 2 days of JHora (diff ${diffDays.toFixed(2)}d)`)

  const venusEnd = dasha[8].end
  const jhoraVenusEnd = Date.UTC(2033, 10, 15)
  const diffDays2 = Math.abs(venusEnd.getTime() - jhoraVenusEnd) / 86400000
  assert(diffDays2 < 5, `full 120y cycle end within 5 days of JHora (diff ${diffDays2.toFixed(2)}d)`)
}

console.log(failures === 0 ? '\nALL GOLDEN TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
