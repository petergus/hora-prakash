// src/ui/chart-export.js
import { renderChartSVG } from './chart-svg.js'
import { calcDivisional } from '../core/divisional.js'

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

// Shared layout constants for both buildCanvas and exportSVG
const EXPORT_W        = 1200
const EXPORT_PAD      = 28
const EXPORT_CHART_H  = 480
const EXPORT_ROW_H    = 24
const EXPORT_HEADER_H = 96
const EXPORT_COLS     = [28, 130, 230, 380, 490, 660, 760]
const EXPORT_HEADERS  = ['Planet', 'Sign', 'Degree', 'House', 'Nakshatra', 'Pada', 'Retro']

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
    img.onload = () => resolve({ img, url })
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

/**
 * opts = {
 *   chartKeys: string[],          // e.g. ['D1','D9'] max 6
 *   chartStyle: 'north'|'south',
 *   state: { birth, planets, lagna },
 *   transitPlanets?: Planet[],    // set for transit export
 *   transitLabel?: string,        // e.g. 'Transit 2026-05-07'
 *   extraSvgFn?: () => string,    // function returning extra SVG string (e.g. transit dual chart)
 * }
 */
export async function buildCanvas(opts) {
  const { chartKeys, chartStyle, state, transitPlanets, transitLabel, extraSvgFn } = opts
  const { birth, planets, lagna } = state

  const W        = EXPORT_W
  const PAD      = EXPORT_PAD
  const CHART_H  = EXPORT_CHART_H
  const ROW_H    = EXPORT_ROW_H
  const HEADER_H = EXPORT_HEADER_H

  // Generate chart SVG strings
  const chartSvgs = chartKeys.map(key => {
    const { planets: dp, lagna: dl } = calcDivisional(planets, lagna, key)
    const label = key === 'D1' ? 'Rashi\nChart' : key
    return renderChartSVG(dp, dl, chartStyle, undefined, label, [], {})
  })

  // If extra SVG provided (transit dual chart), append it
  const allSvgs = extraSvgFn ? [...chartSvgs, extraSvgFn()] : chartSvgs

  const loadedImgs = await Promise.all(allSvgs.map(svg => svgToImage(svg)))

  // D1 planets for table
  const { planets: d1Planets, lagna: d1Lagna } = calcDivisional(planets, lagna, 'D1')
  const tableRows = [
    ...d1Planets,
    { ...d1Lagna, name: 'Lagna', abbr: 'Asc', house: 1, retrograde: false },
  ]

  // Transit rows (if any)
  const transitRows = transitPlanets ?? []

  const natalTableH   = (tableRows.length + 2) * ROW_H + PAD * 2
  const transitTableH = transitRows.length > 0 ? (transitRows.length + 2) * ROW_H + PAD * 2 : 0

  const totalH = HEADER_H + CHART_H + natalTableH + transitTableH

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  // ── Background ──
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, totalH)

  // ── Header ──
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 20px Inter, system-ui, sans-serif'
  ctx.fillText(birth?.name ?? '', PAD, 32)
  ctx.font = '14px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#475569'
  const dob = birth?.dob ?? ''
  const tob = birth?.tob ?? ''
  const loc = (birth?.location ?? '').slice(0, 60)
  ctx.fillText(`${dob}  ${tob}  |  ${loc}`, PAD, 56)
  if (birth?.lat != null && birth?.lon != null) {
    const latStr = `${Math.abs(birth.lat).toFixed(2)}°${birth.lat >= 0 ? 'N' : 'S'}`
    const lonStr = `${Math.abs(birth.lon).toFixed(2)}°${birth.lon >= 0 ? 'E' : 'W'}`
    const tz = birth.timezone ?? ''
    ctx.fillText(`${latStr}  ${lonStr}  |  TZ: ${tz}`, PAD, 76)
  }

  // ── Charts row ──
  const chartCount = allSvgs.length
  const chartW    = Math.floor((W - PAD * 2) / chartCount)
  const chartSize = Math.min(CHART_H, chartW)
  for (let i = 0; i < loadedImgs.length; i++) {
    ctx.drawImage(loadedImgs[i].img, PAD + i * chartW, HEADER_H, chartSize, chartSize)
    URL.revokeObjectURL(loadedImgs[i].url)
  }

  // ── Natal planet table ──
  const COLS    = EXPORT_COLS
  const HEADERS = EXPORT_HEADERS

  let ty = HEADER_H + CHART_H + PAD

  ctx.font = 'bold 14px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#1e293b'
  ctx.fillText('Natal Planets (D1)', PAD, ty)
  ty += ROW_H

  ctx.font = 'bold 12px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#64748b'
  HEADERS.forEach((h, i) => ctx.fillText(h, COLS[i], ty))
  ty += 4
  ctx.strokeStyle = '#cbd5e1'
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

  // ── Transit planet table (if provided) ──
  if (transitRows.length > 0) {
    ty += PAD
    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#1e293b'
    ctx.fillText(transitLabel ?? 'Transit Planets', PAD, ty)
    ty += ROW_H

    ctx.font = 'bold 12px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#64748b'
    HEADERS.forEach((h, i) => ctx.fillText(h, COLS[i], ty))
    ty += 4
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
  const keys = opts.chartKeys

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
    const W = canvas.width, H = canvas.height
    // Scale to A4 width (210mm), preserving aspect ratio
    const A4_W_MM = 210
    const A4_H_MM = Math.round((H / W) * A4_W_MM)
    const pdf = new jsPDF({ orientation: A4_H_MM > A4_W_MM ? 'portrait' : 'landscape', unit: 'mm', format: [A4_W_MM, A4_H_MM] })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, A4_H_MM)
    pdf.save(makeFilename(state.birth, keys, 'pdf'))
  }
}

async function exportSVG(opts) {
  const { chartKeys, chartStyle, state, transitPlanets, transitLabel, extraSvgFn } = opts
  const { birth, planets, lagna } = state

  const W        = EXPORT_W
  const PAD      = EXPORT_PAD
  const CHART_H  = EXPORT_CHART_H
  const ROW_H    = EXPORT_ROW_H
  const HEADER_H = EXPORT_HEADER_H

  const chartSvgs = chartKeys.map(key => {
    const { planets: dp, lagna: dl } = calcDivisional(planets, lagna, key)
    const label = key === 'D1' ? 'Rashi\nChart' : key
    return renderChartSVG(dp, dl, chartStyle, undefined, label, [], {})
  })
  const allSvgs = extraSvgFn ? [...chartSvgs, extraSvgFn()] : chartSvgs

  const chartCount = allSvgs.length
  const chartW    = Math.floor((W - PAD * 2) / chartCount)
  const chartSize = Math.min(CHART_H, chartW)

  const { planets: d1Planets, lagna: d1Lagna } = calcDivisional(planets, lagna, 'D1')
  const tableRows = [
    ...d1Planets,
    { ...d1Lagna, name: 'Lagna', abbr: 'Asc', house: 1, retrograde: false },
  ]
  const transitRows = transitPlanets ?? []

  const natalTableH   = (tableRows.length + 2) * ROW_H + PAD * 2
  const transitTableH = transitRows.length > 0 ? (transitRows.length + 2) * ROW_H + PAD * 2 : 0
  const totalH = HEADER_H + CHART_H + natalTableH + transitTableH

  // Embed each chart SVG as a <g> with transform (strip outer <svg> tag)
  // Prefix all id attributes and references to avoid collisions across multiple embedded charts
  const embeddedCharts = allSvgs.map((svg, i) => {
    let inner = svg.replace(/<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '')
    inner = inner
      .replace(/\bid="([^"]+)"/g, `id="chart${i}-$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#chart${i}-$1)`)
      .replace(/href="#([^"]+)"/g, `href="#chart${i}-$1"`)
    const x     = PAD + i * chartW
    const scale = chartSize / 480
    return `<g transform="translate(${x},${HEADER_H}) scale(${scale.toFixed(4)})">${inner}</g>`
  })

  const COLS    = EXPORT_COLS
  const HEADERS = EXPORT_HEADERS

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  function tableRowsSVG(rows, startY, accentColor = '#c2410c') {
    let ty = startY
    const parts = []
    HEADERS.forEach((h, i) => {
      parts.push(`<text x="${COLS[i]}" y="${ty}" font-size="11" fill="#64748b" font-weight="600" font-family="Inter,system-ui,sans-serif">${h}</text>`)
    })
    ty += 4
    parts.push(`<line x1="${PAD}" y1="${ty}" x2="${W - PAD}" y2="${ty}" stroke="#cbd5e1" stroke-width="1"/>`)
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

  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">`,
    `<rect width="${W}" height="${totalH}" fill="#ffffff"/>`,
    `<text x="${PAD}" y="30" font-size="18" font-weight="bold" fill="#1e293b" font-family="Inter,system-ui,sans-serif">${esc(birth?.name ?? '')}</text>`,
    `<text x="${PAD}" y="54" font-size="13" fill="#475569" font-family="Inter,system-ui,sans-serif">${esc(`${birth?.dob ?? ''} ${birth?.tob ?? ''} | ${(birth?.location ?? '').slice(0, 60)}`)}</text>`,
    birth?.lat != null
      ? `<text x="${PAD}" y="74" font-size="13" fill="#475569" font-family="Inter,system-ui,sans-serif">${esc(`${Math.abs(birth.lat).toFixed(2)}°${birth.lat >= 0 ? 'N' : 'S'} ${Math.abs(birth.lon).toFixed(2)}°${birth.lon >= 0 ? 'E' : 'W'} | TZ: ${birth.timezone ?? ''}`)}</text>`
      : '',
    ...embeddedCharts,
    `<text x="${PAD}" y="${HEADER_H + CHART_H + PAD + 14}" font-size="13" font-weight="bold" fill="#1e293b" font-family="Inter,system-ui,sans-serif">Natal Planets (D1)</text>`,
  ]

  const natalStart = HEADER_H + CHART_H + PAD + ROW_H + 4
  const { svg: natalSVG, endY: natalEnd } = tableRowsSVG(tableRows, natalStart)
  svgParts.push(natalSVG)

  if (transitRows.length > 0) {
    svgParts.push(`<text x="${PAD}" y="${natalEnd + PAD + 14}" font-size="13" font-weight="bold" fill="#1e293b" font-family="Inter,system-ui,sans-serif">${esc(transitLabel ?? 'Transit Planets')}</text>`)
    const { svg: transitSVG } = tableRowsSVG(transitRows, natalEnd + PAD + ROW_H + 4, '#0369a1')
    svgParts.push(transitSVG)
  }

  svgParts.push('</svg>')

  const svgStr = svgParts.join('\n')
  const blob   = new Blob([svgStr], { type: 'image/svg+xml' })
  downloadBlob(blob, makeFilename(birth, chartKeys, 'svg'))
}

const DIVISIONAL_OPTIONS = [
  'D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','Chalit',
]

/**
 * modalOpts = {
 *   context: 'chart' | 'transit',
 *   activeKeys: string[],
 *   chartStyle: string,
 *   state: object,
 *   transitView?: 'dual'|'overlay',
 *   transitPlanets?: Planet[],
 *   transitLabel?: string,
 *   transitChartStyle?: string,
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
      chartKeys = ['D1']
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
            chartStyle: modalOpts.transitChartStyle ?? 'north',
            state,
            transitPlanets: modalOpts.transitPlanets ?? [],
            transitLabel:   modalOpts.transitLabel,
            extraSvgFn:     modalOpts.extraSvgFn,
          }
        : { chartKeys, chartStyle, state }

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
