// src/content/interpretation/house-lords.js
// "The lord of house A sits in house B" — 144 combinations.
//
// ⚠ AUTHORSHIP: Claude-authored from classical principles (BPHS bhavesha
// phala). Not reviewed by a practising astrologer — see houses.js.
//
// COMPOSED, NOT HAND-WRITTEN — and deliberately so. This is the one table in
// the corpus that is genuinely compositional in the tradition itself: the rule
// is "the matters of A are carried into B, and come through B's affairs".
// Classical texts state it that way rather than enumerating 144 verdicts.
// Hand-writing 144 near-identical paragraphs would have added bulk without
// adding meaning, and would have drifted out of sync with houses.js.
//
// What IS hand-written: the `OVERRIDES` below, for the combinations tradition
// names specifically (a lord in its own house, lords falling into dusthanas,
// the 6/8/12-from-itself rule). Those carry real information that composition
// cannot derive.
//
// Node-safe. Imports only sibling content data.

import { HOUSES, HOUSE_GROUPS, GROUP_NOTES } from './houses.js'

const groupOf = h =>
  HOUSE_GROUPS.trikona.includes(h) ? 'trikona'
  : HOUSE_GROUPS.kendra.includes(h) ? 'kendra'
  : HOUSE_GROUPS.dusthana.includes(h) ? 'dusthana'
  : HOUSE_GROUPS.upachaya.includes(h) ? 'upachaya'
  : null

/**
 * Combinations the tradition treats as special cases rather than as the
 * general "A's matters arrive through B" rule. Keyed `${from}-${to}`.
 */
const OVERRIDES = {
  // A lord in its own house — the bhava is self-supported.
  own: {
    beginner: (a) => `The lord of your ${ord(a)} house sits in its own house. ${cap(HOUSES[a].domain)} is self-supporting here — it does not depend on another area of life to work.`,
    practitioner: (a) => `${HOUSES[a].name}'s lord in its own bhava — svakshetra. The bhava is strengthened and self-referential; its matters neither borrow from nor leak into another house.`,
  },
  // 6th, 8th or 12th FROM the house it rules — classical weakening.
  from68_12: {
    beginner: (a, b, n) => `The lord of your ${ord(a)} house sits ${ord(n)} from its own house, which classically weakens it. The ${ord(a)} — ${HOUSES[a].domain} — tends to cost you something before it gives.`,
    practitioner: (a, b, n) => `${HOUSES[a].name}'s lord in the ${ord(n)} from its own bhava — a dusthana relative to itself. The bhava is undermined from within; its matters are subject to loss, delay or attrition.`,
  },
}

const ord = n => ['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th'][n] ?? `${n}th`
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
const kw = h => HOUSES[h].keywords.slice(0, 3).join(', ')

/**
 * Reading for "lord of `from` placed in `to`".
 * @returns {{ beginner, practitioner, special: string|null }}
 */
export function houseLordReading(from, to) {
  if (!HOUSES[from] || !HOUSES[to]) throw new Error(`houseLordReading: bad houses ${from}/${to}`)

  if (from === to) {
    return {
      beginner: OVERRIDES.own.beginner(from),
      practitioner: OVERRIDES.own.practitioner(from),
      special: 'own',
    }
  }

  // Distance of `to` counted FROM `from` (1-based).
  const dist = ((to - from + 12) % 12) + 1
  if ([6, 8, 12].includes(dist)) {
    return {
      beginner: OVERRIDES.from68_12.beginner(from, to, dist),
      practitioner: OVERRIDES.from68_12.practitioner(from, to, dist),
      special: 'weakened',
    }
  }

  const g = groupOf(to)
  const groupNote = g ? ` The ${ord(to)} is ${GROUP_NOTES[g]}.` : ''

  return {
    beginner: `The lord of your ${ord(from)} house sits in your ${ord(to)}. ` +
      `That ties ${HOUSES[from].domain} to ${HOUSES[to].domain} — ${kw(from)} tend to reach you through ${kw(to)}.`,
    practitioner: `${HOUSES[from].name}'s lord in ${HOUSES[to].name} (the ${ord(dist)} from its own bhava). ` +
      `The significations of the ${ord(from)} — ${kw(from)} — are routed through the ${ord(to)} and take its character.${groupNote}`,
    special: null,
  }
}

/** Every combination, for the exhaustiveness test. */
export function allHouseLordKeys() {
  const out = []
  for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) out.push(`${a}-${b}`)
  return out
}
