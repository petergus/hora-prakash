// src/utils/geocoding.js
import { searchCache } from './location-cache.js'

const PLACES_URL = `${import.meta.env.BASE_URL}places.json`
let placesData = null

async function loadPlaces() {
  if (placesData) return placesData
  try {
    const res = await fetch(PLACES_URL)
    if (!res.ok) throw new Error(`places.json fetch failed: ${res.status}`)
    placesData = await res.json()
  } catch {
    placesData = []
  }
  return placesData
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

/**
 * Search locations. Returns array of { displayName, lat, lon, tz }.
 * tz is ±HH:MM for local results, null for Nominatim fallback (resolve via getTimezone()).
 * Order: localStorage cache → places.json → Nominatim API.
 */
export async function searchLocation(query) {
  if (!query || query.length < 3) return []

  // 1. LRU cache
  const cacheHits = searchCache(query)

  // 2. places.json
  const places = await loadPlaces()
  const localHits = searchPlaces(query, places)

  // Deduplicate local hits against cache hits by displayName
  const cacheNames = new Set(cacheHits.map(e => e.displayName))
  const deduped = localHits.filter(e => !cacheNames.has(e.displayName))

  const combined = [...cacheHits, ...deduped]
  if (combined.length > 0) return combined.slice(0, 5)

  // 3. Nominatim fallback
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
 * Get IANA timezone string for coordinates via timeapi.io (free, no key).
 * Only needed for Nominatim fallback results (tz === null).
 */
export async function getTimezone(lat, lon) {
  if (!isFinite(lat) || !isFinite(lon)) throw new Error('Invalid coordinates for timezone lookup')
  const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Timezone lookup failed: ${res.status}`)
  const data = await res.json()
  return data.timeZone  // e.g. "Asia/Kolkata"
}
