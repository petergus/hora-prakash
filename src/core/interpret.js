// src/core/interpret.js
// The deterministic interpretation engine: chart data → a structured reading.
//
// Every paragraph it emits carries the `factors` it was derived from, so the
// UI can render clickable evidence chips and the reader can audit any claim
// back to the placement that produced it. Nothing here is generated text —
// it selects from `src/content/interpretation/` and composes.
//
// Pure and Node-safe: takes a plain chart object, touches no DOM and no
// ephemeris.

import { HOUSES, HOUSE_GROUPS } from '../content/interpretation/houses.js'
import { PLANETS_CONTENT } from '../content/interpretation/planets.js'
import { SIGNS } from '../content/interpretation/signs.js'
import { PLANETS_IN_HOUSES } from '../content/interpretation/planets-in-houses.js'
import { NAKSHATRAS } from '../content/interpretation/nakshatras.js'
import { DASHA_LORDS, ANTAR_MODIFIER } from '../content/interpretation/dasha-lords.js'
import { yogaMeaning } from '../content/interpretation/yoga-meanings.js'
import { houseLordReading } from '../content/interpretation/house-lords.js'
import { shadbalaQualifier, savQualifier, AVASTHA_QUALIFIERS, BALADI_QUALIFIERS } from '../content/interpretation/qualifiers.js'
import { SIGN_LORDS } from './avastha.js'

export const CORPUS_VERSION = 1

const ORD = ['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th']
const ord = n => ORD[n] ?? `${n}th`

/** Which house a sign falls in, counted from the lagna. */
const houseOfSign = (sign, lagnaSign) => ((sign - lagnaSign + 12) % 12) + 1
/** Which sign rules a given house for this lagna. */
const signOfHouse = (house, lagnaSign) => ((lagnaSign - 1 + house - 1) % 12) + 1
/** The planet ruling a given house for this lagna. */
export const lordOfHouse = (house, lagnaSign) => SIGN_LORDS[signOfHouse(house, lagnaSign) - 1]

/**
 * A factor is a piece of evidence: what the claim rests on. The UI turns these
 * into chips that highlight the chart.
 * @returns {{ type, label, planet?, house?, sign?, key }}
 */
function factor(type, opts) {
  return { type, ...opts, key: `${type}:${opts.planet ?? ''}:${opts.house ?? ''}:${opts.sign ?? ''}:${opts.yoga ?? ''}` }
}

/** Planets that read better with an article. */
const THE = new Set(['Sun', 'Moon'])
const nm = p => (THE.has(p) ? `the ${p}` : p)

/**
 * Pull the strength/dignity qualifiers for a planet into sentences.
 *
 * Stated ONCE per reading (tracked on `ctx`). A planet is typically mentioned
 * several times — as a lord, as a placement, as a natural karaka — and
 * repeating "this planet is weak in your chart" at each mention reads like
 * filler and buries the point.
 */
function qualifiersFor(planetName, chart, depth, ctx) {
  if (ctx?.qualified.has(planetName)) return []
  ctx?.qualified.add(planetName)

  const out = []
  const ratio = chart.strength?.shadbala?.[planetName]?.ratio
  const q = shadbalaQualifier(ratio, depth)
  if (q) out.push(q.text)

  const av = chart.avasthas?.[planetName]
  if (av?.deeptadi && AVASTHA_QUALIFIERS[av.deeptadi.key]) out.push(AVASTHA_QUALIFIERS[av.deeptadi.key])
  if (depth === 'practitioner' && av?.baladi && BALADI_QUALIFIERS[av.baladi.key]) {
    out.push(BALADI_QUALIFIERS[av.baladi.key])
  }

  const p = chart.planets?.find(x => x.name === planetName)
  if (p && Array.isArray(chart.strength?.sarva)) {
    const s = savQualifier(chart.strength.sarva[p.sign - 1], depth)
    if (s) out.push(s.text)
  }
  return out
}

/**
 * A paragraph about one planet's house placement, with its qualifiers.
 * Emitted once per reading: a planet can be reached from several sections
 * (its own house, as a natural karaka), and repeating the same paragraph
 * verbatim is worse than a pointer. `ctx.placed` tracks that.
 */
function placementParagraph(planetName, chart, depth, ctx) {
  const p = chart.planets?.find(x => x.name === planetName)
  if (!p) return null
  const entry = PLANETS_IN_HOUSES[`${planetName}-${p.house}`]
  if (!entry) return null
  if (ctx?.placed.has(planetName)) return null
  ctx?.placed.add(planetName)

  const sign = SIGNS[p.sign]
  const lead = depth === 'practitioner'
    ? `**${cap(nm(planetName))} in ${sign.name}, ${ord(p.house)} bhava.** `
    : `**${cap(nm(planetName))} in your ${ord(p.house)} house (${sign.name}).** `

  const quals = qualifiersFor(planetName, chart, depth, ctx)
  return {
    text: (lead + entry[depth] + (quals.length ? ' ' + quals.join(' ') : '')).trim(),
    factors: [
      factor('planet', { planet: planetName, label: `${planetName} in ${ord(p.house)}` }),
      factor('sign', { sign: p.sign, planet: planetName, label: `${planetName} in ${sign.name}` }),
    ],
  }
}

/**
 * A short cross-reference for a planet whose placement was already read out in
 * an earlier section.
 * @param {'karaka'|'in-house'} kind why this section is mentioning it
 */
function pointerParagraph(planetName, chart, kind) {
  const p = chart.planets?.find(x => x.name === planetName)
  if (!p) return null
  const text = kind === 'karaka'
    ? `_${cap(nm(planetName))} is the natural karaka for this house; it sits in your ${ord(p.house)} — covered above._`
    : `_${cap(nm(planetName))} also sits in this house — covered above._`
  return {
    text,
    factors: [factor('planet', { planet: planetName, label: `${planetName} in ${ord(p.house)}` })],
  }
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

/** A paragraph about where a house's lord went. */
function lordParagraph(house, chart, depth, ctx) {
  const lagnaSign = chart.lagna?.sign
  if (!lagnaSign) return null
  const lord = lordOfHouse(house, lagnaSign)
  const lp = chart.planets?.find(x => x.name === lord)
  if (!lp) return null

  const reading = houseLordReading(house, lp.house)
  const quals = qualifiersFor(lord, chart, depth, ctx)
  return {
    text: (`**${cap(nm(lord))} rules your ${ord(house)}.** ` + reading[depth] +
           (quals.length ? ' ' + quals.join(' ') : '')).trim(),
    factors: [
      factor('planet', { planet: lord, label: `${lord} (${ord(house)} lord) in ${ord(lp.house)}` }),
      factor('house', { house, label: `${ord(house)} house` }),
    ],
  }
}

/** Planets sitting in a given house. */
const planetsIn = (chart, house) => (chart.planets ?? []).filter(p => p.house === house)

// ── Sections ────────────────────────────────────────────────────────────────

function selfSection(chart, depth, ctx) {
  const paras = []
  const lagnaSign = chart.lagna.sign
  const sign = SIGNS[lagnaSign]
  const lord = lordOfHouse(1, lagnaSign)

  paras.push({
    text: `**Your lagna is ${sign.name}**, ruled by ${nm(lord)}. ${sign[depth]}`,
    factors: [factor('sign', { sign: lagnaSign, label: `${sign.name} lagna` })],
  })

  if (chart.lagna.nakshatra) {
    const nakIdx = NAKSHATRAS.findIndex(n => n.name === chart.lagna.nakshatra)
    if (nakIdx >= 0) {
      paras.push({
        text: `**Your lagna sits in ${NAKSHATRAS[nakIdx].name}.** ${NAKSHATRAS[nakIdx][depth]}`,
        factors: [factor('nakshatra', { label: `Lagna in ${NAKSHATRAS[nakIdx].name}` })],
      })
    }
  }

  const lp = lordParagraph(1, chart, depth, ctx)
  if (lp) paras.push(lp)

  for (const p of planetsIn(chart, 1)) {
    const para = placementParagraph(p.name, chart, depth, ctx)
    if (para) paras.push(para)
  }
  return { key: 'self', title: 'You', subtitle: 'Lagna — body, temperament, how you meet the world', paragraphs: paras }
}

function mindSection(chart, depth, ctx) {
  const paras = []
  const moon = chart.planets?.find(p => p.name === 'Moon')
  if (!moon) return null

  const sign = SIGNS[moon.sign]
  paras.push({
    text: `**Your Moon is in ${sign.name}**, in the ${ord(moon.house)} house. ` +
          (depth === 'practitioner' ? PLANETS_CONTENT.Moon.practitioner : PLANETS_CONTENT.Moon.beginner),
    factors: [factor('planet', { planet: 'Moon', label: `Moon in ${sign.name}` })],
  })

  const nakIdx = moon.nakshatraIndex
  if (nakIdx != null && NAKSHATRAS[nakIdx]) {
    const n = NAKSHATRAS[nakIdx]
    paras.push({
      text: `**Your janma nakshatra is ${n.name}** (pada ${moon.pada}, ruled by ${n.lord}). ${n[depth]}` +
        (depth === 'practitioner' ? ` This star sets your Vimshottari sequence and is the reference for Tarabala.` : ''),
      factors: [factor('nakshatra', { label: `Moon in ${n.name}` })],
    })
  }

  const mp = placementParagraph('Moon', chart, depth, ctx)
  if (mp) paras.push(mp)

  return { key: 'mind', title: 'Your mind', subtitle: 'Moon — emotion, instinct, what settles you', paragraphs: paras }
}

function makeHouseSection(key, title, subtitle, houses, karakas, chart, depth, ctx) {
  const paras = []
  for (const h of houses) {
    const lp = lordParagraph(h, chart, depth, ctx)
    if (lp) paras.push(lp)
    for (const p of planetsIn(chart, h)) {
      const para = placementParagraph(p.name, chart, depth, ctx)
      if (para) { paras.push(para); continue }
      // Covered by an earlier section (e.g. the Moon, always read under "Your
      // mind"). Still name it here — a planet sitting in this section's house
      // is too relevant to omit — but point rather than repeat.
      const ptr = pointerParagraph(p.name, chart, 'in-house')
      if (ptr) paras.push(ptr)
    }
  }
  for (const k of karakas) {
    const kp = chart.planets?.find(p => p.name === k)
    if (!kp || houses.includes(kp.house)) continue
    const para = placementParagraph(k, chart, depth, ctx)
    if (para) {
      para.text = `_${cap(nm(k))} is the natural karaka for this house._ ` + para.text
      paras.push(para)
    } else {
      // Already covered — point at it instead of repeating the paragraph.
      const ptr = pointerParagraph(k, chart, 'karaka')
      if (ptr) paras.push(ptr)
    }
  }
  return paras.length ? { key, title, subtitle, paragraphs: paras } : null
}

function currentPeriodSection(chart, depth, now = new Date()) {
  if (!Array.isArray(chart.dasha)) return null
  const within = n => n.start <= now && n.end > now
  const md = chart.dasha.find(within)
  if (!md) return null
  const ad = md.children?.find(within)

  const paras = []
  const theme = DASHA_LORDS[md.planet]
  const mdPlanet = chart.planets?.find(p => p.name === md.planet)

  if (theme) {
    let text = `**You are running ${md.planet} Mahadasha** ` +
      `(${md.start.toISOString().slice(0, 10)} → ${md.end.toISOString().slice(0, 10)}). ${theme[depth]}`
    if (mdPlanet) {
      const lagnaSign = chart.lagna.sign
      const rules = [1,2,3,4,5,6,7,8,9,10,11,12].filter(h => lordOfHouse(h, lagnaSign) === md.planet)
      text += ` In your chart ${md.planet} sits in the ${ord(mdPlanet.house)}` +
        (rules.length ? ` and rules your ${rules.map(ord).join(' and ')}` : '') +
        `, so that is where this period does its work — the generic theme matters less than this placement.`
    }
    paras.push({
      text,
      factors: [factor('dasha', { planet: md.planet, label: `${md.planet} MD` }),
                ...(mdPlanet ? [factor('planet', { planet: md.planet, label: `${md.planet} in ${ord(mdPlanet.house)}` })] : [])],
    })
  }

  if (ad && ANTAR_MODIFIER[ad.planet]) {
    const adPlanet = chart.planets?.find(p => p.name === ad.planet)
    paras.push({
      text: `**Within it, ${ad.planet} Antardasha** (${ad.start.toISOString().slice(0, 10)} → ${ad.end.toISOString().slice(0, 10)}) — ` +
        `${ANTAR_MODIFIER[ad.planet]}.` +
        (adPlanet ? ` ${ad.planet} sits in your ${ord(adPlanet.house)}.` : ''),
      factors: [factor('dasha', { planet: ad.planet, label: `${ad.planet} AD` })],
    })
  }

  return { key: 'period', title: 'Where you are now', subtitle: 'The running Vimshottari period', paragraphs: paras }
}

function yogaSection(chart, depth) {
  if (!Array.isArray(chart.yogas) || !chart.yogas.length) return null
  const paras = []
  for (const y of chart.yogas) {
    const m = yogaMeaning(y.key)
    if (!m) continue
    paras.push({
      text: `**${m.title}** ${m[depth]}` + (depth === 'practitioner' && y.description ? ` _(${y.description})_` : ''),
      factors: [factor('yoga', { yoga: y.key, label: y.name })],
      category: y.category,
    })
  }
  return paras.length ? { key: 'yogas', title: 'Combinations', subtitle: 'Yogas formed in your chart', paragraphs: paras } : null
}

/**
 * Build a full reading.
 *
 * @param {object} chart { planets, lagna, dasha?, yogas?, strength?, avasthas? }
 * @param {object} [opts] { depth: 'beginner'|'practitioner', now: Date }
 * @returns {{ depth, corpusVersion, sections: [{key,title,subtitle,paragraphs:[{text,factors}]}] }}
 */
export function buildReading(chart, { depth = 'beginner', now = new Date() } = {}) {
  if (!chart?.planets || !chart?.lagna) throw new Error('buildReading: chart.planets and chart.lagna are required')
  if (depth !== 'beginner' && depth !== 'practitioner') throw new Error(`buildReading: bad depth "${depth}"`)

  // Tracks what has already been said, so a planet's placement and strength are
  // each stated once across the whole reading rather than at every mention.
  const ctx = { placed: new Set(), qualified: new Set() }

  const sections = [
    selfSection(chart, depth, ctx),
    mindSection(chart, depth, ctx),
    makeHouseSection('career', 'Work in the world', 'The 10th — career, standing, what you do',
      [10], ['Sun', 'Saturn'], chart, depth, ctx),
    makeHouseSection('relationships', 'Partnership', 'The 7th — marriage, business partners, the other',
      [7], ['Venus'], chart, depth, ctx),
    makeHouseSection('wealth', 'Money', 'The 2nd and 11th — what you keep and what comes in',
      [2, 11], ['Jupiter'], chart, depth, ctx),
    currentPeriodSection(chart, depth, now),
    yogaSection(chart, depth),
  ].filter(Boolean)

  return { depth, corpusVersion: CORPUS_VERSION, sections }
}

/** Flat list of every factor a reading rests on — used by the AI layer later. */
export function readingFactors(reading) {
  const seen = new Set()
  const out = []
  for (const s of reading.sections) {
    for (const p of s.paragraphs) {
      for (const f of p.factors ?? []) {
        if (seen.has(f.key)) continue
        seen.add(f.key)
        out.push(f)
      }
    }
  }
  return out
}
