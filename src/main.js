// src/main.js
import { initTabs } from './ui/tabs.js'
import { initRouter, refresh as refreshRoute } from './ui/router.js'
import { initSwissEph } from './core/swisseph.js'
import { loadSettings, applyAyanamsa, getSettings } from './core/settings.js'
import { loadBranding } from './config/branding.js'
import { createSession, switchSession, loadPersistedSessions, getSessions, commitActive } from './sessions.js'
import { initShell, renderSidebar } from './ui/app-shell.js'
import { state } from './state.js'
import { updateFavicon } from './ui/favicon.js'
import { requireAuth, logout } from './auth-ui.js'
import { reconcileUserScope } from './user-scope.js'
import { initAuthz, onAccessChanged } from './core/authz.js'
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
  ;(document.getElementById('sidebar-install-slot') ?? document.body).appendChild(btn)
})

// Register SW as early as possible so it can intercept the 12MB ephemeris fetch.
// Production only: in dev the offline-first SW serves a stale cached build
// whenever the Vite server is down/restarting, hiding source changes.
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister()))
    .catch(() => {})
  if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
} else if ('serviceWorker' in navigator) {
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

  // Shared-browser hygiene: a different account than last time wipes that
  // account's local caches (settings included) before anything reads them.
  if (reconcileUserScope(user.uid)) {
    loadSettings()
    const wiped = getSettings().theme || 'crimson'
    document.documentElement.dataset.theme = wiped
    updateFavicon(wiped)
  }

  // Claims tracking: users/{uid}.claimsSyncedAt bumps force a token refresh so
  // plan/role changes land mid-session; a mid-session disable signs out.
  // Awaited (not fire-and-forget) so getAccess() is already correct by the
  // time initRouter() below evaluates the /buro adminOnly guard — otherwise a
  // superadmin deep-linking straight to #/buro on a fresh load could lose a
  // race against claims resolution and bounce to /people once, before the
  // reactive onAccessChanged listener (registered next) self-corrects it. For
  // an already-authenticated session this reads a locally cached token, so it
  // adds no network round trip — negligible cost for a deterministic guard.
  await initAuthz(user).catch(() => {})
  onAccessChanged(a => { if (a.status === 'disabled') logout() })

  // Pull profiles for this user from Firestore into localStorage so the existing
  // sync read paths (loadProfiles in input.js) stay working without refactor.
  try {
    const cloudProfiles = await fetchProfiles()
    localStorage.setItem(PROFILES_KEY, JSON.stringify(cloudProfiles))
  } catch (err) {
    console.error('Failed to load profiles from Firestore:', err)
  }

  // Show UI immediately — don't block on 12MB ephemeris download
  document.getElementById('app-loader')?.remove()
  document.getElementById('tab-input').style.display = ''

  initTabs()
  initShell(user)

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

  renderSidebar()
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
    // Snapshot + persist now so this session's freshly-computed chart survives
    // a subsequent reload even if we never switch away from it again.
    commitActive()
    renderSidebar()
  }
  for (const s of getSessions()) s.restoring = false

  // Return to the session that was active before the reload. The hash stays
  // the source of truth, so a reload keeps the user on the page they were on.
  const targetId = ids[persisted.activeIndex] ?? ids[0]
  switchSession(targetId)
  commitActive()   // switchSession early-returns when target is already active
  renderSidebar()
  await refreshRoute()
}

main()
