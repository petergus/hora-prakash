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

// Standard Parashari formula for D3–D12
function parashari(lon, n) {
  const sign        = Math.floor(lon / 30) + 1          // 1–12
  const degInSign   = lon % 30
  const part        = Math.floor((degInSign * n) / 30)  // 0..n-1
  const dSign       = ((sign - 1) * n + part) % 12 + 1
  const dDegree     = (degInSign * n) % 30 / n
  return { sign: dSign, degree: dDegree }
}

// D2 Hora — traditional rule
function hora(lon) {
  const sign      = Math.floor(lon / 30) + 1
  const degInSign = lon % 30
  const isOdd     = sign % 2 === 1
  const firstHalf = degInSign < 15
  // Odd sign: 0–15 → Leo(5), 15–30 → Cancer(4)
  // Even sign: 0–15 → Cancer(4), 15–30 → Leo(5)
  const dSign = (isOdd === firstHalf) ? 5 : 4
  return { sign: dSign, degree: degInSign % 15 }
}

function transformLon(lon, key) {
  if (key === 'D1')  return { sign: Math.floor(lon / 30) + 1, degree: lon % 30 }
  if (key === 'D2')  return hora(lon)
  const n = parseInt(key.slice(1), 10)
  if (isNaN(n) || n < 1 || n > 12) throw new Error(`Unknown divisional key: ${key}`)
  return parashari(lon, n)
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
