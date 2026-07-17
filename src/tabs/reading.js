// src/tabs/reading.js
// The Reading page. Three sub-tabs:
//   • Overview — the deterministic, rule-based reading with evidence chips (A1/A4/A5/A6).
//   • AI Reading — a full natural-language reading streamed from Claude (A2),
//     grounded in the same chart data and the Overview's factors.
//   • Ask — chat with the chart (A3): Claude answers using tools that run the
//     app's own compute, so timing answers are calculated, not guessed.
//
// The deterministic Overview always works offline. The AI tabs need an API key
// (BYOK) or the proxy configured in Settings.

import { state } from '../state.js'
import { getActiveSession, defaultReadingUI } from '../sessions.js'
import { buildReading } from '../core/interpret.js'
import { calcAvasthas } from '../core/avastha.js'
import { detectYogas } from '../core/yogas.js'
import { getSettings, saveSettings } from '../core/settings.js'
import { navigate, routeFor } from '../ui/router.js'
import { copyText } from '../utils/clipboard.js'
import {
  getAIConfig, isAIReady, aiUnavailableReason,
  streamReading, runChatTurn,
} from '../core/ai.js'
import { executeChartTool } from './reading-tools.js'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

const ABBR = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
  Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
}
const FACTOR_EMOJI = { planet: '●', sign: '♒', house: '⌂', nakshatra: '★', dasha: '◆', yoga: '✦' }

function ui() {
  const s = getActiveSession()
  if (!s) return defaultReadingUI()
  s.uiState ??= {}
  s.uiState.reading ??= defaultReadingUI()
  return s.uiState.reading
}

/** Minimal inline markdown (bold/italic only) over escaped text. */
function mdInline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>')
}

/** Streamed AI output: paragraphs + **bold**, escaped. */
function mdBlock(s) {
  return String(s ?? '').split(/\n{2,}/).map(para =>
    `<p>${mdInline(para.trim()).replace(/\n/g, '<br>')}</p>`).join('')
}

function chartData() {
  if (!state.planets || !state.lagna) return null
  let avasthas = null, yogas = null
  try { avasthas = calcAvasthas(state.planets) } catch (e) { console.error('reading: avasthas', e) }
  try { yogas = detectYogas(state.planets, state.lagna) } catch (e) { console.error('reading: yogas', e) }
  return { planets: state.planets, lagna: state.lagna, dasha: state.dasha, yogas, strength: state.strength, avasthas }
}

// ── Overview (deterministic) ─────────────────────────────────────────────────

function chipHtml(f) {
  const clickable = !!f.planet && !!ABBR[f.planet]
  const emoji = FACTOR_EMOJI[f.type] ?? '•'
  if (!clickable) return `<span class="ev-chip ev-chip--static"><span aria-hidden="true">${emoji}</span> ${esc(f.label)}</span>`
  return `<button class="ev-chip" data-planet="${esc(ABBR[f.planet])}" title="Show ${esc(f.planet)} in the chart with its aspects"><span aria-hidden="true">${emoji}</span> ${esc(f.label)}</button>`
}
function paragraphHtml(p) {
  const cat = p.category ? ` reading-para--${p.category}` : ''
  return `<div class="reading-para${cat}"><p>${mdInline(p.text)}</p><div class="ev-chips">${(p.factors ?? []).map(chipHtml).join('')}</div></div>`
}
function sectionHtml(s) {
  return `<section class="card reading-section"><header class="reading-section-head"><h3>${esc(s.title)}</h3><p class="reading-subtitle">${esc(s.subtitle)}</p></header>${s.paragraphs.map(paragraphHtml).join('')}</section>`
}
function readingToText(reading) {
  const lines = []
  for (const s of reading.sections) {
    lines.push(`## ${s.title}`, `_${s.subtitle}_`, '')
    for (const p of s.paragraphs) lines.push(p.text, `   [${(p.factors ?? []).map(f => f.label).join(' · ')}]`, '')
  }
  return lines.join('\n')
}

function overviewHtml(chart) {
  const depth = getSettings().readingDepth ?? 'beginner'
  let reading
  try { reading = buildReading(chart, { depth }) }
  catch (err) { return { html: `<div class="card"><p class="cal-hint">Could not build the reading: ${esc(err.message)}</p></div>`, reading: null }  }

  const html = `
    <div class="card reading-header">
      <div class="reading-header-row">
        <div>
          <h2 class="reading-title">Your chart, read</h2>
          <p class="reading-subtitle">Every claim is derived from a placement — click any chip to see it in the chart.</p>
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
        This reading is assembled by rule from classical Jyotish principles — a
        <strong>starting point, not a verdict</strong>. The interpretive corpus has not yet been
        reviewed by a professional astrologer.
      </p>
    </div>
    ${reading.sections.map(sectionHtml).join('')}`
  return { html, reading }
}

function wireOverview(el, reading) {
  el.querySelectorAll('[data-depth]').forEach(b => b.addEventListener('click', () => {
    saveSettings({ readingDepth: b.dataset.depth }); renderReading()
  }))
  el.querySelectorAll('.ev-chip[data-planet]').forEach(b => b.addEventListener('click', () => {
    const s = getActiveSession()
    if (s?.uiState?.chart) {
      s.uiState.chart.activePlanets = new Set([b.dataset.planet])
      s.uiState.chart.viewMode = '1'; s.uiState.chart.divisional = 'D1'
    }
    navigate(routeFor('chart'))
  }))
  el.querySelector('#reading-copy')?.addEventListener('click', async () => {
    if (!reading) return
    const btn = el.querySelector('#reading-copy')
    const ok = await copyText(readingToText(reading))
    btn.textContent = ok ? 'Copied' : 'Copy failed'
    setTimeout(() => { btn.textContent = 'Copy' }, 1500)
  })
}

// ── Shared: AI-disabled notice ───────────────────────────────────────────────

function aiDisabledCard() {
  return `<div class="card"><h3 class="section-label">AI features</h3>
    <p class="cal-hint">${esc(aiUnavailableReason())}</p>
    <p class="cal-hint" style="margin-top:0.5rem">Open <strong>Settings</strong> (the gear in the sidebar) to add your Anthropic API key or a proxy URL.</p>
    <p class="reading-disclaimer" style="margin-top:0.75rem">AI readings are generated by a language model. They can be wrong or inconsistent, and are not a substitute for a qualified astrologer.</p>
  </div>`
}

// ── AI Reading (A2) ──────────────────────────────────────────────────────────

function aiReadingHtml(u) {
  if (!isAIReady()) return aiDisabledCard()
  const body = u.aiText
    ? mdBlock(u.aiText)
    : '<p class="cal-hint">Generate a full natural-language reading of this chart, grounded in the same placements as the Overview.</p>'
  return `
    <div class="card">
      <div class="reading-header-row">
        <div><h2 class="reading-title">AI reading</h2>
          <p class="reading-subtitle">A language model reads the chart — grounded in its actual placements.</p></div>
        <div class="reading-controls">
          <button id="ai-generate" class="btn-secondary"${u.aiBusy ? ' disabled' : ''}>${u.aiText ? 'Regenerate' : 'Generate'}</button>
        </div>
      </div>
      <p class="reading-disclaimer">Generated by a language model — it can be wrong or inconsistent. Not a substitute for a qualified astrologer, and not medical, legal, or financial advice.</p>
      <div id="ai-reading-body" class="ai-prose">${body}</div>
    </div>`
}

async function generateAIReading(el, chart) {
  const u = ui()
  const bodyEl = el.querySelector('#ai-reading-body')
  const btn = el.querySelector('#ai-generate')
  u.aiBusy = true; u.aiText = ''
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…' }
  bodyEl.innerHTML = '<p class="cal-hint">Thinking…</p>'

  let acc = ''
  try {
    const reading = buildReading(chart, { depth: 'beginner' })
    await streamReading({
      chart, reading,
      onText: t => { acc += t; u.aiText = acc; bodyEl.innerHTML = mdBlock(acc) },
    })
  } catch (err) {
    console.error('ai reading:', err)
    bodyEl.innerHTML = `<p class="cal-hint">Could not generate the reading: ${esc(err.message)}</p>`
    u.aiText = null
  } finally {
    u.aiBusy = false
    if (btn) { btn.disabled = false; btn.textContent = u.aiText ? 'Regenerate' : 'Generate' }
  }
}

// ── Ask (A3) ─────────────────────────────────────────────────────────────────

function bubble(role, text, streaming = false) {
  return `<div class="ask-msg ask-msg--${role}${streaming ? ' ask-msg--streaming' : ''}">${mdBlock(text) || '<p class="cal-hint">…</p>'}</div>`
}

function askHtml(u) {
  if (!isAIReady()) return aiDisabledCard()
  const thread = u.chat.length
    ? u.chat.map(m => bubble(m.role, m.text)).join('')
    : `<div class="ask-empty"><p class="cal-hint">Ask anything about this chart — placements, timing, whether a period suits a plan. Answers about timing are computed from the chart, not guessed.</p>
        <div class="ask-suggestions">
          ${['What does my Moon say about me?', 'When does my current dasha period end?', 'Is the next six months good for a career change?'].map(q => `<button class="ask-suggestion" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
        </div></div>`
  return `
    <div class="card ask-card">
      <div class="reading-header-row">
        <div><h2 class="reading-title">Ask the chart</h2>
          <p class="reading-subtitle">Timing questions are answered by computing from the chart.</p></div>
        ${u.chat.length ? '<button id="ask-clear" class="btn-secondary">Clear</button>' : ''}
      </div>
      <p class="reading-disclaimer">Answers come from a language model using the app's calculations. It can still be wrong — not a substitute for a qualified astrologer, and not medical, legal, or financial advice.</p>
      <div id="ask-thread" class="ask-thread">${thread}</div>
      <form id="ask-form" class="ask-form">
        <input id="ask-input" type="text" autocomplete="off" placeholder="Ask about this chart…"${u.chatBusy ? ' disabled' : ''}>
        <button type="submit" class="btn-secondary"${u.chatBusy ? ' disabled' : ''}>Send</button>
      </form>
    </div>`
}

async function sendAsk(el, text) {
  const u = ui()
  text = (text || '').trim()
  if (!text || u.chatBusy) return

  u.chat.push({ role: 'user', text })
  u.chat.push({ role: 'assistant', text: '' })
  u.chatApi.push({ role: 'user', content: text })
  u.chatBusy = true

  const threadEl = el.querySelector('#ask-thread')
  const render = () => {
    threadEl.innerHTML = u.chat.map((m, i) =>
      bubble(m.role, m.text, u.chatBusy && i === u.chat.length - 1)).join('')
    threadEl.scrollTop = threadEl.scrollHeight
  }
  const input = el.querySelector('#ask-input')
  if (input) { input.value = ''; input.disabled = true }
  render()

  const assistant = u.chat[u.chat.length - 1]
  let acc = ''
  try {
    const convo = await runChatTurn({
      messages: u.chatApi,
      executeTool: executeChartTool,
      onText: t => { acc += t; assistant.text = acc; render() },
      onTool: (name) => {
        const note = `_(consulting ${name.replace(/_/g, ' ')}…)_`
        assistant.text = acc ? acc + '\n\n' + note : note; render()
      },
    })
    u.chatApi = convo
    // Final assistant text = concatenated text blocks of the last assistant message.
    const last = [...convo].reverse().find(m => m.role === 'assistant')
    const finalText = (last?.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    assistant.text = finalText || acc || '(no answer)'
  } catch (err) {
    console.error('ask:', err)
    assistant.text = `Sorry — that failed: ${err.message}`
  } finally {
    u.chatBusy = false
    render()
    // Re-render the whole page so the input re-enables and Clear appears.
    renderReading()
  }
}

// ── Main render ──────────────────────────────────────────────────────────────

const SUBTABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'ai',       label: 'AI Reading' },
  { id: 'ask',      label: 'Ask' },
]

export async function renderReading() {
  const el = document.getElementById('tab-reading')
  if (!el) return

  const chart = chartData()
  if (!chart) { el.innerHTML = '<p class="panchang-empty">Calculate a birth chart first.</p>'; return }

  const u = ui()
  const sub = SUBTABS.some(t => t.id === u.subTab) ? u.subTab : 'overview'
  u.subTab = sub

  const nav = `<div class="reading-subnav">${SUBTABS.map(t =>
    `<button class="reading-subbtn${t.id === sub ? ' active' : ''}" data-sub="${t.id}">${t.label}</button>`).join('')}</div>`

  let bodyHtml = '', reading = null
  if (sub === 'overview') { const o = overviewHtml(chart); bodyHtml = o.html; reading = o.reading }
  else if (sub === 'ai')  bodyHtml = aiReadingHtml(u)
  else                    bodyHtml = askHtml(u)

  el.innerHTML = nav + bodyHtml

  el.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => {
    u.subTab = b.dataset.sub; renderReading()
  }))

  if (sub === 'overview') wireOverview(el, reading)
  else if (sub === 'ai') {
    el.querySelector('#ai-generate')?.addEventListener('click', () => generateAIReading(el, chart))
  } else {
    el.querySelector('#ask-form')?.addEventListener('submit', e => {
      e.preventDefault(); sendAsk(el, el.querySelector('#ask-input')?.value)
    })
    el.querySelectorAll('.ask-suggestion').forEach(b =>
      b.addEventListener('click', () => sendAsk(el, b.dataset.q)))
    el.querySelector('#ask-clear')?.addEventListener('click', () => {
      u.chat = []; u.chatApi = []; renderReading()
    })
  }
}
