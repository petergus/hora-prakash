// scripts/parse-places.js
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { find } from 'geo-tz'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const raw = readFileSync(resolve(root, 'places.txt'), 'utf8')
const lines = raw.split('\n').filter(Boolean)

// Each entry carries an IANA zone name (`t`) resolved offline from coordinates
// so the app can derive the birth-instant offset (DST-aware). The numeric `z`
// from places.txt is kept only as a fallback where no zone could be resolved.
// See scripts/enrich-places-tz.js for the rationale.
const places = []
for (const line of lines) {
  const [namePart, coordPart] = line.split('###')
  if (!namePart || !coordPart) continue
  const coords = coordPart.split('#')
  const lat = parseFloat(coords[0])
  const lon = parseFloat(coords[1])
  const tz  = coords[2] ? coords[2].trim() : '+05:30'
  if (!isFinite(lat) || !isFinite(lon)) continue
  const entry = { n: namePart.trim(), a: lat, o: lon }
  let zone = null
  try {
    const zones = find(lat, lon)
    zone = Array.isArray(zones) ? zones[0] : zones
  } catch { zone = null }
  if (zone && /\//.test(zone)) entry.t = zone
  else entry.z = tz
  places.push(entry)
}

writeFileSync(resolve(root, 'public/places.json'), JSON.stringify(places))
console.log(`Wrote ${places.length} entries to public/places.json`)
