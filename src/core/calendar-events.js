// src/core/calendar-events.js
// Merges everything the app already knows how to date — transit forecast
// events, Vimshottari period changes, Sade Sati phase boundaries and lunar
// birthdays — into one chronological, filterable stream for the Calendar page
// and the iCal export.
//
// The collectors are pure (they take already-computed structures), so they are
// unit-tested without an ephemeris; only `buildCalendarEvents` needs `swe`,
// because it drives the transit forecast.

import { PLANETS } from './swisseph.js'
import { findNextEvents } from './transitForecast.js'
import { annotateActivations } from './activation.js'
import { getTZOffsetMinutes } from '../utils/time.js'

/** Event families — the Calendar's filter chips map 1:1 onto these. */
export const EVENT_TYPES = {
  dasha:    { label: 'Dasha changes', emoji: '◆' },
  sadesati: { label: 'Sade Sati',     emoji: '🪐' },
  birthday: { label: 'Lunar birthday', emoji: '🎂' },
  ingress:  { label: 'Sign changes',  emoji: '→' },
  station:  { label: 'Retrograde / direct', emoji: '℞' },
  aspect:   { label: 'Natal aspects', emoji: '◈' },
  nakshatra:{ label: 'Nakshatra / pāda', emoji: '★' },
  combust:  { label: 'Combustion',    emoji: '☀' },
  gandanta: { label: 'Gandanta',      emoji: '⚠' },
}

/** Map a transitForecast event type onto a calendar family. */
const FORECAST_FAMILY = {
  sign: 'ingress',
  retro: 'station', direct: 'station',
  natal_aspect: 'aspect',
  nakshatra: 'nakshatra', pada: 'nakshatra',
  combust_enter: 'combust', combust_exit: 'combust',
  gandanta: 'gandanta',
}

/** Local "YYYY-MM-DD" for a Date in a timezone — the calendar's day bucket. */
export function localIso(date, timezone = '+00:00') {
  const off = getTZOffsetMinutes(date, timezone)
  return new Date(date.getTime() + off * 60000).toISOString().slice(0, 10)
}

const inRange = (d, from, to) => d >= from && d <= to

/**
 * Vimshottari period starts within a range. Walks whatever levels are already
 * computed — the tree builds levels ≥3 lazily, so Pratyantara rows appear only
 * once something has expanded them (matching the Dasha tab).
 *
 * @param {object[]} dasha maha-level tree
 * @returns {object[]} events
 */
export function collectDashaEvents(dasha, from, to, timezone = '+00:00') {
  if (!Array.isArray(dasha)) return []
  const out = []
  const LEVELS = ['Mahadasha', 'Antardasha', 'Pratyantara']

  const walk = (nodes, depth, path) => {
    if (depth >= LEVELS.length) return
    for (const n of nodes ?? []) {
      // A period that starts before the window can still contain it, so recurse
      // into any node that overlaps the range at all.
      if (n.end < from || n.start > to) continue
      if (inRange(n.start, from, to)) {
        const chain = [...path, n.planet]
        out.push({
          type: 'dasha',
          subtype: LEVELS[depth],
          date: n.start,
          iso: localIso(n.start, timezone),
          label: `${chain.join(' › ')} ${['MD','AD','PD'][depth]} begins`,
          detail: `${LEVELS[depth]} of ${n.planet}${depth > 0 ? ` in ${path.join(' › ')}` : ''}`,
          planet: n.planet,
          level: ['MD', 'AD', 'PD'][depth],
        })
      }
      walk(n.children, depth + 1, [...path, n.planet])
    }
  }
  walk(dasha, 0, [])
  return out
}

/**
 * Sade Sati / Kantaka / Ashtama phase boundaries within a range.
 * @param {object} report calcSadeSati output
 */
export function collectSadeSatiEvents(report, from, to, timezone = '+00:00') {
  if (!report?.segments) return []
  const out = []
  for (const seg of report.segments) {
    if (!seg.kind || !inRange(seg.start, from, to)) continue
    out.push({
      type: 'sadesati',
      subtype: seg.kind,
      date: seg.start,
      iso: localIso(seg.start, timezone),
      label: seg.label,
      detail: `Saturn enters ${seg.signName} — runs to ${seg.end.toISOString().slice(0, 10)}`,
      planet: 'Saturn',
      phase: seg.phase ?? null,
    })
  }
  return out
}

/**
 * Lunar (tithi) birthdays within a range.
 * @param {object} lunar computeLunarBirthday output ({ lunar, upcoming })
 */
export function collectLunarBirthdayEvents(lunar, from, to, timezone = '+00:00') {
  if (!lunar?.upcoming) return []
  const out = []
  for (const u of lunar.upcoming) {
    if (!inRange(u.date, from, to)) continue
    out.push({
      type: 'birthday',
      subtype: 'lunar',
      date: u.date,
      iso: u.iso ?? localIso(u.date, timezone),
      label: `Lunar birthday${u.turns != null ? ` — turns ${u.turns}` : ''}`,
      detail: lunar.lunar
        ? `${lunar.lunar.monthName ?? ''} ${lunar.lunar.paksha ?? ''} ${lunar.lunar.tithiName ?? ''}`.trim()
        : '',
      allDay: true,
    })
  }
  return out
}

/** Convert transitForecast events for one planet into calendar events. */
export function collectForecastEvents(events, planetName, from, to, timezone = '+00:00') {
  const out = []
  for (const ev of events ?? []) {
    if (!inRange(ev.date, from, to)) continue
    const family = FORECAST_FAMILY[ev.type]
    if (!family) continue
    out.push({
      type: family,
      subtype: ev.type,
      date: ev.date,
      iso: localIso(ev.date, timezone),
      label: `${planetName} ${ev.label}`,
      detail: ev.detail ?? '',
      planet: planetName,
      activation: ev.activation ?? null,
    })
  }
  return out
}

/** Merge and sort event lists chronologically. */
export function mergeEvents(...lists) {
  return lists.flat().filter(Boolean).sort((a, b) => a.date - b.date)
}

/** Bucket events by their local ISO day — what the month grid renders. */
export function groupByDay(events) {
  const map = new Map()
  for (const ev of events) {
    if (!map.has(ev.iso)) map.set(ev.iso, [])
    map.get(ev.iso).push(ev)
  }
  return map
}

/**
 * Build the full event stream for a range.
 *
 * ⚠ Transit reach: `findNextEvents` scans a fixed window per planet (Moon 30 d
 * … Saturn 730 d), so a range extending past the Moon's 30-day window silently
 * loses Moon events at the far end. The Calendar drives this a month at a time,
 * which sits inside every planet's window.
 *
 * @param {object} opts
 *   from, to   — Date bounds (inclusive)
 *   planets, lagna — natal chart (for the forecast's aspect targets)
 *   dasha      — Vimshottari tree (optional)
 *   sadesati   — calcSadeSati report (optional)
 *   lunar      — computeLunarBirthday output (optional)
 *   timezone   — display timezone for day bucketing
 *   swe        — ephemeris (findNextEvents uses the singleton if omitted)
 */
export function buildCalendarEvents({
  from, to, planets, lagna, dasha = null, sadesati = null, lunar = null,
  timezone = '+00:00', fromJd = null, swe = null,
} = {}) {
  const lists = []

  if (planets && lagna && fromJd != null) {
    for (const p of PLANETS) {
      let evs
      try {
        evs = findNextEvents(p, fromJd, planets, lagna.sign, swe)
      } catch { continue }
      if (dasha) annotateActivations(evs, dasha, p.name)
      lists.push(collectForecastEvents(evs, p.name, from, to, timezone))
    }
  }
  if (dasha)    lists.push(collectDashaEvents(dasha, from, to, timezone))
  if (sadesati) lists.push(collectSadeSatiEvents(sadesati, from, to, timezone))
  if (lunar)    lists.push(collectLunarBirthdayEvents(lunar, from, to, timezone))

  return mergeEvents(...lists)
}

/** Lowercase alphanumeric slug for UID discrimination. */
const slug = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

/**
 * Calendar events → the shape `buildIcs` expects.
 *
 * ⚠ The UID must discriminate on `label`, not just type+time+planet: a sign
 * ingress emits several `natal_aspect` events at the SAME instant for the SAME
 * transiting planet (one per natal planet it now aspects). Colliding UIDs make
 * calendar clients treat those as one event and overwrite it, silently dropping
 * the rest on import. The parts are all semantic, so a re-export of the same
 * event keeps its UID — which is what lets a subscription update in place.
 */
export function eventsToIcs(events, { personName = '' } = {}) {
  return events.map(ev => ({
    uid: `hp-${ev.type}-${ev.date.getTime()}-${slug(ev.planet ?? 'x')}-${slug(ev.detail || ev.label)}@hora-prakash`,
    summary: personName ? `${ev.label} — ${personName}` : ev.label,
    description: [ev.detail, ev.activation ? `Dasha activation: ${ev.activation.levels.join('+')} ${ev.activation.planet}` : '']
      .filter(Boolean).join('\n'),
    // Astrological events are instants, but they read better as all-day entries
    // in a calendar client; timed ones would imply a precision the scan's
    // 1-hour bisection does not have.
    start: ev.iso,
  }))
}
