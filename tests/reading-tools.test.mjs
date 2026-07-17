// Unit tests for the chart-tool executor (src/tabs/reading-tools.js) — the
// dispatch + data-shaping the AI chat calls. The ephemeris-free tools
// (get_positions, get_dasha_at, get_strength) run fully here against a fixture;
// the ephemeris-backed tools (transits, muhurta) are covered at the core level
// (findNextEvents, findMuhurta) and only their graceful-degradation path is
// checked here, since the WASM singleton can't init in this harness.
// Run: node tests/reading-tools.test.mjs

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.window ??= { innerWidth: 1200 }

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { state } = await import('../src/state.js')
const { executeChartTool } = await import('../src/tabs/reading-tools.js')

const d = iso => new Date(iso + 'T00:00:00Z')

// Populate the shared state singleton with the Indira Gandhi fixture shape.
Object.assign(state, {
  birth: { dob: '1917-11-19', tob: '23:11', timezone: '+05:30', lat: 25.45, lon: 81.85 },
  lagna: { sign: 4, degree: 27.4, lon: 117.4, nakshatra: 'Ashlesha', pada: 4 },
  planets: [
    { name: 'Sun',     abbr: 'Su', sign: 8,  degree: 4.1,  house: 5,  lon: 214.1, nakshatraIndex: 16, pada: 1 },
    { name: 'Moon',    abbr: 'Mo', sign: 10, degree: 5.6,  house: 7,  lon: 275.6, nakshatraIndex: 20, pada: 3 },
    { name: 'Mars',    abbr: 'Ma', sign: 5,  degree: 16.4, house: 2,  lon: 136.4, nakshatraIndex: 10, pada: 1 },
    { name: 'Saturn',  abbr: 'Sa', sign: 4,  degree: 21.8, house: 1,  lon: 111.8, nakshatraIndex: 8,  pada: 2 },
  ],
  dasha: [
    { planet: 'Rahu',  start: d('1966-01-01'), end: d('1984-01-01'),
      children: [{ planet: 'Jupiter', start: d('1980-01-01'), end: d('1982-06-01'), children: [] }] },
  ],
  strength: {
    shadbala: { Sun: { ratio: 1.34 }, Moon: { ratio: 0.72 }, Saturn: { ratio: 1.15 } },
    sarva: [30, 25, 28, 33, 22, 26, 31, 29, 24, 27, 32, 28],
  },
})

console.log('\n[get_positions]')
{
  const r = await executeChartTool('get_positions', { division: 'D1' })
  assert(r.division === 'D1', 'echoes the division')
  assert(r.lagna === 'Cancer', 'D1 lagna is Cancer')
  const moon = r.planets.find(p => p.name === 'Moon')
  assert(moon.sign === 'Capricorn' && moon.house === 7, 'Moon in Capricorn, 7th house')

  const d9 = await executeChartTool('get_positions', { division: 'D9' })
  assert(d9.division === 'D9' && d9.planets.length === 4, 'D9 recomputes positions')

  const dflt = await executeChartTool('get_positions', {})
  assert(dflt.division === 'D1', 'defaults to D1 when no division given')
}

console.log('\n[get_dasha_at]')
{
  const r = await executeChartTool('get_dasha_at', { date: '1981-01-01' })
  assert(r.mahadasha === 'Rahu', 'Rahu Mahadasha on 1981-01-01')
  assert(r.antardasha === 'Jupiter', 'Jupiter Antardasha on 1981-01-01')
  assert(r.date === '1981-01-01', 'echoes the queried date')

  const before = await executeChartTool('get_dasha_at', { date: '1950-01-01' })
  assert(before.mahadasha == null, 'a date before the tree → no running lord (not a crash)')
}

console.log('\n[get_strength]')
{
  const r = await executeChartTool('get_strength', {})
  assert(r.shadbala.Sun.ratio === 1.34, 'reports the Sun Shadbala ratio')
  assert(r.shadbala.Sun.meetsRequirement === true, 'flags a strong planet as meeting the bar')
  assert(r.shadbala.Moon.meetsRequirement === false, 'flags a weak planet as below the bar')
  assert(r.sarvashtakavarga.Cancer === 33, 'maps SAV bindus by sign name')
}

console.log('\n[unknown + no-chart guards]')
{
  const unk = await executeChartTool('does_not_exist', {})
  assert(unk.error?.includes('Unknown tool'), 'unknown tool → error object, not a throw')

  // Temporarily blank the chart
  const saved = state.planets
  state.planets = null
  const r = await executeChartTool('get_positions', {})
  assert(r.error?.includes('No chart'), 'no chart loaded → graceful error')
  state.planets = saved
}

console.log('\n[ephemeris tools degrade gracefully without WASM]')
{
  // getSwe() throws before init; the executor must surface that, not crash the
  // process. (The real compute is validated in the core suites.)
  let ok = true, threw = false
  let r
  try {
    r = await executeChartTool('find_transit_events', { from: '2026-01-01', to: '2026-02-01' })
  } catch { threw = true }
  ok = !threw && r && typeof r === 'object'
  assert(ok, 'find_transit_events returns a plain object, never throws, without an ephemeris')
  assert(r.error || Array.isArray(r.events), 'the object is either an error or an events list')
}

console.log(failures === 0 ? '\nALL READING-TOOLS TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
