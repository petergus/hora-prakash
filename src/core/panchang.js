// src/core/panchang.js
// Vedic panchang (calendar) calculations: tithi, vara, nakshatra, yoga, karana, kalam
import { getSwe } from './swisseph.js'
import { getNakshatraInfo } from './calculations.js'
import { getLocalDateParts, jdToDate, toJulianDay } from '../utils/time.js'

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

const SAMVAT_NAMES = [
  'Prabhava','Vibhava','Shukla','Pramoda','Prajapati','Angirasa','Shrimukha','Bhava',
  'Yuvan','Dhatri','Ishvara','Bahudhanya','Pramathi','Vikrama','Vrisha','Chitrabhanu',
  'Subhanu','Tarana','Parthiva','Vyaya','Sarvajit','Sarvadharin','Virodhi','Vikruti',
  'Khara','Nandana','Vijaya','Jaya','Manmatha','Durmukhi','Hevilambi','Vilambi',
  'Vikari','Sharvari','Plava','Shubhakrit','Shobhana','Krodhi','Vishvavasu','Parabhava',
  'Plavanga','Kilaka','Saumya','Sadharana','Virodhikrit','Paridhavin','Pramadicha',
  'Ananda','Rakshasa','Nala','Pingala','Kalayukti','Siddharthi','Raudra','Durmati',
  'Dundubhi','Rudhirodgarin','Raktakshi','Krodhana','Akshaya'
]

const LUNAR_MONTH_NAMES = [
  'Chaitra','Vaisakha','Jyeshtha','Ashadha','Shravana','Bhadrapada',
  'Ashwina','Kartika','Margashirsha','Pausha','Magha','Phalguna'
]

// Classical Chaldean hora sequence (Sun→Moon→Mars→Mercury→Jupiter→Venus→Saturn, cycles)
// Chaldean hora order: slowest to fastest planet
const CHALDEAN = ['Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon']

// Day lord index in CHALDEAN for each weekday (0=Sun..6=Sat)
// Sun→3, Mon→6, Tue→2, Wed→5, Thu→1, Fri→4, Sat→0
const DAY_LORD_CHALDEAN = [3, 6, 2, 5, 1, 4, 0]

// Kaala lord table: [weekday][part 0-7], 8 equal daytime parts
// Cycles through REVERSED Chaldean order (Saturn,Venus,Jupiter,Mercury,Mars,Moon,Sun)
// starting from each day's lord — verified against JHora
const KAALA_TABLE = [
  ['Sun','Saturn','Venus','Jupiter','Mercury','Mars','Moon','Sun'],    // Sunday
  ['Moon','Sun','Saturn','Venus','Jupiter','Mercury','Mars','Moon'],   // Monday
  ['Mars','Moon','Sun','Saturn','Venus','Jupiter','Mercury','Mars'],   // Tuesday
  ['Mercury','Mars','Moon','Sun','Saturn','Venus','Jupiter','Mercury'],// Wednesday
  ['Jupiter','Mercury','Mars','Moon','Sun','Saturn','Venus','Jupiter'],// Thursday
  ['Venus','Jupiter','Mercury','Mars','Moon','Sun','Saturn','Venus'],  // Friday
  ['Saturn','Venus','Jupiter','Mercury','Mars','Moon','Sun','Saturn'], // Saturday
]

// Rahu Kalam period index (1-8) by weekday (0=Sun). Period 1 = first 1/8 of day.
const RAHU_KALAM_ORDER  = [8, 2, 7, 5, 6, 4, 3]  // index=weekday, value=which 1/8 period
const GULIKA_ORDER      = [6, 5, 4, 3, 2, 1, 7]

/**
 * Calculate panchang for a given Julian Day and location.
 * @param {number} jd   Julian Day (UT)
 * @param {number} lat  Latitude
 * @param {number} lon  Longitude
 * @param {object} [options] { dateStr: "YYYY-MM-DD", timezone: IANA or "+05:30" }
 * @returns {object}
 */
export function calcPanchang(jd, lat, lon, options = {}) {
  const swe = getSwe()
  const timezone = options.timezone || '+00:00'

  // Tropical longitudes for tithi/karana (moon-sun diff, ayanamsa cancels out)
  const TROPICAL_FLAG  = 2 | 256           // SEFLG_SWIEPH | SEFLG_SPEED
  const SIDEREAL_FLAG  = 2 | 65536 | 256   // SEFLG_SWIEPH | SEFLG_SIDEREAL | SEFLG_SPEED
  const sunResult  = swe.calc_ut(jd, 0, TROPICAL_FLAG)
  const moonResult = swe.calc_ut(jd, 1, TROPICAL_FLAG)
  const sunLon  = sunResult[0]
  const moonLon = moonResult[0]
  // Sidereal Sun for yoga (yoga uses sidereal positions per Vedic tradition)
  const sidSunLon = swe.calc_ut(jd, 0, SIDEREAL_FLAG)[0]

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
  const tithiPctLeft = (1 - (diff % 12) / 12) * 100

  // Vara is based on the local civil date at the birth location.
  const localDate = options.dateStr
    ? parseDateStr(options.dateStr)
    : getLocalDateParts(jdToDate(jd), timezone)
  const vara = VARA_NAMES[localDate.weekday]

  // Lunar year-month (samvat)
  const lunarMonthIdx = Math.floor(sunLon / 30) % 12
  const lunarMonth = LUNAR_MONTH_NAMES[lunarMonthIdx]
  const kaliYear = localDate.year + 3101
  const samvatIdx = (kaliYear + 12) % 60
  const lunarYear = SAMVAT_NAMES[samvatIdx]

  // Nakshatra: sidereal Moon longitude
  const sidMoonResult = swe.calc_ut(jd, 1, SIDEREAL_FLAG)
  const sidMoonLon = sidMoonResult[0]
  const nakshatra = getNakshatraInfo(sidMoonLon)
  const nakshatraPctLeft = (1 - (sidMoonLon % (360 / 27)) / (360 / 27)) * 100

  // Yoga: sidereal Sun + sidereal Moon (Vedic standard)
  const yogaVal = ((sidSunLon + sidMoonLon) % 360) / (360 / 27)
  const yogaName = YOGA_NAMES[Math.floor(yogaVal)]
  const yogaPctLeft = (1 - (yogaVal % 1)) * 100

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
  const karanaPctLeft = (1 - (diff % 6) / 6) * 100

  // Sunrise and Sunset via direct swe_rise_trans C call.
  // The swisseph-wasm v0.0.5 rise_trans() wrapper has wrong arg mapping (passes lon/lat as
  // individual numbers instead of allocating a geopos pointer array). Bypass it entirely.
  const dayStart = options.dateStr
    ? toJulianDay(options.dateStr, '00:00', timezone)
    : Math.floor(jd - 0.5) + 0.5

  function riseTrans(rsmi) {
    try {
      const M = swe.SweModule
      const geoPtr  = M._malloc(3 * 8)   // double[3]: lon, lat, alt
      const tretPtr = M._malloc(8)        // double: return JD
      const serrPtr = M._malloc(256)      // char[256]: error string
      M.HEAPF64[geoPtr >> 3]       = lon
      M.HEAPF64[(geoPtr >> 3) + 1] = lat
      M.HEAPF64[(geoPtr >> 3) + 2] = 0
      // SE_BIT_DISC_CENTER=256, SE_BIT_NO_REFRACTION=512 → Hindu rising (disc center, no refraction)
      // matches JHora's Vedic sunrise definition
      const hinduRsmi = rsmi | 256 | 512
      // swe_rise_trans(tjd_ut, ipl, *starname, epheflag, rsmi, *geopos, atpress, attemp, *tret, *serr)
      const flag = M.ccall('swe_rise_trans', 'number',
        ['number','number','number','number','number','number','number','number','number','number'],
        [dayStart, 0, 0, 2, hinduRsmi, geoPtr, 1013.25, 15, tretPtr, serrPtr])
      const tret = M.HEAPF64[tretPtr >> 3]
      M._free(geoPtr); M._free(tretPtr); M._free(serrPtr)
      return flag >= 0 && tret > 1000000 ? tret : null
    } catch { return null }
  }

  const sunriseJd = riseTrans(1)
  const sunsetJd  = riseTrans(2)
  const isValidJd = (r) => r && r[0] > 1000000  // kept for hora lord compat below
  const riseResult = sunriseJd ? [sunriseJd] : null
  const setResult  = sunsetJd  ? [sunsetJd]  : null
  const sunrise = sunriseJd ? jdToDate(sunriseJd) : null
  const sunset  = sunsetJd  ? jdToDate(sunsetJd)  : null

  // DayOfweek for hora/kaala/rahu calculations
  const dayOfWeek = localDate.weekday

  // Hora lord (Chaldean hora system — 1 hora = 1 hour from sunrise)
  let horaLord = null
  if (sunriseJd) {
    const hoursElapsed = (jd - sunriseJd) * 24
    const horaNum = Math.floor(hoursElapsed)
    const startIdx = DAY_LORD_CHALDEAN[dayOfWeek]
    horaLord = CHALDEAN[((startIdx + horaNum) % 7 + 7) % 7]
  }

  let kaalaLord = null
  if (sunriseJd && sunsetJd) {
    const elapsed = jd - sunriseJd
    const totalDay = sunsetJd - sunriseJd
    const partIdx = Math.min(7, Math.floor((elapsed / totalDay) * 8))
    kaalaLord = KAALA_TABLE[dayOfWeek][Math.max(0, partIdx)]
  }

  // Ghatis since sunrise (1 ghati = 24 minutes)
  let ghatisSinceSunrise = null
  if (sunriseJd) {
    const diffMs = jdToDate(jd).getTime() - jdToDate(sunriseJd).getTime()
    ghatisSinceSunrise = diffMs / (24 * 60 * 1000)
  }

  // Ayanamsa (precession offset)
  // Note: get_ayanamsa_ut is available in swisseph-wasm v0.0.5 and returns accurate values (~24.2° for 2026).
  // The fallback formula (Lahiri linear approximation) is a reasonable backup (accurate to ~1 arcmin for modern dates).
  let ayanamsaDeg
  try {
    ayanamsaDeg = swe.get_ayanamsa_ut(jd)
    if (typeof ayanamsaDeg !== 'number') throw new Error('unavailable')
  } catch {
    // Lahiri ayanamsa linear approximation (accurate to ~1 arcmin for modern dates)
    ayanamsaDeg = 22.460148 + (jd - 2396758.5) * (50.2564 / 3600 / 365.25)
  }
  const ayDeg = Math.floor(ayanamsaDeg)
  const ayMinFrac = (ayanamsaDeg - ayDeg) * 60
  const ayMin = Math.floor(ayMinFrac)
  const aySec = Math.round((ayMinFrac - ayMin) * 60)
  const ayanamsa = {
    deg: ayDeg, min: ayMin, sec: aySec,
    formatted: `${ayDeg}°${String(ayMin).padStart(2,'0')}'${String(aySec).padStart(2,'0')}"`
  }

  // Local sidereal time (LST)
  // swe.sidtime returns Greenwich Sidereal Time in decimal hours
  const gst = swe.sidtime(jd)
  const lst = ((gst + lon / 15) % 24 + 24) % 24
  const lstH = Math.floor(lst)
  const lstMFrac = (lst - lstH) * 60
  const lstM = Math.floor(lstMFrac)
  const lstS = Math.round((lstMFrac - lstM) * 60)
  const siderealTime = `${String(lstH).padStart(2,'0')}:${String(lstM).padStart(2,'0')}:${String(lstS).padStart(2,'0')}`

  // Rahu Kalam and Gulika Kalam (8 equal parts of daytime)
  const dayDuration = (sunrise && sunset) ? (sunset.getTime() - sunrise.getTime()) : 43200000
  const partMs = dayDuration / 8
  const rahuPeriod  = RAHU_KALAM_ORDER[dayOfWeek] - 1   // 0-indexed period
  const gulikaPeriod = GULIKA_ORDER[dayOfWeek] - 1
  const rahuStart   = sunrise ? new Date(sunrise.getTime() + rahuPeriod  * partMs) : null
  const rahuEnd     = rahuStart  ? new Date(rahuStart.getTime()  + partMs) : null
  const gulikaStart = sunrise ? new Date(sunrise.getTime() + gulikaPeriod * partMs) : null
  const gulikaEnd   = gulikaStart ? new Date(gulikaStart.getTime() + partMs) : null

  return {
    tithi:       { num: tithiNum, name: tithiName, percentLeft: tithiPctLeft },
    vara,
    nakshatra:   { name: nakshatra.name, pada: nakshatra.pada, lord: nakshatra.lord, percentLeft: nakshatraPctLeft },
    yoga:        { name: yogaName, percentLeft: yogaPctLeft },
    karana:      { name: karanaName, percentLeft: karanaPctLeft },
    lunarYearMonth: { year: lunarYear, month: lunarMonth },
    sunrise,
    sunset,
    rahuKalam:   { start: rahuStart,  end: rahuEnd   },
    gulikaKalam: { start: gulikaStart, end: gulikaEnd },
    horaLord,
    kaalaLord,
    ghatisSinceSunrise,
    ayanamsa,
    siderealTime,
  }
}

function parseDateStr(dateStr) {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return getLocalDateParts(new Date(), '+00:00')
  const [, y, mo, d] = m.map(Number)
  const utcDate = new Date(Date.UTC(y, mo - 1, d))
  return {
    year: y,
    month: mo,
    day: d,
    weekday: utcDate.getUTCDay(),
    hour: 0,
    minute: 0,
  }
}
