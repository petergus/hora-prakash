// src/ui/nav-state.js — current navigation state ({ page, sid }).
// Pure module: NO DOM access at import time or in these functions.
// sessions.js imports this, and sessions.js is reachable from the Node test
// suites via src/tabs/export.js — keep it Node-safe.

let current = { page: 'input', sid: null }

export function getCurrentPage() { return current.page }
export function getCurrent()     { return { ...current } }

/** Router-internal: record the routed page/session. */
export function _setCurrent(page, sid) { current = { page, sid } }
