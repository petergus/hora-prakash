// src/core/dasha.js
import { buildCalcFlags } from './settings.js'

const DASHA_SEQUENCE = [
  { name: 'Ketu',    years: 7  },
  { name: 'Venus',   years: 20 },
  { name: 'Sun',     years: 6  },
  { name: 'Moon',    years: 10 },
  { name: 'Mars',    years: 7  },
  { name: 'Rahu',    years: 18 },
  { name: 'Jupiter', years: 16 },
  { name: 'Saturn',  years: 19 },
  { name: 'Mercury', years: 17 },
]
const TOTAL_YEARS = 120

const YEAR_MS = {
  sidereal: 365.256363004 * 86400000,
  tropical: 365.242190   * 86400000,
  savana:   360.0        * 86400000,
  julian:   365.25       * 86400000,
}

function yearMs(settings) {
  if (!settings || settings.yearMethod === 'sidereal')  return YEAR_MS.sidereal
  if (settings.yearMethod === 'julian')   return YEAR_MS.julian
  if (settings.yearMethod === 'tropical') return YEAR_MS.tropical
  if (settings.yearMethod === 'savana')   return YEAR_MS.savana
  if (settings.yearMethod === 'custom')   return (settings.customYearDays || 365.25) * 86400000
  return YEAR_MS.sidereal
}

function jdToMs(jd) {
  return (jd - 2440587.5) * 86400000
}

function msToJd(ms) {
  return ms / 86400000 + 2440587.5
}

// Standard Vimshottari durations keyed by planet name
export const DASHA_YEARS = Object.fromEntries(DASHA_SEQUENCE.map(d => [d.name, d.years]))

export const LEVEL_NAMES = ['Mahādasha', 'Antardasha', 'Pratyantara', 'Sūkṣma', 'Prāṇa', 'Deha']

// Index in DASHA_SEQUENCE for each nakshatra (0-26)
const NAKSHATRA_DASHA_INDEX = [
  0,1,2,3,4,5,6,7,8,
  0,1,2,3,4,5,6,7,8,
  0,1,2,3,4,5,6,7,8,
]

/**
 * Recursively compute sub-periods at a given depth.
 * depth=1 → children only (no recursion deeper)
 * depth=4 → 4 levels below the caller
 */
function calcSubPeriods(startIdx, startDate, parentYears, depth, parentMs) {
  if (depth <= 0) return []
  const totalMs = parentMs ?? parentYears * YEAR_MS.julian
  const result = []
  let cur = startDate.getTime()
  for (let i = 0; i < 9; i++) {
    const idx  = (startIdx + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const yrs  = parentYears * seq.years / TOTAL_YEARS
    const ms   = totalMs * seq.years / TOTAL_YEARS
    const end  = cur + ms
    result.push({
      planet:        seq.name,
      start:         new Date(cur),
      end:           new Date(end),
      seqIndex:      idx,
      durationYears: yrs,
      children:      calcSubPeriods(idx, new Date(cur), yrs, depth - 1, ms),
    })
    cur = end
  }
  return result
}

async function findSolarReturn(targetLon, seedJd, swe, flags) {
  let jd = seedJd
  for (let i = 0; i < 10; i++) {
    const lon = swe.calc_ut(jd, 0, flags)[0]
    let diff = targetLon - lon
    while (diff > 180)  diff -= 360
    while (diff < -180) diff += 360
    if (Math.abs(diff) < 1e-9) break
    jd += diff  // Sun ~1°/day, so degree diff ≈ day correction
    if (i === 9) console.warn('findSolarReturn: did not converge to 1e-9 at', targetLon, 'residual:', diff)
  }
  return jd
}

/**
 * Advance jdStart by exactly `years` true sidereal years.
 * One true sidereal year = Sun sweeps 360° of sidereal longitude from its current position.
 */
async function advanceTSSY(jdStart, years, swe, flags) {
  const startLon  = swe.calc_ut(jdStart, 0, flags)[0]
  const targetLon = ((startLon + years * 360) % 360 + 360) % 360
  const seedJd    = jdStart + years * 365.256363004
  return findSolarReturn(targetLon, seedJd, swe, flags)
}

/**
 * Compute sub-periods using True Sidereal Solar Year boundaries.
 * Each boundary is independently computed via ephemeris, not by linear interpolation.
 */
async function calcSubPeriodsTSSY(startIdx, startJd, parentYears, depth, swe, flags) {
  if (depth <= 0) return []
  const result = []
  let curJd = startJd
  for (let i = 0; i < 9; i++) {
    const idx     = (startIdx + i) % 9
    const seq     = DASHA_SEQUENCE[idx]
    const adYears = parentYears * seq.years / TOTAL_YEARS
    const endJd   = await advanceTSSY(curJd, adYears, swe, flags)
    result.push({
      planet:        seq.name,
      start:         new Date(jdToMs(curJd)),
      end:           new Date(jdToMs(endJd)),
      seqIndex:      idx,
      durationYears: adYears,
      tssy:          true,
      children:      depth > 1
        ? await calcSubPeriodsTSSY(idx, curJd, adYears, depth - 1, swe, flags)
        : [],
    })
    curJd = endJd
  }
  return result
}

async function calcDashaSolarReturn(jd, swe, flags, dashaStartIndex, balanceYears, fractionElapsed) {
  const sidSunLon = swe.calc_ut(jd, 0, flags)[0]

  const targetLon = ((sidSunLon + balanceYears * 360) % 360 + 360) % 360

  const elapsedYears = DASHA_SEQUENCE[dashaStartIndex].years * fractionElapsed
  const cycleStartJd = await findSolarReturn(targetLon, jd - elapsedYears * 365.256363004, swe, flags)

  const tree = []
  let cumulativeYears = 0

  for (let i = 0; i < 9; i++) {
    const idx     = (dashaStartIndex + i) % 9
    const seq     = DASHA_SEQUENCE[idx]
    const startJd = await findSolarReturn(targetLon, cycleStartJd + cumulativeYears * 365.256363004, swe, flags)
    cumulativeYears += seq.years
    const endJd   = await findSolarReturn(targetLon, cycleStartJd + cumulativeYears * 365.256363004, swe, flags)

    const start      = new Date(jdToMs(startJd))
    const end        = new Date(jdToMs(endJd))
    const displayYrs = i === 0 ? balanceYears : seq.years

    const children = await calcSubPeriodsTSSY(idx, startJd, seq.years, 1, swe, flags)

    tree.push({
      planet:        seq.name,
      start,
      end,
      seqIndex:      idx,
      durationYears: displayYrs,
      tssy:          true,
      children,
    })
  }

  return tree
}

/**
 * Compute Vimshottari dasha tree — MD + AD (2 levels) built eagerly.
 * Deeper levels populated lazily via `ensureChildren`.
 *
 * @param {object} moon      - planet object with lon and nakshatraIndex
 * @param {string} dobStr    - "YYYY-MM-DD"
 * @param {object} [options] - { settings, swe, jd }
 * @returns {Promise<DashaNode[]>}
 */
export async function calcDasha(moon, dobStr, options = {}) {
  if (!moon || typeof moon.lon !== 'number' || typeof moon.nakshatraIndex !== 'number') {
    throw new Error('calcDasha: valid Moon planet object with lon and nakshatraIndex required')
  }

  const { settings = null, swe = null, jd = null } = options

  const dashaStartIndex = NAKSHATRA_DASHA_INDEX[moon.nakshatraIndex]
  const nakshatraSpan   = 360 / 27
  const normalizedLon   = ((moon.lon % 360) + 360) % 360
  const fractionElapsed = (normalizedLon % nakshatraSpan) / nakshatraSpan
  const balanceYears    = DASHA_SEQUENCE[dashaStartIndex].years * (1 - fractionElapsed)

  // Use exact birth JD when available; fall back to midnight UTC of dob string
  const birthMs = jd != null
    ? jdToMs(jd)
    : new Date(dobStr + 'T00:00:00Z').getTime()

  if (settings?.yearMethod === 'true-solar') {
    if (swe && jd) {
      const flags = buildCalcFlags(settings)
      return calcDashaSolarReturn(jd, swe, flags, dashaStartIndex, balanceYears, fractionElapsed)
    }
    console.warn('calcDasha: true-solar requires swe and jd — falling back to sidereal')
  }

  const msPerYear = yearMs(settings)
  const tree = []
  let cur = birthMs

  for (let i = 0; i < 9; i++) {
    const idx  = (dashaStartIndex + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const yrs  = i === 0 ? balanceYears : seq.years
    const ms   = yrs * msPerYear
    const end  = cur + ms

    let children
    if (i === 0) {
      // Full dasha started before birth — compute sub-periods from actual dasha start, clip to birth
      const fullMs       = seq.years * msPerYear
      const dashaStartMs = birthMs - fractionElapsed * fullMs
      const all = calcSubPeriods(idx, new Date(dashaStartMs), seq.years, 1, fullMs)
      children = all
        .filter(c => c.end.getTime() > birthMs)
        .map((c, j) => j === 0 ? { ...c, start: new Date(birthMs) } : c)
    } else {
      children = calcSubPeriods(idx, new Date(cur), yrs, 1, ms)
    }

    tree.push({
      planet:        seq.name,
      start:         new Date(cur),
      end:           new Date(end),
      seqIndex:      idx,
      durationYears: yrs,
      children,
    })
    cur = end
  }

  return tree
}

/**
 * Lazily compute direct children of a node if not yet computed.
 * Idempotent — safe to call multiple times.
 *
 * NOTE: Must NOT be called on depth-5 (Deha/leaf) nodes — those legitimately
 * have no children and would be re-populated incorrectly. The UI guarantees this
 * by only expanding nodes at depth 0–4, but there is no runtime enforcement here.
 */
export async function ensureChildren(node, swe, flags) {
  if (node.children.length > 0) return
  if (node.tssy && swe && flags) {
    node.children = await calcSubPeriodsTSSY(
      node.seqIndex,
      msToJd(node.start.getTime()),
      node.durationYears,
      1,
      swe,
      flags,
    )
  } else {
    node.children = calcSubPeriods(node.seqIndex, node.start, node.durationYears, 1)
  }
}

export function isCurrentPeriod(start, end) {
  const now = Date.now()
  return start.getTime() <= now && end.getTime() > now
}

function addYears(date, years) {
  return new Date(date.getTime() + years * 365.25 * 86400000)
}

function addMonths(date, months) {
  const d = new Date(date)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

/**
 * Age broken into whole years, remaining months, remaining days (DATEDIF equivalent).
 */
export function calcAgeComponents(dobStr, asOf = new Date()) {
  const dob = new Date(dobStr + 'T00:00:00Z')
  const ref  = new Date(Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()))

  let years  = ref.getUTCFullYear() - dob.getUTCFullYear()
  let months = ref.getUTCMonth()    - dob.getUTCMonth()
  let days   = ref.getUTCDate()     - dob.getUTCDate()

  if (days < 0) {
    months--
    const prevMonth = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0))
    days += prevMonth.getUTCDate()
  }
  if (months < 0) { years--; months += 12 }

  return { years, months, days }
}

/**
 * House active from age (DOB-based house cycle).
 */
export function calcHouseActiveFromAge(dobStr, asOf = new Date()) {
  const { years } = calcAgeComponents(dobStr, asOf)
  return (years % 12) + 1
}

/**
 * Dasha Progression — 12 sub-periods within a Mahadasha.
 */
export function calcDashaProgression(mdLordHouse, mdStart, mdDurationYears) {
  const today = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const start = addMonths(mdStart, i * mdDurationYears)
    const end   = addMonths(mdStart, (i + 1) * mdDurationYears)
    return {
      houseFromMDL:     i + 1,
      progressionHouse: ((mdLordHouse - 1 + i) % 12) + 1,
      regressionHouse:  ((mdLordHouse - 1 - i + 120) % 12) + 1,
      start,
      end,
      isActive: start <= today && today < end,
    }
  })
}
