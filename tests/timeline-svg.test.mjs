// Unit tests for the pure timeline SVG renderers (src/ui/timeline-svg.js):
// axis tick selection, band clipping to the window, marker culling, the now
// line, and the spiral ring. No DOM. Run: node tests/timeline-svg.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { renderTimelineSVG, renderDashaSpiral, tickStep } = await import('../src/ui/timeline-svg.js')
const d = iso => new Date(iso + 'T00:00:00Z')

console.log('\n[tickStep]')
{
  assert(tickStep(1) === 0.25, 'a ~1y window ticks in quarters')
  assert(tickStep(5) === 1, 'a 5y window ticks yearly')
  assert(tickStep(30) === 5, 'a 30y window ticks every 5y')
  assert(tickStep(120) === 20, 'a 120y window ticks every 20y')
}

console.log('\n[renderTimelineSVG — structure]')
{
  const lanes = [
    { id: 'md', label: 'Mahadasha', kind: 'band', items: [
      { start: d('2000-01-01'), end: d('2010-01-01'), label: 'Venus', color: '#ec4899' },
      { start: d('2010-01-01'), end: d('2016-01-01'), label: 'Sun', color: '#f59e0b' },
    ] },
    { id: 'tr', label: 'Transits', kind: 'marker', items: [
      { date: d('2005-06-01'), label: 'Saturn return', color: '#64748b', kind: 'return' },
    ] },
  ]
  const svg = renderTimelineSVG({ lanes, from: d('2000-01-01'), to: d('2016-01-01'), now: d('2008-01-01'), width: 800 })

  assert(svg.startsWith('<svg') && svg.includes('viewBox'), 'produces a viewBox-sized svg')
  assert(svg.includes('Mahadasha') && svg.includes('Transits'), 'renders lane labels')
  assert(svg.includes('Venus') && svg.includes('Sun'), 'renders band labels')
  assert(svg.includes('#ec4899'), 'uses the band colour')
  assert((svg.match(/class="tl-band"/g) || []).length === 2, 'one group per band')
  assert(svg.includes('data-start="2000-01-01') && svg.includes('data-label="Venus"'), 'bands carry data-* for click wiring')
  assert(svg.includes('class="tl-marker"') && svg.includes('data-date="2005-06-01'), 'markers carry a date')
  assert(svg.includes('class="tl-now"') && svg.includes('>now<'), 'renders the now line + label')
  assert(!/undefined|NaN/.test(svg), 'no NaN/undefined leaks into the svg')
}

console.log('\n[band clipping + marker culling]')
{
  const lanes = [
    { id: 'md', label: 'MD', kind: 'band', items: [
      // straddles the left edge, and one fully outside on the right
      { start: d('1990-01-01'), end: d('2005-01-01'), label: 'A', color: '#000' },
      { start: d('2030-01-01'), end: d('2040-01-01'), label: 'B', color: '#000' },
    ] },
    { id: 'tr', label: 'M', kind: 'marker', items: [
      { date: d('1995-01-01'), label: 'before window', color: '#000' },  // culled
      { date: d('2010-01-01'), label: 'inside', color: '#000' },
    ] },
  ]
  const svg = renderTimelineSVG({ lanes, from: d('2000-01-01'), to: d('2020-01-01'), width: 800 })
  // Band A is clipped to start at the window edge (x = padL = 8), not before it.
  const rectMatch = svg.match(/<rect x="([\d.]+)"[^>]*data?/) || svg.match(/<rect x="([\d.]+)"/)
  assert(rectMatch && parseFloat(rectMatch[1]) >= 7.9, 'a band straddling the left edge is clipped to the window')
  assert(!svg.includes('data-label="B"'), 'a band entirely outside the window is not drawn')
  assert(svg.includes('data-label="inside"'), 'an in-window marker is drawn')
  assert(!svg.includes('data-label="before window"'), 'an out-of-window marker is culled')
}

console.log('\n[now line outside the window]')
{
  const lanes = [{ id: 'x', label: 'X', kind: 'band', items: [{ start: d('2000-01-01'), end: d('2005-01-01'), label: 'a', color: '#000' }] }]
  const svg = renderTimelineSVG({ lanes, from: d('2000-01-01'), to: d('2010-01-01'), now: d('2050-01-01'), width: 400 })
  assert(!svg.includes('class="tl-now"'), 'now line is omitted when now is outside the window')
}

console.log('\n[guards]')
{
  let threw = false
  try { renderTimelineSVG({ lanes: [], from: d('2010-01-01'), to: d('2000-01-01') }) } catch { threw = true }
  assert(threw, 'to <= from throws')
  const empty = renderTimelineSVG({ lanes: [], from: d('2000-01-01'), to: d('2001-01-01') })
  assert(empty.startsWith('<svg'), 'no lanes still renders an svg (just the axis)')
}

console.log('\n[renderDashaSpiral]')
{
  const dasha = [
    { planet: 'Venus', start: d('1990-01-01'), end: d('2010-01-01'), children: [] },
    { planet: 'Sun',   start: d('2010-01-01'), end: d('2016-01-01'), children: [
      { planet: 'Sun',  start: d('2010-01-01'), end: d('2011-01-01'), children: [] },
      { planet: 'Moon', start: d('2011-01-01'), end: d('2012-06-01'), children: [] },
    ] },
    { planet: 'Moon',  start: d('2016-01-01'), end: d('2026-01-01'), children: [] },
  ]
  const colorOf = p => ({ Venus: '#ec4899', Sun: '#f59e0b', Moon: '#6366f1' }[p] ?? '#999')
  const svg = renderDashaSpiral(dasha, { size: 400, now: d('2011-03-01'), colorOf })

  assert(svg.startsWith('<svg') && svg.includes('tl-spiral'), 'produces a spiral svg')
  assert((svg.match(/class="tl-spiral-arc"/g) || []).length === 3, 'one outer arc per Mahadasha')
  assert(svg.includes('#ec4899') && svg.includes('#f59e0b'), 'arcs use planet colours')
  assert(svg.includes('tl-spiral-now'), 'draws the you-are-here radial')
  // now is inside the Sun MD → hub shows Sun, and its ADs render on the inner ring.
  assert(svg.includes('>Sun</text>'), 'hub names the current Mahadasha')
  assert(svg.includes('Antardasha'), 'the current MD\'s Antardashas render on the inner ring')
  assert(!/NaN|undefined/.test(svg), 'no NaN/undefined in the spiral')

  assert(renderDashaSpiral([], {}).startsWith('<svg'), 'empty dasha → empty svg, no throw')
}

console.log(failures === 0 ? '\nALL TIMELINE-SVG TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
