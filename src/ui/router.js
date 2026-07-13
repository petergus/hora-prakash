// src/ui/router.js — hash router. The URL hash is the source of truth for
// which person (session) and page are active.
//
// Routes:
//   #/p/<sid>/<page>   person workspace (page: chart|dasha|transit|panchang|
//                      strength|export|edit — 'edit' aliases the input page)
//   #/p/<sid>          → redirect to /chart (or /edit when no chart data)
//   #/people #/compare global pages
//   anything else      → active session's /chart or /edit

import { PAGE_MAP, ROUTE_ALIAS, SEGMENT_FOR, renderPage } from './nav-registry.js'
import { _setCurrent } from './nav-state.js'
import { getSessions, getActiveId, switchSession } from '../sessions.js'
import { state } from '../state.js'
import { switchTab, syncPageNav } from './tabs.js'

let _navToken = 0

export function routeFor(page, sid = getActiveId()) {
  if (PAGE_MAP[page]?.scope === 'global') return `#/${page}`
  return `#/p/${sid}/${SEGMENT_FOR[page] ?? page}`
}

export function navigate(hash, { replace = false } = {}) {
  if (location.hash === hash) return handleRoute()   // re-render current page
  if (replace) {
    history.replaceState(null, '', hash)
    return handleRoute()
  }
  location.hash = hash                               // → hashchange → handleRoute
}

/** Re-run the current route (e.g. after async session restore). */
export function refresh() { return handleRoute() }

/**
 * Record a route for a page the caller has rendered (or will render) itself —
 * updates the hash, nav state, panel visibility and page-nav enablement
 * WITHOUT dispatching a render. For flows like "open edit form and fill it".
 */
export function markRoute(page, sid = getActiveId()) {
  history.replaceState(null, '', routeFor(page, sid))
  _setCurrent(page, sid)
  syncPageNav()
  switchTab(page)
  syncShell(sid, page)
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute)
  return handleRoute()
}

async function handleRoute() {
  const token = ++_navToken
  const seg = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)

  let sid = null
  let page = null
  if (seg[0] === 'p') {
    sid = seg[1]
    page = ROUTE_ALIAS[seg[2]] ?? seg[2] ?? null
    if (!getSessions().some(s => s.id === sid)) sid = getActiveId()  // stale/foreign id
    if (page && !PAGE_MAP[page]) page = null
  } else if (PAGE_MAP[seg[0]]?.scope === 'global') {
    page = seg[0]
    sid = getActiveId()
  }
  if (!sid) sid = getActiveId()

  // Switch person first so data guards see the right session's state.
  if (sid !== getActiveId()) switchSession(sid)
  const session = getSessions().find(s => s.id === sid) ?? null

  if (!page) page = state.planets ? 'chart' : 'input'

  // Guard: data pages need a computed chart. While a reload-restore is still
  // recalculating, stay on the requested page and show a placeholder instead
  // of bouncing the user to the edit form.
  const restoring = !!session?.restoring
  if (PAGE_MAP[page].requiresData && !state.planets && !restoring) page = 'input'

  const canonical = routeFor(page, sid)
  if (location.hash !== canonical) history.replaceState(null, '', canonical)

  _setCurrent(page, sid)
  syncPageNav()
  switchTab(page)
  syncShell(sid, page)

  if (PAGE_MAP[page].requiresData && !state.planets && restoring) {
    renderRestorePlaceholder(page)
    return
  }
  await renderPage(page)
  if (token !== _navToken) return   // superseded by a newer navigation
}

// The app shell (sidebar) exists from Phase 3 on; tolerate its absence.
async function syncShell(sid, page) {
  try {
    const shell = await import('./app-shell.js')
    shell.setActive?.({ sid, page })
    shell.closeDrawer?.()
  } catch { /* shell not present yet */ }
}

function renderRestorePlaceholder(page) {
  const panel = document.getElementById(`tab-${page}`)
  if (!panel) return
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:40vh;gap:1rem">
      <div class="app-spinner"></div>
      <span style="color:var(--muted);font-size:var(--fs-base)">Calculating chart…</span>
    </div>`
}
