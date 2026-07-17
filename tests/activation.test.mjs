// Unit tests for dasha–transit activation flagging (src/core/activation.js).
// Pure fixtures — no ephemeris, no DOM.
// Run: node tests/activation.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { dashaLordsAt, annotateActivations, activationBadge, activationTitle } =
  await import('../src/core/activation.js')

// ── Synthetic dasha tree ──
// Jupiter MD 2020-2036; inside it Saturn AD 2025-2027 (with PDs computed),
// then Mercury AD 2027-2029 (children NOT computed — lazy level).
const d = iso => new Date(iso + 'T00:00:00Z')
const dasha = [
  {
    planet: 'Jupiter', start: d('2020-01-01'), end: d('2036-01-01'),
    children: [
      {
        planet: 'Saturn', start: d('2025-01-01'), end: d('2027-01-01'),
        children: [
          { planet: 'Saturn',  start: d('2025-01-01'), end: d('2025-05-01'), children: [] },
          { planet: 'Mercury', start: d('2025-05-01'), end: d('2025-09-01'), children: [] },
          { planet: 'Ketu',    start: d('2025-09-01'), end: d('2025-11-01'), children: [] },
        ],
      },
      { planet: 'Mercury', start: d('2027-01-01'), end: d('2029-01-01'), children: [] },
    ],
  },
  { planet: 'Saturn', start: d('2036-01-01'), end: d('2055-01-01'), children: [] },
]

console.log('\n[dashaLordsAt]')
{
  const a = dashaLordsAt(dasha, d('2025-06-15'))
  assert(a.md === 'Jupiter' && a.ad === 'Saturn' && a.pd === 'Mercury',
    `mid-2025 → Ju MD / Sa AD / Me PD (got ${a.md}/${a.ad}/${a.pd})`)

  const b = dashaLordsAt(dasha, d('2027-06-15'))
  assert(b.md === 'Jupiter' && b.ad === 'Mercury' && b.pd === null,
    'lazy AD (no children) → PD is null, not guessed')

  const c = dashaLordsAt(dasha, d('2040-01-01'))
  assert(c.md === 'Saturn' && c.ad === null, 'MD without children → AD null')

  const e = dashaLordsAt(dasha, d('2019-01-01'))
  assert(e.md === null && e.ad === null && e.pd === null, 'before the tree → all null')
}

console.log('\n[annotateActivations — transit-to-lord]')
{
  // Transit Saturn aspects natal Jupiter (the MD lord) in mid-2025
  const events = [
    { type: 'natal_aspect', date: d('2025-06-15'), label: '◈ Aspects natal Jupiter', detail: 'Ju' },
    { type: 'natal_aspect', date: d('2025-06-15'), label: '◈ Aspects natal Venus',   detail: 'Ve' },
  ]
  annotateActivations(events, dasha, 'Saturn')
  assert(events[0].activation?.kind === 'transit-to-lord', 'aspect to MD lord flagged transit-to-lord')
  assert(events[0].activation?.planet === 'Jupiter' && events[0].activation?.levels.join() === 'MD',
    'activation names the lord and level')
  // Venus is no lord, but transiting Saturn IS the AD lord → lord-transit fallback
  assert(events[1].activation?.kind === 'lord-transit' && events[1].activation?.planet === 'Saturn',
    'aspect from a running lord (to a non-lord) falls back to lord-transit')
}

console.log('\n[annotateActivations — lord-transit + multi-level]')
{
  // Transiting Saturn is both AD lord (2025) — and its own PD runs Jan–May 2025
  const events = [
    { type: 'sign',   date: d('2025-02-01'), label: '→ Enters Pisces (H3)', detail: 'Pisces' },
    { type: 'retro',  date: d('2025-06-15'), label: 'Goes Retrograde ℞',    detail: '' },
    { type: 'nakshatra', date: d('2025-06-15'), label: '★ Nakshatra: X',    detail: 'X' },
    { type: 'sign',   date: d('2040-02-01'), label: '→ Enters Taurus (H5)', detail: 'Taurus' },
  ]
  annotateActivations(events, dasha, 'Saturn')
  assert(events[0].activation?.levels.join() === 'AD,PD', `Feb 2025 ingress → AD+PD lord (${events[0].activation?.levels})`)
  assert(events[1].activation?.levels.join() === 'AD', 'June 2025 station → AD lord only')
  assert(events[2].activation === undefined, 'nakshatra change is not an activation event type')
  assert(events[3].activation?.levels.join() === 'MD', '2040 ingress → Saturn is then the MD lord')
}

console.log('\n[annotateActivations — non-lord planet untouched]')
{
  const events = [
    { type: 'sign',        date: d('2025-06-15'), label: '→ Enters Aries (H4)', detail: 'Aries' },
    { type: 'natal_aspect', date: d('2025-06-15'), label: '☌ Conjunct natal Moon', detail: 'Mo' },
  ]
  annotateActivations(events, dasha, 'Mars')
  assert(events[0].activation === undefined && events[1].activation === undefined,
    'Mars (no running period) produces no activations')
}

console.log('\n[badge/title helpers]')
{
  const act = { planet: 'Jupiter', levels: ['MD', 'AD'], kind: 'transit-to-lord' }
  assert(activationBadge(act) === '⚡ MD·AD', 'badge renders levels')
  assert(activationTitle(act).includes('Mahadasha + Antardasha') && activationTitle(act).includes('Jupiter'),
    'title spells out levels and lord')
  assert(activationBadge(null) === '' && activationTitle(undefined) === '', 'helpers tolerate missing activation')
}

console.log(failures === 0 ? '\nALL ACTIVATION TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
