// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa } from './core/settings.js'
import { initSettingsModal } from './ui/settings-modal.js'
import { createSession, switchSession } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'

// Register SW as early as possible so it can intercept the 12MB ephemeris fetch.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
}

async function main() {
  loadSettings()
  document.documentElement.dataset.theme =
    (JSON.parse(localStorage.getItem('hora-prakash-settings') || '{}').theme) || 'indigo'

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
