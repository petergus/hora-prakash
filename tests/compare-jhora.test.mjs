import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const sweModule = await import(join(rootDir, 'node_modules/swisseph-wasm/src/swisseph.js'))
const SwissEph = sweModule.default
const swe = new SwissEph()
await swe.initSwissEph()
// JHora uses Lahiri (1) by default
swe.set_sid_mode(1, 0, 0)

const { calcPanchang } = await import(join(rootDir, 'src/core/panchang.js'))
const { calcDasha, ensureChildren, LEVEL_NAMES } = await import(join(rootDir, 'src/core/dasha.js'))
const { getNakshatraInfo } = await import(join(rootDir, 'src/core/calculations.js'))

function calcBirthChartLocal(jd, lat, lon, settings, swe) {
  const flags = 65536 | 256 | (settings.planetPositions === 'true' ? 512 : 0)
  const housesResult = swe.houses_ex(jd, 65536, lat, lon, 'P')
  const lagnaLon = ((housesResult.ascmc[0] % 360) + 360) % 360
  const planets = [0,1,2,3,4,5,6,10].map(id => {
    const result = swe.calc_ut(jd, id, flags)
    let pLon = result[0]
    const name = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Rahu'][id === 10 ? 7 : id]
    if (name === 'Rahu') {
       const kLon = (pLon + 180) % 360
       return [{ name: 'Rahu', lon: pLon }, { name: 'Ketu', lon: kLon }]
    }
    return { name, lon: pLon }
  }).flat()
  return { planets, lagna: { lon: lagnaLon, name: 'Lagna' } }
}

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

function parseLon(str) {
  const parts = str.match(/(\d+)\s+([A-Z][a-z])\s+(\d+)'\s+(\d+(?:\.\d+)?)"/)
  if (!parts) return null
  const rasis = ['Ar','Ta','Ge','Cn','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']
  const rasiIdx = rasis.indexOf(parts[2])
  if (rasiIdx === -1) return null
  return rasiIdx * 30 + parseInt(parts[1]) + parseInt(parts[3]) / 60 + parseFloat(parts[4]) / 3600
}

function parseJhoraDate(str) {
  // Format: "1913-11-14 (4:13:45 pm)"
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})\s+\((\d+):(\d+):(\d+)\s+(am|pm)\)/i)
  if (!m) return null
  let h = parseInt(m[4])
  if (m[7].toLowerCase() === 'pm' && h < 12) h += 12
  if (m[7].toLowerCase() === 'am' && h === 12) h = 0
  
  // Create a local date and adjust for IST (+5.5)
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]} ${h}:${m[5]}:${m[6]}`)
  return dt
}

function formatDiff(seconds) {
  if (isNaN(seconds)) return 'N/A'
  const abs = Math.abs(seconds)
  if (abs < 60) return `${Math.round(seconds)}s`
  const mins = Math.round(abs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(abs / 3600)
  if (hours < 24) return `${hours}h`
  const days = Math.round(abs / 86400)
  return `${days}d`
}

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
    const [tzH, tzM, tzS] = tzStr.split(':').map(parseFloat)
    data.tzOffset = tzH + tzM / 60 + tzS / 3600
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
        if (['Lagna','Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'].includes(name) && (!fullName.includes('Sphuta') || name === 'Lagna')) {
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

  // Dasha segments
  const dashaSections = content.split('## ')
  for (const section of dashaSections) {
    const lines = section.split('\n')
    const title = lines[0].trim()
    if (title.includes('Dasha')) {
      for (const line of lines) {
        const m = line.match(/^\s*(\w+)\s+(MD|AD|PD|SD|PAD):\s+(.*)\s+-\s+(.*)/)
        if (m) {
          data.dashas.push({ planet: m[1], level: m[2], start: parseJhoraDate(m[3]), end: parseJhoraDate(m[4]) })
        }
        const dehaMatch = line.match(/^\s*(\w+):\s+(.*)\s+-\s+(.*)/)
        if (dehaMatch && !line.includes('MD:') && section.includes('Deha-antardasas')) {
           data.dashas.push({ planet: dehaMatch[1], level: 'Deha', start: parseJhoraDate(dehaMatch[2]), end: parseJhoraDate(dehaMatch[3]) })
        }
      }
    }
  }

  return data
}

async function findDashaMatch(tree, jDasha, depth = 0) {
  const node = tree.find(n => n.planet.startsWith(jDasha.planet))
  if (!node) return null
  if (depth === 0 && jDasha.level === 'MD') return node
  if (depth === 1 && jDasha.level === 'AD') return node
  if (depth === 2 && jDasha.level === 'PD') return node
  if (depth === 3 && jDasha.level === 'SD') return node
  if (depth === 4 && jDasha.level === 'PAD') return node
  if (depth === 5 && jDasha.level === 'Deha') return node
  return null
}

const jhoraFiles = fs.readdirSync(join(rootDir, 'jhora')).filter(f => f.endsWith('.md'))
const report = []

for (const file of jhoraFiles) {
  const jhoraData = parseJhoraFile(join(rootDir, 'jhora', file))
  if (!jhoraData.year) continue
  const jd = toJD(jhoraData.year, jhoraData.month, jhoraData.day, jhoraData.hour, jhoraData.minute, jhoraData.second, jhoraData.tzOffset)
  const settings = { yearMethod: 'true-solar', ayanamsa: 1, planetPositions: 'true', observerType: 'geocentric' }
  const flags = 65536 | 256 | 512
  const appPanchang = calcPanchang(jd, jhoraData.lat, jhoraData.lon, { timezone: '+05:30' }, swe)
  const appChart = calcBirthChartLocal(jd, jhoraData.lat, jhoraData.lon, settings, swe)
  const moonPlanet = appChart.planets.find(p => p.name === 'Moon')
  const moon = { lon: moonPlanet.lon, nakshatraIndex: getNakshatraInfo(moonPlanet.lon).index }
  const appDasha = await calcDasha(moon, `${jhoraData.year}-${String(jhoraData.month).padStart(2,'0')}-${String(jhoraData.day).padStart(2,'0')}`, { settings, swe, jd })

  const fileReport = { name: file, panchang: [], planets: [], dasha: [] }
  const checkP = (l, g, e, t) => {
    const d = Math.abs(g - e)
    fileReport.panchang.push(`${d > t ? '❌' : '✅'} ${l}: Diff ${d.toFixed(4)}`)
  }
  if (jhoraData.panchang.tithiPercentLeft !== undefined) checkP('Tithi % Left', appPanchang.tithi.percentLeft, jhoraData.panchang.tithiPercentLeft, 1.5)
  if (jhoraData.panchang.nakshatraPercentLeft !== undefined) checkP('Nakshatra % Left', appPanchang.nakshatra.percentLeft, jhoraData.panchang.nakshatraPercentLeft, 1.5)
  if (jhoraData.panchang.yogaPercentLeft !== undefined) checkP('Yoga % Left', appPanchang.yoga.percentLeft, jhoraData.panchang.yogaPercentLeft, 1.5)
  if (jhoraData.panchang.ghatisSinceSunrise !== undefined) checkP('Ghatis since Sunrise', appPanchang.ghatisSinceSunrise, jhoraData.panchang.ghatisSinceSunrise, 0.5)

  for (const name of ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
    const jP = jhoraData.planets[name], appP = name === 'Lagna' ? appChart.lagna : appChart.planets.find(p => p.name === name)
    if (jP && appP) {
      const d = Math.abs(appP.lon - jP.lon)
      fileReport.planets.push(`${d > 0.015 ? '❌' : '✅'} ${name}: Diff ${d.toFixed(4)}`)
    }
  }

  // Compare Dashas
  for (const jdasha of jhoraData.dashas) {
    if (!jdasha.end) continue
    let level = 0, tree = appDasha
    if (jdasha.level === 'AD') level = 1
    else if (jdasha.level === 'PD') level = 2
    else if (jdasha.level === 'SD') level = 3
    else if (jdasha.level === 'PAD') level = 4
    else if (jdasha.level === 'Deha') level = 5

    let matchNode = null
    let currentTree = appDasha
    for (let i = 0; i <= level; i++) {
       matchNode = currentTree.find(n => n.planet.startsWith(jdasha.planet) || (i < level && jdasha.start >= n.start && jdasha.start < n.end))
       if (!matchNode) break
       if (i < level) {
          await ensureChildren(matchNode, swe, flags)
          currentTree = matchNode.children
       }
    }

    if (matchNode && (matchNode.planet.startsWith(jdasha.planet))) {
       const dEnd = Math.abs(matchNode.end.getTime() - jdasha.end.getTime()) / 1000
       const dStart = Math.abs(matchNode.start.getTime() - jdasha.start.getTime()) / 1000
       const pass = dEnd < 600 // 10 minutes tolerance for deep dashas
       fileReport.dasha.push(`${pass ? '✅' : '❌'} ${jdasha.level} ${jdasha.planet}: End Diff ${formatDiff(dEnd)}, Start Diff ${formatDiff(dStart)}`)
    }
  }
  report.push(fileReport)
}

console.log('# Deep Comparison Report: JHora vs This Application\n')
for (const r of report) {
  console.log(`## ${r.name}`)
  console.log('### Panchang'); r.panchang.forEach(l => console.log(l))
  console.log('\n### Planets'); r.planets.forEach(l => console.log(l))
  console.log('\n### Dasha (including Deha)'); r.dasha.forEach(l => console.log(l))
  console.log('\n---\n')
}
