// src/tabs/reading.js
// The Reading page: the deterministic interpretation of this chart, rendered
// with clickable evidence chips and a beginner/practitioner depth dial.
//
// Every claim on this page traces back to a placement. The chips are not
// decoration — clicking one takes you to the chart with that planet's aspects
// lit up, so any sentence can be audited against the geometry that produced it.

import { state } from '../state.js'
import { getActiveSession } from '../sessions.js'
import { buildReading } from '../core/interpret.js'
import { calcAvasthas } from '../core/avastha.js'
import { detectYogas } from '../core/yogas.js'
import { getSettings, saveSettings } from '../core/settings.js'
import { navigate, routeFor } from '../ui/router.js'
import { copyText } from '../utils/clipboard.js'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

const ABBR = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
  Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
}

const FACTOR_EMOJI = { planet: '●', sign: '♒', house: '⌂', nakshatra: '★', dasha: '◆', yoga: '✦' }

/**
 * Minimal inline markdown: **bold** and _italic_ only. The corpus is authored
 * with those two and nothing else, so a full parser would be dead weight —
 * and the input is escaped first, so this cannot inject markup.
 */
function mdInline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}

function chartData() {
  if (!state.planets || !state.lagna) return null
  // Yogas and avasthas are not held in `state` — they are derived on demand
  // (the same way strength.js and export.js do it), so compute them here.
  let avasthas = null, yogas = null
  try { avasthas = calcAvasthas(state.planets) } catch (e) { console.error('reading: avasthas', e) }
  try { yogas = detectYogas(state.planets, state.lagna) } catch (e) { console.error('reading: yogas', e) }
  return {
    planets: state.planets,
    lagna: state.lagna,
    dasha: state.dasha,
    yogas,
    strength: state.strength,
    avasthas,
  }
}

function chipHtml(f) {
  const clickable = !!f.planet && !!ABBR[f.planet]
  const emoji = FACTOR_EMOJI[f.type] ?? '•'
  if (!clickable) {
    return `<span class="ev-chip ev-chip--static"><span aria-hidden="true">${emoji}</span> ${esc(f.label)}</span>`
  }
  return `<button class="ev-chip" data-planet="${esc(ABBR[f.planet])}"
    title="Show ${esc(f.planet)} in the chart with its aspects">
    <span aria-hidden="true">${emoji}</span> ${esc(f.label)}</button>`
}

function paragraphHtml(p) {
  const cat = p.category ? ` reading-para--${p.category}` : ''
  return `<div class="reading-para${cat}">
    <p>${mdInline(p.text)}</p>
    <div class="ev-chips">${(p.factors ?? []).map(chipHtml).join('')}</div>
  </div>`
}

function sectionHtml(s) {
  return `<section class="card reading-section">
    <header class="reading-section-head">
      <h3>${esc(s.title)}</h3>
      <p class="reading-subtitle">${esc(s.subtitle)}</p>
    </header>
    ${s.paragraphs.map(paragraphHtml).join('')}
  </section>`
}

/** Plain text of the whole reading — for the copy button. */
function readingToText(reading) {
  const lines = []
  for (const s of reading.sections) {
    lines.push(`## ${s.title}`, `_${s.subtitle}_`, '')
    for (const p of s.paragraphs) {
      lines.push(p.text, `   [${(p.factors ?? []).map(f => f.label).join(' · ')}]`, '')
    }
  }
  return lines.join('\n')
}

export async function renderReading() {
  const el = document.getElementById('tab-reading')
  if (!el) return

  const chart = chartData()
  if (!chart) {
    el.innerHTML = '<p class="panchang-empty">Calculate a birth chart first.</p>'
    return
  }

  const depth = getSettings().readingDepth ?? 'beginner'
  let reading
  try {
    reading = buildReading(chart, { depth })
  } catch (err) {
    console.error('reading:', err)
    el.innerHTML = `<div class="card"><p class="cal-hint">Could not build the reading: ${esc(err.message)}</p></div>`
    return
  }

  el.innerHTML = `
    <div class="card reading-header">
      <div class="reading-header-row">
        <div>
          <h2 class="reading-title">Your chart, read</h2>
          <p class="reading-subtitle">Every claim below is derived from a placement — click any chip to see it in the chart.</p>
        </div>
        <div class="reading-controls">
          <div class="chart-style-group" role="group" aria-label="Reading depth">
            <button class="chart-style-btn${depth === 'beginner' ? ' active' : ''}" data-depth="beginner">Plain</button>
            <button class="chart-style-btn${depth === 'practitioner' ? ' active' : ''}" data-depth="practitioner">Practitioner</button>
          </div>
          <button id="reading-copy" class="btn-secondary" title="Copy the whole reading as text">Copy</button>
        </div>
      </div>
      <p class="reading-disclaimer">
        This reading is assembled by rule from classical Jyotish principles — it is a
        <strong>starting point, not a verdict</strong>, and no computed text can weigh a life
        the way a practitioner can. The interpretive corpus has not yet been reviewed by a
        professional astrologer.
      </p>
    </div>
    ${reading.sections.map(sectionHtml).join('')}
  `

  // Depth dial — a setting, so it persists across people and reloads.
  el.querySelectorAll('[data-depth]').forEach(b => b.addEventListener('click', () => {
    saveSettings({ readingDepth: b.dataset.depth })
    renderReading()
  }))

  // Evidence chips → the chart, with that planet's aspects lit.
  el.querySelectorAll('.ev-chip[data-planet]').forEach(b => b.addEventListener('click', () => {
    const s = getActiveSession()
    if (s?.uiState?.chart) {
      s.uiState.chart.activePlanets = new Set([b.dataset.planet])
      s.uiState.chart.viewMode = '1'
      s.uiState.chart.divisional = 'D1'
    }
    navigate(routeFor('chart'))
  }))

  el.querySelector('#reading-copy')?.addEventListener('click', async () => {
    const btn = el.querySelector('#reading-copy')
    const ok = await copyText(readingToText(reading))
    btn.textContent = ok ? 'Copied' : 'Copy failed'
    setTimeout(() => { btn.textContent = 'Copy' }, 1500)
  })
}
