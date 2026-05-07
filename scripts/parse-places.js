// scripts/parse-places.js
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const raw = readFileSync(resolve(root, 'places.txt'), 'utf8')
const lines = raw.split('\n').filter(Boolean)

const places = []
for (const line of lines) {
  const [namePart, coordPart] = line.split('###')
  if (!namePart || !coordPart) continue
  const coords = coordPart.split('#')
  const lat = parseFloat(coords[0])
  const lon = parseFloat(coords[1])
  const tz  = coords[2] ? coords[2].trim() : '+05:30'
  if (!isFinite(lat) || !isFinite(lon)) continue
  places.push({ n: namePart.trim(), a: lat, o: lon, z: tz })
}

writeFileSync(resolve(root, 'public/places.json'), JSON.stringify(places))
console.log(`Wrote ${places.length} entries to public/places.json`)
