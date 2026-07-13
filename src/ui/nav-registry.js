// src/ui/nav-registry.js — single source of truth for the app's pages.
// Replaces the previously triplicated tab-dispatch chains (tabs.js click,
// tabs.js swipe, profile-tabs.js activateInnerTab) and TAB_ORDER.
//
// Page ids keep the legacy tab names (input, people, chart, ...) so panel ids
// (#tab-input) and data-tab attributes never change. Route segments may alias
// (#/p/<sid>/edit → page 'input').

export const PAGE_MAP = {
  input:    { label: 'Birth Details', scope: 'person', requiresData: false,
              render: () => import('../tabs/input.js').then(m => m.renderInputTab()) },
  chart:    { label: 'Chart',    scope: 'person', requiresData: true,
              render: () => import('../tabs/chart.js').then(m => m.renderChart()) },
  dasha:    { label: 'Dasha',    scope: 'person', requiresData: true,
              render: () => import('../tabs/dasha.js').then(m => m.renderDasha()) },
  transit:  { label: 'Transit',  scope: 'person', requiresData: true,
              render: () => import('../tabs/transit.js').then(m => m.renderTransit()) },
  panchang: { label: 'Panchang', scope: 'person', requiresData: true,
              render: () => import('../tabs/panchang.js').then(m => m.renderPanchang()) },
  strength: { label: 'Strength', scope: 'person', requiresData: true,
              render: () => import('../tabs/strength.js').then(m => m.renderStrength()) },
  export:   { label: 'Export',   scope: 'person', requiresData: true,
              render: () => import('../tabs/export.js').then(m => m.renderExport()) },
  people:   { label: 'People',   scope: 'global', requiresData: false,
              render: () => import('../tabs/people.js').then(m => m.renderPeople()) },
  compare:  { label: 'Compare',  scope: 'global', requiresData: true,
              render: () => import('../tabs/compare.js').then(m => m.renderCompare()) },
}

/** Person pages in visual/swipe order. */
export const PERSON_PAGES = ['input', 'chart', 'dasha', 'transit', 'panchang', 'strength', 'export']

/** Route segment → page id (and back). */
export const ROUTE_ALIAS = { edit: 'input' }
export const SEGMENT_FOR = { input: 'edit' }

export async function renderPage(id) {
  const def = PAGE_MAP[id]
  if (!def) return
  try {
    await def.render()
  } catch (err) {
    console.error(`Failed to render page "${id}":`, err)
  }
}
