// src/utils/geocoding.js
// places.json schema: { n: name, a: lat, o: lon, t: iana_zone [, z: numeric_offset] }
// `t` is an IANA zone name (e.g. "America/Denver") resolved offline at build
// time (scripts/enrich-places-tz.js) so the app can derive the birth-instant
// offset with DST/historical rules. `z` (fixed numeric offset) survives only on
// the rare entries where no zone could be resolved, as a fallback.
import { searchCache } from './location-cache.js'
import { nearestZone } from './nearest-zone.js'

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

  // 1. LRU cache
  const cacheHits = searchCache(query)

  // 2. places.json
  const places = await loadPlaces()
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
 * Offline-first: resolve from the bundled city DB (accurate zones baked at build
 * time via geo-tz) by nearest neighbour. This keeps "auto-detect from
 * coordinates" consistent with picking a city from the search box, and prevents
 * a mislabelled online result from overwriting a correct zone — timeapi.io has
 * returned Europe/Moscow (+3) for Perm, which is Asia/Yekaterinburg (+5).
 *
 * Only coordinates far from any bundled city fall back to the online lookup
 * (timeapi.io, free, no key).
 */
export async function getTimezone(lat, lon) {
  if (!isFinite(lat) || !isFinite(lon)) throw new Error('Invalid coordinates for timezone lookup')
  // 1. Nearest bundled city's zone (offline, accurate for inhabited coords).
  try {
    const local = nearestZone(lat, lon, await loadPlaces())
    if (local) return local
  } catch { /* fall through to online lookup */ }
  // 2. Online fallback for remote coordinates not covered by the city DB.
  const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Timezone lookup failed: ${res.status}`)
  const data = await res.json()
  return data.timeZone  // e.g. "Asia/Kolkata"
}
