// src/utils/nearest-zone.js
//
// Nearest bundled-city timezone from coordinates — an offline, accurate
// alternative to a flaky online lat/lon → zone API.
//
// The bundled city DB (public/places.json) is a ~13k-point coordinate → IANA
// zone dataset, resolved at build time with geo-tz. The nearest city's zone is
// therefore a reliable answer for any inhabited coordinate, and — crucially —
// it stays consistent with picking that same city from the search box, so the
// "auto-detect from coordinates" button can't overwrite a correct zone with a
// mislabelled online one (e.g. timeapi.io reporting Perm as Europe/Moscow +3
// when it is Asia/Yekaterinburg +5).

/**
 * Zone of the nearest place within `maxDeg` degrees, or null if the nearest is
 * farther than that (or the list is empty / coords invalid). Distance uses an
 * equirectangular, latitude-corrected metric — accurate enough for picking the
 * nearest neighbour among city points.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Array<{a:number,o:number,t?:string,z?:string}>} places
 * @param {number} [maxDeg=3] cutoff before falling back to an online lookup
 * @returns {string|null} IANA zone name (or numeric offset fallback), or null
 */
export function nearestZone(lat, lon, places, maxDeg = 3) {
  if (!Array.isArray(places) || places.length === 0) return null
  if (!isFinite(lat) || !isFinite(lon)) return null
  const cosLat = Math.cos((lat * Math.PI) / 180)
  let best = null
  let bestD = Infinity
  for (const e of places) {
    const dLat = e.a - lat
    const dLon = (e.o - lon) * cosLat
    const d = dLat * dLat + dLon * dLon
    if (d < bestD) { bestD = d; best = e }
  }
  if (!best || Math.sqrt(bestD) > maxDeg) return null
  return best.t || best.z || null
}
