// Unit tests for the calendar event aggregator (src/core/calendar-events.js).
// The collectors are pure, so this needs no ephemeris.
// Run: node tests/calendar-events.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const {
  collectDashaEvents, collectSadeSatiEvents, collectLunarBirthdayEvents,
  collectForecastEvents, mergeEvents, groupByDay, eventsToIcs, localIso, EVENT_TYPES,
} = await import('../src/core/calendar-events.js')

const d = iso => new Date(iso + 'T00:00:00Z')
const RANGE = [d('2026-01-01'), d('2026-12-31')]

console.log('\n[localIso — day bucketing respects the timezone]')
{
  // 20:00 UTC on the 16th is already the 17th in IST (+05:30)
  const t = new Date('2026-07-16T20:00:00Z')
  assert(localIso(t, '+05:30') === '2026-07-17', 'IST pushes a late-UTC event to the next day')
  assert(localIso(t, '+00:00') === '2026-07-16', 'UTC keeps it on the 16th')
  // 02:00 UTC is still the previous day in New York
  const u = new Date('2026-07-17T02:00:00Z')
  assert(localIso(u, '-05:00') === '2026-07-16', 'a negative offset pulls it back a day')
}

console.log('\n[dasha events]')
{
  const dasha = [
    {
      planet: 'Jupiter', start: d('2020-01-01'), end: d('2036-01-01'),
      children: [
        { planet: 'Saturn',  start: d('2026-03-01'), end: d('2028-01-01'),
          children: [
            { planet: 'Mercury', start: d('2026-06-01'), end: d('2026-09-01'), children: [] },
          ] },
        { planet: 'Mercury', start: d('2028-01-01'), end: d('2030-01-01'), children: [] },
      ],
    },
    { planet: 'Saturn', start: d('2036-01-01'), end: d('2055-01-01'), children: [] },
  ]
  const evs = collectDashaEvents(dasha, ...RANGE)

  assert(evs.length === 2, `only periods STARTING in 2026 are events (${evs.length})`)
  assert(evs.some(e => e.level === 'AD' && e.planet === 'Saturn'), 'the AD starting in 2026 is included')
  assert(evs.some(e => e.level === 'PD' && e.planet === 'Mercury'), 'a computed PD level is included')
  assert(!evs.some(e => e.level === 'MD'), 'the MD started in 2020 → not an event in this window')
  assert(evs.every(e => e.type === 'dasha'), 'all typed dasha')
  const ad = evs.find(e => e.level === 'AD')
  assert(ad.label.includes('Jupiter › Saturn'), `label shows the lord chain (${ad.label})`)

  // A parent whose window does not overlap is skipped entirely
  const none = collectDashaEvents(dasha, d('2021-01-01'), d('2021-12-31'))
  assert(none.length === 0, 'a quiet year yields no dasha events')

  assert(collectDashaEvents(null, ...RANGE).length === 0, 'null tree → no events, no throw')
}

console.log('\n[sade sati events]')
{
  const report = {
    segments: [
      { kind: null, signName: 'Leo', start: d('2025-01-01'), end: d('2026-02-01'), phase: null, label: null },
      { kind: 'sadesati', phase: 'rising', signName: 'Virgo', start: d('2026-02-01'), end: d('2028-04-01'),
        label: 'Sade Sati — first phase (12th from Moon)' },
      { kind: 'kantaka', phase: null, signName: 'Sagittarius', start: d('2030-01-01'), end: d('2032-01-01'),
        label: 'Kantaka Shani (4th from Moon)' },
    ],
  }
  const evs = collectSadeSatiEvents(report, ...RANGE)
  assert(evs.length === 1, `only the classified segment starting in 2026 (${evs.length})`)
  assert(evs[0].type === 'sadesati' && evs[0].phase === 'rising', 'carries kind + phase')
  assert(evs[0].detail.includes('Virgo'), 'detail names the sign entered')
  assert(collectSadeSatiEvents(null, ...RANGE).length === 0, 'null report → no events')
  assert(collectSadeSatiEvents({ segments: [] }, ...RANGE).length === 0, 'empty segments → no events')
}

console.log('\n[lunar birthday events]')
{
  const lunar = {
    lunar: { monthName: 'Kartika', paksha: 'Shukla', tithiName: 'Shashthi' },
    upcoming: [
      { date: d('2026-11-15'), iso: '2026-11-15', turns: 36 },
      { date: d('2027-11-04'), iso: '2027-11-04', turns: 37 },
    ],
  }
  const evs = collectLunarBirthdayEvents(lunar, ...RANGE)
  assert(evs.length === 1, 'only the 2026 birthday falls in range')
  assert(evs[0].label.includes('turns 36'), 'label carries the age')
  assert(evs[0].allDay === true, 'birthdays are all-day')
  assert(evs[0].detail.includes('Kartika'), 'detail names the lunar month')
  assert(collectLunarBirthdayEvents(null, ...RANGE).length === 0, 'null → no events')
}

console.log('\n[forecast events → calendar families]')
{
  const raw = [
    { type: 'sign',          date: d('2026-04-01'), label: '→ Enters Aries (H5)', detail: 'Aries' },
    { type: 'retro',         date: d('2026-05-01'), label: 'Goes Retrograde ℞', detail: '' },
    { type: 'natal_aspect',  date: d('2026-06-01'), label: '◈ Aspects natal Moon', detail: 'Mo',
      activation: { planet: 'Moon', levels: ['MD'], kind: 'transit-to-lord' } },
    { type: 'pada',          date: d('2026-07-01'), label: 'Pāda 2', detail: '' },
    { type: 'combust_enter', date: d('2026-08-01'), label: '☀ Combust', detail: '' },
    { type: 'gandanta',      date: d('2026-09-01'), label: '⚠ Gandanta crossing', detail: '' },
    { type: 'unknown_kind',  date: d('2026-10-01'), label: 'mystery', detail: '' },
    { type: 'sign',          date: d('2030-01-01'), label: 'out of range', detail: '' },
  ]
  const evs = collectForecastEvents(raw, 'Saturn', ...RANGE)

  assert(evs.length === 6, `known in-range families only (${evs.length})`)
  const types = evs.map(e => e.type)
  assert(types.includes('ingress') && types.includes('station') && types.includes('aspect') &&
         types.includes('nakshatra') && types.includes('combust') && types.includes('gandanta'),
    'each forecast type maps to its family')
  assert(!evs.some(e => e.subtype === 'unknown_kind'), 'an unmapped forecast type is dropped, not mis-filed')
  assert(evs.every(e => e.planet === 'Saturn'), 'planet is stamped on every event')
  assert(evs.every(e => e.label.startsWith('Saturn ')), 'label is prefixed with the planet')
  assert(evs.find(e => e.type === 'aspect').activation?.levels[0] === 'MD', 'activation survives the mapping')
  assert(Object.keys(EVENT_TYPES).includes('ingress'), 'EVENT_TYPES covers the families')
  assert(evs.every(e => Object.keys(EVENT_TYPES).includes(e.type)), 'every emitted type has a filter chip')
}

console.log('\n[merge + group]')
{
  const a = [{ date: d('2026-03-01'), iso: '2026-03-01', type: 'dasha', label: 'b' }]
  const b = [{ date: d('2026-01-01'), iso: '2026-01-01', type: 'ingress', label: 'a' }]
  const c = [{ date: d('2026-03-01'), iso: '2026-03-01', type: 'aspect', label: 'c' }]
  const merged = mergeEvents(a, b, c, null, [])
  assert(merged.length === 3, 'merges lists and tolerates null/empty')
  assert(merged[0].label === 'a', 'sorted chronologically')

  const grouped = groupByDay(merged)
  assert(grouped.size === 2, 'two distinct days')
  assert(grouped.get('2026-03-01').length === 2, 'same-day events share a bucket')
}

console.log('\n[eventsToIcs]')
{
  const evs = [
    { date: d('2026-03-01'), iso: '2026-03-01', type: 'dasha', planet: 'Saturn',
      label: 'Jupiter › Saturn AD begins', detail: 'Antardasha of Saturn',
      activation: { planet: 'Saturn', levels: ['MD','AD'], kind: 'lord-transit' } },
    { date: d('2026-04-01'), iso: '2026-04-01', type: 'ingress', planet: 'Mars',
      label: 'Mars → Enters Aries', detail: 'Aries', activation: null },
  ]
  const ics = eventsToIcs(evs, { personName: 'Indira' })
  assert(ics.length === 2, 'one ics event per calendar event')
  assert(ics[0].summary === 'Jupiter › Saturn AD begins — Indira', 'summary appends the person')
  assert(ics[0].start === '2026-03-01', 'all-day DATE start')
  assert(ics[0].description.includes('Dasha activation: MD+AD Saturn'), 'activation is described')
  assert(!ics[1].description.includes('Dasha activation'), 'no activation → no stray line')
  assert(new Set(ics.map(e => e.uid)).size === 2, 'uids are unique')

  const anon = eventsToIcs(evs, {})
  assert(anon[0].summary === 'Jupiter › Saturn AD begins', 'no person name → bare summary')
}

console.log('\n[uid collisions — same instant, same planet]')
{
  // Regression: a sign ingress emits one natal_aspect event per natal planet
  // now aspected — same timestamp, same transiting planet, same type. A UID
  // built only from type+time+planet collides, and calendar clients then treat
  // them as ONE event and overwrite it, silently losing the rest on import.
  const t = d('2026-04-01')
  const evs = [
    { date: t, iso: '2026-04-01', type: 'aspect', planet: 'Saturn', label: 'Saturn ◈ Aspects natal Moon', detail: 'Mo' },
    { date: t, iso: '2026-04-01', type: 'aspect', planet: 'Saturn', label: 'Saturn ◈ Aspects natal Venus', detail: 'Ve' },
    { date: t, iso: '2026-04-01', type: 'aspect', planet: 'Saturn', label: 'Saturn ☌ Conjunct natal Mars', detail: 'Ma' },
    { date: t, iso: '2026-04-01', type: 'ingress', planet: 'Saturn', label: 'Saturn → Enters Aries', detail: 'Aries' },
  ]
  const ics = eventsToIcs(evs, {})
  assert(new Set(ics.map(e => e.uid)).size === 4, 'four simultaneous same-planet events get four distinct UIDs')

  // UIDs must be stable across exports, or a re-imported subscription duplicates
  // every event instead of updating it in place.
  const again = eventsToIcs(evs, {})
  assert(ics.every((e, i) => e.uid === again[i].uid), 'UIDs are deterministic across exports')

  // …and independent of position in the list (a wider range must not renumber them).
  const shifted = eventsToIcs([{ date: d('2026-01-01'), iso: '2026-01-01', type: 'dasha', label: 'x' }, ...evs], {})
  assert(shifted.slice(1).every((e, i) => e.uid === ics[i].uid), 'UIDs do not depend on list position')

  assert(ics.every(e => /^[a-z0-9@.\-]+$/i.test(e.uid)), 'UIDs stay ASCII-safe')
}

console.log('\n[ics round-trip — the calendar actually produces a valid document]')
{
  const { buildIcs } = await import('../src/utils/ics.js')
  const evs = [{ date: d('2026-03-01'), iso: '2026-03-01', type: 'dasha',
                 label: 'Saturn AD begins; phase 2', detail: 'x,y' }]
  const text = buildIcs(eventsToIcs(evs, { personName: 'Test' }))
  assert(text.startsWith('BEGIN:VCALENDAR'), 'produces a calendar document')
  assert(text.includes('DTSTART;VALUE=DATE:20260301'), 'event lands on the right day')
  assert(text.includes('SUMMARY:Saturn AD begins\\; phase 2 — Test'), 'summary is escaped end-to-end')
}

console.log(failures === 0 ? '\nALL CALENDAR-EVENTS TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
