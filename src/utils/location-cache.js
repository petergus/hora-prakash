// src/utils/location-cache.js

// v2: earlier versions cached a timezone that could be a stale/mislabelled
// value (e.g. an online lookup returning the wrong zone). Bumping the key drops
// those poisoned entries so a bad cached tz can never shadow the corrected DB.
const CACHE_KEY = 'hora-prakash-location-cache-v2'
const MAX_ENTRIES = 20

export function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]')
  } catch {
    return []
  }
}

export function addToCache(entry) {
  // entry: { displayName, lat, lon, tz }
  const cache = getCache().filter(e => e.displayName !== entry.displayName)
  cache.unshift(entry)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache.slice(0, MAX_ENTRIES)))
  } catch {
    // storage unavailable or quota exceeded
  }
}

export function searchCache(query) {
  const q = query.toLowerCase().trim()
  return getCache().filter(e => e.displayName.toLowerCase().includes(q))
}
