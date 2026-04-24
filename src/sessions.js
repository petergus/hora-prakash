// src/sessions.js
// Per-session state: chart data snapshot + UI state for each tab.

import { state } from './state.js'

function genId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function emptySnap() {
  return { birth: null, planets: null, lagna: null, houses: null, dasha: null, panchang: null }
}

export function defaultDashaUI() {
  return {
    dashaCollapsed:  false,
    ageCollapsed:    true,
    progCollapsed:   true,
    selectedProgLord: null,
    ageNavCycle:     null,
    ageAsOf:         null,
    progNavIndex:    null,
    expandedMahas:   new Set(),          // Set<mahaName>
    expandedAntars:  new Map(),          // Map<mahaName, Set<antarName>>
    expandedPaths:   new Set(),          // Set<"maha/antar/prat"> for levels 3-4
    focusedMode:     true,
  }
}

export function defaultChartUI() {
  return {
    chartStyle:    'north',
    viewMode:      '1',
    divisional:    'D1',
    multiDivs:     ['D1','D9','D3','D10'],
    activeMultiTab: 0,
    tableDiv:      'D1',
    activePlanets:      new Set(),
    multiActivePlanets: [new Set(), new Set(), new Set(), new Set()],
  }
}

function currentInnerTab() {
  return document.querySelector('#tab-nav .tab-btn.active')?.dataset.tab ?? 'input'
}

let sessions = []
let activeId  = null

export function createSession(label = 'New Profile') {
  const id = genId()
  sessions.push({
    id,
    label,
    snap:    emptySnap(),
    innerTab: 'input',
    uiState: { dasha: defaultDashaUI(), chart: defaultChartUI() },
  })
  return id
}

export function getSessions()      { return sessions }
export function getActiveId()      { return activeId }
export function getActiveSession() { return sessions.find(s => s.id === activeId) ?? null }

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
  if (activeId === id) saveActiveSnapshot()
  sessions.splice(idx, 1)
  if (activeId === id) {
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
