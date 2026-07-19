// src/content/functional-nature.js
// Functional benefic / malefic of each planet FOR A GIVEN LAGNA.
//
// ⚠ AUTHORSHIP: composed from classical Parashari rules, not a hand-written
// per-lagna table — the tradition itself states the classification as rules
// over house-lordship, so composing keeps it honest and in sync with the
// house model. Not reviewed by a practising astrologer.
//
// The rules (Parashari functional nature):
//  • A planet ruling a trikona (1/5/9) is a functional benefic.
//  • A planet ruling BOTH a kendra (4/7/10) and a trikona (5/9) is a
//    YOGAKARAKA — the strongest benefic.
//  • A planet ruling a dusthana (6/8/12) is a functional malefic (a trikona
//    rulership overrides this).
//  • A natural malefic ruling only kendras loses its malefic edge (neutral);
//    a natural benefic ruling only kendras picks up mild kendradhipati dosha
//    (neutral).
//  • Rulership of 3 or 11 (upachaya) leans mildly malefic; 2 or 7 (maraka)
//    is neutral.
//  • Rahu/Ketu own no sign — classified 'neutral' here (their functional tone
//    really follows their dispositor and house, out of scope for this table).
//
// Pure, Node-safe, tested (tests/timeline.test.mjs).

const SIGN_LORDS = ['Mars','Venus','Mercury','Moon','Sun','Mercury',
                    'Venus','Mars','Jupiter','Saturn','Saturn','Jupiter']
const NATURAL_BENEFIC = new Set(['Jupiter', 'Venus', 'Moon', 'Mercury'])
const NODES = new Set(['Rahu', 'Ketu'])

const KENDRA = new Set([4, 7, 10])
const TRIKONA = new Set([5, 9])          // 1 handled via lagna-lord below
const DUSTHANA = new Set([6, 8, 12])
const UPACHAYA_MAL = new Set([3, 11])

/** Houses (1–12) a planet rules for a given lagna. */
export function housesRuled(planet, lagnaSign) {
  const out = []
  for (let h = 1; h <= 12; h++) {
    const sign = ((lagnaSign - 1 + h - 1) % 12) + 1
    if (SIGN_LORDS[sign - 1] === planet) out.push(h)
  }
  return out
}

/**
 * Functional nature of a planet for a lagna.
 * @returns {'yogakaraka'|'benefic'|'malefic'|'neutral'}
 */
export function functionalNature(planet, lagnaSign) {
  if (NODES.has(planet)) return 'neutral'
  const houses = housesRuled(planet, lagnaSign)
  if (!houses.length) return 'neutral'

  const rulesKendra  = houses.some(h => KENDRA.has(h))
  const rulesTrikona = houses.some(h => TRIKONA.has(h)) || houses.includes(1)
  const rulesDusthana = houses.some(h => DUSTHANA.has(h))

  // Yogakaraka: a genuine kendra (4/7/10) AND a trikona (5/9) — the classic
  // single-planet raja combination (e.g. Mars for Cancer/Leo, Saturn for
  // Taurus/Libra, Venus for Capricorn/Aquarius).
  if (houses.some(h => KENDRA.has(h)) && houses.some(h => TRIKONA.has(h))) return 'yogakaraka'

  // Trikona rulership (incl. the lagna lord) is benefic — and overrides a
  // simultaneous dusthana rulership.
  if (rulesTrikona) return 'benefic'

  if (rulesDusthana) return 'malefic'

  if (rulesKendra) {
    // Kendradhipati: natural benefics turn neutral, natural malefics lose bite.
    return 'neutral'
  }

  if (houses.some(h => UPACHAYA_MAL.has(h))) return 'malefic'  // 3rd/11th lord

  return 'neutral'  // maraka (2/7) only
}

/** All planets classified for a lagna. */
export function functionalNatures(lagnaSign) {
  const planets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu']
  return Object.fromEntries(planets.map(p => [p, functionalNature(p, lagnaSign)]))
}

/** Benefic-ish for synchrony scoring: yogakaraka/benefic → good, malefic → hard. */
export function isFunctionalBenefic(planet, lagnaSign) {
  const n = functionalNature(planet, lagnaSign)
  return n === 'yogakaraka' || n === 'benefic'
}
