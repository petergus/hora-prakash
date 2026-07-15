// tests/moon-info.test.mjs
// Moon phase & Moon–Sun relationship (src/core/moon-info.js). Pure longitude
// math — the elongation (Moon − Sun) drives paksha, tithi, illumination and the
// waxing/waning state; the ayanamsa cancels in the difference.
import assert from 'node:assert'
import { calcMoonInfo, MOON_COMBUST_ORB } from '../src/core/moon-info.js'

let passed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1 }
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// Build a minimal planet array with Sun & Moon at chosen longitudes/speeds.
function chart(sunLon, moonLon, { moonSpeed = 13.176, sunSpeed = 0.985 } = {}) {
  return [
    { name: 'Sun',  lon: sunLon,  speed: sunSpeed },
    { name: 'Moon', lon: moonLon, speed: moonSpeed },
  ]
}

console.log('calcMoonInfo — guards:')
test('returns null without Sun/Moon', () => {
  assert.strictEqual(calcMoonInfo(null), null)
  assert.strictEqual(calcMoonInfo([{ name: 'Mars', lon: 10 }]), null)
})

console.log('calcMoonInfo — cardinal phases:')
test('new moon: 0° elongation, 0% lit, waxing side', () => {
  const m = calcMoonInfo(chart(100, 100))
  assert.ok(approx(m.elongation, 0))
  assert.ok(approx(m.separation, 0))
  assert.ok(approx(m.illumination, 0, 1e-9))
  assert.strictEqual(m.phase, 'New Moon')
  assert.strictEqual(m.waxing, true)
  assert.strictEqual(m.combust, true) // conjunct the Sun
})

test('first quarter: 90° elongation, 50% lit, waxing', () => {
  const m = calcMoonInfo(chart(0, 90))
  assert.ok(approx(m.elongation, 90))
  assert.ok(approx(m.separation, 90))
  assert.ok(approx(m.illumination, 0.5, 1e-9))
  assert.strictEqual(m.phase, 'First Quarter')
  assert.strictEqual(m.waxing, true)
  assert.strictEqual(m.paksha.key, 'shukla')
})

test('full moon: 180° elongation, 100% lit, boundary is still waxing-flagged', () => {
  const m = calcMoonInfo(chart(0, 180))
  assert.ok(approx(m.elongation, 180))
  assert.ok(approx(m.separation, 180))
  assert.ok(approx(m.illumination, 1, 1e-9))
  assert.strictEqual(m.phase, 'Full Moon')
})

test('last quarter: 270° elongation, 50% lit, waning', () => {
  const m = calcMoonInfo(chart(0, 270))
  assert.ok(approx(m.elongation, 270))
  assert.ok(approx(m.separation, 90))          // shortest gap folds back to 90
  assert.ok(approx(m.illumination, 0.5, 1e-9))
  assert.strictEqual(m.phase, 'Last Quarter')
  assert.strictEqual(m.waxing, false)
  assert.strictEqual(m.paksha.key, 'krishna')
})

console.log('calcMoonInfo — wrap-around & separation:')
test('elongation normalises across 0/360 (Sun ahead of Moon numerically)', () => {
  // Moon at 10°, Sun at 350° → Moon is 20° ahead → waxing crescent.
  const m = calcMoonInfo(chart(350, 10))
  assert.ok(approx(m.elongation, 20))
  assert.ok(approx(m.separation, 20))
  assert.strictEqual(m.waxing, true)
  assert.strictEqual(m.phase, 'Waxing Crescent')
})

test('separation is the shortest angle (folds >180 back)', () => {
  const m = calcMoonInfo(chart(0, 350)) // elongation 350 → separation 10
  assert.ok(approx(m.elongation, 350))
  assert.ok(approx(m.separation, 10))
  assert.strictEqual(m.waxing, false)   // past full, heading to new
  assert.strictEqual(m.combust, true)   // 10° ≤ 12° orb
})

console.log('calcMoonInfo — tithi:')
test('tithi 1 (Pratipada) just after new moon, Shukla', () => {
  const m = calcMoonInfo(chart(0, 6))   // 6° → tithi 1
  assert.strictEqual(m.tithi.num, 1)
  assert.strictEqual(m.tithi.inPaksha, 1)
  assert.strictEqual(m.tithi.name, 'Pratipada')
  assert.strictEqual(m.paksha.key, 'shukla')
})

test('tithi 15 is Purnima at the full-moon degree band', () => {
  const m = calcMoonInfo(chart(0, 172)) // 172° → floor(172/12)+1 = 15
  assert.strictEqual(m.tithi.num, 15)
  assert.strictEqual(m.tithi.name, 'Purnima')
})

test('tithi 30 is Amavasya at the end of the dark fortnight', () => {
  const m = calcMoonInfo(chart(0, 350)) // 350° → floor(350/12)+1 = 30
  assert.strictEqual(m.tithi.num, 30)
  assert.strictEqual(m.tithi.name, 'Amavasya')
  assert.strictEqual(m.paksha.key, 'krishna')
})

console.log('calcMoonInfo — ETAs:')
test('days to next full/new scale with relative speed', () => {
  const rel = 13.176 - 0.985 // ≈ 12.191 °/day
  const m = calcMoonInfo(chart(0, 90))  // 90° from Sun, waxing
  // Full moon is 90° ahead; new moon 270° ahead.
  assert.ok(approx(m.relSpeed, rel, 1e-6))
  assert.ok(approx(m.daysToFull, 90 / rel, 1e-6))
  assert.ok(approx(m.daysToNew, 270 / rel, 1e-6))
})

test('ETAs are null when speeds are unavailable', () => {
  const m = calcMoonInfo([
    { name: 'Sun', lon: 0 },
    { name: 'Moon', lon: 90 },
  ])
  assert.strictEqual(m.relSpeed, null)
  assert.strictEqual(m.daysToFull, null)
  assert.strictEqual(m.daysToNew, null)
})

console.log('calcMoonInfo — combustion orb constant:')
test('MOON_COMBUST_ORB is the Parashari 12°', () => {
  assert.strictEqual(MOON_COMBUST_ORB, 12)
})

console.log(`\n${passed} moon-info assertions passed`)
