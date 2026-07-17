// src/content/interpretation/yoga-meanings.js
// What each detected yoga MEANS. `src/core/yogas.js` already emits a factual
// derivation ("Jupiter in a kendra from the Moon…"); this supplies the reading.
//
// ⚠ AUTHORSHIP: Claude-authored from classical principles (BPHS yoga-adhyaya,
// Phaladeepika). Not reviewed by a practising astrologer — see houses.js.
//
// ⚠ KEYED BY FAMILY, NOT BY KEY. yogas.js builds several keys from templates
// (`raj-${pair}`, `mahapurusha-${planet}`, `dhana-${pair}`, `parivartana-${x}`,
// `vipreet-${house}`, `neecha-bhanga-${planet}`, `debilitated-${planet}`,
// `amala-${planet}`), so an exact-key map would miss every templated one.
// `yogaFamily()` below reduces a key to its family; the test asserts that every
// yoga detectYogas can emit resolves to a meaning.
//
// Pure data — Node-safe, no imports.

export const YOGA_MEANINGS = {
  // Pancha Mahapurusha — one per planet, so the family carries the planet.
  'mahapurusha-mars': {
    title: 'Ruchaka Yoga',
    beginner: 'A "great person" combination formed by Mars. It gives physical courage, command, and a reputation for getting difficult things done.',
    practitioner: 'Ruchaka: Mars in own/exaltation sign in a kendra. Gives martial bearing, leadership, technical or military capacity. Strongest when Mars also holds dignity beyond the mahapurusha condition.',
  },
  'mahapurusha-mercury': {
    title: 'Bhadra Yoga',
    beginner: 'A "great person" combination formed by Mercury. Sharp intellect, persuasive speech, and a mind others rely on.',
    practitioner: 'Bhadra: Mercury in own/exaltation in a kendra. Gives scholarship, eloquence, commercial acumen and a youthful constitution.',
  },
  'mahapurusha-jupiter': {
    title: 'Hamsa Yoga',
    beginner: 'A "great person" combination formed by Jupiter. Wisdom, moral standing, and the kind of good fortune others notice.',
    practitioner: 'Hamsa: Jupiter in own/exaltation in a kendra. Gives dharmic authority, learning, respect and protection across the chart.',
  },
  'mahapurusha-venus': {
    title: 'Malavya Yoga',
    beginner: 'A "great person" combination formed by Venus. Beauty, comfort, artistic gift, and a life with pleasure in it.',
    practitioner: 'Malavya: Venus in own/exaltation in a kendra. Gives refinement, vehicles, luxury, artistic distinction and marital happiness.',
  },
  'mahapurusha-saturn': {
    title: 'Sasa Yoga',
    beginner: 'A "great person" combination formed by Saturn. Authority built slowly and held for a long time.',
    practitioner: 'Sasa: Saturn in own/exaltation in a kendra. Gives durable power, command over labour and organisations, late but lasting eminence.',
  },

  'gaja-kesari': {
    title: 'Gaja-Kesari Yoga',
    beginner: 'Jupiter supporting the Moon — "elephant and lion". It steadies the mind and lends a lasting good reputation.',
    practitioner: 'Jupiter in a kendra from the Moon. Gives intelligence, moral standing and enduring fame. Its strength depends on both planets\' dignity — the mere angle is not enough.',
  },
  'budhaditya': {
    title: 'Budhaditya Yoga',
    beginner: 'Sun and Mercury together — a bright, articulate intelligence and a knack for being understood.',
    practitioner: 'Sun–Mercury conjunction. Gives intellect, administrative skill and communication. ⚠ Check combustion: Mercury within the Sun\'s orb is burnt, and the yoga weakens accordingly.',
  },
  'chandra-mangala': {
    title: 'Chandra-Mangala Yoga',
    beginner: 'Moon with Mars — an earning combination. Drive attached to feeling; money made through initiative.',
    practitioner: 'Moon–Mars conjunction or mutual aspect. Gives wealth through enterprise and a forceful emotional nature; classically noted for gain through less-than-gentle means.',
  },
  raj: {
    title: 'Raj Yoga',
    beginner: 'A power combination: the lords of an angle and a trine joined. It lifts your standing in the world.',
    practitioner: 'Kendra–trikona lord relation (conjunction, exchange or mutual aspect). The core rajayoga of Parashara. Its yield depends on the participating lords\' strength and whether a dasha of either actually runs in life.',
  },
  dhana: {
    title: 'Dhana Yoga',
    beginner: 'A wealth combination — the lords of money houses working together. Income tends to find a channel.',
    practitioner: 'Relation between dhana-house lords (2/5/9/11). Gives accumulation; realised in the dasha of a participating lord, and limited by their dignity.',
  },
  parivartana: {
    title: 'Parivartana Yoga (exchange)',
    beginner: 'Two planets have swapped houses, so the two areas of life are permanently tied together — each depends on the other.',
    practitioner: 'Mutual exchange of signs. Binds the two bhavas: results of one arrive through the other. Maha (kendra/trikona) exchanges elevate; dainya (dusthana) exchanges entangle.',
  },
  vipreet: {
    title: 'Vipreet Raj Yoga',
    beginner: 'A difficulty that turns into an advantage — trouble in one area quietly produces success in another.',
    practitioner: 'A dusthana lord in another dusthana (Harsha 6th, Sarala 8th, Vimala 12th). "Harm to harm" cancels: gives rise through adversity, often after a visible setback.',
  },
  'neecha-bhanga': {
    title: 'Neecha Bhanga Raj Yoga',
    beginner: 'A weak planet gets rescued. What looked like a flaw becomes a source of strength — often after a struggle with exactly that thing.',
    practitioner: 'Cancellation of debilitation (dispositor or exaltation-lord in a kendra from lagna/Moon, etc.). Classical opinion varies on the conditions; the rise is real but generally follows a period of the deficit being lived out.',
  },
  debilitated: {
    title: 'Debilitated planet',
    beginner: 'This planet is in its weakest sign. Its matters take more work, and often mature late rather than never.',
    practitioner: 'Neecha graha. The significations are impaired, not abolished; check for neecha bhanga, the dispositor\'s strength and Shadbala before reading it as failure.',
  },
  sunapha: {
    title: 'Sunapha Yoga',
    beginner: 'Planets supporting the Moon from behind — self-earned wealth and a steady, resourceful mind.',
    practitioner: 'Planets (excluding the Sun) in the 2nd from the Moon. Gives self-acquired wealth, intelligence and standing; the yielding planet colours the result.',
  },
  anapha: {
    title: 'Anapha Yoga',
    beginner: 'Planets supporting the Moon from in front — a well-regarded character and physical ease.',
    practitioner: 'Planets (excluding the Sun) in the 12th from the Moon. Gives good health, reputation and a well-formed temperament; renunciate leanings if malefics form it.',
  },
  durudhara: {
    title: 'Durudhara Yoga',
    beginner: 'The Moon is supported on both sides — resources, vehicles and a mind that is not left exposed.',
    practitioner: 'Planets in both the 2nd and 12th from the Moon. Gives wealth, conveyance and generosity; the strongest of the Moon\'s three protective yogas.',
  },
  kemadruma: {
    title: 'Kemadruma Yoga',
    beginner: 'The Moon stands alone with nothing beside it — a mind without a buffer. Emotional isolation, and support that arrives late.',
    practitioner: 'No planets in the 2nd or 12th from the Moon (Sun excepted). Gives isolation and struggle; widely over-read — check the many cancellations before giving it weight.',
  },
  'kemadruma-cancelled': {
    title: 'Kemadruma Yoga (cancelled)',
    beginner: 'The isolating Moon combination is present but broken by a supporting placement — so read it as a caution rather than a verdict.',
    practitioner: 'Kemadruma with a classical bhanga (benefic in a kendra from lagna/Moon, Moon in a kendra, etc.). The affliction is annulled; a residual sensitivity often remains.',
  },
  amala: {
    title: 'Amala Yoga',
    beginner: '"Spotless" — a benefic sitting at the top of your chart. It gives a clean reputation that tends to survive things.',
    practitioner: 'A natural benefic in the 10th from lagna or Moon. Gives lasting good name, charitable standing and an unblemished career record.',
  },
  'kala-sarpa': {
    title: 'Kala Sarpa Yoga',
    beginner: 'Every planet sits between Rahu and Ketu — life feels channelled along one track, with a strong pull and little sideways room.',
    practitioner: 'All grahas hemmed within the nodal axis. Modern rather than classical in origin and frequently overstated; read it as intensification and a narrowed field, not a curse. Effects modulate by which half the planets occupy.',
  },
}

/** Yoga key → meaning family. Handles yogas.js's templated keys. */
export function yogaFamily(key) {
  if (!key) return null
  if (YOGA_MEANINGS[key]) return key                     // exact (incl. mahapurusha-*)
  const prefixes = ['raj', 'dhana', 'parivartana', 'vipreet', 'neecha-bhanga', 'debilitated', 'amala']
  for (const p of prefixes) {
    if (key === p || key.startsWith(p + '-')) return p
  }
  return null
}

export function yogaMeaning(key) {
  const fam = yogaFamily(key)
  return fam ? YOGA_MEANINGS[fam] : null
}
