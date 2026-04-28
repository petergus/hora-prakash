// src/core/settings.js
import { getSwe } from './swisseph.js'

const STORAGE_KEY = 'hora-prakash-settings'

const DEFAULTS = {
  ayanamsa:        1,
  yearMethod:      'sidereal',
  customYearDays:  365.25,
  planetPositions: 'true',        // 'apparent' | 'true'
  observerType:    'geocentric', // 'geocentric' | 'topocentric'
  theme:           'indigo',
}

let _settings = { ...DEFAULTS }

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    _settings = { ...DEFAULTS, ...raw }
  } catch {
    _settings = { ...DEFAULTS }
  }
}

export function getSettings() {
  return { ..._settings }
}

export function saveSettings(patch) {
  _settings = { ..._settings, ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings))
}

/** Must be called after initSwissEph() has resolved. */
export function applyAyanamsa() {
  getSwe().set_sid_mode(_settings.ayanamsa, 0, 0)
}

/**
 * Build SwissEph calculation flags from settings.
 * SEFLG_SIDEREAL=65536, SEFLG_SPEED=256, SEFLG_TRUEPOS=512, SEFLG_TOPOCTR=32768
 */
export function buildCalcFlags(settings) {
  let flags = 65536 | 256  // SEFLG_SIDEREAL | SEFLG_SPEED
  if (settings?.planetPositions === 'true')        flags |= 512    // SEFLG_TRUEPOS
  if (settings?.observerType    === 'topocentric') flags |= 32768  // SEFLG_TOPOCTR
  return flags
}

export const AYANAMSA_OPTIONS = [
  { label: 'Lahiri',                  value: 1  },
  { label: 'Raman',                   value: 3  },
  { label: 'Krishnamurti (KP)',       value: 5  },
  { label: 'Yukteshwar',              value: 7  },
  { label: 'Fagan-Bradley',           value: 0  },
  { label: 'Djwhal Khul',             value: 6  },
  { label: 'De Luce',                 value: 2  },
  { label: 'JN Bhasin',              value: 8  },
  { label: 'True Citra',              value: 27 },
  { label: 'Babylonian (Kugler 1)',   value: 9  },
  { label: 'Suryasiddhanta',          value: 21 },
  { label: 'Aryabhata',               value: 23 },
]

export const YEAR_METHOD_OPTIONS = [
  { label: 'Julian (365.25) — JHora default', value: 'julian'     },
  { label: 'Mean Sidereal (365.2564)',         value: 'sidereal'   },
  { label: 'Tropical (365.2422)',              value: 'tropical'   },
  { label: 'Savana (360)',                     value: 'savana'     },
  { label: 'True Solar Return',                value: 'true-solar' },
  { label: 'Custom',                           value: 'custom'     },
]

export const PLANET_POSITION_OPTIONS = [
  { label: 'Apparent',         value: 'apparent' },
  { label: 'True (Geometric)', value: 'true'     },
]

export const OBSERVER_TYPE_OPTIONS = [
  { label: 'Geocentric (default)', value: 'geocentric'  },
  { label: 'Topocentric',          value: 'topocentric' },
]

export const THEME_OPTIONS = [
  { label: 'Indigo',   value: 'indigo',   color: '#4f46e5' },
  { label: 'Saffron',  value: 'saffron',  color: '#d97706' },
  { label: 'Forest',   value: 'forest',   color: '#059669' },
  { label: 'Rose',     value: 'rose',     color: '#e11d48' },
  { label: 'Midnight', value: 'midnight', color: '#7c3aed' },
  { label: 'Crimson',  value: 'crimson',  color: '#c0392b' },
]
