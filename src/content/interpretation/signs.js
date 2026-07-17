// src/content/interpretation/signs.js
// The twelve rashis: temperament, element/modality, and what a planet's
// expression looks like when it stands here.
//
// ⚠ AUTHORSHIP: Claude-authored from classical principles (BPHS rashi
// svarupa, Phaladeepika). Not reviewed by a practising astrologer — see the
// note in houses.js.
//
// Pure data — Node-safe, no imports.

export const SIGNS = {
  1: {
    name: 'Aries', sanskrit: 'Mesha', lord: 'Mars',
    element: 'fire', mode: 'movable', gender: 'male',
    tone: 'direct, impatient, first',
    beginner: 'Aries acts first and asks later — direct, competitive, quick to start and quick to bore.',
    practitioner: 'Chara agni rashi ruled by Mars; the Sun\'s exaltation. Gives initiative and heat, little patience for maintenance. A planet here begins things.',
  },
  2: {
    name: 'Taurus', sanskrit: 'Vrishabha', lord: 'Venus',
    element: 'earth', mode: 'fixed', gender: 'female',
    tone: 'steady, sensual, immovable',
    beginner: 'Taurus builds slowly and holds on — comfort-loving, patient, and very hard to shift once settled.',
    practitioner: 'Sthira prithvi rashi ruled by Venus; the Moon\'s exaltation. Gives endurance, appetite and obstinacy. A planet here consolidates.',
  },
  3: {
    name: 'Gemini', sanskrit: 'Mithuna', lord: 'Mercury',
    element: 'air', mode: 'dual', gender: 'male',
    tone: 'quick, plural, verbal',
    beginner: 'Gemini talks, connects and switches — curious, clever, and comfortable holding two ideas at once.',
    practitioner: 'Dvisvabhava vayu rashi ruled by Mercury. Gives plurality and articulation, scatters what needs depth. A planet here communicates and divides its attention.',
  },
  4: {
    name: 'Cancer', sanskrit: 'Karka', lord: 'Moon',
    element: 'water', mode: 'movable', gender: 'female',
    tone: 'protective, tidal, retentive',
    beginner: 'Cancer feels everything and protects what it loves — nurturing, moody, with a long memory for hurt.',
    practitioner: 'Chara jala rashi ruled by the Moon; Jupiter\'s exaltation. Gives feeling, attachment and shelter. A planet here becomes personal and defensive.',
  },
  5: {
    name: 'Leo', sanskrit: 'Simha', lord: 'Sun',
    element: 'fire', mode: 'fixed', gender: 'male',
    tone: 'proud, warm, sovereign',
    beginner: 'Leo needs to be seen and to be generous about it — dignified, loyal, and wounded by being ignored.',
    practitioner: 'Sthira agni rashi ruled by the Sun; the only sign with no exaltation. Gives dignity, display and fixity of will. A planet here takes the stage.',
  },
  6: {
    name: 'Virgo', sanskrit: 'Kanya', lord: 'Mercury',
    element: 'earth', mode: 'dual', gender: 'female',
    tone: 'precise, corrective, useful',
    beginner: 'Virgo notices what is wrong and fixes it — careful, useful, and prone to worry about detail.',
    practitioner: 'Dvisvabhava prithvi rashi, Mercury\'s own and exaltation, Venus\'s fall. Gives discrimination and service; refuses the surrender Venus wants. A planet here analyses.',
  },
  7: {
    name: 'Libra', sanskrit: 'Tula', lord: 'Venus',
    element: 'air', mode: 'movable', gender: 'male',
    tone: 'weighing, relational, fair',
    beginner: 'Libra weighs and balances — sociable, fair-minded, and reluctant to commit until both sides are heard.',
    practitioner: 'Chara vayu rashi ruled by Venus; Saturn\'s exaltation and the Sun\'s fall. The only inanimate sign: it measures. A planet here negotiates.',
  },
  8: {
    name: 'Scorpio', sanskrit: 'Vrishchika', lord: 'Mars',
    element: 'water', mode: 'fixed', gender: 'female',
    tone: 'intense, hidden, penetrating',
    beginner: 'Scorpio goes deep and keeps it to itself — intense, private, and unwilling to let go.',
    practitioner: 'Sthira jala rashi ruled by Mars; the Moon\'s fall. Gives depth, secrecy and research; the Moon\'s debilitation here is emotional exposure it cannot tolerate. A planet here submerges.',
  },
  9: {
    name: 'Sagittarius', sanskrit: 'Dhanu', lord: 'Jupiter',
    element: 'fire', mode: 'dual', gender: 'male',
    tone: 'principled, roaming, teaching',
    beginner: 'Sagittarius aims at something bigger — idealistic, blunt, always heading somewhere further out.',
    practitioner: 'Dvisvabhava agni rashi ruled by Jupiter. Gives conviction, breadth and a taste for the road. A planet here believes and instructs.',
  },
  10: {
    name: 'Capricorn', sanskrit: 'Makara', lord: 'Saturn',
    element: 'earth', mode: 'movable', gender: 'female',
    tone: 'ambitious, dry, durable',
    beginner: 'Capricorn climbs — disciplined, realistic, and willing to wait a long time for something worth having.',
    practitioner: 'Chara prithvi rashi ruled by Saturn; Mars\'s exaltation and Jupiter\'s fall. Gives structure and cold ambition; Jupiter\'s fall here is expansion meeting an accountant. A planet here works.',
  },
  11: {
    name: 'Aquarius', sanskrit: 'Kumbha', lord: 'Saturn',
    element: 'air', mode: 'fixed', gender: 'male',
    tone: 'detached, collective, contrary',
    beginner: 'Aquarius stands slightly outside and thinks in systems — humane in the abstract, hard to reach up close.',
    practitioner: 'Sthira vayu rashi, Saturn\'s mula-trikona-adjacent own sign. Gives detachment, principle and the crowd. A planet here abstracts and joins the collective.',
  },
  12: {
    name: 'Pisces', sanskrit: 'Meena', lord: 'Jupiter',
    element: 'water', mode: 'dual', gender: 'female',
    tone: 'porous, merciful, dissolving',
    beginner: 'Pisces dissolves boundaries — compassionate, imaginative, easily flooded by other people.',
    practitioner: 'Dvisvabhava jala rashi ruled by Jupiter; Venus\'s exaltation and Mercury\'s fall. Gives compassion and imagination; Mercury\'s fall is precision losing its edges. A planet here surrenders.',
  },
}

export const ELEMENT_NOTES = {
  fire:  'fire — it moves by conviction and heat',
  earth: 'earth — it moves by what can be held and used',
  air:   'air — it moves by idea and exchange',
  water: 'water — it moves by feeling and attachment',
}

export const MODE_NOTES = {
  movable: 'movable (chara) — it starts things and changes direction easily',
  fixed:   'fixed (sthira) — it holds a line and resists being moved',
  dual:    'dual (dvisvabhava) — it adapts, and rarely commits to one form',
}
