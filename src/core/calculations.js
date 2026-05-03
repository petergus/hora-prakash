// src/core/calculations.js
import { getSwe, PLANETS } from './swisseph.js'
import { buildCalcFlags } from './settings.js'

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

// Parashari combustion orbs in degrees (planets not listed are immune: Sun, Rahu, Ketu)
const COMBUST_ORBS = {
  Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15,
}

function angularDist(a, b) {
  const d = Math.abs(((a - b + 540) % 360) - 180)
  return d
}

/**
 * Calculate all planet positions, lagna, and house cusps.
 * @param {number} jd        Julian Day (UT)
 * @param {number} lat       Latitude
 * @param {number} lon       Longitude
 * @param {object} [settings] Calculation settings from getSettings()
 * @returns {{ planets: object[], lagna: object, houses: number[] }}
 */
export function calcBirthChart(jd, lat, lon, settings) {
  const swe   = getSwe()
  const flags = buildCalcFlags(settings)

  if (settings?.observerType === 'topocentric') {
    swe.set_topo(lon, lat, 0)  // SwissEph: set_topo(geolon, geolat, altitude_m)
  }

  // Use houses_ex with SEFLG_SIDEREAL (65536) to get sidereal ascendant
  const housesResult = swe.houses_ex(jd, 65536, lat, lon, 'P')
  const lagnaLon = ((housesResult.ascmc[0] % 360) + 360) % 360
  const lagnaSign = Math.floor(lagnaLon / 30) + 1
  const houseCusps = Array.from(housesResult.cusps).slice(1, 13)

  const rawPlanets = PLANETS.map(p => {
    const result = swe.calc_ut(jd, p.id, flags)
    let pLon = result[0]
    if (p.isKetu) pLon = (pLon + 180) % 360
    const speed = result[3]
    const planetSign = Math.floor(pLon / 30) + 1
    const house = ((planetSign - lagnaSign + 12) % 12) + 1
    const nak = getNakshatraInfo(pLon)
    return {
      id: p.id,
      name: p.name,
      abbr: p.abbr,
      lon: pLon,
      sign: planetSign,
      degree: pLon % 30,
      house,
      nakshatra: nak.name,
      nakshatraLord: nak.lord,
      nakshatraIndex: nak.index,
      pada: nak.pada,
      retrograde: speed < 0,
      speed,
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
