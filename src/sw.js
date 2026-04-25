import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// Activate new SW immediately, take control of all clients
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Precache all build assets (Workbox handles cache-busting via revision hashes)
precacheAndRoute(self.__WB_MANIFEST)

// Remove stale precaches from previous versions
cleanupOutdatedCaches()

// Cache geocoding API responses (30 days)
registerRoute(
  /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
  new CacheFirst({
    cacheName: 'geocoding-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// Cache timezone API responses (30 days)
registerRoute(
  /^https:\/\/timeapi\.io\/api\/TimeZone\/.*/i,
  new CacheFirst({
    cacheName: 'timezone-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)
