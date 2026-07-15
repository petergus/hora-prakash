// tests/places-timezone.test.mjs
// The bundled city database (public/places.json) must carry an IANA zone name
// (`t`) per city so the chart calculation can derive the birth-instant UTC
// offset (DST-aware, incl. historical/abolished DST) instead of a single fixed
// numeric offset that was baked to one season. Guards against a regression to
// the old `{ z: "+HH:MM" }`-only schema.
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { offsetStr } from '../src/utils/format.js'
import { localToUTC, getTZOffsetMinutes } from '../src/utils/time.js'
import { nearestZone } from '../src/utils/nearest-zone.js'
import { zoneFromCoords, reconcileCachedZones } from '../src/utils/tz-resolve.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const places = JSON.parse(
  readFileSync(resolve(__dirname, '../public/places.json'), 'utf8'),
)

let passed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1 }
}
async function atest(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1 }
}

// Mirror of input.js#offsetPartsAtBirth — resolves an IANA zone's offset at the
// birth instant (DST-aware), or uses a numeric offset verbatim.
function offsetAtBirth(timezone, dob, tob) {
  if (/^([+-])(\d{1,2}):(\d{2})$/.test(timezone)) return timezone
  const utc = localToUTC(`${dob}T${tob || '12:00'}:00`, timezone)
  const min = getTZOffsetMinutes(utc, timezone)
  const sign = min >= 0 ? '+' : '-'
  const abs  = Math.abs(Math.round(min))
  return offsetStr({ sign, h: Math.floor(abs / 60), m: abs % 60 })
}

const byName = name => {
  const e = places.find(p => p.n.includes(name))
  if (!e) throw new Error(`fixture city not found in places.json: "${name}"`)
  return e
}

console.log('Every place carries a resolvable timezone:')

test('no entry lost its zone (has `t` or `z`)', () => {
  const orphan = places.find(p => !p.t && !p.z)
  assert.ok(!orphan, `entry with neither t nor z: ${JSON.stringify(orphan)}`)
})

test('the vast majority resolved to an IANA zone name', () => {
  const withIana = places.filter(p => typeof p.t === 'string' && p.t.includes('/')).length
  assert.ok(withIana / places.length > 0.99, `only ${withIana}/${places.length} have IANA zones`)
})

test('IANA zones are valid (accepted by Intl)', () => {
  for (const name of ['Las Cruces', 'Viersen', 'Isesaki', 'Mandasa']) {
    const tz = byName(name).t
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: tz }))
  }
})

console.log('\nDST regions now resolve the offset at the birth instant, not a baked value:')

// America/Denver — the old data baked -06:00 (MDT). A winter birth must be MST.
test('Las Cruces (America/Denver): winter birth = MST -07:00, summer = MDT -06:00', () => {
  const tz = byName('Las Cruces').t
  assert.strictEqual(tz, 'America/Denver')
  assert.strictEqual(offsetAtBirth(tz, '1985-01-15', '12:00'), '-07:00')
  assert.strictEqual(offsetAtBirth(tz, '1985-07-15', '12:00'), '-06:00')
})

// America/Chicago — old data baked -05:00 (CDT); winter must be CST.
test('North Little Rock (America/Chicago): winter birth = CST -06:00', () => {
  const tz = byName('North Little Rock').t
  assert.strictEqual(tz, 'America/Chicago')
  assert.strictEqual(offsetAtBirth(tz, '1985-01-15', '12:00'), '-06:00')
})

// Europe/Berlin — old data baked +02:00 (CEST); winter must be CET.
test('Viersen (Europe/Berlin): winter birth = CET +01:00, summer = CEST +02:00', () => {
  const tz = byName('Viersen').t
  assert.strictEqual(tz, 'Europe/Berlin')
  assert.strictEqual(offsetAtBirth(tz, '1985-01-15', '12:00'), '+01:00')
  assert.strictEqual(offsetAtBirth(tz, '1985-07-15', '12:00'), '+02:00')
})

test('India has no DST — Mandasa stays +05:30 year-round', () => {
  const tz = byName('Mandasa').t
  assert.strictEqual(tz, 'Asia/Kolkata')
  assert.strictEqual(offsetAtBirth(tz, '1985-01-15', '12:00'), '+05:30')
  assert.strictEqual(offsetAtBirth(tz, '1985-07-15', '12:00'), '+05:30')
})

console.log('\n"Auto-detect from coordinates" resolves offline from tz boundary data:')

await atest('Perm coords resolve to Asia/Yekaterinburg (+5), not Europe/Moscow (+3)', async () => {
  // The original bug: the online lookup mislabelled Perm as Europe/Moscow.
  const zone = await zoneFromCoords(58.0297, 56.2668)
  assert.strictEqual(zone, 'Asia/Yekaterinburg')
  // Modern Perm has no DST (Russia abolished it in 2011) → +05:00 year-round.
  assert.strictEqual(offsetAtBirth(zone, '2015-06-15', '12:00'), '+05:00')
  assert.strictEqual(offsetAtBirth(zone, '2015-01-15', '12:00'), '+05:00')
  // …and the engine still honours the USSR summer time that applied in 1990.
  assert.strictEqual(offsetAtBirth(zone, '1990-06-15', '12:00'), '+06:00')
})

await atest('Yerevan resolves to Asia/Yerevan even though the city DB has no Armenia', async () => {
  // The nearest bundled city is Vladikavkaz, Russia (~300 km) → Europe/Moscow;
  // nearest-city snapping gave a July 1982 Yerevan birth Moscow's +4 instead
  // of Armenia's +5 (USSR summer time). Boundary lookup respects the border.
  const zone = await zoneFromCoords(40.1872, 44.5152)
  assert.strictEqual(zone, 'Asia/Yerevan')
  assert.strictEqual(offsetAtBirth(zone, '1982-07-11', '12:00'), '+05:00') // USSR DST
  assert.strictEqual(offsetAtBirth(zone, '1982-01-11', '12:00'), '+04:00') // winter
  assert.strictEqual(offsetAtBirth(zone, '2020-07-11', '12:00'), '+04:00') // DST abolished 2012
})

await atest('other countries missing from the city DB resolve exactly too', async () => {
  for (const [lat, lon, want] of [
    [41.7151,  44.8271, 'Asia/Tbilisi'],     // Georgia
    [50.4501,  30.5234, 'Europe/Kyiv'],      // Ukraine
    [53.3498,  -6.2603, 'Europe/Dublin'],    // Ireland
    [35.6892,  51.3890, 'Asia/Tehran'],      // Iran
    [-36.8485, 174.7633, 'Pacific/Auckland'], // New Zealand
  ]) {
    assert.strictEqual(await zoneFromCoords(lat, lon), want)
  }
})

await atest('boundary lookup agrees with the bundled DB\'s own zones (consistent)', async () => {
  // Picking a bundled city then hitting auto-detect must not change the zone.
  for (const name of ['Perm', 'Las Cruces', 'Viersen', 'Mandasa']) {
    const city = byName(name)
    assert.strictEqual(await zoneFromCoords(city.a, city.o), city.t)
  }
})

console.log('\nNearest-city fallback (used only if the boundary chunk fails to load):')

test('coordinates near a bundled city snap to its zone', () => {
  // ~15 km from Perm's centre → still Asia/Yekaterinburg.
  assert.strictEqual(nearestZone(58.10, 56.10, places), 'Asia/Yekaterinburg')
})

test('remote coordinates (mid-Pacific) return null (next fallback)', () => {
  assert.strictEqual(nearestZone(0, -140, places), null)
})

console.log('\nStale location-cache entries are re-resolved against boundary data:')

// The reported bug: cache hits rank above the corrected places.json entry, so
// a Perm entry cached before the DB carried IANA zones kept filling the form
// with +3 while auto-detect (⟳) said +5.
await atest('cached Perm with Europe/Moscow or a fixed +03:00 reconciles to Asia/Yekaterinburg', async () => {
  const stale = [
    { displayName: 'Perm, Russia', lat: 58.0297, lon: 56.2668, tz: 'Europe/Moscow' },
    { displayName: 'Perm, Russia', lat: 58.0297, lon: 56.2668, tz: '+03:00' },
    { displayName: 'Perm, Russia', lat: 58.0297, lon: 56.2668, tz: undefined },
  ]
  for (const e of await reconcileCachedZones(stale)) {
    assert.strictEqual(e.tz, 'Asia/Yekaterinburg')
    assert.strictEqual(offsetAtBirth(e.tz, '2015-01-15', '12:00'), '+05:00')
  }
})

await atest('cached Yerevan mislabelled Europe/Moscow reconciles to Asia/Yerevan', async () => {
  // Nearest-city reconciliation would have *kept* (even introduced) Moscow
  // here — boundary reconciliation must fix it across the missing-country gap.
  const stale = [{ displayName: 'Yerevan, Armenia', lat: 40.1872, lon: 44.5152, tz: 'Europe/Moscow' }]
  const [out] = await reconcileCachedZones(stale)
  assert.strictEqual(out.tz, 'Asia/Yerevan')
  assert.strictEqual(offsetAtBirth(out.tz, '1982-07-11', '12:00'), '+05:00')
})

await atest('a correctly cached entry passes through unchanged', async () => {
  const ok = [
    { displayName: 'Perm, Russia', lat: 58.0297, lon: 56.2668, tz: 'Asia/Yekaterinburg' },
    { displayName: 'Adamstown, Pitcairn', lat: -25.07, lon: -130.1, tz: 'Pacific/Pitcairn' },
  ]
  const out = await reconcileCachedZones(ok)
  assert.strictEqual(out[0], ok[0])
  assert.strictEqual(out[1], ok[1])
})

console.log(`\n✅ places-timezone: ${passed} checks passed`)
