// src/content/muhurta-activities.js
// Activity presets for the Muhurta (electional) finder.
//
// Rather than hard-coding an opaque "good nakshatras" list per activity, the
// presets lean on the classical **nakshatra nature** classification (Muhurta
// Chintamani / Kalaprakasika), which is what the traditional rules are derived
// from. Each activity declares the natures it wants, plus an explicit
// `prefer`/`avoid` list for the cases tradition names directly.
//
// Nakshatra indices are 0-based (0 = Ashwini … 26 = Revati), matching
// `getNakshatraInfo().index`.
//
// Pure data — Node-safe, no imports.

/**
 * The seven classical natures. Counts: 4+5+3+5+4+4+2 = 27.
 *  dhruva  (fixed/permanent) — lasting undertakings: marriage, building, planting
 *  chara   (movable)         — travel, vehicles, anything meant to move
 *  kshipra (swift/light)     — quick results: trade, medicine, learning
 *  mridu   (soft/tender)     — art, friendship, clothes, celebrations
 *  ugra    (fierce)          — demolition, confrontation; avoided for auspicious acts
 *  tikshna (sharp/dreadful)  — surgery, incisive or severing acts
 *  mishra  (mixed)           — mixed results
 */
export const NAKSHATRA_NATURE = [
  'kshipra', // 0  Ashwini
  'ugra',    // 1  Bharani
  'mishra',  // 2  Krittika
  'dhruva',  // 3  Rohini
  'mridu',   // 4  Mrigashira
  'tikshna', // 5  Ardra
  'chara',   // 6  Punarvasu
  'kshipra', // 7  Pushya
  'tikshna', // 8  Ashlesha
  'ugra',    // 9  Magha
  'ugra',    // 10 Purva Phalguni
  'dhruva',  // 11 Uttara Phalguni
  'kshipra', // 12 Hasta
  'mridu',   // 13 Chitra
  'chara',   // 14 Swati
  'mishra',  // 15 Vishakha
  'mridu',   // 16 Anuradha
  'tikshna', // 17 Jyeshtha
  'tikshna', // 18 Mula
  'ugra',    // 19 Purva Ashadha
  'dhruva',  // 20 Uttara Ashadha
  'chara',   // 21 Shravana
  'chara',   // 22 Dhanishta
  'chara',   // 23 Shatabhisha
  'ugra',    // 24 Purva Bhadrapada
  'dhruva',  // 25 Uttara Bhadrapada
  'mridu',   // 26 Revati
]

export const NATURE_LABELS = {
  dhruva:  'Dhruva (fixed)',
  chara:   'Chara (movable)',
  kshipra: 'Kshipra (swift)',
  mridu:   'Mridu (soft)',
  ugra:    'Ugra (fierce)',
  tikshna: 'Tikshna (sharp)',
  mishra:  'Mishra (mixed)',
}

// Weekday indices: 0 = Sunday … 6 = Saturday.
export const ACTIVITIES = {
  marriage: {
    label: 'Marriage / engagement',
    natures: ['dhruva', 'mridu', 'chara'],
    prefer: [3, 4, 9, 11, 12, 14, 16, 18, 20, 25, 26], // classical vivaha nakshatras
    avoid:  [1, 2, 5, 8, 9, 10, 17, 19, 24],           // Bharani/Krittika/Ardra/Ashlesha/…
    varas:  [1, 3, 4, 5],                              // Mon, Wed, Thu, Fri
    avoidVaras: [2, 0],                                // Tue, Sun
    lagnaSigns: [2, 3, 6, 7, 9, 12],                   // Ta, Ge, Vi, Li, Sg, Pi (fixed/dual favoured)
    note: 'Fixed (dhruva) and soft (mridu) stars for a lasting bond; Ugra stars and Tuesday are traditionally rejected.',
  },
  travel: {
    label: 'Travel / journey',
    natures: ['chara', 'kshipra', 'mridu'],
    prefer: [0, 4, 6, 7, 12, 16, 21, 22, 26],
    avoid:  [2, 5, 8, 9, 15, 17, 18],
    varas:  [1, 3, 4, 5],
    avoidVaras: [2, 6],                                // Tue, Sat — traditionally poor for departure
    lagnaSigns: [1, 3, 4, 7, 9, 10],
    note: 'Movable (chara) and swift (kshipra) stars carry motion; Tuesday and Saturday departures are avoided.',
  },
  contract: {
    label: 'Contract / business deal',
    natures: ['dhruva', 'kshipra', 'chara'],
    prefer: [0, 3, 4, 7, 11, 12, 13, 16, 20, 21, 22, 25, 26],
    avoid:  [1, 5, 8, 9, 17, 18, 24],
    varas:  [1, 3, 4, 5],
    avoidVaras: [6],
    lagnaSigns: [2, 5, 8, 11],                         // fixed signs — durable agreements
    note: 'Fixed stars and fixed lagnas for durable agreements; Mercury/Jupiter days favour negotiation.',
  },
  medical: {
    label: 'Surgery / medical procedure',
    natures: ['tikshna', 'kshipra'],
    prefer: [0, 5, 7, 8, 12, 17, 18, 23],              // sharp/swift stars suit incisive acts
    avoid:  [3, 11, 20, 25],                           // dhruva stars — do not "fix" an illness
    varas:  [2, 6],                                    // Mars/Saturn days are accepted here
    avoidVaras: [1],                                   // Monday (watery, Moon) avoided for surgery
    lagnaSigns: [1, 5, 8, 9],
    note: 'One of the few acts where sharp (tikshna) stars are wanted; fixed stars are avoided so the condition does not become permanent. Avoid the nakshatra ruling the afflicted body part.',
  },
  launch: {
    label: 'Business launch / new venture',
    natures: ['dhruva', 'kshipra', 'chara'],
    prefer: [0, 3, 4, 7, 11, 12, 13, 16, 20, 21, 22, 26],
    avoid:  [1, 5, 8, 9, 10, 17, 18, 19, 24],
    varas:  [1, 3, 4, 5],
    avoidVaras: [0, 6],
    lagnaSigns: [2, 5, 8, 11],
    note: 'Fixed stars and a fixed lagna give the venture roots; Ugra and Tikshna stars are rejected.',
  },
  education: {
    label: 'Education / start of study',
    natures: ['kshipra', 'mridu', 'dhruva', 'chara'],
    prefer: [0, 3, 4, 6, 7, 11, 12, 13, 14, 16, 20, 21, 22, 23, 26],
    avoid:  [1, 5, 8, 9, 10, 17, 18, 19, 24],
    varas:  [1, 3, 4, 5],
    avoidVaras: [0, 2, 6],
    lagnaSigns: [3, 6, 9, 12],                         // dual signs — learning, plurality
    note: 'Vidyarambha favours Mercury/Jupiter days and swift or soft stars; dual lagnas suit study.',
  },
  property: {
    label: 'Property / moving house',
    natures: ['dhruva', 'mridu', 'chara'],
    prefer: [3, 4, 11, 12, 13, 16, 20, 21, 22, 25, 26],
    avoid:  [1, 5, 8, 9, 10, 17, 18, 19, 24],
    varas:  [1, 3, 4, 5],
    avoidVaras: [0, 2],
    lagnaSigns: [2, 5, 8, 11],
    note: 'Griha Pravesha wants fixed (dhruva) stars and a fixed lagna for permanence.',
  },
}

export const ACTIVITY_OPTIONS = Object.entries(ACTIVITIES)
  .map(([value, a]) => ({ value, label: a.label }))
