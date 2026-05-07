// Service worker — offline-first for app shell, cache-first for WASM/ephemeris.
// CACHE_NAME is replaced at build time with a unique hash — no manual bumping needed.
const CACHE_NAME = 'hora-__BUILD_HASH__'
const WASM_PREFIX = '/hora-prakash/wasm/'
const BASE = '/hora-prakash/'

const PRECACHE = [
  BASE,
  `${BASE}index.html`,
  `${BASE}places.json`,
  `${BASE}manifest.json`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`,
  `${WASM_PREFIX}swisseph.wasm`,
  `${WASM_PREFIX}swisseph.data`,
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())  // skip waiting only after precache done
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => {
        const old = keys.filter(k => k !== CACHE_NAME)
        const isUpdate = old.length > 0
        return Promise.all(old.map(k => caches.delete(k))).then(() => isUpdate)
      })
      .then(isUpdate => self.clients.claim().then(() => isUpdate))
      .then(isUpdate => {
        if (!isUpdate) return  // first install — no banner
        return self.clients.matchAll({ type: 'window' }).then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
        )
      })
  )
})

self.addEventListener('fetch', e => {
  // Only handle GET — never intercept POST/preflight/etc
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // Only handle same-origin requests within the app base path
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith(BASE)) return

  // WASM/ephemeris — cache-first (large, content-addressed by filename)
  if (url.pathname.startsWith(WASM_PREFIX)) {
    e.respondWith(cacheFirst(e.request))
    return
  }

  // Hashed JS/CSS chunks — cache-first (Vite fingerprints filenames with content hash)
  if (url.pathname.match(/\/assets\/.+\.(js|css)$/)) {
    e.respondWith(cacheFirst(e.request))
    return
  }

  // places.json — cache-first (large 2MB file, precached, versioned by CACHE_NAME)
  if (url.pathname === `${BASE}places.json`) {
    e.respondWith(cacheFirst(e.request))
    return
  }

  // HTML and everything else — network-first, fall back to cache
  e.respondWith(networkFirst(e.request))
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) {
    const c = await caches.open(CACHE_NAME)
    c.put(request, res.clone())
  }
  return res
}

async function networkFirst(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const c = await caches.open(CACHE_NAME)
      c.put(request, res.clone())
    }
    return res
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response('Offline — open the app while connected first.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
