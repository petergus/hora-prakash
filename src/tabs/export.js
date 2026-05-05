// src/tabs/export.js
import { state } from '../state.js'
import { calcDivisional, DIVISIONAL_OPTIONS } from '../core/divisional.js'
import { getSettings } from '../core/settings.js'

const APP_VERSION = '1.2.0'

function buildPayload() {
  const { planets, lagna, houses, dasha, panchang, strength, birth } = state

  const divisionals = {}
  for (const { value } of DIVISIONAL_OPTIONS) {
    divisionals[value] = calcDivisional(planets, lagna, value)
  }

  const s = getSettings()
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      settings: {
        ayanamsa: s.ayanamsa,
        yearMethod: s.yearMethod,
        planetPositions: s.planetPositions,
        observerType: s.observerType,
      },
    },
    birth,
    lagna,
    houses,
    planets,
    divisionals,
    dasha,
    panchang,
    strength,
  }
}

// Lightweight JSON syntax highlighter — escapes HTML first, then wraps tokens.
function highlight(json) {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(
    /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        return /:$/.test(match)
          ? `<span class="xj-key">${match}</span>`
          : `<span class="xj-str">${match}</span>`
      }
      if (/true|false/.test(match)) return `<span class="xj-bool">${match}</span>`
      if (match === 'null')         return `<span class="xj-null">${match}</span>`
      return `<span class="xj-num">${match}</span>`
    }
  )
}

export function renderExport() {
  const el = document.getElementById('tab-export')
  if (!el) return

  if (!state.planets) {
    el.innerHTML = '<p class="export-empty">Calculate a birth chart first.</p>'
    return
  }

  const payload  = buildPayload()
  const jsonStr  = JSON.stringify(payload, null, 2)
  const sizeKB   = (jsonStr.length / 1024).toFixed(1)
  const label    = state.birth?.name || 'Chart'
  const filename = `${(state.birth?.name || 'chart').toLowerCase().replace(/\s+/g, '-')}-${state.birth?.dob || 'horoscope'}.json`

  el.innerHTML = `
    <div class="export-wrap">
      <div class="export-toolbar">
        <span class="export-meta">${label} &mdash; ${sizeKB} KB &mdash; ${DIVISIONAL_OPTIONS.length} divisional charts</span>
        <div class="export-actions">
          <button class="export-btn" id="xbtn-copy">Copy JSON</button>
          <button class="export-btn export-btn-primary" id="xbtn-download">Download .json</button>
        </div>
      </div>
      <pre class="export-pre" id="export-pre"><code>${highlight(jsonStr)}</code></pre>
    </div>
  `

  document.getElementById('xbtn-copy').addEventListener('click', async () => {
    const btn = document.getElementById('xbtn-copy')
    try {
      await navigator.clipboard.writeText(jsonStr)
      btn.textContent = 'Copied!'
      btn.classList.add('export-btn-ok')
    } catch {
      // Fallback for browsers that block clipboard without user gesture
      const pre = document.getElementById('export-pre')
      const range = document.createRange()
      range.selectNodeContents(pre)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      btn.textContent = 'Selected — Ctrl+C to copy'
    }
    setTimeout(() => {
      if (btn) { btn.textContent = 'Copy JSON'; btn.classList.remove('export-btn-ok') }
    }, 2500)
  })

  document.getElementById('xbtn-download').addEventListener('click', () => {
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  })
}
