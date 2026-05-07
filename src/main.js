// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa, getSettings } from './core/settings.js'
import { loadBranding } from './config/branding.js'
import { initSettingsModal } from './ui/settings-modal.js'
import { createSession, switchSession } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'
import { updateFavicon } from './ui/favicon.js'

// Capture install prompt and show install button when available.
let _installPrompt = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  _installPrompt = e
  if (document.getElementById('btn-install')) return
  const btn = document.createElement('button')
  btn.id = 'btn-install'
  btn.textContent = '⬇ Install App'
  btn.onclick = async () => {
    if (!_installPrompt) return
    _installPrompt.prompt()
    const { outcome } = await _installPrompt.userChoice
    if (outcome === 'accepted') btn.remove()
    _installPrompt = null
  }
  document.querySelector('header')?.appendChild(btn)
})

// Register SW as early as possible so it can intercept the 12MB ephemeris fetch.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'SW_UPDATED') return
    if (document.getElementById('update-banner')) return  // already shown
    const banner = document.createElement('div')
    banner.id = 'update-banner'
    banner.textContent = 'App updated. '
    const btn = document.createElement('button')
    btn.textContent = 'Reload'
    btn.onclick = () => location.reload()
    banner.appendChild(btn)
    document.body.prepend(banner)
  })
}

async function main() {
  loadSettings()
  const theme = getSettings().theme || 'crimson'
  document.documentElement.dataset.theme = theme
  updateFavicon(theme)
  await loadBranding()

  // Show UI immediately — don't block on 12MB ephemeris download
  document.getElementById('app-loader')?.remove()
  document.getElementById('tab-input').style.display = ''

  initTabs()
  initSettingsModal()

  const id = createSession()
  switchSession(id)
  renderProfileTabs()
  renderInputTab()

  // Preload WASM in background; form submit will await it if still loading
  initSwissEph().then(() => applyAyanamsa()).catch(console.error)
}

main()
