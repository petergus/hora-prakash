// src/core/muhurta.js
// Muhurta (electional astrology): score instants over a date range and return
// the best windows for an activity, judged both by the panchang of the moment
// and by that moment's relationship to a person's natal Moon.
//
// Cost model — the sweep is the one place in the app that evaluates thousands
// of instants, so it splits the work by how fast each factor actually changes:
//   • per DAY  : sunrise/sunset, Rahu & Gulika kalam, vara  → one `calcPanchang`
//   • per SLOT : tithi/nakshatra/yoga/karana → `calcPanchangAngles` (~10× cheaper,
//                no rise_trans), plus one `houses_ex` for the lagna
// A 30-day sweep at 30-minute steps is ~1440 slots: ~0.15 s this way versus
// ~0.85 s if every slot ran a full `calcPanchang`.
//
// Node-safe: every ephemeris call goes through an injectable `swe`.

import { getSwe } from './swisseph.js'
import { calcPanchang, calcPanchangAngles } from './panchang.js'
import { toJulianDay, jdToDate, getTZOffsetMinutes } from '../utils/time.js'
import { ACTIVITIES, NAKSHATRA_NATURE, NATURE_LABELS } from '../content/muhurta-activities.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const VARA_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// Yogas (of the 27) traditionally rejected for auspicious work.
const INAUSPICIOUS_YOGAS = new Set([
  'Vishkambha', 'Atiganda', 'Shula', 'Ganda', 'Vyaghata', 'Vajra',
  'Vyatipata', 'Parigha', 'Vaidhriti',
])

// Tithi classes by position in the fortnight (1–15).
const TITHI_CLASS = {
  1: 'Nanda', 6: 'Nanda', 11: 'Nanda',
  2: 'Bhadra', 7: 'Bhadra', 12: 'Bhadra',
  3: 'Jaya', 8: 'Jaya', 13: 'Jaya',
  4: 'Rikta', 9: 'Rikta', 14: 'Rikta',
  5: 'Purna', 10: 'Purna', 15: 'Purna',
}
// Vara on which each tithi class yields Siddha (accomplished) yoga.
const SIDDHA_VARA = { Nanda: 5, Bhadra: 3, Jaya: 2, Rikta: 6, Purna: 4 }

// Tarabala: the 9 taras counted from the janma nakshatra.
const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari',
                    'Sadhaka', 'Vadha', 'Mitra', 'Parama Mitra']
const TARA_BAD = new Set([2, 4, 6])   // Vipat, Pratyari, Vadha (0-based)
const TARA_MIXED = new Set([0])       // Janma

const norm = l => ((l % 360) + 360) % 360
const nakOf = lon => Math.floor(norm(lon) / (360 / 27))

/** Tara (0-based index into TARA_NAMES) from janma nakshatra to a day's nakshatra. */
export function tarabala(janmaNak, dayNak) {
  const count = ((dayNak - janmaNak + 27) % 27) + 1
  return (count - 1) % 9
}

/** Moon's house (1–12) from the natal Moon sign — the basis of Chandra bala. */
export function chandraBala(natalMoonSign, transitMoonSign) {
  return ((transitMoonSign - natalMoonSign + 12) % 12) + 1
}

const CHANDRA_GOOD = new Set([1, 3, 6, 7, 10, 11])
const CHANDRA_BAD  = new Set([4, 8, 12])

/** Tithi class + Siddha check for a tithi number 1–30. */
export function tithiClass(tithiNum) {
  const inPaksha = ((tithiNum - 1) % 15) + 1
  return TITHI_CLASS[inPaksha] ?? 'Purna'
}

/** Local "YYYY-MM-DD" for a JD in a timezone. */
function localDateStr(jd, timezone) {
  const d = jdToDate(jd)
  const off = getTZOffsetMinutes(d, timezone)
  return new Date(d.getTime() + off * 60000).toISOString().slice(0, 10)
}

function inWindow(jd, win) {
  if (!win?.start || !win?.end) return false
  const t = jdToDate(jd).getTime()
  return t >= win.start.getTime() && t < win.end.getTime()
}

/**
 * Score one instant for an activity.
 *
 * Returns `{ score, max, factors }` where each factor carries its own points,
 * max and a human note — the UI shows this breakdown so a verdict is never a
 * bare number. `veto: true` marks a factor that tradition treats as
 * disqualifying (Rikta+Amavasya, Vishti karana, Chandrashtama, Vadha tara,
 * Rahu/Gulika kalam); a slot with any veto is never offered as a window.
 */
export function scoreInstant({ angles, vedicWeekday, lagnaSign, kalams, activity, natal }) {
  const act = ACTIVITIES[activity]
  if (!act) throw new Error(`scoreInstant: unknown activity "${activity}"`)

  const factors = []
  const add = (key, label, points, max, note, veto = false) =>
    factors.push({ key, label, points, max, note, veto })

  // 1 · Tithi class (3) — Rikta is rejected; Amavasya rejected for auspicious acts.
  const tNum = angles.tithi.num
  const cls  = tithiClass(tNum)
  const isAmavasya = tNum === 30
  const siddha = SIDDHA_VARA[cls] === vedicWeekday
  if (isAmavasya && activity !== 'medical') {
    add('tithi', 'Tithi', 0, 3, `${angles.tithi.name} — new moon, rejected for auspicious work`, true)
  } else if (cls === 'Rikta') {
    add('tithi', 'Tithi', 0, 3, `${angles.tithi.name} — Rikta (empty) class`, true)
  } else if (siddha) {
    add('tithi', 'Tithi', 3, 3, `${angles.tithi.name} — ${cls} on ${VARA_NAMES[vedicWeekday]} forms Siddha yoga`)
  } else if (cls === 'Purna' || cls === 'Jaya') {
    add('tithi', 'Tithi', 3, 3, `${angles.tithi.name} — ${cls} class`)
  } else {
    add('tithi', 'Tithi', 2, 3, `${angles.tithi.name} — ${cls} class`)
  }

  // 2 · Vara (2)
  if (act.avoidVaras?.includes(vedicWeekday)) {
    add('vara', 'Vara', 0, 2, `${VARA_NAMES[vedicWeekday]} — avoided for ${act.label.toLowerCase()}`)
  } else if (act.varas?.includes(vedicWeekday)) {
    add('vara', 'Vara', 2, 2, `${VARA_NAMES[vedicWeekday]} — favoured`)
  } else {
    add('vara', 'Vara', 1, 2, `${VARA_NAMES[vedicWeekday]} — neutral`)
  }

  // 3 · Nakshatra (4) — explicit tradition first, then the nature classification.
  const nak = angles.nakshatra.index
  const nature = NAKSHATRA_NATURE[nak]
  const natureLabel = NATURE_LABELS[nature]
  if (act.avoid?.includes(nak)) {
    add('nakshatra', 'Nakshatra', 0, 4, `${angles.nakshatra.name} — ${natureLabel}, rejected for this act`)
  } else if (act.prefer?.includes(nak)) {
    add('nakshatra', 'Nakshatra', 4, 4, `${angles.nakshatra.name} — ${natureLabel}, classically preferred`)
  } else if (act.natures?.includes(nature)) {
    add('nakshatra', 'Nakshatra', 3, 4, `${angles.nakshatra.name} — ${natureLabel}, a suitable nature`)
  } else {
    add('nakshatra', 'Nakshatra', 1, 4, `${angles.nakshatra.name} — ${natureLabel}, not this act's nature`)
  }

  // 4 · Yoga (2)
  if (INAUSPICIOUS_YOGAS.has(angles.yoga.name)) {
    add('yoga', 'Yoga', 0, 2, `${angles.yoga.name} — an inauspicious yoga`)
  } else {
    add('yoga', 'Yoga', 2, 2, `${angles.yoga.name}`)
  }

  // 5 · Karana (1) — Vishti (Bhadra) is the classical veto.
  if (angles.karana.name === 'Vishti') {
    add('karana', 'Karana', 0, 1, 'Vishti (Bhadra) — rejected for all auspicious work', true)
  } else {
    add('karana', 'Karana', 1, 1, angles.karana.name)
  }

  // 6 · Tarabala (3) — needs the person's janma nakshatra
  if (natal?.janmaNak != null) {
    const t = tarabala(natal.janmaNak, nak)
    const name = TARA_NAMES[t]
    if (t === 6) {
      add('tarabala', 'Tarabala', 0, 3, `${name} tara — the “slaying” star from your janma nakshatra`, true)
    } else if (TARA_BAD.has(t)) {
      add('tarabala', 'Tarabala', 0, 3, `${name} tara — inauspicious from your janma nakshatra`)
    } else if (TARA_MIXED.has(t)) {
      add('tarabala', 'Tarabala', 1, 3, `${name} tara — your birth star, mixed`)
    } else {
      add('tarabala', 'Tarabala', 3, 3, `${name} tara — favourable from your janma nakshatra`)
    }
  }

  // 7 · Chandra bala (3)
  if (natal?.moonSign != null) {
    const moonSign = Math.floor(norm(angles.sidMoonLon) / 30) + 1
    const h = chandraBala(natal.moonSign, moonSign)
    if (h === 8) {
      add('chandrabala', 'Chandra bala', 0, 3, `Moon in the 8th from your natal Moon — Chandrashtama`, true)
    } else if (CHANDRA_BAD.has(h)) {
      add('chandrabala', 'Chandra bala', 0, 3, `Moon in the ${h}th from your natal Moon — weak`)
    } else if (CHANDRA_GOOD.has(h)) {
      add('chandrabala', 'Chandra bala', 3, 3, `Moon in the ${h}${h === 1 ? 'st' : 'th'} from your natal Moon — strong`)
    } else {
      add('chandrabala', 'Chandra bala', 1.5, 3, `Moon in the ${h}th from your natal Moon — middling`)
    }
  }

  // 8 · Kalams (2) — Rahu/Gulika are hard rejections for starting anything.
  if (kalams.inRahu) {
    add('kalam', 'Kalam', 0, 2, 'Falls in Rahu Kalam', true)
  } else if (kalams.inGulika) {
    add('kalam', 'Kalam', 0, 2, 'Falls in Gulika Kalam', true)
  } else {
    add('kalam', 'Kalam', 2, 2, 'Clear of Rahu and Gulika Kalam')
  }

  // 9 · Lagna (2)
  if (act.lagnaSigns?.includes(lagnaSign)) {
    add('lagna', 'Lagna', 2, 2, `${SIGN_NAMES[lagnaSign - 1]} rising — suits this act`)
  } else {
    add('lagna', 'Lagna', 1, 2, `${SIGN_NAMES[lagnaSign - 1]} rising`)
  }

  const score = factors.reduce((s, f) => s + f.points, 0)
  const max   = factors.reduce((s, f) => s + f.max, 0)
  const vetoes = factors.filter(f => f.veto)
  return { score, max, factors, vetoes, vetoed: vetoes.length > 0 }
}

export function gradeOf(pct) {
  return pct >= 0.85 ? 'excellent' : pct >= 0.7 ? 'good' : pct >= 0.55 ? 'fair' : 'poor'
}

/**
 * Sweep a date range and return the best muhurta windows.
 *
 * @param {object} opts
 *   activity   — key into ACTIVITIES
 *   from, to   — "YYYY-MM-DD" local dates (inclusive)
 *   lat, lon, timezone — the place the act happens
 *   natal      — { janmaNak, moonSign } (optional; omits Tara/Chandra bala)
 *   stepMinutes — sweep granularity (default 30)
 *   dayStart/dayEnd — local hours to consider (default 6..21)
 *   minScorePct — floor for a window to be offered (default 0.6)
 *   limit      — max windows returned (default 12)
 *   swe        — ephemeris override
 * @returns {{ windows, scanned, activity }}
 */
export function findMuhurta({
  activity, from, to, lat, lon, timezone = '+00:00', natal = null,
  stepMinutes = 30, dayStart = 6, dayEnd = 21, minScorePct = 0.6, limit = 12, swe: _swe,
} = {}) {
  const swe = _swe || getSwe()
  if (!ACTIVITIES[activity]) throw new Error(`findMuhurta: unknown activity "${activity}"`)

  const startJd = toJulianDay(from, '00:00', timezone)
  const endJd   = toJulianDay(to,   '23:59', timezone)
  if (!(startJd < endJd)) throw new Error('findMuhurta: `from` must precede `to`')

  const slots = []
  const stepJd = stepMinutes / 1440
  let scanned = 0

  // Walk day by day: the per-day panchang (sunrise, kalams, vara) is computed
  // once and shared by every slot inside that day.
  const dayCount = Math.ceil(endJd - startJd) + 1
  for (let d = 0; d < dayCount; d++) {
    const dayJd = startJd + d
    const dateStr = localDateStr(dayJd + 0.5, timezone)   // midday → unambiguous local date
    if (dateStr > to) break

    let day
    try {
      day = calcPanchang(dayJd + 0.5, lat, lon, { dateStr, timezone }, swe)
    } catch { continue }

    // The Vedic day runs sunrise→sunrise: a slot before sunrise still belongs to
    // the previous weekday. calcPanchang's `vara` is civil-date based, so derive
    // the weekday here and correct it per slot below.
    const civilWeekday = new Date(dateStr + 'T00:00:00Z').getUTCDay()
    const sunriseMs = day.sunrise?.getTime() ?? null

    const firstJd = toJulianDay(dateStr, String(dayStart).padStart(2, '0') + ':00', timezone)
    const lastJd  = toJulianDay(dateStr, String(dayEnd).padStart(2, '0') + ':00', timezone)

    for (let jd = firstJd; jd <= lastJd + 1e-9; jd += stepJd) {
      if (jd < startJd || jd > endJd) continue
      scanned++

      const slotMs = jdToDate(jd).getTime()
      const vedicWeekday = (sunriseMs != null && slotMs < sunriseMs)
        ? (civilWeekday + 6) % 7
        : civilWeekday

      const angles = calcPanchangAngles(jd, swe)
      const asc = norm(swe.houses_ex(jd, 65536, lat, lon, 'P').ascmc[0])
      const lagnaSign = Math.floor(asc / 30) + 1

      const kalams = {
        inRahu:   inWindow(jd, day.rahuKalam),
        inGulika: inWindow(jd, day.gulikaKalam),
      }

      const s = scoreInstant({ angles, vedicWeekday, lagnaSign, kalams, activity, natal })
      slots.push({
        jd, date: jdToDate(jd),
        score: s.score, max: s.max, pct: s.score / s.max,
        factors: s.factors, vetoed: s.vetoed, vetoes: s.vetoes,
        nakshatra: angles.nakshatra.name, tithi: angles.tithi.name,
        lagnaSign, dateStr,
      })
    }
  }

  // Merge consecutive qualifying slots into windows. A window breaks when the
  // slot stops qualifying, the grade changes, or there is a time gap — so a
  // window always has one coherent verdict.
  const windows = []
  let cur = null
  const flush = () => {
    if (!cur) return
    // A window covers its last slot too, so it ends one step after that slot starts.
    cur.end = jdToDate(cur.lastJd + stepJd)
    delete cur.lastJd
    windows.push(cur)
    cur = null
  }
  for (const slot of slots) {
    const qualifies = !slot.vetoed && slot.pct >= minScorePct
    if (!qualifies) { flush(); continue }
    const grade = gradeOf(slot.pct)
    const contiguous = cur && Math.abs(slot.jd - (cur.lastJd + stepJd)) < stepJd / 2
    if (cur && contiguous && cur.grade === grade && cur.dateStr === slot.dateStr) {
      cur.lastJd = slot.jd
      if (slot.pct > cur.pct) { cur.pct = slot.pct; cur.score = slot.score; cur.factors = slot.factors }
    } else {
      flush()
      cur = {
        start: slot.date, lastJd: slot.jd, dateStr: slot.dateStr,
        score: slot.score, max: slot.max, pct: slot.pct, grade,
        factors: slot.factors, nakshatra: slot.nakshatra, tithi: slot.tithi,
      }
    }
  }
  flush()

  windows.sort((a, b) => b.pct - a.pct || a.start - b.start)
  return { windows: windows.slice(0, limit), scanned, activity }
}
