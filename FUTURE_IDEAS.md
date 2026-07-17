# Hora Prakash — Future Ideas (deferred backlog)

Ideas reviewed 2026-07-17 and deferred in favor of the current roadmap (interpretation layer,
life timeline, calendar/muhurta, rectification, practitioner tools). Each entry notes what it
builds on and any hooks left in current code. Effort: S/M/L.

## B3. Life Events Journal + correlation engine
Per-person dated life events (marriage, moves, jobs, losses). App auto-annotates each with the
dasha stack + active transits at that date; a review view surfaces recurring signatures
("every Rahu AD you changed countries"). Stored with the profile in Firestore.
Hooks: the Timeline page reserves an "Events" lane; the Rectification tool has a minimal
inline event list that this would replace/upgrade. Effort: M.

## B4. Personal Daily Guidance ("Today for X") + PWA notifications
Dashboard filtering today through this chart: Tarabala (today's nakshatra counted from janma
nakshatra), Chandrashtama alert, Chandra bala, hora sequence, Rahu-kalam countdown, current
dasha lords' transit condition. PWA push notifications: dasha changes (sandhi detector exists
in `src/core/dasha.js`), forecast events, lunar birthdays. Inputs all exist in
`src/core/panchang.js`/state. Effort: M. The retention feature.

## B8. Varshaphala (Tajika annual chart)
Solar-return chart, Muntha, year lord, Tajika aspects, sahams: the classical "what does this
year hold" system and a natural annual re-engagement moment (pairs with the lunar-birthday
card on the Panchang tab). New core module, reuses SwissEph. Effort: M–L.

## C1. Jaimini module
Chara karakas (Atmakaraka = "the soul's desire"), Karakamsha, Arudha Lagna, Chara dasha,
rashi drishti. A second lens on destiny beside Parashari. Effort: L.

## C2. More dasha systems
Yogini, Ashtottari, Kalachakra, conditional dashas; a consensus view showing where multiple
systems agree on a period's tone. Effort: M–L.

## C3. Nakshatra deep-dive + Navatara wheel
Full 27-nakshatra profiles (deity, symbol, gana, yoni, motivation) + personalized Navatara
(9-tara cycle from janma nakshatra) wheel. Feeds the interpretation corpus and daily
guidance (B4). Effort: M (content-heavy).

## C6. Ashtakavarga transit scoring
Kakshya-level transit evaluation, "high/low bindu days" — extends the SAV column already in
`src/components/TransitTable.js`. Effort: M.

## C7. Graded aspects (sputa drishti) + argala
Strength-graded aspects instead of binary, in tables and interpretation weighting. Effort: M.

## D3. Family constellation view
All saved people at once: where each person's key planets land in *your* houses; shared
nakshatras/signs across the family. The People directory already computes Asc/Moon/Sun per
person. Effort: M.

## D4. Muhurta for two
Wedding/engagement date finder honoring both charts — combine the Muhurta finder (Calendar
page) with Guna Milan (Compare tab). Effort: S once both exist.

## E2. "The sky when you were born" 3D view
WebGL horizon + ecliptic from the birthplace at the birth instant (three.js; positions already
available from SwissEph). Connects the abstraction to the real sky — emotional wow / great
onboarding moment. Effort: L.

## E4. Birth card generator
Story-format shareable PNG: moon-phase disc (already rendered by `src/core/moon-info.js` +
`moonDiscSVG` in `src/tabs/chart.js`), lagna + nakshatra glyphs, top yogas, tithi. Uses the
`src/ui/chart-export.js` rasterization path. Organic growth loop. Effort: S–M.

## E5. Life movie
Press play at birth: transits sweep the natal chart while the dasha lane and event markers
scroll below (Timeline data + `TransitToolbar` animation choreographed). Effort: M on top of
the Life Timeline.

## G1. Glossary tooltips everywhere
Every term (gandanta, sandhi, karana…) hover-explained; one shared data file + tooltip
helper. Effort: S.

## G2. "Tour your own chart"
Guided walkthrough as a mini-course using the person's own data as the textbook: Lesson 1 your
Lagna, Lesson 2 your Moon & nakshatra… Strong onboarding. Effort: M.

## G3. Shloka of the day
A classical verse (BPHS/Phaladeepika) relevant to the running dasha / today's panchang.
Effort: S (content curation).

## H1. Public read-only share link
Privacy-gated shareable chart page; every share is acquisition. Needs Firestore security-rules
care. Effort: M.

## H2. Weekly email digest
"Your week ahead": forecast events + panchang highlights, emailed. Effort: M.

## H3. Monetization tiering
If commercialized: free = calculation; paid = interpretation, timeline, PDF reports. Noting
the natural seam only — no work planned.
