// src/ui/timeline-svg.js
// Pure SVG renderers for the Life Timeline. No DOM, no ephemeris — given lane
// data and a visible time window, produce an SVG string. The tab owns zoom/pan
// (it changes the window and re-renders) and attaches click handlers via the
// `data-*` attributes emitted here. Kept Node-safe so the layout is testable.

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

const DAY = 86400000
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Nice year-tick step for a span, so the axis stays readable at any zoom. */
export function tickStep(years) {
  if (years <= 2)   return 0.25   // quarters
  if (years <= 6)   return 1
  if (years <= 15)  return 2
  if (years <= 40)  return 5
  if (years <= 100) return 10
  return 20
}

/**
 * Render the lane timeline.
 *
 * @param {object} opts
 *   lanes: [{ id, label, kind:'band'|'marker', items }]
 *     band item:   { start:Date, end:Date, label, color, sub? }
 *     marker item: { date:Date, label, color, kind }
 *   from, to: Date — the visible window
 *   now: Date — the "you are here" line
 *   width, laneHeight, markerHeight
 * @returns {string} SVG markup (viewBox-sized; caller sizes via CSS/height attr)
 */
export function renderTimelineSVG({ lanes = [], from, to, now = new Date(),
                                    width = 900, laneHeight = 34, markerHeight = 46,
                                    padL = 8, padR = 8, padT = 26, padB = 4 } = {}) {
  if (!(from instanceof Date) || !(to instanceof Date) || !(to > from))
    throw new Error('renderTimelineSVG: from/to must be Dates with to > from')

  const t0 = from.getTime(), t1 = to.getTime()
  const plotW = width - padL - padR
  const x = t => padL + ((t - t0) / (t1 - t0)) * plotW

  // Lane vertical layout.
  let y = padT
  const rows = lanes.map(lane => {
    const h = lane.kind === 'marker' ? markerHeight : laneHeight
    const row = { lane, y, h }
    y += h + 6
    return row
  })
  const height = y + padB

  // ── Year axis ──
  const years = (t1 - t0) / (365.25 * DAY)
  const step = tickStep(years)
  const startYear = new Date(t0).getUTCFullYear()
  const ticks = []
  for (let yr = Math.ceil(startYear / step) * step; ; yr += step) {
    const tickMs = Date.UTC(Math.floor(yr), Math.round((yr % 1) * 12), 1)
    if (tickMs > t1) break
    if (tickMs < t0) continue
    const label = step < 1 ? new Date(tickMs).toISOString().slice(0, 7) : String(Math.floor(yr))
    ticks.push({ x: x(tickMs), label })
  }
  const axis = ticks.map(t =>
    `<line x1="${t.x.toFixed(1)}" y1="${padT - 4}" x2="${t.x.toFixed(1)}" y2="${height - padB}" class="tl-grid"/>` +
    `<text x="${t.x.toFixed(1)}" y="14" class="tl-axis-label" text-anchor="middle">${esc(t.label)}</text>`
  ).join('')

  // ── Lanes ──
  const laneSvg = rows.map(({ lane, y, h }) => {
    const laneLabel = `<text x="${padL}" y="${y - 3}" class="tl-lane-label">${esc(lane.label)}</text>`
    if (lane.kind === 'marker') {
      const markers = (lane.items ?? []).map(m => {
        const mx = x(m.date.getTime())
        if (mx < padL - 1 || mx > width - padR + 1) return ''
        const tip = esc(`${m.label} — ${m.date.toISOString().slice(0, 10)}`)
        return `<g class="tl-marker" data-date="${m.date.toISOString()}" data-label="${esc(m.label)}"><title>${tip}</title>` +
          `<line x1="${mx.toFixed(1)}" y1="${y}" x2="${mx.toFixed(1)}" y2="${y + h}" stroke="${esc(m.color)}" stroke-width="1.5"/>` +
          `<circle cx="${mx.toFixed(1)}" cy="${y + 5}" r="3.5" fill="${esc(m.color)}"/></g>`
      }).join('')
      return laneLabel + markers
    }
    // Band lane: label + clipped rects.
    const rects = (lane.items ?? []).map(b => {
      const bs = clamp(b.start.getTime(), t0, t1)
      const be = clamp(b.end.getTime(), t0, t1)
      if (be <= bs) return ''
      const bx = x(bs), bw = Math.max(1.5, x(be) - bx)
      const showLabel = bw > 26
      const cy = y + h / 2
      return `<g class="tl-band" data-start="${b.start.toISOString()}" data-end="${b.end.toISOString()}" data-label="${esc(b.label)}">` +
        `<title>${esc(`${b.label}${b.sub ? ' · ' + b.sub : ''} · ${b.start.toISOString().slice(0,10)}→${b.end.toISOString().slice(0,10)}`)}</title>` +
        `<rect x="${bx.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${h}" rx="3" fill="${esc(b.color)}" fill-opacity="0.85"/>` +
        (showLabel ? `<text x="${(bx + 4).toFixed(1)}" y="${(cy + 4).toFixed(1)}" class="tl-band-label">${esc(b.label)}</text>` : '') +
        `</g>`
    }).join('')
    return laneLabel + rects
  }).join('')

  // ── Now line ──
  const nowMs = now.getTime()
  const nowLine = (nowMs >= t0 && nowMs <= t1)
    ? `<line x1="${x(nowMs).toFixed(1)}" y1="${padT - 6}" x2="${x(nowMs).toFixed(1)}" y2="${height - padB}" class="tl-now"/>` +
      `<text x="${x(nowMs).toFixed(1)}" y="${height - padB - 2}" class="tl-now-label" text-anchor="middle">now</text>`
    : ''

  return `<svg class="tl-svg" viewBox="0 0 ${width} ${height.toFixed(0)}" width="100%" preserveAspectRatio="xMinYMin meet" role="img">` +
    axis + laneSvg + nowLine + `</svg>`
}

// ── Spiral / ring view (E3) ──────────────────────────────────────────────────

const TWO_PI = Math.PI * 2
const polar = (cx, cy, r, ang) => [cx + r * Math.cos(ang - Math.PI / 2), cy + r * Math.sin(ang - Math.PI / 2)]

/** SVG arc path between two angles at a given radius band. */
function arcPath(cx, cy, rIn, rOut, a0, a1) {
  const large = (a1 - a0) % TWO_PI > Math.PI ? 1 : 0
  const [x0o, y0o] = polar(cx, cy, rOut, a0)
  const [x1o, y1o] = polar(cx, cy, rOut, a1)
  const [x1i, y1i] = polar(cx, cy, rIn, a1)
  const [x0i, y0i] = polar(cx, cy, rIn, a0)
  return `M ${x0o.toFixed(2)} ${y0o.toFixed(2)} A ${rOut} ${rOut} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)} ` +
         `L ${x1i.toFixed(2)} ${y1i.toFixed(2)} A ${rIn} ${rIn} 0 ${large} 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)} Z`
}

/**
 * The whole life as a ring: an outer ring of Mahadasha arcs (sized by their
 * years), an inner ring of the current MD's Antardashas, and a "you are here"
 * radial marker. Pure — takes the dasha tree + colour fn.
 *
 * @param {object[]} dasha
 * @param {object} opts { size, now, colorOf }
 * @returns {string} SVG
 */
export function renderDashaSpiral(dasha, { size = 420, now = new Date(), colorOf } = {}) {
  if (!Array.isArray(dasha) || !dasha.length) return `<svg viewBox="0 0 ${size} ${size}" width="100%"></svg>`
  const cx = size / 2, cy = size / 2
  const rOut = size * 0.46, rMid = size * 0.30, rInner = size * 0.18
  const color = colorOf ?? (() => '#94a3b8')

  const t0 = dasha[0].start.getTime()
  const t1 = dasha[dasha.length - 1].end.getTime()
  const span = t1 - t0
  const ang = t => ((t - t0) / span) * TWO_PI
  const nowMs = clamp(now.getTime(), t0, t1)

  // Outer MD ring.
  const mdArcs = dasha.map(m => {
    const a0 = ang(m.start.getTime()), a1 = ang(m.end.getTime())
    const mid = (a0 + a1) / 2
    const [lx, ly] = polar(cx, cy, (rMid + rOut) / 2, mid)
    const big = (a1 - a0) > 0.28
    return `<path d="${arcPath(cx, cy, rMid, rOut, a0, a1)}" fill="${color(m.planet)}" fill-opacity="0.85" class="tl-spiral-arc" data-planet="${esc(m.planet)}"><title>${esc(m.planet)} Mahadasha · ${m.start.toISOString().slice(0,10)}→${m.end.toISOString().slice(0,10)}</title></path>` +
      (big ? `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="tl-spiral-label" text-anchor="middle" dominant-baseline="middle">${esc(m.planet)}</text>` : '')
  }).join('')

  // Inner ring: the current MD's ADs (if computed).
  const curMd = dasha.find(m => m.start.getTime() <= nowMs && m.end.getTime() > nowMs)
  let adArcs = ''
  if (curMd?.children?.length) {
    const ca0 = curMd.start.getTime(), ca1 = curMd.end.getTime(), cspan = ca1 - ca0
    const cang = t => ang(ca0) + ((t - ca0) / cspan) * (ang(ca1) - ang(ca0))
    adArcs = curMd.children.map(a =>
      `<path d="${arcPath(cx, cy, rInner, rMid - 3, cang(a.start.getTime()), cang(a.end.getTime()))}" fill="${color(a.planet)}" fill-opacity="0.7"><title>${esc(a.planet)} Antardasha</title></path>`
    ).join('')
  }

  // "You are here" radial + hub label.
  const [nx, ny] = polar(cx, cy, rOut + 6, ang(nowMs))
  const [n0x, n0y] = polar(cx, cy, rInner - 4, ang(nowMs))
  const nowRadial = `<line x1="${n0x.toFixed(1)}" y1="${n0y.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="tl-spiral-now"/>` +
    `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="4" class="tl-spiral-now-dot"/>`
  const hub = curMd
    ? `<text x="${cx}" y="${cy - 6}" text-anchor="middle" class="tl-spiral-hub">${esc(curMd.planet)}</text>` +
      `<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="tl-spiral-hub-sub">now</text>`
    : ''

  return `<svg class="tl-spiral" viewBox="0 0 ${size} ${size}" width="100%" role="img">${mdArcs}${adArcs}${nowRadial}${hub}</svg>`
}
