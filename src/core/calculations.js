// src/core/calculations.js
import { getSwe, PLANETS } from './swisseph.js'

const SIDEREAL_SPEED_FLAG = 65536 + 256  // SEFLG_SIDEREAL | SEFLG_SPEED

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta',
  'Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'
]

const NAKSHATRA_LORDS = [
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury',
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury',
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury',
]

export function getNakshatraInfo(lon) {
  const normLon = ((lon % 360) + 360) % 360
  const nakshatraIndex = Math.floor(normLon / (360 / 27))
  const pada = Math.floor((normLon % (360 / 27)) / (360 / 108)) + 1
  return {
    index: nakshatraIndex,
    name: NAKSHATRAS[nakshatraIndex],
    lord: NAKSHATRA_LORDS[nakshatraIndex],
    pada,
  }
}

/**
 * Calculate all planet positions, lagna, and house cusps.
 * @param {number} jd  Julian Day (UT)
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @returns {{ planets: object[], lagna: object, houses: number[] }}
 */
// Parashari combustion orbs in degrees (planets not listed are immune: Sun, Rahu, Ketu)
const COMBUST_ORBS = {
  Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15,
}

function angularDist(a, b) {
  const d = Math.abs(((a - b + 540) % 360) - 180)
  return d
}

export function calcBirthChart(jd, lat, lon) {
  const swe = getSwe()

  // Use houses_ex with SEFLG_SIDEREAL (65536) to get sidereal cusps
  const housesResult = swe.houses_ex(jd, 65536, lat, lon, 'P')
  // cusps is 1-indexed: cusps[1]..cusps[12]
  const lagnaLon = housesResult.ascmc[0]
  const houseCusps = Array.from(housesResult.cusps).slice(1, 13)  // [cusp1..cusp12]

  const rawPlanets = PLANETS.map(p => {
    const result = swe.calc_ut(jd, p.id, SIDEREAL_SPEED_FLAG)
    let pLon = result[0]
    if (p.isKetu) pLon = (pLon + 180) % 360  // Ketu = Rahu + 180°
    const speed = result[3]
    const house = getLongitudeHouse(pLon, houseCusps)
    const nak = getNakshatraInfo(pLon)
    return {
      id: p.id,
      name: p.name,
      abbr: p.abbr,
      lon: pLon,
      sign: Math.floor(pLon / 30) + 1,
      degree: pLon % 30,
      house,
      nakshatra: nak.name,
      nakshatraLord: nak.lord,
      nakshatraIndex: nak.index,
      pada: nak.pada,
      retrograde: speed < 0,
    }
  })

  const sunLon = rawPlanets.find(p => p.name === 'Sun')?.lon ?? 0
  const planets = rawPlanets.map(p => {
    const orb = COMBUST_ORBS[p.name]
    const combust = orb !== undefined && angularDist(p.lon, sunLon) <= orb
    return { ...p, combust }
  })

  const lagnaLonNorm = ((lagnaLon % 360) + 360) % 360
  const lagnaInfo = getNakshatraInfo(lagnaLonNorm)
  const lagna = {
    lon: lagnaLonNorm,
    sign: Math.floor(lagnaLonNorm / 30) + 1,
    degree: lagnaLonNorm % 30,
    house: 1,
    nakshatra: lagnaInfo.name,
    nakshatraLord: lagnaInfo.lord,
    pada: lagnaInfo.pada,
  }

  return { planets, lagna, houses: houseCusps }
}

function getLongitudeHouse(lon, cusps) {
  // cusps: array of 12 cusp longitudes (index 0 = house 1 cusp)
  for (let i = 0; i < 12; i++) {
    const start = cusps[i]
    const end = cusps[(i + 1) % 12]
    if (end > start) {
      if (lon >= start && lon < end) return i + 1
    } else {
      if (lon >= start || lon < end) return i + 1
    }
  }
  return 1
}
