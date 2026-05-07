// src/utils/geocoding.js
// places.json schema: { n: name, a: lat, o: lon, z: tz_offset }
import { searchCache } from './location-cache.js'

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
      results.push({ displayName: entry.n, lat: entry.a, lon: entry.o, tz: entry.z })
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
 * tz is ±HH:MM for local results, null for Nominatim results (resolve via getTimezone()).
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
 * Get IANA timezone string for coordinates — resolved locally via geo-tz (offline-capable).
 * Only needed for Nominatim fallback results (tz === null).
 */
export async function getTimezone(lat, lon) {
  if (!isFinite(lat) || !isFinite(lon)) throw new Error('Invalid coordinates for timezone lookup')
  const { find } = await import('geo-tz')
  const zones = find(lat, lon)
  if (!zones || zones.length === 0) throw new Error('No timezone found for coordinates')
  return zones[0]  // e.g. "Asia/Kolkata"
}
