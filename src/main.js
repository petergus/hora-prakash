// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa } from './core/settings.js'
import { initSettingsModal } from './ui/settings-modal.js'
import { createSession, switchSession } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'

async function main() {
  loadSettings()

  // Show UI immediately — WASM loads in background
  document.getElementById('app-loader')?.remove()
  document.getElementById('tab-input').style.display = ''

  initTabs()
  initSettingsModal()

  const id = createSession()
  switchSession(id)
  renderProfileTabs()
  renderInputTab()

  // Kick off WASM init in background so it's ready by the time user submits
  initSwissEph().then(() => applyAyanamsa()).catch(console.error)
}

main()
