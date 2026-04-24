// src/ui/settings-modal.js
import { getSettings, saveSettings, applyAyanamsa, AYANAMSA_OPTIONS } from '../core/settings.js'

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
    <div style="background:var(--card-bg,#1e1e2e);border:1px solid var(--border,#333);border-radius:8px;padding:1.5rem;min-width:280px;max-width:360px;width:90%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem">
        <h3 style="margin:0;font-size:0.9rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">⚙ Calculation Settings</h3>
        <button id="settings-close" type="button" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--muted);padding:0 0.3rem">✕</button>
      </div>
      <div class="form-group" style="margin-bottom:1.2rem">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.85rem;color:var(--muted)">Ayanamsa</label>
        <select id="settings-ayanamsa" style="width:100%">
          ${AYANAMSA_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
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
    overlay.style.display = 'flex'
    document.getElementById('settings-ayanamsa').value = String(getSettings().ayanamsa)
  })

  document.getElementById('settings-close').addEventListener('click', close)
  document.getElementById('settings-cancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  document.getElementById('settings-apply').addEventListener('click', async () => {
    const ayanamsa = parseInt(document.getElementById('settings-ayanamsa').value, 10)
    saveSettings({ ayanamsa })
    close()
    const { recalcAll } = await import('../tabs/input.js')
    await recalcAll()
  })
}
