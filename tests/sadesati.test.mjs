// Unit tests for Sade Sati / Kantaka / Ashtama classification and the Saturn
// sign scanner, against a synthetic ephemeris (no WASM).
// Run: node tests/sadesati.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { classifySaturn, scanSaturnSigns, groupSadeSatiWindows, calcSadeSati, dateToJd } =
  await import('../src/core/sadesati.js')

console.log('\n[classification — Moon in Capricorn (10)]')
{
  const moon = 10
  assert(classifySaturn(9,  moon)?.phase === 'rising',  'Saturn in Sagittarius (12th) → rising phase')
  assert(classifySaturn(10, moon)?.phase === 'peak',    'Saturn in Capricorn (1st) → peak')
  assert(classifySaturn(11, moon)?.phase === 'setting', 'Saturn in Aquarius (2nd) → setting phase')
  assert(classifySaturn(1,  moon)?.kind  === 'kantaka', 'Saturn in Aries (4th) → Kantaka Shani')
  assert(classifySaturn(5,  moon)?.kind  === 'ashtama', 'Saturn in Leo (8th) → Ashtama Shani')
  assert(classifySaturn(12, moon) === null,             'Saturn in Pisces (3rd) → unremarkable')
  assert(classifySaturn(10, 10)?.kind === 'sadesati',   'offset arithmetic wraps (sign === moon)')
}

// ── Synthetic ephemeris: Saturn linear at `rate` °/day from `lon0` at EPOCH ──
const EPOCH = 2450000
const linearSwe = (lon0, rate) => ({
  calc_ut(jd, body) {
    if (body !== 6) throw new Error('synthetic ephemeris: Saturn only')
    const lon = ((lon0 + rate * (jd - EPOCH)) % 360 + 360) % 360
    return [lon, 0, 0, rate]
  },
})

console.log('\n[scanner — linear Saturn]')
{
  // Saturn starts at 15° Aries, 0.03°/day → 1000 days per sign
  const swe = linearSwe(15, 0.03)
  const from = EPOCH, to = EPOCH + 8000
  const segs = scanSaturnSigns(from, to, { swe, stepDays: 5 })

  assert(segs[0].sign === 1, 'first segment is Aries')
  assert(segs.length === 9, `8000 days / (1000/sign) from mid-sign → 9 segments (${segs.length})`)

  // Segments partition the range contiguously
  let contiguous = segs[0].startJd === from && segs[segs.length - 1].endJd === to
  for (let i = 1; i < segs.length; i++) {
    if (segs[i].startJd !== segs[i - 1].endJd) contiguous = false
    if (segs[i].sign !== (segs[i - 1].sign % 12) + 1) contiguous = false
  }
  assert(contiguous, 'segments are contiguous and advance one sign at a time')

  // First boundary: Saturn needs 15° to leave Aries → 500 days, ±1 day tolerance
  assert(Math.abs(segs[0].endJd - (EPOCH + 500)) < 1, `first ingress at +500d (got +${(segs[0].endJd - EPOCH).toFixed(2)}d)`)
}

console.log('\n[scanner — retrograde bounce]')
{
  // Saturn oscillates across the Aries/Taurus boundary: crosses up (~d10),
  // retrogrades back into Aries (~d108–157), then re-enters Taurus.
  // lon = 29 + 0.02·d + 2.5·sin(d/30) — slope goes negative (0.02 − 0.083·cos).
  const swe = {
    calc_ut(jd) {
      const d = jd - EPOCH
      const lon = 29 + 0.02 * d + 2.5 * Math.sin(d / 30)
      return [((lon % 360) + 360) % 360, 0, 0, 0.02]
    },
  }
  const segs = scanSaturnSigns(EPOCH, EPOCH + 400, { swe, stepDays: 5 })
  const pattern = segs.map(s => s.sign).join(',')
  assert(pattern === '1,2,1,2', `bounce produces Ar,Ta,Ar,Ta segments (${pattern})`)
  assert(segs.some((s, i) => i > 0 && s.sign === 1), 'retrograde re-entry into Aries captured')
}

console.log('\n[calcSadeSati — windows & phases]')
{
  // Moon in Capricorn (10). Saturn starts at 0° Aries, 0.03°/day (1000 d/sign).
  // Sagittarius (12th from Moon) begins after 8 signs = 240° → day 8000.
  // Sade Sati = Sg+Cp+Aq = 90° → 3000 days ≈ the classic 7.5 years.
  const swe = linearSwe(0, 0.03)
  const from = EPOCH, to = EPOCH + 13000
  const now = new Date((EPOCH + 8500 - 2440587.5) * 86400000) // inside the rising phase
  const res = calcSadeSati(10, { fromJd: from, toJd: to, swe, now })

  assert(res.windows.length === 1, `one Sade Sati window in range (${res.windows.length})`)
  const w = res.windows[0]
  assert(Math.abs(w.startJd - (EPOCH + 8000)) < 1, `window starts at Sg ingress +8000d (got +${(w.startJd - EPOCH).toFixed(1)}d)`)
  assert(Math.abs((w.endJd - w.startJd) - 3000) < 2, `window spans ~3000d ≈ 7.5y (got ${(w.endJd - w.startJd).toFixed(1)}d)`)
  assert(w.segments.map(s => s.phase).join(',') === 'rising,peak,setting', 'window phases run rising → peak → setting')
  assert(w.current === true, 'window flagged current for a now inside it')

  assert(res.current?.phase === 'rising', `current segment is the rising phase (${res.current?.phase})`)
  assert(res.segments.some(s => s.kind === 'kantaka'), 'Kantaka Shani segment present (4th from Moon)')
  assert(res.segments.some(s => s.kind === 'ashtama'), 'Ashtama Shani segment present (8th from Moon)')

  // Kantaka: 4th from Cp = Aries → Saturn is there at the very start (0°–30° = days 0–1000)
  const kantaka = res.segments.find(s => s.kind === 'kantaka')
  assert(kantaka.sign === 1 && kantaka.startJd === from, 'Kantaka segment is the opening Aries stay')

  // Date conversion sanity
  assert(w.start instanceof Date && w.end instanceof Date && w.end > w.start, 'window carries Date objects')
  assert(Math.abs(dateToJd(w.start) - w.startJd) < 1e-6, 'dateToJd round-trips')
}

console.log(failures === 0 ? '\nALL SADESATI TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
