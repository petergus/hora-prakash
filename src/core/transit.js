// src/core/transit.js
import { getSwe, PLANETS } from './swisseph.js'
import { getNakshatraInfo } from './calculations.js'
import { buildCalcFlags } from './settings.js'

/**
 * Calculate planetary positions for a given Julian Day.
 * Houses are assigned using whole-sign system from natal lagna sign.
 *
 * @param {number} transitJD       Julian Day (UT) for the transit date/time
 * @param {number} natalLagnaSign  Natal lagna sign (1–12) for house assignment
 * @param {object} [settings]      Calc settings from getSettings()
 * @returns {object[]}             Same 9-planet shape as natal planets array
 */
export function getTransitPositions(transitJD, natalLagnaSign, settings) {
  const swe   = getSwe()
  const flags = buildCalcFlags(settings)

  return PLANETS.map(p => {
    const result = swe.calc_ut(transitJD, p.id, flags)
    let pLon = result[0]
    if (p.isKetu) pLon = (pLon + 180) % 360
    const speed      = result[3]
    const planetSign = Math.floor(pLon / 30) + 1
    const house      = ((planetSign - natalLagnaSign + 12) % 12) + 1
    const nak        = getNakshatraInfo(pLon)
    return {
      id:             p.id,
      name:           p.name,
      abbr:           p.abbr,
      lon:            pLon,
      sign:           planetSign,
      degree:         pLon % 30,
      house,
      nakshatra:      nak.name,
      nakshatraLord:  nak.lord,
      nakshatraIndex: nak.index,
      pada:           nak.pada,
      retrograde:     speed < 0,
      speed,
    }
  })
}
