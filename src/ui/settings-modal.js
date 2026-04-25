// src/ui/settings-modal.js
import {
  getSettings, saveSettings, applyAyanamsa,
  AYANAMSA_OPTIONS, PLANET_POSITION_OPTIONS, OBSERVER_TYPE_OPTIONS, THEME_OPTIONS,
} from '../core/settings.js'

export function initSettingsModal() {
  const nav = document.getElementById('tab-nav')
  const gearBtn = document.createElement('button')
  gearBtn.id = 'settings-btn'
  gearBtn.type = 'button'
  gearBtn.title = 'Calculation Settings'
  gearBtn.textContent = '⚙'
  gearBtn.style.cssText = 'margin-left:auto;background:none;border:none;cursor:pointer;font-size:1.15rem;padding:0.3rem 0.6rem;color:var(--muted);line-height:1;'
  nav.appendChild(gearBtn)

  const overlay = document.createElement('div')
  overlay.id = 'settings-modal'
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;align-items:center;justify-content:center;'
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border,#333);border-radius:8px;padding:1.5rem;min-width:280px;max-width:360px;width:90%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem">
        <h3 style="margin:0;font-size:0.9rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">⚙ Calculation Settings</h3>
        <button id="settings-close" type="button" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--muted);padding:0 0.3rem">✕</button>
      </div>
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.5rem;font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Theme</label>
        <div class="theme-swatches" id="theme-swatches">
          ${THEME_OPTIONS.map(t => `<button class="theme-swatch" data-theme="${t.value}" title="${t.label}" style="background:${t.color}" aria-label="${t.label}"></button>`).join('')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Ayanamsa</label>
        <select id="settings-ayanamsa" style="width:100%">
          ${AYANAMSA_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:1rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Planet Positions</label>
        <select id="settings-planet-positions" style="width:100%">
          ${PLANET_POSITION_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:1.2rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Observer</label>
        <select id="settings-observer-type" style="width:100%">
          ${OBSERVER_TYPE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button id="settings-apply" type="button" class="btn-primary" style="flex:1">Apply</button>
        <button id="settings-cancel" type="button" class="btn-secondary" style="flex:1">Cancel</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const close = () => { overlay.style.display = 'none' }

  gearBtn.addEventListener('click', () => {
    const s = getSettings()
    overlay.style.display = 'flex'
    const currentTheme = s.theme || 'indigo'
    overlay.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.theme === currentTheme)
    })
    document.getElementById('settings-ayanamsa').value         = String(s.ayanamsa)
    document.getElementById('settings-planet-positions').value = s.planetPositions
    document.getElementById('settings-observer-type').value    = s.observerType
  })

  document.getElementById('settings-close').addEventListener('click', close)
  document.getElementById('settings-cancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelectorAll('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const theme = sw.dataset.theme
      overlay.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === theme))
      document.documentElement.dataset.theme = theme
      saveSettings({ theme })
    })
  })

  document.getElementById('settings-apply').addEventListener('click', async () => {
    const ayanamsa        = parseInt(document.getElementById('settings-ayanamsa').value, 10)
    const planetPositions = document.getElementById('settings-planet-positions').value
    const observerType    = document.getElementById('settings-observer-type').value
    const activeThemeSwatch = overlay.querySelector('.theme-swatch.active')
    const theme = activeThemeSwatch?.dataset.theme || 'indigo'
    saveSettings({ ayanamsa, planetPositions, observerType, theme })
    document.documentElement.dataset.theme = theme
    close()
    const { recalcAll } = await import('../tabs/input.js')
    await recalcAll()
  })
}
