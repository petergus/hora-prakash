// src/content/interpretation/qualifiers.js
// The modifier sentences that condition a placement on how strong the planet
// actually is in THIS chart — the A6 "strength-weighted interpretation" layer.
//
// ⚠ AUTHORSHIP: Claude-authored from classical principles. Not reviewed by a
// practising astrologer — see houses.js.
//
// Design note: strength is deliberately NOT baked into the 108 planet-in-house
// entries as strong/weak/neutral variants. That would have tripled the corpus
// and buried the reasoning. Instead a placement always reads the same, and the
// qualifier says plainly how much weight to put on it — which is both honest
// and auditable, since the qualifier names the number it came from.
//
// Pure data + small pure helpers — Node-safe, no imports.

/** Shadbala ratio bands. `ratio` = total / required (1.0 = the classical bar). */
export const SHADBALA_BANDS = [
  { min: 1.2, key: 'strong',
    beginner: 'This planet is strong in your chart, so these results come through clearly and reliably.',
    practitioner: 'Shadbala ratio {ratio}× — above the required bar. The planet has the strength to deliver its significations; read the placement at full weight.' },
  { min: 1.0, key: 'adequate',
    beginner: 'This planet has enough strength to deliver, without much in reserve.',
    practitioner: 'Shadbala ratio {ratio}× — at the required bar. Results manifest, but without surplus; sensitive to dasha and transit support.' },
  { min: 0.8, key: 'middling',
    beginner: 'This planet is somewhat under-powered, so these themes show up unevenly — strongly at times, faintly at others.',
    practitioner: 'Shadbala ratio {ratio}× — below the required bar. Significations manifest intermittently and lean on the dasha for support.' },
  { min: 0, key: 'weak',
    beginner: 'This planet is weak in your chart. These themes are present but struggle to express — expect effort where others get it free.',
    practitioner: 'Shadbala ratio {ratio}× — well below the required bar. The significations are impaired; results need dasha, dignity or yoga support to appear at all.' },
]

/** Deeptadi avastha → how the planet is "feeling" where it sits. */
export const AVASTHA_QUALIFIERS = {
  deepta:   'It is exalted here, which is the best it can be — this is a genuine asset in the chart.',
  svastha:  'It sits in its own sign, comfortable and self-possessed.',
  mudita:   'It sits in a great friend\'s sign and is well looked after here.',
  shanta:   'It sits in a friendly sign, supported.',
  deena:    'It sits in a neutral sign — neither helped nor hindered.',
  duhkhita: 'It sits in an enemy\'s sign, which makes it work harder for less.',
  vikala:   'It sits in a great enemy\'s sign and is under real pressure here.',
  khala:    'It is debilitated — its weakest sign. Check whether anything cancels that before reading it as failure.',
  kopa:     'It is combust — burnt by proximity to the Sun, so it acts through the Sun\'s agenda more than its own.',
}

/** Baladi (age) avastha → how much of the result actually lands. */
export const BALADI_QUALIFIERS = {
  bala:    'By degree it is an infant, so classical texts give it only a quarter of its result.',
  kumara:  'By degree it is adolescent — about half its result.',
  yuva:    'By degree it is adult, giving its full result.',
  vriddha: 'By degree it is old, and gives little.',
  mrita:   'By degree it is "dead" — the last stretch of the sign — and gives almost nothing.',
}

/** Sarvashtakavarga bindus for a sign (natal). 28 is the average of 337/12. */
export const SAV_BANDS = [
  { min: 30, beginner: 'The sign it occupies is well supported ({bindus} bindus), which helps.',
    practitioner: 'Sarvashtakavarga {bindus} bindus — above average; the sign supports transits and results here.' },
  { min: 25, beginner: 'The sign it occupies is about average ({bindus} bindus).',
    practitioner: 'Sarvashtakavarga {bindus} bindus — near the 28-point mean.' },
  { min: 0,  beginner: 'The sign it occupies is thinly supported ({bindus} bindus), so results here are harder won.',
    practitioner: 'Sarvashtakavarga {bindus} bindus — below average; the sign gives little support to transits or results.' },
]

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

/**
 * The strength qualifier for a planet.
 * @param {number|null} ratio Shadbala total/required
 * @param {'beginner'|'practitioner'} depth
 * @returns {{ key, text }|null}
 */
export function shadbalaQualifier(ratio, depth = 'beginner') {
  if (typeof ratio !== 'number' || !isFinite(ratio)) return null
  const band = SHADBALA_BANDS.find(b => ratio >= b.min) ?? SHADBALA_BANDS[SHADBALA_BANDS.length - 1]
  return { key: band.key, text: fill(band[depth], { ratio: ratio.toFixed(2) }) }
}

export function savQualifier(bindus, depth = 'beginner') {
  if (typeof bindus !== 'number' || !isFinite(bindus)) return null
  const band = SAV_BANDS.find(b => bindus >= b.min) ?? SAV_BANDS[SAV_BANDS.length - 1]
  return { text: fill(band[depth], { bindus }) }
}
