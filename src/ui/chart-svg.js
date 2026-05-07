// src/ui/chart-svg.js
// Reference: https://github.com/VicharaVandana/jyotichart

const S = 480
const FONT = `font-family="Inter, system-ui, sans-serif"`

const NI_POLYS = {
  1:  [[1/2,0],[1/4,1/4],[1/2,1/2],[3/4,1/4]],
  2:  [[0,0],[1/2,0],[1/4,1/4]],
  3:  [[0,0],[0,1/2],[1/4,1/4]],
  4:  [[1/4,1/4],[0,1/2],[1/4,3/4],[1/2,1/2]],
  5:  [[0,1/2],[1/4,3/4],[0,1]],
  6:  [[1/2,1],[1/4,3/4],[0,1]],
  7:  [[1/2,1],[1/4,3/4],[1/2,1/2],[3/4,3/4]],
  8:  [[1/2,1],[3/4,3/4],[1,1]],
  9:  [[3/4,3/4],[1,1],[1,1/2]],
  10: [[3/4,3/4],[1,1/2],[3/4,1/4],[1/2,1/2]],
  11: [[1,1/2],[3/4,1/4],[1,0]],
  12: [[3/4,1/4],[1,0],[1/2,0]],
}

const SI_CELLS = [
  { sign: 12, col: 0, row: 0 },
  { sign: 1,  col: 1, row: 0 },
  { sign: 2,  col: 2, row: 0 },
  { sign: 3,  col: 3, row: 0 },
  { sign: 4,  col: 3, row: 1 },
  { sign: 5,  col: 3, row: 2 },
  { sign: 6,  col: 3, row: 3 },
  { sign: 7,  col: 2, row: 3 },
  { sign: 8,  col: 1, row: 3 },
  { sign: 9,  col: 0, row: 3 },
  { sign: 10, col: 0, row: 2 },
  { sign: 11, col: 0, row: 1 },
]

const TRANSIT_PLANET_COLORS = {
  Su: '#0369a1', Mo: '#4338ca', Ma: '#b91c1c',
  Me: '#047857', Ju: '#c2410c', Ve: '#9d174d',
  Sa: '#334155', Ra: '#5b21b6', Ke: '#0e7490',
}

const SIGN_ABBR  = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']
const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
export const CHALIT_LABELS = ['H1','H2','H3','H4','H5','H6','H7','H8','H9','H10','H11','H12']

function _tipAttr(p, isTransit) {
  const deg = p.degree ?? 0
  const d = Math.floor(deg), m = Math.round((deg % 1) * 60)
  const tip = {
    name:    p.name || (p.abbr === 'Asc' ? (isTransit ? 'Transit Asc' : 'Ascendant') : p.abbr),
    abbr:    p.abbr || 'Asc',
    sign:    p.sign ? SIGN_NAMES[p.sign - 1] : '',
    nak:     p.nakshatra || '',
    pada:    p.pada || '',
    deg:     `${d}° ${String(m).padStart(2, '0')}′`,
    speed:   typeof p.speed === 'number' ? p.speed : null,
    retro:   !!p.retrograde,
    transit: !!isTransit,
  }
  return `data-tip="${JSON.stringify(tip).replace(/"/g, '&quot;')}"`
}

function toPts(poly) {
  return poly.map(([x, y]) => `${(x * S).toFixed(1)},${(y * S).toFixed(1)}`).join(' ')
}

function centroid(poly) {
  const x = poly.reduce((s, p) => s + p[0], 0) / poly.length
  const y = poly.reduce((s, p) => s + p[1], 0) / poly.length
  return [x * S, y * S]
}

function bbox(poly) {
  return {
    minX: Math.min(...poly.map(p => p[0])) * S,
    minY: Math.min(...poly.map(p => p[1])) * S,
    maxX: Math.max(...poly.map(p => p[0])) * S,
    maxY: Math.max(...poly.map(p => p[1])) * S,
  }
}

function shortenLine(x1, y1, x2, y2, by) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < by * 2) return [x1, y1, x2, y2]
  const r = (len - by) / len
  return [x1, y1, x1 + dx * r, y1 + dy * r]
}

function buildArrowDefs(activeAspects) {
  if (!activeAspects || activeAspects.length === 0) return '<defs/>'
  const colors = [...new Set(activeAspects.map(a => a.color))]
  const markers = colors.map(color => {
    const id = `arrow-${color.replace('#', '')}`
    return `<marker id="${id}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="${color}" opacity="0.85"/>
    </marker>`
  })
  return `<defs>
    <style>@keyframes flowAspect { from { stroke-dashoffset: 26; } to { stroke-dashoffset: 0; } }</style>
    ${markers.join('\n    ')}
  </defs>`
}

// Place planets in available area, scaling font to avoid overflow
function placePlanets(ps, cx, areaTop, areaBottom, activePlanetColors = {}, isTransit = false) {
  if (ps.length === 0) return ''
  const areaH = areaBottom - areaTop
  const maxFont = 17
  const minFont = 11
  // Fit all planets with a minimum gap of 3px
  const lineH = Math.max(minFont + 3, Math.min(maxFont + 4, areaH / ps.length))
  const fontSize = Math.round(Math.min(maxFont, lineH - 3))
  const blockH = (ps.length - 1) * lineH
  // Baseline of first line: center block in area
  const firstY = areaTop + (areaH - blockH) / 2 + fontSize * 0.36

  return ps.map((p, i) => {
    const deg = typeof p.degree === 'number' ? p.degree.toFixed(0) + '°' : ''
    const r   = p.retrograde ? 'ᴿ' : ''
    const label = `${p.abbr}${r} ${deg}`
    const color  = p.isLagna ? '#c2410c' : '#1e293b'
    const weight = p.isLagna ? '700' : '500'
    const y = firstY + i * lineH
    const activeColor = !p.isLagna && activePlanetColors[p.abbr]
    const highlight = activeColor
      ? `<rect x="${(cx - 24).toFixed(1)}" y="${(y - fontSize + 1).toFixed(1)}" width="48" height="${fontSize + 3}" rx="3" fill="${activeColor}" opacity="0.2"/>`
      : ''
    const dataPlanet = !p.isLagna ? `data-planet="${p.abbr}"` : ''
    const tip = _tipAttr(p, isTransit)
    return highlight + `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-weight="${weight}" ${FONT} ${dataPlanet} ${tip} style="cursor:pointer">${label}</text>`
  }).join('\n')
}

function _northChartParts(planets, lagna, signLabels, activeAspects, activePlanetColors, isTransit = false) {
  const lagnaSign = lagna.sign

  const cellToSign = {}, signToCell = {}
  for (let cell = 1; cell <= 12; cell++) {
    const sign = ((lagnaSign - 1 + cell - 1) % 12) + 1
    cellToSign[cell] = sign
    signToCell[sign] = cell
  }

  const signCentroid = {}
  for (let cell = 1; cell <= 12; cell++) {
    signCentroid[cellToSign[cell]] = centroid(NI_POLYS[cell])
  }

  const cellPlanets = {}
  for (let c = 1; c <= 12; c++) cellPlanets[c] = []
  cellPlanets[1].push({ abbr: 'Asc', name: 'Ascendant', degree: lagna.degree, sign: lagna.sign, nakshatra: lagna.nakshatra, pada: lagna.pada, retrograde: false, isLagna: true })
  for (const p of planets) {
    const cell = signToCell[p.sign]
    if (cell) cellPlanets[cell].push(p)
  }

  const parts = []
  for (let cell = 1; cell <= 12; cell++) {
    const poly = NI_POLYS[cell]
    parts.push(`<polygon points="${toPts(poly)}" fill="transparent" stroke="#94a3b8" stroke-width="1.2" data-sign="${cellToSign[cell]}" style="cursor:context-menu" pointer-events="all"/>`)
    const [cx, cy] = centroid(poly)
    const { minY, maxY } = bbox(poly)
    const cellH = maxY - minY
    const signFontSize = 14
    const signY = minY + cellH * 0.22 + signFontSize
    const sign = cellToSign[cell]
    parts.push(`<text x="${cx.toFixed(1)}" y="${signY.toFixed(1)}" text-anchor="middle" font-size="${signFontSize}" font-weight="600" fill="#64748b" ${FONT}><tspan>${signLabels[sign - 1]}</tspan><tspan font-size="10" fill="#94a3b8" dy="-1"> ${sign}</tspan></text>`)
    parts.push(placePlanets(cellPlanets[cell], cx, signY + 4, maxY - 6, activePlanetColors, isTransit))
  }

  for (const { fromSign, toSigns, color } of activeAspects) {
    const from = signCentroid[fromSign]
    if (!from) continue
    for (const toSign of toSigns) {
      if (toSign === fromSign) continue
      const to = signCentroid[toSign]
      if (!to) continue
      const [x1, y1, x2, y2] = shortenLine(from[0], from[1], to[0], to[1], 18)
      const markerId = `arrow-${color.replace('#', '')}`
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.8" stroke-dasharray="8 5" marker-end="url(#${markerId})" opacity="0.85" style="animation:flowAspect 1.2s linear infinite"/>`)
    }
  }

  return parts
}

export function renderNorthIndianSVG(planets, lagna, signLabels, activeAspects = [], activePlanetColors = {}, isTransit = false) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
    ..._northChartParts(planets, lagna, signLabels, activeAspects, activePlanetColors, isTransit),
    '</svg>',
  ]
  return parts.join('\n')
}

function placeTransitPlanets(ps, cx, areaTop, areaBottom) {
  if (ps.length === 0) return ''
  const areaH = areaBottom - areaTop
  const lineH = Math.max(12, Math.min(15, areaH / ps.length))
  const fontSize = Math.round(Math.min(13, lineH - 2))
  const blockH = (ps.length - 1) * lineH
  const firstY = areaTop + (areaH - blockH) / 2 + fontSize * 0.36
  return ps.map((p, i) => {
    const deg = typeof p.degree === 'number' ? ` ${p.degree.toFixed(0)}°` : ''
    const label = p.isTransitLagna
      ? `Ascᵀ${deg}`
      : `${p.abbr}ᵀ${p.retrograde ? 'ᴿ' : ''}${deg}`
    const color = p.isTransitLagna ? '#c2410c' : (TRANSIT_PLANET_COLORS[p.abbr] ?? '#0369a1')
    const y = firstY + i * lineH
    const tip = _tipAttr(p, true)
    return `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-weight="600" ${FONT} data-planet="${p.abbr}" data-chart="transit" ${tip} style="cursor:pointer">${label}</text>`
  }).join('\n')
}

function _southChartParts(planets, lagna, signLabels, centerLabel, activeAspects, activePlanetColors, transitPlanets, transitFilter, isTransit = false) {
  const lagnaSign = lagna.sign
  const cs = S / 4  // 120px per cell

  const signPlanets = {}
  for (let s = 1; s <= 12; s++) signPlanets[s] = []
  signPlanets[lagnaSign].push({ abbr: 'Asc', name: 'Ascendant', degree: lagna.degree, sign: lagna.sign, nakshatra: lagna.nakshatra, pada: lagna.pada, retrograde: false, isLagna: true })
  for (const p of planets) signPlanets[p.sign].push(p)

  const transitBySign = {}
  for (let s = 1; s <= 12; s++) transitBySign[s] = []
  for (const p of (transitPlanets || [])) {
    if (p.isTransitLagna || !transitFilter || transitFilter.has(p.abbr)) transitBySign[p.sign].push(p)
  }

  const parts = [
    `<rect x="${cs}" y="${cs}" width="${cs * 2}" height="${cs * 2}" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1.5"/>`,
    ...centerLabel.split('\n').map((line, i, arr) => {
      const totalH = arr.length * 28
      const y = S / 2 - totalH / 2 + i * 28 + 20
      return `<text x="${S/2}" y="${y}" text-anchor="middle" font-size="20" font-weight="700" fill="#c2410c" ${FONT}>${line}</text>`
    }),
  ]

  for (const { sign, col, row } of SI_CELLS) {
    const x = col * cs, y = row * cs
    const house = ((sign - lagnaSign + 12) % 12) + 1
    const isLagnaCell = sign === lagnaSign
    const tp = transitBySign[sign]

    parts.push(`<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${isLagnaCell ? '#fff7ed' : '#fafafa'}" stroke="#94a3b8" stroke-width="1.2" data-sign="${sign}" style="cursor:context-menu"/>`)
    const headerH = 24
    parts.push(`<text x="${x + 5}" y="${y + headerH - 4}" font-size="14" font-weight="600" fill="#475569" ${FONT}><tspan>${signLabels[sign - 1]}</tspan><tspan font-size="10" fill="#94a3b8" dy="-1"> ${sign}</tspan></text>`)
    parts.push(`<text x="${x + cs - 5}" y="${y + headerH - 4}" text-anchor="end" font-size="14" font-weight="600" fill="${isLagnaCell ? '#c2410c' : '#94a3b8'}" ${FONT}>${house}</text>`)
    parts.push(`<line x1="${x + 2}" y1="${y + headerH}" x2="${x + cs - 2}" y2="${y + headerH}" stroke="#e2e8f0" stroke-width="0.8"/>`)

    const cx = x + cs / 2
    if (tp && tp.length > 0) {
      const midY = y + headerH + 2 + (cs - headerH - 6) / 2
      parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, midY - 2, activePlanetColors, isTransit))
      parts.push(`<line x1="${x + 4}" y1="${midY}" x2="${x + cs - 4}" y2="${midY}" stroke="#fde68a" stroke-width="0.8" stroke-dasharray="3 2"/>`)
      parts.push(placeTransitPlanets(tp, cx, midY + 2, y + cs - 4))
    } else {
      parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, y + cs - 4, activePlanetColors, isTransit))
    }
  }

  const siCentroid = {}
  for (const { sign, col, row } of SI_CELLS) {
    siCentroid[sign] = [col * cs + cs / 2, row * cs + cs / 2]
  }

  for (const { fromSign, toSigns, color } of activeAspects) {
    const from = siCentroid[fromSign]
    if (!from) continue
    for (const toSign of toSigns) {
      if (toSign === fromSign) continue
      const to = siCentroid[toSign]
      if (!to) continue
      const [x1, y1, x2, y2] = shortenLine(from[0], from[1], to[0], to[1], 18)
      const markerId = `arrow-${color.replace('#', '')}`
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.8" stroke-dasharray="8 5" marker-end="url(#${markerId})" opacity="0.85" style="animation:flowAspect 1.2s linear infinite"/>`)
    }
  }

  return parts
}

export function renderSouthIndianSVG(planets, lagna, signLabels, centerLabel = 'Rashi\nChart', activeAspects = [], activePlanetColors = {}, isTransit = false) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
    ..._southChartParts(planets, lagna, signLabels, centerLabel, activeAspects, activePlanetColors, [], new Set(), isTransit),
    '</svg>',
  ]
  return parts.join('\n')
}

function _calcBorders(byHouse) {
  const maxAll = Math.max(0, ...Object.values(byHouse).map(a => a.length))
  const B = maxAll === 0 ? 24 : maxAll >= 4 ? 52 : 36
  return { BH: B, BV: B }
}

function _borderSections(BH, BV, Sc) {
  const third = Sc / 3
  return [
    { house: 2,  x: BV,             y: 0,       w: third, h: BH, horiz: true },
    { house: 1,  x: BV + third,     y: 0,       w: third, h: BH, horiz: true },
    { house: 12, x: BV + third * 2, y: 0,       w: third, h: BH, horiz: true },
    { house: 3,  x: 0, y: BH,             w: BV, h: third, horiz: false },
    { house: 4,  x: 0, y: BH + third,     w: BV, h: third, horiz: false },
    { house: 5,  x: 0, y: BH + third * 2, w: BV, h: third, horiz: false },
    { house: 6,  x: BV,             y: BH + Sc, w: third, h: BH, horiz: true },
    { house: 7,  x: BV + third,     y: BH + Sc, w: third, h: BH, horiz: true },
    { house: 8,  x: BV + third * 2, y: BH + Sc, w: third, h: BH, horiz: true },
    { house: 11, x: BV + Sc, y: BH,             w: BV, h: third, horiz: false },
    { house: 10, x: BV + Sc, y: BH + third,     w: BV, h: third, horiz: false },
    { house: 9,  x: BV + Sc, y: BH + third * 2, w: BV, h: third, horiz: false },
  ]
}

export function renderTransitBorderSVG(natalPlanets, natalLagna, transitPlanets, style, filter, activeAspects = [], activePlanetColors = {}, transitLagna = null, transitActivePlanetColors = {}, zoom = 3) {
  // Scale viewBox by zoom so fonts remain readable at any zoom level
  const zScale = [0.55, 0.70, 0.85, 1.00, 1.20][Math.max(0, Math.min(4, (zoom || 3) - 1))]
  const Sc = Math.round(S * zScale)

  const tLagnaEntry = transitLagna
    ? { abbr: 'Asc', name: 'Transit Asc', sign: transitLagna.sign, degree: transitLagna.degree,
        nakshatra: transitLagna.nakshatra, pada: transitLagna.pada,
        retrograde: false, isTransitLagna: true,
        house: ((transitLagna.sign - natalLagna.sign + 12) % 12) + 1 }
    : null

  if (style === 'south') {
    const tPlanets = tLagnaEntry ? [...(transitPlanets || []), tLagnaEntry] : (transitPlanets || [])
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${Sc}px">`,
      `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
      buildArrowDefs(activeAspects),
      ..._southChartParts(natalPlanets, natalLagna, SIGN_ABBR, 'Natal\nTransit', activeAspects, activePlanetColors, tPlanets, filter),
      '</svg>',
    ]
    return parts.join('\n')
  }

  // North Indian overlay — dynamic border, unified background, extended structural lines
  const byHouse = {}
  for (const p of (transitPlanets || [])) {
    if (!filter.has(p.abbr)) continue
    if (!byHouse[p.house]) byHouse[p.house] = []
    byHouse[p.house].push(p)
  }
  if (tLagnaEntry) {
    if (!byHouse[tLagnaEntry.house]) byHouse[tLagnaEntry.house] = []
    byHouse[tLagnaEntry.house].push(tLagnaEntry)
  }

  const rawB = _calcBorders(byHouse).BH
  const B  = Math.round(rawB * zScale)
  const BH = B, BV = B
  const TW = Sc + BV * 2
  const TH = Sc + BH * 2
  const third = Sc / 3

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TW} ${TH}" style="width:100%;height:auto">`,
    buildArrowDefs(activeAspects),
    `<rect width="${TW}" height="${TH}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
  ]

  // Corner diagonal lines
  parts.push(`<line x1="0" y1="0" x2="${BV}" y2="${BH}" stroke="#94a3b8" stroke-width="0.8"/>`)
  parts.push(`<line x1="${TW}" y1="0" x2="${BV+Sc}" y2="${BH}" stroke="#94a3b8" stroke-width="0.8"/>`)
  parts.push(`<line x1="0" y1="${TH}" x2="${BV}" y2="${BH+Sc}" stroke="#94a3b8" stroke-width="0.8"/>`)
  parts.push(`<line x1="${TW}" y1="${TH}" x2="${BV+Sc}" y2="${BH+Sc}" stroke="#94a3b8" stroke-width="0.8"/>`)

  // Section divider lines
  const sl = '#cbd5e1'
  parts.push(`<line x1="${BV+third}" y1="0" x2="${BV+third}" y2="${BH}" stroke="${sl}" stroke-width="0.8"/>`)
  parts.push(`<line x1="${BV+third*2}" y1="0" x2="${BV+third*2}" y2="${BH}" stroke="${sl}" stroke-width="0.8"/>`)
  parts.push(`<line x1="${BV+third}" y1="${BH+Sc}" x2="${BV+third}" y2="${TH}" stroke="${sl}" stroke-width="0.8"/>`)
  parts.push(`<line x1="${BV+third*2}" y1="${BH+Sc}" x2="${BV+third*2}" y2="${TH}" stroke="${sl}" stroke-width="0.8"/>`)
  parts.push(`<line x1="0" y1="${BH+third}" x2="${BV}" y2="${BH+third}" stroke="${sl}" stroke-width="0.8"/>`)
  parts.push(`<line x1="0" y1="${BH+third*2}" x2="${BV}" y2="${BH+third*2}" stroke="${sl}" stroke-width="0.8"/>`)
  parts.push(`<line x1="${BV+Sc}" y1="${BH+third}" x2="${TW}" y2="${BH+third}" stroke="${sl}" stroke-width="0.8"/>`)
  parts.push(`<line x1="${BV+Sc}" y1="${BH+third*2}" x2="${TW}" y2="${BH+third*2}" stroke="${sl}" stroke-width="0.8"/>`)

  // Planet labels per border section
  function _renderTransitLabel(p, x, y, fs) {
    const deg    = typeof p.degree === 'number' ? ` ${p.degree.toFixed(0)}°` : ''
    const label  = p.isTransitLagna ? `Ascᵀ${deg}` : `${p.abbr}ᵀ${p.retrograde ? 'ᴿ' : ''}${deg}`
    const abbrKey = p.isTransitLagna ? 'Asc' : p.abbr
    const activeColor = transitActivePlanetColors[abbrKey]
    const color  = p.isTransitLagna ? '#c2410c' : (activeColor ?? TRANSIT_PLANET_COLORS[p.abbr] ?? '#0369a1')
    const fontSize = p.isTransitLagna ? fs + 1 : fs
    const weight = p.isTransitLagna ? '700' : '600'
    const tipAttr = _tipAttr(p, true)
    return { label, color, abbrKey, fontSize, weight, tipAttr, activeColor }
  }

  for (const sec of _borderSections(BH, BV, Sc)) {
    const { house, x, y, w, h, horiz } = sec
    const ps = byHouse[house] || []

    if (horiz) {
      parts.push(`<text x="${(x+3).toFixed(1)}" y="${(y+10).toFixed(1)}" font-size="9" fill="#94a3b8" ${FONT}>H${house}</text>`)
      if (ps.length > 0) {
        const rows = ps.length >= 4
          ? [ps.slice(0, Math.ceil(ps.length / 2)), ps.slice(Math.ceil(ps.length / 2))]
          : [ps]
        const rowYs = rows.length === 2 ? [y + h * 0.38, y + h * 0.78] : [y + h * 0.65]
        rows.forEach((row, ri) => {
          const slotW = w / row.length
          const fs = slotW > 90 ? 12 : slotW > 65 ? 11 : 10
          const ry = rowYs[ri]
          row.forEach((p, i) => {
            const { label, color, abbrKey, fontSize, weight, tipAttr, activeColor } = _renderTransitLabel(p, x, y, fs)
            const px = x + slotW * (i + 0.5)
            if (activeColor) parts.push(`<rect x="${(px - 20).toFixed(1)}" y="${(ry - fontSize).toFixed(1)}" width="40" height="${fontSize + 3}" rx="3" fill="${activeColor}" opacity="0.2"/>`)
            parts.push(`<text x="${px.toFixed(1)}" y="${ry.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-weight="${weight}" ${FONT} data-planet="${abbrKey}" data-chart="transit" ${tipAttr} style="cursor:pointer">${label}</text>`)
          })
        })
      }
    } else {
      const cx_s = x + w / 2
      const cy_s = y + h / 2
      const rot  = `rotate(-90, ${cx_s.toFixed(1)}, ${cy_s.toFixed(1)})`
      parts.push(`<text x="${(x + w / 2).toFixed(1)}" y="${(y + 10).toFixed(1)}" text-anchor="middle" font-size="9" fill="#94a3b8" ${FONT}>H${house}</text>`)

      if (ps.length > 0) {
        const rows = ps.length >= 4
          ? [ps.slice(0, Math.ceil(ps.length / 2)), ps.slice(Math.ceil(ps.length / 2))]
          : [ps]
        rows.forEach((rowPs, ri) => {
          const rowSlotH = h / rowPs.length
          const fs = rowSlotH > 90 ? 12 : rowSlotH > 65 ? 11 : 10
          const ly = cy_s + w * ((ri + 0.5) / rows.length - 0.5)
          rowPs.forEach((p, i) => {
            const lx = cy_s + cx_s - y - rowSlotH * (i + 0.5)
            const { label, color, abbrKey, fontSize, weight, tipAttr, activeColor } = _renderTransitLabel(p, x, y, fs)
            if (activeColor) parts.push(`<rect x="${(lx - 20).toFixed(1)}" y="${(ly - fontSize).toFixed(1)}" width="40" height="${fontSize + 3}" rx="3" fill="${activeColor}" opacity="0.2" transform="${rot}"/>`)
            parts.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-weight="${weight}" transform="${rot}" ${FONT} data-planet="${abbrKey}" data-chart="transit" ${tipAttr} style="cursor:pointer">${label}</text>`)
          })
        })
      }
    }
  }

  // Inner natal chart scaled to Sc×Sc
  parts.push(`<g transform="translate(${BV},${BH}) scale(${(Sc / S).toFixed(6)})">`)
  parts.push(`<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`)
  parts.push(..._northChartParts(natalPlanets, natalLagna, SIGN_ABBR, activeAspects, activePlanetColors))
  parts.push(`</g>`)

  parts.push('</svg>')
  return parts.join('\n')
}

export function renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR, centerLabel, activeAspects = [], activePlanetColors = {}, isTransit = false) {
  return style === 'south'
    ? renderSouthIndianSVG(planets, lagna, signLabels, centerLabel, activeAspects, activePlanetColors, isTransit)
    : renderNorthIndianSVG(planets, lagna, signLabels, activeAspects, activePlanetColors, isTransit)
}
