// src/core/shadbala.js
import { calcDivisional } from './divisional.js'
import { jdToDate } from '../utils/time.js'

const SHADBALA_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

// Ecliptic longitude of exact exaltation point
const EXALT_LON = { Sun: 10, Moon: 33, Mars: 298, Mercury: 165, Jupiter: 95, Venus: 357, Saturn: 200 }

// Own signs (1-indexed sign numbers)
const OWN_SIGNS = {
  Sun: [5], Moon: [4], Mars: [1, 8], Mercury: [3, 6],
  Jupiter: [9, 12], Venus: [2, 7], Saturn: [10, 11],
}

// Moolatrikona sign (takes precedence over own-sign check)
const MOOLA_SIGN = { Sun: 5, Moon: 2, Mars: 1, Mercury: 6, Jupiter: 9, Venus: 7, Saturn: 11 }

// Sign ruler (1-indexed sign → planet name)
const SIGN_RULER = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
]

// Permanent friendship
const PERM_FRIENDS = {
  Sun: ['Moon', 'Mars', 'Jupiter'],
  Moon: ['Sun', 'Mercury'],
  Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'],
  Jupiter: ['Sun', 'Moon', 'Mars'],
  Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus'],
}
const PERM_ENEMIES = {
  Sun: ['Venus', 'Saturn'],
  Moon: [],
  Mars: ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'],
  Venus: ['Sun', 'Moon'],
  Saturn: ['Sun', 'Moon', 'Mars'],
}

function getDignity(planetName, sign) {
  if (MOOLA_SIGN[planetName] === sign) return 'moolatrikona'
  if (OWN_SIGNS[planetName].includes(sign)) return 'own'
  const ruler = SIGN_RULER[sign - 1]
  if (PERM_FRIENDS[planetName].includes(ruler)) return 'friend'
  if (PERM_ENEMIES[planetName].includes(ruler)) return 'enemy'
  return 'neutral'
}

const DIGNITY_PTS = { moolatrikona: 45, own: 30, friend: 15, neutral: 7.5, enemy: 3.75 }
const VARGA_KEYS = ['D1', 'D2', 'D3', 'D7', 'D9', 'D12', 'D16']

// ── Sthana Bala helpers ────────────────────────────────────────────────────────

function uchaBala(planetName, lon) {
  const exalt = EXALT_LON[planetName]
  if (exalt === undefined) return 0
  const dist = Math.abs(((lon - exalt + 540) % 360) - 180)
  return 60 * (1 - dist / 180)
}

function saptaVargajaBala(planetName, planets, lagna) {
  let total = 0
  for (const key of VARGA_KEYS) {
    const { planets: dPlanets } = calcDivisional(planets, lagna, key)
    const dp = dPlanets.find(p => p.name === planetName)
    total += DIGNITY_PTS[getDignity(planetName, dp.sign)]
  }
  return total
}

function ojayugmaBala(planetName, d1Sign, d9Sign) {
  function pref(sign) {
    const isOdd = sign % 2 === 1
    if (['Sun', 'Mars', 'Jupiter', 'Saturn'].includes(planetName)) return isOdd ? 15 : 0
    if (['Moon', 'Venus'].includes(planetName)) return isOdd ? 0 : 15
    return 15 // Mercury always gets 15
  }
  return (pref(d1Sign) + pref(d9Sign)) / 2
}

function kendradiBala(house) {
  if ([1, 4, 7, 10].includes(house)) return 60
  if ([2, 5, 8, 11].includes(house)) return 30
  return 15
}

const DREKKANA_GENDER = {
  Sun: 'male', Mars: 'male', Jupiter: 'male',
  Moon: 'female', Venus: 'female',
  Mercury: 'neutral', Saturn: 'neutral',
}

function drekkanaBala(planetName, degree) {
  const part = Math.floor((degree % 30) / 10)
  const g = DREKKANA_GENDER[planetName]
  if (g === 'male' && part === 0) return 15
  if (g === 'female' && part === 2) return 15
  if (g === 'neutral' && part === 1) return 15
  return 0
}

function sthanaBala(planet, planets, lagna) {
  const { planets: d9Planets } = calcDivisional(planets, lagna, 'D9')
  const d9Planet = d9Planets.find(p => p.name === planet.name)
  return (
    uchaBala(planet.name, planet.lon) +
    saptaVargajaBala(planet.name, planets, lagna) +
    ojayugmaBala(planet.name, planet.sign, d9Planet.sign) +
    kendradiBala(planet.house) +
    drekkanaBala(planet.name, planet.degree)
  )
}

// ── Dig Bala ──────────────────────────────────────────────────────────────────

const DIG_BEST = { Sun: 10, Mars: 10, Moon: 4, Venus: 4, Mercury: 1, Jupiter: 1, Saturn: 7 }

function digBala(planetName, house) {
  const best = DIG_BEST[planetName]
  const dist = Math.min(Math.abs(house - best), 12 - Math.abs(house - best))
  return 60 * (1 - dist / 6)
}

// ── Kala Bala ─────────────────────────────────────────────────────────────────

function nathonnathaBala(planetName, isDayBirth) {
  if (planetName === 'Mercury') return 60
  if (['Sun', 'Jupiter', 'Venus'].includes(planetName)) return isDayBirth ? 60 : 0
  return isDayBirth ? 0 : 60  // Moon, Mars, Saturn
}

function pakshaBala(planetName, planets) {
  const moon = planets.find(p => p.name === 'Moon')
  const sun  = planets.find(p => p.name === 'Sun')
  const phase = ((moon.lon - sun.lon) + 360) % 360

  if (planetName === 'Moon') {
    return phase <= 180 ? phase / 3 : (360 - phase) / 3
  }
  const waxing = phase <= 180
  if (['Mercury', 'Jupiter', 'Venus'].includes(planetName)) {
    return waxing ? phase / 3 : (360 - phase) / 3
  }
  return waxing ? (180 - phase) / 3 : (phase - 180) / 3
}

function ayanaBala(planetName, planet) {
  if (planetName === 'Mercury') return 30
  const tropLon = (planet.lon + 24) % 360
  const obliqRad = 23.45 * Math.PI / 180
  const lonRad = tropLon * Math.PI / 180
  const decl = Math.asin(Math.sin(obliqRad) * Math.sin(lonRad)) * 180 / Math.PI
  const northPrefer = ['Sun', 'Mars', 'Jupiter', 'Venus']
  const factor = northPrefer.includes(planetName) ? 1 : -1
  return 30 + factor * 30 * (decl / 23.45)
}

function kalaBala(planetName, planet, planets, jd, panchang) {
  let isDayBirth = true
  if (panchang?.sunrise && panchang?.sunset) {
    const birthDate = jdToDate(jd)
    isDayBirth = birthDate >= panchang.sunrise && birthDate < panchang.sunset
  }
  const ayanaContrib = (planetName === 'Sun' || planetName === 'Moon') ? 0 : ayanaBala(planetName, planet)
  return nathonnathaBala(planetName, isDayBirth) + pakshaBala(planetName, planets) + ayanaContrib
}

// ── Chesta Bala ───────────────────────────────────────────────────────────────

const MEAN_SPEED = { Mars: 0.524, Mercury: 1.383, Jupiter: 0.083, Venus: 1.2, Saturn: 0.033 }

function chestaBala(planetName, planet) {
  if (planetName === 'Sun' || planetName === 'Moon') return ayanaBala(planetName, planet)
  if (planet.retrograde) return 60
  const spd = Math.abs(planet.speed ?? 0)
  if (spd < 0.083) return 30
  return spd >= (MEAN_SPEED[planetName] ?? 1) ? 45 : 15
}

// ── Naisargika Bala (fixed) ───────────────────────────────────────────────────

const NAISARGIKA = {
  Sun: 60, Moon: 51.43, Venus: 42.86, Jupiter: 34.28,
  Mercury: 25.71, Mars: 17.14, Saturn: 8.57,
}

// ── Drik Bala ─────────────────────────────────────────────────────────────────

// 0-indexed house offsets from caster that each planet aspects
const ASPECT_OFFSETS = {
  Sun:     [6],
  Moon:    [6],
  Mars:    [3, 6, 7],
  Mercury: [6],
  Jupiter: [4, 6, 8],
  Venus:   [6],
  Saturn:  [2, 6, 9],
}

const ASPECT_STRENGTH = { 2: 0.25, 3: 0.5, 4: 0.75, 6: 1.0, 7: 0.5, 8: 0.75, 9: 0.25 }

const BENEFICS = new Set(['Moon', 'Mercury', 'Jupiter', 'Venus'])
const MALEFICS = new Set(['Sun', 'Mars', 'Saturn'])

function drikBala(targetName, planets) {
  const target = planets.find(p => p.name === targetName)
  let total = 0
  for (const caster of planets) {
    if (caster.name === targetName) continue
    if (!SHADBALA_PLANETS.includes(caster.name)) continue
    const relOffset = (target.house - caster.house + 12) % 12
    const offsets = ASPECT_OFFSETS[caster.name] ?? [6]
    if (!offsets.includes(relOffset)) continue
    const strength = ASPECT_STRENGTH[relOffset] ?? 0
    if (BENEFICS.has(caster.name)) total += 15 * strength
    if (MALEFICS.has(caster.name)) total -= 15 * strength
  }
  return total / 2
}

// ── Required minimums ─────────────────────────────────────────────────────────

const REQUIRED = {
  Sun: 390, Moon: 360, Mars: 300, Mercury: 420,
  Jupiter: 390, Venus: 330, Saturn: 300,
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {object[]} planets   state.planets
 * @param {object}   lagna     state.lagna
 * @param {number[]} houses    state.houses (reserved, unused)
 * @param {number}   jd        Julian Day of birth (UT)
 * @param {object}   panchang  state.panchang (for sunrise/sunset)
 * @returns {{ [planet: string]: { sthanaBala, digBala, kalaBala, chestaBala, naisargikaBala, drikBala, total, required, ratio } }}
 */
export function calcShadbala(planets, lagna, houses, jd, panchang) {
  const result = {}
  for (const name of SHADBALA_PLANETS) {
    const planet = planets.find(p => p.name === name)
    if (!planet) continue
    const sb  = sthanaBala(planet, planets, lagna)
    const db  = digBala(name, planet.house)
    const kb  = kalaBala(name, planet, planets, jd, panchang)
    const cb  = chestaBala(name, planet)
    const nb  = NAISARGIKA[name]
    const drb = drikBala(name, planets)
    const total = sb + db + kb + cb + nb + drb
    const req   = REQUIRED[name]
    result[name] = {
      sthanaBala:     Math.round(sb  * 10) / 10,
      digBala:        Math.round(db  * 10) / 10,
      kalaBala:       Math.round(kb  * 10) / 10,
      chestaBala:     Math.round(cb  * 10) / 10,
      naisargikaBala: Math.round(nb  * 10) / 10,
      drikBala:       Math.round(drb * 10) / 10,
      total:          Math.round(total * 10) / 10,
      required:       req,
      ratio:          Math.round((total / req) * 100) / 100,
    }
  }
  return result
}
