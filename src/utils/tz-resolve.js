// src/utils/tz-resolve.js
//
// Exact offline coordinate → IANA zone resolution, via @photostructure/tz-lookup
// (packed time-zone *boundary* data, ~30 kB gzipped, lazily loaded on first use).
//
// This replaces the nearest-bundled-city heuristic (nearest-zone.js) as the
// primary resolver because the bundled city DB covers only ~49 countries, and
// nearest-city snapping is wrong across borders: Yerevan's nearest bundled city
// is Vladikavkaz, Russia (~300 km, Europe/Moscow), but a July 1982 Yerevan birth
// must be Asia/Yerevan +5 (USSR summer time), not Moscow's +4. Boundary lookup
// answers correctly for every country — including all the ones missing from the
// city DB — and returns nautical Etc/GMT±N zones for open ocean.

let lookupPromise = null
function loadLookup() {
  if (!lookupPromise) {
    lookupPromise = import('@photostructure/tz-lookup')
      .then(m => m.default ?? m)
      .catch(() => null) // chunk unavailable (e.g. offline before it was cached)
  }
  return lookupPromise
}

/**
 * Exact IANA zone for coordinates, or null when unresolvable — invalid coords,
 * the boundary-data chunk failed to load, or the zone name isn't in this
 * runtime's tz database (old ICU); callers then use their own fallbacks.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string|null>}
 */
export async function zoneFromCoords(lat, lon) {
  if (!isFinite(lat) || !isFinite(lon)) return null
  const tzlookup = await loadLookup()
  if (!tzlookup) return null
  try {
    const zone = tzlookup(lat, lon)
    // Validate against the runtime's own tz database, so a zone name newer
    // than the local ICU (e.g. Europe/Kyiv on an old engine) can't leak into
    // birth records where Intl would later throw on it.
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    return null
  }
}

/**
 * Re-resolve cached location entries' timezones against the boundary data.
 *
 * The location cache (localStorage) outlives data fixes: entries saved before
 * the city DB carried IANA zones — or saved from a mislabelled online lookup
 * (timeapi.io reported Perm as Europe/Moscow +3; it is Asia/Yekaterinburg +5) —
 * keep serving their stale `tz` forever, and they rank *above* the corrected
 * bundled entry in search results. Overwrites only with an exact boundary
 * answer, never a nearest-city guess, so a correct cached zone can't be
 * corrupted when the resolver is unavailable.
 *
 * @param {Array<{displayName:string,lat:number,lon:number,tz?:string}>} entries
 * @returns {Promise<Array>} same entries, `tz` replaced where boundaries disagree
 */
export async function reconcileCachedZones(entries) {
  return Promise.all(entries.map(async e => {
    const zone = await zoneFromCoords(e.lat, e.lon)
    return zone && zone !== e.tz ? { ...e, tz: zone } : e
  }))
}
