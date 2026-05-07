// src/utils/location-cache.js

const CACHE_KEY = 'hora-prakash-location-cache'
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
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache.slice(0, MAX_ENTRIES)))
}

export function searchCache(query) {
  const q = query.toLowerCase().trim()
  return getCache().filter(e => e.displayName.toLowerCase().includes(q))
}
