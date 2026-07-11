// src/core/lunar-birthday.js
// Purnimanta lunar birthday (janma tithi + masa) and the Gregorian dates it
// recurs on, using the traditional amanta month model with Adhika-masa support.
//
// Month naming (amanta): a lunar month runs new-moon → new-moon and is named by
// the sankranti (sidereal solar ingress) that falls within it —
//   amantaMonthIndex = (siderealSunRashi at the starting new moon + 1) mod 12
// (Chaitra ← Sun in Meena, Vaishakha ← Sun in Mesha, …).
//
// Adhika (Purushottam) masa: a synodic month with NO sankranti — the Sun is in
// the same rashi at both bounding new moons. It repeats the following month's
// name (so two consecutive months share a name; the first is Adhika, the second
// Nija) and recurs roughly every ~32.5 months.
//
// Purnimanta vs Amanta: both name the waxing (Shukla) fortnight identically; the
// waning (Krishna) fortnight belongs to the *following* month in Purnimanta, so
// Purnimanta month = amanta month + 1 during Krishna paksha. Adhika status is
// reckoned on the amanta synodic month.
import { getSwe } from './swisseph.js'
import { toJulianDay, jdToDate, dateToJd, getLocalDateParts } from '../utils/time.js'

// SEFLG_SWIEPH | SEFLG_SPEED — tropical Sun/Moon (ayanamsa cancels in the diff).
const TROPICAL_FLAG = 2 | 256
// SEFLG_SWIEPH | SEFLG_SIDEREAL | SEFLG_SPEED — sidereal Sun (Lahiri set at init).
const SIDEREAL_FLAG = 2 | 65536 | 256
const SYNODIC_RATE = 360 / 29.530588  // ≈ 12.19° elongation/day (mean)

const TITHI_NAMES = [
  'Pratipada','Dvitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami',
  'Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi',
]

export const MONTH_NAMES = [
  'Chaitra','Vaisakha','Jyeshtha','Ashadha','Shravana','Bhadrapada',
  'Ashwina','Kartika','Margashirsha','Pausha','Magha','Phalguna',
]

const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Pure helpers (no ephemeris — unit-testable) ──────────────────────────────

/** Tithi + paksha from tropical Sun/Moon longitudes. */
export function deriveTithi(sunLon, moonLon) {
  const diff = (((moonLon - sunLon) % 360) + 360) % 360
  const tithiIdx = Math.floor(diff / 12)      // 0..29
  const tithiNum = tithiIdx + 1               // 1..30
  const paksha = tithiNum <= 15 ? 'Shukla' : 'Krishna'
  const inPaksha = tithiNum <= 15 ? tithiNum : tithiNum - 15  // 1..15
  let tithiName
  if (tithiNum === 15) tithiName = 'Purnima'
  else if (tithiNum === 30) tithiName = 'Amavasya'
  else tithiName = TITHI_NAMES[inPaksha - 1]
  return { tithiIdx, tithiNum, paksha, tithiName, tithiInPaksha: inPaksha }
}

/**
 * Amanta month name + Adhika flag from the sidereal Sun rashi (0=Mesha..11=Meena)
 * at the month's starting and ending new moons.
 */
export function amantaNameAndAdhika(rashiAtStart, rashiAtEnd) {
  return {
    amantaIndex: (rashiAtStart + 1) % 12,
    isAdhika: rashiAtStart === rashiAtEnd,  // no sankranti during the month
  }
}

/** Purnimanta month index: amanta + 1 during the waning (Krishna) fortnight. */
export function purnimantaIndex(amantaIndex, paksha) {
  return paksha === 'Krishna' ? (amantaIndex + 1) % 12 : amantaIndex
}

// ── Ephemeris-backed helpers ─────────────────────────────────────────────────

function sunMoonLon(swe, jd) {
  return {
    sun:  swe.calc_ut(jd, 0, TROPICAL_FLAG)[0],
    moon: swe.calc_ut(jd, 1, TROPICAL_FLAG)[0],
  }
}

function sidSunRashi(swe, jd) {
  const l = swe.calc_ut(jd, 0, SIDEREAL_FLAG)[0]
  return Math.floor((((l % 360) + 360) % 360) / 30)  // 0..11
}

// Refine to the new moon (Sun–Moon conjunction) nearest jdGuess.
function newMoonNear(swe, jdGuess) {
  let jd = jdGuess
  for (let i = 0; i < 6; i++) {
    const s = swe.calc_ut(jd, 0, TROPICAL_FLAG)
    const m = swe.calc_ut(jd, 1, TROPICAL_FLAG)
    let es = (((m[0] - s[0]) % 360) + 360) % 360
    if (es > 180) es -= 360              // signed elongation, 0 at conjunction
    const rate = (m[3] - s[3]) || SYNODIC_RATE
    jd -= es / rate
  }
  return jd
}

// New moon that starts the amanta month containing jd (i.e. the last new moon ≤ jd).
function lastNewMoon(swe, jd) {
  const { sun, moon } = sunMoonLon(swe, jd)
  const elong = (((moon - sun) % 360) + 360) % 360   // 0..360 since last new moon
  let nm = newMoonNear(swe, jd - elong / SYNODIC_RATE)
  let g = 0
  while (nm > jd + 0.6 && g++ < 4) nm = newMoonNear(swe, nm - 29.53)
  while (jd - nm > 29.9 && g++ < 8) nm = newMoonNear(swe, nm + 29.53)
  return nm
}

// Instant within [nm0, nm0+~29.53] where tithi `tithiIdx` begins (elongation = tithiIdx·12°).
function tithiStartJd(swe, nm0, tithiIdx) {
  const target = tithiIdx * 12
  let jd = nm0 + target / SYNODIC_RATE
  for (let i = 0; i < 7; i++) {
    const s = swe.calc_ut(jd, 0, TROPICAL_FLAG)
    const m = swe.calc_ut(jd, 1, TROPICAL_FLAG)
    let e = (((m[0] - s[0]) % 360) + 360) % 360
    let d = e - target
    if (d > 180) d -= 360
    if (d < -180) d += 360
    const rate = (m[3] - s[3]) || SYNODIC_RATE
    jd -= d / rate
  }
  return jd
}

// Hindu sunrise (disc-centre, no refraction) for the civil day starting at
// dayStartJd (UT of local midnight). Mirrors panchang.js — the swisseph-wasm
// v0.0.5 rise_trans() wrapper is broken, so call swe_rise_trans directly.
function sunriseJd(swe, dayStartJd, lat, lon) {
  try {
    const M = swe.SweModule
    if (!M) return null
    const geoPtr  = M._malloc(3 * 8)
    const tretPtr = M._malloc(8)
    const serrPtr = M._malloc(256)
    M.HEAPF64[geoPtr >> 3]       = lon
    M.HEAPF64[(geoPtr >> 3) + 1] = lat
    M.HEAPF64[(geoPtr >> 3) + 2] = 0
    const rsmi = 1 | 256 | 512
    const flag = M.ccall('swe_rise_trans', 'number',
      ['number','number','number','number','number','number','number','number','number','number'],
      [dayStartJd, 0, 0, 2, rsmi, geoPtr, 1013.25, 15, tretPtr, serrPtr])
    const tret = M.HEAPF64[tretPtr >> 3]
    M._free(geoPtr); M._free(tretPtr); M._free(serrPtr)
    return flag >= 0 && tret > 1000000 ? tret : null
  } catch { return null }
}

function pad(n) { return String(n).padStart(2, '0') }
function civilToDayStart(civil, tz) {
  return toJulianDay(`${civil.y}-${pad(civil.m)}-${pad(civil.d)}`, '00:00', tz)
}
function addCivilDays(civil, off) {
  const d = new Date(Date.UTC(civil.y, civil.m - 1, civil.d) + off * 86400000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

// The civil day whose sunrise first falls at/after `instantJd` — i.e. the day
// that carries the tithi beginning at instantJd at its sunrise.
function sunriseCivilDay(swe, instantJd, tz, lat, lon) {
  const p = getLocalDateParts(jdToDate(instantJd), tz)
  let civil = { y: p.year, m: p.month, d: p.day }
  let sr = sunriseJd(swe, civilToDayStart(civil, tz), lat, lon) ?? (civilToDayStart(civil, tz) + 0.25)
  if (sr < instantJd) {
    civil = addCivilDays(civil, 1)
    sr = sunriseJd(swe, civilToDayStart(civil, tz), lat, lon) ?? (civilToDayStart(civil, tz) + 0.25)
  }
  return civil
}

/** Amanta month (name index + Adhika flag) containing Julian Day `jd`. */
export function amantaMonth(swe, jd) {
  const nm0 = lastNewMoon(swe, jd)
  const nm1 = newMoonNear(swe, nm0 + 29.53)
  const { amantaIndex, isAdhika } = amantaNameAndAdhika(sidSunRashi(swe, nm0), sidSunRashi(swe, nm1))
  return { amantaIndex, isAdhika, nm0, nm1 }
}

/** Full lunar date (tithi + Purnimanta masa + Adhika) at Julian Day `jd`. */
function lunarDateAt(swe, jd) {
  const { sun, moon } = sunMoonLon(swe, jd)
  const tithi = deriveTithi(sun, moon)
  const am = amantaMonth(swe, jd)
  const monthIndex = purnimantaIndex(am.amantaIndex, tithi.paksha)
  return {
    ...tithi,
    isAdhika: am.isAdhika,
    monthIndexAmanta: am.amantaIndex,
    monthNameAmanta: MONTH_NAMES[am.amantaIndex],
    monthIndex,
    monthName: MONTH_NAMES[monthIndex],
    label: `${MONTH_NAMES[monthIndex]}${am.isAdhika ? ' (Adhika)' : ''} ${tithi.paksha} ${tithi.tithiName}`,
  }
}

function makeEntry(civil, isAdhika, birthYear) {
  const wd = new Date(Date.UTC(civil.y, civil.m - 1, civil.d)).getUTCDay()
  return {
    year: civil.y, month: civil.m, day: civil.d,
    weekday: wd, weekdayName: WEEKDAYS[wd],
    date: new Date(Date.UTC(civil.y, civil.m - 1, civil.d)),
    iso: `${civil.y}-${pad(civil.m)}-${pad(civil.d)}`,
    label: `${WEEKDAYS[wd].slice(0, 3)}, ${civil.d} ${MONTH_ABBR[civil.m - 1]} ${civil.y}`,
    isAdhika,
    turns: civil.y - birthYear,
  }
}

/**
 * Compute a person's Purnimanta lunar birthday and its upcoming Gregorian dates.
 * Walks synodic months forward, emitting the janma tithi's date in every month
 * that carries the birth month's name — so in an Adhika year both the Adhika and
 * Nija occurrences appear (each flagged), letting the user choose.
 * @param {{dob,tob,timezone,lat,lon}} birth
 * @param {{ years?: number, today?: Date, swe?: object }} [opts]  swe is a test seam
 */
export function computeLunarBirthday(birth, opts = {}) {
  if (!birth?.dob || !birth?.tob || birth.lat == null || birth.lon == null) return null
  const swe = opts.swe || getSwe()
  const { dob, tob, timezone = '+00:00', lat, lon } = birth
  const years = opts.years ?? 10
  const today = opts.today ?? new Date()

  const birthJd = toJulianDay(dob, tob, timezone)
  const lunar = lunarDateAt(swe, birthJd)
  const birthYear = Number(dob.slice(0, 4))
  const todayMid = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const lastYear = today.getFullYear() + years

  const upcoming = []
  let nm = lastNewMoon(swe, Math.max(birthJd, dateToJd(today) - 45))
  let guard = 0
  while (guard++ < 420) {
    const nm1 = newMoonNear(swe, nm + 29.53)
    const r0 = sidSunRashi(swe, nm)
    const r1 = sidSunRashi(swe, nm1)
    const { amantaIndex, isAdhika } = amantaNameAndAdhika(r0, r1)
    if (amantaIndex === lunar.monthIndexAmanta) {
      const tStart = tithiStartJd(swe, nm, lunar.tithiIdx)
      if (tStart >= nm - 0.3 && tStart <= nm1 + 0.3) {
        const civil = sunriseCivilDay(swe, tStart, timezone, lat, lon)
        const t = Date.UTC(civil.y, civil.m - 1, civil.d)
        if (t >= todayMid) upcoming.push(makeEntry(civil, isAdhika, birthYear))
      }
    }
    const nmYear = getLocalDateParts(jdToDate(nm1), timezone).year
    nm = nm1
    if (nmYear > lastYear) break
  }

  return { lunar, upcoming }
}
