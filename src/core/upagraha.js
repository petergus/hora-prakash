// src/core/upagraha.js
// Upagrahas & special lagnas: Gulika, Mandi, and the BPHS special ascendants
// (Bhava / Hora / Ghati / Sree / Indu lagna).
//
// The mathematical rules (verified against JHora's Indira Gandhi output):
//  - Bhava/Hora/Ghati lagna start from the Sun's sidereal longitude at (Hindu)
//    sunrise and advance 6° / 12° / 30° per ghati (24 min) elapsed since sunrise.
//  - Sree lagna projects the fraction of the Moon's nakshatra already traversed
//    onto the whole zodiac, counted from the natal lagna.
//  - Indu lagna: kalas of the 9th lords from lagna and from Moon are summed;
//    the remainder mod 12 is counted from the Moon's sign (Moon's degree kept).
//  - Gulika rises at the START of Saturn's portion among the eight equal parts
//    of the day (sunrise→sunset) or night (sunset→next sunrise); Mandi at its
//    MIDDLE. Day portions are ruled from the weekday lord onward, night
//    portions from the 5th lord after it. Their longitude is the ascendant
//    rising at that moment.
//
// The pure helpers are Node-safe and golden-tested (tests/upagraha.test.mjs);
// calcUpagrahas needs a real ephemeris (sunrise + ascendant).

import { getSwe } from './swisseph.js'
import { getNakshatraInfo } from './calculations.js'
import { calcRiseSet } from './panchang.js'
import { toJulianDay } from '../utils/time.js'
import { SIGN_LORDS } from './avastha.js'

const SIDEREAL_FLAG = 2 | 65536 | 256 // SWIEPH | SIDEREAL | SPEED

const norm = lon => ((lon % 360) + 360) % 360

export const INDU_KALAS = { Sun: 30, Moon: 16, Mars: 6, Mercury: 8, Jupiter: 10, Venus: 12, Saturn: 1 }

/**
 * Index (0–7) of Saturn's portion among the eight equal parts of the day or
 * night. Day parts are ruled starting from the weekday lord (Sun..Sat order);
 * night parts start from the 5th lord counted from it; the 8th part is
 * lord-less.
 * @param {number} weekday 0=Sunday .. 6=Saturday (the Vedic day's lord)
 */
export function saturnPortionIndex(weekday, isNight) {
  const startIdx = isNight ? (weekday + 4) % 7 : weekday
  return (6 - startIdx + 7) % 7
}

/**
 * Gulika (start of Saturn's portion) and Mandi (its middle) as JDs.
 * All JDs must belong to one Vedic day: sunriseJd ≤ birthJd < nextSunriseJd.
 */
export function gulikaMandiJds({ birthJd, sunriseJd, sunsetJd, nextSunriseJd, weekday }) {
  const isNight   = birthJd >= sunsetJd || birthJd < sunriseJd
  const spanStart = isNight ? sunsetJd : sunriseJd
  const spanLen   = isNight ? (nextSunriseJd - sunsetJd) : (sunsetJd - sunriseJd)
  const part      = spanLen / 8
  const idx       = saturnPortionIndex(weekday, isNight)
  return {
    gulikaJd: spanStart + idx * part,
    mandiJd:  spanStart + (idx + 0.5) * part,
    isNight,
  }
}

/**
 * The five special lagnas — pure math.
 * @param {object} p { sunLonAtSunrise, ghatis, lagnaLon, moonLon } (sidereal °)
 * @returns {{ bhavaLagna, horaLagna, ghatiLagna, sreeLagna, induLagna }} sidereal longitudes
 */
export function calcSpecialLagnas({ sunLonAtSunrise, ghatis, lagnaLon, moonLon }) {
  const bhavaLagna = norm(sunLonAtSunrise + ghatis * 6)
  const horaLagna  = norm(sunLonAtSunrise + ghatis * 12)
  const ghatiLagna = norm(sunLonAtSunrise + ghatis * 30)

  const nakSpan = 360 / 27
  const frac = (norm(moonLon) % nakSpan) / nakSpan
  const sreeLagna = norm(lagnaLon + frac * 360)

  const lagnaSign = Math.floor(norm(lagnaLon) / 30) + 1
  const moonSign  = Math.floor(norm(moonLon) / 30) + 1
  const lord9 = sign => SIGN_LORDS[((sign - 1) + 8) % 12]
  const sum = INDU_KALAS[lord9(lagnaSign)] + INDU_KALAS[lord9(moonSign)]
  const rem = sum % 12 === 0 ? 12 : sum % 12
  const induSign = ((moonSign - 1 + rem - 1) % 12) + 1
  const induLagna = (induSign - 1) * 30 + (norm(moonLon) % 30)

  return { bhavaLagna, horaLagna, ghatiLagna, sreeLagna, induLagna }
}

/** Wrap a longitude into a planet-table-shaped point. */
function makePoint(key, name, lon, natalLagnaSign) {
  const L = norm(lon)
  const sign = Math.floor(L / 30) + 1
  const nak = getNakshatraInfo(L)
  return {
    key, name, lon: L, sign,
    degree: L % 30,
    house: ((sign - natalLagnaSign + 12) % 12) + 1,
    nakshatra: nak.name, nakshatraLord: nak.lord, pada: nak.pada,
  }
}

/**
 * All upagrahas & special lagnas for a birth chart.
 * @param {object} birth  { dob, tob, timezone, lat, lon }
 * @param {object} lagna  natal lagna ({ lon, sign })
 * @param {object[]} planets natal planets (needs the Moon)
 * @param {object} [_swe] ephemeris override
 * @returns {{ points: object[], meta: object }|null} null when sunrise is unavailable
 */
export function calcUpagrahas(birth, lagna, planets, _swe) {
  const swe = _swe || getSwe()
  const moon = planets?.find(p => p.name === 'Moon')
  if (!moon || !birth?.dob || !birth?.tob || !lagna) return null

  const tz = birth.timezone ?? '+00:00'
  const birthJd = toJulianDay(birth.dob, birth.tob, tz)

  // Vedic day = sunrise → next sunrise. A birth before sunrise belongs to the
  // previous civil day's Vedic day (and weekday).
  let dayStart = toJulianDay(birth.dob, '00:00', tz)
  let weekday  = new Date(birth.dob + 'T12:00:00Z').getUTCDay()
  let { sunriseJd, sunsetJd } = calcRiseSet(dayStart, birth.lat, birth.lon, swe)
  if (sunriseJd == null || sunsetJd == null) return null

  let nextSunriseJd
  if (birthJd < sunriseJd) {
    nextSunriseJd = sunriseJd
    dayStart -= 1
    weekday = (weekday + 6) % 7
    const prev = calcRiseSet(dayStart, birth.lat, birth.lon, swe)
    if (prev.sunriseJd == null || prev.sunsetJd == null) return null
    sunriseJd = prev.sunriseJd
    sunsetJd  = prev.sunsetJd
  } else {
    nextSunriseJd = calcRiseSet(dayStart + 1, birth.lat, birth.lon, swe).sunriseJd
    if (nextSunriseJd == null) return null
  }

  const ghatis = (birthJd - sunriseJd) * 60 // 1 ghati = 24 min = 1/60 day
  const sunLonAtSunrise = swe.calc_ut(sunriseJd, 0, SIDEREAL_FLAG)[0]

  const special = calcSpecialLagnas({
    sunLonAtSunrise, ghatis, lagnaLon: lagna.lon, moonLon: moon.lon,
  })

  const { gulikaJd, mandiJd, isNight } = gulikaMandiJds({
    birthJd, sunriseJd, sunsetJd, nextSunriseJd, weekday,
  })
  const ascAt = jd => norm(swe.houses_ex(jd, 65536, birth.lat, birth.lon, 'P').ascmc[0])

  const points = [
    makePoint('gulika', 'Gulika',      ascAt(gulikaJd),    lagna.sign),
    makePoint('mandi',  'Mandi',       ascAt(mandiJd),     lagna.sign),
    makePoint('bhava',  'Bhava Lagna', special.bhavaLagna, lagna.sign),
    makePoint('hora',   'Hora Lagna',  special.horaLagna,  lagna.sign),
    makePoint('ghati',  'Ghati Lagna', special.ghatiLagna, lagna.sign),
    makePoint('sree',   'Sree Lagna',  special.sreeLagna,  lagna.sign),
    makePoint('indu',   'Indu Lagna',  special.induLagna,  lagna.sign),
  ]

  return { points, meta: { isNight, ghatis, sunriseJd, sunsetJd, nextSunriseJd, gulikaJd, mandiJd, weekday } }
}
