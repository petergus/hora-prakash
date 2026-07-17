// src/core/activation.js
// Dasha–transit "double activation": classical timing weighs a transit far more
// heavily when it involves the lords of the running Vimshottari periods. This
// module annotates transit-forecast events (findNextEvents output) with the
// running MD/AD/PD lords *at each event's date*.
//
// Pure and Node-safe — no ephemeris, no DOM. The Pratyantara level is only
// consulted when it is already computed (the dasha tree builds levels ≥3
// lazily via ensureChildren).

const ABBR_TO_NAME = {
  Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter',
  Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu',
}

// Event types that describe a state change of the transiting planet itself
const SELF_EVENT_TYPES = new Set(['sign', 'retro', 'direct', 'combust_enter', 'combust_exit', 'gandanta'])

/**
 * Running Vimshottari lords at a date.
 * @param {object[]} dasha  the maha-level dasha tree
 * @param {Date|number} date
 * @returns {{ md: string|null, ad: string|null, pd: string|null }}
 */
export function dashaLordsAt(dasha, date) {
  const t = date instanceof Date ? date.getTime() : date
  const within = n => n.start.getTime() <= t && n.end.getTime() > t
  const md = Array.isArray(dasha) ? dasha.find(within) ?? null : null
  const ad = md?.children?.find(within) ?? null
  const pd = ad?.children?.find(within) ?? null
  return { md: md?.planet ?? null, ad: ad?.planet ?? null, pd: pd?.planet ?? null }
}

/**
 * Annotate forecast events with dasha activations.
 * Adds `ev.activation = { planet, levels: ['MD'|'AD'|'PD'], kind }` where
 *  - kind 'transit-to-lord': the transiting planet conjoins/aspects a natal
 *    planet that is a running dasha lord (strongest signal), or
 *  - kind 'lord-transit': the transiting planet *is* a running lord and
 *    changes state (sign ingress, station, combustion, gandanta).
 * Events with no dasha contact are left untouched. Returns the same array.
 *
 * @param {object[]} events            findNextEvents output
 * @param {object[]} dasha             maha-level dasha tree
 * @param {string}   transitPlanetName full name of the transiting planet
 */
export function annotateActivations(events, dasha, transitPlanetName) {
  if (!Array.isArray(events) || !Array.isArray(dasha)) return events

  for (const ev of events) {
    if (!(ev?.date instanceof Date)) continue
    const lords = dashaLordsAt(dasha, ev.date)
    const levelsOf = name => {
      const lv = []
      if (lords.md === name) lv.push('MD')
      if (lords.ad === name) lv.push('AD')
      if (lords.pd === name) lv.push('PD')
      return lv
    }

    if (ev.type === 'natal_aspect') {
      const natalName = ABBR_TO_NAME[ev.detail] ?? ev.detail
      const toLevels = levelsOf(natalName)
      if (toLevels.length) {
        ev.activation = { planet: natalName, levels: toLevels, kind: 'transit-to-lord' }
        continue
      }
      const byLevels = levelsOf(transitPlanetName)
      if (byLevels.length) {
        ev.activation = { planet: transitPlanetName, levels: byLevels, kind: 'lord-transit' }
      }
    } else if (SELF_EVENT_TYPES.has(ev.type)) {
      const byLevels = levelsOf(transitPlanetName)
      if (byLevels.length) {
        ev.activation = { planet: transitPlanetName, levels: byLevels, kind: 'lord-transit' }
      }
    }
  }
  return events
}

/** Short badge text for an activation, e.g. "⚡ MD·AD Saturn". */
export function activationBadge(activation) {
  if (!activation) return ''
  return `⚡ ${activation.levels.join('·')}`
}

/** Hover text explaining an activation. */
export function activationTitle(activation) {
  if (!activation) return ''
  const levelNames = { MD: 'Mahadasha', AD: 'Antardasha', PD: 'Pratyantara' }
  const lv = activation.levels.map(l => levelNames[l] ?? l).join(' + ')
  return activation.kind === 'transit-to-lord'
    ? `Dasha activation: touches natal ${activation.planet}, the running ${lv} lord`
    : `Dasha activation: ${activation.planet} is the running ${lv} lord`
}
