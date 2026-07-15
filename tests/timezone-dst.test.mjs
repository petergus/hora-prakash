// tests/timezone-dst.test.mjs
// Birth-chart timezone / DST handling — including historical DST that has since
// been abolished. The birth-instant offset (not today's offset) must drive the
// UTC Julian Day used for the chart.
import assert from 'node:assert'
import { offsetParts, offsetStr, ianaToOffset, parseTzInfo } from '../src/utils/format.js'
import { toJulianDay, localToUTC, getTZOffsetMinutes } from '../src/utils/time.js'

let passed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1 }
}

// Mirror of input.js#offsetPartsAtBirth (kept in sync): for an IANA zone the
// offset is resolved at the birth instant, honouring DST.
function offsetPartsAtBirth(timezone, dob, tob) {
  if (!timezone) return { sign: '+', h: 0, m: 0 }
  if (/^([+-])(\d{1,2}):(\d{2})$/.test(timezone)) return offsetParts(timezone)
  const utc = localToUTC(`${dob}T${tob || '12:00'}:00`, timezone)
  const min = getTZOffsetMinutes(utc, timezone)
  const sign = min >= 0 ? '+' : '-'
  const abs  = Math.abs(Math.round(min))
  return { sign, h: Math.floor(abs / 60), m: abs % 60 }
}

console.log('offsetParts resolves the offset at a reference date (not just "now"):')

test('New York in winter is EST (-05:00)', () => {
  assert.strictEqual(offsetStr(offsetParts('America/New_York', new Date('1985-01-15T12:00:00Z'))), '-05:00')
})

test('New York in summer is EDT (-04:00)', () => {
  assert.strictEqual(offsetStr(offsetParts('America/New_York', new Date('1985-07-15T12:00:00Z'))), '-04:00')
})

test('Moscow summer 1985 used MSD (+04:00) — DST since abolished', () => {
  assert.strictEqual(offsetStr(offsetParts('Europe/Moscow', new Date('1985-07-15T12:00:00Z'))), '+04:00')
})

test('Yerevan July 1982 used USSR summer time (+05:00), winter +04:00', () => {
  assert.strictEqual(offsetStr(offsetParts('Asia/Yerevan', new Date('1982-07-11T12:00:00Z'))), '+05:00')
  assert.strictEqual(offsetStr(offsetParts('Asia/Yerevan', new Date('1982-01-11T12:00:00Z'))), '+04:00')
  // Armenia abolished DST in 2012 → +04:00 year-round today.
  assert.strictEqual(offsetStr(offsetParts('Asia/Yerevan', new Date('2020-07-11T12:00:00Z'))), '+04:00')
})

test('São Paulo observed DST in Jan 2018 (-02:00) but not Jan 2020 (-03:00)', () => {
  assert.strictEqual(offsetStr(offsetParts('America/Sao_Paulo', new Date('2018-01-15T12:00:00Z'))), '-02:00')
  assert.strictEqual(offsetStr(offsetParts('America/Sao_Paulo', new Date('2020-01-15T12:00:00Z'))), '-03:00')
})

test('India has no DST — always +05:30', () => {
  assert.strictEqual(offsetStr(offsetParts('Asia/Kolkata', new Date('1985-07-15T12:00:00Z'))), '+05:30')
  assert.strictEqual(offsetStr(offsetParts('Asia/Kolkata', new Date('1985-01-15T12:00:00Z'))), '+05:30')
})

test('Plain numeric offset is used verbatim (e.g. .jhd imports)', () => {
  assert.strictEqual(offsetStr(offsetParts('-08:00', new Date('1985-07-15T12:00:00Z'))), '-08:00')
})

console.log('\nUTC / Julian Day reflects the DST offset at the birth instant:')

test('A January New York birth converts with EST, not summer EDT', () => {
  // 12:00 EST → 17:00 UTC. The buggy "today" path (EDT in July) would give 16:00.
  const utc = localToUTC('1985-01-15T12:00:00', 'America/New_York')
  assert.strictEqual(utc.getUTCHours(), 17, `expected 17:00 UTC, got ${utc.getUTCHours()}:00`)
})

test('Same wall-clock birth, opposite seasons, differ by exactly one DST hour', () => {
  const jdJan = toJulianDay('1985-01-15', '12:00', 'America/New_York') // EST
  const jdJul = toJulianDay('1985-07-15', '12:00', 'America/New_York') // EDT
  const jan = localToUTC('1985-01-15T12:00:00', 'America/New_York')
  const jul = localToUTC('1985-07-15T12:00:00', 'America/New_York')
  assert.strictEqual(jan.getUTCHours(), 17)
  assert.strictEqual(jul.getUTCHours(), 16)
  assert.ok(Number.isFinite(jdJan) && Number.isFinite(jdJul))
})

console.log('\noffsetPartsAtBirth mirrors what the chart calculation will use:')

test('offsetPartsAtBirth matches the offset localToUTC applies (NY winter)', () => {
  const parts = offsetPartsAtBirth('America/New_York', '1985-01-15', '12:00')
  assert.strictEqual(offsetStr(parts), '-05:00')
})

test('offsetPartsAtBirth resolves DST that no longer exists (Moscow 1985)', () => {
  const parts = offsetPartsAtBirth('Europe/Moscow', '1985-07-15', '02:30')
  assert.strictEqual(offsetStr(parts), '+04:00')
})

test('parseTzInfo abbreviation reflects the reference date', () => {
  const winter = parseTzInfo('America/New_York', new Date('1985-01-15T12:00:00Z'))
  const summer = parseTzInfo('America/New_York', new Date('1985-07-15T12:00:00Z'))
  assert.strictEqual(winter.abbr, 'EST')
  assert.strictEqual(summer.abbr, 'EDT')
})

test('ianaToOffset accepts a reference date', () => {
  assert.strictEqual(ianaToOffset('America/New_York', new Date('1985-01-15T12:00:00Z')), '-05:00')
})

console.log(`\n✅ timezone-dst: ${passed} checks passed`)
