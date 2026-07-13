// src/ui/settings-modal.js
import {
  getSettings, saveSettings,
  AYANAMSA_OPTIONS, YEAR_METHOD_OPTIONS, PLANET_POSITION_OPTIONS, OBSERVER_TYPE_OPTIONS, THEME_OPTIONS,
} from '../core/settings.js'
import { updateFavicon } from './favicon.js'
import { openModal } from './modal.js'

/**
 * Wire the settings gear. `mount` is the element the gear button is appended
 * to (defaults to the legacy <header> until the app shell provides a slot).
 */
export function initSettingsModal(mount = document.querySelector('header')) {
  const gearBtn = document.createElement('button')
  gearBtn.id = 'settings-btn'
  gearBtn.type = 'button'
  gearBtn.title = 'Calculation Settings'
  gearBtn.textContent = '⚙'
  gearBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1.15rem;padding:0.3rem 0.6rem;color:var(--muted);line-height:1;flex-shrink:0;'
  mount?.appendChild(gearBtn)
  gearBtn.addEventListener('click', openSettingsModal)
}

export function openSettingsModal() {
  const s = getSettings()
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

  async function applySettings(closeModal) {
    const ayanamsa        = parseInt(el.querySelector('#settings-ayanamsa').value, 10)
    const yearMethod      = el.querySelector('#settings-year-method').value
    const customYearDays  = parseFloat(el.querySelector('#settings-custom-days').value) || 365.25
    const planetPositions = el.querySelector('#settings-planet-positions').value
    const observerType    = el.querySelector('#settings-observer-type').value
    const theme = el.querySelector('.theme-swatch.active')?.dataset.theme || 'crimson'
    saveSettings({ ayanamsa, yearMethod, customYearDays, planetPositions, observerType, theme })
    document.documentElement.dataset.theme = theme
    updateFavicon(theme)
    closeModal()
    const { recalcAll } = await import('../tabs/input.js')
    await recalcAll()
  }
}
