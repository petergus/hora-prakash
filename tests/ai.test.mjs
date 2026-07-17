// Unit tests for the pure parts of the AI layer (src/core/ai.js): config
// gating, the chart-context grounding builder, the tool definitions, and the
// request/system-prompt builders. The SDK, network, and Firebase are never
// touched here — those paths are exercised only in the browser.
// Run: node tests/ai.test.mjs

// Minimal localStorage/window shims so settings.js + ai.js import in Node.
const store = {}
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
}
globalThis.window ??= { innerWidth: 1200 }

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const {
  DEFAULT_MODEL, AI_MODELS,
  getAIKey, setAIKey, getAIConfig, saveAIConfig, isAIReady, aiUnavailableReason,
  buildChartContext, buildReadingRequest, readingSystemPrompt, chatSystemPrompt,
  CHART_TOOLS,
} = await import('../src/core/ai.js')

console.log('\n[config gating]')
{
  // Default: off
  let cfg = getAIConfig()
  assert(cfg.mode === 'off', 'defaults to off')
  assert(cfg.model === DEFAULT_MODEL, 'defaults to the Opus model')
  assert(!isAIReady(cfg), 'off → not ready')
  assert(aiUnavailableReason(cfg).includes('turned off'), 'off reason mentions being off')

  // BYOK without a key → not ready
  saveAIConfig({ mode: 'byok' })
  cfg = getAIConfig()
  assert(cfg.mode === 'byok' && !isAIReady(cfg), 'byok without a key → not ready')
  assert(aiUnavailableReason(cfg).includes('API key'), 'byok reason asks for a key')

  // BYOK with a key → ready, key stored under its own storage slot
  setAIKey('sk-ant-test123')
  assert(getAIKey() === 'sk-ant-test123', 'key round-trips')
  assert(store['hora-prakash-ai-key'] === 'sk-ant-test123', 'key lives under its own localStorage slot')
  assert(!('aiKey' in (JSON.parse(store['hora-prakash-settings'] || '{}'))),
    'the key is NOT written into the synced settings blob')
  assert(isAIReady(getAIConfig()), 'byok with a key → ready')

  // Clearing the key
  setAIKey('')
  assert(getAIKey() === '' && !isAIReady(getAIConfig()), 'clearing the key disables byok')

  // Proxy needs a URL
  saveAIConfig({ mode: 'proxy', proxyUrl: '' })
  assert(!isAIReady(getAIConfig()), 'proxy without a URL → not ready')
  saveAIConfig({ proxyUrl: 'https://example.cloudfunctions.net/aiProxy' })
  assert(isAIReady(getAIConfig()), 'proxy with a URL → ready')
  assert(getAIConfig().proxyUrl.endsWith('/aiProxy'), 'proxy URL persists')

  saveAIConfig({ mode: 'off' })
}

console.log('\n[model list]')
{
  assert(AI_MODELS.length >= 2 && AI_MODELS.every(m => m.value && m.label), 'model options are well-formed')
  assert(AI_MODELS[0].value === DEFAULT_MODEL, 'the default model is first in the list')
}

// A small chart (Cancer lagna, Moon in Capricorn — Indira Gandhi shape).
const chart = {
  lagna: { sign: 4, degree: 27.4, nakshatra: 'Ashlesha', pada: 4 },
  planets: [
    { name: 'Sun',  sign: 8,  house: 5, nakshatra: 'Anuradha', pada: 1 },
    { name: 'Moon', sign: 10, house: 7, nakshatra: 'Uttara Ashadha', pada: 3 },
    { name: 'Saturn', sign: 4, house: 1, retrograde: false },
    { name: 'Mercury', sign: 8, house: 5, combust: true },
  ],
  yogas: [{ key: 'gaja-kesari', name: 'Gaja-Kesari Yoga' }],
  dasha: [
    { planet: 'Rahu', start: new Date('1966-01-01'), end: new Date('1984-01-01'),
      children: [{ planet: 'Jupiter', start: new Date('1980-01-01'), end: new Date('1982-06-01'), children: [] }] },
  ],
  strength: { shadbala: { Sun: { ratio: 1.34 }, Moon: { ratio: 0.72 } } },
}

console.log('\n[buildChartContext]')
{
  const ctx = buildChartContext(chart, { now: new Date('1981-01-01') })
  assert(ctx.includes('Lagna: Cancer'), 'names the lagna sign')
  assert(ctx.includes('Ashlesha'), 'includes the lagna nakshatra')
  assert(ctx.includes('Moon: Capricorn 7th house'), 'places the Moon by sign and house')
  assert(ctx.includes('Uttara Ashadha'), 'includes a planet nakshatra')
  assert(ctx.includes('combust'), 'flags a combust planet')
  assert(ctx.includes('Shadbala 1.34'), 'includes the Shadbala ratio')
  assert(ctx.includes('Gaja-Kesari'), 'lists yogas')
  assert(ctx.includes('Rahu Mahadasha') && ctx.includes('Jupiter Antardasha'),
    'names the running dasha at the given date')
  assert(!/undefined|NaN|\[object/.test(ctx), 'no undefined/NaN leaks into the context')

  let threw = false
  try { buildChartContext({ planets: [] }) } catch { threw = true }
  assert(threw, 'a chart without a lagna throws')
}

console.log('\n[reading request + prompts]')
{
  const reading = {
    sections: [{ paragraphs: [{ text: 'x', factors: [{ label: 'Saturn in 1st' }, { label: 'Cancer lagna' }] }] }],
  }
  const req = buildReadingRequest(chart, reading)
  assert(req.includes('Lagna: Cancer'), 'request embeds the chart context')
  assert(req.includes('Saturn in 1st') && req.includes('Cancer lagna'), 'request carries the deterministic factors')
  assert(req.trim().endsWith('Write the reading now.'), 'request ends with the instruction')

  // Works without a deterministic reading too
  const bare = buildReadingRequest(chart, null)
  assert(bare.includes('Lagna: Cancer') && !bare.includes('Key factors'), 'no reading → context only, no factor block')

  const sys = readingSystemPrompt()
  assert(/Jyotish|Vedic/.test(sys) && /Ground every claim/.test(sys), 'reading system prompt sets the grounding rule')
  assert(/medical|legal|financial/.test(sys), 'reading system prompt disclaims advice')

  const chatSys = chatSystemPrompt()
  assert(/tools/.test(chatSys) && /timing/.test(chatSys), 'chat system prompt tells the model to use tools for timing')
}

console.log('\n[chart tool definitions]')
{
  const names = CHART_TOOLS.map(t => t.name)
  for (const n of ['get_positions', 'get_dasha_at', 'find_transit_events', 'find_muhurta', 'get_strength']) {
    assert(names.includes(n), `tool "${n}" is defined`)
  }
  assert(CHART_TOOLS.every(t => t.name && t.description && t.input_schema?.type === 'object'),
    'every tool has a name, description, and object input_schema')
  assert(CHART_TOOLS.every(t => Array.isArray(t.input_schema.required)),
    'every tool declares a required array (may be empty)')
  // The Anthropic API rejects unknown schema shapes — required keys must exist in properties.
  assert(CHART_TOOLS.every(t => (t.input_schema.required ?? []).every(k => k in (t.input_schema.properties ?? {}))),
    'every required key appears in properties')
  const muhurta = CHART_TOOLS.find(t => t.name === 'find_muhurta')
  assert(muhurta.input_schema.required.includes('activity'), 'find_muhurta requires an activity')
}

console.log(failures === 0 ? '\nALL AI TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
