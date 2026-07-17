// src/tabs/reading-tools.js
// Executes the chat's chart tools (A3) against the live chart. Kept apart from
// ai.js because it needs browser state and the WASM ephemeris; ai.js stays
// Node-safe. The model calls these by name — so timing answers are COMPUTED
// from the same engines the rest of the app uses, not guessed.

import { state } from '../state.js'
import { getSwe } from '../core/swisseph.js'
import { calcDivisional } from '../core/divisional.js'
import { dashaLordsAt } from '../core/activation.js'
import { findNextEvents } from '../core/transitForecast.js'
import { findMuhurta } from '../core/muhurta.js'
import { PLANETS } from '../core/swisseph.js'
import { toJulianDay, dateToJd } from '../utils/time.js'
import { annotateActivations } from '../core/activation.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const ord = n => ['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th'][n] ?? `${n}th`

const parseDate = s => {
  const d = new Date((s || '').slice(0, 10) + 'T12:00:00Z')
  return isNaN(d) ? new Date() : d
}

/** Dispatch a chart tool call to the real compute. Returns a plain object. */
export async function executeChartTool(name, input = {}) {
  if (!state.planets || !state.lagna) return { error: 'No chart is loaded.' }
  // Any failure (incl. an uninitialised ephemeris) becomes an error object the
  // model can reason about — a tool must never throw into the chat loop.
  try {
    return await dispatchChartTool(name, input)
  } catch (err) {
    return { error: err?.message || String(err) }
  }
}

async function dispatchChartTool(name, input) {
  switch (name) {
    case 'get_positions': {
      const div = (input.division || 'D1').toUpperCase()
      const { planets, lagna } = calcDivisional(state.planets, state.lagna, div)
      return {
        division: div,
        lagna: SIGN_NAMES[lagna.sign - 1],
        planets: planets.map(p => ({
          name: p.name,
          sign: SIGN_NAMES[p.sign - 1],
          house: ((p.sign - lagna.sign + 12) % 12) + 1,
          retrograde: !!p.retrograde,
        })),
      }
    }

    case 'get_dasha_at': {
      const date = parseDate(input.date)
      const lords = dashaLordsAt(state.dasha, date)
      return {
        date: date.toISOString().slice(0, 10),
        mahadasha: lords.md,
        antardasha: lords.ad,
        pratyantara: lords.pd,
        note: lords.pd == null ? 'Pratyantara is computed lazily; expand the Dasha tab to that depth for it.' : undefined,
      }
    }

    case 'find_transit_events': {
      const from = parseDate(input.from), to = parseDate(input.to)
      const tz = state.birth?.timezone ?? '+00:00'
      const fromJd = toJulianDay(from.toISOString().slice(0, 10), '00:00', tz)
      const swe = getSwe()
      const events = []
      for (const p of PLANETS) {
        let evs
        try { evs = findNextEvents(p, fromJd, state.planets, state.lagna.sign, swe) } catch { continue }
        annotateActivations(evs, state.dasha, p.name)
        for (const e of evs) {
          if (e.date >= from && e.date <= to)
            events.push({
              date: e.date.toISOString().slice(0, 10),
              planet: p.name,
              event: e.label,
              activatesDashaLord: e.activation ? `${e.activation.levels.join('+')} ${e.activation.planet}` : undefined,
            })
        }
      }
      events.sort((a, b) => a.date.localeCompare(b.date))
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), count: events.length, events: events.slice(0, 40) }
    }

    case 'find_muhurta': {
      const moon = state.planets.find(p => p.name === 'Moon')
      const res = findMuhurta({
        activity: input.activity,
        from: (input.from || '').slice(0, 10),
        to: (input.to || '').slice(0, 10),
        lat: state.birth.lat, lon: state.birth.lon, timezone: state.birth?.timezone ?? '+00:00',
        natal: moon ? { janmaNak: moon.nakshatraIndex, moonSign: moon.sign } : null,
        swe: getSwe(),
      })
      return {
        activity: input.activity,
        checked: res.scanned,
        windows: res.windows.slice(0, 8).map(w => ({
          date: w.dateStr,
          grade: w.grade,
          score: `${Math.round(w.pct * 100)}%`,
          nakshatra: w.nakshatra,
          tithi: w.tithi,
        })),
      }
    }

    case 'get_strength': {
      const sh = state.strength?.shadbala
      const sarva = state.strength?.sarva
      if (!sh) return { error: 'Strength has not been computed for this chart.' }
      return {
        shadbala: Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, { ratio: Number(v.ratio?.toFixed?.(2) ?? v.ratio), meetsRequirement: v.ratio >= 1 }])),
        sarvashtakavarga: Array.isArray(sarva)
          ? Object.fromEntries(sarva.map((n, i) => [SIGN_NAMES[i], n]))
          : undefined,
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
