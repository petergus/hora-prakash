/**
 * Standalone tests for hora lord and kaala lord calculations.
 * No browser/WASM needed — tests pure math logic.
 *
 * Run: node tests/panchang-hora-kaala.test.mjs
 *
 * Add more rows from pyjhora to expand coverage.
 */

const CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']
const DAY_LORD_CHALDEAN = [3, 6, 2, 5, 1, 4, 0]  // Sun→3, Mon→6, ..., Sat→0

const WEEKDAY_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

function horaLord(weekday, horaNum) {
  return CHALDEAN[((DAY_LORD_CHALDEAN[weekday] + horaNum) % 7 + 7) % 7]
}

function kaalaLord(weekday, horaNum) {
  return WEEKDAY_PLANETS[((weekday + 4 + horaNum) % 7 + 7) % 7]
}

/**
 * horaNum = floor(hours elapsed since sunrise)
 * All times in seconds from midnight, IST (+5:30 = UTC+19800s)
 */
function horaNumFromTimes(sunriseSec, birthSec) {
  return Math.floor((birthSec - sunriseSec) / 3600)
}

// ─── Test cases (from JHora / pyjhora) ────────────────────────────────────────
// weekday: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// times in seconds from midnight

const cases = [
  {
    name: 'Chart A — Jul 26 1990 8:30am IST (pyjhora)',
    weekday: 4,  // Thursday
    // pyjhora sunrise 5:29:58am; our Hindu-rising sunrise ≈5:43:44am (JHora)
    // Using JHora sunrise (what our app computes):
    sunriseSec: 5 * 3600 + 43 * 60 + 44,  // 5:43:44am
    birthSec:   8 * 3600 + 30 * 60,        // 8:30:00am
    expectedHoraLord:  'Sun',
    expectedKaalaLord: 'Mercury',
  },
  {
    name: 'Chart B — Jan 11 1992 3:13pm IST (JHora)',
    weekday: 6,  // Saturday
    sunriseSec: 7 * 3600 + 18 * 60 + 21,  // 7:18:21am
    birthSec:  15 * 3600 + 13 * 60,        // 3:13:00pm
    expectedHoraLord:  'Saturn',
    expectedKaalaLord: 'Mercury',
  },
  // ── Add more rows from pyjhora here ──────────────────────────────────────────
  // {
  //   name: 'Person Name — Date Time Timezone',
  //   weekday: <0-6>,
  //   sunriseSec: <pyjhora sunrise in seconds from midnight>,
  //   birthSec:   <birth time in seconds from midnight>,
  //   expectedHoraLord:  '<planet>',
  //   expectedKaalaLord: '<planet>',
  // },
]

// ─── Runner ───────────────────────────────────────────────────────────────────
let pass = 0, fail = 0

for (const c of cases) {
  const h = horaNumFromTimes(c.sunriseSec, c.birthSec)
  const gotHora  = horaLord(c.weekday, h)
  const gotKaala = kaalaLord(c.weekday, h)

  const horaOk  = gotHora  === c.expectedHoraLord
  const kaalaOk = gotKaala === c.expectedKaalaLord
  const ok = horaOk && kaalaOk

  if (ok) {
    pass++
    console.log(`✅ ${c.name}`)
    console.log(`   horaNum=${h}  hora=${gotHora}  kaala=${gotKaala}`)
  } else {
    fail++
    console.log(`❌ ${c.name}`)
    console.log(`   horaNum=${h}`)
    if (!horaOk)  console.log(`   hora:  got ${gotHora}  expected ${c.expectedHoraLord}`)
    if (!kaalaOk) console.log(`   kaala: got ${gotKaala}  expected ${c.expectedKaalaLord}`)
  }
}

console.log(`\n${pass}/${pass + fail} passed`)
if (fail > 0) process.exit(1)
