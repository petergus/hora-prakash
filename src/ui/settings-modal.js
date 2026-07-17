// src/ui/settings-modal.js
import {
  getSettings, saveSettings,
  AYANAMSA_OPTIONS, YEAR_METHOD_OPTIONS, PLANET_POSITION_OPTIONS, OBSERVER_TYPE_OPTIONS, THEME_OPTIONS,
} from '../core/settings.js'
import { AI_MODELS, getAIConfig, saveAIConfig, getAIKey, setAIKey } from '../core/ai.js'
import { updateFavicon } from './favicon.js'
import { openModal } from './modal.js'

export function openSettingsModal() {
  const s = getSettings()
  const ai = getAIConfig()
  const currentTheme = document.documentElement.dataset.theme || s.theme || 'crimson'

  const opts = (list, sel) => list.map(o =>
    `<option value="${o.value}"${String(o.value) === String(sel) ? ' selected' : ''}>${o.label}</option>`).join('')

  const { el, close } = openModal({
    title: 'Settings',
    width: '400px',
    content: `
      <div class="modal-field">
        <label>Theme</label>
        <div class="theme-swatches" id="theme-swatches">
          ${THEME_OPTIONS.map(t => `<button type="button" class="theme-swatch${t.value === currentTheme ? ' active' : ''}" data-theme="${t.value}" title="${t.label}" style="background:${t.color}" aria-label="${t.label}"></button>`).join('')}
        </div>
      </div>
      <div class="modal-field">
        <label>Ayanamsa</label>
        <select id="settings-ayanamsa">${opts(AYANAMSA_OPTIONS, s.ayanamsa)}</select>
      </div>
      <div class="modal-field">
        <label>Year Method <span title="Used for solar-return and progression dashas" style="cursor:help;color:var(--muted)">ⓘ</span></label>
        <select id="settings-year-method">${opts(YEAR_METHOD_OPTIONS, s.yearMethod)}</select>
      </div>
      <div class="modal-field" id="settings-custom-days-field" style="display:${s.yearMethod === 'custom' ? '' : 'none'}">
        <label>Custom Year Length (days)</label>
        <input type="number" id="settings-custom-days" step="0.0001" min="1" value="${s.customYearDays ?? 365.25}" />
      </div>
      <div class="modal-field">
        <label>Planet Positions</label>
        <select id="settings-planet-positions">${opts(PLANET_POSITION_OPTIONS, s.planetPositions)}</select>
      </div>
      <div class="modal-field">
        <label>Observer</label>
        <select id="settings-observer-type">${opts(OBSERVER_TYPE_OPTIONS, s.observerType)}</select>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0 0.5rem">
      <div class="modal-field">
        <label>AI features <span title="Powers the AI Reading and Ask tabs" style="cursor:help;color:var(--muted)">ⓘ</span></label>
        <select id="settings-ai-mode">
          <option value="off"${ai.mode === 'off' ? ' selected' : ''}>Off</option>
          <option value="byok"${ai.mode === 'byok' ? ' selected' : ''}>Use my own API key</option>
          <option value="proxy"${ai.mode === 'proxy' ? ' selected' : ''}>Use a proxy (shared key)</option>
        </select>
      </div>
      <div class="modal-field" id="settings-ai-key-field" style="display:${ai.mode === 'byok' ? '' : 'none'}">
        <label>Anthropic API key</label>
        <input type="password" id="settings-ai-key" autocomplete="off" placeholder="sk-ant-…" value="${getAIKey() ? '••••••••••••' : ''}" />
        <p style="font-size:var(--fs-xs);color:var(--muted);margin:0.3rem 0 0;line-height:1.5">
          Stored only in this browser, never synced. Get one at console.anthropic.com. You pay Anthropic for usage.
        </p>
      </div>
      <div class="modal-field" id="settings-ai-proxy-field" style="display:${ai.mode === 'proxy' ? '' : 'none'}">
        <label>Proxy URL</label>
        <input type="text" id="settings-ai-proxy" autocomplete="off" placeholder="https://…cloudfunctions.net/aiProxy" value="${ai.proxyUrl || ''}" />
      </div>
      <div class="modal-field" id="settings-ai-model-field" style="display:${ai.mode === 'off' ? 'none' : ''}">
        <label>Model</label>
        <select id="settings-ai-model">${opts(AI_MODELS, ai.model)}</select>
      </div>
    `,
    actions: [
      { id: 'settings-cancel', label: 'Cancel', variant: 'ghost' },
      { id: 'settings-apply', label: 'Apply', variant: 'primary', onClick: applySettings },
    ],
  })

  // Live theme preview + immediate save (same behavior as before).
  el.querySelectorAll('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const theme = sw.dataset.theme
      el.querySelectorAll('.theme-swatch').forEach(x => x.classList.toggle('active', x.dataset.theme === theme))
      document.documentElement.dataset.theme = theme
      updateFavicon(theme)
      saveSettings({ theme })
    })
  })

  el.querySelector('#settings-year-method').addEventListener('change', e => {
    el.querySelector('#settings-custom-days-field').style.display =
      e.target.value === 'custom' ? '' : 'none'
  })

  el.querySelector('#settings-ai-mode').addEventListener('change', e => {
    const mode = e.target.value
    el.querySelector('#settings-ai-key-field').style.display   = mode === 'byok' ? '' : 'none'
    el.querySelector('#settings-ai-proxy-field').style.display = mode === 'proxy' ? '' : 'none'
    el.querySelector('#settings-ai-model-field').style.display = mode === 'off' ? 'none' : ''
  })

  async function applySettings(closeModal) {
    const ayanamsa        = parseInt(el.querySelector('#settings-ayanamsa').value, 10)
    const yearMethod      = el.querySelector('#settings-year-method').value
    const customYearDays  = parseFloat(el.querySelector('#settings-custom-days').value) || 365.25
    const planetPositions = el.querySelector('#settings-planet-positions').value
    const observerType    = el.querySelector('#settings-observer-type').value
    const theme = el.querySelector('.theme-swatch.active')?.dataset.theme || 'crimson'
    saveSettings({ ayanamsa, yearMethod, customYearDays, planetPositions, observerType, theme })

    // AI settings — the key is stored separately (never in the synced blob).
    const aiMode  = el.querySelector('#settings-ai-mode').value
    const aiModel = el.querySelector('#settings-ai-model').value
    const aiProxyUrl = el.querySelector('#settings-ai-proxy').value.trim()
    saveAIConfig({ mode: aiMode, model: aiModel, proxyUrl: aiProxyUrl })
    const keyVal = el.querySelector('#settings-ai-key').value
    if (keyVal && !/^•+$/.test(keyVal)) setAIKey(keyVal.trim())  // only overwrite if actually changed

    document.documentElement.dataset.theme = theme
    updateFavicon(theme)
    closeModal()
    const { recalcAll } = await import('../tabs/input.js')
    await recalcAll()
  }
}
