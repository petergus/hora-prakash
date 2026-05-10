// src/ui/chart-export.js
import { renderChartSVG } from './chart-svg.js'
import { calcDivisional } from '../core/divisional.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

// Layout constants
const EXPORT_W         = 1240  // A4 @ 150dpi (210mm)
const EXPORT_PAD       = 32
const EXPORT_CHART_H   = 480   // max chart size (square)
const EXPORT_CHART_GAP = 24    // gap between charts horizontally and between rows
const EXPORT_LABEL_H   = 30    // height of label above each chart
const EXPORT_ROW_H     = 24
const EXPORT_HEADER_H  = 100
const EXPORT_COLS      = [32, 140, 250, 400, 510, 690, 800]
const EXPORT_HEADERS   = ['Planet', 'Sign', 'Degree', 'House', 'Nakshatra', 'Pada', 'Retro']

// Max 2 charts per row
const CHARTS_PER_ROW  = 2
// Cell width when 2 charts in a row
const EXPORT_CELL_W   = Math.floor((EXPORT_W - EXPORT_PAD * 2 - EXPORT_CHART_GAP) / 2)
// Actual chart render size (square, capped at EXPORT_CHART_H)
const EXPORT_CHART_SIZE = Math.min(EXPORT_CHART_H, EXPORT_CELL_W)

function fmtDeg(dec) {
  if (dec == null) return '—'
  const d = Math.floor(dec)
  const mTotal = (dec - d) * 60
  const m = Math.floor(mTotal)
  const s = Math.round((mTotal - m) * 60)
  return `${d}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"`
}

function svgToImage(svgStr) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    img.onload  = () => resolve({ img, url })
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')) }
    img.src = url
  })
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

function makeFilename(birth, keys, ext) {
  const name = (birth?.name || 'chart').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-')
  const dob  = birth?.dob || ''
  return `hora-prakash_${name}_${dob}_${keys.join('-')}.${ext}`
}

// Compute chart area height for N charts
function chartAreaHeight(n) {
  const rows = Math.ceil(n / CHARTS_PER_ROW)
  return rows * (EXPORT_LABEL_H + EXPORT_CHART_SIZE) + (rows - 1) * EXPORT_CHART_GAP
}

// x,y position of chart i (top-left of label area)
function chartPos(i, n) {
  const row = Math.floor(i / CHARTS_PER_ROW)
  const col = i % CHARTS_PER_ROW
  const chartsInRow = Math.min(CHARTS_PER_ROW, n - row * CHARTS_PER_ROW)
  const rowW = chartsInRow * EXPORT_CHART_SIZE + (chartsInRow - 1) * EXPORT_CHART_GAP
  const rowStartX = EXPORT_PAD + Math.floor((EXPORT_W - EXPORT_PAD * 2 - rowW) / 2)
  const x = rowStartX + col * (EXPORT_CHART_SIZE + EXPORT_CHART_GAP)
  const y = EXPORT_HEADER_H + row * (EXPORT_LABEL_H + EXPORT_CHART_SIZE + EXPORT_CHART_GAP)
  return { x, y }
}

/**
 * opts = {
 *   chartKeys: string[],          // divisional keys to generate; empty for overlay transit
 *   chartLabels?: string[],       // display label per chart slot (chartKeys + extra)
 *   chartStyle: 'north'|'south',
 *   state: { birth, planets, lagna },
 *   transitPlanets?: Planet[],
 *   transitLabel?: string,
 *   extraSvgFn?: () => string,    // extra SVG appended after chartKeys charts
 * }
 */
export async function buildCanvas(opts) {
  const { chartKeys, chartLabels, chartStyle, state, transitPlanets, transitLabel, extraSvgFn } = opts
  const { birth, planets, lagna } = state

  const W        = EXPORT_W
  const PAD      = EXPORT_PAD
  const ROW_H    = EXPORT_ROW_H
  const HEADER_H = EXPORT_HEADER_H

  // Generate SVGs for divisional chart keys
  const chartSvgs = chartKeys.map(key => {
    const { planets: dp, lagna: dl } = calcDivisional(planets, lagna, key)
    return renderChartSVG(dp, dl, chartStyle, undefined, undefined, [], {})
  })

  // Append extra SVG (e.g. transit chart from pane)
  const allSvgs = extraSvgFn ? [...chartSvgs, extraSvgFn()] : chartSvgs

  const loadedImgs = await Promise.all(allSvgs.map(svg => svgToImage(svg)))

  // D1 natal planet table
  const { planets: d1Planets, lagna: d1Lagna } = calcDivisional(planets, lagna, 'D1')
  const tableRows = [
    ...d1Planets,
    { ...d1Lagna, name: 'Lagna', abbr: 'Asc', house: 1, retrograde: false },
  ]

  const transitRows = transitPlanets ?? []

  const natalTableH   = (tableRows.length + 2) * ROW_H + PAD * 2
  const transitTableH = transitRows.length > 0 ? (transitRows.length + 2) * ROW_H + PAD * 2 : 0
  const chartAreaH    = chartAreaHeight(allSvgs.length)

  const totalH = HEADER_H + chartAreaH + natalTableH + transitTableH

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  // ── Background ──
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, totalH)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, HEADER_H)

  // ── Header ──
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 22px Inter, system-ui, sans-serif'
  ctx.fillText(birth?.name ?? '', PAD, 36)

  ctx.font = '14px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#475569'
  const dob = birth?.dob ?? ''
  const tob = birth?.tob ?? ''
  const loc = (birth?.location ?? '').slice(0, 70)
  ctx.fillText(`${dob}  ${tob}  |  ${loc}`, PAD, 62)

  if (birth?.lat != null && birth?.lon != null) {
    const latStr = `${Math.abs(birth.lat).toFixed(4)}°${birth.lat >= 0 ? 'N' : 'S'}`
    const lonStr = `${Math.abs(birth.lon).toFixed(4)}°${birth.lon >= 0 ? 'E' : 'W'}`
    const tz = birth.timezone ?? ''
    ctx.fillText(`${latStr}  ${lonStr}  |  ${tz}`, PAD, 84)
  }

  // Divider under header
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, HEADER_H - 1); ctx.lineTo(W, HEADER_H - 1); ctx.stroke()

  // ── Charts ──
  const n = allSvgs.length
  for (let i = 0; i < loadedImgs.length; i++) {
    const { x, y } = chartPos(i, n)
    const label = chartLabels?.[i] ?? chartKeys[i] ?? `Chart ${i + 1}`

    // Chart background card
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0,0,0,0.08)'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.roundRect(x - 8, y, EXPORT_CHART_SIZE + 16, EXPORT_LABEL_H + EXPORT_CHART_SIZE + 8, 8)
    ctx.fill()
    ctx.shadowBlur = 0

    // Label
    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#6366f1'
    ctx.textAlign = 'center'
    ctx.fillText(label, x + EXPORT_CHART_SIZE / 2, y + EXPORT_LABEL_H - 8)
    ctx.textAlign = 'left'

    // Chart SVG
    ctx.drawImage(loadedImgs[i].img, x, y + EXPORT_LABEL_H, EXPORT_CHART_SIZE, EXPORT_CHART_SIZE)
    URL.revokeObjectURL(loadedImgs[i].url)
  }

  // ── Natal planet table ──
  const COLS    = EXPORT_COLS
  const HEADERS = EXPORT_HEADERS

  let ty = HEADER_H + chartAreaH + PAD

  // Table card background
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(PAD - 8, ty - 8, W - (PAD - 8) * 2, natalTableH, 8)
  ctx.fill()

  ctx.font = 'bold 14px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#1e293b'
  ctx.fillText('Natal Planets (D1)', COLS[0], ty + 6)
  ty += ROW_H + 4

  ctx.font = 'bold 11px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  HEADERS.forEach((h, i) => ctx.fillText(h, COLS[i], ty))
  ty += 4
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, ty); ctx.lineTo(W - PAD, ty); ctx.stroke()
  ty += ROW_H - 4

  for (const p of tableRows) {
    ctx.font = '12px Inter, system-ui, sans-serif'
    ctx.fillStyle = p.name === 'Lagna' ? '#c2410c' : '#1e293b'
    ctx.fillText(p.name ?? '—',                          COLS[0], ty)
    ctx.fillStyle = '#475569'
    ctx.fillText(p.sign ? SIGN_NAMES[p.sign - 1] : '—', COLS[1], ty)
    ctx.fillText(fmtDeg(p.degree),                       COLS[2], ty)
    ctx.fillText(String(p.house ?? '—'),                 COLS[3], ty)
    ctx.fillText(p.nakshatra ?? '—',                     COLS[4], ty)
    ctx.fillText(String(p.pada ?? '—'),                  COLS[5], ty)
    ctx.fillText(p.retrograde ? 'R' : '—',               COLS[6], ty)
    ty += ROW_H
  }

  // ── Transit planet table ──
  if (transitRows.length > 0) {
    ty += PAD

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(PAD - 8, ty - 8, W - (PAD - 8) * 2, transitTableH, 8)
    ctx.fill()

    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#1e293b'
    ctx.fillText(transitLabel ?? 'Transit Planets', COLS[0], ty + 6)
    ty += ROW_H + 4

    ctx.font = 'bold 11px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#94a3b8'
    HEADERS.forEach((h, i) => ctx.fillText(h, COLS[i], ty))
    ty += 4
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD, ty); ctx.lineTo(W - PAD, ty); ctx.stroke()
    ty += ROW_H - 4

    for (const p of transitRows) {
      ctx.font = '12px Inter, system-ui, sans-serif'
      ctx.fillStyle = (p.name === 'Transit Asc') ? '#0369a1' : '#1e293b'
      ctx.fillText(p.name ?? '—',                          COLS[0], ty)
      ctx.fillStyle = '#475569'
      ctx.fillText(p.sign ? SIGN_NAMES[p.sign - 1] : '—', COLS[1], ty)
      ctx.fillText(fmtDeg(p.degree),                       COLS[2], ty)
      ctx.fillText(String(p.house ?? '—'),                 COLS[3], ty)
      ctx.fillText(p.nakshatra ?? '—',                     COLS[4], ty)
      ctx.fillText(String(p.pada ?? '—'),                  COLS[5], ty)
      ctx.fillText(p.retrograde ? 'R' : '—',               COLS[6], ty)
      ty += ROW_H
    }
  }

  return canvas
}

export async function exportChart(format, opts) {
  const { state } = opts
  const keys = opts.chartKeys.length ? opts.chartKeys : ['transit']

  if (format === 'png') {
    const canvas = await buildCanvas(opts)
    await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas toBlob returned null')); return }
        try { downloadBlob(blob, makeFilename(state.birth, keys, 'png')); resolve() }
        catch (e) { reject(e) }
      }, 'image/png')
    })
    return
  }

  if (format === 'svg') {
    await exportSVG(opts)
    return
  }

  if (format === 'pdf') {
    const canvas = await buildCanvas(opts)
    const { jsPDF } = await import('jspdf')
    const A4_W_MM  = 210
    const A4_H_MM  = 297
    const pxPerMm  = canvas.width / A4_W_MM
    const pageH_px = Math.round(A4_H_MM * pxPerMm)
    const totalH   = canvas.height
    const pages    = Math.ceil(totalH / pageH_px)

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage()
      const sliceH = Math.min(pageH_px, totalH - i * pageH_px)
      const slice  = document.createElement('canvas')
      slice.width  = canvas.width
      slice.height = sliceH
      slice.getContext('2d').drawImage(canvas, 0, -i * pageH_px)
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, sliceH / pxPerMm)
    }
    pdf.save(makeFilename(state.birth, keys, 'pdf'))
  }
}

async function exportSVG(opts) {
  const { chartKeys, chartLabels, chartStyle, state, transitPlanets, transitLabel, extraSvgFn } = opts
  const { birth, planets, lagna } = state

  const W        = EXPORT_W
  const PAD      = EXPORT_PAD
  const ROW_H    = EXPORT_ROW_H
  const HEADER_H = EXPORT_HEADER_H

  const chartSvgs = chartKeys.map(key => {
    const { planets: dp, lagna: dl } = calcDivisional(planets, lagna, key)
    return renderChartSVG(dp, dl, chartStyle, undefined, undefined, [], {})
  })
  const allSvgs = extraSvgFn ? [...chartSvgs, extraSvgFn()] : chartSvgs
  const n = allSvgs.length

  const { planets: d1Planets, lagna: d1Lagna } = calcDivisional(planets, lagna, 'D1')
  const tableRows = [
    ...d1Planets,
    { ...d1Lagna, name: 'Lagna', abbr: 'Asc', house: 1, retrograde: false },
  ]
  const transitRows = transitPlanets ?? []

  const natalTableH   = (tableRows.length + 2) * ROW_H + PAD * 2
  const transitTableH = transitRows.length > 0 ? (transitRows.length + 2) * ROW_H + PAD * 2 : 0
  const chartAreaH    = chartAreaHeight(n)
  const totalH        = HEADER_H + chartAreaH + natalTableH + transitTableH

  // Prefix SVG ids to prevent collision when embedding multiple charts
  const embeddedCharts = allSvgs.map((svg, i) => {
    let inner = svg.replace(/<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '')
    inner = inner
      .replace(/\bid="([^"]+)"/g, `id="chart${i}-$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#chart${i}-$1)`)
      .replace(/href="#([^"]+)"/g, `href="#chart${i}-$1"`)
    const { x, y } = chartPos(i, n)
    const scale = EXPORT_CHART_SIZE / 480
    const label = chartLabels?.[i] ?? chartKeys[i] ?? `Chart ${i + 1}`
    return [
      `<rect x="${x - 8}" y="${y}" width="${EXPORT_CHART_SIZE + 16}" height="${EXPORT_LABEL_H + EXPORT_CHART_SIZE + 8}" rx="8" fill="#ffffff" filter="url(#card-shadow)"/>`,
      `<text x="${x + EXPORT_CHART_SIZE / 2}" y="${y + EXPORT_LABEL_H - 8}" font-size="13" font-weight="bold" fill="#6366f1" font-family="Inter,system-ui,sans-serif" text-anchor="middle">${esc(label)}</text>`,
      `<g transform="translate(${x},${y + EXPORT_LABEL_H}) scale(${scale.toFixed(4)})">${inner}</g>`,
    ].join('\n')
  })

  const COLS    = EXPORT_COLS
  const HEADERS = EXPORT_HEADERS

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  function tableRowsSVG(rows, startY, accentColor = '#c2410c') {
    let ty = startY
    const parts = []
    HEADERS.forEach((h, i) => {
      parts.push(`<text x="${COLS[i]}" y="${ty}" font-size="10" fill="#94a3b8" font-weight="600" font-family="Inter,system-ui,sans-serif">${h}</text>`)
    })
    ty += 4
    parts.push(`<line x1="${PAD}" y1="${ty}" x2="${W - PAD}" y2="${ty}" stroke="#e2e8f0" stroke-width="1"/>`)
    ty += ROW_H - 4

    for (const p of rows) {
      const nameColor = (p.name === 'Lagna' || p.name === 'Transit Asc') ? accentColor : '#1e293b'
      parts.push(`<text x="${COLS[0]}" y="${ty}" font-size="11" fill="${nameColor}" font-family="Inter,system-ui,sans-serif">${esc(p.name ?? '—')}</text>`)
      const vals = [
        p.sign ? SIGN_NAMES[p.sign - 1] : '—',
        fmtDeg(p.degree),
        String(p.house ?? '—'),
        p.nakshatra ?? '—',
        String(p.pada ?? '—'),
        p.retrograde ? 'R' : '—',
      ]
      vals.forEach((v, idx) => {
        parts.push(`<text x="${COLS[idx + 1]}" y="${ty}" font-size="11" fill="#475569" font-family="Inter,system-ui,sans-serif">${esc(String(v))}</text>`)
      })
      ty += ROW_H
    }
    return { svg: parts.join('\n'), endY: ty }
  }

  const tableStartY = HEADER_H + chartAreaH + PAD
  const natalStart  = tableStartY + ROW_H + 4

  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" viewBox="0 0 ${W} ${totalH}">`,
    `<defs><filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.08)"/></filter></defs>`,
    `<rect width="${W}" height="${totalH}" fill="#f8fafc"/>`,
    `<rect width="${W}" height="${HEADER_H}" fill="#ffffff"/>`,
    `<line x1="0" y1="${HEADER_H - 1}" x2="${W}" y2="${HEADER_H - 1}" stroke="#e2e8f0" stroke-width="1"/>`,
    `<text x="${PAD}" y="36" font-size="20" font-weight="bold" fill="#1e293b" font-family="Inter,system-ui,sans-serif">${esc(birth?.name ?? '')}</text>`,
    `<text x="${PAD}" y="62" font-size="13" fill="#475569" font-family="Inter,system-ui,sans-serif">${esc(`${birth?.dob ?? ''} ${birth?.tob ?? ''} | ${(birth?.location ?? '').slice(0, 70)}`)}</text>`,
    birth?.lat != null
      ? `<text x="${PAD}" y="84" font-size="13" fill="#475569" font-family="Inter,system-ui,sans-serif">${esc(`${Math.abs(birth.lat).toFixed(4)}°${birth.lat >= 0 ? 'N' : 'S'} ${Math.abs(birth.lon).toFixed(4)}°${birth.lon >= 0 ? 'E' : 'W'} | ${birth.timezone ?? ''}`)}</text>`
      : '',
    ...embeddedCharts,
    // Natal table card
    `<rect x="${PAD - 8}" y="${tableStartY - 8}" width="${W - (PAD - 8) * 2}" height="${natalTableH}" rx="8" fill="#ffffff" filter="url(#card-shadow)"/>`,
    `<text x="${COLS[0]}" y="${tableStartY + 6}" font-size="13" font-weight="bold" fill="#1e293b" font-family="Inter,system-ui,sans-serif">Natal Planets (D1)</text>`,
  ]

  const { svg: natalSVG, endY: natalEnd } = tableRowsSVG(tableRows, natalStart)
  svgParts.push(natalSVG)

  if (transitRows.length > 0) {
    const tTableStartY = natalEnd + PAD
    const tTableStart  = tTableStartY + ROW_H + 4
    svgParts.push(`<rect x="${PAD - 8}" y="${tTableStartY - 8}" width="${W - (PAD - 8) * 2}" height="${transitTableH}" rx="8" fill="#ffffff" filter="url(#card-shadow)"/>`)
    svgParts.push(`<text x="${COLS[0]}" y="${tTableStartY + 6}" font-size="13" font-weight="bold" fill="#1e293b" font-family="Inter,system-ui,sans-serif">${esc(transitLabel ?? 'Transit Planets')}</text>`)
    const { svg: transitSVG } = tableRowsSVG(transitRows, tTableStart, '#0369a1')
    svgParts.push(transitSVG)
  }

  svgParts.push('</svg>')

  const svgStr = svgParts.join('\n')
  const blob   = new Blob([svgStr], { type: 'image/svg+xml' })
  downloadBlob(blob, makeFilename(birth, chartKeys.length ? chartKeys : ['transit'], 'svg'))
}

const DIVISIONAL_OPTIONS = [
  'D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12',
  'D16','D20','D24','D27','D30','D40','D45','D60','Chalit',
]

/**
 * modalOpts = {
 *   context: 'chart' | 'transit',
 *   activeKeys?: string[],         // pre-ticked chart keys (chart tab)
 *   chartKeys?: string[],          // override chart keys (transit tab)
 *   chartLabels?: string[],        // per-chart display labels
 *   chartStyle: string,
 *   state: object,
 *   transitView?: 'dual'|'overlay',
 *   transitPlanets?: Planet[],
 *   transitLabel?: string,
 *   extraSvgFn?: () => string,
 * }
 */
export function showExportModal(modalOpts) {
  const { context, activeKeys = ['D1'], chartStyle, state } = modalOpts

  document.getElementById('export-modal-overlay')?.remove()

  const isTransit = context === 'transit'

  const chartSelectHtml = isTransit ? '' : `
    <div style="margin-bottom:1rem">
      <div style="font-size:0.82rem;font-weight:600;color:#1e293b;margin-bottom:0.5rem">
        Select charts <span style="color:#94a3b8;font-weight:400">(max 6)</span>
      </div>
      <div id="export-chart-checks" style="display:flex;flex-wrap:wrap;gap:0.4rem">
        ${DIVISIONAL_OPTIONS.map(key => `
          <label style="display:flex;align-items:center;gap:0.25rem;font-size:0.8rem;cursor:pointer;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0.25rem 0.5rem">
            <input type="checkbox" value="${key}" ${activeKeys.includes(key) ? 'checked' : ''}
              style="accent-color:#6366f1"> ${key}
          </label>`).join('')}
      </div>
    </div>`

  const overlay = document.createElement('div')
  overlay.id = 'export-modal-overlay'
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.45);
    display:flex;align-items:center;justify-content:center`

  overlay.innerHTML = `
    <div id="export-modal" style="
      background:#fff;border-radius:12px;padding:1.5rem;min-width:360px;max-width:520px;
      box-shadow:0 8px 32px rgba(0,0,0,0.18);font-family:Inter,system-ui,sans-serif">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;color:#1e293b">
        ${isTransit ? 'Download Transit Chart' : 'Download Chart'}
      </h3>
      ${chartSelectHtml}
      <div style="margin-bottom:1.25rem">
        <div style="font-size:0.82rem;font-weight:600;color:#1e293b;margin-bottom:0.5rem">Format</div>
        <div style="display:flex;gap:0.75rem">
          ${['PNG','SVG','PDF'].map(f => `
            <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;cursor:pointer">
              <input type="radio" name="export-fmt" value="${f.toLowerCase()}" ${f === 'PNG' ? 'checked' : ''}
                style="accent-color:#6366f1"> ${f}
            </label>`).join('')}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:0.75rem">
        <button id="export-cancel-btn" style="
          padding:0.45rem 1rem;border:1px solid #e2e8f0;border-radius:8px;
          background:#fff;color:#475569;font-size:0.85rem;cursor:pointer">Cancel</button>
        <button id="export-download-btn" style="
          padding:0.45rem 1.1rem;border:none;border-radius:8px;
          background:#6366f1;color:#fff;font-size:0.85rem;cursor:pointer;font-weight:600">
          Download
        </button>
      </div>
    </div>`

  document.body.appendChild(overlay)

  if (!isTransit) {
    overlay.querySelectorAll('#export-chart-checks input').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = overlay.querySelectorAll('#export-chart-checks input:checked')
        if (checked.length > 6) cb.checked = false
      })
    })
  }

  overlay.querySelector('#export-cancel-btn').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

  overlay.querySelector('#export-download-btn').addEventListener('click', async () => {
    const format = overlay.querySelector('input[name="export-fmt"]:checked').value

    let chartKeys
    if (isTransit) {
      // For transit, use override keys from caller (empty for overlay, ['D1'] for dual)
      chartKeys = modalOpts.chartKeys ?? ['D1']
    } else {
      chartKeys = [...overlay.querySelectorAll('#export-chart-checks input:checked')].map(c => c.value)
      if (chartKeys.length === 0) { alert('Select at least one chart.'); return }
    }

    const btn = overlay.querySelector('#export-download-btn')
    btn.textContent = 'Exporting…'
    btn.disabled = true

    try {
      const exportOpts = isTransit
        ? {
            chartKeys,
            chartLabels:  modalOpts.chartLabels,
            chartStyle:   modalOpts.chartStyle ?? 'north',
            state,
            transitPlanets: modalOpts.transitPlanets ?? [],
            transitLabel:   modalOpts.transitLabel,
            extraSvgFn:     modalOpts.extraSvgFn,
          }
        : {
            chartKeys,
            chartLabels: chartKeys,  // use key names as labels for chart tab
            chartStyle,
            state,
          }

      await exportChart(format, exportOpts)
      overlay.remove()
    } catch (err) {
      btn.textContent = 'Download'
      btn.disabled = false
      console.error('Export failed', err)
      alert('Export failed: ' + err.message)
    }
  })
}
