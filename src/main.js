// src/main.js
import { initTabs } from './ui/tabs.js'
import { initRouter, refresh as refreshRoute } from './ui/router.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa, getSettings } from './core/settings.js'
import { loadBranding } from './config/branding.js'
import { initSettingsModal } from './ui/settings-modal.js'
import { createSession, switchSession, loadPersistedSessions, getSessions } from './sessions.js'
import { renderProfileTabs } from './ui/profile-tabs.js'
import { state } from './state.js'
import { updateFavicon } from './ui/favicon.js'
import { requireAuth, logout } from './auth-ui.js'
import { fetchProfiles } from './cloud-store.js'

const PROFILES_KEY = 'hora-prakash-profiles'

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

  // Recreate profile tabs persisted from this browser tab (sessionStorage);
  // chart data is recalculated below once the ephemeris is ready. Persisted
  // ids are reused so #/p/<id>/… deep links survive the reload.
  const persisted = loadPersistedSessions()
  const entries = persisted?.entries ?? [{}]
  const ids = entries.map(e => createSession(e.label ?? 'New Profile', e.id || undefined))
  switchSession(ids[0])

  // Sessions that will be recalculated below get a `restoring` flag so the
  // router shows a placeholder instead of bouncing data-page routes to /edit.
  for (const s of getSessions()) {
    const entry = entries[ids.indexOf(s.id)]
    if (entry?.birth?.dob && entry?.birth?.tob) s.restoring = true
  }

  renderProfileTabs()
  initRouter()

  // Preload WASM in background; form submit will await it if still loading
  const sweReady = initSwissEph().then(() => applyAyanamsa())
  sweReady.catch(console.error)

  if (persisted) {
    restoreSessionData(persisted, ids, sweReady).catch(err =>
      console.error('Session restore failed:', err))
  }
}

// Recalculate charts for restored sessions (only birth inputs are persisted).
async function restoreSessionData(persisted, ids, sweReady) {
  const withBirth = persisted.entries
    .map((e, i) => ({ ...e, id: ids[i] }))
    .filter(e => e.birth?.dob && e.birth?.tob)
  if (!withBirth.length) return

  await sweReady
  const { recalcAll } = await import('./tabs/input.js')

  for (const entry of withBirth) {
    switchSession(entry.id)
    state.birth = entry.birth
    await recalcAll()
    const session = getSessions().find(s => s.id === entry.id)
    if (session) session.restoring = false
    renderProfileTabs()
  }
  for (const s of getSessions()) s.restoring = false

  // Return to the session that was active before the reload. The hash stays
  // the source of truth, so a reload keeps the user on the page they were on.
  const targetId = ids[persisted.activeIndex] ?? ids[0]
  switchSession(targetId)
  renderProfileTabs()
  await refreshRoute()
}

function installAuthHeader(user) {
  const header = document.querySelector('header')
  if (!header || header.querySelector('#auth-status')) return
  const wrap = document.createElement('div')
  wrap.id = 'auth-status'
  wrap.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--muted,#94a3b8)'

  const emailSpan = document.createElement('span')
  emailSpan.title = user.email
  emailSpan.textContent = user.email
  emailSpan.style.cssText = 'max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'

  const logoutBtn = document.createElement('button')
  logoutBtn.type = 'button'
  logoutBtn.id = 'btn-logout'
  logoutBtn.className = 'btn-secondary'
  logoutBtn.style.cssText = 'padding:0.2rem 0.55rem;font-size:0.75rem'
  logoutBtn.textContent = 'Sign out'
  logoutBtn.addEventListener('click', logout)

  wrap.appendChild(emailSpan)
  wrap.appendChild(logoutBtn)

  header.style.display = header.style.display || 'flex'
  header.style.alignItems = 'center'
  header.appendChild(wrap)
}

main()
