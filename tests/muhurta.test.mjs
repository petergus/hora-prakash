// Unit tests for the Muhurta finder (src/core/muhurta.js): tarabala/chandrabala
// counting, tithi classes, the veto rules, and the sweep's window merging
// against a synthetic ephemeris. No WASM.
// Run: node tests/muhurta.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { tarabala, chandraBala, tithiClass, scoreInstant, gradeOf, findMuhurta } =
  await import('../src/core/muhurta.js')
const { NAKSHATRA_NATURE } = await import('../src/content/muhurta-activities.js')

console.log('\n[tarabala — 9 taras counted from the janma nakshatra]')
{
  // Same star → Janma (index 0). Then Sampat, Vipat, ...
  assert(tarabala(0, 0) === 0, 'same nakshatra → Janma')
  assert(tarabala(0, 1) === 1, '+1 → Sampat')
  assert(tarabala(0, 2) === 2, '+2 → Vipat (bad)')
  assert(tarabala(0, 6) === 6, '+6 → Vadha (worst)')
  assert(tarabala(0, 9) === 0, '+9 → cycles back to Janma')
  // Wrap-around across the 27→0 boundary
  assert(tarabala(25, 1) === 3, 'wraps past Revati (25→1 = 4th count = Kshema)')
  assert(tarabala(26, 0) === 1, 'Revati janma, Ashwini day → Sampat')
}

console.log('\n[chandra bala — Moon house from the natal Moon]')
{
  assert(chandraBala(1, 1) === 1, 'same sign → 1st')
  assert(chandraBala(1, 8) === 8, '8th → Chandrashtama')
  assert(chandraBala(10, 5) === 8, 'wraps: Cp natal, Le transit → 8th')
  assert(chandraBala(12, 1) === 2, 'wraps past Pisces → 2nd')
}

console.log('\n[tithi classes]')
{
  assert(tithiClass(1) === 'Nanda' && tithiClass(6) === 'Nanda' && tithiClass(11) === 'Nanda', 'Nanda: 1/6/11')
  assert(tithiClass(4) === 'Rikta' && tithiClass(9) === 'Rikta' && tithiClass(14) === 'Rikta', 'Rikta: 4/9/14')
  assert(tithiClass(5) === 'Purna' && tithiClass(15) === 'Purna', 'Purna: 5/15')
  // Krishna paksha repeats the cycle: tithi 19 = 4th of the fortnight = Rikta
  assert(tithiClass(19) === 'Rikta', 'krishna 4th (19) → Rikta')
  assert(tithiClass(30) === 'Purna', 'Amavasya (30) sits in the Purna slot')
}

// ── scoreInstant fixtures ──
const mkAngles = ({ tithiNum = 5, nak = 3, yoga = 'Siddhi', karana = 'Bava', moonSign = 1 }) => ({
  tithi:     { num: tithiNum, name: `T${tithiNum}`, percentLeft: 50 },
  nakshatra: { index: nak, name: `N${nak}`, pada: 1, lord: 'X', percentLeft: 50 },
  yoga:      { index: 0, name: yoga, percentLeft: 50 },
  karana:    { num: 1, name: karana, percentLeft: 50 },
  sidMoonLon: (moonSign - 1) * 30 + 15,
})
const base = {
  vedicWeekday: 4,           // Thursday — favoured for marriage
  lagnaSign: 2,              // Taurus — in marriage's lagnaSigns
  kalams: { inRahu: false, inGulika: false },
  activity: 'marriage',
  natal: { janmaNak: 0, moonSign: 1 },
}

console.log('\n[scoreInstant — vetoes]')
{
  const rikta = scoreInstant({ ...base, angles: mkAngles({ tithiNum: 4 }) })
  assert(rikta.vetoed && rikta.vetoes.some(v => v.key === 'tithi'), 'Rikta tithi vetoes')

  const amavasya = scoreInstant({ ...base, angles: mkAngles({ tithiNum: 30 }) })
  assert(amavasya.vetoed, 'Amavasya vetoes for marriage')
  const amavasyaMed = scoreInstant({ ...base, activity: 'medical', angles: mkAngles({ tithiNum: 30 }) })
  assert(!amavasyaMed.vetoes.some(v => v.key === 'tithi'), '…but not for a medical procedure')

  const vishti = scoreInstant({ ...base, angles: mkAngles({ karana: 'Vishti' }) })
  assert(vishti.vetoed && vishti.vetoes.some(v => v.key === 'karana'), 'Vishti (Bhadra) karana vetoes')

  const rahu = scoreInstant({ ...base, kalams: { inRahu: true, inGulika: false }, angles: mkAngles({}) })
  assert(rahu.vetoed && rahu.vetoes.some(v => v.key === 'kalam'), 'Rahu Kalam vetoes')

  const gulika = scoreInstant({ ...base, kalams: { inRahu: false, inGulika: true }, angles: mkAngles({}) })
  assert(gulika.vetoed, 'Gulika Kalam vetoes')

  // Chandrashtama: natal Moon Aries(1), transit Moon Scorpio(8) → 8th
  const c8 = scoreInstant({ ...base, angles: mkAngles({ moonSign: 8 }) })
  assert(c8.vetoed && c8.vetoes.some(v => v.key === 'chandrabala'), 'Chandrashtama vetoes')

  // Vadha tara: janma 0, day nak 6
  const vadha = scoreInstant({ ...base, angles: mkAngles({ nak: 6 }) })
  assert(vadha.vetoed && vadha.vetoes.some(v => v.key === 'tarabala'), 'Vadha tara vetoes')

  const clean = scoreInstant({ ...base, angles: mkAngles({}) })
  assert(!clean.vetoed, 'a clean instant has no veto')
}

console.log('\n[scoreInstant — factor scoring]')
{
  const s = scoreInstant({ ...base, angles: mkAngles({}) })
  const by = Object.fromEntries(s.factors.map(f => [f.key, f]))
  assert(by.nakshatra.points === 4, 'Rohini (3) is a preferred marriage nakshatra → full marks')
  assert(by.vara.points === 2, 'Thursday is favoured for marriage')
  assert(by.lagna.points === 2, 'Taurus lagna suits marriage')
  assert(by.yoga.points === 2, 'Siddhi is an auspicious yoga')
  // 3 tithi + 2 vara + 4 nakshatra + 2 yoga + 1 karana + 3 tara + 3 chandra + 2 kalam + 2 lagna
  assert(s.max === 22, `max is the sum of factor maxima (got ${s.max})`)
  assert(s.score === 22, 'a perfect instant scores the full 22')

  // Ugra nakshatra (Bharani, 1) is on marriage's avoid list
  const ugra = scoreInstant({ ...base, angles: mkAngles({ nak: 1 }) })
  assert(ugra.factors.find(f => f.key === 'nakshatra').points === 0, 'Bharani rejected for marriage')

  // Nature-only match: Punarvasu (6) is chara — in marriage natures but not the prefer list.
  // (6 is Vadha from janma 0, so use a different janma to isolate the nakshatra factor.)
  const nature = scoreInstant({ ...base, natal: { janmaNak: 3, moonSign: 1 }, angles: mkAngles({ nak: 6 }) })
  assert(NAKSHATRA_NATURE[6] === 'chara', 'Punarvasu is chara')
  assert(nature.factors.find(f => f.key === 'nakshatra').points === 3, 'nature match (not in prefer list) → 3/4')

  // Tuesday is on marriage's avoidVaras
  const tue = scoreInstant({ ...base, vedicWeekday: 2, angles: mkAngles({}) })
  assert(tue.factors.find(f => f.key === 'vara').points === 0, 'Tuesday rejected for marriage')

  // Inauspicious yoga
  const vy = scoreInstant({ ...base, angles: mkAngles({ yoga: 'Vyatipata' }) })
  assert(vy.factors.find(f => f.key === 'yoga').points === 0, 'Vyatipata scores 0')

  // Siddha yoga: Purna tithi (5) on Thursday(4)
  assert(by.tithi.note.includes('Siddha'), 'Purna tithi on Thursday is flagged Siddha')
}

console.log('\n[scoreInstant — natal factors are optional]')
{
  const noNatal = scoreInstant({ ...base, natal: null, angles: mkAngles({}) })
  const keys = noNatal.factors.map(f => f.key)
  assert(!keys.includes('tarabala') && !keys.includes('chandrabala'), 'no natal → Tara/Chandra bala omitted')
  // 22 − 3 (tarabala) − 3 (chandrabala): the score is a fraction of what was judged,
  // so omitting natal data must not silently penalise the instant.
  assert(noNatal.max === 16, `max shrinks to the factors actually judged (got ${noNatal.max})`)
  assert(noNatal.score / noNatal.max === 1, 'a perfect instant still reads 100% without natal data')
  assert(!noNatal.vetoed, 'no natal data cannot veto')
}

console.log('\n[gradeOf]')
{
  assert(gradeOf(0.9) === 'excellent' && gradeOf(0.75) === 'good' &&
         gradeOf(0.6) === 'fair' && gradeOf(0.3) === 'poor', 'grade bands')
}

// ── findMuhurta against a synthetic ephemeris ──
// Sun 0.9856°/day, Moon 13.176°/day from an epoch; ascendant rotates once/day.
// No SweModule → calcRiseSet returns nulls, so kalams are inert and the vara
// falls back to the civil weekday. That isolates the sweep/merge logic.
const EPOCH = 2460000.5
const synthetic = {
  calc_ut(jd, body) {
    const d = jd - EPOCH
    const sun  = ((100 + 0.9856 * d) % 360 + 360) % 360
    const moon = ((200 + 13.176 * d) % 360 + 360) % 360
    return body === 0 ? [sun, 0, 0, 0.9856] : [moon, 0, 0, 13.176]
  },
  houses_ex(jd) {
    const asc = ((jd - EPOCH) * 360 % 360 + 360) % 360
    return { ascmc: [asc], cusps: new Array(13).fill(0) }
  },
  sidtime: jd => ((jd - EPOCH) * 24) % 24,
  get_ayanamsa_ut: () => 24,
}

console.log('\n[findMuhurta — sweep against a synthetic ephemeris]')
{
  const res = findMuhurta({
    activity: 'marriage', from: '2023-03-01', to: '2023-03-20',
    lat: 28.61, lon: 77.21, timezone: '+05:30',
    natal: { janmaNak: 3, moonSign: 4 },
    swe: synthetic, stepMinutes: 60, limit: 20,
  })

  assert(res.scanned > 0, `the sweep evaluated slots (${res.scanned})`)
  assert(Array.isArray(res.windows), 'returns a windows array')
  assert(res.windows.length > 0, `found candidate windows (${res.windows.length})`)
  assert(res.windows.every(w => !w.vetoed), 'no vetoed slot is ever offered as a window')

  // Sorted best-first
  const pcts = res.windows.map(w => w.pct)
  assert(pcts.every((p, i) => i === 0 || pcts[i - 1] >= p), 'windows are sorted best-first')

  // Every window lies inside the requested range and daytime bounds
  const inRange = res.windows.every(w =>
    w.start >= new Date('2023-02-28T18:30:00Z') && w.end <= new Date('2023-03-20T18:30:00Z'))
  assert(inRange, 'windows stay inside the requested date range')

  assert(res.windows.every(w => w.end > w.start), 'every window has positive duration')
  assert(res.windows.every(w => w.pct >= 0.6), 'windows respect minScorePct')
  assert(res.windows.every(w => Array.isArray(w.factors) && w.factors.length),
    'each window carries its factor breakdown')
  assert(res.windows.every(w => w.lastJd === undefined), 'internal cursor is not leaked to callers')
  assert(res.windows.every(w => ['excellent','good','fair'].includes(w.grade)), 'graded windows only')
}

console.log('\n[findMuhurta — window merging & options]')
{
  const common = {
    activity: 'travel', from: '2023-03-01', to: '2023-03-05',
    lat: 28.61, lon: 77.21, timezone: '+05:30', swe: synthetic, limit: 50,
  }
  const fine   = findMuhurta({ ...common, stepMinutes: 30 })
  const coarse = findMuhurta({ ...common, stepMinutes: 60 })
  assert(fine.scanned > coarse.scanned, 'a finer step scans more slots')

  // Contiguous same-grade slots merge rather than each becoming a window
  assert(fine.windows.some(w => (w.end - w.start) > 30 * 60000),
    'adjacent qualifying slots merge into multi-slot windows')

  // A window never spans midnight (grade + day are part of the merge key)
  assert(fine.windows.every(w =>
    w.start.toISOString().slice(0, 10) === new Date(w.end.getTime() - 1).toISOString().slice(0, 10) ||
    w.dateStr), 'windows carry their local day')

  const strict = findMuhurta({ ...common, stepMinutes: 60, minScorePct: 0.95 })
  assert(strict.windows.length <= coarse.windows.length, 'a stricter floor yields no more windows')

  const limited = findMuhurta({ ...common, stepMinutes: 30, limit: 3 })
  assert(limited.windows.length <= 3, 'limit is honoured')

  // dayStart/dayEnd bound the hours considered
  const narrow = findMuhurta({ ...common, stepMinutes: 60, dayStart: 9, dayEnd: 10 })
  assert(narrow.scanned < coarse.scanned, 'narrower daily hours scan fewer slots')
}

console.log('\n[findMuhurta — argument validation]')
{
  let threw = false
  try { findMuhurta({ activity: 'nope', from: '2023-03-01', to: '2023-03-02', swe: synthetic }) }
  catch { threw = true }
  assert(threw, 'unknown activity throws')

  threw = false
  try { findMuhurta({ activity: 'travel', from: '2023-03-05', to: '2023-03-01', swe: synthetic }) }
  catch { threw = true }
  assert(threw, 'reversed date range throws')
}

console.log(failures === 0 ? '\nALL MUHURTA TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
