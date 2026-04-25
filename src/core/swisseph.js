// src/core/swisseph.js
// Wraps swisseph-wasm v0.0.5 (class-based API: new SwissEph(), await swe.initSwissEph())
// Key API notes:
//   calc_ut(jd, body, flags) → Float64Array [lon, lat, dist, lonSpeed, latSpeed, distSpeed]
//   houses(jd, lat, lon, 'P') → { cusps: Float64Array[13], ascmc: Float64Array[10] }
//   set_sid_mode(1, 0, 0)     → set Lahiri ayanamsa
//   rise_trans(jd, planet, lon, lat, alt, flags) → Float64Array[4] or null
//   SEFLG_SIDEREAL = 65536, SEFLG_SPEED = 256

let swe = null
let initPromise = null

export function initSwissEph() {
  if (swe) return Promise.resolve(swe)
  if (initPromise) return initPromise
  initPromise = (async () => {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Ephemeris load timed out (30s). Check your connection and reload.')), 30000)
    )
    const load = (async () => {
      const mod = await import('swisseph-wasm')
      const SwissEph = mod.default
      const base = import.meta.env.BASE_URL
      const instance = new SwissEph({
        locateFile: (file) => `${base}wasm/${file}`,
      })
      await instance.initSwissEph()
      instance.set_sid_mode(1, 0, 0)
      swe = instance
      return swe
    })()
    return Promise.race([load, timeout])
  })()
  // Reset on failure so the user can retry
  initPromise.catch(() => { initPromise = null })
  return initPromise
}

export function getSwe() {
  if (!swe) throw new Error('SwissEph not initialized — call initSwissEph() first')
  return swe
}

// Planet IDs used throughout the app
export const PLANETS = [
  { id: 0,  name: 'Sun',     abbr: 'Su' },
  { id: 1,  name: 'Moon',    abbr: 'Mo' },
  { id: 2,  name: 'Mercury', abbr: 'Me' },
  { id: 3,  name: 'Venus',   abbr: 'Ve' },
  { id: 4,  name: 'Mars',    abbr: 'Ma' },
  { id: 5,  name: 'Jupiter', abbr: 'Ju' },
  { id: 6,  name: 'Saturn',  abbr: 'Sa' },
  { id: 10, name: 'Rahu',    abbr: 'Ra' },    // SE_MEAN_NODE = 10
  { id: 10, name: 'Ketu',    abbr: 'Ke', isKetu: true }, // Ketu = Rahu + 180°, same body ID
]
