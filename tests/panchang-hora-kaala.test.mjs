/**
 * Standalone tests for hora lord and kaala lord calculations.
 * No browser/WASM needed — tests pure math logic.
 *
 * Run: node tests/panchang-hora-kaala.test.mjs
 *
 * Add more rows from pyjhora/JHora to expand coverage.
 */

const CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']
const DAY_LORD_CHALDEAN = [3, 6, 2, 5, 1, 4, 0]  // Sun→3, Mon→6, Tue→2, Wed→5, Thu→1, Fri→4, Sat→0

// Kaala sequence — K[(weekday + partIdx) % 7]. Derived from 4 verified JHora charts.
const KAALA_SEQ = ['Venus', 'Sun', 'Jupiter', 'Mars', 'Saturn', 'Mercury', 'Moon']

function horaLord(weekday, horaNum) {
  return CHALDEAN[((DAY_LORD_CHALDEAN[weekday] + horaNum) % 7 + 7) % 7]
}

function kaalaPartIdx(birthSec, sunriseSec, sunsetSec) {
  const dayDur = sunsetSec - sunriseSec
  const nightDur = 86400 - dayDur
  if (birthSec >= sunriseSec && birthSec < sunsetSec) {
    return Math.min(7, Math.floor((birthSec - sunriseSec) / (dayDur / 8)))
  }
  const elapsed = birthSec >= sunsetSec ? birthSec - sunsetSec : birthSec + (86400 - sunsetSec)
  return Math.min(7, Math.floor(elapsed / (nightDur / 8)))
}

function kaalaLord(weekday, partIdx) {
  return KAALA_SEQ[(weekday + partIdx) % 7]
}

function horaNumFromTimes(sunriseSec, birthSec) {
  return Math.floor((birthSec - sunriseSec) / 3600)
}

// ─── Test cases ───────────────────────────────────────────────────────────────
// weekday: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
// All times = seconds from midnight (local time, IST)
// Sources: JHora (Java), pyjhora. Our app uses Hindu rising sunrise (≈JHora).

const cases = [
  {
    name: 'Chart A — Jul 26 1990 8:30am (pyjhora)',
    weekday: 4,  // Thursday
    sunriseSec: 5 * 3600 + 43 * 60 + 44,   // 5:43:44am (our Hindu-rising sunrise)
    sunsetSec:  18 * 3600 + 52 * 60 + 57,  // 6:52:57pm
    birthSec:   8 * 3600 + 30 * 60,         // 8:30:00am
    expectedHoraLord:  'Sun',
    expectedKaalaLord: 'Mercury',
  },
  {
    name: 'Chart B — Jan 11 1992 3:13pm (JHora)',
    weekday: 6,  // Saturday
    sunriseSec: 7 * 3600 + 18 * 60 + 21,
    sunsetSec:  17 * 3600 + 35 * 60 + 32,
    birthSec:   15 * 3600 + 13 * 60,
    expectedHoraLord:  'Saturn',
    expectedKaalaLord: 'Mercury',
  },
  {
    name: 'Indira Gandhi — Nov 19 1917 11:11pm (JHora)',
    weekday: 1,  // Monday
    sunriseSec: 6 * 3600 + 26 * 60 + 18,
    sunsetSec:  17 * 3600 + 9 * 60 + 25,
    birthSec:   23 * 3600 + 11 * 60,
    expectedHoraLord:  'Jupiter',
    expectedKaalaLord: 'Saturn',
  },
  {
    name: 'Amitabh Bachchan — Oct 11 1942 2:58:52pm (JHora)',
    weekday: 0,  // Sunday
    sunriseSec: 6 * 3600 + 2 * 60 + 27,
    sunsetSec:  17 * 3600 + 36 * 60 + 15,
    birthSec:   14 * 3600 + 58 * 60 + 52,
    expectedHoraLord:  'Venus',
    expectedKaalaLord: 'Moon',
  },
  // ── Add more rows from pyjhora here ──────────────────────────────────────────
  // {
  //   name: 'Person — Date Time',
  //   weekday: <0-6>,
  //   sunriseSec: <sunrise in seconds from midnight>,
  //   sunsetSec:  <sunset in seconds from midnight>,
  //   birthSec:   <birth time in seconds from midnight>,
  //   expectedHoraLord:  '<planet>',
  //   expectedKaalaLord: '<planet>',
  // },
]

// ─── Runner ───────────────────────────────────────────────────────────────────
let pass = 0, fail = 0

for (const c of cases) {
  const h = horaNumFromTimes(c.sunriseSec, c.birthSec)
  const kIdx = kaalaPartIdx(c.birthSec, c.sunriseSec, c.sunsetSec)
  const gotHora  = horaLord(c.weekday, h)
  const gotKaala = kaalaLord(c.weekday, kIdx)

  const horaOk  = gotHora  === c.expectedHoraLord
  const kaalaOk = gotKaala === c.expectedKaalaLord
  const ok = horaOk && kaalaOk

  if (ok) {
    pass++
    console.log(`✅ ${c.name}`)
    console.log(`   horaNum=${h}  kaalaPart=${kIdx}  hora=${gotHora}  kaala=${gotKaala}`)
  } else {
    fail++
    console.log(`❌ ${c.name}`)
    console.log(`   horaNum=${h}  kaalaPart=${kIdx}`)
    if (!horaOk)  console.log(`   hora:  got ${gotHora}  expected ${c.expectedHoraLord}`)
    if (!kaalaOk) console.log(`   kaala: got ${gotKaala}  expected ${c.expectedKaalaLord}`)
  }
}

console.log(`\n${pass}/${pass + fail} passed`)
if (fail > 0) process.exit(1)
