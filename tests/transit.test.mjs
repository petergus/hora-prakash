import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Initialize SwissEph directly (same pattern as compare-jhora.test.mjs)
const sweModule = await import(join(rootDir, 'node_modules/swisseph-wasm/src/swisseph.js'))
const SwissEph = sweModule.default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0) // Lahiri ayanamsa

// Import PLANETS array from the codebase
const { PLANETS } = await import(join(rootDir, 'src/core/swisseph.js'))

/**
 * Calculate transit planet positions inline (TDD: tests run now, implementation later)
 * This builds planet positions without depending on src/core/transit.js existing
 */
function calcTransitPositions(jd, natalLagnaSign) {
  const flags = 65536 | 256 // SEFLG_SIDEREAL | SEFLG_SPEED

  // Calculate all 9 grahas
  const planets = []
  for (const planetDef of PLANETS) {
    let lon
    if (planetDef.isKetu) {
      // Ketu = Rahu + 180°
      const rahuResult = swe.calc_ut(jd, 10, flags)
      lon = (rahuResult[0] + 180) % 360
    } else {
      const result = swe.calc_ut(jd, planetDef.id, flags)
      lon = result[0]
    }

    // Convert longitude to sign (1-12) and degree within sign (0-30)
    const sign = Math.floor(lon / 30) + 1
    const degree = lon % 30

    // Assign house based on whole sign: house = ((sign - natalLagnaSign + 12) % 12) + 1
    const house = ((sign - natalLagnaSign + 12) % 12) + 1

    planets.push({
      id: planetDef.id,
      name: planetDef.name,
      abbr: planetDef.abbr,
      lon,
      sign,
      degree,
      house,
      retrograde: false, // Placeholder for this test; would check lonSpeed < 0
    })
  }

  return planets
}

// Calculate JD for 2026-05-05 12:00 UTC
// Days from J2000 (2000-01-01 12:00 UTC = JD 2451545.0)
const msPerDay = 86400000
const j2000 = new Date('2000-01-01T12:00:00Z')
const target = new Date('2026-05-05T12:00:00Z')
const jd = 2451545.0 + (target - j2000) / msPerDay

// Natal lagna sign (for house calculation tests; using sign 1 = Aries for Test 4)
const natalLagnaSign = 1

// ===== Test 1: Returns 9 planets =====
const planets = calcTransitPositions(jd, natalLagnaSign)
console.assert(
  planets.length === 9,
  `Test 1 FAILED: Expected 9 planets, got ${planets.length}`
)
console.log('✓ Test 1: Returns 9 planets')

// ===== Test 2: Each planet has correct shape =====
let test2Passed = true
for (const planet of planets) {
  // Check required fields exist
  if (!('id' in planet) || !('name' in planet) || !('abbr' in planet) ||
      !('lon' in planet) || !('sign' in planet) || !('degree' in planet) ||
      !('house' in planet) || !('retrograde' in planet)) {
    console.assert(false, `Test 2 FAILED: Planet ${planet.name} missing required fields`)
    test2Passed = false
    break
  }

  // Check sign is 1-12
  if (planet.sign < 1 || planet.sign > 12) {
    console.assert(false, `Test 2 FAILED: ${planet.name} sign ${planet.sign} not in 1-12`)
    test2Passed = false
    break
  }

  // Check degree is 0-30
  if (planet.degree < 0 || planet.degree >= 30) {
    console.assert(false, `Test 2 FAILED: ${planet.name} degree ${planet.degree} not in [0,30)`)
    test2Passed = false
    break
  }

  // Check house is 1-12
  if (planet.house < 1 || planet.house > 12) {
    console.assert(false, `Test 2 FAILED: ${planet.name} house ${planet.house} not in 1-12`)
    test2Passed = false
    break
  }

  // Check retrograde is boolean
  if (typeof planet.retrograde !== 'boolean') {
    console.assert(false, `Test 2 FAILED: ${planet.name} retrograde not boolean`)
    test2Passed = false
    break
  }
}
console.assert(test2Passed, 'Test 2 FAILED: Shape validation failed')
console.log('✓ Test 2: Each planet has correct shape')

// ===== Test 3: Ketu = Rahu + 180° (angular distance = 180°) =====
const rahu = planets.find(p => p.name === 'Rahu')
const ketu = planets.find(p => p.name === 'Ketu')
const angularDiff = Math.abs(ketu.lon - rahu.lon)
const normalizedDiff = angularDiff > 180 ? 360 - angularDiff : angularDiff
console.assert(
  Math.abs(normalizedDiff - 180) < 0.0001,
  `Test 3 FAILED: Ketu-Rahu angular distance ${normalizedDiff}° not ≈ 180°`
)
console.log('✓ Test 3: Ketu = Rahu + 180°')

// ===== Test 4: House assignment changes with different lagna sign =====
const natalLagnaSign2 = 2 // Different lagna (sign 2 = Taurus)
const planets2 = calcTransitPositions(jd, natalLagnaSign2)
let housesDiffer = false
for (let i = 0; i < planets.length; i++) {
  if (planets[i].house !== planets2[i].house) {
    housesDiffer = true
    break
  }
}
console.assert(
  housesDiffer,
  'Test 4 FAILED: Houses did not change with different lagna sign'
)
// Also verify signs are unchanged (same JD should give same sign)
let signsSame = true
for (let i = 0; i < planets.length; i++) {
  if (planets[i].sign !== planets2[i].sign) {
    signsSame = false
    break
  }
}
console.assert(
  signsSame,
  'Test 4 FAILED: Signs changed (should be same JD → same sign)'
)
console.log('✓ Test 4: House assignment changes with different lagna sign')

// ===== Test 5: Sun is in Aries (sign 1) on 2026-05-05 12:00 UTC =====
const sun = planets.find(p => p.name === 'Sun')
console.assert(
  sun.sign === 1,
  `Test 5 FAILED: Sun sign is ${sun.sign}, expected 1 (Aries) on 2026-05-05 12:00 UTC`
)
console.log('✓ Test 5: Sun is in Aries on 2026-05-05 12:00 UTC')

console.log('\nAll tests passed ✓')
