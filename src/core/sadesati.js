// src/core/sadesati.js
// Sade Sati / Kantaka / Ashtama Shani: Saturn's transit phases relative to the
// natal Moon sign. Scans Saturn's sidereal sign occupancy across a JD range
// (catching retrograde bounces across sign boundaries), classifies each
// contiguous segment, and groups the 12th/1st/2nd-from-Moon runs into Sade
// Sati windows.
//
// Node-safe: pass `swe` (anything with calc_ut) to avoid the WASM singleton —
// tests inject a synthetic ephemeris (see tests/sadesati.test.mjs).

import { getSwe } from './swisseph.js'

const SATURN_ID = 6
const FLAGS = 65536 | 256 // SIDEREAL | SPEED — matches transitForecast.js

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

function signOf(lon) { return Math.floor(((lon % 360) + 360) % 360 / 30) + 1 }

function jdToDate(jd) { return new Date((jd - 2440587.5) * 86400000) }

export function dateToJd(date) { return date.getTime() / 86400000 + 2440587.5 }

/**
 * Classify Saturn's sign relative to the natal Moon sign.
 * @returns {{ kind, phase?, label }|null} null when the position is unremarkable.
 *   kind: 'sadesati' (offsets 12th/1st/2nd) | 'kantaka' (4th) | 'ashtama' (8th)
 */
export function classifySaturn(satSign, moonSign) {
  const offset = ((satSign - moonSign) % 12 + 12) % 12
  switch (offset) {
    case 11: return { kind: 'sadesati', phase: 'rising',  label: 'Sade Sati — first phase (12th from Moon)' }
    case 0:  return { kind: 'sadesati', phase: 'peak',    label: 'Sade Sati — peak (over natal Moon)' }
    case 1:  return { kind: 'sadesati', phase: 'setting', label: 'Sade Sati — final phase (2nd from Moon)' }
    case 3:  return { kind: 'kantaka',  label: 'Kantaka Shani (4th from Moon)' }
    case 7:  return { kind: 'ashtama',  label: 'Ashtama Shani (8th from Moon)' }
    default: return null
  }
}

/**
 * Scan Saturn's sign occupancy over [fromJd, toJd].
 * Steps `stepDays` at a time and bisects each flip to ~1 hour.
 *
 * ⚠ Resolution guarantee: a fixed step detects every stay LONGER than
 * `stepDays` (at least one sample must land inside it), and only those.
 * Real Saturn does produce short retrograde dips across a sign boundary —
 * e.g. it re-enters Libra for just 9.5 days in Feb 2041 — so the 5-day
 * default keeps roughly a 2× margin over the shortest dips seen in a
 * 90-year scan. A "grazing" ingress shorter than the step (possible when a
 * station falls a hair past a boundary) is not resolved; raise the step only
 * with that in mind. Covered by tests/sadesati.ephemeris.test.mjs.
 *
 * @returns {{ sign, startJd, endJd }[]} contiguous segments partitioning the range
 */
export function scanSaturnSigns(fromJd, toJd, { swe = getSwe(), stepDays = 5 } = {}) {
  const satSign = jd => {
    const r = swe.calc_ut(jd, SATURN_ID, FLAGS)
    return signOf(r[0])
  }

  const segments = []
  let segStart = fromJd
  let curSign  = satSign(fromJd)

  for (let jd = fromJd + stepDays; jd < toJd + stepDays; jd += stepDays) {
    const clamped = Math.min(jd, toJd)
    const sgn = satSign(clamped)
    if (sgn !== curSign) {
      // bisect the boundary between (clamped - stepDays, clamped]
      let lo = clamped - stepDays, hi = clamped
      for (let i = 0; i < 24 && hi - lo > 1 / 24; i++) {
        const mid = (lo + hi) / 2
        if (satSign(mid) === curSign) lo = mid
        else hi = mid
      }
      const boundary = (lo + hi) / 2
      segments.push({ sign: curSign, startJd: segStart, endJd: boundary })
      segStart = boundary
      curSign  = sgn
    }
    if (clamped >= toJd) break
  }
  segments.push({ sign: curSign, startJd: segStart, endJd: toJd })
  return segments
}

/**
 * Group adjacent sadesati-kind segments into whole Sade Sati windows.
 * The scan output is contiguous, so a window is simply a maximal run of
 * segments classified 'sadesati' (retrograde bounces between the three
 * phases stay inside one window).
 */
export function groupSadeSatiWindows(segments) {
  const windows = []
  let run = []
  for (const seg of segments) {
    if (seg.kind === 'sadesati') {
      run.push(seg)
    } else if (run.length) {
      windows.push(run)
      run = []
    }
  }
  if (run.length) windows.push(run)
  return windows.map(segs => ({
    startJd: segs[0].startJd,
    endJd:   segs[segs.length - 1].endJd,
    start:   jdToDate(segs[0].startJd),
    end:     jdToDate(segs[segs.length - 1].endJd),
    segments: segs,
  }))
}

/**
 * Full Sade Sati / Kantaka / Ashtama report for a chart.
 *
 * @param {number} moonSign natal Moon sign (1–12)
 * @param {object} opts
 *   fromJd/toJd — scan range (typically birth → birth + ~90y)
 *   swe         — ephemeris (defaults to the WASM singleton)
 *   now         — reference Date for `current` flags
 * @returns {{
 *   segments: [{ sign, signName, offsetKind, phase, label, startJd, endJd, start, end, current }],
 *   windows:  [{ start, end, startJd, endJd, segments, current }],
 *   current:  segment|null   — the currently running classified segment, if any
 * }}
 */
export function calcSadeSati(moonSign, { fromJd, toJd, swe = getSwe(), now = new Date(), stepDays = 5 } = {}) {
  if (!(moonSign >= 1 && moonSign <= 12)) throw new Error('calcSadeSati: moonSign 1-12 required')
  if (!(fromJd < toJd)) throw new Error('calcSadeSati: fromJd < toJd required')

  const nowJd = dateToJd(now)
  const raw = scanSaturnSigns(fromJd, toJd, { swe, stepDays })

  const segments = raw.map(s => {
    const cls = classifySaturn(s.sign, moonSign)
    return {
      sign: s.sign,
      signName: SIGN_NAMES[s.sign - 1],
      kind:  cls?.kind ?? null,
      phase: cls?.phase ?? null,
      label: cls?.label ?? null,
      startJd: s.startJd,
      endJd:   s.endJd,
      start: jdToDate(s.startJd),
      end:   jdToDate(s.endJd),
      current: s.startJd <= nowJd && nowJd < s.endJd,
    }
  })

  const windows = groupSadeSatiWindows(segments).map(w => ({
    ...w,
    current: w.startJd <= nowJd && nowJd < w.endJd,
  }))

  const current = segments.find(s => s.current && s.kind) ?? null

  return { segments, windows, current }
}
