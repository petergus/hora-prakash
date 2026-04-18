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

// Place planets in available area, scaling font to avoid overflow
function placePlanets(ps, cx, areaTop, areaBottom) {
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
    return `<text x="${cx.toFixed(1)}" y="${(firstY + i * lineH).toFixed(1)}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-weight="${weight}" ${FONT}>${label}</text>`
  }).join('\n')
}

export function renderNorthIndianSVG(planets, lagna, signLabels) {
  const lagnaSign = lagna.sign

  const cellToSign = {}, signToCell = {}
  for (let cell = 1; cell <= 12; cell++) {
    const sign = ((lagnaSign - 1 + cell - 1) % 12) + 1
    cellToSign[cell] = sign
    signToCell[sign] = cell
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
  ]

  for (let cell = 1; cell <= 12; cell++) {
    const poly = NI_POLYS[cell]
    parts.push(`<polygon points="${toPts(poly)}" fill="none" stroke="#94a3b8" stroke-width="1.2"/>`)

    // Always use true centroid for X — bbox midpoint is wrong for asymmetric triangles
    const [cx, cy] = centroid(poly)
    const { minY, maxY } = bbox(poly)
    const cellH = maxY - minY

    // Sign abbr: upper quarter of cell, centered on true centroid X
    const signFontSize = 14
    const signY = minY + cellH * 0.22 + signFontSize
    const sign = cellToSign[cell]
    parts.push(`<text x="${cx.toFixed(1)}" y="${signY.toFixed(1)}" text-anchor="middle" font-size="${signFontSize}" font-weight="600" fill="#64748b" ${FONT}>${signLabels[sign - 1]}</text>`)

    // Planets fill remaining area below sign label
    parts.push(placePlanets(cellPlanets[cell], cx, signY + 4, maxY - 6))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

export function renderSouthIndianSVG(planets, lagna, signLabels) {
  const lagnaSign = lagna.sign
  const cs = S / 4  // 120px per cell

  const signPlanets = {}
  for (let s = 1; s <= 12; s++) signPlanets[s] = []
  signPlanets[lagnaSign].push({ abbr: 'Asc', degree: lagna.degree, retrograde: false, isLagna: true })
  for (const p of planets) signPlanets[p.sign].push(p)

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px">`,
    `<rect width="${S}" height="${S}" fill="#fafafa" stroke="#334155" stroke-width="2" rx="4"/>`,
    `<rect x="${cs}" y="${cs}" width="${cs * 2}" height="${cs * 2}" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1.5"/>`,
    `<text x="${S/2}" y="${S/2 - 10}" text-anchor="middle" font-size="22" font-weight="700" fill="#c2410c" ${FONT}>Rashi</text>`,
    `<text x="${S/2}" y="${S/2 + 18}" text-anchor="middle" font-size="22" font-weight="700" fill="#c2410c" ${FONT}>Chart</text>`,
  ]

  for (const { sign, col, row } of SI_CELLS) {
    const x = col * cs, y = row * cs
    const house = ((sign - lagnaSign + 12) % 12) + 1
    const isLagnaCell = sign === lagnaSign

    parts.push(`<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${isLagnaCell ? '#fff7ed' : '#fafafa'}" stroke="#94a3b8" stroke-width="1.2"/>`)

    // Sign abbr top-left, house number top-right — fixed header row height = 24px
    const headerH = 24
    parts.push(`<text x="${x + 5}" y="${y + headerH - 4}" font-size="14" font-weight="600" fill="#475569" ${FONT}>${signLabels[sign - 1]}</text>`)
    parts.push(`<text x="${x + cs - 5}" y="${y + headerH - 4}" text-anchor="end" font-size="14" font-weight="600" fill="${isLagnaCell ? '#c2410c' : '#94a3b8'}" ${FONT}>${house}</text>`)

    // Separator line below header
    parts.push(`<line x1="${x + 2}" y1="${y + headerH}" x2="${x + cs - 2}" y2="${y + headerH}" stroke="#e2e8f0" stroke-width="0.8"/>`)

    // Planets fill the area below the header
    const cx = x + cs / 2
    parts.push(placePlanets(signPlanets[sign] || [], cx, y + headerH + 2, y + cs - 4))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

export function renderChartSVG(planets, lagna, style = 'north', signLabels = SIGN_ABBR) {
  return style === 'south'
    ? renderSouthIndianSVG(planets, lagna, signLabels)
    : renderNorthIndianSVG(planets, lagna, signLabels)
}
