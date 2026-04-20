// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'
import { createSession, switchSession } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'

async function main() {
  await initSwissEph()
  initTabs()

  // Bootstrap first session
  const id = createSession()
  switchSession(id)
  renderProfileTabs()

  renderInputTab()
}

main()
