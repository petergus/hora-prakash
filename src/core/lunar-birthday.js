// src/core/lunar-birthday.js
// Purnimanta lunar birthday: the janma tithi + masa, and the Gregorian dates on
// which that lunar birthday recurs over the coming years.
//
// Purnimanta vs Amanta: both name the waxing (Shukla) fortnight identically, but
// the waning (Krishna) fortnight belongs to the *following* month in Purnimanta.
// So during Krishna paksha the Purnimanta month = Amanta month + 1. (e.g. Krishna
// Janmashtami is Shravana in Amanta but Bhadrapada in Purnimanta.)
import { getSwe } from './swisseph.js'
import { toJulianDay, jdToDate, getLocalDateParts } from '../utils/time.js'

// SEFLG_SWIEPH | SEFLG_SPEED — tropical Sun/Moon (ayanamsa cancels in the diff).
const TROPICAL_FLAG = 2 | 256

const TITHI_NAMES = [
  'Pratipada','Dvitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami',
  'Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi',
]

const LUNAR_MONTH_NAMES = [
  'Chaitra','Vaisakha','Jyeshtha','Ashadha','Shravana','Bhadrapada',
  'Ashwina','Kartika','Margashirsha','Pausha','Magha','Phalguna',
]

const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Derive the lunar date (tithi + Purnimanta masa) from tropical Sun/Moon longitudes.
 * Pure — no ephemeris — so it is unit-testable.
 * @param {number} sunLon  Tropical Sun longitude (deg)
 * @param {number} moonLon Tropical Moon longitude (deg)
 */
export function deriveLunarDate(sunLon, moonLon) {
  const diff = (((moonLon - sunLon) % 360) + 360) % 360
  const tithiIdx = Math.floor(diff / 12)      // 0..29
  const tithiNum = tithiIdx + 1               // 1..30
  const paksha = tithiNum <= 15 ? 'Shukla' : 'Krishna'
  const inPaksha = tithiNum <= 15 ? tithiNum : tithiNum - 15  // 1..15

  let tithiName
  if (tithiNum === 15) tithiName = 'Purnima'
  else if (tithiNum === 30) tithiName = 'Amavasya'
  else tithiName = TITHI_NAMES[inPaksha - 1]

  const amantaIdx = Math.floor((((sunLon % 360) + 360) % 360) / 30) % 12
  const monthIdx = paksha === 'Krishna' ? (amantaIdx + 1) % 12 : amantaIdx

  return {
    tithiIdx,
    tithiNum,
    paksha,
    tithiName,
    tithiInPaksha: inPaksha,
    monthIndex: monthIdx,                       // Purnimanta
    monthName: LUNAR_MONTH_NAMES[monthIdx],     // Purnimanta
    monthIndexAmanta: amantaIdx,
    monthNameAmanta: LUNAR_MONTH_NAMES[amantaIdx],
    // Full label, e.g. "Bhadrapada Krishna Ashtami"
    label: `${LUNAR_MONTH_NAMES[monthIdx]} ${paksha} ${tithiName}`,
  }
}

function sunMoonLon(swe, jd) {
  return {
    sun:  swe.calc_ut(jd, 0, TROPICAL_FLAG)[0],
    moon: swe.calc_ut(jd, 1, TROPICAL_FLAG)[0],
  }
}

function lunarDateAt(swe, jd) {
  const { sun, moon } = sunMoonLon(swe, jd)
  return deriveLunarDate(sun, moon)
}

function tithiIndexAt(swe, jd) {
  const { sun, moon } = sunMoonLon(swe, jd)
  const diff = (((moon - sun) % 360) + 360) % 360
  return Math.floor(diff / 12)
}

// Hindu sunrise (disc-centre, no refraction) for the civil day starting at
// `dayStartJd` (UT of local midnight). Mirrors the direct swe_rise_trans call in
// panchang.js — the swisseph-wasm v0.0.5 rise_trans() wrapper is broken.
function sunriseJd(swe, dayStartJd, lat, lon) {
  try {
    const M = swe.SweModule
    const geoPtr  = M._malloc(3 * 8)
    const tretPtr = M._malloc(8)
    const serrPtr = M._malloc(256)
    M.HEAPF64[geoPtr >> 3]       = lon
    M.HEAPF64[(geoPtr >> 3) + 1] = lat
    M.HEAPF64[(geoPtr >> 3) + 2] = 0
    const rsmi = 1 | 256 | 512  // SE_CALC_RISE | SE_BIT_DISC_CENTER | SE_BIT_NO_REFRACTION
    const flag = M.ccall('swe_rise_trans', 'number',
      ['number','number','number','number','number','number','number','number','number','number'],
      [dayStartJd, 0, 0, 2, rsmi, geoPtr, 1013.25, 15, tretPtr, serrPtr])
    const tret = M.HEAPF64[tretPtr >> 3]
    M._free(geoPtr); M._free(tretPtr); M._free(serrPtr)
    return flag >= 0 && tret > 1000000 ? tret : null
  } catch { return null }
}

// JD where the tropical Sun returns to `targetSun`, near Gregorian year Y.
function solarReturnJd(swe, targetSun, birthJd, birthYear, Y) {
  let jd = birthJd + (Y - birthYear) * 365.2425
  for (let i = 0; i < 5; i++) {
    const sun = swe.calc_ut(jd, 0, TROPICAL_FLAG)[0]
    const d = (((targetSun - sun + 540) % 360) - 180)  // signed shortest arc
    jd += d / 0.98565                                  // Sun ≈ 0.98565°/day
  }
  return jd
}

function pad(n) { return String(n).padStart(2, '0') }
function civilToDayStart(civil, timezone) {
  return toJulianDay(`${civil.y}-${pad(civil.m)}-${pad(civil.d)}`, '00:00', timezone)
}
function addCivilDays(civil, off) {
  const d = new Date(Date.UTC(civil.y, civil.m - 1, civil.d) + off * 86400000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

/**
 * Find the civil day in Gregorian year Y that carries the birth tithi in the
 * matching lunar month. Anchored on the solar return so the correct masa (and
 * adhika-masa disambiguation) falls out automatically; the day is then the one
 * whose sunrise tithi equals the janma tithi.
 */
function findBirthdayInYear(swe, { birthJd, birthSun, birthTithiIdx, birthYear, Y, timezone, lat, lon }) {
  const anchorJd = solarReturnJd(swe, birthSun, birthJd, birthYear, Y)
  const anchorParts = getLocalDateParts(jdToDate(anchorJd), timezone)
  const anchorCivil = { y: anchorParts.year, m: anchorParts.month, d: anchorParts.day }

  // Coarse pass at local noon (cheap) → nearest day carrying the birth tithi.
  let coarse = null
  for (let off = -18; off <= 18; off++) {
    const civil = addCivilDays(anchorCivil, off)
    const noonJd = civilToDayStart(civil, timezone) + 0.5
    if (tithiIndexAt(swe, noonJd) === birthTithiIdx) {
      const dist = Math.abs(noonJd - anchorJd)
      if (!coarse || dist < coarse.dist) coarse = { civil, dist }
    }
  }
  if (!coarse) return null

  // Fine pass: the celebrated day is the one whose *sunrise* tithi matches. Check
  // the coarse day and its neighbours; fall back to the coarse day if the
  // sunrise rule finds no exact match (e.g. missing sunrise at high latitude).
  let best = null
  for (const off of [0, -1, 1]) {
    const civil = addCivilDays(coarse.civil, off)
    const dayStart = civilToDayStart(civil, timezone)
    const sr = sunriseJd(swe, dayStart, lat, lon)
    const sampleJd = sr ?? (dayStart + 0.25)  // ~06:00 local fallback
    if (tithiIndexAt(swe, sampleJd) === birthTithiIdx) {
      if (!best || Math.abs(off) < Math.abs(best.off)) best = { civil, off }
    }
  }
  const chosen = best ? best.civil : coarse.civil
  const wd = new Date(Date.UTC(chosen.y, chosen.m - 1, chosen.d)).getUTCDay()
  return {
    year: chosen.y,
    month: chosen.m,
    day: chosen.d,
    weekday: wd,
    weekdayName: WEEKDAYS[wd],
    date: new Date(Date.UTC(chosen.y, chosen.m - 1, chosen.d)),
    label: `${WEEKDAYS[wd].slice(0, 3)}, ${chosen.d} ${MONTH_ABBR[chosen.m - 1]} ${chosen.y}`,
    iso: `${chosen.y}-${pad(chosen.m)}-${pad(chosen.d)}`,
  }
}

/**
 * Compute a person's Purnimanta lunar birthday and its upcoming Gregorian dates.
 * @param {{dob:string,tob:string,timezone:string,lat:number,lon:number}} birth
 * @param {{ years?: number, today?: Date }} [opts]
 * @returns {{ lunar: object, upcoming: object[] } | null}
 */
export function computeLunarBirthday(birth, opts = {}) {
  if (!birth?.dob || !birth?.tob || birth.lat == null || birth.lon == null) return null
  const swe = opts.swe || getSwe()  // opts.swe is a test seam
  const { dob, tob, timezone = '+00:00', lat, lon } = birth
  const years = opts.years ?? 10
  const today = opts.today ?? new Date()

  const birthJd = toJulianDay(dob, tob, timezone)
  const lunar = lunarDateAt(swe, birthJd)
  const birthSun = swe.calc_ut(birthJd, 0, TROPICAL_FLAG)[0]
  const birthYear = Number(dob.slice(0, 4))

  const todayMid = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const startYear = today.getFullYear()

  const upcoming = []
  for (let Y = startYear; Y <= startYear + years && upcoming.length < years; Y++) {
    const found = findBirthdayInYear(swe, {
      birthJd, birthSun, birthTithiIdx: lunar.tithiIdx, birthYear, Y, timezone, lat, lon,
    })
    if (found && found.date.getTime() >= todayMid) upcoming.push(found)
  }

  return { lunar, upcoming }
}
