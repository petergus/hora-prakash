// src/sessions.js
// Per-session state: chart data snapshot + UI state for each tab.

import { state } from './state.js'
import { PERSON_PAGES } from './ui/nav-registry.js'

function genId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function emptySnap() {
  return { birth: null, planets: null, lagna: null, houses: null, sripatiHouses: null,
           dasha: null, panchang: null, strength: null }
}

export function defaultDashaUI() {
  const mobile = window.innerWidth < 600
  return {
    dashaCollapsed:  false,
    sadesatiCollapsed: mobile,
    ageCollapsed:    mobile,
    progCollapsed:   mobile,
    selectedProgLord: null,
    ageNavCycle:     null,
    ageAsOf:         null,
    progNavIndex:    null,
    expandedMahas:   new Set(),          // Set<mahaName>
    expandedAntars:  new Map(),          // Map<mahaName, Set<antarName>>
    expandedPaths:   new Set(),          // Set<"maha/antar/prat"> for levels 3-4
    focusedMode:     true,
    focusedPath:     null,
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
    showDasha:      false,
    dashaCards:     ['vimshottari'],
    splitRatio:     0.40,
    mobileDashaTab: 'chart',
    chartDasha:     null,
    fromHouseSign:  null,
    chalitMethod:   'equal',
    collapsedTables: {},
    sortCol:        null,
    sortDir:        'asc',
  }
}

export function defaultTimelineUI() {
  return {
    view:   'lanes',   // 'lanes' | 'spiral'
    fromMs: null,      // window start (ms); null → whole life
    toMs:   null,      // window end (ms);   null → whole life
  }
}

export function defaultReadingUI() {
  return {
    subTab:  'overview',   // 'overview' | 'ai' | 'ask'
    aiText:  null,         // last generated AI reading (in-session cache)
    aiBusy:  false,
    chat:    [],           // [{ role: 'user'|'assistant', text }] for display
    chatApi: [],           // the API message array (carries tool_use/tool_result blocks)
    chatBusy: false,
  }
}

export function defaultCalendarUI() {
  return {
    month:        null,                 // "YYYY-MM"; null → the current month
    selectedDay:  null,                 // "YYYY-MM-DD"
    filters:      null,                 // Set<eventType>; null → all (filled on first render)
    muhurtaActivity: 'marriage',
    muhurtaFrom:  null,
    muhurtaTo:    null,
    muhurtaResult: null,
  }
}

export function defaultTransitUI() {
  return {
    transitDate: null,
    transitTime: null,
    transitPlanets: [],
    transitLagna: null,
    transitFilter: new Set(['Su','Mo','Ma','Me','Ju','Ve','Sa','Ra','Ke']),
    transitView: 'dual',
    transitChartStyle: 'north',
    natalAspectSource: new Set(),
    transitAspectSource: new Set(),
    overlayNatalAspectSource: new Set(),
    overlayTransitAspectSource: new Set(),
    dualActiveTab: 'natal',
    chartZoom: 2,
    showTooltip: false,
    transitDivisional: 'D1',
    aspectToHouse: null,
  }
}

let sessions = []
let activeId  = null

// ── Persistence across reloads ────────────────────────────────────────────────
// Full snapshots contain Dates, Sets and WASM-derived trees — too lossy to
// serialize. Persist only the birth inputs + labels; main.js recalculates
// each restored session once SwissEph is ready.
const PERSIST_KEY = 'hora-prakash-sessions'

export function persistSessions() {
  try {
    const entries = sessions.map(s => ({
      id: s.id,   // stable across reloads so #/p/<id>/… deep links survive
      label: s.label,
      // Active session: state is the source of truth (its snap may be stale).
      // Fall back to the snap so a momentarily-null state.birth can't wipe a
      // persisted chart (e.g. mid-restore, before state.birth is re-assigned).
      birth: s.id === activeId ? (state.birth ?? s.snap.birth) : s.snap.birth,
    }))
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify({ entries, activeIndex: sessions.findIndex(s => s.id === activeId) }))
  } catch { /* storage full / unavailable — persistence is best-effort */ }
}

/** @returns {{ entries: {label, birth}[], activeIndex: number } | null} */
export function loadPersistedSessions() {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data.entries) || data.entries.length === 0) return null
    return data
  } catch {
    return null
  }
}

export function createSession(label = 'New Profile', id = genId()) {
  sessions.push({
    id,
    label,
    snap:    emptySnap(),
    innerTab: 'input',
    uiState: { dasha: defaultDashaUI(), chart: defaultChartUI(), transit: defaultTransitUI(),
               calendar: defaultCalendarUI(), reading: defaultReadingUI(), timeline: defaultTimelineUI() },
  })
  persistSessions()
  return id
}

export function getSessions()      { return sessions }
export function getActiveId()      { return activeId }
export function getActiveSession() { return sessions.find(s => s.id === activeId) ?? null }

function saveActiveSnapshot() {
  const cur = sessions.find(s => s.id === activeId)
  if (!cur) return
  cur.snap = { birth: state.birth, planets: state.planets, lagna: state.lagna,
               houses: state.houses, sripatiHouses: state.sripatiHouses,
               dasha: state.dasha, panchang: state.panchang, strength: state.strength }
}

/**
 * Record the person page a session is on — its re-entry point when you click it
 * in the sidebar. The router calls this on every route, so it stays current
 * (a snapshot-time read would lag by one switch). Global pages (people/compare)
 * are ignored: they are not somewhere a person tab can re-enter, and storing one
 * here would make routeFor() send the click to the global page instead.
 */
export function setSessionInnerTab(sid, page) {
  if (!PERSON_PAGES.includes(page)) return
  const s = sessions.find(x => x.id === sid)
  if (s) s.innerTab = page
}

/**
 * Snapshot the active session's live state and persist. Call after computing a
 * chart into the active session outside of a switch (e.g. reload-restore), so
 * its snap + the persisted birth reflect the freshly-computed data — otherwise
 * the snapshot only happens on the next switchSession, and switching to a
 * session that's already active early-returns without ever saving it.
 */
export function commitActive() {
  saveActiveSnapshot()
  persistSessions()
}

/** The open session whose loaded birth record came from this saved profile, or null. */
export function findSessionByProfileId(pid) {
  if (!pid) return null
  return sessions.find(s =>
    (s.id === activeId ? state.birth?.profileId : s.snap.birth?.profileId) === pid) ?? null
}

export function switchSession(id) {
  if (id === activeId) return
  saveActiveSnapshot()
  activeId = id
  const next = sessions.find(s => s.id === id)
  if (!next) return
  Object.assign(state, next.snap)
  persistSessions()
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
  persistSessions()
}

export function updateActiveLabel(label) {
  const s = sessions.find(s => s.id === activeId)
  if (s) s.label = label
  persistSessions()
}

export function activeInnerTab() {
  return sessions.find(s => s.id === activeId)?.innerTab ?? 'input'
}
