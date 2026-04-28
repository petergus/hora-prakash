// src/ui/profile-tabs.js
import { getSessions, getActiveId, createSession, switchSession, closeSession, activeInnerTab } from '../sessions.js'
import { state } from '../state.js'
import { switchTab, enableTab } from './tabs.js'
import { renderChart } from '../tabs/chart.js'
import { renderDasha } from '../tabs/dasha.js'
import { renderPanchang } from '../tabs/panchang.js'
import { renderInputTab } from '../tabs/input.js'

const PERSON_ICON = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.5" r="2.8"/><path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg>`
const PLUS_ICON   = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/></svg>`
const CLOSE_ICON  = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>`

export function activateInnerTab(tab) {
  const hasData = !!state.planets
  // Sync disabled state of content tabs with session data availability
  ;['chart','dasha','panchang'].forEach(t => {
    const btn = document.querySelector(`.tab-btn[data-tab="${t}"]`)
    if (!btn) return
    btn.disabled = !hasData
  })
  if (!hasData) tab = 'input'
  switchTab(tab)
  if (tab === 'chart')         renderChart()
  else if (tab === 'dasha')    renderDasha().catch(console.error)
  else if (tab === 'panchang') renderPanchang()
  else                         renderInputTab()
}

export function renderProfileTabs() {
  const bar = document.getElementById('profile-tab-bar')
  if (!bar) return

  const sessions = getSessions()
  const curId    = getActiveId()

  bar.innerHTML = `<div class="ptab-scroll">
    ${sessions.map(s => `
      <button class="ptab${s.id === curId ? ' active' : ''}" data-sid="${s.id}" title="${s.label}">
        <span class="ptab-icon">${PERSON_ICON}</span>
        <span class="ptab-label">${s.label}</span>
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
      activateInnerTab(activeInnerTab())
      return
    }

    // New +
    if (e.target.closest('#btn-new-session')) {
      const id = createSession()
      switchSession(id)
      renderProfileTabs()
      activateInnerTab('input')
      return
    }

    // Switch profile tab
    const ptab = e.target.closest('.ptab[data-sid]')
    if (ptab && ptab.dataset.sid !== getActiveId()) {
      switchSession(ptab.dataset.sid)
      renderProfileTabs()
      activateInnerTab(activeInnerTab())
    }
  }
}
