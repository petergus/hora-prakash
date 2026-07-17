// src/content/interpretation/houses.js
// The twelve bhavas: what each house governs.
//
// ⚠ AUTHORSHIP: this corpus was written by Claude from classical Jyotish
// principles (BPHS bhava significations, Phaladeepika, Saravali). It is
// interpretive content, not computed output, and has NOT been reviewed by a
// practising astrologer. Treat it as a well-informed draft: correct in
// structure and vocabulary, but worth a domain expert's pass before it is
// presented to clients as authoritative.
//
// `domain` is the short chip label; `beginner`/`practitioner` are the depth
// dial's two registers. `keywords` feed the composed house-lord readings.
//
// Pure data — Node-safe, no imports.

export const HOUSES = {
  1: {
    name: 'Lagna / Tanu Bhava',
    domain: 'self, body, vitality',
    keywords: ['the body', 'temperament', 'vitality', 'how you meet the world'],
    beginner: 'The first house is you: your body, your health, and the way you come across before you say anything.',
    practitioner: 'Tanu bhava — the physical vehicle, constitution and svabhava. The lagna and its lord set the reference frame for every other bhava; their strength conditions the whole chart.',
    citation: 'BPHS 11.2',
  },
  2: {
    name: 'Dhana Bhava',
    domain: 'wealth, speech, family',
    keywords: ['accumulated wealth', 'speech', 'the family you were born into', 'food', 'what you value'],
    beginner: 'The second house holds what you gather and keep — money, possessions — and also your voice and your birth family.',
    practitioner: 'Dhana bhava — accumulated (not earned) wealth, vak (speech), kutumba (family of origin), and sustenance. A maraka house: it also governs the manner of decline.',
    citation: 'BPHS 11.3',
  },
  3: {
    name: 'Sahaja Bhava',
    domain: 'courage, siblings, effort',
    keywords: ['courage', 'younger siblings', 'self-effort', 'short journeys', 'hands and communication'],
    beginner: 'The third house is nerve and initiative — your courage, your own effort, and your younger siblings.',
    practitioner: 'Sahaja bhava — parakrama (valour born of effort), younger co-borns, the hands, short travel. An upachaya house: its matters improve with age and application.',
    citation: 'BPHS 11.4',
  },
  4: {
    name: 'Sukha Bhava',
    domain: 'home, mother, inner peace',
    keywords: ['the mother', 'home and land', 'vehicles', 'inner contentment', 'schooling'],
    beginner: 'The fourth house is where you feel safe: home, land, your mother, and the quiet contentment underneath everything.',
    practitioner: 'Sukha bhava — matru, land and immovables, vahana, and sukha itself (the felt sense of ease). The chatushtaya foundation; afflictions here unsettle the base of the chart.',
    citation: 'BPHS 11.5',
  },
  5: {
    name: 'Putra Bhava',
    domain: 'children, creativity, mind',
    keywords: ['children', 'creative intelligence', 'mantra and merit', 'romance', 'speculation'],
    beginner: 'The fifth house is what you create — children, art, ideas — and the flashes of intelligence that feel like they arrive rather than get worked out.',
    practitioner: 'Putra bhava — progeny, purva punya (merit carried in), buddhi and mantra siddhi. A trikona: a house of dharma and grace rather than effort.',
    citation: 'BPHS 11.6',
  },
  6: {
    name: 'Ripu Bhava',
    domain: 'illness, enemies, service',
    keywords: ['illness', 'enemies and debt', 'daily work', 'discipline', 'litigation'],
    beginner: 'The sixth house is friction: illness, debts, rivals — and the daily grind that grinds them down.',
    practitioner: 'Ripu/Shatru bhava — roga, rina, shatru; also seva and the capacity to fight. A dusthana yet an upachaya: malefics here strengthen with time and give victory over adversaries.',
    citation: 'BPHS 11.7',
  },
  7: {
    name: 'Kalatra Bhava',
    domain: 'partnership, marriage, others',
    keywords: ['spouse', 'business partners', 'contracts', 'the public', 'desire'],
    beginner: 'The seventh house is the other person — your partner in marriage or business, and how you meet people as equals.',
    practitioner: 'Kalatra bhava — spouse, partnership, trade, and kama. Directly opposite the lagna: it shows what you seek outside yourself. Also a maraka.',
    citation: 'BPHS 11.8',
  },
  8: {
    name: 'Randhra Bhava',
    domain: 'transformation, longevity, the hidden',
    keywords: ['longevity', 'crisis and rebirth', 'inheritance', 'occult research', "the spouse's wealth"],
    beginner: 'The eighth house is where things end so something else can begin — crises, inheritances, secrets, and the deep research that turns them over.',
    practitioner: 'Randhra bhava — ayush, sudden reversals, gupta vidya, and wealth received rather than earned. The most private house; benefics here often go quiet rather than fail.',
    citation: 'BPHS 11.9',
  },
  9: {
    name: 'Dharma Bhava',
    domain: 'belief, fortune, the teacher',
    keywords: ['fortune', 'father and guru', 'long journeys', 'belief', 'higher learning'],
    beginner: 'The ninth house is what you believe and what luck seems to hand you — teachers, long journeys, your father, faith.',
    practitioner: 'Dharma bhava — bhagya, pitru, guru, tirtha yatra. The strongest trikona; classical texts treat it as the single best house for grace and undeserved good.',
    citation: 'BPHS 11.10',
  },
  10: {
    name: 'Karma Bhava',
    domain: 'career, status, action',
    keywords: ['career', 'public standing', 'authority', 'what you do in the world'],
    beginner: 'The tenth house is your work in the world — your career, your standing, what people know you for.',
    practitioner: 'Karma bhava — vocation, rajya, and visible action. The strongest kendra and the point of maximum digbala for Sun and Mercury; it shows action, not merely employment.',
    citation: 'BPHS 11.11',
  },
  11: {
    name: 'Labha Bhava',
    domain: 'gains, networks, desires fulfilled',
    keywords: ['income', 'elder siblings', 'friends and networks', 'ambitions realised'],
    beginner: 'The eleventh house is what comes in — income, friends, networks, and the wishes that actually get fulfilled.',
    practitioner: 'Labha bhava — gains of every kind, elder co-borns, sangha. An upachaya, and the house of kama-purti; even malefics tend to deliver here.',
    citation: 'BPHS 11.12',
  },
  12: {
    name: 'Vyaya Bhava',
    domain: 'loss, retreat, liberation',
    keywords: ['expenditure', 'foreign lands', 'seclusion', 'the bed', 'moksha'],
    beginner: 'The twelfth house is what goes out — spending, letting go, time alone, distant places, and sleep.',
    practitioner: 'Vyaya bhava — expenditure, foreign residence, confinement, shayana sukha and moksha. Loss here is not only privation: it is also the release the chart needs.',
    citation: 'BPHS 11.13',
  },
}

/** Houses by classical grouping — used to qualify a placement's tone. */
export const HOUSE_GROUPS = {
  kendra:   [1, 4, 7, 10],   // angles — power to act
  trikona:  [1, 5, 9],       // trines — grace and dharma
  dusthana: [6, 8, 12],      // difficult houses
  upachaya: [3, 6, 10, 11],  // growing houses — improve with time
  maraka:   [2, 7],          // houses that can end things
}

export const GROUP_NOTES = {
  kendra:   'a kendra (angle) — a house of direct action, where a planet can visibly do something',
  trikona:  'a trikona (trine) — a house of grace, where results arrive more than they are forced',
  dusthana: 'a dusthana — a house of friction, where results come late, through difficulty, or in private',
  upachaya: 'an upachaya — a growing house, whose matters improve with age and effort',
}
