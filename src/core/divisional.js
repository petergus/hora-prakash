// src/core/divisional.js

// Assign planet longitude to house given an array of 12 cusp longitudes
function houseFromCusps(pLon, cusps) {
  for (let i = 0; i < 12; i++) {
    const c1 = cusps[i]
    const c2 = cusps[(i + 1) % 12]
    if (((pLon - c1 + 360) % 360) < ((c2 - c1 + 360) % 360)) return i + 1
  }
  return 1
}

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
  { value: 'D16',    label: 'D16 – Shodashamsha' },
  { value: 'D20',    label: 'D20 – Vimshamsha' },
  { value: 'D24',    label: 'D24 – Siddhamsha' },
  { value: 'D27',    label: 'D27 – Nakshatramsha' },
  { value: 'D30',    label: 'D30 – Trimshamsha' },
  { value: 'D40',    label: 'D40 – Khavedamsha' },
  { value: 'D45',    label: 'D45 – Akshavedamsha' },
  { value: 'D60',    label: 'D60 – Shashtyamsha' },
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
  // Each hora spans 15°, mapped onto a full 30° sign → scale ×2
  return { sign: dSign, degree: (degInSign % 15) * 2 }
}

function part(lon, n) {
  return Math.floor((lon % 30) * n / 30)   // 0..n-1
}
// Degree within the divisional sign, scaled to the full 0–30° range.
// Each part spans (30/n)°; the position inside it is stretched back to 30°.
function deg(lon, n) {
  return ((lon % 30) * n) % 30
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

// D30 Trimshamsha: Parashari rule — unequal partitions, different for odd/even signs.
// bounds = cumulative partition edges (length 6); signs = lord's sign per partition.
const D30_ODD  = { bounds: [0, 5, 10, 18, 25, 30], signs: [1, 11, 9, 3, 7] }
const D30_EVEN = { bounds: [0, 5, 12, 20, 25, 30], signs: [7, 6, 12, 10, 8] }
function d30(lon) {
  const sign     = Math.floor(lon / 30) + 1
  const degree   = lon % 30
  const { bounds, signs } = sign % 2 === 1 ? D30_ODD : D30_EVEN
  let i = 0
  while (i < signs.length - 1 && degree >= bounds[i + 1]) i++
  // Stretch the position within this (unequal) partition to the full 0–30° sign
  const width = bounds[i + 1] - bounds[i]
  return { sign: signs[i], degree: (degree - bounds[i]) / width * 30 }
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

// D16 Shodashamsha: Movable→Aries(0), Fixed→Leo(4), Dual→Sagittarius(8)
function d16(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l    = part(lon, 16)
  const seed = ((sign - 1) % 3) * 4   // 0,4,8 repeating
  return { sign: (seed + l) % 12 + 1, degree: deg(lon, 16) }
}

// D20 Vimshamsha: Movable→Aries(0), Fixed→Sagittarius(8), Dual→Leo(4)
function d20(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l    = part(lon, 20)
  const SEEDS = [0,8,4, 0,8,4, 0,8,4, 0,8,4]  // index = sign-1
  return { sign: (SEEDS[sign - 1] + l) % 12 + 1, degree: deg(lon, 20) }
}

// D24 Siddhamsha: Odd signs→Leo(4), Even signs→Cancer(3)
function d24(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l    = part(lon, 24)
  const seed = sign % 2 === 1 ? 4 : 3
  return { sign: (seed + l) % 12 + 1, degree: deg(lon, 24) }
}

// D27 Nakshatramsha: Fire→Aries(0), Earth→Cancer(3), Air→Libra(6), Water→Capricorn(9)
function d27(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l    = part(lon, 27)
  const seed = ((sign - 1) % 4) * 3   // 0,3,6,9 repeating
  return { sign: (seed + l) % 12 + 1, degree: deg(lon, 27) }
}

// D40 Khavedamsha: Odd signs→Aries(0), Even signs→Libra(6)
function d40(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l    = part(lon, 40)
  const seed = sign % 2 === 1 ? 0 : 6
  return { sign: (seed + l) % 12 + 1, degree: deg(lon, 40) }
}

// D45 Akshavedamsha: Movable→Aries(0), Fixed→Leo(4), Dual→Sagittarius(8)
function d45(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l    = part(lon, 45)
  const seed = ((sign - 1) % 3) * 4
  return { sign: (seed + l) % 12 + 1, degree: deg(lon, 45) }
}

// D60 Shashtyamsha: BPHS — count parts from the occupied sign itself.
// (Must NOT fall through to parivritti: 60 ≡ 0 mod 12, so the parivritti formula
// degenerates to counting every sign from Aries.)
function d60(lon) {
  const sign = Math.floor(lon / 30) + 1
  const l    = part(lon, 60)
  return { sign: ((sign - 1) + l) % 12 + 1, degree: deg(lon, 60) }
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
  if (key === 'D16') return d16(lon)
  if (key === 'D20') return d20(lon)
  if (key === 'D24') return d24(lon)
  if (key === 'D27') return d27(lon)
  if (key === 'D30') return d30(lon)
  if (key === 'D40') return d40(lon)
  if (key === 'D45') return d45(lon)
  if (key === 'D60') return d60(lon)
  const n = parseInt(key.slice(1), 10)
  if (isNaN(n) || n < 1) throw new Error(`Unknown divisional key: ${key}`)
  return parivritti(lon, n)  // D5/D6/D8/D11 use Parivritti (see CLAUDE.md pending notes)
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
export function calcDivisional(planets, lagna, key, options = {}) {
  if (key === 'Chalit') {
    const method = options.chalitMethod ?? 'equal'
    let planetHouse
    if (method === 'placidus' && options.houses?.length === 12) {
      planetHouse = (pLon) => houseFromCusps(pLon, options.houses)
    } else if (method === 'sripati' && options.sripatiHouses?.length === 12) {
      planetHouse = (pLon) => houseFromCusps(pLon, options.sripatiHouses)
    } else {
      // Equal bhava: each house is 30° wide, centered on Ascendant degree.
      // Bhava sandhi (cusp of house 1) = lagna.lon - 15°
      const sandhi1 = ((lagna.lon - 15) + 360) % 360
      planetHouse = (pLon) => Math.floor(((pLon - sandhi1 + 360) % 360) / 30) + 1
    }
    // Map bhava number → its rashi (madhya of bhava N is in consecutive signs from lagna.sign)
    const houseToSign = (h) => ((lagna.sign - 1 + h - 1) % 12) + 1
    return {
      planets: planets.map(p => ({ ...p, sign: houseToSign(planetHouse(p.lon)) })),
      lagna:   { ...lagna },
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
