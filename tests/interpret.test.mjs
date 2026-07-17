// Unit tests for the interpretation engine (src/core/interpret.js) and the
// corpus completeness it depends on. Pure — no ephemeris, no DOM.
// Run: node tests/interpret.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { buildReading, readingFactors, lordOfHouse, CORPUS_VERSION } = await import('../src/core/interpret.js')
const { PLANETS_IN_HOUSES } = await import('../src/content/interpretation/planets-in-houses.js')
const { HOUSES } = await import('../src/content/interpretation/houses.js')
const { SIGNS } = await import('../src/content/interpretation/signs.js')
const { PLANETS_CONTENT } = await import('../src/content/interpretation/planets.js')
const { NAKSHATRAS } = await import('../src/content/interpretation/nakshatras.js')
const { DASHA_LORDS, ANTAR_MODIFIER } = await import('../src/content/interpretation/dasha-lords.js')
const { yogaMeaning, yogaFamily, YOGA_MEANINGS } = await import('../src/content/interpretation/yoga-meanings.js')
const { houseLordReading, allHouseLordKeys } = await import('../src/content/interpretation/house-lords.js')
const { shadbalaQualifier, savQualifier } = await import('../src/content/interpretation/qualifiers.js')
const { detectYogas } = await import('../src/core/yogas.js')

const PLANET_NAMES = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu']
const DEPTHS = ['beginner', 'practitioner']

// ── Corpus exhaustiveness ───────────────────────────────────────────────────
// A missing key would render an empty paragraph in the UI, so it must fail the
// test run rather than reach a reader.

console.log('\n[corpus exhaustiveness]')
{
  let missing = []
  for (const p of PLANET_NAMES) for (let h = 1; h <= 12; h++) {
    const e = PLANETS_IN_HOUSES[`${p}-${h}`]
    if (!e || !e.beginner || !e.practitioner) missing.push(`${p}-${h}`)
  }
  assert(missing.length === 0, `all 108 planet-in-house entries exist in both depths${missing.length ? ': missing ' + missing.join(', ') : ''}`)

  missing = []
  for (let h = 1; h <= 12; h++) {
    const e = HOUSES[h]
    if (!e?.beginner || !e?.practitioner || !e?.domain || !e?.keywords?.length) missing.push(String(h))
  }
  assert(missing.length === 0, `all 12 houses are complete${missing.length ? ': ' + missing.join(', ') : ''}`)

  missing = []
  for (let s = 1; s <= 12; s++) {
    const e = SIGNS[s]
    if (!e?.beginner || !e?.practitioner || !e?.lord) missing.push(String(s))
  }
  assert(missing.length === 0, `all 12 signs are complete${missing.length ? ': ' + missing.join(', ') : ''}`)

  assert(PLANET_NAMES.every(p => PLANETS_CONTENT[p]?.beginner && PLANETS_CONTENT[p]?.practitioner),
    'all 9 planets have natures in both depths')
  assert(NAKSHATRAS.length === 27 && NAKSHATRAS.every(n => n.beginner && n.practitioner && n.lord),
    'all 27 nakshatras are complete')
  assert(PLANET_NAMES.filter(p => !['Rahu','Ketu'].includes(p)).concat(['Rahu','Ketu'])
    .every(p => DASHA_LORDS[p]?.beginner && DASHA_LORDS[p]?.practitioner),
    'all 9 dasha lords have themes')
  assert(PLANET_NAMES.every(p => ANTAR_MODIFIER[p]), 'all 9 antardasha modifiers exist')

  // 144 house-lord combinations must all compose without throwing
  let hl = 0
  for (const key of allHouseLordKeys()) {
    const [a, b] = key.split('-').map(Number)
    const r = houseLordReading(a, b)
    if (r.beginner && r.practitioner) hl++
  }
  assert(hl === 144, `all 144 house-lord combinations compose (${hl})`)
}

console.log('\n[yoga meanings cover every key detectYogas can emit]')
{
  // The real guard: yogas.js templates keys (raj-${pair}, mahapurusha-${planet}…),
  // so an exact-key map would silently miss them.
  const templated = [
    'mahapurusha-mars', 'mahapurusha-mercury', 'mahapurusha-jupiter', 'mahapurusha-venus', 'mahapurusha-saturn',
    'raj-1-5', 'raj-10-9', 'dhana-2-11', 'parivartana-mars-venus', 'vipreet-6', 'vipreet-8', 'vipreet-12',
    'neecha-bhanga-saturn', 'debilitated-mars', 'amala-jupiter',
    'gaja-kesari', 'budhaditya', 'chandra-mangala', 'sunapha', 'anapha', 'durudhara',
    'kemadruma', 'kemadruma-cancelled', 'kala-sarpa',
  ]
  const unresolved = templated.filter(k => !yogaMeaning(k))
  assert(unresolved.length === 0, `every yoga key family resolves${unresolved.length ? ': ' + unresolved.join(', ') : ''}`)
  assert(yogaFamily('raj-1-5') === 'raj', 'templated raj key reduces to its family')
  assert(yogaFamily('mahapurusha-saturn') === 'mahapurusha-saturn', 'mahapurusha keeps its planet (exact match)')
  assert(yogaFamily('totally-unknown') === null, 'an unknown key resolves to null rather than a wrong family')
  assert(Object.values(YOGA_MEANINGS).every(m => m.title && m.beginner && m.practitioner),
    'every yoga meaning is complete in both depths')

  // Drive the REAL detector over many synthetic charts and assert every key it
  // emits has a meaning — this catches a yoga added to yogas.js without content.
  const emitted = new Set()
  for (let lagnaSign = 1; lagnaSign <= 12; lagnaSign++) {
    for (let shift = 0; shift < 12; shift++) {
      const planets = PLANET_NAMES.map((name, i) => {
        const sign = ((i * 3 + shift) % 12) + 1
        return { name, abbr: name.slice(0, 2), sign, degree: 15, lon: (sign - 1) * 30 + 15,
                 house: ((sign - lagnaSign + 12) % 12) + 1 }
      })
      const lagna = { sign: lagnaSign, degree: 10 }
      for (const y of detectYogas(planets, lagna)) emitted.add(y.key)
    }
  }
  const orphans = [...emitted].filter(k => !yogaMeaning(k))
  assert(emitted.size > 0, `the detector emitted yogas across synthetic charts (${emitted.size} distinct keys)`)
  assert(orphans.length === 0, `every emitted yoga key has a meaning${orphans.length ? ': ' + orphans.join(', ') : ''}`)
}

console.log('\n[house-lord composition]')
{
  const own = houseLordReading(5, 5)
  assert(own.special === 'own', 'lord in its own house is flagged special')
  assert(own.beginner.includes('self-supporting'), 'own-house reading says so')

  // 6th/8th/12th from itself is the classical weakening
  assert(houseLordReading(1, 6).special === 'weakened', '1st lord in the 6th → weakened (6th from itself)')
  assert(houseLordReading(1, 8).special === 'weakened', '1st lord in the 8th → weakened')
  assert(houseLordReading(1, 12).special === 'weakened', '1st lord in the 12th → weakened')
  assert(houseLordReading(5, 10).special === 'weakened', '5th lord in the 10th → 6th from itself → weakened')
  assert(houseLordReading(2, 1).special === 'weakened', '2nd lord in the 1st → 12th from itself → weakened')
  assert(houseLordReading(1, 10).special === null, '1st lord in the 10th → ordinary composition')

  const gen = houseLordReading(4, 10)
  assert(gen.beginner.includes(HOUSES[4].domain) && gen.beginner.includes(HOUSES[10].domain),
    'a general reading names both houses’ domains')
  assert(gen.practitioner.includes('kendra'), 'practitioner depth notes the destination house group')

  let threw = false
  try { houseLordReading(0, 5) } catch { threw = true }
  assert(threw, 'an invalid house throws rather than composing nonsense')
}

console.log('\n[qualifiers — the A6 strength layer]')
{
  assert(shadbalaQualifier(1.5, 'beginner').key === 'strong', 'ratio 1.5 → strong')
  assert(shadbalaQualifier(1.05, 'beginner').key === 'adequate', 'ratio 1.05 → adequate')
  assert(shadbalaQualifier(0.9, 'beginner').key === 'middling', 'ratio 0.9 → middling')
  assert(shadbalaQualifier(0.4, 'beginner').key === 'weak', 'ratio 0.4 → weak')
  assert(shadbalaQualifier(null) === null, 'no ratio → no qualifier (rather than a guess)')
  assert(shadbalaQualifier(undefined) === null, 'undefined ratio → no qualifier')

  // The practitioner register must cite the number the claim rests on.
  assert(shadbalaQualifier(1.34, 'practitioner').text.includes('1.34'),
    'practitioner qualifier cites the actual Shadbala ratio')
  assert(!shadbalaQualifier(1.34, 'beginner').text.includes('1.34'),
    'beginner qualifier keeps the number out of the prose')

  assert(savQualifier(33, 'beginner').text.includes('33'), 'SAV qualifier reports its bindus')
  assert(savQualifier(null) === null, 'no bindus → no SAV qualifier')
}

// ── A realistic chart ───────────────────────────────────────────────────────
// Indira Gandhi (jhora/Indira_Gandhi.md): Cancer lagna, Moon in Capricorn.
const chart = {
  lagna: { sign: 4, degree: 27.4, nakshatra: 'Ashlesha', pada: 4 },
  planets: [
    { name: 'Sun',     abbr: 'Su', sign: 8,  degree: 4.1,  house: 5,  nakshatraIndex: 16, pada: 1 },
    { name: 'Moon',    abbr: 'Mo', sign: 10, degree: 5.6,  house: 7,  nakshatraIndex: 20, pada: 3 },
    { name: 'Mars',    abbr: 'Ma', sign: 5,  degree: 16.4, house: 2,  nakshatraIndex: 10, pada: 1 },
    { name: 'Mercury', abbr: 'Me', sign: 8,  degree: 13.2, house: 5,  nakshatraIndex: 16, pada: 3 },
    { name: 'Jupiter', abbr: 'Ju', sign: 2,  degree: 15.0, house: 11, nakshatraIndex: 3,  pada: 2 },
    { name: 'Venus',   abbr: 'Ve', sign: 9,  degree: 21.0, house: 6,  nakshatraIndex: 19, pada: 3 },
    { name: 'Saturn',  abbr: 'Sa', sign: 4,  degree: 21.8, house: 1,  nakshatraIndex: 8,  pada: 2 },
    { name: 'Rahu',    abbr: 'Ra', sign: 9,  degree: 10.6, house: 6,  nakshatraIndex: 18, pada: 4 },
    { name: 'Ketu',    abbr: 'Ke', sign: 3,  degree: 10.6, house: 12, nakshatraIndex: 5,  pada: 2 },
  ],
  dasha: [
    { planet: 'Sun',  start: new Date('1917-11-19'), end: new Date('1919-11-15'), children: [] },
    { planet: 'Moon', start: new Date('1919-11-15'), end: new Date('1929-11-15'),
      children: [
        { planet: 'Moon', start: new Date('1919-11-15'), end: new Date('1920-09-15'), children: [] },
        { planet: 'Mars', start: new Date('1920-09-15'), end: new Date('1921-04-15'), children: [] },
      ] },
  ],
  yogas: [
    { key: 'gaja-kesari', name: 'Gaja-Kesari Yoga', category: 'benefic', description: 'Jupiter in a kendra from the Moon' },
    { key: 'raj-1-5', name: 'Raj Yoga (Kendra–Trikona)', category: 'benefic', description: 'lords of 1 and 5 related' },
  ],
  strength: {
    shadbala: { Sun: { ratio: 1.34 }, Moon: { ratio: 0.72 }, Saturn: { ratio: 1.05 }, Jupiter: { ratio: 1.4 } },
    sarva: [30, 25, 28, 33, 22, 26, 31, 29, 24, 27, 32, 28],
  },
  avasthas: {
    Saturn: { deeptadi: { key: 'vikala' }, baladi: { key: 'kumara' } },
    Moon:   { deeptadi: { key: 'duhkhita' }, baladi: { key: 'mrita' } },
  },
}

console.log('\n[buildReading — structure]')
{
  const r = buildReading(chart, { now: new Date('1920-01-01') })
  assert(r.corpusVersion === CORPUS_VERSION, 'reading declares the corpus version it was built from')
  assert(r.depth === 'beginner', 'defaults to beginner depth')
  assert(r.sections.length > 0, `produces sections (${r.sections.length})`)

  const keys = r.sections.map(s => s.key)
  for (const k of ['self', 'mind', 'career', 'relationships', 'wealth', 'period', 'yogas']) {
    assert(keys.includes(k), `section "${k}" present`)
  }

  const allParas = r.sections.flatMap(s => s.paragraphs)
  assert(allParas.length > 0, `produces paragraphs (${allParas.length})`)
  assert(allParas.every(p => typeof p.text === 'string' && p.text.trim().length > 0),
    'no paragraph is empty')
  assert(allParas.every(p => !/undefined|NaN|\[object/.test(p.text)),
    'no paragraph leaks undefined/NaN/[object Object]')
  assert(allParas.every(p => Array.isArray(p.factors) && p.factors.length > 0),
    'every paragraph carries at least one evidence factor')
  assert(allParas.every(p => p.factors.every(f => f.label && f.key)),
    'every factor has a label and a key')
}

console.log('\n[buildReading — the reading matches THIS chart]')
{
  const r = buildReading(chart, { now: new Date('1920-01-01') })
  const text = s => r.sections.find(x => x.key === s).paragraphs.map(p => p.text).join(' ')

  assert(text('self').includes('Cancer'), 'self section names the Cancer lagna')
  assert(text('self').includes('Ashlesha'), 'self section names the lagna nakshatra')
  // Cancer lagna → 1st lord is the Moon; Saturn sits in the 1st.
  assert(text('self').includes('Moon rules your 1st'), 'identifies the Moon as the Cancer lagna lord')
  assert(text('self').includes('Saturn in your 1st house'), 'covers Saturn sitting in the lagna')

  assert(text('mind').includes('Capricorn'), 'mind section names the Moon sign')
  assert(text('mind').includes('Uttara Ashadha'), 'mind section names the janma nakshatra')

  // Cancer lagna → 10th is Aries → lord Mars, which sits in the 2nd.
  assert(lordOfHouse(10, 4) === 'Mars', 'lordOfHouse: 10th of a Cancer lagna is Mars')
  assert(text('career').includes('Mars rules your 10th'), 'career section finds the 10th lord')

  // Cancer lagna → 7th is Capricorn → lord Saturn; the Moon sits in the 7th.
  assert(lordOfHouse(7, 4) === 'Saturn', 'lordOfHouse: 7th of a Cancer lagna is Saturn')
  // The Moon's full placement belongs to "Your mind"; Partnership must still
  // name it (it sits in the 7th) but points rather than repeating.
  assert(/Moon also sits in this house/.test(text('relationships')),
    'relationships section still names the Moon in the 7th, via a pointer')

  assert(text('period').includes('Moon Mahadasha'), 'period section identifies the running MD')
  assert(text('period').includes('Moon Antardasha'), 'period section identifies the running AD')
  assert(text('period').includes('rules your'), 'period section grounds the generic theme in this chart’s lordships')

  assert(text('yogas').includes('Gaja-Kesari'), 'yoga section renders a detected yoga')
}

console.log('\n[A6 — strength actually changes the prose]')
{
  const r = buildReading(chart, { now: new Date('1920-01-01') })
  const all = r.sections.flatMap(s => s.paragraphs).map(p => p.text).join(' ')
  // Sun ratio 1.34 → strong; Moon ratio 0.72 → weak. Both must be voiced.
  assert(/strong in your chart/.test(all), 'a strong planet is described as strong')
  assert(/weak in your chart/.test(all), 'a weak planet is described as weak')
  // Avastha qualifiers flow through
  assert(all.includes('great enemy'), "Saturn's vikala avastha reaches the prose")
  assert(/bindus/.test(all), 'Ashtakavarga bindus are voiced')

  // Remove the strength data → the reading must still build, minus qualifiers.
  const bare = buildReading({ ...chart, strength: undefined, avasthas: undefined }, { now: new Date('1920-01-01') })
  const bareText = bare.sections.flatMap(s => s.paragraphs).map(p => p.text).join(' ')
  assert(bare.sections.length > 0, 'a chart without strength data still produces a reading')
  assert(!/strong in your chart|weak in your chart|bindus/.test(bareText),
    'no strength data → no invented strength claims')
}

console.log('\n[depth dial]')
{
  const b = buildReading(chart, { depth: 'beginner', now: new Date('1920-01-01') })
  const p = buildReading(chart, { depth: 'practitioner', now: new Date('1920-01-01') })
  const bt = b.sections.flatMap(s => s.paragraphs).map(x => x.text).join(' ')
  const pt = p.sections.flatMap(s => s.paragraphs).map(x => x.text).join(' ')

  assert(bt !== pt, 'the two depths produce different prose')
  assert(/bhava|Shadbala ratio|drishti|karaka/.test(pt), 'practitioner depth uses technical vocabulary')
  assert(!/Shadbala ratio/.test(bt), 'beginner depth keeps the jargon out')
  assert(b.sections.length === p.sections.length, 'both depths produce the same sections')

  let threw = false
  try { buildReading(chart, { depth: 'expert' }) } catch { threw = true }
  assert(threw, 'an unknown depth throws rather than rendering blanks')
}

console.log('\n[readingFactors]')
{
  const r = buildReading(chart, { now: new Date('1920-01-01') })
  const fs = readingFactors(r)
  assert(fs.length > 0, `collects factors (${fs.length})`)
  assert(new Set(fs.map(f => f.key)).size === fs.length, 'factors are de-duplicated by key')
  assert(fs.every(f => f.type && f.label), 'every factor has a type and label')
  assert(fs.some(f => f.type === 'planet') && fs.some(f => f.type === 'yoga'),
    'factors span several evidence types')
}

console.log('\n[guards]')
{
  let threw = false
  try { buildReading({ planets: [] }) } catch { threw = true }
  assert(threw, 'a chart without a lagna throws')
  threw = false
  try { buildReading(null) } catch { threw = true }
  assert(threw, 'a null chart throws')

  // A chart with no dasha/yogas/strength must degrade, not crash.
  const minimal = buildReading({ lagna: chart.lagna, planets: chart.planets })
  assert(minimal.sections.length > 0, 'a minimal chart still reads')
  assert(!minimal.sections.some(s => s.key === 'period'), 'no dasha → no period section (rather than an empty one)')
  assert(!minimal.sections.some(s => s.key === 'yogas'), 'no yogas → no yoga section')
}

console.log('\n[every planet in every house renders]')
{
  // Rotate a single planet through all 12 houses on all 12 lagnas and assert
  // the engine never produces an empty or broken paragraph.
  let bad = 0
  for (let lagnaSign = 1; lagnaSign <= 12; lagnaSign++) {
    for (let sign = 1; sign <= 12; sign++) {
      const planets = PLANET_NAMES.map((name, i) => {
        const s = ((sign + i * 2 - 1) % 12) + 1
        return { name, abbr: name.slice(0, 2), sign: s, degree: 12, lon: (s - 1) * 30 + 12,
                 house: ((s - lagnaSign + 12) % 12) + 1, nakshatraIndex: (i * 3) % 27, pada: 1 }
      })
      for (const depth of DEPTHS) {
        const r = buildReading({ lagna: { sign: lagnaSign, degree: 5 }, planets }, { depth })
        for (const s of r.sections) for (const p of s.paragraphs) {
          if (!p.text || /undefined|NaN|\[object/.test(p.text)) bad++
        }
      }
    }
  }
  assert(bad === 0, `144 lagna×sign combinations × 2 depths render cleanly (${bad} bad paragraphs)`)
}

console.log(failures === 0 ? '\nALL INTERPRET TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
