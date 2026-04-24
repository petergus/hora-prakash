// src/core/settings.js
import { getSwe } from './swisseph.js'

const STORAGE_KEY = 'hora-prakash-settings'

const DEFAULTS = {
  ayanamsa: 1,
  yearMethod: 'sidereal',
  customYearDays: 365.25,
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
  return _settings
}

export function saveSettings(patch) {
  _settings = { ..._settings, ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings))
}

export function applyAyanamsa() {
  getSwe().set_sid_mode(_settings.ayanamsa, 0, 0)
}

export const AYANAMSA_OPTIONS = [
  { label: 'Lahiri',                  value: 1  },
  { label: 'Raman',                   value: 3  },
  { label: 'Krishnamurti (KP)',       value: 5  },
  { label: 'Yukteshwar',              value: 7  },
  { label: 'Fagan-Bradley',           value: 0  },
  { label: 'Djwhal Khul',             value: 6  },
  { label: 'De Luce',                 value: 2  },
  { label: 'JN Bhasin',               value: 8  },
  { label: 'True Citra',              value: 27 },
  { label: 'Babylonian (Kugler 1)',   value: 9  },
  { label: 'Suryasiddhanta',          value: 21 },
  { label: 'Aryabhata',               value: 23 },
]

export const YEAR_METHOD_OPTIONS = [
  { label: 'Mean Sidereal (365.2564)', value: 'sidereal'   },
  { label: 'Tropical (365.2422)',      value: 'tropical'   },
  { label: 'Savana (360)',             value: 'savana'     },
  { label: 'True Solar Return',        value: 'true-solar' },
  { label: 'Custom',                   value: 'custom'     },
]
