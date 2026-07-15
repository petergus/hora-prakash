// src/utils/geocoding.js
// places.json schema: { n: name, a: lat, o: lon, t: iana_zone [, z: numeric_offset] }
// `t` is an IANA zone name (e.g. "America/Denver") resolved offline at build
// time (scripts/enrich-places-tz.js) so the app can derive the birth-instant
// offset with DST/historical rules. `z` (fixed numeric offset) survives only on
// the rare entries where no zone could be resolved, as a fallback.
import { searchCache } from './location-cache.js'
import { nearestZone } from './nearest-zone.js'
import { zoneFromCoords, reconcileCachedZones } from './tz-resolve.js'

const PLACES_URL = `${import.meta.env.BASE_URL}places.json`
let placesPromise = null

function loadPlaces() {
  if (!placesPromise) {
    placesPromise = fetch(PLACES_URL)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
  }
  return placesPromise
}

function searchPlaces(query, data) {
  const q = query.toLowerCase().trim()
  const results = []
  for (const entry of data) {
    if (entry.n.toLowerCase().includes(q)) {
      // Prefer the IANA zone (`t`); fall back to a legacy numeric offset (`z`).
      results.push({ displayName: entry.n, lat: entry.a, lon: entry.o, tz: entry.t || entry.z })
      if (results.length === 5) break
    }
  }
  return results
}

async function fetchNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'aditya-amrit-hora/1.0' } })
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`)
  const data = await res.json()
  return data.map(item => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    tz: null,  // caller must resolve via getTimezone()
  }))
}

/**
 * Search locations. Returns { results, isLocal }.
 * results: array of { displayName, lat, lon, tz }
 * isLocal: true when results came from cache/places.json (not Nominatim)
 * tz is an IANA zone name for local results (rarely a ±HH:MM fallback), null for
 * Nominatim results (resolve via getTimezone()).
 * Order: localStorage cache → places.json → Nominatim API.
 */
export async function searchLocation(query) {
  if (!query || query.length < 3) return { results: [], isLocal: false }

  // 1. LRU cache — with each hit's zone re-resolved against the tz boundary
  // data. Cache hits rank above (and shadow) the corrected places.json entry,
  // so a zone cached before the DB carried IANA names — e.g. Perm as
  // Europe/Moscow +3 instead of Asia/Yekaterinburg +5 — would otherwise serve
  // a stale offset forever. Selecting a suggestion re-caches it, so stale
  // entries self-heal.
  const [cacheHits, places] = await Promise.all([
    reconcileCachedZones(searchCache(query)),
    loadPlaces(),
  ])

  // 2. places.json
  const localHits = searchPlaces(query, places)

  // Deduplicate local hits against cache hits by displayName
  const cacheNames = new Set(cacheHits.map(e => e.displayName))
  const deduped = localHits.filter(e => !cacheNames.has(e.displayName))

  const combined = [...cacheHits, ...deduped]
  if (combined.length > 0) return { results: combined.slice(0, 5), isLocal: true }

  // 3. Nominatim fallback
  return { results: await fetchNominatim(query), isLocal: false }
}

/**
 * Search Nominatim directly, bypassing local cache and places.json.
 */
export async function searchOnline(query) {
  if (!query || query.length < 3) return []
  return fetchNominatim(query)
}

/**
 * Get an IANA timezone string for coordinates.
 *
 * Offline-first, in falling order of trust:
 * 1. Exact tz *boundary* lookup (tz-resolve.js) — correct for every country,
 *    including the many the bundled city DB doesn't cover (the DB spans only
 *    ~49 countries: Yerevan's nearest bundled city is Vladikavkaz, Russia →
 *    Europe/Moscow, when Armenia is Asia/Yerevan, +5 in July 1982 under USSR
 *    DST). Boundary lookup also keeps "auto-detect from coordinates"
 *    consistent with picking a bundled city, whose `t` zones were resolved
 *    from the same kind of boundary data (geo-tz) at build time.
 * 2. Nearest bundled city's zone — only if the boundary chunk failed to load.
 * 3. Online lookup (timeapi.io, free, no key) — last resort; it has returned
 *    mislabelled zones before (Perm as Europe/Moscow +3 instead of
 *    Asia/Yekaterinburg +5).
 */
export async function getTimezone(lat, lon) {
  if (!isFinite(lat) || !isFinite(lon)) throw new Error('Invalid coordinates for timezone lookup')
  // 1. Exact boundary lookup (offline).
  const exact = await zoneFromCoords(lat, lon)
  if (exact) return exact
  // 2. Nearest bundled city's zone (offline heuristic — can err near borders).
  try {
    const local = nearestZone(lat, lon, await loadPlaces())
    if (local) return local
  } catch { /* fall through to online lookup */ }
  // 3. Online fallback.
  const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Timezone lookup failed: ${res.status}`)
  const data = await res.json()
  return data.timeZone  // e.g. "Asia/Kolkata"
}
