/**
 * JHora vs App comparison test (v2)
 *
 * Fixes two bugs in v1:
 *  1. Traversal at intermediate levels used planet-name OR time-containment (OR is wrong —
 *     name-match against a later-index planet loses to time-containment against an earlier
 *     planet when the anchor is off by ~52min). Fix: use time-containment at intermediate
 *     levels, name-match only at the final level.
 *  2. Deha sub-periods (all 9 planets) inside a single PAD were compared by descending
 *     into that planet's own MD sub-tree instead of the owning PAD's sub-tree.  Fix: parse
 *     parent context from the JHora file and carry it into the traversal.
 *
 * JHora settings assumed: Lahiri ayanamsa, True Sidereal Solar Year (TSSY).
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const sweModule = await import(join(rootDir, 'node_modules/swisseph-wasm/src/swisseph.js'))
const SwissEph = sweModule.default
const swe = new SwissEph()
await swe.initSwissEph()
swe.set_sid_mode(1, 0, 0)

const { calcDasha, ensureChildren, LEVEL_NAMES } = await import(join(rootDir, 'src/core/dasha.js'))
const { getNakshatraInfo } = await import(join(rootDir, 'src/core/calculations.js'))
const { calcPanchang } = await import(join(rootDir, 'src/core/panchang.js'))

// ─── helpers ──────────────────────────────────────────────────────────────────

function toJD(year, month, day, hour, minute, second, tzOffsetHours) {
  const totalHour = hour + minute / 60 + second / 3600 - tzOffsetHours
  const utcDate = new Date(Date.UTC(year, month - 1, day) + totalHour * 3600000)
  const y = utcDate.getUTCFullYear(), m = utcDate.getUTCMonth() + 1
  const d = utcDate.getUTCDate()
  const h = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60 + utcDate.getUTCSeconds() / 3600
  let Y = y, M = m; if (M <= 2) { Y--; M += 12 }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + h / 24 + B - 1524.5
}

function calcBirthChartLocal(jd, lat, lon, settings, swe) {
  const flags = 65536 | 256 | (settings.planetPositions === 'true' ? 512 : 0)
  const housesResult = swe.houses_ex(jd, 65536, lat, lon, 'P')
  const lagnaLon = ((housesResult.ascmc[0] % 360) + 360) % 360
  const planets = [0, 1, 2, 3, 4, 5, 6, 10].map(id => {
    const result = swe.calc_ut(jd, id, flags)
    const pLon = result[0]
    const name = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu'][id === 10 ? 7 : id]
    if (name === 'Rahu') {
      const kLon = (pLon + 180) % 360
      return [{ name: 'Rahu', lon: pLon }, { name: 'Ketu', lon: kLon }]
    }
    return { name, lon: pLon }
  }).flat()
  return { planets, lagna: { lon: lagnaLon, name: 'Lagna' } }
}

function parseLon(str) {
  const parts = str.match(/(\d+)\s+([A-Z][a-z])\s+(\d+)'\s+(\d+(?:\.\d+)?)"/)
  if (!parts) return null
  const rasis = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi']
  const rasiIdx = rasis.indexOf(parts[2])
  if (rasiIdx === -1) return null
  return rasiIdx * 30 + parseInt(parts[1]) + parseInt(parts[3]) / 60 + parseFloat(parts[4]) / 3600
}

/** Parse JHora date string assuming local timezone (IST on this machine). */
function parseJhoraDate(str) {
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})\s+\((\d+):(\d+):(\d+)\s+(am|pm)\)/i)
  if (!m) return null
  let h = parseInt(m[4])
  if (m[7].toLowerCase() === 'pm' && h < 12) h += 12
  if (m[7].toLowerCase() === 'am' && h === 12) h = 0
  return new Date(`${m[1]}-${m[2]}-${m[3]} ${h}:${m[5]}:${m[6]}`)
}

function formatDiff(seconds) {
  if (isNaN(seconds) || seconds == null) return 'N/A'
  const abs = Math.abs(seconds)
  if (abs < 60) return `${Math.round(seconds)}s`
  const mins = Math.round(abs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(abs / 3600)
  if (hours < 24) return `${hours}h`
  const days = Math.round(abs / 86400)
  return `${days}d`
}

// ─── JHora file parser (v2 — tracks parent hierarchy) ─────────────────────────

/**
 * Each dasha entry carries a `path`: ordered list of {planet, level} ancestors.
 * For a Deha entry inside Sun PAD → Sun SD → Sun PD → Sun AD → Sun MD, the path is:
 *   [{planet:'Sun',level:'MD'},{planet:'Sun',level:'AD'},{planet:'Sun',level:'PD'},
 *    {planet:'Sun',level:'SD'},{planet:'Sun',level:'PAD'}]
 */
function parseJhoraFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const data = { planets: {}, panchang: {}, dashas: [] }

  // Header
  const dateMatch = content.match(/Date:\s+(.*)/)
  const timeMatch = content.match(/Time:\s+(.*)/)
  const tzMatch = content.match(/Time Zone:\s+(.*)\s+\(East of GMT\)/)
  const placeMatch = content.match(/Place:\s+(\d+)\s+E\s+(\d+)'\s+(\d+)",\s+(\d+)\s+N\s+(\d+)'\s+(\d+)"/)

  if (dateMatch && timeMatch && tzMatch && placeMatch) {
    const dateStr = dateMatch[1].trim()
    const timeStr = timeMatch[1].trim()
    const dt = new Date(dateStr + ' ' + timeStr)
    data.year = dt.getFullYear(); data.month = dt.getMonth() + 1; data.day = dt.getDate()
    let [h, m, s] = timeStr.split(/:|\s/)
    h = parseInt(h); m = parseInt(m); s = parseInt(s)
    if (timeStr.toLowerCase().includes('pm') && h < 12) h += 12
    if (timeStr.toLowerCase().includes('am') && h === 12) h = 0
    data.hour = h; data.minute = m; data.second = s
    const tzStr = tzMatch[1].trim()
    const [tzH, tzM] = tzStr.split(':').map(parseFloat)
    data.tzOffset = tzH + tzM / 60
    data.lon = parseInt(placeMatch[1]) + parseInt(placeMatch[2]) / 60 + parseInt(placeMatch[3]) / 3600
    data.lat = parseInt(placeMatch[4]) + parseInt(placeMatch[5]) / 60 + parseInt(placeMatch[6]) / 3600
  }

  // Planets
  let inPlanets = false
  for (const line of lines) {
    if (line.startsWith('Body')) { inPlanets = true; continue }
    if (inPlanets) {
      if (line.trim() === '' || line.startsWith('#')) { if (line.startsWith('#')) inPlanets = false; continue }
      const parts = line.split(/\s{2,}/)
      if (parts.length >= 2) {
        const fullName = parts[0].trim(), name = fullName.split(' - ')[0].trim().split(' ')[0]
        if (['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'].includes(name) &&
          (!fullName.includes('Sphuta') || name === 'Lagna')) {
          const lon = parseLon(parts[1].trim())
          if (lon !== null && (!data.planets[name] || fullName.includes(' - '))) data.planets[name] = { lon }
        }
      }
    }
  }

  // Panchang
  const tithiMatch = content.match(/Tithi:\s+(.*)\s+\((.*)\)\s+\((.*)% left\)/)
  if (tithiMatch) data.panchang.tithiPercentLeft = parseFloat(tithiMatch[3])
  const nakMatch = content.match(/Nakshatra:\s+(.*)\s+\((.*)\)\s+\((.*)% left\)/)
  if (nakMatch) data.panchang.nakshatraPercentLeft = parseFloat(nakMatch[3])
  const yogaMatch = content.match(/Yoga:\s+(.*)\s+\((.*)\)\s+\((.*)% left\)/)
  if (yogaMatch) data.panchang.yogaPercentLeft = parseFloat(yogaMatch[3])
  const ghatiMatch = content.match(/Janma Ghatis:\s+(.*)/)
  if (ghatiMatch) data.panchang.ghatisSinceSunrise = parseFloat(ghatiMatch[1])

  // Dasha — parse with parent-path awareness
  // Track indentation depth: each leading space = 1 level (JHora uses 1-space indents)
  // Lines look like:
  //   " Sun MD: date - date"          depth 1 (1 space)
  //   "  Sun AD: ..."                  depth 2
  //   "   Sun PD: ..."                 depth 3
  //   "    Sun SD: ..."                depth 4
  //   "     Sun PAD: ..."              depth 5
  //   "      Deha-antardasas..."       depth 6 (marker line, not a dasha)
  //   "      Sun: date - date"         depth 6 (Deha entry, no level keyword)

  const dashaSections = content.split('## ')
  for (const section of dashaSections) {
    const slines = section.split('\n')
    const title = slines[0].trim()
    if (!title.includes('Dasha')) continue

    // Stack tracks the current ancestor path (level-indexed entries)
    // stack[0] = MD, stack[1] = AD, stack[2] = PD, stack[3] = SD, stack[4] = PAD
    const stack = []

    for (const line of slines.slice(1)) {
      if (line.trim() === '' || line.trim().startsWith('Deha-antardasas')) continue

      // Count leading spaces for depth
      const spaces = line.match(/^(\s*)/)[1].length

      // MD/AD/PD/SD/PAD line
      const m = line.match(/^\s*(\w+)\s+(MD|AD|PD|SD|PAD):\s+(.*)\s+-\s+(.*)/)
      if (m) {
        const levelMap = { MD: 0, AD: 1, PD: 2, SD: 3, PAD: 4 }
        const depth = levelMap[m[2]]
        const start = parseJhoraDate(m[3])
        const end = parseJhoraDate(m[4])
        const entry = { planet: m[1], level: m[2], start, end, path: stack.slice(0, depth) }
        // Trim stack to current depth and push this entry
        stack[depth] = { planet: m[1], level: m[2] }
        stack.length = depth + 1
        data.dashas.push(entry)
        continue
      }

      // Deha line (inside "Deha-antardasas" block, no level keyword)
      // Only emit if we have a PAD in stack (depth 4)
      if (stack.length >= 5 && spaces >= 6) {
        const dm = line.match(/^\s*(\w+):\s+(.*)\s+-\s+(.*)/)
        if (dm && !dm[0].includes('MD:') && !dm[0].includes('AD:') &&
          !dm[0].includes('PD:') && !dm[0].includes('SD:') && !dm[0].includes('PAD:')) {
          const start = parseJhoraDate(dm[2])
          const end = parseJhoraDate(dm[3])
          if (start && end) {
            data.dashas.push({
              planet: dm[1], level: 'Deha', start, end,
              path: stack.slice(0, 5)   // path = [MD, AD, PD, SD, PAD]
            })
          }
        }
      }
    }
  }

  return data
}

// ─── fixed tree traversal ─────────────────────────────────────────────────────

const LEVEL_ORDER = { MD: 0, AD: 1, PD: 2, SD: 3, PAD: 4, Deha: 5 }
const FLAGS = 65536 | 256 | 512

/**
 * Navigate the dasha tree to find the node matching jdasha.
 *
 * Strategy:
 *  - Intermediate levels: use time-containment (jdasha.start within [n.start, n.end))
 *  - Final level: use planet-name match (n.planet.startsWith(jdasha.planet))
 *  - For Deha entries, `jdasha.path` carries the full ancestor chain; we navigate that
 *    chain first (by time-containment at each step), then find the Deha by planet name.
 */
async function findNodeInTree(tree, jdasha) {
  const targetDepth = LEVEL_ORDER[jdasha.level]
  if (targetDepth == null) return null

  // For Deha (depth 5), path has 5 ancestors [MD, AD, PD, SD, PAD]
  // For others, we navigate by time containment through levels 0..(targetDepth-1)
  // then match by planet name at targetDepth.

  let currentTree = tree
  let node = null

  // Navigate ancestors (all levels above the target)
  for (let depth = 0; depth < targetDepth; depth++) {
    const isLastIntermediate = (depth === targetDepth - 1)

    if (jdasha.path && jdasha.path[depth]) {
      // We have explicit parent info from the parsed file — use it
      const parentPlanet = jdasha.path[depth].planet
      node = currentTree.find(n => n.planet.startsWith(parentPlanet))
    } else {
      // Navigate by time-containment
      node = currentTree.find(n => jdasha.start >= n.start && jdasha.start < n.end)
      // Fallback: the 52min anchor offset can push the start just before the correct MD —
      // extend tolerance by 2 hours for top-level MD only
      if (!node && depth === 0) {
        const twoHours = 2 * 3600 * 1000
        node = currentTree.find(n =>
          jdasha.start >= new Date(n.start.getTime() - twoHours) &&
          jdasha.start < n.end
        )
      }
    }

    if (!node) return null
    await ensureChildren(node, swe, FLAGS)
    currentTree = node.children
  }

  // At target depth, match by planet name
  node = currentTree.find(n => n.planet.startsWith(jdasha.planet))
  return node
}

// ─── main ─────────────────────────────────────────────────────────────────────

const jhoraFiles = fs.readdirSync(join(rootDir, 'jhora')).filter(f => f.endsWith('.md'))
const report = []

for (const file of jhoraFiles) {
  const jhoraData = parseJhoraFile(join(rootDir, 'jhora', file))
  if (!jhoraData.year) continue

  const jd = toJD(jhoraData.year, jhoraData.month, jhoraData.day,
    jhoraData.hour, jhoraData.minute, jhoraData.second, jhoraData.tzOffset)
  const settings = { yearMethod: 'true-solar', ayanamsa: 1, planetPositions: 'true', observerType: 'geocentric' }

  const appPanchang = calcPanchang(jd, jhoraData.lat, jhoraData.lon, { timezone: '+05:30' }, swe)
  const appChart = calcBirthChartLocal(jd, jhoraData.lat, jhoraData.lon, settings, swe)
  const moonPlanet = appChart.planets.find(p => p.name === 'Moon')
  const moon = { lon: moonPlanet.lon, nakshatraIndex: getNakshatraInfo(moonPlanet.lon).index }
  const appDasha = await calcDasha(moon, `${jhoraData.year}-${String(jhoraData.month).padStart(2, '0')}-${String(jhoraData.day).padStart(2, '0')}`, { settings, swe, jd })

  const fileReport = { name: file, panchang: [], planets: [], dasha: [] }

  // Panchang
  const checkP = (l, g, e, t) => {
    const d = Math.abs(g - e)
    fileReport.panchang.push(`${d > t ? '❌' : '✅'} ${l}: Diff ${d.toFixed(4)}`)
  }
  if (jhoraData.panchang.tithiPercentLeft !== undefined)
    checkP('Tithi % Left', appPanchang.tithi.percentLeft, jhoraData.panchang.tithiPercentLeft, 1.5)
  if (jhoraData.panchang.nakshatraPercentLeft !== undefined)
    checkP('Nakshatra % Left', appPanchang.nakshatra.percentLeft, jhoraData.panchang.nakshatraPercentLeft, 1.5)
  if (jhoraData.panchang.yogaPercentLeft !== undefined)
    checkP('Yoga % Left', appPanchang.yoga.percentLeft, jhoraData.panchang.yogaPercentLeft, 1.5)
  if (jhoraData.panchang.ghatisSinceSunrise !== undefined)
    checkP('Ghatis since Sunrise', appPanchang.ghatisSinceSunrise, jhoraData.panchang.ghatisSinceSunrise, 0.5)

  // Planets
  for (const name of ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
    const jP = jhoraData.planets[name]
    const appP = name === 'Lagna' ? appChart.lagna : appChart.planets.find(p => p.name === name)
    if (jP && appP) {
      const d = Math.abs(appP.lon - jP.lon)
      fileReport.planets.push(`${d > 0.015 ? '❌' : '✅'} ${name}: Diff ${d.toFixed(4)}°`)
    }
  }

  // Dasha
  // Tolerance: 10 minutes for MD/AD; 20 minutes for PD/SD/PAD/Deha (TSSY vs linear diverges slightly deeper)
  for (const jdasha of jhoraData.dashas) {
    if (!jdasha.end) continue

    const matchNode = await findNodeInTree(appDasha, jdasha)
    if (!matchNode) {
      fileReport.dasha.push(`⚠️  ${jdasha.level} ${jdasha.planet}: no match found (path: ${(jdasha.path || []).map(p => p.planet + p.level).join('>')})`)
      continue
    }

    const dEnd = (matchNode.end.getTime() - jdasha.end.getTime()) / 1000   // signed, seconds
    const dStart = (matchNode.start.getTime() - jdasha.start.getTime()) / 1000
    const tolerance = (jdasha.level === 'MD' || jdasha.level === 'AD') ? 600 : 1200
    const pass = Math.abs(dEnd) < tolerance

    fileReport.dasha.push(
      `${pass ? '✅' : '❌'} ${jdasha.level} ${jdasha.planet}: ` +
      `End ${formatDiff(dEnd)} (app${dEnd >= 0 ? '+' : ''}${formatDiff(dEnd)}), ` +
      `Start ${formatDiff(dStart)} (app${dStart >= 0 ? '+' : ''}${formatDiff(dStart)})`
    )
  }

  report.push(fileReport)
}

// ─── output ───────────────────────────────────────────────────────────────────

console.log('# JHora vs App Comparison Report (v2 — TSSY, Lahiri)\n')
console.log('Settings: yearMethod=true-solar, ayanamsa=Lahiri\n')

for (const r of report) {
  console.log(`## ${r.name}`)
  console.log('### Panchang')
  r.panchang.forEach(l => console.log(l))
  console.log('\n### Planets')
  r.planets.forEach(l => console.log(l))
  console.log('\n### Dasha')
  r.dasha.forEach(l => console.log(l))
  console.log('\n---\n')
}

// ─── summary ──────────────────────────────────────────────────────────────────

const allDasha = report.flatMap(r => r.dasha)
const pass = allDasha.filter(l => l.startsWith('✅')).length
const fail = allDasha.filter(l => l.startsWith('❌')).length
const warn = allDasha.filter(l => l.startsWith('⚠️')).length
console.log(`## Summary`)
console.log(`Dasha: ${pass} pass, ${fail} fail, ${warn} unmatched`)

// Collect anchor offsets (MD level diffs)
console.log('\n### Anchor offset per chart (MD-level diffs)')
for (const r of report) {
  const mdDiffs = r.dasha
    .filter(l => l.includes('MD '))
    .map(l => {
      const m = l.match(/Start app([+-]\d+[smhd])/)
      return m ? m[1] : null
    })
    .filter(Boolean)
  console.log(`${r.name}: ${mdDiffs.join(', ')}`)
}
