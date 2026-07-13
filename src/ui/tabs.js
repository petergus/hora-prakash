// src/ui/tabs.js — page-nav DOM helpers + gesture wiring.
// All page dispatch goes through the router (src/ui/router.js) and the page
// registry (src/ui/nav-registry.js); this module only owns the nav DOM.

import { PAGE_MAP, PERSON_PAGES } from './nav-registry.js'
import { getCurrentPage } from './nav-state.js'
import { state } from '../state.js'

export function initTabs() {
  document.getElementById('tab-nav').addEventListener('click', async e => {
    const btn = e.target.closest('.tab-btn')
    if (!btn || btn.disabled) return
    const { navigate, routeFor } = await import('./router.js')
    navigate(routeFor(btn.dataset.tab))
  })

  // Global swipe navigation between person pages (mobile).
  // "Hard swipe": must be fast, far, and clearly horizontal — not a scroll gesture.
  let swipeStartX = 0, swipeStartY = 0, swipeStartTime = 0, swipeCancelled = false

  // Returns true if el (or any ancestor up to <main>) can scroll horizontally.
  function insideHorizScrollable(el) {
    while (el && el.tagName !== 'MAIN') {
      if (el.scrollWidth > el.clientWidth + 4) return true
      el = el.parentElement
    }
    return false
  }

  const mainEl = document.querySelector('main')
  if (mainEl) {
    mainEl.addEventListener('touchstart', e => {
      const t = e.changedTouches[0]
      swipeStartX    = t.clientX
      swipeStartY    = t.clientY
      swipeStartTime = Date.now()
      swipeCancelled = insideHorizScrollable(e.target)
    }, { passive: true })

    // Cancel early if the gesture turns vertical before the finger lifts.
    mainEl.addEventListener('touchmove', e => {
      if (swipeCancelled) return
      const t  = e.changedTouches[0]
      const dx = Math.abs(t.clientX - swipeStartX)
      const dy = Math.abs(t.clientY - swipeStartY)
      // If vertical movement leads horizontal by more than 10 px, this is a scroll.
      if (dy > 10 && dy > dx) swipeCancelled = true
    }, { passive: true })

    mainEl.addEventListener('touchend', async e => {
      if (swipeCancelled) return
      const t   = e.changedTouches[0]
      const dx  = t.clientX - swipeStartX
      const adx = Math.abs(dx)
      const ady = Math.abs(t.clientY - swipeStartY)
      const ms  = Date.now() - swipeStartTime

      // Hard-swipe rules:
      //   • minimum 80 px horizontal travel
      //   • horizontal must be at least 2.5× the vertical (≈ 22° angle)
      //   • completed within 400 ms (deliberate swipe, not a slow drag)
      if (adx < 80 || ady > adx * 0.4 || ms > 400) return

      const idx = PERSON_PAGES.indexOf(getCurrentPage())
      if (idx === -1) return   // global pages (people/compare) don't swipe
      const next = PERSON_PAGES[dx < 0 ? idx + 1 : idx - 1]
      if (!next) return
      if (PAGE_MAP[next].requiresData && !state.planets) return

      const { navigate, routeFor } = await import('./router.js')
      navigate(routeFor(next))
    }, { passive: true })
  }
}

/** Toggle the active page-nav button + panel. Called by the router only. */
export function switchTab(name) {
  if (!name) return
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`))
}

/** Sync every page-nav button's disabled state with the active session's data. */
export function syncPageNav() {
  const hasData = !!state.planets
  document.querySelectorAll('#tab-nav .tab-btn').forEach(b => {
    const def = PAGE_MAP[b.dataset.tab]
    if (def) b.disabled = def.requiresData && !hasData
  })
}
