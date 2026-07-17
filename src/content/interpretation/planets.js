// src/content/interpretation/planets.js
// The nine grahas: nature, karaka roles, and what each one is reaching for.
//
// ⚠ AUTHORSHIP: Claude-authored from classical principles (BPHS graha guna &
// karakatva, Phaladeepika). Not reviewed by a practising astrologer — see the
// note in houses.js.
//
// Pure data — Node-safe, no imports.

export const PLANETS_CONTENT = {
  Sun: {
    sanskrit: 'Surya',
    nature: 'malefic',
    tone: 'hot, dry, sovereign',
    karaka: ['the father', 'the soul (atma)', 'authority', 'vitality', 'bone and eyesight'],
    drive: 'to be seen, to stand at the centre and be answerable for it',
    beginner: 'The Sun is your core — the part of you that wants to matter, take responsibility, and be recognised for it. It also shows your father.',
    practitioner: 'Atmakaraka in the naisargika scheme: soul, ego, and rajasic authority. A krura graha whose harshness is dignity rather than malice — it burns what it approaches (combustion) yet confers status.',
    citation: 'BPHS 3.12',
  },
  Moon: {
    sanskrit: 'Chandra',
    nature: 'benefic when waxing',
    tone: 'cool, moist, receptive',
    karaka: ['the mother', 'the mind (manas)', 'emotion', 'the public', 'fluids'],
    drive: 'to feel safe, to be held and to hold',
    beginner: 'The Moon is your mind and mood — how you feel things, what comforts you, and your relationship with your mother.',
    practitioner: 'Manas karaka and the chart\'s second lagna: most classical timing (Vimshottari, Tarabala, Chandra bala) is reckoned from it. Benefic when bright and waxing, weak and needy when dark or hemmed by malefics.',
    citation: 'BPHS 3.13',
  },
  Mars: {
    sanskrit: 'Mangala',
    nature: 'malefic',
    tone: 'hot, sharp, dry',
    karaka: ['siblings', 'courage', 'land', 'surgery and machinery', 'blood and muscle'],
    drive: 'to cut through, to win, to defend what is his',
    beginner: 'Mars is your drive and your temper — the part that fights, protects, and gets things moving when they stall.',
    practitioner: 'Bhratru karaka; a tikshna, pitta graha ruling parakrama and himsa. Its aspects (4th, 7th, 8th) are the widest of the true planets, so an ill-placed Mars reaches far.',
    citation: 'BPHS 3.14',
  },
  Mercury: {
    sanskrit: 'Budha',
    nature: 'neutral — takes the colour of its company',
    tone: 'mixed, dry, quick',
    karaka: ['speech', 'intellect', 'trade', 'nerves and skin', 'maternal uncle'],
    drive: 'to understand, to name, to exchange',
    beginner: 'Mercury is how you think and talk — quick, curious, good with words, numbers and deals. It takes on the character of whatever it sits with.',
    practitioner: 'Vak and buddhi karaka. Uniquely chameleonic: benefic alone or with benefics, malefic with malefics. Never far from the Sun, so combustion is a standing question rather than an event.',
    citation: 'BPHS 3.15',
  },
  Jupiter: {
    sanskrit: 'Guru / Brihaspati',
    nature: 'benefic',
    tone: 'warm, moist, expansive',
    karaka: ['children', 'the teacher', 'wealth', 'wisdom', 'the liver and fat'],
    drive: 'to expand, to bless, to make meaning',
    beginner: 'Jupiter is your sense of meaning and generosity — teachers, faith, children, and good fortune that seems to arrive rather than be earned.',
    practitioner: 'The greatest benefic; putra and dhana karaka. Its 5th and 9th aspects protect whatever they touch, and its presence in a bhava expands that bhava — for better, and occasionally for worse (bhava-karako bhavo nashaya).',
    citation: 'BPHS 3.16',
  },
  Venus: {
    sanskrit: 'Shukra',
    nature: 'benefic',
    tone: 'cool, moist, refined',
    karaka: ['the spouse', 'pleasure', 'art and beauty', 'vehicles', 'reproductive fluid'],
    drive: 'to enjoy, to harmonise, to be desired',
    beginner: 'Venus is what you love and how you love — pleasure, beauty, art, comfort, and your partner.',
    practitioner: 'Kalatra karaka and guru of the asuras: refinement, rasa, and appetite in one graha. Exalted in Pisces (surrender) and fallen in Virgo (analysis) — the axis tells you what Venus is for.',
    citation: 'BPHS 3.17',
  },
  Saturn: {
    sanskrit: 'Shani',
    nature: 'malefic',
    tone: 'cold, dry, slow',
    karaka: ['longevity', 'grief', 'labour', 'the poor and the old', 'nerves and teeth'],
    drive: 'to endure, to strip away, to make real',
    beginner: 'Saturn is time and consequence — delay, hard work, and the things that only come to you slowly and for real.',
    practitioner: 'Ayush karaka: the greatest malefic and the greatest teacher. Saturn does not deny so much as postpone until earned; its 3rd and 10th aspects grind whatever they fall on. Strong Saturn gives structure, weak Saturn gives fear.',
    citation: 'BPHS 3.18',
  },
  Rahu: {
    sanskrit: 'Rahu',
    nature: 'malefic (shadow)',
    tone: 'smoky, insatiable',
    karaka: ['obsession', 'foreignness', 'illusion', 'sudden rise', 'poison'],
    drive: 'to have what it was denied — without knowing when to stop',
    beginner: "Rahu is hunger: the thing you can't leave alone, that pulls you forward and can overshoot. It often shows what's foreign, unconventional or addictive.",
    practitioner: 'The north node — a chhaya graha with no body, acting through its dispositor and its house. Amplifies without discriminating; gives worldly rise in upachayas and confusion in trikonas. Kendra/trikona placements can behave as yogakaraka.',
    citation: 'BPHS 3.19',
  },
  Ketu: {
    sanskrit: 'Ketu',
    nature: 'malefic (shadow)',
    tone: 'smoky, detaching',
    karaka: ['liberation', 'doubt', 'past mastery', 'sudden loss', 'the flag'],
    drive: 'to let go of what it has already mastered',
    beginner: "Ketu is where you already know enough to walk away — a place of unusual skill and unusual indifference, where you may lose things without minding much.",
    practitioner: 'The south node — moksha karaka. Acts like Mars in temperament but subtracts where Rahu adds: it gives mastery and dissatisfaction in the same breath. Strong in the 12th, difficult in the 7th.',
    citation: 'BPHS 3.19',
  },
}

/** Natural benefics/malefics — used to colour a placement's tone. */
export const NATURAL_BENEFICS = ['Jupiter', 'Venus', 'Moon', 'Mercury']
export const NATURAL_MALEFICS = ['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu']
