// src/core/avastha.js
// Planetary avasthas (states):
//  - Baladi (five age-states from the degree within the sign, direction
//    reversed in even signs) — BPHS.
//  - Jagradadi (awake / dreaming / asleep from dignity).
//  - Deeptadi (nine mood-states from exaltation/debility, combustion, own
//    sign, and compound five-fold friendship with the dispositor).
//
// Compound (panchadha) friendship = natural friendship table + temporal
// friendship (planets in 2,3,4,10,11,12 from each other are temporal friends).
//
// Pure and Node-safe: works on the planet objects produced by calcBirthChart
// ({ name, sign, degree, combust }). Rahu/Ketu carry no classical dignity
// here and return null avasthas.

export const EXALT_SIGN = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 }
export const DEBIL_SIGN = { Sun: 7, Moon: 8, Mars: 4,  Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1 }

export const OWN_SIGNS = {
  Sun: [5], Moon: [4], Mars: [1, 8], Mercury: [3, 6],
  Jupiter: [9, 12], Venus: [2, 7], Saturn: [10, 11],
}

// Lord of each sign 1–12
export const SIGN_LORDS = ['Mars','Venus','Mercury','Moon','Sun','Mercury',
                           'Venus','Mars','Jupiter','Saturn','Saturn','Jupiter']

// Natural (naisargika) friendships — Parashara.
const NATURAL = {
  Sun:     { friends: ['Moon','Mars','Jupiter'],   enemies: ['Venus','Saturn'] },
  Moon:    { friends: ['Sun','Mercury'],           enemies: [] },
  Mars:    { friends: ['Sun','Moon','Jupiter'],    enemies: ['Mercury'] },
  Mercury: { friends: ['Sun','Venus'],             enemies: ['Moon'] },
  Jupiter: { friends: ['Sun','Moon','Mars'],       enemies: ['Mercury','Venus'] },
  Venus:   { friends: ['Mercury','Saturn'],        enemies: ['Sun','Moon'] },
  Saturn:  { friends: ['Mercury','Venus'],         enemies: ['Sun','Moon','Mars'] },
}

export function naturalRelation(a, b) {
  const n = NATURAL[a]
  if (!n) return null
  if (n.friends.includes(b)) return 'friend'
  if (n.enemies.includes(b)) return 'enemy'
  return 'neutral'
}

/** Temporal (tatkalika) relation of a toward b from their sign placements. */
export function temporalRelation(signA, signB) {
  const dist = ((signB - signA) % 12 + 12) % 12 + 1 // house of b counted from a, 1..12
  return [2, 3, 4, 10, 11, 12].includes(dist) ? 'friend' : 'enemy'
}

/**
 * Compound (panchadha) relation of planet `a` toward planet `b`.
 * natural friend + temporal friend  → great friend (adhimitra)
 * natural neutral + temporal friend → friend
 * natural friend + temporal enemy   → neutral   (and mirror cases)
 * natural neutral + temporal enemy  → enemy
 * natural enemy + temporal enemy    → great enemy (adhisatru)
 */
export function compoundRelation(a, b, signA, signB) {
  const nat = naturalRelation(a, b)
  if (nat === null) return null
  const tmp = temporalRelation(signA, signB)
  const score = (nat === 'friend' ? 1 : nat === 'enemy' ? -1 : 0) + (tmp === 'friend' ? 1 : -1)
  return score >= 2 ? 'great-friend'
    : score === 1 ? 'friend'
    : score === 0 ? 'neutral'
    : score === -1 ? 'enemy'
    : 'great-enemy'
}

// ── Baladi (age) avastha ─────────────────────────────────────────────────────

const BALADI = [
  { key: 'bala',    name: 'Bala',    meaning: 'infant — a quarter of its results' },
  { key: 'kumara',  name: 'Kumara',  meaning: 'youth — half of its results' },
  { key: 'yuva',    name: 'Yuva',    meaning: 'adult — full results' },
  { key: 'vriddha', name: 'Vriddha', meaning: 'old — little result' },
  { key: 'mrita',   name: 'Mrita',   meaning: 'dead — negligible result' },
]

/**
 * Baladi avastha from sign (1–12) + degree in sign (0–30).
 * Odd signs run Bala→Mrita with increasing degree; even signs reverse.
 */
export function calcBaladi(sign, degree) {
  const step = Math.min(4, Math.floor(degree / 6))
  const idx  = sign % 2 === 1 ? step : 4 - step
  return BALADI[idx]
}

// ── Jagradadi (alertness) avastha ────────────────────────────────────────────

const JAGRADADI = {
  jagrat:   { key: 'jagrat',   name: 'Jagrat',   meaning: 'awake — strong, delivers fully' },
  svapna:   { key: 'svapna',   name: 'Svapna',   meaning: 'dreaming — middling results' },
  sushupti: { key: 'sushupti', name: 'Sushupti', meaning: 'asleep — results barely manifest' },
}

// ── Deeptadi (mood) avastha ──────────────────────────────────────────────────

const DEEPTADI = {
  deepta:   { key: 'deepta',   name: 'Deepta',   meaning: 'radiant — exalted' },
  svastha:  { key: 'svastha',  name: 'Svastha',  meaning: 'at ease — in own sign' },
  mudita:   { key: 'mudita',   name: 'Mudita',   meaning: 'delighted — in a great friend’s sign' },
  shanta:   { key: 'shanta',   name: 'Shanta',   meaning: 'calm — in a friend’s sign' },
  deena:    { key: 'deena',    name: 'Deena',    meaning: 'meek — in a neutral’s sign' },
  duhkhita: { key: 'duhkhita', name: 'Duhkhita', meaning: 'distressed — in an enemy’s sign' },
  vikala:   { key: 'vikala',   name: 'Vikala',   meaning: 'crippled — in a great enemy’s sign' },
  khala:    { key: 'khala',    name: 'Khala',    meaning: 'wicked — debilitated' },
  kopa:     { key: 'kopa',     name: 'Kopa',     meaning: 'inflamed — combust' },
}

/**
 * Avasthas for every planet of a chart.
 * @param {object[]} planets calcBirthChart output ({ name, sign, degree, combust })
 * @returns {{ [name]: { baladi, jagradadi, deeptadi, dispositor, relation } | null }}
 */
export function calcAvasthas(planets) {
  const res = {}
  const byName = Object.fromEntries(planets.map(p => [p.name, p]))

  for (const p of planets) {
    if (!NATURAL[p.name]) { res[p.name] = null; continue } // Rahu/Ketu

    const baladi = calcBaladi(p.sign, p.degree)

    const exalted = EXALT_SIGN[p.name] === p.sign
    const debil   = DEBIL_SIGN[p.name] === p.sign
    const own     = OWN_SIGNS[p.name].includes(p.sign)

    const dispositor = SIGN_LORDS[p.sign - 1]
    let relation = null
    if (!own && byName[dispositor]) {
      relation = compoundRelation(p.name, dispositor, p.sign, byName[dispositor].sign)
    }

    // Deeptadi precedence: dignity extremes, then combustion, then residence.
    let deeptadi
    if (exalted)         deeptadi = DEEPTADI.deepta
    else if (debil)      deeptadi = DEEPTADI.khala
    else if (p.combust)  deeptadi = DEEPTADI.kopa
    else if (own)        deeptadi = DEEPTADI.svastha
    else deeptadi = {
      'great-friend': DEEPTADI.mudita,
      'friend':       DEEPTADI.shanta,
      'neutral':      DEEPTADI.deena,
      'enemy':        DEEPTADI.duhkhita,
      'great-enemy':  DEEPTADI.vikala,
    }[relation] ?? DEEPTADI.deena

    const jagradadi = (exalted || own) ? JAGRADADI.jagrat
      : (debil || relation === 'enemy' || relation === 'great-enemy') ? JAGRADADI.sushupti
      : JAGRADADI.svapna

    res[p.name] = { baladi, jagradadi, deeptadi, dispositor: own ? null : dispositor, relation }
  }
  return res
}
