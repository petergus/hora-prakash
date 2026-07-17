// Real-ephemeris golden test for upagrahas & special lagnas: the full
// calcUpagrahas pipeline (Hindu sunrise → Vedic day/night span → Saturn's
// eighth-portion → ascendant at that moment) against JHora's published values
// for Indira Gandhi (jhora/Indira_Gandhi.md).
//
// Kept out of the fast `npm test` because it loads the 12 MB ephemeris.
// Run: npm run test:ephemeris
//
// Tolerance note: our Hindu sunrise lands ~2 s from JHora's. Ghati Lagna
// advances 30° per ghati (1.25°/min), so a 2 s sunrise difference alone moves
// it ~2.5 arcmin — the tolerances below are sized from that, not padded to fit.

const SwissEph = (await import('swisseph-wasm')).default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0) // Lahiri — matches the app

const { calcUpagrahas } = await import('../src/core/upagraha.js')

let failures = 0
const assert = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + msg); if (!cond) failures++ }

const SIGN = { Ar:1, Ta:2, Ge:3, Cn:4, Le:5, Vi:6, Li:7, Sc:8, Sg:9, Cp:10, Aq:11, Pi:12 }
const L = (s, d, m, sec) => (SIGN[s] - 1) * 30 + d + m / 60 + sec / 3600
const arcmin = (a, b) => Math.abs(((a - b + 540) % 360) - 180) * 60
const toIST = jd => new Date((jd - 2440587.5) * 86400000 + 5.5 * 3600000).toISOString().slice(11, 19)

// Indira Gandhi: 1917-11-19 23:11 IST, 25N27 81E51 (a Monday NIGHT birth).
const birth = { dob: '1917-11-19', tob: '23:11', timezone: '+05:30', lat: 25 + 27 / 60, lon: 81 + 51 / 60 }
const lagna   = { lon: L('Cn', 27, 22, 38.31), sign: 4 }
const planets = [{ name: 'Moon', lon: L('Cp', 5, 35, 17.97), sign: 10 }]

const up = calcUpagrahas(birth, lagna, planets, swe)

console.log('\n[Vedic day framing]')
{
  assert(up !== null, 'calcUpagrahas returns a result')
  assert(up.meta.isNight === true, '23:11 birth is classified as a night birth')
  assert(Math.abs(up.meta.ghatis - 41.8623) < 0.01, `Janma Ghatis ≈ 41.8623 (got ${up.meta.ghatis.toFixed(4)})`)
  // JHora: sunrise 6:26:18, sunset 5:09:25 pm — allow 5 s
  const riseErr = Math.abs(up.meta.sunriseJd - (Date.UTC(1917, 10, 19, 0, 56, 18) / 86400000 + 2440587.5)) * 86400
  const setErr  = Math.abs(up.meta.sunsetJd  - (Date.UTC(1917, 10, 19, 11, 39, 25) / 86400000 + 2440587.5)) * 86400
  assert(riseErr < 5, `sunrise within 5 s of JHora 06:26:18 (got ${toIST(up.meta.sunriseJd)}, Δ${riseErr.toFixed(1)}s)`)
  assert(setErr  < 5, `sunset within 5 s of JHora 17:09:25 (got ${toIST(up.meta.sunsetJd)}, Δ${setErr.toFixed(1)}s)`)
  // Monday night → Saturn's portion is the 2nd of eight
  assert(up.meta.gulikaJd > up.meta.sunsetJd && up.meta.gulikaJd < up.meta.mandiJd,
    `Gulika (${toIST(up.meta.gulikaJd)}) starts the portion, Mandi (${toIST(up.meta.mandiJd)}) is its middle`)
}

console.log('\n[points vs JHora]')
{
  // tolerance in arcmin, sized from the ~2 s sunrise delta × each point's rate
  const GOLD = [
    ['Gulika',      L('Ta', 29, 23, 43.96), 2],
    ['Mandi',       L('Ge', 10, 58,  4.89), 2],
    ['Bhava Lagna', L('Cn', 14, 36,  0.54), 1],
    ['Hora Lagna',  L('Pi', 25, 46, 25.74), 1.5],
    ['Ghati Lagna', L('Ar', 29, 17, 41.35), 3],
    ['Sree Lagna',  L('Pi', 28, 15, 43.57), 0.1],
    ['Indu Lagna',  L('Ge',  5, 35, 17.97), 0.01],
  ]
  for (const [name, gold, tol] of GOLD) {
    const p = up.points.find(x => x.name === name)
    const err = arcmin(p.lon, gold)
    assert(err < tol, `${name}: within ${tol}' of JHora (Δ${err.toFixed(2)}')`)
  }
}

console.log('\n[derived fields]')
{
  const gulika = up.points.find(p => p.name === 'Gulika')
  assert(gulika.sign === 2 && gulika.nakshatra === 'Mrigashira',
    `Gulika in Taurus/Mrigashira per JHora (got ${gulika.sign}/${gulika.nakshatra})`)
  // JHora prints Gulika's pada as 2
  assert(gulika.pada === 2, `Gulika pada 2 (got ${gulika.pada})`)
  // house = whole-sign from natal lagna (Cancer): Taurus is the 11th
  assert(gulika.house === 11, `Gulika in the 11th from Cancer lagna (got ${gulika.house})`)
}

console.log(failures === 0 ? '\nALL UPAGRAHA EPHEMERIS TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
