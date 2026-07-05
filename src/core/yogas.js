// src/core/yogas.js
// Classical yoga detection from sign-level positions (Vedic conjunction = same
// sign; aspects = full sign aspects, matching src/core/aspects.js).
import { getAspectedSigns } from './aspects.js'

// Sign lords, 1-indexed by sign (1 = Aries … 12 = Pisces)
const SIGN_LORDS = [null, 'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
                    'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter']

const OWN_SIGNS = {
  Sun: [5], Moon: [4], Mars: [1, 8], Mercury: [3, 6],
  Jupiter: [9, 12], Venus: [2, 7], Saturn: [10, 11],
}
const EXALT_SIGN = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 }
const DEBIL_SIGN = { Sun: 7, Moon: 8, Mars: 4, Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1 }

const KENDRA  = [1, 4, 7, 10]
const TRIKONA = [1, 5, 9]

const MAHAPURUSHA = {
  Mars: 'Ruchaka', Mercury: 'Bhadra', Jupiter: 'Hamsa', Venus: 'Malavya', Saturn: 'Sasa',
}

function houseFrom(refSign, sign) {
  return ((sign - refSign + 12) % 12) + 1
}

function conjunct(a, b) {
  return a && b && a.sign === b.sign
}

// Mutual full aspect (each aspects the sign of the other)
function mutualAspect(a, b) {
  if (!a || !b) return false
  return getAspectedSigns(a.sign, a.abbr).includes(b.sign) &&
         getAspectedSigns(b.sign, b.abbr).includes(a.sign)
}

/**
 * Detect classical yogas.
 * @param {object[]} planets  state.planets (9 grahas, sign/house relative to lagna)
 * @param {object}   lagna    state.lagna
 * @returns {{ key, name, category: 'benefic'|'challenging'|'neutral', description }[]}
 *   Only yogas actually present in the chart.
 */
export function detectYogas(planets, lagna) {
  if (!planets || !lagna) return []
  const byName = Object.fromEntries(planets.map(p => [p.name, p]))
  const lordOf = (house) => {
    const sign = ((lagna.sign - 1 + house - 1) % 12) + 1
    return byName[SIGN_LORDS[sign]]
  }
  const yogas = []
  const add = (key, name, category, description) => yogas.push({ key, name, category, description })

  const sun = byName.Sun, moon = byName.Moon
  const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra',
                      'Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
  const signName = s => SIGN_NAMES[s - 1]

  // ── Pancha Mahapurusha: planet in own/exaltation sign AND in a kendra from lagna ──
  for (const [planet, yogaName] of Object.entries(MAHAPURUSHA)) {
    const p = byName[planet]
    if (!p) continue
    const dignified = OWN_SIGNS[planet].includes(p.sign) || EXALT_SIGN[planet] === p.sign
    if (dignified && KENDRA.includes(p.house)) {
      const dignity = EXALT_SIGN[planet] === p.sign ? 'exalted' : 'in own sign'
      add(`mahapurusha-${planet.toLowerCase()}`, `${yogaName} Yoga`, 'benefic',
        `${planet} ${dignity} in ${signName(p.sign)} in house ${p.house} (kendra) — one of the Pancha Mahapurusha yogas.`)
    }
  }

  // ── Gaja-Kesari: Jupiter in a kendra from the Moon ──
  const ju = byName.Jupiter
  if (ju && moon && KENDRA.includes(houseFrom(moon.sign, ju.sign))) {
    add('gaja-kesari', 'Gaja-Kesari Yoga', 'benefic',
      `Jupiter in ${signName(ju.sign)}, a kendra (${houseFrom(moon.sign, ju.sign)}th) from the Moon in ${signName(moon.sign)}.`)
  }

  // ── Budhaditya: Sun–Mercury conjunction ──
  const me = byName.Mercury
  if (conjunct(sun, me)) {
    add('budhaditya', 'Budhaditya Yoga', 'benefic',
      `Sun and Mercury conjunct in ${signName(sun.sign)} (house ${sun.house}).${me.combust ? ' Mercury is combust — strength reduced.' : ''}`)
  }

  // ── Chandra-Mangala: Moon–Mars conjunction or mutual aspect ──
  const ma = byName.Mars
  if (conjunct(moon, ma)) {
    add('chandra-mangala', 'Chandra-Mangala Yoga', 'benefic',
      `Moon and Mars conjunct in ${signName(moon.sign)} (house ${moon.house}).`)
  } else if (mutualAspect(moon, ma)) {
    add('chandra-mangala', 'Chandra-Mangala Yoga', 'benefic',
      `Moon (${signName(moon.sign)}) and Mars (${signName(ma.sign)}) in mutual aspect.`)
  }

  // ── Raj Yoga: kendra lord + trikona lord conjunct, in mutual aspect, or in exchange ──
  const seenRajPairs = new Set()
  for (const kh of KENDRA) {
    for (const th of TRIKONA) {
      if (kh === th) continue
      const kl = lordOf(kh), tl = lordOf(th)
      if (!kl || !tl || kl.name === tl.name) continue
      const pairKey = [kl.name, tl.name].sort().join('-')
      if (seenRajPairs.has(pairKey)) continue
      let how = null
      if (conjunct(kl, tl)) how = `conjunct in ${signName(kl.sign)}`
      else if (mutualAspect(kl, tl)) how = 'in mutual aspect'
      if (how) {
        seenRajPairs.add(pairKey)
        add(`raj-${pairKey}`, 'Raj Yoga (Kendra–Trikona)', 'benefic',
          `${kl.name} (lord of house ${kh}) and ${tl.name} (lord of house ${th}) ${how}.`)
      }
    }
  }

  // ── Dhana Yoga: wealth-house lords (2, 11) linked with lagna/trikona lords (1, 5, 9) ──
  const seenDhana = new Set()
  for (const wh of [2, 11]) {
    for (const th of [1, 5, 9]) {
      const wl = lordOf(wh), tl = lordOf(th)
      if (!wl || !tl || wl.name === tl.name) continue
      const pairKey = [wl.name, tl.name].sort().join('-')
      if (seenDhana.has(pairKey)) continue
      if (conjunct(wl, tl)) {
        seenDhana.add(pairKey)
        add(`dhana-${pairKey}`, 'Dhana Yoga', 'benefic',
          `${wl.name} (lord of house ${wh}) conjunct ${tl.name} (lord of house ${th}) in ${signName(wl.sign)}.`)
      }
    }
  }

  // ── Parivartana: two planets in each other's signs ──
  const classical = planets.filter(p => SIGN_LORDS.includes(p.name))
  const seenExch = new Set()
  for (const a of classical) {
    for (const b of classical) {
      if (a.name >= b.name) continue
      const key = `${a.name}-${b.name}`
      if (seenExch.has(key)) continue
      if (OWN_SIGNS[b.name]?.includes(a.sign) && OWN_SIGNS[a.name]?.includes(b.sign)) {
        seenExch.add(key)
        add(`parivartana-${key.toLowerCase()}`, 'Parivartana Yoga (exchange)', 'benefic',
          `${a.name} in ${signName(a.sign)} (${b.name}'s sign) exchanges with ${b.name} in ${signName(b.sign)} (${a.name}'s sign).`)
      }
    }
  }

  // ── Vipreet Raj Yoga: lord of a dusthana (6, 8, 12) placed in a dusthana ──
  const VIPREET_NAMES = { 6: 'Harsha', 8: 'Sarala', 12: 'Vimala' }
  for (const dh of [6, 8, 12]) {
    const dl = lordOf(dh)
    if (dl && [6, 8, 12].includes(dl.house)) {
      add(`vipreet-${dh}`, `Vipreet Raj Yoga (${VIPREET_NAMES[dh]})`, 'benefic',
        `${dl.name}, lord of house ${dh}, placed in house ${dl.house} — adversity turned to advantage.`)
    }
  }

  // ── Neecha Bhanga: debilitated planet with cancellation ──
  for (const p of planets) {
    if (DEBIL_SIGN[p.name] !== p.sign) continue
    const dispositor = byName[SIGN_LORDS[p.sign]]
    const exaltLordName = SIGN_LORDS[EXALT_SIGN[p.name]]
    const exaltLord = byName[exaltLordName]
    const cancels = []
    if (dispositor && (KENDRA.includes(dispositor.house) || KENDRA.includes(houseFrom(moon?.sign ?? 1, dispositor.sign)))) {
      cancels.push(`its dispositor ${dispositor.name} is in a kendra from lagna or Moon`)
    }
    if (exaltLord && (KENDRA.includes(exaltLord.house) || KENDRA.includes(houseFrom(moon?.sign ?? 1, exaltLord.sign)))) {
      cancels.push(`${exaltLordName} (lord of its exaltation sign) is in a kendra from lagna or Moon`)
    }
    if (cancels.length) {
      add(`neecha-bhanga-${p.name.toLowerCase()}`, 'Neecha Bhanga Raj Yoga', 'benefic',
        `${p.name} is debilitated in ${signName(p.sign)}, but ${cancels.join(' and ')} — the debilitation is cancelled.`)
    } else {
      add(`debilitated-${p.name.toLowerCase()}`, `${p.name} debilitated`, 'challenging',
        `${p.name} is debilitated in ${signName(p.sign)} (house ${p.house}) with no classical cancellation.`)
    }
  }

  // ── Moon yogas: Sunapha / Anapha / Durudhara / Kemadruma ──
  if (moon) {
    const others = planets.filter(p => !['Sun', 'Moon', 'Rahu', 'Ketu'].includes(p.name))
    const in2nd  = others.filter(p => houseFrom(moon.sign, p.sign) === 2)
    const in12th = others.filter(p => houseFrom(moon.sign, p.sign) === 12)
    const withMoon = others.filter(p => p.sign === moon.sign)
    if (in2nd.length && in12th.length) {
      add('durudhara', 'Durudhara Yoga', 'benefic',
        `Planets on both sides of the Moon: ${in2nd.map(p => p.name).join(', ')} in the 2nd and ${in12th.map(p => p.name).join(', ')} in the 12th from the Moon.`)
    } else if (in2nd.length) {
      add('sunapha', 'Sunapha Yoga', 'benefic',
        `${in2nd.map(p => p.name).join(', ')} in the 2nd from the Moon.`)
    } else if (in12th.length) {
      add('anapha', 'Anapha Yoga', 'benefic',
        `${in12th.map(p => p.name).join(', ')} in the 12th from the Moon.`)
    } else if (!withMoon.length) {
      const kendraFromMoon = others.some(p => KENDRA.includes(houseFrom(moon.sign, p.sign)))
      if (kendraFromMoon) {
        add('kemadruma-cancelled', 'Kemadruma Yoga (cancelled)', 'neutral',
          'No planets around or with the Moon, but a planet in a kendra from the Moon cancels the Kemadruma.')
      } else {
        add('kemadruma', 'Kemadruma Yoga', 'challenging',
          'No planets (excluding Sun and nodes) with the Moon or in the 2nd/12th from it, and none in a kendra from the Moon.')
      }
    }
  }

  // ── Amala: natural benefic in the 10th from lagna or Moon ──
  const isWaxing = moon && sun ? ((moon.lon - sun.lon + 360) % 360) < 180 : false
  const benefics = planets.filter(p =>
    p.name === 'Jupiter' || p.name === 'Venus' ||
    (p.name === 'Mercury' && !p.combust) || (p.name === 'Moon' && isWaxing))
  for (const b of benefics) {
    const fromLagna = b.house === 10
    const fromMoon  = moon && b.name !== 'Moon' && houseFrom(moon.sign, b.sign) === 10
    if (fromLagna || fromMoon) {
      add(`amala-${b.name.toLowerCase()}`, 'Amala Yoga', 'benefic',
        `${b.name} (natural benefic) in the 10th from ${fromLagna ? 'lagna' : 'the Moon'}.`)
    }
  }

  // ── Kala Sarpa: all seven classical planets within the Rahu→Ketu arc ──
  const rahu = byName.Rahu, ketu = byName.Ketu
  if (rahu && ketu) {
    const seven = planets.filter(p => !['Rahu', 'Ketu'].includes(p.name))
    const within = (start, end, lon) => ((lon - start + 360) % 360) < ((end - start + 360) % 360)
    const allRahuSide = seven.every(p => within(rahu.lon, ketu.lon, p.lon))
    const allKetuSide = seven.every(p => within(ketu.lon, rahu.lon, p.lon))
    if (allRahuSide || allKetuSide) {
      add('kala-sarpa', 'Kala Sarpa Yoga', 'challenging',
        `All seven classical planets lie on one side of the Rahu–Ketu axis (${signName(rahu.sign)}–${signName(ketu.sign)}).`)
    }
  }

  return yogas
}
