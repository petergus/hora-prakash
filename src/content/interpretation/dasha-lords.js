// src/content/interpretation/dasha-lords.js
// Vimshottari mahadasha themes, plus the modifier an antardasha lord adds.
//
// ⚠ AUTHORSHIP: Claude-authored from classical principles (BPHS dasha-phala).
// Not reviewed by a practising astrologer — see the note in houses.js.
//
// A dasha's actual result depends far more on the lord's house, dignity and
// lordship in THIS chart than on its generic nature — `interpret.js` composes
// the generic theme below with the person's own placement of that lord, and
// says so in the reading.
//
// Pure data — Node-safe, no imports.

export const DASHA_LORDS = {
  Ketu: {
    years: 7,
    theme: 'loosening and letting go',
    beginner: 'A Ketu period tends to strip things back. Things you were holding onto lose their grip — sometimes by your choice, sometimes not. Good for retreat, study and inner work; awkward for worldly ambition.',
    practitioner: 'Ketu dasha (7y): moksha-ward. Detachment, sudden severances, spiritual practice, obscure illness. Results follow Ketu\'s dispositor and house closely, since the node has no rulership of its own.',
  },
  Venus: {
    years: 20,
    theme: 'pleasure, relationship and refinement',
    beginner: 'The longest period. Venus years bring relationship, comfort, art and money — and a pull toward enjoying life that can either enrich it or soften your edge.',
    practitioner: 'Shukra dasha (20y): kama and rasa. Marriage, vehicles, luxury, artistic output, wealth through people. The longest dasha, so it shapes an era rather than an episode.',
  },
  Sun: {
    years: 6,
    theme: 'authority and visibility',
    beginner: 'A short, bright period. Sun years put you in front of people — recognition, responsibility, dealings with authority, and questions about your father.',
    practitioner: 'Surya dasha (6y): atma and rajya. Status, government, paternal matters, assertion of self. Brief and consequential; burns what is not solid.',
  },
  Moon: {
    years: 10,
    theme: 'feeling, home and the public',
    beginner: 'Moon years are about mood, home and belonging — the mother, the family, the public. Fertile and changeable in roughly equal measure.',
    practitioner: 'Chandra dasha (10y): manas. Domestic matters, matru, popularity, emotional weather. Results swing with the Moon\'s paksha strength and its dispositor.',
  },
  Mars: {
    years: 7,
    theme: 'drive, conflict and property',
    beginner: 'Mars years are hot. Energy, courage, conflict and property — you get a lot done and probably fall out with someone doing it.',
    practitioner: 'Mangala dasha (7y): parakrama. Land, siblings, surgery, litigation, technical work. Gives capacity and accident; the pace forces decisions.',
  },
  Rahu: {
    years: 18,
    theme: 'ambition, foreignness and appetite',
    beginner: 'A long, strange period. Rahu years bring worldly ambition, foreign connections, unconventional turns, and desires that grow as you feed them.',
    practitioner: 'Rahu dasha (18y): amplification without discrimination. Rise, foreign residence, obsession, illusion. Reads entirely through Rahu\'s house and dispositor; excellent in upachayas, disorienting in trikonas.',
  },
  Jupiter: {
    years: 16,
    theme: 'expansion, meaning and grace',
    beginner: 'Jupiter years tend to be generous — teachers, learning, children, and things opening up. Expansion is the theme, including of the waistline.',
    practitioner: 'Guru dasha (16y): dharma and vriddhi. Wisdom, progeny, wealth, teaching, travel. The most protective dasha; its worst is usually excess rather than loss.',
  },
  Saturn: {
    years: 19,
    theme: 'time, labour and consequence',
    beginner: 'The long one. Saturn years ask for patience and work. Things come slowly, and what arrives is real. Often the period in which people finally grow up.',
    practitioner: 'Shani dasha (19y): karma ripening. Delay, discipline, endurance, loss of what was not earned. Harsh where Saturn is weak; the making of a life where it is strong.',
  },
  Mercury: {
    years: 17,
    theme: 'intellect, exchange and skill',
    beginner: 'Mercury years favour thinking, talking and trading. Busy, verbal, commercially useful — and scattered if you let it be.',
    practitioner: 'Budha dasha (17y): buddhi and vyapara. Education, commerce, writing, negotiation, nervous strain. Takes the colour of Mercury\'s associations, so it varies widely by chart.',
  },
}

/** What an antardasha lord contributes inside a mahadasha. */
export const ANTAR_MODIFIER = {
  Ketu:    'a thread of detachment and abrupt endings runs through it',
  Venus:   'relationship, comfort and pleasure colour the period',
  Sun:     'matters of authority, recognition and the father come forward',
  Moon:    'the emotional weather and domestic life dominate',
  Mars:    'the pace sharpens — conflict, effort and decisive action',
  Rahu:    'ambition and the unconventional intrude',
  Jupiter: 'things open out — teachers, meaning and support arrive',
  Saturn:  'the brakes come on — delay, duty and hard reality',
  Mercury: 'talk, paperwork, study and negotiation fill the period',
}
