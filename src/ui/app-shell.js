// src/ui/app-shell.js — sidebar + mobile drawer shell.
// Owns: the open-people list, global nav items, drawer behavior, and the
// sidebar footer (install / settings / account). The router calls setActive()
// and closeDrawer() after every route change.

import { getSessions, getActiveId, createSession, switchSession, closeSession, activeInnerTab } from '../sessions.js'
import { navigate, routeFor } from './router.js'
import { logout } from '../auth-ui.js'
import { openSettingsModal } from './settings-modal.js'

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))

const PERSON_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.5" r="2.8"/><path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg>`
const PEOPLE_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="5.5" r="2.4"/><path d="M1 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><circle cx="11.5" cy="5.5" r="2"/><path d="M12 9.6c1.8.4 3 1.8 3 3.9"/></svg>`
const COMPARE_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="5.5" height="10" rx="1"/><rect x="9" y="3" width="5.5" height="10" rx="1"/></svg>`
const PLUS_ICON   = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/></svg>`
const CLOSE_ICON  = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>`
const MENU_ICON   = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="5.5" x2="17" y2="5.5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14.5" x2="17" y2="14.5"/></svg>`
const GEAR_ICON   = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/></svg>`
const SIGNOUT_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6"/><path d="M10.5 11.5 14 8l-3.5-3.5"/><line x1="14" y1="8" x2="6" y2="8"/></svg>`

/** Wire the static shell chrome. Call once after auth. */
export function initShell(user) {
  // Icons for static buttons
  const drawerBtn = document.getElementById('btn-drawer')
  if (drawerBtn) drawerBtn.innerHTML = MENU_ICON
  const addBtn = document.getElementById('btn-new-session')
  if (addBtn) addBtn.innerHTML = PLUS_ICON
  document.querySelector('.side-item[data-nav="people"] .side-item-icon')?.insertAdjacentHTML('afterbegin', PEOPLE_ICON)
  document.querySelector('.side-item[data-nav="compare"] .side-item-icon')?.insertAdjacentHTML('afterbegin', COMPARE_ICON)

  // Drawer
  drawerBtn?.addEventListener('click', openDrawer)
  document.getElementById('drawer-scrim')?.addEventListener('click', closeDrawer)
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer() })

  // Global nav items
  document.getElementById('sidebar-global')?.addEventListener('click', e => {
    const item = e.target.closest('.side-item[data-nav]')
    if (item) navigate(routeFor(item.dataset.nav))
  })

  // New person
  addBtn?.addEventListener('click', () => {
    const id = createSession()
    switchSession(id)
    renderSidebar()
    navigate(routeFor('input', id))
  })

  // Footer: settings + account
  const footer = document.getElementById('sidebar-footer')
  if (footer) {
    footer.innerHTML = `
      <div id="sidebar-install-slot"></div>
      <button class="side-item" id="sidebar-settings" type="button">
        <span class="side-item-icon">${GEAR_ICON}</span>Settings
      </button>
      <div id="sidebar-account">
        <span class="sidebar-account-email" title="${esc(user?.email ?? '')}">${esc(user?.email ?? '')}</span>
        <button class="side-item" id="btn-logout" type="button">
          <span class="side-item-icon">${SIGNOUT_ICON}</span>Sign out
        </button>
      </div>`
    footer.querySelector('#sidebar-settings').addEventListener('click', () => { closeDrawer(); openSettingsModal() })
    footer.querySelector('#btn-logout').addEventListener('click', logout)
  }

  renderSidebar()
}

/** Render the open-people list. (Successor of profile-tabs' renderProfileTabs.) */
export function renderSidebar() {
  const list = document.getElementById('sidebar-people')
  if (!list) return

  const sessions = getSessions()
  const curId    = getActiveId()

  list.innerHTML = sessions.map(s => `
    <div class="side-person${s.id === curId ? ' active' : ''}" data-sid="${s.id}" role="button" tabindex="0" title="${esc(s.label)}">
      <span class="side-item-icon">${PERSON_ICON}</span>
      <span class="side-person-label">${esc(s.label)}</span>
      ${sessions.length > 1
        ? `<button class="side-person-close" data-close="${s.id}" title="Close" type="button" aria-label="Close ${esc(s.label)}">${CLOSE_ICON}</button>`
        : ''}
    </div>`).join('')

  list.onclick = e => {
    const closeEl = e.target.closest('[data-close]')
    if (closeEl) {
      closeSession(closeEl.dataset.close)
      renderSidebar()
      navigate(routeFor(activeInnerTab()), { replace: true })
      return
    }
    const item = e.target.closest('.side-person[data-sid]')
    if (item && item.dataset.sid !== getActiveId()) {
      const sid = item.dataset.sid
      switchSession(sid)
      renderSidebar()
      navigate(routeFor(activeInnerTab(), sid))
    }
  }
}

/** Router hook: highlight the routed person/page and update the topbar. */
export function setActive({ sid, page } = {}) {
  document.querySelectorAll('#sidebar-people .side-person').forEach(el =>
    el.classList.toggle('active', el.dataset.sid === sid))
  document.querySelectorAll('#sidebar-global .side-item').forEach(el =>
    el.classList.toggle('active', el.dataset.nav === page))

  const session = getSessions().find(s => s.id === sid)
  const isPerson = !['people', 'compare'].includes(page)

  // The person page-nav only makes sense inside a person workspace.
  document.getElementById('tab-nav')?.toggleAttribute('hidden', !isPerson)

  const person = document.getElementById('topbar-person')
  if (person) person.textContent = isPerson && session ? session.label : ''
}

export function openDrawer() {
  document.getElementById('app-sidebar')?.classList.add('open')
  document.getElementById('drawer-scrim')?.classList.add('open')
}

export function closeDrawer() {
  document.getElementById('app-sidebar')?.classList.remove('open')
  document.getElementById('drawer-scrim')?.classList.remove('open')
}
