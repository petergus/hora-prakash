// Service worker — cache-first for the large WASM/ephemeris files.
// Bump CACHE_NAME when swisseph-wasm is upgraded to bust stale files.
const CACHE_NAME = 'hora-wasm-v1'
const WASM_PREFIX = '/hora-prakash/wasm/'

self.addEventListener('install', e => {
  // Pre-cache both files during SW install so they are ready before first use.
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      c.addAll([
        `${WASM_PREFIX}swisseph.wasm`,
        `${WASM_PREFIX}swisseph.data`,
      ])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Delete old cache versions.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { pathname } = new URL(e.request.url)
  if (!pathname.startsWith(WASM_PREFIX)) return          // only intercept wasm files

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached                           // cache hit → instant
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        }
        return res
      })
    })
  )
})
