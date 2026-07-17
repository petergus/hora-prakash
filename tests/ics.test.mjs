// Unit tests for the iCalendar writer (src/utils/ics.js): RFC 5545 escaping,
// octet-based line folding, all-day DTEND exclusivity, UTC stamps.
// Run: node tests/ics.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { buildIcs, escapeText, foldLine, toIcsUtc, toIcsDate } =
  await import('../src/utils/ics.js')

console.log('\n[TEXT escaping — RFC 5545 §3.3.11]')
{
  assert(escapeText('a;b') === 'a\\;b', 'semicolon escaped')
  assert(escapeText('a,b') === 'a\\,b', 'comma escaped')
  assert(escapeText('a\\b') === 'a\\\\b', 'backslash escaped')
  assert(escapeText('a\nb') === 'a\\nb', 'newline → \\n')
  assert(escapeText('a\r\nb') === 'a\\nb', 'CRLF → a single \\n')
  // Order matters: a backslash introduced by escaping ; must not be re-escaped
  assert(escapeText('a;b') === 'a\\;b' && escapeText('\\;') === '\\\\\\;',
    'backslash is escaped before the separators (no double-escaping)')
  assert(escapeText(undefined) === '', 'undefined → empty string')
}

console.log('\n[line folding — 75 OCTETS, not characters]')
{
  const short = 'SUMMARY:hello'
  assert(foldLine(short) === short, 'short lines are untouched')

  const long = 'SUMMARY:' + 'x'.repeat(200)
  const folded = foldLine(long)
  const parts = folded.split('\r\n')
  assert(parts.length > 1, 'long lines are folded')
  assert(parts[0].length === 75, `first segment is exactly 75 octets (got ${parts[0].length})`)
  assert(parts.slice(1).every(p => p.startsWith(' ')), 'continuations begin with a space')
  assert(parts.map((p, i) => i === 0 ? p : p.slice(1)).join('') === long, 'unfolding restores the original')

  // Multi-byte: folding must never split a UTF-8 sequence, so segments stay ≤75 bytes
  const enc = new TextEncoder()
  const uni = 'SUMMARY:' + '☾'.repeat(80)          // 3 bytes each
  const uparts = foldLine(uni).split('\r\n')
  assert(uparts.every(p => enc.encode(p).length <= 75), 'every segment is ≤75 octets with multi-byte text')
  assert(uparts.map((p, i) => i === 0 ? p : p.slice(1)).join('') === uni, 'multi-byte unfolds losslessly')
  assert(!foldLine(uni).includes('�'), 'no replacement chars — sequences never split')
}

console.log('\n[date formatting]')
{
  assert(toIcsUtc(new Date(Date.UTC(2026, 6, 17, 9, 5, 3))) === '20260717T090503Z', 'UTC form zero-pads')
  assert(toIcsDate('2026-07-17') === '20260717', 'DATE form strips dashes')
}

console.log('\n[buildIcs — structure]')
{
  const ics = buildIcs([
    { summary: 'Saturn enters Pisces', start: '2025-03-29', description: 'Sade Sati: final phase' },
  ], { now: new Date(Date.UTC(2026, 0, 1)) })

  const lines = ics.split('\r\n')
  assert(lines[0] === 'BEGIN:VCALENDAR', 'starts with BEGIN:VCALENDAR')
  assert(ics.endsWith('END:VCALENDAR\r\n'), 'ends with END:VCALENDAR + CRLF')
  assert(lines.includes('VERSION:2.0'), 'declares VERSION:2.0')
  assert(lines.filter(l => l === 'BEGIN:VEVENT').length === 1, 'one VEVENT')
  assert(lines.filter(l => l === 'END:VEVENT').length === 1, 'VEVENT is closed')
  assert(lines.some(l => l.startsWith('UID:')), 'event carries a UID')
  assert(lines.includes('DTSTAMP:20260101T000000Z'), 'DTSTAMP uses the injected now')
  assert(ics.split('\r\n').every(l => !l.endsWith('\r') && !l.includes('\n')), 'CRLF-only line endings')
}

console.log('\n[all-day events — DTEND is exclusive]')
{
  const ics = buildIcs([{ summary: 'x', start: '2025-03-29' }])
  assert(ics.includes('DTSTART;VALUE=DATE:20250329'), 'DTSTART is a DATE value')
  assert(ics.includes('DTEND;VALUE=DATE:20250330'), 'single-day DTEND is the NEXT day (exclusive)')

  const span = buildIcs([{ summary: 'x', start: '2025-03-29', end: '2025-03-31' }])
  assert(span.includes('DTEND;VALUE=DATE:20250401'), 'multi-day DTEND is the day after the last day')

  // Month/year rollover
  const roll = buildIcs([{ summary: 'x', start: '2025-12-31' }])
  assert(roll.includes('DTEND;VALUE=DATE:20260101'), 'DTEND rolls over the year boundary')
}

console.log('\n[timed events]')
{
  const s = new Date(Date.UTC(2026, 6, 17, 9, 30))
  const e = new Date(Date.UTC(2026, 6, 17, 11, 0))
  const ics = buildIcs([{ summary: 'Muhurta window', start: s, end: e }])
  assert(ics.includes('DTSTART:20260717T093000Z'), 'timed DTSTART in UTC')
  assert(ics.includes('DTEND:20260717T110000Z'),   'timed DTEND in UTC')
  assert(!ics.includes('VALUE=DATE'), 'timed events are not DATE values')

  const noEnd = buildIcs([{ summary: 'x', start: s }])
  assert(noEnd.includes('DTEND:20260717T093000Z'), 'missing end defaults to start')
}

console.log('\n[escaping flows through to the document]')
{
  const ics = buildIcs([{ summary: 'Jupiter; Saturn, together', description: 'line1\nline2' }].map(e => ({ ...e, start: '2026-01-01' })))
  assert(ics.includes('SUMMARY:Jupiter\\; Saturn\\, together'), 'summary is escaped in the output')
  assert(ics.includes('DESCRIPTION:line1\\nline2'), 'description newline is escaped, not a real break')
}

console.log('\n[uids are unique per event]')
{
  const ics = buildIcs([
    { summary: 'a', start: '2026-01-01' },
    { summary: 'b', start: '2026-01-02' },
  ])
  const uids = ics.split('\r\n').filter(l => l.startsWith('UID:'))
  assert(uids.length === 2 && uids[0] !== uids[1], 'auto-generated UIDs differ')
  const custom = buildIcs([{ uid: 'mine@x', summary: 'a', start: '2026-01-01' }])
  assert(custom.includes('UID:mine@x'), 'explicit UID is honoured')
}

console.log(failures === 0 ? '\nALL ICS TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
