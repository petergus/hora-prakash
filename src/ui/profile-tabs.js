// src/ui/profile-tabs.js — open-people tab strip (becomes the sidebar list in
// the app shell). All page dispatch goes through the router.
import { getSessions, getActiveId, createSession, switchSession, closeSession, activeInnerTab } from '../sessions.js'
import { navigate, routeFor } from './router.js'

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))

const PERSON_ICON = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.5" r="2.8"/><path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg>`
const PLUS_ICON   = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/></svg>`
const CLOSE_ICON  = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>`

export function renderProfileTabs() {
  const bar = document.getElementById('profile-tab-bar')
  if (!bar) return

  const sessions = getSessions()
  const curId    = getActiveId()

  bar.innerHTML = `<div class="ptab-scroll">
    ${sessions.map(s => `
      <button class="ptab${s.id === curId ? ' active' : ''}" data-sid="${s.id}" title="${esc(s.label)}">
        <span class="ptab-icon">${PERSON_ICON}</span>
        <span class="ptab-label">${esc(s.label)}</span>
        ${sessions.length > 1
          ? `<span class="ptab-close" data-close="${s.id}" title="Close">${CLOSE_ICON}</span>`
          : ''}
      </button>`).join('')}
    <button class="ptab-new" id="btn-new-session" title="Open new profile">${PLUS_ICON}</button>
  </div>`

  // ── Event handling ──
  bar.onclick = e => {
    // Close ×
    const closeEl = e.target.closest('[data-close]')
    if (closeEl) {
      closeSession(closeEl.dataset.close)
      renderProfileTabs()
      navigate(routeFor(activeInnerTab()), { replace: true })
      return
    }

    // New +
    if (e.target.closest('#btn-new-session')) {
      const id = createSession()
      switchSession(id)
      renderProfileTabs()
      navigate(routeFor('input', id))
      return
    }

    // Switch profile tab — deep-link to the page that person last had open.
    const ptab = e.target.closest('.ptab[data-sid]')
    if (ptab && ptab.dataset.sid !== getActiveId()) {
      const sid = ptab.dataset.sid
      switchSession(sid)
      renderProfileTabs()
      navigate(routeFor(activeInnerTab(), sid))
    }
  }
}
