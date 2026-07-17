// src/core/gunamilan.js
// Ashta Koota (Guna Milan) — the classical 36-point marriage compatibility
// score from the two Moons — plus Mangal (Kuja) dosha detection with the
// common cancellation rules.
//
// Sources for the lookup tables:
//  - Yoni animals per nakshatra + 14×14 score matrix: Saravali/Muhurta
//    tradition (saravali.github.io/astrology/koota_yoni.html).
//  - Gana matrix (bride-gana rows): same source.
//  - Vashya groups (incl. the Sagittarius/Capricorn half-sign splits) and
//    matrix: the widely used Muhurta table (values 0/1/1.5/2; note that some
//    software uses a 0.5 variant for a few cells — differences are minor).
//  - Tara/Bhakoota/Nadi/Varna/Graha-Maitri: standard rules, uncontested.
//
// Pure and Node-safe. Directional kootas treat the arguments as (girl, boy).

const norm = lon => ((lon % 360) + 360) % 360
const signOf = lon => Math.floor(norm(lon) / 30) + 1
const nakOf  = lon => Math.floor(norm(lon) / (360 / 27))

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const NAKSHATRA_NAMES = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta',
  'Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati',
]
const SIGN_LORDS = ['Mars','Venus','Mercury','Moon','Sun','Mercury',
                    'Venus','Mars','Jupiter','Saturn','Saturn','Jupiter']

// ── Varna (1) ────────────────────────────────────────────────────────────────
// Water signs Brahmin, fire Kshatriya, earth Vaishya, air Shudra.
const VARNA_BY_SIGN = ['Kshatriya','Vaishya','Shudra','Brahmin','Kshatriya','Vaishya',
                       'Shudra','Brahmin','Kshatriya','Vaishya','Shudra','Brahmin']
const VARNA_RANK = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 }

// ── Vashya (2) ───────────────────────────────────────────────────────────────
// Chatushpada (quadruped), Manava (human), Jalachara (water), Vanachara (wild), Keeta (insect)
function vashyaOf(sign, degree) {
  switch (sign) {
    case 1: case 2: return 'Chatushpada'
    case 3: case 6: case 7: case 11: return 'Manava'
    case 4: case 12: return 'Jalachara'
    case 5: return 'Vanachara'
    case 8: return 'Keeta'
    case 9:  return degree < 15 ? 'Manava' : 'Chatushpada'      // Sagittarius halves
    case 10: return degree < 15 ? 'Chatushpada' : 'Jalachara'    // Capricorn halves
    default: return 'Manava'
  }
}
// rows = boy's group, cols = girl's group
const VASHYA_ORDER = ['Chatushpada','Manava','Jalachara','Vanachara','Keeta']
const VASHYA_MATRIX = [
  //         Chat  Man  Jal  Van  Keeta   (girl →)
  /*Chat*/  [2,    1,   1,   1.5, 1],
  /*Man*/   [1,    2,   1.5, 0,   1],
  /*Jal*/   [1,    1.5, 2,   1,   1],
  /*Van*/   [0,    0,   0,   2,   0],
  /*Keeta*/ [1,    1,   1,   0,   2],
]

// ── Tara (3) ─────────────────────────────────────────────────────────────────
// Count from one nakshatra to the other (inclusive) mod 9; remainders
// 3 (Vipat), 5 (Pratyari), 7 (Vadha) are inauspicious.
function taraBenefic(fromNak, toNak) {
  const count = ((toNak - fromNak + 27) % 27) + 1
  const r = count % 9
  return !(r === 3 || r === 5 || r === 7)
}

// ── Yoni (4) ─────────────────────────────────────────────────────────────────
const YONI_ORDER = ['Horse','Elephant','Sheep','Serpent','Dog','Cat','Rat',
                    'Cow','Buffalo','Tiger','Deer','Monkey','Mongoose','Lion']
// Yoni per nakshatra index 0–26
const YONI_BY_NAK = [
  'Horse','Elephant','Sheep','Serpent','Serpent','Dog',
  'Cat','Sheep','Cat','Rat','Rat','Cow',
  'Buffalo','Tiger','Buffalo','Tiger','Deer','Deer',
  'Dog','Monkey','Mongoose','Monkey','Lion',
  'Horse','Lion','Cow','Elephant',
]
// Symmetric 14×14 (Saravali): same 4 … sworn enemies 0
const YONI_MATRIX = [
  // Ho El Sh Se Do Ca Ra Co Bu Ti De Mo Mg Li
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1], // Horse
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0], // Elephant
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1], // Sheep
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2], // Serpent
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1], // Dog
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1], // Cat
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2], // Rat
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1], // Cow
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1], // Buffalo
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1], // Tiger
  [1, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1], // Deer
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2], // Monkey
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2], // Mongoose
  [1, 0, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 4], // Lion
]

// ── Graha Maitri (5) ─────────────────────────────────────────────────────────
// Natural friendship between the two Moon-sign lords, both directions.
const NATURAL = {
  Sun:     { friends: ['Moon','Mars','Jupiter'],   enemies: ['Venus','Saturn'] },
  Moon:    { friends: ['Sun','Mercury'],           enemies: [] },
  Mars:    { friends: ['Sun','Moon','Jupiter'],    enemies: ['Mercury'] },
  Mercury: { friends: ['Sun','Venus'],             enemies: ['Moon'] },
  Jupiter: { friends: ['Sun','Moon','Mars'],       enemies: ['Mercury','Venus'] },
  Venus:   { friends: ['Mercury','Saturn'],        enemies: ['Sun','Moon'] },
  Saturn:  { friends: ['Mercury','Venus'],         enemies: ['Sun','Moon','Mars'] },
}
function relation(a, b) {
  if (a === b) return 'friend'
  const n = NATURAL[a]
  if (n.friends.includes(b)) return 'friend'
  if (n.enemies.includes(b)) return 'enemy'
  return 'neutral'
}
function maitriScore(lordA, lordB) {
  const r1 = relation(lordA, lordB), r2 = relation(lordB, lordA)
  const pair = [r1, r2].sort().join('/')
  return {
    'friend/friend':   5,
    'friend/neutral':  4,
    'neutral/neutral': 3,
    'enemy/friend':    1,
    'enemy/neutral':   0.5,
    'enemy/enemy':     0,
  }[pair] ?? 3
}

// ── Gana (6) ─────────────────────────────────────────────────────────────────
const GANA_BY_NAK = [
  'Deva','Manushya','Rakshasa','Manushya','Deva','Manushya',
  'Deva','Deva','Rakshasa','Rakshasa','Manushya','Manushya',
  'Deva','Rakshasa','Deva','Rakshasa','Deva','Rakshasa',
  'Rakshasa','Manushya','Manushya','Deva','Rakshasa',
  'Rakshasa','Manushya','Manushya','Deva',
]
// GANA_MATRIX[girl][boy]
const GANA_ORDER = ['Deva','Manushya','Rakshasa']
const GANA_MATRIX = [
  // boy:  Deva Man  Rak    (girl ↓)
  [6, 6, 0], // girl Deva
  [5, 6, 0], // girl Manushya
  [1, 0, 6], // girl Rakshasa
]

// ── Nadi (8) ─────────────────────────────────────────────────────────────────
// Zigzag Adi/Madhya/Antya cycle across the 27 nakshatras.
const NADI_BY_NAK = [
  'Adi','Madhya','Antya','Antya','Madhya','Adi',
  'Adi','Madhya','Antya','Antya','Madhya','Adi',
  'Adi','Madhya','Antya','Antya','Madhya','Adi',
  'Adi','Madhya','Antya','Antya','Madhya','Adi',
  'Adi','Madhya','Antya',
]

/**
 * Ashta Koota match between two Moons.
 * @param {{ moonLon: number, name?: string }} girl sidereal Moon longitude
 * @param {{ moonLon: number, name?: string }} boy
 * @returns {{ total, max, kootas: [{key,name,max,points,girl,boy,note}], verdict }}
 */
export function calcGunaMilan(girl, boy) {
  const g = { sign: signOf(girl.moonLon), deg: norm(girl.moonLon) % 30, nak: nakOf(girl.moonLon) }
  const b = { sign: signOf(boy.moonLon),  deg: norm(boy.moonLon) % 30,  nak: nakOf(boy.moonLon) }

  const kootas = []

  // 1 · Varna — boy's varna should not be lower than the girl's
  const vG = VARNA_BY_SIGN[g.sign - 1], vB = VARNA_BY_SIGN[b.sign - 1]
  kootas.push({
    key: 'varna', name: 'Varna', max: 1,
    points: VARNA_RANK[vB] >= VARNA_RANK[vG] ? 1 : 0,
    girl: vG, boy: vB, note: 'work & temperament class of the Moon sign',
  })

  // 2 · Vashya — mutual control/amenability of the Moon-sign groups
  const wG = vashyaOf(g.sign, g.deg), wB = vashyaOf(b.sign, b.deg)
  kootas.push({
    key: 'vashya', name: 'Vashya', max: 2,
    points: VASHYA_MATRIX[VASHYA_ORDER.indexOf(wB)][VASHYA_ORDER.indexOf(wG)],
    girl: wG, boy: wB, note: 'mutual influence between the sign-groups',
  })

  // 3 · Tara — nakshatra count in both directions; 3/5/7 remainders afflict
  const t1 = taraBenefic(g.nak, b.nak), t2 = taraBenefic(b.nak, g.nak)
  kootas.push({
    key: 'tara', name: 'Tara', max: 3,
    points: t1 && t2 ? 3 : (t1 || t2 ? 1.5 : 0),
    girl: NAKSHATRA_NAMES[g.nak], boy: NAKSHATRA_NAMES[b.nak],
    note: 'birth-star compatibility (health & fortune)',
  })

  // 4 · Yoni — instinctive/physical match of the nakshatra animals
  const yG = YONI_BY_NAK[g.nak], yB = YONI_BY_NAK[b.nak]
  kootas.push({
    key: 'yoni', name: 'Yoni', max: 4,
    points: YONI_MATRIX[YONI_ORDER.indexOf(yB)][YONI_ORDER.indexOf(yG)],
    girl: yG, boy: yB, note: 'instinctive compatibility of the yoni animals',
  })

  // 5 · Graha Maitri — friendship of the Moon-sign lords
  const lG = SIGN_LORDS[g.sign - 1], lB = SIGN_LORDS[b.sign - 1]
  kootas.push({
    key: 'maitri', name: 'Graha Maitri', max: 5,
    points: maitriScore(lG, lB),
    girl: lG, boy: lB, note: 'mental rapport via the Moon-lords’ friendship',
  })

  // 6 · Gana — temperament class of the nakshatras
  const gG = GANA_BY_NAK[g.nak], gB = GANA_BY_NAK[b.nak]
  kootas.push({
    key: 'gana', name: 'Gana', max: 6,
    points: GANA_MATRIX[GANA_ORDER.indexOf(gG)][GANA_ORDER.indexOf(gB)],
    girl: gG, boy: gB, note: 'Deva / Manushya / Rakshasa temperament',
  })

  // 7 · Bhakoota — mutual Moon-sign distance; 2/12, 5/9, 6/8 afflict
  const d1 = ((b.sign - g.sign + 12) % 12) + 1
  const d2 = ((g.sign - b.sign + 12) % 12) + 1
  const badBhakoota = (Math.min(d1, d2) === 2 && Math.max(d1, d2) === 12)
    || (Math.min(d1, d2) === 5 && Math.max(d1, d2) === 9)
    || (Math.min(d1, d2) === 6 && Math.max(d1, d2) === 8)
  kootas.push({
    key: 'bhakoota', name: 'Bhakoota', max: 7,
    points: badBhakoota ? 0 : 7,
    girl: SIGN_NAMES[g.sign - 1], boy: SIGN_NAMES[b.sign - 1],
    note: `Moon signs ${d1}/${d2} apart${badBhakoota ? ' — dvirdvadasha/navapanchama/shadashtaka' : ''}`,
  })

  // 8 · Nadi — same nadi is the classical veto (Nadi dosha)
  const nG = NADI_BY_NAK[g.nak], nB = NADI_BY_NAK[b.nak]
  kootas.push({
    key: 'nadi', name: 'Nadi', max: 8,
    points: nG === nB ? 0 : 8,
    girl: nG, boy: nB,
    note: nG === nB ? 'Nadi dosha — same nadi' : 'different nadis',
  })

  const total = kootas.reduce((s, k) => s + k.points, 0)
  const verdict = total >= 33 ? 'Excellent match'
    : total >= 25 ? 'Very good match'
    : total >= 18 ? 'Acceptable match'
    : 'Not recommended (below 18)'

  return { total, max: 36, kootas, verdict }
}

// ── Mangal (Kuja) dosha ──────────────────────────────────────────────────────

const MANGAL_HOUSES = [1, 2, 4, 7, 8, 12]

/**
 * Mangal dosha for one chart (whole-sign, checked from Lagna and Moon).
 * @param {object[]} planets natal planets (needs Mars, Moon, Jupiter)
 * @param {number} lagnaSign 1–12
 * @returns {{ present, afflictions: [{from, house}], cancellations: string[], effective }}
 */
export function calcMangalDosha(planets, lagnaSign) {
  const mars = planets.find(p => p.name === 'Mars')
  const moon = planets.find(p => p.name === 'Moon')
  const jup  = planets.find(p => p.name === 'Jupiter')
  if (!mars) return { present: false, afflictions: [], cancellations: [], effective: false }

  const afflictions = []
  const houseFrom = ref => ((mars.sign - ref + 12) % 12) + 1
  if (MANGAL_HOUSES.includes(houseFrom(lagnaSign))) afflictions.push({ from: 'Lagna', house: houseFrom(lagnaSign) })
  if (moon && MANGAL_HOUSES.includes(houseFrom(moon.sign))) afflictions.push({ from: 'Moon', house: houseFrom(moon.sign) })

  const cancellations = []
  if (afflictions.length) {
    if ([1, 8].includes(mars.sign)) cancellations.push('Mars in own sign (Aries/Scorpio)')
    if (mars.sign === 10) cancellations.push('Mars exalted (Capricorn)')
    if (jup) {
      const jupAspects = [jup.sign, ((jup.sign + 4 - 1) % 12) + 1, ((jup.sign + 6 - 1) % 12) + 1, ((jup.sign + 8 - 1) % 12) + 1]
      if (jupAspects.includes(mars.sign)) cancellations.push('Mars conjunct or aspected by Jupiter')
    }
  }

  const present = afflictions.length > 0
  return { present, afflictions, cancellations, effective: present && cancellations.length === 0 }
}

/**
 * Match-level Mangal dosha comparison: both-manglik is the classic mutual
 * cancellation.
 */
export function mangalDoshaMatch(girlDosha, boyDosha) {
  const gEff = girlDosha?.effective ?? false
  const bEff = boyDosha?.effective ?? false
  if (gEff && bEff) return { verdict: 'cancelled', afflictedSide: 'both', note: 'Both are Manglik — the dosha mutually cancels.' }
  if (gEff || bEff)  return { verdict: 'one-sided', afflictedSide: gEff ? 'girl' : 'boy', note: 'One side carries an uncancelled Mangal dosha.' }
  return { verdict: 'clear', afflictedSide: null, note: 'No effective Mangal dosha on either side.' }
}
