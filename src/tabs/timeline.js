// src/tabs/timeline.js
// The Life Timeline (B1) + the dasha spiral (E3). A zoomable map of the whole
// life on one axis: Vimshottari MD/AD bands, Sade Sati windows, and slow-planet
// ingresses/returns. Click a point to see the dasha stack at that moment and
// jump to that date in the Transit tab.

import { state } from '../state.js'
import { getActiveSession, defaultTimelineUI } from '../sessions.js'
import { getSwe } from '../core/swisseph.js'
import { getSettings } from '../core/settings.js'
import { calcSadeSati } from '../core/sadesati.js'
import { toJulianDay } from '../utils/time.js'
import {
  buildDashaLanes, buildSadeSatiLane, buildTransitMarkers, dashaStackAt, planetColor, dateToJd,
} from '../core/timeline.js'
import { renderTimelineSVG, renderDashaSpiral } from '../ui/timeline-svg.js'
import { navigate, routeFor } from '../ui/router.js'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const YEAR = 365.25 * 86400000

function ui() {
  const s = getActiveSession()
  if (!s) return defaultTimelineUI()
  s.uiState ??= {}
  s.uiState.timeline ??= defaultTimelineUI()
  return s.uiState.timeline
}

// ── Lifetime lane data, cached per chart+ayanamsa ────────────────────────────
// The transit scan and Sade Sati are lifetime-scale (~150–300 ms), so cache the
// assembled lanes; the window just controls what's drawn.
let _laneCache = null, _laneKey = null

function lifetime() {
  const b = state.birth
  const moon = state.planets?.find(p => p.name === 'Moon')
  if (!b || !state.dasha) return null
  const { ayanamsa } = getSettings()
  const key = `${b.dob}|${b.tob}|${b.timezone}|${moon?.sign}|${ayanamsa}`
  if (_laneKey === key && _laneCache) return _laneCache

  const birthJd = toJulianDay(b.dob, b.tob, b.timezone ?? '+00:00')
  const { md, ad } = buildDashaLanes(state.dasha)
  const lastEnd = state.dasha[state.dasha.length - 1].end
  const toJd = dateToJd(lastEnd)

  let sadeSati = []
  try {
    if (moon) sadeSati = buildSadeSatiLane(calcSadeSati(moon.sign, { fromJd: birthJd, toJd }))
  } catch (e) { console.error('timeline: sadesati', e) }

  let transits = []
  try {
    transits = buildTransitMarkers(state.planets, birthJd, toJd, getSwe())
  } catch (e) { console.error('timeline: transits', e) }

  const lanes = [
    { id: 'md', label: 'Mahadasha', kind: 'band', items: md },
    { id: 'ad', label: 'Antardasha', kind: 'band', items: ad },
    ...(sadeSati.length ? [{ id: 'ss', label: 'Sade Sati / Shani', kind: 'band', items: sadeSati }] : []),
    { id: 'tr', label: 'Slow transits', kind: 'marker', items: transits },
  ]
  _laneCache = { lanes, from: state.dasha[0].start, to: lastEnd }
  _laneKey = key
  return _laneCache
}

/** Invalidate the lane cache — call when the chart is recalculated. */
export function resetTimelineCache() { _laneCache = null; _laneKey = null }

// ── Window helpers ───────────────────────────────────────────────────────────

function windowFor(u, life) {
  const lifeFrom = life.from.getTime(), lifeTo = life.to.getTime()
  let from = u.fromMs ?? lifeFrom
  let to   = u.toMs ?? lifeTo
  // Keep the window inside the life span and at least ~1y wide.
  if (to - from < YEAR) to = from + YEAR
  from = Math.max(lifeFrom, from)
  to   = Math.min(lifeTo, to)
  if (to - from < YEAR) from = Math.max(lifeFrom, to - YEAR)
  return { from, to }
}

function zoom(u, life, factor, centerMs) {
  const { from, to } = windowFor(u, life)
  const c = centerMs ?? (from + to) / 2
  const span = (to - from) * factor
  u.fromMs = c - span / 2
  u.toMs   = c + span / 2
  render()
}
function pan(u, life, deltaMs) {
  const { from, to } = windowFor(u, life)
  u.fromMs = from + deltaMs
  u.toMs   = to + deltaMs
  render()
}

// ── Rendering ────────────────────────────────────────────────────────────────

let _el = null

function detailPopoverHtml(dateIso) {
  const date = new Date(dateIso)
  const s = dashaStackAt(state.dasha, date)
  const stack = [s.md && `MD ${s.md}`, s.ad && `AD ${s.ad}`, s.pd && `PD ${s.pd}`].filter(Boolean).join(' › ')
  return `
    <div class="tl-pop-inner">
      <div class="tl-pop-date">${esc(date.toISOString().slice(0, 10))}</div>
      <div class="tl-pop-stack">${esc(stack || 'no running period')}</div>
      <button class="btn-secondary tl-pop-transit" data-date="${esc(date.toISOString().slice(0, 10))}">Open in Transit →</button>
    </div>`
}

function render() {
  const el = _el || document.getElementById('tab-timeline')
  if (!el || !state.planets || !state.birth) return
  _el = el
  const u = ui()
  const life = lifetime()
  if (!life) { el.innerHTML = '<p class="panchang-empty">Calculate a birth chart first.</p>'; return }

  const view = u.view === 'spiral' ? 'spiral' : 'lanes'
  u.view = view

  const controls = `
    <div class="tl-controls">
      <div class="chart-style-group" role="group" aria-label="Timeline view">
        <button class="chart-style-btn${view === 'lanes' ? ' active' : ''}" data-view="lanes">Lanes</button>
        <button class="chart-style-btn${view === 'spiral' ? ' active' : ''}" data-view="spiral">Spiral</button>
      </div>
      ${view === 'lanes' ? `
        <div class="chart-style-group">
          <button class="chart-style-btn" data-zoom="out" title="Zoom out">−</button>
          <button class="chart-style-btn" data-zoom="in" title="Zoom in">+</button>
          <button class="chart-style-btn" data-fit="1" title="Show the whole life">Fit</button>
        </div>` : `
        <button class="btn-secondary" data-png="1">Download PNG</button>`}
    </div>`

  let body
  if (view === 'lanes') {
    const { from, to } = windowFor(u, life)
    const svg = renderTimelineSVG({
      lanes: life.lanes, from: new Date(from), to: new Date(to), now: new Date(), width: 960,
    })
    body = `<div class="tl-scroll" id="tl-scroll">${svg}</div>
      <p class="cal-hint tl-legend">Drag to pan · scroll to zoom · click a band or marker for the dasha stack.
        Mahadasha &amp; Antardasha bands, Sade Sati/Kantaka/Ashtama windows, and Saturn/Rahu ingresses + Jupiter/Saturn returns.</p>`
  } else {
    const svg = renderDashaSpiral(state.dasha, { size: 460, now: new Date(), colorOf: planetColor })
    body = `<div class="tl-spiral-wrap" id="tl-spiral-wrap">${svg}</div>
      <p class="cal-hint tl-legend">The whole 120-year Vimshottari cycle as a ring — outer arcs are Mahadashas, the inner ring is the current Mahadasha's Antardashas, and the radial line marks now.</p>`
  }

  el.innerHTML = `<div class="card tl-card">
    <div class="reading-header-row">
      <div><h2 class="reading-title">Life Timeline</h2>
        <p class="reading-subtitle">The whole life on one axis — periods, phases, and the slow turns of the sky.</p></div>
      ${controls}
    </div>
    ${body}
    <div id="tl-popover" class="tl-popover" style="display:none"></div>
  </div>`

  wire(el, u, life, view)
}

function wire(el, u, life, view) {
  el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { u.view = b.dataset.view; render() }))
  if (view === 'lanes') {
    el.querySelector('[data-zoom="in"]')?.addEventListener('click', () => zoom(u, life, 0.6))
    el.querySelector('[data-zoom="out"]')?.addEventListener('click', () => zoom(u, life, 1.7))
    el.querySelector('[data-fit="1"]')?.addEventListener('click', () => { u.fromMs = null; u.toMs = null; render() })
    wireLaneInteractions(el, u, life)
  } else {
    el.querySelector('[data-png="1"]')?.addEventListener('click', () => downloadPng(el))
  }
}

function wireLaneInteractions(el, u, life) {
  const scroll = el.querySelector('#tl-scroll')
  const svg = scroll?.querySelector('svg')
  if (!svg) return
  const { from, to } = windowFor(u, life)
  const span = to - from
  const msPerPx = span / svg.clientWidth

  // Wheel to zoom (centred on the cursor).
  scroll.addEventListener('wheel', e => {
    e.preventDefault()
    const rect = svg.getBoundingClientRect()
    const cursorMs = from + (e.clientX - rect.left) * (span / rect.width)
    zoom(u, life, e.deltaY > 0 ? 1.15 : 0.87, cursorMs)
  }, { passive: false })

  // Drag to pan.
  let dragging = false, startX = 0, moved = false
  scroll.addEventListener('pointerdown', e => { dragging = true; startX = e.clientX; moved = false; scroll.setPointerCapture(e.pointerId) })
  scroll.addEventListener('pointermove', e => {
    if (!dragging) return
    const dx = e.clientX - startX
    if (Math.abs(dx) > 3) moved = true
    if (moved) { startX = e.clientX; pan(u, life, -dx * msPerPx) }
  })
  scroll.addEventListener('pointerup', e => {
    dragging = false
    if (moved) return          // a drag, not a click
    // Click on a band/marker → popover.
    const g = e.target.closest('[data-start], [data-date]')
    if (g) {
      const dateIso = g.dataset.date || (() => {
        const a = new Date(g.dataset.start).getTime(), b = new Date(g.dataset.end).getTime()
        return new Date((a + b) / 2).toISOString()
      })()
      showPopover(el, e, dateIso)
    } else {
      hidePopover(el)
    }
  })
}

function showPopover(el, e, dateIso) {
  const pop = el.querySelector('#tl-popover')
  pop.innerHTML = detailPopoverHtml(dateIso)
  pop.style.display = 'block'
  const card = el.querySelector('.tl-card').getBoundingClientRect()
  pop.style.left = Math.min(e.clientX - card.left, card.width - 180) + 'px'
  pop.style.top  = (e.clientY - card.top + 8) + 'px'
  pop.querySelector('.tl-pop-transit')?.addEventListener('click', () => {
    const s = getActiveSession()
    if (s?.uiState?.transit) {
      s.uiState.transit.transitDate = pop.querySelector('.tl-pop-transit').dataset.date
      s.uiState.transit.transitTime = '12:00'
    }
    navigate(routeFor('transit'))
  })
}
function hidePopover(el) { const p = el.querySelector('#tl-popover'); if (p) p.style.display = 'none' }

async function downloadPng(el) {
  const svg = el.querySelector('#tl-spiral-wrap svg')
  if (!svg) return
  const size = 920
  const src = svg.outerHTML.replace('<svg ', `<svg width="${size}" height="${size}" style="background:#fff" `)
  const blob = new Blob([src], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `hora-prakash-dasha-spiral.png`
    a.click()
  } catch (err) {
    console.error('timeline png:', err)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function renderTimeline() { _el = null; render() }
