// scripts/enrich-places-tz.js
//
// Enrich public/places.json with an IANA timezone name (`t`) for every city,
// resolved offline from its coordinates via geo-tz.
//
// Why: the bundled city database originally stored a single fixed numeric UTC
// offset per city (`z`) — and for DST regions that offset was baked to one
// season (usually summer), so a winter birth resolved an hour off. A numeric
// offset also cannot express DST or historical zone changes at all.
//
// An IANA name (e.g. "America/Denver") lets the app derive the offset *at the
// birth instant* — honouring DST, including historical/abolished DST — using
// the browser's own tz database. geo-tz is Node-only (large boundary data) so
// it runs here at build time; the runtime only ever reads the resulting string.
//
//   node scripts/enrich-places-tz.js
//
// Idempotent: re-running recomputes `t` from coordinates. Entries whose
// coordinates fall outside every zone (open ocean, etc.) keep their numeric
// `z` as a fallback and get no `t`.

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { find } from 'geo-tz'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const file = resolve(root, 'public/places.json')

const places = JSON.parse(readFileSync(file, 'utf8'))

let resolved = 0
let fallback = 0
for (const p of places) {
  let zone = null
  try {
    const zones = find(p.a, p.o)
    zone = Array.isArray(zones) ? zones[0] : zones
  } catch {
    zone = null
  }
  if (zone && /\//.test(zone)) {
    p.t = zone
    // `z` (fixed numeric offset) is superseded by the IANA name — drop it to
    // keep the shipped file lean. Kept only where no zone could be resolved.
    delete p.z
    resolved++
  } else {
    fallback++
  }
}

writeFileSync(file, JSON.stringify(places))
console.log(`Enriched ${places.length} places: ${resolved} with IANA zone, ${fallback} kept numeric fallback.`)
