// src/core/ai.js
// The AI layer: one provider abstraction with two transports.
//
//  • BYOK  — the user's own Anthropic key, direct browser → Anthropic
//            (`dangerouslyAllowBrowser`). Zero server cost; the key lives only
//            in this browser's localStorage and is never synced to Firestore.
//  • PROXY — a Firebase Cloud Function holds the key server-side and forwards
//            requests for signed-in users. The browser sends its Firebase ID
//            token; the function verifies it and injects the real key.
//
// The `@anthropic-ai/sdk` is **lazily imported** the first time an AI feature
// runs, so it stays out of the main bundle (same pattern as swisseph-wasm).
//
// The pure parts — settings, the chart-context builder, the tool definitions —
// are Node-safe and unit-tested (tests/ai.test.mjs). Only the `client` and the
// stream/chat runners touch the SDK, the network, or Firebase.

import { getSettings, saveSettings } from './settings.js'

export const DEFAULT_MODEL = 'claude-opus-4-8'
export const AI_MODELS = [
  { value: 'claude-opus-4-8',  label: 'Opus 4.8 — most capable' },
  { value: 'claude-sonnet-5',  label: 'Sonnet 5 — faster, cheaper' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 — fastest' },
]

// The BYOK key is deliberately NOT in the settings blob (which could one day be
// synced). It lives under its own localStorage key so a settings sync can never
// carry it to the cloud.
const KEY_STORAGE = 'hora-prakash-ai-key'

export function getAIKey() {
  try { return localStorage.getItem(KEY_STORAGE) || '' } catch { return '' }
}
export function setAIKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch { /* storage unavailable */ }
}

/** Current AI configuration from settings (+ the separately-stored key). */
export function getAIConfig() {
  const s = getSettings()
  return {
    mode:     s.aiMode  ?? 'off',        // 'off' | 'byok' | 'proxy'
    model:    s.aiModel ?? DEFAULT_MODEL,
    proxyUrl: s.aiProxyUrl ?? '',
    key:      getAIKey(),
  }
}

export function saveAIConfig({ mode, model, proxyUrl }) {
  const patch = {}
  if (mode     !== undefined) patch.aiMode = mode
  if (model    !== undefined) patch.aiModel = model
  if (proxyUrl !== undefined) patch.aiProxyUrl = proxyUrl
  saveSettings(patch)
}

/** Whether an AI feature can actually run given the current config. */
export function isAIReady(cfg = getAIConfig()) {
  if (cfg.mode === 'byok')  return !!cfg.key
  if (cfg.mode === 'proxy') return !!cfg.proxyUrl
  return false
}

/** A human explanation of why AI is unavailable, for the UI. */
export function aiUnavailableReason(cfg = getAIConfig()) {
  if (cfg.mode === 'off')   return 'AI features are turned off. Enable them in Settings.'
  if (cfg.mode === 'byok')  return 'Add your Anthropic API key in Settings to use AI features.'
  if (cfg.mode === 'proxy') return 'No proxy URL is configured in Settings.'
  return 'AI is not configured.'
}

// ── SDK client ───────────────────────────────────────────────────────────────

let _Anthropic = null
async function loadSDK() {
  if (!_Anthropic) _Anthropic = (await import('@anthropic-ai/sdk')).default
  return _Anthropic
}

/**
 * Build a configured Anthropic client for the current transport.
 *
 * PROXY: we point `baseURL` at the Cloud Function and override `fetch` so a
 * FRESH Firebase ID token is attached to every request — tokens expire after
 * ~1h, so a token baked into a header at construction time would go stale on a
 * long chat. The dummy `apiKey` is never sent (the function supplies the real
 * one); the SDK just requires a non-empty value.
 */
export async function makeClient(cfg = getAIConfig()) {
  const Anthropic = await loadSDK()

  if (cfg.mode === 'byok') {
    if (!cfg.key) throw new Error('No API key configured')
    return new Anthropic({ apiKey: cfg.key, dangerouslyAllowBrowser: true })
  }

  if (cfg.mode === 'proxy') {
    if (!cfg.proxyUrl) throw new Error('No proxy URL configured')
    const { auth } = await import('../firebase.js')
    // The SDK may call fetch as (url, init) OR (Request) — handle both so a
    // fresh Firebase ID token is attached however the SDK invokes us.
    const authedFetch = async (input, init) => {
      const user = auth.currentUser
      if (!user) throw new Error('Sign in to use AI features')
      const token = await user.getIdToken()
      if (input instanceof Request) {
        const req = new Request(input, init)
        req.headers.set('Authorization', `Bearer ${token}`)
        return fetch(req)
      }
      const headers = new Headers(init?.headers || {})
      headers.set('Authorization', `Bearer ${token}`)
      return fetch(input, { ...init, headers })
    }
    return new Anthropic({
      apiKey: 'proxy',                 // unused; the function holds the real key
      baseURL: cfg.proxyUrl.replace(/\/$/, ''),
      dangerouslyAllowBrowser: true,
      fetch: authedFetch,
    })
  }

  throw new Error('AI is turned off')
}

// ── Grounding: turn a chart into context the model can reason over ───────────

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const ord = n => ['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th'][n] ?? `${n}th`

/**
 * A compact, factual snapshot of the chart for the model — pure, so it's
 * unit-tested. Deliberately terse: placements, lordless facts, running dasha,
 * yogas, and the strength ratios. The interpretation itself is the model's job;
 * this is the evidence.
 */
export function buildChartContext(chart, { now = new Date() } = {}) {
  if (!chart?.planets || !chart?.lagna) throw new Error('buildChartContext: chart required')
  const lines = []

  const lagnaSign = chart.lagna.sign
  lines.push(`Lagna: ${SIGN_NAMES[lagnaSign - 1]}${chart.lagna.nakshatra ? ` (${chart.lagna.nakshatra}${chart.lagna.pada ? ' pada ' + chart.lagna.pada : ''})` : ''}`)

  lines.push('Planets:')
  for (const p of chart.planets) {
    const bits = [`${p.name}: ${SIGN_NAMES[p.sign - 1]} ${ord(p.house)} house`]
    if (p.nakshatra) bits.push(`nak ${p.nakshatra}${p.pada ? ' pada ' + p.pada : ''}`)
    if (p.retrograde) bits.push('retrograde')
    if (p.combust) bits.push('combust')
    const ratio = chart.strength?.shadbala?.[p.name]?.ratio
    if (typeof ratio === 'number') bits.push(`Shadbala ${ratio.toFixed(2)}×`)
    lines.push('  ' + bits.join(', '))
  }

  if (Array.isArray(chart.yogas) && chart.yogas.length) {
    lines.push('Yogas: ' + chart.yogas.map(y => y.name).join(', '))
  }

  if (Array.isArray(chart.dasha)) {
    const within = n => n.start <= now && n.end > now
    const md = chart.dasha.find(within)
    const ad = md?.children?.find(within)
    if (md) {
      lines.push(`Running dasha: ${md.planet} Mahadasha` +
        (ad ? ` / ${ad.planet} Antardasha` : '') +
        ` (as of ${now.toISOString().slice(0, 10)})`)
    }
  }

  return lines.join('\n')
}

/** The system prompt for a full reading (A2). */
export function readingSystemPrompt() {
  return [
    'You are an expert Vedic (Jyotish) astrologer writing a natal reading.',
    'You are given a factual snapshot of a sidereal (Lahiri) birth chart and a set of',
    'deterministically-derived interpretive factors. Ground every claim in that data —',
    'cite the specific placement (e.g. "Saturn in the 10th", "Cancer lagna") that supports it.',
    'Write in clear, warm, plain language for an intelligent non-specialist. Organise the',
    'reading into sections: Character, Mind & emotions, Career, Relationships, Strengths &',
    'challenges, and the current life period. Be honest about difficult placements without',
    'being fatalistic — this is a map of tendencies, not a verdict. Do not invent placements',
    'that are not in the data. Do not give medical, legal, or financial advice.',
  ].join(' ')
}

/**
 * Build the user message for a reading: the chart context plus, if available,
 * the deterministic reading's factor list (so the model and the offline
 * reading rest on the same evidence).
 */
export function buildReadingRequest(chart, reading) {
  const parts = [buildChartContext(chart)]
  if (reading?.sections?.length) {
    const factors = new Set()
    for (const s of reading.sections)
      for (const p of s.paragraphs)
        for (const f of p.factors ?? []) factors.add(f.label)
    if (factors.size) parts.push('\nKey factors already identified:\n- ' + [...factors].join('\n- '))
  }
  parts.push('\nWrite the reading now.')
  return parts.join('\n')
}

// ── Chat tools (A3): the model can CALL the app's own compute ────────────────
// Definitions are pure data (tested). Execution needs browser state + swe and
// is injected via `ctx` so it can be tested with fakes.

export const CHART_TOOLS = [
  {
    name: 'get_positions',
    description: 'Planetary positions for a divisional chart of the current person. Use for any question about where a planet sits.',
    input_schema: {
      type: 'object',
      properties: { division: { type: 'string', description: 'Divisional chart, e.g. D1 (rashi), D9 (navamsa), D10. Default D1.' } },
      required: [],
    },
  },
  {
    name: 'get_dasha_at',
    description: 'The running Vimshottari dasha lords (Mahadasha/Antardasha/Pratyantara) on a given date. Use for "what period am I in" questions.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'ISO date YYYY-MM-DD. Default today.' } },
      required: [],
    },
  },
  {
    name: 'find_transit_events',
    description: 'Upcoming transit events (sign ingresses, stations, aspects to natal planets, combustion) between two dates. Use for timing and "when will…" questions.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
        to:   { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'find_muhurta',
    description: 'Find auspicious time windows for an activity in a date range, scored against this person\'s chart. Use for "when should I…" questions.',
    input_schema: {
      type: 'object',
      properties: {
        activity: { type: 'string', description: 'One of: marriage, travel, contract, medical, launch, education, property.' },
        from:     { type: 'string', description: 'ISO date YYYY-MM-DD.' },
        to:       { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      },
      required: ['activity', 'from', 'to'],
    },
  },
  {
    name: 'get_strength',
    description: 'Shadbala (six-fold strength) and Ashtakavarga bindus for the current person. Use for questions about which planets are strong or weak.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

/** The system prompt for the chat (A3). */
export function chatSystemPrompt() {
  return [
    'You are a knowledgeable Vedic (Jyotish) astrologer answering questions about one',
    'specific birth chart, in conversation. You have tools that compute real answers from',
    'the chart — ALWAYS use them for anything involving positions, dashas, transits, timing,',
    'muhurta, or strength, rather than guessing. When a question is about timing ("is October',
    'good for…", "when will…"), call the relevant tool and base your answer on what it returns.',
    'Be concise and concrete. Explain the reasoning in plain language. Do not fabricate chart',
    'data. Do not give medical, legal, or financial advice — you may discuss astrological',
    'significations only. This is guidance, not a guarantee.',
  ].join(' ')
}

/** Adaptive-thinking + effort options shared by both runners. */
const THINK = { type: 'adaptive' }

/**
 * Stream a one-shot reading (A2). Calls `onText(delta)` as text arrives.
 * @returns {Promise<string>} the full text
 */
export async function streamReading({ chart, reading, onText, signal, cfg = getAIConfig() }) {
  const client = await makeClient(cfg)
  const stream = client.messages.stream({
    model: cfg.model,
    max_tokens: 8000,
    thinking: THINK,
    system: readingSystemPrompt(),
    messages: [{ role: 'user', content: buildReadingRequest(chart, reading) }],
  }, signal ? { signal } : undefined)

  let full = ''
  stream.on('text', t => { full += t; onText?.(t) })
  await stream.finalMessage()
  return full
}

/**
 * Run one chat turn with the client-executed chart tools (A3). Streams text via
 * `onText`, reports tool calls via `onTool`, and loops until the model stops
 * asking for tools. `executeTool(name, input)` runs the compute in the browser.
 *
 * @returns {Promise<object[]>} the updated messages array (append to history)
 */
export async function runChatTurn({ messages, executeTool, onText, onTool, signal, cfg = getAIConfig() }) {
  const client = await makeClient(cfg)
  const convo = [...messages]

  for (let hop = 0; hop < 6; hop++) {
    const stream = client.messages.stream({
      model: cfg.model,
      max_tokens: 4000,
      thinking: THINK,
      system: chatSystemPrompt(),
      tools: CHART_TOOLS,
      messages: convo,
    }, signal ? { signal } : undefined)

    stream.on('text', t => onText?.(t))
    const msg = await stream.finalMessage()
    convo.push({ role: 'assistant', content: msg.content })

    if (msg.stop_reason !== 'tool_use') break

    const toolResults = []
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue
      onTool?.(block.name, block.input)
      let result
      try {
        result = await executeTool(block.name, block.input)
      } catch (err) {
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${err.message}`, is_error: true })
        continue
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      })
    }
    convo.push({ role: 'user', content: toolResults })
  }

  return convo
}
