// src/content/interpretation/planets-in-houses.js
// All 108 graha-in-bhava placements — the core interpretive table.
//
// ⚠ AUTHORSHIP: Claude-authored from classical principles (BPHS ch. 15–23
// bhava-phala, Phaladeepika ch. 8–10, Saravali). Not reviewed by a practising
// astrologer — see the note in houses.js. Where classical sources disagree the
// text follows the majority Parashari reading.
//
// Keyed `${Planet}-${house}` (e.g. 'Saturn-10'). Every one of the 9 planets ×
// 12 houses is present; `tests/interpret.test.mjs` asserts exhaustiveness, so
// a missing key fails the build's test step rather than silently rendering an
// empty paragraph.
//
// Each entry: { beginner, practitioner }. Strength/dignity is NOT baked in
// here — `qualifiers.js` appends that from Shadbala/avastha, so a placement
// reads the same whether the planet is strong or weak and the qualifier does
// the honest work.
//
// Pure data — Node-safe, no imports.

export const PLANETS_IN_HOUSES = {
  // ── Sun ──────────────────────────────────────────────────────────────────
  'Sun-1': {
    beginner: 'You lead with yourself. There is a natural authority in how you arrive, along with a need to be taken seriously that can read as pride.',
    practitioner: 'Surya in tanu bhava: strong constitution, commanding presence, sensitivity to slight. Gives dignity and a hot temperament; can thin the hair and heat the eyes.',
  },
  'Sun-2': {
    beginner: 'You speak with authority and expect to be heard. Money and family standing matter to your sense of self.',
    practitioner: 'Surya in dhana bhava: authoritative vak, wealth through position rather than trade. Can burn the family fund or strain relations with the kutumba; harsh speech if afflicted.',
  },
  'Sun-3': {
    beginner: 'Your courage is personal — you back yourself. Effort comes easily; taking direction does not.',
    practitioner: 'Surya in sahaja bhava: strong parakrama, self-made valour. An upachaya placement that improves with time; may scorch relations with younger siblings.',
  },
  'Sun-4': {
    beginner: 'Home is where you need to be central, which can make it a place of tension as much as comfort.',
    practitioner: 'Surya in sukha bhava: authority at home, restlessness in it. The Sun in a house of sukha heats the base — comfort is sought but rarely felt; can strain the mother or the heart.',
  },
  'Sun-5': {
    beginner: 'A sharp, creative mind that wants its work recognised. Strong opinions, and real authority when you teach.',
    practitioner: 'Surya in putra bhava: brilliant buddhi, authority in learning, few children or a demanding relation with them. A trikona Sun gives dharmic confidence and speculative losses.',
  },
  'Sun-6': {
    beginner: 'You beat your rivals. Conflict energises you rather than draining you, though it can cost your health.',
    practitioner: 'Surya in ripu bhava: victory over shatru, debts overcome. A strong dusthana-upachaya placement; the Sun destroys the house it occupies, which here is welcome.',
  },
  'Sun-7': {
    beginner: 'You want a partner you can respect — and may struggle when the relationship asks you to share the centre.',
    practitioner: 'Surya in kalatra bhava: a dignified or dominant spouse, ego friction in partnership. Classical texts read this as delay or difficulty in marriage; the Sun does not sit well opposite the lagna.',
  },
  'Sun-8': {
    beginner: 'You are drawn to what is hidden. Life reshapes you through crises that are usually about pride.',
    practitioner: 'Surya in randhra bhava: research into the occult, reversals of status, a father-related difficulty. Gives longevity if strong; the ego is repeatedly dismantled.',
  },
  'Sun-9': {
    beginner: 'You believe strongly and want to be a source of guidance. Fortune tends to come through father figures and teachers.',
    practitioner: 'Surya in dharma bhava: excellent bhagya, dharmic authority, a strong or overbearing pitru. One of the Sun\'s best placements — trikona dignity without kendra friction.',
  },
  'Sun-10': {
    beginner: 'Career is where you become yourself. You are built to hold responsibility in public.',
    practitioner: 'Surya in karma bhava with full digbala: the classical seat of rajayoga. Gives authority, visibility and government or leadership work. The Sun\'s strongest direction.',
  },
  'Sun-11': {
    beginner: 'Your ambitions get fulfilled, often through people in authority. Powerful friends, and gains you actually keep.',
    practitioner: 'Surya in labha bhava: strong labha through status and elders. An upachaya placement; gives influential sangha and steady realisation of desires.',
  },
  'Sun-12': {
    beginner: 'You do your real work out of sight, and may be happiest away from where you started.',
    practitioner: 'Surya in vyaya bhava: loss of position, foreign residence, spiritual retreat. The soul turns inward; can indicate estrangement from the father or expenditure on status.',
  },

  // ── Moon ─────────────────────────────────────────────────────────────────
  'Moon-1': {
    beginner: 'You feel your way through life. Moods move across you visibly, and people find you easy to be near.',
    practitioner: 'Chandra in tanu bhava: emotional temperament, changeable body, public likeability. Strength depends heavily on paksha — a waxing Moon here is a considerable asset, a dark one gives timidity.',
  },
  'Moon-2': {
    beginner: 'You speak gently and persuasively. Money comes and goes in tides, and family feeling runs deep.',
    practitioner: 'Chandra in dhana bhava: sweet vak, fluctuating dhana, attachment to the kutumba. Wealth accumulates in waves rather than a line.',
  },
  'Moon-3': {
    beginner: 'Your courage is emotional — you act on feeling. Close, changeable bonds with siblings.',
    practitioner: 'Chandra in sahaja bhava: parakrama driven by mood, frequent short travel, attachment to co-borns. An upachaya placement; courage steadies with age.',
  },
  'Moon-4': {
    beginner: 'Home and mother are the centre of your life. When the home is settled, everything else is.',
    practitioner: 'Chandra in sukha bhava — the Moon in its own natural house: excellent sukha, deep matru bond, land and vehicles. One of the finest placements for inner contentment.',
  },
  'Moon-5': {
    beginner: 'A warm, imaginative mind. You think in images and feel strongly about children and what you create.',
    practitioner: 'Chandra in putra bhava: creative buddhi, strong purva punya, attachment to progeny. Gives mantra affinity and an emotional relationship to learning.',
  },
  'Moon-6': {
    beginner: 'You worry, and the worry lands in the body. Real capacity to care for people who are struggling.',
    practitioner: 'Chandra in ripu bhava: emotional vulnerability to roga, service to others, anxiety. A dusthana Moon; the mind is set against itself, though it gives compassion in service.',
  },
  'Moon-7': {
    beginner: 'You need a partner. Relationship isn\'t a preference for you — it\'s how you feel like yourself.',
    practitioner: 'Chandra in kalatra bhava: emotional dependence on the spouse, a caring or moody partner, public appeal. Strong for trade; the mind lives in the other.',
  },
  'Moon-8': {
    beginner: 'You feel what others hide. Life is emotionally intense in ways that are mostly private.',
    practitioner: 'Chandra in randhra bhava: emotional upheaval, occult sensitivity, interest in what is buried. A difficult placement for peace of mind; excellent for depth research and inheritance.',
  },
  'Moon-9': {
    beginner: 'You feel your beliefs rather than argue them. Fortune through travel, teachers, and your mother\'s side.',
    practitioner: 'Chandra in dharma bhava: emotional dharma, devotion, long journeys, good bhagya. Faith is felt, not reasoned — which makes it durable.',
  },
  'Moon-10': {
    beginner: 'Your work needs to mean something to you emotionally. You do well in public-facing roles.',
    practitioner: 'Chandra in karma bhava: a public career, work touching the masses, changeable profession. Gives popularity; the vocation follows feeling more than strategy.',
  },
  'Moon-11': {
    beginner: 'Friends are family to you, and your networks are how good things reach you.',
    practitioner: 'Chandra in labha bhava: gains through the public and through women, a wide sangha, emotionally-driven ambitions. An upachaya Moon — steadily improving labha.',
  },
  'Moon-12': {
    beginner: 'You need solitude the way others need company. Rich inner life; foreign places suit you.',
    practitioner: 'Chandra in vyaya bhava: withdrawal, foreign residence, strong shayana sukha and dream life. Excellent for moksha and contemplation, hard on ordinary emotional stamina.',
  },

  // ── Mars ─────────────────────────────────────────────────────────────────
  'Mars-1': {
    beginner: 'Direct, physical, quick to react. You push first and think about it after.',
    practitioner: 'Mangala in tanu bhava: strong body, forceful temperament, marks or scars. Kuja dosha from the lagna. Gives athletic vitality and a short fuse.',
  },
  'Mars-2': {
    beginner: 'You say the sharp thing. Money is earned aggressively, and family arguments are not rare.',
    practitioner: 'Mangala in dhana bhava: harsh vak, contentious kutumba, wealth through effort or property. Kuja dosha; a maraka malefic — the speech cuts.',
  },
  'Mars-3': {
    beginner: 'Genuine courage. You take on things other people won\'t, and you back your siblings hard.',
    practitioner: 'Mangala in sahaja bhava: excellent parakrama — a malefic in its best upachaya. Gives technical or physical skill with the hands and real fighting capacity.',
  },
  'Mars-4': {
    beginner: 'Home can be a battlefield. Strong feelings about land and property, and a restlessness indoors.',
    practitioner: 'Mangala in sukha bhava: friction at home, disputes over land, a demanding relation with the mother. Kuja dosha; the heat sits in the house of ease.',
  },
  'Mars-5': {
    beginner: 'A competitive, incisive mind. Strong opinions and strong appetites, including for risk.',
    practitioner: 'Mangala in putra bhava: sharp buddhi, speculation, difficulty or delay with progeny. Gives technical intelligence and a taste for contest.',
  },
  'Mars-6': {
    beginner: 'You are very good in a fight. Enemies do not prosper against you, and hard work agrees with you.',
    practitioner: 'Mangala in ripu bhava: a classic Vipreet-adjacent strength — malefic in dusthana-upachaya. Defeats shatru, clears rina, and gives capacity for sustained conflict.',
  },
  'Mars-7': {
    beginner: 'Passion and friction in partnership. You want a partner with fire, and then contend with the fire.',
    practitioner: 'Mangala in kalatra bhava: the classical Kuja dosha seat. Conflict in marriage, a forceful spouse, or delay — traditionally softened when both charts carry the dosha, or by Jupiter\'s aspect.',
  },
  'Mars-8': {
    beginner: 'You are drawn to what is dangerous or hidden. Sudden events, and a strong stomach for them.',
    practitioner: 'Mangala in randhra bhava: surgery, accidents, occult research, inheritance disputes. Kuja dosha. Gives investigative force and an unsentimental relationship with death.',
  },
  'Mars-9': {
    beginner: 'You fight for what you believe. Convictions are strong and not always negotiable.',
    practitioner: 'Mangala in dharma bhava: militant dharma, friction with the father or guru, fortune through effort and travel. Belief becomes a cause.',
  },
  'Mars-10': {
    beginner: 'Ambitious and hard-driving at work. Suits engineering, surgery, the forces — anything with an edge.',
    practitioner: 'Mangala in karma bhava with digbala: excellent for karma. Gives executive drive, technical or martial vocation, and a reputation for force.',
  },
  'Mars-11': {
    beginner: 'You get what you go after. Gains through sheer drive, and friends who are also competitors.',
    practitioner: 'Mangala in labha bhava: strong labha through effort, contentious sangha, elder-sibling friction. Malefics thrive in the eleventh.',
  },
  'Mars-12': {
    beginner: 'Your fight goes inward, or happens far from home. Energy leaks unless it has somewhere to go.',
    practitioner: 'Mangala in vyaya bhava: hidden enemies, expenditure through impulse, foreign or confined work. Kuja dosha. Gives secret strength and troubled sleep.',
  },

  // ── Mercury ──────────────────────────────────────────────────────────────
  'Mercury-1': {
    beginner: 'Quick, articulate, youthful. You think out loud and people notice the intelligence first.',
    practitioner: 'Budha in tanu bhava: sharp intellect, youthful appearance, ready speech. Takes the colour of its associations; excellent if unafflicted, glib if with malefics.',
  },
  'Mercury-2': {
    beginner: 'You are good with words and good with money — often at the same time.',
    practitioner: 'Budha in dhana bhava: eloquent vak, wealth through trade, commerce or communication. One of the best placements for dhana through skill rather than inheritance.',
  },
  'Mercury-3': {
    beginner: 'Curious and dexterous. Writing, negotiating, and short trips all suit you.',
    practitioner: 'Budha in sahaja bhava: skill with hands and words, effort through communication, close sibling ties. Strong upachaya placement for a writer or negotiator.',
  },
  'Mercury-4': {
    beginner: 'A busy mind at home. Learning and study are part of what makes you comfortable.',
    practitioner: 'Budha in sukha bhava: education, a studious home, an intelligent mother. Gives property through negotiation and a mind that rarely switches off indoors.',
  },
  'Mercury-5': {
    beginner: 'Genuinely clever. You learn fast, teach well, and enjoy playing with ideas.',
    practitioner: 'Budha in putra bhava: excellent buddhi, mantra facility, intelligent children. A trikona Mercury — one of the finest placements for the intellect.',
  },
  'Mercury-6': {
    beginner: 'A problem-solver. You are useful in a crisis and can argue your way out of most of them.',
    practitioner: 'Budha in ripu bhava: victory through argument, litigation, work in service or medicine. Nervous complaints if afflicted; the mind is set to fixing.',
  },
  'Mercury-7': {
    beginner: 'You bond through conversation. Business partnerships suit you, and you want a partner you can talk to.',
    practitioner: 'Budha in kalatra bhava: an intelligent or youthful spouse, partnership in trade, contracts. Excellent for vyapara; the marriage lives on discourse.',
  },
  'Mercury-8': {
    beginner: 'You investigate. Research, secrets, and the things people don\'t say hold your attention.',
    practitioner: 'Budha in randhra bhava: research, occult study, interest in the hidden mechanics of things. Gives an analytic relationship to crisis; nervous strain under affliction.',
  },
  'Mercury-9': {
    beginner: 'You reason about belief rather than just accepting it. A natural student and teacher.',
    practitioner: 'Budha in dharma bhava: philosophical intellect, higher learning, publishing, teaching. Faith is examined; gives a scholar rather than a devotee.',
  },
  'Mercury-10': {
    beginner: 'Your work runs on your wits — writing, trade, analysis, advising.',
    practitioner: 'Budha in karma bhava with digbala: excellent for a career of intellect, commerce or communication. Mercury\'s strongest direction alongside the Sun.',
  },
  'Mercury-11': {
    beginner: 'You network well and earn through cleverness. Ideas turn into income.',
    practitioner: 'Budha in labha bhava: gains through trade, intellectual sangha, realised ambitions via skill. A strong upachaya placement for commerce.',
  },
  'Mercury-12': {
    beginner: 'A private mind. You think best alone, and may work abroad or behind the scenes.',
    practitioner: 'Budha in vyaya bhava: intellect turned inward, foreign trade, expenditure through miscalculation. Good for research and contemplation, scattered in worldly negotiation.',
  },

  // ── Jupiter ──────────────────────────────────────────────────────────────
  'Jupiter-1': {
    beginner: 'People trust you on sight. Optimistic, generous, and inclined to grow in every sense.',
    practitioner: 'Guru in tanu bhava: excellent — a benefic in the lagna protects the whole chart. Gives wisdom, girth, and a benevolent presence. Guru drishti falls on the 5th, 7th and 9th.',
  },
  'Jupiter-2': {
    beginner: 'Wealth tends to find you, and you speak with warmth and weight.',
    practitioner: 'Guru in dhana bhava: strong dhana, learned and truthful vak, a cultured family. One of the best placements for accumulated wealth.',
  },
  'Jupiter-3': {
    beginner: 'Generous with siblings, though your own effort may be the least of your gifts.',
    practitioner: 'Guru in sahaja bhava: a benefic in an upachaya — classically the weakest Jupiter placement. Gives good relations with co-borns but blunts parakrama; ease undercuts effort.',
  },
  'Jupiter-4': {
    beginner: 'A happy home and a generous mother. Real inner contentment, which is rarer than it sounds.',
    practitioner: 'Guru in sukha bhava: excellent sukha, property, a learned mother, deep contentment. Kendra dignity; one of the finest placements in the chart for peace.',
  },
  'Jupiter-5': {
    beginner: 'Wise, and good with children — your own and other people\'s. Learning comes naturally.',
    practitioner: 'Guru in putra bhava — Jupiter in its own natural house and a trikona: excellent for progeny, purva punya, mantra and buddhi. Beware bhava-karako bhavo nashaya on children.',
  },
  'Jupiter-6': {
    beginner: 'You do well by people who are struggling — but you may be too generous with those who aren\'t.',
    practitioner: 'Guru in ripu bhava: a benefic in a dusthana. Gives capacity in healing and service, protection from enemies, but debts through generosity and liver-related weakness.',
  },
  'Jupiter-7': {
    beginner: 'A good partner comes to you, and the relationship tends to be one that grows you.',
    practitioner: 'Guru in kalatra bhava: a wise, older or principled spouse; excellent for marriage. Some texts note Jupiter here can over-idealise the partner (karako bhavo nashaya).',
  },
  'Jupiter-8': {
    beginner: 'Protection in hard places. You gain through others, and crises tend to leave you wiser.',
    practitioner: 'Guru in randhra bhava: longevity, inheritance, occult wisdom. A benefic in the eighth quiets rather than fails — it gives an easy end and gains through the spouse.',
  },
  'Jupiter-9': {
    beginner: 'Real good fortune. Belief, teachers, and travel all open doors for you.',
    practitioner: 'Guru in dharma bhava — its own natural house and the strongest trikona: outstanding bhagya, guru-tattva, dharmic authority. Among the very best placements in Jyotish.',
  },
  'Jupiter-10': {
    beginner: 'A respected career, often one that teaches, advises or heals.',
    practitioner: 'Guru in karma bhava: a dharmic vocation, teaching, law, counsel. Kendra strength; gives a reputation for integrity, though Jupiter is not at digbala here.',
  },
  'Jupiter-11': {
    beginner: 'Gains arrive generously and repeatedly. Good friends in high places.',
    practitioner: 'Guru in labha bhava: large and repeated labha, learned sangha, elder siblings who help. An upachaya benefic — desires are fulfilled.',
  },
  'Jupiter-12': {
    beginner: 'Generous to a fault, and drawn to retreat, charity, or life somewhere far away.',
    practitioner: 'Guru in vyaya bhava: expenditure on dharma, foreign residence, moksha. The best house for liberation and the worst for keeping money; gives a protected end.',
  },

  // ── Venus ────────────────────────────────────────────────────────────────
  'Venus-1': {
    beginner: 'Charm you don\'t have to work at. Appearance and comfort matter to you.',
    practitioner: 'Shukra in tanu bhava: beauty, grace, a pleasure-loving temperament. A benefic in the lagna; gives attractiveness and a taste for ease that can soften resolve.',
  },
  'Venus-2': {
    beginner: 'A pleasant voice and a taste for nice things. Money comes through what people enjoy.',
    practitioner: 'Shukra in dhana bhava: sweet vak, wealth through art, luxury or women, a refined family. Strong for dhana; appetite can outrun the fund.',
  },
  'Venus-3': {
    beginner: 'Artistic with your hands. You would rather charm than fight.',
    practitioner: 'Shukra in sahaja bhava: artistic skill, pleasant siblings, effort through diplomacy. A benefic in an upachaya — weakens parakrama, gives the arts.',
  },
  'Venus-4': {
    beginner: 'A beautiful home matters to you, and you usually get one.',
    practitioner: 'Shukra in sukha bhava: comfort, vehicles, a refined mother, land. Excellent for sukha; the home becomes an aesthetic project.',
  },
  'Venus-5': {
    beginner: 'Romantic and creative. Love affairs, art, and delight in children.',
    practitioner: 'Shukra in putra bhava: artistic buddhi, romance, daughters, speculation. A trikona Venus — creativity and love are the same faculty here.',
  },
  'Venus-6': {
    beginner: 'Relationships get complicated by obligation. Health can suffer from indulgence.',
    practitioner: 'Shukra in ripu bhava: a benefic in a dusthana — friction in kalatra matters, debts through pleasure, urinary or reproductive weakness. Gives skill in mediation.',
  },
  'Venus-7': {
    beginner: 'Partnership is where you shine. You want a beautiful, harmonious relationship and usually find one.',
    practitioner: 'Shukra in kalatra bhava — its own natural house: an attractive spouse, strong marriage, success in trade. Note karako bhavo nashaya: some texts read the kalatra karaka in kalatra bhava as a caution.',
  },
  'Venus-8': {
    beginner: 'Intense in love, and private about it. Gains may come through a partner.',
    practitioner: 'Shukra in randhra bhava: gains through the spouse, secret relationships, interest in tantra. Gives longevity and an easy death; scandal if afflicted.',
  },
  'Venus-9': {
    beginner: 'You find beauty in what you believe. Fortune through travel, art, and partners from elsewhere.',
    practitioner: 'Shukra in dharma bhava: aesthetic dharma, fortune through the spouse, foreign or cross-cultural marriage. A trikona benefic — grace arrives easily.',
  },
  'Venus-10': {
    beginner: 'A career in something people find beautiful or pleasurable — art, design, luxury, diplomacy.',
    practitioner: 'Shukra in karma bhava: vocation in the arts, luxury, diplomacy or entertainment. Kendra strength and public charm; the work is a form of rasa.',
  },
  'Venus-11': {
    beginner: 'Gains through people who like you. Friendship and income overlap.',
    practitioner: 'Shukra in labha bhava: gains through women, art and the sangha; fulfilled desires. An upachaya benefic — Venus\'s appetites are actually met here.',
  },
  'Venus-12': {
    beginner: 'You love privately and spend on comfort. Bed, retreat and distant places are where you rest.',
    practitioner: 'Shukra in vyaya bhava — its exaltation sign\'s natural house: excellent shayana sukha, expenditure on pleasure, foreign or hidden relationships. Classically strong for moksha and for the senses at once.',
  },

  // ── Saturn ───────────────────────────────────────────────────────────────
  'Saturn-1': {
    beginner: 'Life asks you to be serious early. You mature slowly and thoroughly, and carry a certain weight.',
    practitioner: 'Shani in tanu bhava: a lean or dry constitution, gravity of manner, early hardship. Saturn in the lagna delays the whole chart but gives durability; drishti falls on the 3rd, 7th and 10th.',
  },
  'Saturn-2': {
    beginner: 'Money comes slowly and you learn to hold it. You speak carefully, or not at all.',
    practitioner: 'Shani in dhana bhava: slow accumulation, measured or blunt vak, a hard family history. A maraka malefic; wealth is real but late.',
  },
  'Saturn-3': {
    beginner: 'Your courage is the durable kind — you outlast rather than overwhelm.',
    practitioner: 'Shani in sahaja bhava: excellent — a malefic in its best upachaya. Gives disciplined parakrama, endurance, and long-term application; strain with younger siblings.',
  },
  'Saturn-4': {
    beginner: 'Home was not simple. Contentment is something you build rather than receive.',
    practitioner: 'Shani in sukha bhava: a difficult or absent matru, cold home, property late in life. Saturn in a house of sukha is a hard combination — ease must be constructed.',
  },
  'Saturn-5': {
    beginner: 'A serious mind. Children and creative work may come late, and matter more for the wait.',
    practitioner: 'Shani in putra bhava: delayed or few progeny, disciplined buddhi, structured learning. A malefic in a trikona; gives depth and denies ease.',
  },
  'Saturn-6': {
    beginner: 'You grind down whatever is in your way. Long fights end in your favour.',
    practitioner: 'Shani in ripu bhava: outstanding — a malefic in dusthana-upachaya. Defeats enemies by attrition, clears debt, gives capacity for unglamorous sustained work. Chronic rather than acute illness.',
  },
  'Saturn-7': {
    beginner: 'Marriage comes late or seriously. A dutiful partnership, often with an age or temperament gap.',
    practitioner: 'Shani in kalatra bhava: delay in marriage, an older or dutiful spouse, endurance over romance. Classical texts read delay, not denial — the marriage that comes tends to last.',
  },
  'Saturn-8': {
    beginner: 'A long life, and long lessons. Nothing transforms quickly for you, but it does transform.',
    practitioner: 'Shani in randhra bhava: excellent for ayush — the ayush karaka in the ayush bhava. Chronic conditions, slow inheritance, deep endurance. Hardship without a quick end.',
  },
  'Saturn-9': {
    beginner: 'You question what you were taught, and build your own beliefs the hard way.',
    practitioner: 'Shani in dharma bhava: a malefic in the strongest trikona — delayed or tested bhagya, a stern or distant father, dharma earned rather than inherited. Doubt before faith.',
  },
  'Saturn-10': {
    beginner: 'A slow, real career. Recognition comes late, and then it stays.',
    practitioner: 'Shani in karma bhava with digbala: one of Saturn\'s strongest placements. Gives sustained professional standing through labour — Sasa Yoga if in its own or exaltation sign. Late rise, durable.',
  },
  'Saturn-11': {
    beginner: 'Gains come steadily rather than suddenly, and they keep coming.',
    practitioner: 'Shani in labha bhava: excellent — steady, durable labha through persistence. An upachaya malefic; older friends, and ambitions realised late but fully.',
  },
  'Saturn-12': {
    beginner: 'You are comfortable with solitude, and may find your life somewhere far from where it began.',
    practitioner: 'Shani in vyaya bhava: isolation, foreign residence, disturbed sleep, expenditure on obligation. Strong for moksha and renunciation; hard on rest.',
  },

  // ── Rahu ─────────────────────────────────────────────────────────────────
  'Rahu-1': {
    beginner: 'An unusual presence. You may feel like an outsider, and turn that into your advantage.',
    practitioner: 'Rahu in tanu bhava: an unconventional or foreign persona, strong ambition, identity confusion. Amplifies the lagna without discriminating; acts through its dispositor.',
  },
  'Rahu-2': {
    beginner: 'Hunger around money and status. Speech that persuades — sometimes past what is strictly true.',
    practitioner: 'Rahu in dhana bhava: unconventional wealth, persuasive or exaggerated vak, a complicated family. A maraka position for the node; appetite exceeds the fund.',
  },
  'Rahu-3': {
    beginner: 'Bold to the point of reckless — and it usually pays off.',
    practitioner: 'Rahu in sahaja bhava: excellent — the node\'s best upachaya. Gives fearless parakrama, unconventional communication, and success through sheer nerve.',
  },
  'Rahu-4': {
    beginner: 'Restless at home. You may live far from where you were raised.',
    practitioner: 'Rahu in sukha bhava: foreign residence, an unconventional or absent matru, unsettled sukha. The node in a house of peace does not permit much.',
  },
  'Rahu-5': {
    beginner: 'An unorthodox mind and a taste for risk. Speculation attracts you.',
    practitioner: 'Rahu in putra bhava: unconventional buddhi, speculation, difficulty or unusual circumstance around progeny. Gives fascination with esoteric knowledge.',
  },
  'Rahu-6': {
    beginner: 'You are formidable against opposition. Rivals underestimate you once.',
    practitioner: 'Rahu in ripu bhava: outstanding — defeats shatru decisively, thrives in litigation and competition. A malefic node in dusthana-upachaya; obscure or hard-to-diagnose illness.',
  },
  'Rahu-7': {
    beginner: 'You are drawn to partners who are unlike you — foreign, unconventional, or simply unexpected.',
    practitioner: 'Rahu in kalatra bhava: an unconventional or foreign spouse, obsessive attachment, unstable partnership. The node opposite the lagna distorts what is sought in the other.',
  },
  'Rahu-8': {
    beginner: 'Pulled toward the hidden. Sudden reversals, and a genuine gift for the occult.',
    practitioner: 'Rahu in randhra bhava: occult capacity, sudden events, unearned wealth, chronic obscurity of cause. The node is at home in the eighth and dangerous there.',
  },
  'Rahu-9': {
    beginner: 'You question inherited belief and may adopt a tradition not your own.',
    practitioner: 'Rahu in dharma bhava: unorthodox dharma, foreign guru, friction with the father. The node in a trikona confuses grace; belief becomes a search rather than an inheritance.',
  },
  'Rahu-10': {
    beginner: 'Big worldly ambition, and an unconventional route to it.',
    practitioner: 'Rahu in karma bhava: strong rise, foreign or unorthodox career, hunger for status. One of Rahu\'s most effective placements — a kendra node given a stage.',
  },
  'Rahu-11': {
    beginner: 'Large gains, unusual friends, ambitions that keep escalating.',
    practitioner: 'Rahu in labha bhava — the node\'s best house: very large labha, an unconventional sangha, desires that grow as they are met. Wealth without a ceiling and without satiety.',
  },
  'Rahu-12': {
    beginner: 'Drawn to foreign places and hidden things. Spending you can\'t always account for.',
    practitioner: 'Rahu in vyaya bhava: foreign residence, hidden enemies, unaccountable expenditure, strong moksha pull. Good for research and isolation, hard on the accounts.',
  },

  // ── Ketu ─────────────────────────────────────────────────────────────────
  'Ketu-1': {
    beginner: 'A certain detachment from yourself. You may not much mind how you appear.',
    practitioner: 'Ketu in tanu bhava: detachment from identity, self-doubt, spiritual inclination. Gives an ascetic streak and an indifference that reads as either humility or absence.',
  },
  'Ketu-2': {
    beginner: 'Money matters less to you than it should. Speech that is either sparse or startlingly direct.',
    practitioner: 'Ketu in dhana bhava: indifference to dhana, terse or halting vak, detachment from the kutumba. A maraka node; wealth passes through rather than accumulates.',
  },
  'Ketu-3': {
    beginner: 'You act without needing to prove anything. Courage without display.',
    practitioner: 'Ketu in sahaja bhava: strong — the node\'s upachaya. Gives effortless parakrama, intuitive skill with the hands, and detachment from siblings.',
  },
  'Ketu-4': {
    beginner: 'Home never quite holds you. A sense of not fully belonging where you live.',
    practitioner: 'Ketu in sukha bhava: detachment from home and matru, dissatisfaction with sukha, spiritual restlessness at the base of the chart.',
  },
  'Ketu-5': {
    beginner: 'Sharp intuition that arrives complete. Ambivalence about children.',
    practitioner: 'Ketu in putra bhava: intuitive buddhi, mantra siddhi, detachment or difficulty around progeny. Past mastery of learning, present indifference to it.',
  },
  'Ketu-6': {
    beginner: 'Enemies simply don\'t stick to you. Illness may be hard to diagnose.',
    practitioner: 'Ketu in ripu bhava: excellent — shatru dissolve rather than fight. Strong for healing and occult diagnosis; the illnesses it gives are elusive.',
  },
  'Ketu-7': {
    beginner: 'Detachment inside relationship. You may be present and still somewhere else.',
    practitioner: 'Ketu in kalatra bhava: dissatisfaction in marriage, emotional absence, a spiritual or distant spouse. Classically one of Ketu\'s hardest placements.',
  },
  'Ketu-8': {
    beginner: 'Natural access to what is hidden. Endings interest you more than they frighten you.',
    practitioner: 'Ketu in randhra bhava: strong occult faculty, moksha, sudden events met with equanimity. The moksha karaka in the house of transformation.',
  },
  'Ketu-9': {
    beginner: 'You have been round belief before. Doubt where others have faith, and insight where they don\'t.',
    practitioner: 'Ketu in dharma bhava: detachment from inherited dharma, doubt, a renunciate guru. Past-life religious mastery; present-life scepticism.',
  },
  'Ketu-10': {
    beginner: 'Ambivalence about your own career, even when you are good at it.',
    practitioner: 'Ketu in karma bhava: detachment from status, changing vocation, work in the occult or the healing arts. Competence without appetite for recognition.',
  },
  'Ketu-11': {
    beginner: 'Gains arrive but do not satisfy. Friendships come and go without much grief.',
    practitioner: 'Ketu in labha bhava: labha without satisfaction, detached sangha, ambitions that dissolve on arrival. An upachaya node — it does give, then removes the wanting.',
  },
  'Ketu-12': {
    beginner: 'Genuinely at home in solitude. The inner life is where the real work happens.',
    practitioner: 'Ketu in vyaya bhava — the moksha karaka in the moksha bhava: the classical best placement for liberation. Renunciation, foreign retreat, and a quiet exit.',
  },
}
