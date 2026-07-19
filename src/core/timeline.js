// src/core/timeline.js
// Data builders for the Life Timeline (B1): the lanes and markers that make a
// whole life legible on one axis — Vimshottari MD/AD bands, Sade Sati windows,
// slow-planet sign ingresses, and planetary returns.
//
// The dasha/Sade-Sati builders are pure (they consume already-computed
// structures) and unit-tested. The ephemeris scanners take an injectable `swe`
// (the same seam calcSadeSati/findNextEvents use) and are checked against the
// real ephemeris.

import { getSwe } from './swisseph.js'
import { PLANET_COLORS } from './aspects.js'
import { isFunctionalBenefic } from '../content/functional-nature.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const ABBR = { Sun:'Su', Moon:'Mo', Mars:'Ma', Mercury:'Me', Jupiter:'Ju', Venus:'Ve', Saturn:'Sa', Rahu:'Ra', Ketu:'Ke' }
const FLAGS = 65536 | 256 // SIDEREAL | SPEED

const norm = l => ((l % 360) + 360) % 360
const signOf = lon => Math.floor(norm(lon) / 30) + 1
const jdToDate = jd => new Date((jd - 2440587.5) * 86400000)
export const dateToJd = d => d.getTime() / 86400000 + 2440587.5

/** Colour for a planet name (falls back to a neutral grey). */
export function planetColor(name) {
  return PLANET_COLORS[ABBR[name]] ?? '#94a3b8'
}

// ── Dasha lanes (pure) ───────────────────────────────────────────────────────

/**
 * MD and AD bands from the Vimshottari tree. AD bands are only emitted for
 * mahadashas whose children are already computed (the tree eagerly builds
 * MD+AD, so this is normally the full set).
 * @returns {{ md: Band[], ad: Band[] }}
 */
export function buildDashaLanes(dasha) {
  if (!Array.isArray(dasha)) return { md: [], ad: [] }
  const md = [], ad = []
  for (const m of dasha) {
    md.push({ start: m.start, end: m.end, planet: m.planet, color: planetColor(m.planet), label: m.planet })
    for (const a of m.children ?? []) {
      ad.push({ start: a.start, end: a.end, planet: a.planet, color: planetColor(a.planet),
                label: a.planet, parent: m.planet })
    }
  }
  return { md, ad }
}

/** Sade Sati / Kantaka / Ashtama bands from a calcSadeSati report (pure). */
export function buildSadeSatiLane(report) {
  if (!report?.segments) return []
  const KIND_COLOR = { sadesati: '#64748b', kantaka: '#f59e0b', ashtama: '#ef4444' }
  return report.segments
    .filter(s => s.kind)
    .map(s => ({
      start: s.start, end: s.end, kind: s.kind, phase: s.phase,
      color: KIND_COLOR[s.kind] ?? '#94a3b8',
      label: s.kind === 'sadesati'
        ? `Sade Sati (${s.phase})`
        : (s.kind === 'kantaka' ? 'Kantaka' : 'Ashtama'),
      sign: s.signName,
    }))
}

// ── Ephemeris scanners ───────────────────────────────────────────────────────

function bodyLon(swe, bodyId, jd, isKetu) {
  const r = swe.calc_ut(jd, bodyId, FLAGS)
  return isKetu ? norm(r[0] + 180) : r[0]
}

/**
 * Sign ingresses of a body over [fromJd, toJd]. Bisects each crossing to ~1h.
 * @returns {{ jd, date, sign, signName, fromSign }[]}
 */
export function scanIngresses(swe, bodyId, fromJd, toJd, { stepDays = 5, isKetu = false } = {}) {
  const sgn = jd => signOf(bodyLon(swe, bodyId, jd, isKetu))
  const out = []
  let cur = sgn(fromJd)
  for (let jd = fromJd + stepDays; jd <= toJd + stepDays; jd += stepDays) {
    const clamped = Math.min(jd, toJd)
    const s = sgn(clamped)
    if (s !== cur) {
      let lo = clamped - stepDays, hi = clamped
      for (let i = 0; i < 24 && hi - lo > 1 / 24; i++) {
        const mid = (lo + hi) / 2
        if (sgn(mid) === cur) lo = mid; else hi = mid
      }
      const boundary = (lo + hi) / 2
      out.push({ jd: boundary, date: jdToDate(boundary), sign: s, signName: SIGN_NAMES[s - 1], fromSign: cur })
      cur = s
    }
    if (clamped >= toJd) break
  }
  return out
}

/**
 * Returns of a body to its natal sidereal longitude over [fromJd, toJd].
 *
 * A real return can cross the natal degree up to three times because of the
 * retrograde loop, and a slow body sits near its natal degree at birth too —
 * so raw zero-crossings would give several markers per return plus a
 * birth-adjacent one. `clusterDays` collapses crossings that belong to the
 * same event: a crossing is kept only if it is more than `clusterDays` past the
 * previous kept one *and* past `fromJd` (which is birth for a natal scan). The
 * default (400 d) is wider than any retrograde re-crossing span (~9 months for
 * Saturn) and far shorter than the shortest return period we mark (Jupiter,
 * ~12 y), so it never merges two distinct returns.
 *
 * @returns {{ jd, date }[]}
 */
export function planetaryReturns(swe, bodyId, natalLon, fromJd, toJd, { stepDays = 5, isKetu = false, clusterDays = 400 } = {}) {
  const diff = jd => {
    let d = norm(bodyLon(swe, bodyId, jd, isKetu) - natalLon)
    return d > 180 ? d - 360 : d       // signed, [-180, 180]
  }
  const out = []
  let prev = diff(fromJd)
  let lastKept = fromJd
  for (let jd = fromJd + stepDays; jd <= toJd; jd += stepDays) {
    const d = diff(jd)
    // crossing 0 from negative to positive (direct return), ignoring the ±180 wrap
    if (prev < 0 && d >= 0 && Math.abs(prev) < 90 && Math.abs(d) < 90) {
      let lo = jd - stepDays, hi = jd
      for (let i = 0; i < 24 && hi - lo > 1 / 24; i++) {
        const mid = (lo + hi) / 2
        if (diff(mid) < 0) lo = mid; else hi = mid
      }
      const j = (lo + hi) / 2
      if (j - lastKept > clusterDays) { out.push({ jd: j, date: jdToDate(j) }); lastKept = j }
    }
    prev = d
  }
  return out
}

const BODY = { Sun: 0, Moon: 1, Mercury: 2, Venus: 3, Mars: 4, Jupiter: 5, Saturn: 6, Rahu: 10, Ketu: 10 }

/**
 * The default slow-transit marker set for a lifetime view: Saturn & Rahu/Ketu
 * sign ingresses, plus Jupiter and Saturn returns. Needs `swe`.
 * @param {object} natalPlanets state.planets (for return longitudes)
 */
export function buildTransitMarkers(natalPlanets, fromJd, toJd, swe = getSwe()) {
  const markers = []
  const natal = Object.fromEntries((natalPlanets ?? []).map(p => [p.name, p.lon]))

  for (const sat of scanIngresses(swe, BODY.Saturn, fromJd, toJd))
    markers.push({ date: sat.date, kind: 'ingress', planet: 'Saturn', color: planetColor('Saturn'),
                   label: `Saturn → ${sat.signName}` })
  for (const ra of scanIngresses(swe, BODY.Rahu, fromJd, toJd))
    markers.push({ date: ra.date, kind: 'ingress', planet: 'Rahu', color: planetColor('Rahu'),
                   label: `Rahu → ${ra.signName}` })

  if (natal.Jupiter != null)
    for (const r of planetaryReturns(swe, BODY.Jupiter, natal.Jupiter, fromJd, toJd))
      markers.push({ date: r.date, kind: 'return', planet: 'Jupiter', color: planetColor('Jupiter'),
                     label: 'Jupiter return' })
  if (natal.Saturn != null)
    for (const r of planetaryReturns(swe, BODY.Saturn, natal.Saturn, fromJd, toJd))
      markers.push({ date: r.date, kind: 'return', planet: 'Saturn', color: planetColor('Saturn'),
                     label: 'Saturn return' })

  markers.sort((a, b) => a.date - b.date)
  return markers
}

// ── Dasha synchrony (D2, pure) ───────────────────────────────────────────────

/** Running Mahadasha lord of a tree at a time. */
function mdLordAt(dasha, t) {
  const m = dasha.find(n => n.start.getTime() <= t && n.end.getTime() > t)
  return m?.planet ?? null
}

/**
 * Classify how two people's Mahadasha periods overlap across a window — the
 * "relationship weather". For each sub-interval where both lords are steady,
 * each lord is judged by that person's OWN lagna (a planet benefic for one
 * chart can be malefic for the other), then combined:
 *   both functional benefic  → 'harmonious'
 *   both functional malefic   → 'stormy'
 *   otherwise                 → 'mixed'
 *
 * @returns {{ start, end, p1Lord, p2Lord, tone }[]}
 */
export function dashaSynchrony(dasha1, lagna1, dasha2, lagna2, from, to) {
  if (!Array.isArray(dasha1) || !Array.isArray(dasha2)) return []
  const t0 = from.getTime(), t1 = to.getTime()
  if (!(t1 > t0)) return []

  // Boundaries = every MD start/end from either tree that falls in the window.
  const bounds = new Set([t0, t1])
  for (const tree of [dasha1, dasha2])
    for (const m of tree) {
      const s = m.start.getTime(), e = m.end.getTime()
      if (s > t0 && s < t1) bounds.add(s)
      if (e > t0 && e < t1) bounds.add(e)
    }
  const sorted = [...bounds].sort((a, b) => a - b)

  const out = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const mid = (sorted[i] + sorted[i + 1]) / 2
    const p1 = mdLordAt(dasha1, mid), p2 = mdLordAt(dasha2, mid)
    if (!p1 || !p2) continue
    const b1 = isFunctionalBenefic(p1, lagna1)
    const b2 = isFunctionalBenefic(p2, lagna2)
    const tone = b1 && b2 ? 'harmonious' : (!b1 && !b2 ? 'stormy' : 'mixed')
    // Merge adjacent intervals with the same lords + tone.
    const prev = out[out.length - 1]
    if (prev && prev.p1Lord === p1 && prev.p2Lord === p2 && prev.tone === tone) {
      prev.end = new Date(sorted[i + 1])
    } else {
      out.push({ start: new Date(sorted[i]), end: new Date(sorted[i + 1]), p1Lord: p1, p2Lord: p2, tone })
    }
  }
  return out
}

export const SYNCHRONY_COLOR = { harmonious: '#10b981', mixed: '#f59e0b', stormy: '#ef4444' }

/** The dasha stack (MD/AD/PD names) at a moment — for the click popover. */
export function dashaStackAt(dasha, date) {
  const t = date instanceof Date ? date.getTime() : date
  const within = n => n.start.getTime() <= t && n.end.getTime() > t
  const md = Array.isArray(dasha) ? dasha.find(within) : null
  const ad = md?.children?.find(within) ?? null
  const pd = ad?.children?.find(within) ?? null
  return { md: md?.planet ?? null, ad: ad?.planet ?? null, pd: pd?.planet ?? null, mdNode: md, adNode: ad }
}
