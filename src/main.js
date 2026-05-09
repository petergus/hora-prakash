// src/main.js
import { initTabs } from './ui/tabs.js'
import { renderInputTab } from './tabs/input.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa, getSettings } from './core/settings.js'
import { loadBranding } from './config/branding.js'
import { initSettingsModal } from './ui/settings-modal.js'
import { createSession, switchSession } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'
import { requireAuth, logout } from './auth-ui.js'
import { fetchProfiles } from './cloud-store.js'

const PROFILES_KEY = 'hora-prakash-profiles'

// Register SW as early as possible so it can intercept the 12MB ephemeris fetch.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
}

async function main() {
  loadSettings()
  document.documentElement.dataset.theme = getSettings().theme || 'indigo'
  await loadBranding()

  // Block the app behind authentication. Nothing — profiles, charts — is shown until signed in.
  const user = await requireAuth()

  // Pull profiles for this user from Firestore into localStorage so the existing
  // sync read paths (loadProfiles in input.js) stay working without refactor.
  try {
    const cloudProfiles = await fetchProfiles()
    localStorage.setItem(PROFILES_KEY, JSON.stringify(cloudProfiles))
  } catch (err) {
    console.error('Failed to load profiles from Firestore:', err)
  }

  installAuthHeader(user)

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

function installAuthHeader(user) {
  const header = document.querySelector('header')
  if (!header || header.querySelector('#auth-status')) return
  const wrap = document.createElement('div')
  wrap.id = 'auth-status'
  wrap.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--muted,#94a3b8)'
  wrap.innerHTML = `
    <span title="${user.email}" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.email}</span>
    <button type="button" id="btn-logout" class="btn-secondary" style="padding:0.2rem 0.55rem;font-size:0.75rem">Sign out</button>
  `
  header.style.display = header.style.display || 'flex'
  header.style.alignItems = 'center'
  header.appendChild(wrap)
  wrap.querySelector('#btn-logout').addEventListener('click', logout)
}

main()
