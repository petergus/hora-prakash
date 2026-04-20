// src/sessions.js
// Manages multiple open profile sessions, each with isolated state snapshots.

import { state } from './state.js'

function genId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function emptySnap() {
  return { birth: null, planets: null, lagna: null, houses: null, dasha: null, panchang: null }
}

function currentInnerTab() {
  return document.querySelector('#tab-nav .tab-btn.active')?.dataset.tab ?? 'input'
}

let sessions = []
let activeId  = null

export function createSession(label = 'New Profile') {
  const id = genId()
  sessions.push({ id, label, snap: emptySnap(), innerTab: 'input' })
  return id
}

export function getSessions() { return sessions }
export function getActiveId() { return activeId }

export function getActiveSession() {
  return sessions.find(s => s.id === activeId) ?? null
}

function saveActiveSnapshot() {
  const cur = sessions.find(s => s.id === activeId)
  if (!cur) return
  cur.snap = { birth: state.birth, planets: state.planets, lagna: state.lagna,
               houses: state.houses, dasha: state.dasha, panchang: state.panchang }
  cur.innerTab = currentInnerTab()
}

export function switchSession(id) {
  if (id === activeId) return
  saveActiveSnapshot()
  activeId = id
  const next = sessions.find(s => s.id === id)
  if (!next) return
  Object.assign(state, next.snap)
}

export function closeSession(id) {
  const idx = sessions.findIndex(s => s.id === id)
  if (idx < 0) return
  sessions.splice(idx, 1)
  if (activeId === id) {
    // Switch to the tab to the left, or the first remaining
    const newIdx = Math.max(0, idx - 1)
    activeId = sessions[newIdx]?.id ?? null
    if (activeId) Object.assign(state, sessions[newIdx].snap)
    else Object.assign(state, emptySnap())
  }
}

export function updateActiveLabel(label) {
  const s = sessions.find(s => s.id === activeId)
  if (s) s.label = label
}

export function activeInnerTab() {
  return sessions.find(s => s.id === activeId)?.innerTab ?? 'input'
}
