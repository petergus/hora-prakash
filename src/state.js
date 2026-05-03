// src/state.js
export const state = {
  birth: null,       // { name, dob, tob, lat, lon, timezone, location }
  planets: null,     // array of { id, name, lon, house, nakshatra, pada, retrograde }
  lagna: null,       // { lon, house: 1, nakshatra, pada }
  houses: null,      // array of 12 house cusp longitudes
  dasha: null,       // computed dasha tree
  panchang: null,    // computed panchang values
  strength: null,    // computed strength values (ashtakavarga, shadbala, etc.)
}
