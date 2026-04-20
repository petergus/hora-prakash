// src/core/panchang.js
// Vedic panchang (calendar) calculations: tithi, vara, nakshatra, yoga, karana, kalam
import { getSwe } from './swisseph.js'
import { getNakshatraInfo } from './calculations.js'
import { jdToDate } from '../utils/time.js'

const TITHI_NAMES = [
  'Pratipada','Dvitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami',
  'Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi',
  'Purnima','Amavasya'
]

const VARA_NAMES = [
  { name: 'Sunday',    lord: 'Sun'     },
  { name: 'Monday',    lord: 'Moon'    },
  { name: 'Tuesday',   lord: 'Mars'    },
  { name: 'Wednesday', lord: 'Mercury' },
  { name: 'Thursday',  lord: 'Jupiter' },
  { name: 'Friday',    lord: 'Venus'   },
  { name: 'Saturday',  lord: 'Saturn'  },
]

const YOGA_NAMES = [
  'Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarman',
  'Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra',
  'Siddhi','Vyatipata','Variyan','Parigha','Shiva','Siddha','Sadhya','Shubha',
  'Shukla','Brahma','Indra','Vaidhriti'
]

const KARANA_NAMES = [
  'Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti',
  'Shakuni','Chatushpada','Naga','Kimstughna'
]

// Rahu Kalam period index (1-8) by weekday (0=Sun). Period 1 = first 1/8 of day.
const RAHU_KALAM_ORDER  = [8, 2, 7, 5, 6, 4, 3]  // index=weekday, value=which 1/8 period
const GULIKA_ORDER      = [6, 5, 4, 3, 2, 1, 7]

/**
 * Calculate panchang for a given Julian Day and location.
 * @param {number} jd   Julian Day (UT)
 * @param {number} lat  Latitude
 * @param {number} lon  Longitude
 * @returns {object}
 */
export function calcPanchang(jd, lat, lon) {
  const swe = getSwe()

  // Use tropical longitudes for tithi/yoga (standard Vedic panchang practice)
  const TROPICAL_SPEED_FLAG = 2 | 256   // SEFLG_SWIEPH | SEFLG_SPEED
  const sunResult  = swe.calc_ut(jd, 0, TROPICAL_SPEED_FLAG)
  const moonResult = swe.calc_ut(jd, 1, TROPICAL_SPEED_FLAG)
  const sunLon  = sunResult[0]
  const moonLon = moonResult[0]

  // Tithi: 12° of Moon-Sun difference = 1 tithi (30 tithis total in lunation)
  const diff = ((moonLon - sunLon) + 360) % 360
  const tithiNum = Math.floor(diff / 12) + 1  // 1-30
  let tithiName
  if (tithiNum === 15) {
    tithiName = 'Purnima (Shukla 15)'
  } else if (tithiNum === 30) {
    tithiName = 'Amavasya (Krishna 15)'
  } else if (tithiNum <= 15) {
    tithiName = TITHI_NAMES[tithiNum - 1] + ' (Shukla)'
  } else {
    tithiName = TITHI_NAMES[tithiNum - 16] + ' (Krishna)'
  }

  // Vara (weekday from UTC date)
  const date = jdToDate(jd)
  const vara = VARA_NAMES[date.getUTCDay()]

  // Nakshatra: sidereal Moon longitude
  const sidMoonResult = swe.calc_ut(jd, 1, 2 | 65536 | 256)  // SEFLG_SWIEPH | SEFLG_SIDEREAL | SEFLG_SPEED
  const nakshatra = getNakshatraInfo(sidMoonResult[0])

  // Yoga: (Sun + Moon tropical) / (360/27)
  const yogaVal = ((sunLon + moonLon) % 360) / (360 / 27)
  const yogaName = YOGA_NAMES[Math.floor(yogaVal)]

  // Karana: 60-karana cycle — position 0 = Kimstughna (fixed),
  // positions 1-56 = 7 moveable karanas cycling, positions 57-59 = Shakuni/Chatushpada/Naga (fixed)
  const karanaNum = Math.floor(diff / 6)  // 0-59
  let karanaName
  if (karanaNum === 0) {
    karanaName = 'Kimstughna'
  } else if (karanaNum >= 57) {
    karanaName = ['Shakuni','Chatushpada','Naga'][karanaNum - 57]
  } else {
    karanaName = KARANA_NAMES[(karanaNum - 1) % 7]
  }

  // Sunrise and Sunset via rise_trans
  // Known swisseph-wasm v0.0.5 bug: wrapper may throw WebAssembly.RuntimeError
  // (memory access out of bounds) for some locations, especially western longitudes.
  // Wrap in try-catch; guard also handles the "returns JD ≈ 0" failure mode.
  const dayStart = Math.floor(jd - 0.5) + 0.5  // midnight UT
  let riseResult = null, setResult = null
  try { riseResult = swe.rise_trans(dayStart, 0, lon, lat, 0, 1) } catch { /* wrapper bug */ }
  try { setResult  = swe.rise_trans(dayStart, 0, lon, lat, 0, 2) } catch { /* wrapper bug */ }
  const isValidJd = (r) => r && r[0] > 1000000
  const sunrise = isValidJd(riseResult) ? jdToDate(riseResult[0]) : null
  const sunset  = isValidJd(setResult)  ? jdToDate(setResult[0])  : null

  // Rahu Kalam and Gulika Kalam (8 equal parts of daytime)
  const dayDuration = (sunrise && sunset) ? (sunset.getTime() - sunrise.getTime()) : 43200000
  const partMs = dayDuration / 8
  const dayOfWeek = date.getUTCDay()
  const rahuPeriod  = RAHU_KALAM_ORDER[dayOfWeek] - 1   // 0-indexed period
  const gulikaPeriod = GULIKA_ORDER[dayOfWeek] - 1
  const rahuStart   = sunrise ? new Date(sunrise.getTime() + rahuPeriod  * partMs) : null
  const rahuEnd     = rahuStart  ? new Date(rahuStart.getTime()  + partMs) : null
  const gulikaStart = sunrise ? new Date(sunrise.getTime() + gulikaPeriod * partMs) : null
  const gulikaEnd   = gulikaStart ? new Date(gulikaStart.getTime() + partMs) : null

  return {
    tithi:       { num: tithiNum, name: tithiName },
    vara,
    nakshatra:   { name: nakshatra.name, pada: nakshatra.pada, lord: nakshatra.lord },
    yoga:        yogaName,
    karana:      karanaName,
    sunrise,
    sunset,
    rahuKalam:   { start: rahuStart,  end: rahuEnd   },
    gulikaKalam: { start: gulikaStart, end: gulikaEnd },
  }
}
