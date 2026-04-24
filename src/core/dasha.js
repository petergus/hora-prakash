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

// Standard Vimshottari durations keyed by planet name
export const DASHA_YEARS = Object.fromEntries(DASHA_SEQUENCE.map(d => [d.name, d.years]))

export const LEVEL_NAMES = ['Mahādasha', 'Antardasha', 'Pratyantara', 'Sūkṣma', 'Prāṇa']

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
function calcSubPeriods(startIdx, startDate, parentYears, depth) {
  if (depth <= 0) return []
  const result = []
  let cur = startDate.getTime()
  for (let i = 0; i < 9; i++) {
    const idx  = (startIdx + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const yrs  = parentYears * seq.years / TOTAL_YEARS
    const ms   = yrs * 365.25 * 86400000
    const end  = cur + ms
    result.push({
      planet:        seq.name,
      start:         new Date(cur),
      end:           new Date(end),
      seqIndex:      idx,
      durationYears: yrs,
      children:      calcSubPeriods(idx, new Date(cur), yrs, depth - 1),
    })
    cur = end
  }
  return result
}

/**
 * Compute 5-level Vimshottari dasha tree.
 * Each node: { planet, start, end, children[] }
 * Levels: Mahādasha → Antardasha → Pratyantara → Sūkṣma → Prāṇa
 *
 * @param {object} moon   - planet object (must have lon, nakshatraIndex)
 * @param {string} dobStr - "YYYY-MM-DD"
 * @returns {DashaNode[]}  Array of 9 Mahādasha nodes
 */
export function calcDasha(moon, dobStr) {
  if (!moon || typeof moon.lon !== 'number' || typeof moon.nakshatraIndex !== 'number') {
    throw new Error('calcDasha: valid Moon planet object with lon and nakshatraIndex required')
  }

  const dashaStartIndex = NAKSHATRA_DASHA_INDEX[moon.nakshatraIndex]
  const nakshatraSpan   = 360 / 27
  const normalizedLon   = ((moon.lon % 360) + 360) % 360
  const fractionElapsed = (normalizedLon % nakshatraSpan) / nakshatraSpan
  const balanceYears    = DASHA_SEQUENCE[dashaStartIndex].years * (1 - fractionElapsed)

  const birthDate = new Date(dobStr + 'T00:00:00Z')
  const tree = []
  let cur = birthDate.getTime()

  for (let i = 0; i < 9; i++) {
    const idx  = (dashaStartIndex + i) % 9
    const seq  = DASHA_SEQUENCE[idx]
    const yrs  = i === 0 ? balanceYears : seq.years
    const ms   = yrs * 365.25 * 86400000
    const end  = cur + ms
    tree.push({
      planet:        seq.name,
      start:         new Date(cur),
      end:           new Date(end),
      seqIndex:      idx,
      durationYears: i === 0 ? balanceYears : seq.years,
      children:      calcSubPeriods(idx, new Date(cur), i === 0 ? balanceYears : seq.years, 1),
    })
    cur = end
  }

  return tree
}

/**
 * Lazily compute direct children of a node if not yet computed.
 * Idempotent — safe to call multiple times.
 */
export function ensureChildren(node) {
  if (node.children.length === 0) {
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
