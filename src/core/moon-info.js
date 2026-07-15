// src/core/moon-info.js
// Moon phase & the Moon–Sun relationship, derived purely from chart longitudes.
//
// The Moon's phase is a function of its *elongation* from the Sun (Moon − Sun),
// so the ayanamsa cancels in the difference — sidereal or tropical longitudes
// give identical results. This module is Node-safe (no swe, no DOM) and is
// exercised directly by tests/moon-info.test.mjs.

const TITHI_NAMES = [
  'Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami',
  'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
]

// The Moon's Parashari combustion orb (degrees). Within this of the Sun the
// Moon is considered combust (astronomically, near the new-moon conjunction).
export const MOON_COMBUST_ORB = 12

const DEG = Math.PI / 180

/**
 * Tithi (lunar day) from the Moon–Sun elongation. 12° of elongation = 1 tithi;
 * 30 tithis span the synodic month. Tithis 1–15 are Shukla (waxing), 16–30 Krishna.
 */
function tithiInfo(elongation) {
  const num = Math.floor(elongation / 12) + 1        // 1..30
  const inPaksha = ((num - 1) % 15) + 1              // 1..15 within the fortnight
  let name
  if (num === 15)      name = 'Purnima'              // full moon
  else if (num === 30) name = 'Amavasya'             // new moon
  else                 name = TITHI_NAMES[inPaksha - 1]
  return { num, inPaksha, name, percentElapsed: ((elongation % 12) / 12) * 100 }
}

/**
 * Eight-phase name from elongation (0..360). Cardinal phases (New / Quarters /
 * Full) get a small ±5° window so they read as the exact phase near the junction.
 */
function phaseName(e) {
  if (e < 5 || e >= 355) return 'New Moon'
  if (e < 85)   return 'Waxing Crescent'
  if (e <= 95)  return 'First Quarter'
  if (e < 175)  return 'Waxing Gibbous'
  if (e <= 185) return 'Full Moon'
  if (e < 265)  return 'Waning Gibbous'
  if (e <= 275) return 'Last Quarter'
  return 'Waning Crescent'
}

/**
 * Derive the Moon's phase and its relationship to the Sun from a chart's
 * planet array (the objects produced by calcBirthChart — each carries `lon`
 * and `speed`).
 *
 * @param {object[]} planets
 * @returns {object|null} null if Sun/Moon are missing, otherwise:
 *   elongation   {number} Moon − Sun, 0..360° (drives paksha & tithi)
 *   separation   {number} shortest angular gap to the Sun, 0..180°
 *   illumination {number} lit fraction of the disc, 0..1
 *   waxing       {boolean} true while moving from new → full (elongation < 180)
 *   paksha       {{key,name,label}}
 *   tithi        {{num,inPaksha,name,percentElapsed}}
 *   phase        {string} eight-phase name
 *   combust      {boolean} within the Moon's 12° combustion orb
 *   relSpeed     {number|null} Moon−Sun angular speed, °/day (null if unavailable)
 *   daysToFull   {number|null} approx days to the next full moon
 *   daysToNew    {number|null} approx days to the next new moon
 *   moonLon, sunLon, moonSpeed, sunSpeed
 */
export function calcMoonInfo(planets) {
  if (!Array.isArray(planets)) return null
  const moon = planets.find(p => p.name === 'Moon')
  const sun  = planets.find(p => p.name === 'Sun')
  if (!moon || !sun || typeof moon.lon !== 'number' || typeof sun.lon !== 'number') return null

  // Elongation of the Moon ahead of the Sun (Moon − Sun), normalised to 0..360°.
  const elongation = ((moon.lon - sun.lon) % 360 + 360) % 360
  // Shortest angular separation, 0..180° — what combustion is measured against.
  const separation = elongation > 180 ? 360 - elongation : elongation
  // Illuminated fraction of the disc: k = (1 − cos E) / 2 (0 at new, 1 at full).
  const illumination = (1 - Math.cos(elongation * DEG)) / 2
  const waxing = elongation < 180

  const paksha = waxing
    ? { key: 'shukla',  name: 'Shukla Paksha',  label: 'Bright / waxing fortnight' }
    : { key: 'krishna', name: 'Krishna Paksha', label: 'Dark / waning fortnight' }

  const tithi   = tithiInfo(elongation)
  const phase   = phaseName(elongation)
  const combust = separation <= MOON_COMBUST_ORB

  // Relative angular speed (°/day). Instantaneous, so ETAs are approximate: the
  // Moon's true speed varies ~11–15°/day over the month. Guard against a missing
  // or nonsensical speed (retrograde relative motion never happens for the Moon).
  const moonSpeed = typeof moon.speed === 'number' ? moon.speed : null
  const sunSpeed  = typeof sun.speed  === 'number' ? sun.speed  : null
  const relSpeed  = moonSpeed != null && sunSpeed != null ? moonSpeed - sunSpeed : null

  let daysToFull = null, daysToNew = null
  if (relSpeed != null && relSpeed > 0.1) {
    const degToFull = ((180 - elongation) % 360 + 360) % 360   // forward to elongation 180
    const degToNew  = (360 - elongation) % 360                 // forward to elongation 0/360
    daysToFull = degToFull / relSpeed
    daysToNew  = (degToNew === 0 ? 360 : degToNew) / relSpeed
  }

  return {
    elongation, separation, illumination, waxing,
    paksha, tithi, phase, combust,
    relSpeed, daysToFull, daysToNew,
    moonLon: moon.lon, sunLon: sun.lon, moonSpeed, sunSpeed,
  }
}
