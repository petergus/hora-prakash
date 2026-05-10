// src/state.js
export const state = {
  birth: null,       // { name, dob, tob, lat, lon, timezone, location }
  planets: null,     // array of { id, name, lon, house, nakshatra, pada, retrograde }
  lagna: null,       // { lon, house: 1, nakshatra, pada }
  houses: null,      // array of 12 Placidus house cusp longitudes
  sripatiHouses: null, // array of 12 Sripati house cusp longitudes
  dasha: null,       // computed dasha tree
  panchang: null,    // computed panchang values
  strength: null,    // computed strength values (ashtakavarga, shadbala, etc.)
  // Transit
  transitDate: null,        // YYYY-MM-DD
  transitTime: null,        // HH:MM
  transitPlanets: [],
  transitFilter: new Set(['Ju', 'Sa']),
  transitView: 'dual',      // 'dual' | 'overlay'
  transitAspectSource: null, // planet abbr currently highlighted, null = none
}
