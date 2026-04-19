// src/core/divisional.js

// Map divisor → human label (used by chart tab)
export const DIVISIONAL_OPTIONS = [
  { value: 'D1',     label: 'D1 – Rashi' },
  { value: 'D2',     label: 'D2 – Hora' },
  { value: 'D3',     label: 'D3 – Drekkana' },
  { value: 'D4',     label: 'D4 – Chaturthamsha' },
  { value: 'D5',     label: 'D5 – Panchamsha' },
  { value: 'D6',     label: 'D6 – Shashthamsha' },
  { value: 'D7',     label: 'D7 – Saptamsha' },
  { value: 'D8',     label: 'D8 – Ashtamsha' },
  { value: 'D9',     label: 'D9 – Navamsa' },
  { value: 'D10',    label: 'D10 – Dashamsha' },
  { value: 'D11',    label: 'D11 – Rudramsha' },
  { value: 'D12',    label: 'D12 – Dwadashamsha' },
  { value: 'Chalit', label: 'Chalit' },
]

// D2 Hora — traditional Parashari rule
function hora(lon) {
  const sign      = Math.floor(lon / 30) + 1
  const degInSign = lon % 30
  const isOdd     = sign % 2 === 1
  const firstHalf = degInSign < 15
  // Odd sign 0-15° → Leo(5), 15-30° → Cancer(4)
  // Even sign 0-15° → Cancer(4), 15-30° → Leo(5)
  const dSign = (isOdd === firstHalf) ? 5 : 4
  return { sign: dSign, degree: degInSign % 15 }
}

function part(lon, n) {
  return Math.floor((lon % 30) * n / 30)   // 0..n-1
}
function deg(lon, n) {
  return ((lon % 30) * n) % 30 / n
}

// D3 Drekkana: each sign maps to its trikona; advance +4 signs per part
function d3(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l = part(lon, 3)
  return { sign: ((sign - 1) + l * 4) % 12 + 1, degree: deg(lon, 3) }
}

// D4 Chaturthamsa: advance +3 signs per part (kendra sequence)
function d4(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l = part(lon, 4)
  return { sign: ((sign - 1) + l * 3) % 12 + 1, degree: deg(lon, 4) }
}

// D7 Saptamsa: odd signs start from self, even signs start from 7th (self+6)
function d7(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l = part(lon, 7)
  const offset = sign % 2 === 0 ? 6 : 0
  return { sign: ((sign - 1) + offset + l) % 12 + 1, degree: deg(lon, 7) }
}

// D9 Navamsa: element group seeds — Fire→Aries(0), Earth→Cap(9), Air→Lib(6), Water→Can(3)
function d9(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l = part(lon, 9)
  const SEEDS = [0,9,6,3, 0,9,6,3, 0,9,6,3]  // index = sign-1
  return { sign: (SEEDS[sign - 1] + l) % 12 + 1, degree: deg(lon, 9) }
}

// D10 Dasamsa: odd signs start from self, even signs start from 9th (self+8)
function d10(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l = part(lon, 10)
  const offset = sign % 2 === 0 ? 8 : 0
  return { sign: ((sign - 1) + offset + l) % 12 + 1, degree: deg(lon, 10) }
}

// D12 Dwadasamsa: starts from the sign itself, advances +1 per part
function d12(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l = part(lon, 12)
  return { sign: ((sign - 1) + l) % 12 + 1, degree: deg(lon, 12) }
}

// D5/D6/D8/D11 use Parivritti Cyclic (sequential) — non-standardised across traditions
function parivritti(lon, n) {
  const sign      = Math.floor(lon / 30) + 1
  const l         = part(lon, n)
  const dSign     = ((sign - 1) * n + l) % 12 + 1
  return { sign: dSign, degree: deg(lon, n) }
}

function transformLon(lon, key) {
  if (key === 'D1')  return { sign: Math.floor(lon / 30) + 1, degree: lon % 30 }
  if (key === 'D2')  return hora(lon)
  if (key === 'D3')  return d3(lon)
  if (key === 'D4')  return d4(lon)
  if (key === 'D7')  return d7(lon)
  if (key === 'D9')  return d9(lon)
  if (key === 'D10') return d10(lon)
  if (key === 'D12') return d12(lon)
  const n = parseInt(key.slice(1), 10)
  if (isNaN(n) || n < 1) throw new Error(`Unknown divisional key: ${key}`)
  return parivritti(lon, n)
}

/**
 * Returns transformed { planets, lagna } for the given divisional key.
 * For 'Chalit', planets.sign is replaced with planet.house so the caller
 * can pass them straight to renderChartSVG.
 *
 * @param {object[]} planets  - from state.planets
 * @param {object}   lagna    - from state.lagna
 * @param {string}   key      - 'D1'|'D2'|...|'D12'|'Chalit'
 */
export function calcDivisional(planets, lagna, key) {
  if (key === 'Chalit') {
    return {
      planets: planets.map(p => ({ ...p, sign: p.house })),
      lagna:   { ...lagna, sign: 1 },
    }
  }
  return {
    planets: planets.map(p => {
      const { sign, degree } = transformLon(p.lon, key)
      return { ...p, sign, degree }
    }),
    lagna: (() => {
      const { sign, degree } = transformLon(lagna.lon, key)
      return { ...lagna, sign, degree }
    })(),
  }
}
