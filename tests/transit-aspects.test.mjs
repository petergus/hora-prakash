import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const { getAspectedSigns, getTransitToNatalAspects, getTransitToTransitAspects } = await import(
  join(rootDir, 'src/core/aspects.js')
)

// Helper to create a planet object
function makePlanet(abbr, house) {
  return {
    abbr,
    house,
    name: abbr,
    sign: house,
    degree: 0,
    retrograde: false,
  }
}

console.log('\n=== Transit Aspect Unit Tests ===\n')

// Test 1: Mars in house 1 → aspectsHouses includes 4, 7, 8
console.log('Test 1: Mars in house 1 aspects houses 4, 7, 8')
try {
  const marsPlanet = makePlanet('Ma', 1)
  const result = getTransitToNatalAspects([marsPlanet], [])
  const marsAspect = result.find(r => r.transitPlanet.abbr === 'Ma')
  console.assert(marsAspect, 'Mars aspect result exists')
  console.assert(marsAspect.aspectsHouses.includes(4), 'Mars aspects house 4')
  console.assert(marsAspect.aspectsHouses.includes(7), 'Mars aspects house 7')
  console.assert(marsAspect.aspectsHouses.includes(8), 'Mars aspects house 8')
  console.log('✓ Test 1 passed\n')
} catch (e) {
  console.log(`✗ Test 1 failed: ${e.message}\n`)
}

// Test 2: Mars in house 6 → aspectsHouses includes 9, 12, 1 (wrap-around)
console.log('Test 2: Mars in house 6 aspects houses 9, 12, 1 (wrap-around)')
try {
  const marsPlanet = makePlanet('Ma', 6)
  const result = getTransitToNatalAspects([marsPlanet], [])
  const marsAspect = result.find(r => r.transitPlanet.abbr === 'Ma')
  console.assert(marsAspect, 'Mars aspect result exists')
  console.assert(marsAspect.aspectsHouses.includes(9), 'Mars aspects house 9')
  console.assert(marsAspect.aspectsHouses.includes(12), 'Mars aspects house 12')
  console.assert(marsAspect.aspectsHouses.includes(1), 'Mars aspects house 1 (wrap)')
  console.log('✓ Test 2 passed\n')
} catch (e) {
  console.log(`✗ Test 2 failed: ${e.message}\n`)
}

// Test 3: Jupiter in house 3 → aspectsHouses includes 7, 9, 11
console.log('Test 3: Jupiter in house 3 aspects houses 7, 9, 11')
try {
  const juPlanet = makePlanet('Ju', 3)
  const result = getTransitToNatalAspects([juPlanet], [])
  const juAspect = result.find(r => r.transitPlanet.abbr === 'Ju')
  console.assert(juAspect, 'Jupiter aspect result exists')
  console.assert(juAspect.aspectsHouses.includes(7), 'Jupiter aspects house 7')
  console.assert(juAspect.aspectsHouses.includes(9), 'Jupiter aspects house 9')
  console.assert(juAspect.aspectsHouses.includes(11), 'Jupiter aspects house 11')
  console.log('✓ Test 3 passed\n')
} catch (e) {
  console.log(`✗ Test 3 failed: ${e.message}\n`)
}

// Test 4: Natal planet matching — Saturn in house 1 aspects houses 3, 7, 10
console.log('Test 4: Saturn in house 1 aspects natal planets at houses 3, 7, 10 but not 5')
try {
  const saPlanet = makePlanet('Sa', 1)
  const natalPlanets = [
    makePlanet('Su', 3),
    makePlanet('Ma', 7),
    makePlanet('Mo', 5),
  ]
  const result = getTransitToNatalAspects([saPlanet], natalPlanets)
  const saAspect = result.find(r => r.transitPlanet.abbr === 'Sa')
  console.assert(saAspect, 'Saturn aspect result exists')
  console.assert(saAspect.aspectsNatalPlanets.includes('Su'), 'Saturn aspects Sun')
  console.assert(saAspect.aspectsNatalPlanets.includes('Ma'), 'Saturn aspects Mars')
  console.assert(!saAspect.aspectsNatalPlanets.includes('Mo'), 'Saturn does not aspect Moon')
  console.log('✓ Test 4 passed\n')
} catch (e) {
  console.log(`✗ Test 4 failed: ${e.message}\n`)
}

// Test 5: Transit-to-transit mutual aspects
console.log('Test 5: Transit-to-transit mutual aspects — Saturn and Jupiter')
try {
  const saPlanet = makePlanet('Sa', 2)
  const juPlanet = makePlanet('Ju', 8)
  const transitPlanets = [saPlanet, juPlanet]
  const result = getTransitToTransitAspects(transitPlanets)

  // Saturn in house 2 aspects houses 4, 8, 11
  const saAspect = result.find(r => r.planet.abbr === 'Sa')
  console.assert(saAspect, 'Saturn aspect result exists')
  console.assert(saAspect.aspectsPlanets.includes('Ju'), 'Saturn aspects Jupiter (house 8)')

  // Jupiter in house 8 aspects houses 12, 2, 4
  const juAspect = result.find(r => r.planet.abbr === 'Ju')
  console.assert(juAspect, 'Jupiter aspect result exists')
  console.assert(juAspect.aspectsPlanets.includes('Sa'), 'Jupiter aspects Saturn (house 2)')

  console.log('✓ Test 5 passed\n')
} catch (e) {
  console.log(`✗ Test 5 failed: ${e.message}\n`)
}

// Test 6: No self-aspect
console.log('Test 6: No planet aspects itself')
try {
  const saPlanet = makePlanet('Sa', 1)
  const transitPlanets = [saPlanet]
  const result = getTransitToTransitAspects(transitPlanets)
  const saAspect = result.find(r => r.planet.abbr === 'Sa')
  console.assert(saAspect, 'Saturn aspect result exists')
  console.assert(!saAspect.aspectsPlanets.includes('Sa'), 'Saturn does not aspect itself')
  console.log('✓ Test 6 passed\n')
} catch (e) {
  console.log(`✗ Test 6 failed: ${e.message}\n`)
}

// Test 7: Regression — getAspectedSigns still works
console.log('Test 7: Regression — getAspectedSigns (existing function)')
try {
  // Mars sign 1 → aspects signs 4, 7, 8
  const marsAspects = getAspectedSigns(1, 'Ma')
  console.assert(marsAspects.includes(4), 'Mars sign 1 aspects sign 4')
  console.assert(marsAspects.includes(7), 'Mars sign 1 aspects sign 7')
  console.assert(marsAspects.includes(8), 'Mars sign 1 aspects sign 8')

  // Jupiter sign 3 → aspects signs 7, 9, 11
  const juAspects = getAspectedSigns(3, 'Ju')
  console.assert(juAspects.includes(7), 'Jupiter sign 3 aspects sign 7')
  console.assert(juAspects.includes(9), 'Jupiter sign 3 aspects sign 9')
  console.assert(juAspects.includes(11), 'Jupiter sign 3 aspects sign 11')

  console.log('✓ Test 7 passed\n')
} catch (e) {
  console.log(`✗ Test 7 failed: ${e.message}\n`)
}

console.log('=== Tests Complete ===\n')
