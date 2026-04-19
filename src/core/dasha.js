// src/core/dasha.js

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

// Index in DASHA_SEQUENCE for each nakshatra (0-26)
const NAKSHATRA_DASHA_INDEX = [
  0,1,2,3,4,5,6,7,8,
  0,1,2,3,4,5,6,7,8,
  0,1,2,3,4,5,6,7,8,
]

/**
 * Compute 3-level Vimshottari dasha tree.
 * @param {object} moon  - planet object for Moon (must have lon, nakshatraIndex)
 * @param {string} dobStr - "YYYY-MM-DD"
 * @returns {DashaNode[]}
 */
export function calcDasha(moon, dobStr) {
  if (!moon || typeof moon.lon !== 'number' || typeof moon.nakshatraIndex !== 'number') {
    throw new Error('calcDasha: valid Moon planet object with lon and nakshatraIndex required')
  }
  const nakshatraIdx = moon.nakshatraIndex
  const dashaStartIndex = NAKSHATRA_DASHA_INDEX[nakshatraIdx]

  const nakshatraSpan = 360 / 27
  const normalizedLon = ((moon.lon % 360) + 360) % 360
  const posInNakshatra = normalizedLon % nakshatraSpan
  const fractionElapsed = posInNakshatra / nakshatraSpan
  const fractionRemaining = 1 - fractionElapsed
  const balanceYears = DASHA_SEQUENCE[dashaStartIndex].years * fractionRemaining

  const birthDate = new Date(dobStr + 'T00:00:00Z')
  const tree = []
  let currentDate = new Date(birthDate)

  for (let i = 0; i < 9; i++) {
    const idx = (dashaStartIndex + i) % 9
    const maha = DASHA_SEQUENCE[idx]
    const mahaDurationYears = i === 0 ? balanceYears : maha.years
    const mahaEnd = addYears(currentDate, mahaDurationYears)

    const antars = []
    let antarStart = new Date(currentDate)

    for (let j = 0; j < 9; j++) {
      const aIdx = (idx + j) % 9
      const antar = DASHA_SEQUENCE[aIdx]
      const antarYears = (mahaDurationYears * antar.years) / TOTAL_YEARS
      const antarEnd = addYears(antarStart, antarYears)

      const pratyantars = []
      let pratStart = new Date(antarStart)
      for (let k = 0; k < 9; k++) {
        const pIdx = (aIdx + k) % 9
        const prat = DASHA_SEQUENCE[pIdx]
        const pratYears = (antarYears * prat.years) / TOTAL_YEARS
        const pratEnd = addYears(pratStart, pratYears)
        pratyantars.push({ planet: prat.name, start: new Date(pratStart), end: pratEnd })
        pratStart = pratEnd
      }

      antars.push({ planet: antar.name, start: new Date(antarStart), end: antarEnd, pratyantars })
      antarStart = antarEnd
    }

    tree.push({ planet: maha.name, start: new Date(currentDate), end: mahaEnd, antars })
    currentDate = mahaEnd
  }

  return tree
}

function addYears(date, years) {
  const ms = years * 365.25 * 24 * 60 * 60 * 1000
  return new Date(date.getTime() + ms)
}

function addMonths(date, months) {
  const d = new Date(date)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

export function isCurrentPeriod(start, end) {
  const now = Date.now()
  return start.getTime() <= now && end.getTime() > now
}

// Standard Vimshottari durations keyed by planet name
export const DASHA_YEARS = Object.fromEntries(DASHA_SEQUENCE.map(d => [d.name, d.years]))

/**
 * House active from age (DOB-based house cycle).
 * Every 12 years the cycle repeats from House 1.
 * Formula: ageWholeYears % 12  (0 maps to 12)
 *
 * Source: Dasha Progression-V3-personal.xlsx, cell L6
 *   =IF(MOD(ageYears, 12) = 0, 12, MOD(ageYears, 12))
 */
export function calcHouseActiveFromAge(dobStr) {
  const dob = new Date(dobStr + 'T00:00:00Z')
  const today = new Date()
  let years = today.getUTCFullYear() - dob.getUTCFullYear()
  const dm = today.getUTCMonth() - dob.getUTCMonth()
  if (dm < 0 || (dm === 0 && today.getUTCDate() < dob.getUTCDate())) years--
  return years % 12 === 0 ? 12 : years % 12
}

/**
 * Dasha Progression — 12 sub-periods within a Mahadasha.
 *
 * The Mahadasha is divided equally into 12 house-periods.
 * Each house gets `mdDurationYears` calendar months (same number, different unit).
 * Total = 12 × mdDurationYears months = mdDurationYears years — equals the full Mahadasha.
 *
 * Progression house moves forward from the MD lord's natal house:
 *   period i → house ((mdLordHouse − 1 + i) % 12) + 1
 *
 * Regression house moves backward from the MD lord's natal house:
 *   period i → house ((mdLordHouse − 1 − i + 120) % 12) + 1
 *
 * Source: Dasha Progression-V3-personal.xlsx, columns D–I rows 7–18
 *   E7: =MOD(SEQUENCE(12,1,G3)−1, 12)+1   (progression, forward)
 *   D7: =MOD(G3−SEQUENCE(12,1,0)−1, 12)+1 (regression, backward)
 *   G7: =EDATE(dashaStart, mdYears * SEQUENCE(12,1))
 *
 * @param {number} mdLordHouse  Natal house (1–12) of the Mahadasha lord
 * @param {Date}   mdStart      Start date of the Mahadasha
 * @param {number} mdDurationYears  Standard Vimshottari duration (e.g. 20 for Venus)
 * @returns {Array<{houseFromMDL, progressionHouse, regressionHouse, start, end, isActive}>}
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
