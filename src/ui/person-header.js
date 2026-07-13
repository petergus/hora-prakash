// src/ui/person-header.js — the workspace person header: avatar, name, birth
// pills, privacy toggle and Edit shortcut. Rendered by app-shell.setActive()
// on every route change; single source of truth for the privacy mask.

import { state } from '../state.js'
import { getCurrent } from './nav-state.js'

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))

const MASK = '••••••••'
const EYE_OPEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`
const EYE_SHUT = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`
const EDIT_ICON = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5a1.7 1.7 0 0 1 2.4 2.4L5 13.8l-3.2.8.8-3.2z"/></svg>`

let privacyOn = false   // global UI pref, not per-session
export const isPrivacyOn = () => privacyOn

/** Fill #person-header for the current route; hides itself on global pages. */
export function renderPersonHeader() {
  const el = document.getElementById('person-header')
  if (!el) return

  const { page } = getCurrent()
  const isPerson = !['people', 'compare'].includes(page)
  const birth = state.birth
  if (!isPerson || !birth || !(birth.name || birth.dob)) {
    el.hidden = true
    el.innerHTML = ''
    return
  }

  const name  = birth.name ?? ''
  const place = (() => { const s = birth.location || ''; return s.length > 34 ? s.slice(0, 33).trimEnd() + '…' : s })()
  const coords = (birth.lat != null && birth.lon != null)
    ? `${Math.abs(birth.lat).toFixed(2)}°${birth.lat >= 0 ? 'N' : 'S'} ${Math.abs(birth.lon).toFixed(2)}°${birth.lon >= 0 ? 'E' : 'W'}`
    : ''
  const init = name ? name.trim()[0].toUpperCase() : '?'

  el.hidden = false
  el.innerHTML = privacyOn
    ? `<div class="tbc-avatar">?</div>
       <div class="tbc-name">${MASK}</div>
       <div class="person-header-actions">
         <button id="ph-privacy" class="btn btn-ghost btn-icon" title="Show details" type="button">${EYE_SHUT}</button>
       </div>`
    : `<div class="tbc-avatar">${esc(init)}</div>
       <div class="tbc-name">${esc(name)}</div>
       <div class="tbc-divider"></div>
       ${place      ? `<div class="tbc-pill"><span class="tbc-icon">📍</span><span>${esc(place)}</span></div>` : ''}
       ${coords     ? `<div class="tbc-pill"><span class="tbc-icon">🌐</span><span>${coords}</span></div>` : ''}
       ${birth.dob  ? `<div class="tbc-pill"><span class="tbc-icon">📅</span><span>${esc(birth.dob)}</span></div>` : ''}
       ${birth.tob  ? `<div class="tbc-pill"><span class="tbc-icon">🕐</span><span>${esc(birth.tob)}</span></div>` : ''}
       <div class="person-header-actions">
         <button id="ph-privacy" class="btn btn-ghost btn-icon" title="Hide details" type="button">${EYE_OPEN}</button>
         <button id="ph-edit" class="btn btn-ghost btn-icon" title="Edit birth details" type="button">${EDIT_ICON}</button>
       </div>`

  el.querySelector('#ph-privacy')?.addEventListener('click', async () => {
    privacyOn = !privacyOn
    renderPersonHeader()
    const { refresh } = await import('./router.js')
    refresh()   // pages (e.g. chart title) re-render with the mask applied
  })
  el.querySelector('#ph-edit')?.addEventListener('click', async () => {
    const { navigate, routeFor } = await import('./router.js')
    navigate(routeFor('input'))
  })
}
