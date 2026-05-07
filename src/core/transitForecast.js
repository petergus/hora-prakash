// src/core/transitForecast.js
import { getSwe }           from './swisseph.js'
import { COMBUST_ORBS }     from './calculations.js'
import { getNakshatraInfo } from './calculations.js'
import { getAspectedSigns } from './aspects.js'

// Scan windows per planet abbreviation (in days)
const SCAN_WINDOWS = {
  Mo: 30, Me: 90, Ve: 90,
  Su: 180, Ma: 180,
  Ju: 540, Ra: 540, Ke: 540,
  Sa: 730,
}

// Sidereal + speed flags
const FLAGS = 65536 | 256

function getRawLon(abbr, id, jd) {
  const swe = getSwe()
  const r   = swe.calc_ut(jd, id, FLAGS)
  return abbr === 'Ke' ? (r[0] + 180) % 360 : r[0]
}

function getSpeed(abbr, id, jd) {
  const swe = getSwe()
  const r   = swe.calc_ut(jd, id, FLAGS)
  return r[3]
}

function getSunLon(jd) {
  const swe = getSwe()
  return swe.calc_ut(jd, 0, FLAGS)[0]
}

function angularDist(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

// Binary-search the JD where condition(jd) flips from false to true
// Resolves to within 1 hour (1/24 JD)
function bisect(jdLo, jdHi, condition) {
  for (let i = 0; i < 20; i++) {
    const mid = (jdLo + jdHi) / 2
    if (jdHi - jdLo < 1 / 24) break
    if (condition(mid)) jdHi = mid
    else jdLo = mid
  }
  return (jdLo + jdHi) / 2
}

function jdToDate(jd) {
  // JD 2440587.5 = 1970-01-01 00:00 UTC
  return new Date((jd - 2440587.5) * 86400000)
}

function signOf(lon) { return Math.floor(((lon % 360) + 360) % 360 / 30) + 1 }
function nakOf(lon)  { return Math.floor(((lon % 360) + 360) % 360 / (360 / 27)) }
function padaOf(lon) { return Math.floor(((lon % 360) + 360) % 360 / (360 / 108)) }

// Gandanta: last 3°20' of Cancer/Scorpio/Pisces OR first 3°20' of Leo/Sagittarius/Aries
const GANDANTA_WATER_SIGNS = new Set([3, 7, 11]) // 0-based sign indices
const GANDANTA_FIRE_SIGNS  = new Set([0, 4, 8])  // 0-based sign indices
const GANDANTA_DEG = 360 / 108 // 3°20'

function isGandanta(lon) {
  const normLon   = ((lon % 360) + 360) % 360
  const sign0     = Math.floor(normLon / 30)
  const degInSign = normLon % 30
  if (GANDANTA_WATER_SIGNS.has(sign0) && degInSign >= (30 - GANDANTA_DEG)) return true
  if (GANDANTA_FIRE_SIGNS.has(sign0)  && degInSign <  GANDANTA_DEG)         return true
  return false
}

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

/**
 * Find all upcoming events for a transiting planet.
 *
 * @param {{ abbr: string, id: number, name: string }} planet  - from PLANETS array
 * @param {number} fromJD           - start Julian Day (current transit JD)
 * @param {object[]} natalPlanets   - state.planets
 * @param {number} natalLagnaSign   - state.lagna.sign (1–12)
 * @returns {{ type: string, date: Date, label: string, detail: string }[]}
 */
export function findNextEvents(planet, fromJD, natalPlanets, natalLagnaSign) {
  const { abbr, id, name } = planet
  const window = SCAN_WINDOWS[abbr] ?? 180
  const events = []

  let prevLon        = getRawLon(abbr, id, fromJD)
  let prevSpeed      = getSpeed(abbr, id, fromJD)
  let prevSign       = signOf(prevLon)
  let prevNak        = nakOf(prevLon)
  let prevPada       = padaOf(prevLon)
  let prevInGandanta = isGandanta(prevLon)
  const orb          = COMBUST_ORBS[name]
  let prevSunLon     = orb !== undefined ? getSunLon(fromJD) : null
  let prevCombust    = orb !== undefined ? angularDist(prevLon, prevSunLon) <= orb : false

  // Track natal planets already aspected at start (avoid re-reporting current state)
  const alreadyAspecting = new Set()
  if (natalPlanets) {
    const aspectedSigns = getAspectedSigns(prevSign, abbr)
    for (const np of natalPlanets) {
      if (aspectedSigns.includes(np.sign)) alreadyAspecting.add(np.abbr)
    }
  }

  for (let d = 1; d <= window; d++) {
    const jd  = fromJD + d
    const lon = getRawLon(abbr, id, jd)
    const spd = getSpeed(abbr, id, jd)
    const sgn = signOf(lon)
    const nak = nakOf(lon)
    const pda = padaOf(lon)
    const inGandanta = isGandanta(lon)

    // Retrograde / Direct
    if (prevSpeed >= 0 && spd < 0) {
      const jdEvent = bisect(jd - 1, jd, jd2 => getSpeed(abbr, id, jd2) < 0)
      events.push({ type: 'retro', date: jdToDate(jdEvent), label: 'Goes Retrograde ℞', detail: '' })
    } else if (prevSpeed < 0 && spd >= 0) {
      const jdEvent = bisect(jd - 1, jd, jd2 => getSpeed(abbr, id, jd2) >= 0)
      events.push({ type: 'direct', date: jdToDate(jdEvent), label: 'Goes Direct ◎', detail: '' })
    }

    // Sign ingress
    if (sgn !== prevSign) {
      const jdEvent = bisect(jd - 1, jd, jd2 => signOf(getRawLon(abbr, id, jd2)) === sgn)
      const house   = ((sgn - natalLagnaSign + 12) % 12) + 1
      events.push({
        type: 'sign',
        date: jdToDate(jdEvent),
        label: `→ Enters ${SIGN_NAMES[sgn - 1]} (H${house})`,
        detail: SIGN_NAMES[sgn - 1],
      })

      // Natal aspect (sign-based): activates on sign ingress
      if (natalPlanets) {
        const newAspected = getAspectedSigns(sgn, abbr)
        for (const np of natalPlanets) {
          if (newAspected.includes(np.sign) && !alreadyAspecting.has(np.abbr)) {
            const aspectType = sgn === np.sign ? '☌ Conjunct' : '◈ Aspects'
            events.push({
              type: 'natal_aspect',
              date: jdToDate(jdEvent),
              label: `${aspectType} natal ${np.name}`,
              detail: np.abbr,
            })
          }
        }
        alreadyAspecting.clear()
        const aspectedSigns = getAspectedSigns(sgn, abbr)
        for (const np of natalPlanets) {
          if (aspectedSigns.includes(np.sign)) alreadyAspecting.add(np.abbr)
        }
      }

      prevSign = sgn
    }

    // Nakshatra change
    if (nak !== prevNak) {
      const jdEvent = bisect(jd - 1, jd, jd2 => nakOf(getRawLon(abbr, id, jd2)) === nak)
      const nakInfo = getNakshatraInfo(lon)
      events.push({
        type: 'nakshatra',
        date: jdToDate(jdEvent),
        label: `★ Nakshatra: ${nakInfo.name}`,
        detail: nakInfo.name,
      })
      prevNak = nak
    }

    // Pada change
    if (pda !== prevPada) {
      const jdEvent = bisect(jd - 1, jd, jd2 => padaOf(getRawLon(abbr, id, jd2)) === pda)
      const nakInfo = getNakshatraInfo(lon)
      events.push({
        type: 'pada',
        date: jdToDate(jdEvent),
        label: `Pāda ${nakInfo.pada}`,
        detail: `${nakInfo.name} Pāda ${nakInfo.pada}`,
      })
      prevPada = pda
    }

    // Gandanta
    if (!prevInGandanta && inGandanta) {
      const jdEvent = bisect(jd - 1, jd, jd2 => isGandanta(getRawLon(abbr, id, jd2)))
      events.push({ type: 'gandanta', date: jdToDate(jdEvent), label: '⚠ Gandanta crossing', detail: '' })
    }
    prevInGandanta = inGandanta

    // Combust
    if (orb !== undefined) {
      const sunLon  = getSunLon(jd)
      const dist    = angularDist(lon, sunLon)
      const combust = dist <= orb
      if (!prevCombust && combust) {
        const jdEvent = bisect(jd - 1, jd, jd2 => {
          const l = getRawLon(abbr, id, jd2)
          const s = getSunLon(jd2)
          return angularDist(l, s) <= orb
        })
        events.push({ type: 'combust_enter', date: jdToDate(jdEvent), label: `☀ Combust (within ${orb}°)`, detail: '' })
      } else if (prevCombust && !combust) {
        const jdEvent = bisect(jd - 1, jd, jd2 => {
          const l = getRawLon(abbr, id, jd2)
          const s = getSunLon(jd2)
          return angularDist(l, s) > orb
        })
        events.push({ type: 'combust_exit', date: jdToDate(jdEvent), label: '☀ Leaves combustion', detail: '' })
      }
      prevCombust = combust
      prevSunLon  = sunLon
    }

    prevLon   = lon
    prevSpeed = spd
  }

  events.sort((a, b) => a.date - b.date)
  return events
}
