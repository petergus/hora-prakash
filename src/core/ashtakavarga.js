// src/core/ashtakavarga.js

// Parashari Bhinnashtakavarga benefic house tables.
// Key = planet being analysed. Value = map of contributor → 1-indexed house list.
const BHINNA_TABLES = {
  Sun: {
    Sun:     [1,2,4,7,8,9,10,11],
    Moon:    [3,6,10,11],
    Mars:    [1,2,4,7,8,9,10,11],
    Mercury: [3,5,6,9,10,11,12],
    Jupiter: [5,6,9,11],
    Venus:   [6,7,12],
    Saturn:  [1,2,4,7,8,9,10,11],
    Lagna:   [3,4,6,10,11,12],
  },
  Moon: {
    Sun:     [3,6,7,8,10,11],
    Moon:    [1,3,6,7,9,10,11],
    Mars:    [2,3,5,6,10,11],
    Mercury: [1,3,4,5,7,8,10,11],
    Jupiter: [1,2,4,7,8,10,11],
    Venus:   [3,4,5,7,9,10,11],
    Saturn:  [3,5,6,11],
    Lagna:   [3,6,10,11],
  },
  Mars: {
    Sun:     [3,5,6,10,11],
    Moon:    [3,6,11],
    Mars:    [1,2,4,7,8,10,11],
    Mercury: [3,5,6,11],
    Jupiter: [6,10,11,12],
    Venus:   [6,8,11,12],
    Saturn:  [1,4,7,8,9,10,11],
    Lagna:   [1,3,6,10,11],
  },
  Mercury: {
    Sun:     [5,6,9,11,12],
    Moon:    [2,4,6,8,10,11],
    Mars:    [1,2,4,7,8,9,10,11],
    Mercury: [1,3,5,6,9,10,11,12],
    Jupiter: [6,8,11,12],
    Venus:   [1,2,3,4,5,8,9,11],
    Saturn:  [1,2,4,7,8,9,10,11],
    Lagna:   [1,2,4,6,8,10,11],
  },
  Jupiter: {
    Sun:     [1,2,3,4,7,8,9,10,11],
    Moon:    [2,5,7,9,11],
    Mars:    [1,2,4,7,8,10,11],
    Mercury: [1,2,4,5,6,9,10,11],
    Jupiter: [1,2,3,4,7,8,10,11],
    Venus:   [2,5,6,9,10,11],
    Saturn:  [3,5,6,12],
    Lagna:   [1,2,4,5,6,7,9,10,11],
  },
  Venus: {
    Sun:     [8,11,12],
    Moon:    [1,2,3,4,5,8,9,11,12],
    Mars:    [3,4,6,9,11,12],
    Mercury: [3,5,6,9,11],
    Jupiter: [5,8,9,10,11],
    Venus:   [1,2,3,4,5,8,9,10,11],
    Saturn:  [3,4,5,8,9,10,11],
    Lagna:   [1,2,3,4,5,8,9,11],
  },
  Saturn: {
    Sun:     [1,2,4,7,8,10,11],
    Moon:    [3,6,11],
    Mars:    [3,5,6,10,11,12],
    Mercury: [6,8,9,10,11,12],
    Jupiter: [5,6,11,12],
    Venus:   [6,11,12],
    Saturn:  [3,5,6,11],
    Lagna:   [1,3,4,6,10,11],
  },
  Lagna: {
    Sun:     [3,4,6,10,11,12],
    Moon:    [3,6,10,11,12],
    Mars:    [1,3,6,10,11],
    Mercury: [1,2,4,6,8,10,11],
    Jupiter: [1,2,4,5,6,7,9,10,11],
    Venus:   [1,2,3,4,5,8,9],
    Saturn:  [1,3,4,6,10,11],
    Lagna:   [3,6,10,11],
  },
}

const CONTRIBUTORS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Lagna']

/**
 * @param {object[]} planets  state.planets
 * @param {object}   lagna    state.lagna
 * @returns {{ Sun: number[], Moon: number[], ..., Saturn: number[] }}
 *   Each array has 12 elements: score per sign index 0–11 (Aries=0 … Pisces=11), range 0–8.
 */
export function calcBhinnashtakavarga(planets, lagna) {
  const planetMap = Object.fromEntries(planets.map(p => [p.name, p]))

  const result = {}
  for (const planet of Object.keys(BHINNA_TABLES)) {
    const scores = new Array(12).fill(0)
    const table = BHINNA_TABLES[planet]
    for (const contrib of CONTRIBUTORS) {
      const contribSign0 = contrib === 'Lagna'
        ? lagna.sign - 1
        : (planetMap[contrib]?.sign ?? 1) - 1  // 0-indexed
      for (const h of table[contrib]) {
        const targetSign0 = (contribSign0 + h - 1) % 12
        scores[targetSign0]++
      }
    }
    result[planet] = scores
  }
  return result
}

/**
 * @param {{ [planet: string]: number[] }} bhinna  output of calcBhinnashtakavarga
 * @returns {number[]} 12 scores (Aries…Pisces), range 0–56
 */
export function calcSarvashtakavarga(bhinna) {
  const sarva = new Array(12).fill(0)
  for (const [planet, scores] of Object.entries(bhinna)) {
    if (planet === 'Lagna') continue
    for (let i = 0; i < 12; i++) sarva[i] += scores[i]
  }
  return sarva
}
