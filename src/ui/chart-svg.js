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

const SIGN_ABBR = ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi']
export const CHALIT_LABELS = ['H1','H2','H3','H4','H5','H6','H7','H8','H9','H10','H11','H12']

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
function placePlanets(ps, cx, areaTop, areaBottom, activePlanetColors = {}) {
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
    const cursorStyle = !p.isLagna ? 'style="cursor:pointer"' : ''
    return highlight + `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-weight="${weight}" ${FONT} ${dataPlanet} ${cursorStyle}>${label}</text>`
  }).join('\n')
}

export function renderNorthIndianSVG(planets, lagna, signLabels, activeAspects = [], activePlanetColors = {}) {
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
  cellPlanets[1].push({ abbr: 'Asc', degree: lagna.degree, retrograde: false, isLagna: true })
  for (const p of planets) {
    const cell = signToCell[p.sign]
    if (cell) cellPlanets[cell].push(p)
  }

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
  ]

  for (let cell = 1; cell <= 12; cell++) {
    const poly = NI_POLYS[cell]
    parts.push(`<polygon points="${toPts(poly)}" fill="none" stroke="#94a3b8" stroke-width="1.2" data-sign="${cellToSign[cell]}" style="cursor:context-menu"/>`)

    // Always use true centroid for X — bbox midpoint is wrong for asymmetric triangles
    const [cx, cy] = centroid(poly)
    const { minY, maxY } = bbox(poly)
    const cellH = maxY - minY

    // Sign abbr: upper quarter of cell, centered on true centroid X
    const signFontSize = 14
    const signY = minY + cellH * 0.22 + signFontSize
    const sign = cellToSign[cell]
    parts.push(`<text x="${cx.toFixed(1)}" y="${signY.toFixed(1)}" text-anchor="middle" font-size="${signFontSize}" font-weight="600" fill="#64748b" ${FONT}><tspan>${signLabels[sign - 1]}</tspan><tspan font-size="10" fill="#94a3b8" dy="-1"> ${sign}</tspan></text>`)

    // Planets fill remaining area below sign label
    parts.push(placePlanets(cellPlanets[cell], cx, signY + 4, maxY - 6, activePlanetColors))
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

  parts.push('</svg>')
  return parts.join('\n')
}

export function renderSouthIndianSVG(planets, lagna, signLabels, centerLabel = 'Rashi\nChart', activeAspects = [], activePlanetColors = {}) {
  const lagnaSign = lagna.sign
  const cs = S / 4  // 120px per cell

  const signPlanets = {}
  for (let s = 1; s <= 12; s++) signPlanets[s] = []
  signPlanets[lagnaSign].push({ abbr: 'Asc', degree: lagna.degree, retrograde: false, isLagna: true })
  for (const p of planets) signPlanets[p.sign].push(p)

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    buildArrowDefs(activeAspects),
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

    parts.push(`<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${isLagnaCell ? '#fff7ed' : '#fafafa'}" stroke="#94a3b8" stroke-width="1.2" data-sign="${sign}" style="cursor:context-menu"/>`)

    // Sign abbr top-left, house number top-right — fixed header row height = 24px
    const headerH = 24
    parts.push(`<text x="${x + 5}" y="${y + headerH - 4}" font-size="14" font-weight="600" fill="#475569" ${FONT}><tspan>${signLabels[sign - 1]}</tspan><tspan font-size="10" fill="#94a3b8" dy="-1"> ${sign}</tspan></text>`)
    parts.push(`<text x="${x + cs - 5}" y="${y + headerH - 4}" text-anchor="end" font-size="14" font-weight="600" fill="${isLagnaCell ? '#c2410c' : '#94a3b8'}" ${FONT}>${house}</text>`)

    // Separator line below header
    parts.push(`<line x1="${x + 2}" y1="${y + headerH}" x2="${x + cs - 2}" y2="${y + headerH}" stroke="#e2e8f0" stroke-width="0.8"/>`)

    // Planets fill the area below the header
    const cx = x + cs / 2
    parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, y + cs - 4, activePlanetColors))
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

  parts.push('</svg>')
  return parts.join('\n')
}

export function renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR, centerLabel, activeAspects = [], activePlanetColors = {}) {
  return style === 'south'
    ? renderSouthIndianSVG(planets, lagna, signLabels, centerLabel, activeAspects, activePlanetColors)
    : renderNorthIndianSVG(planets, lagna, signLabels, activeAspects, activePlanetColors)
}
