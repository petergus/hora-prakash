// src/user-scope.js — keeps this browser's caches from leaking across accounts.
//
// localStorage/sessionStorage are per-browser; the app is per-account. Two
// hygiene moments:
//  • Sign-in by a DIFFERENT account than last time → wipe everything
//    user-scoped (personal data AND preferences) so user B never sees user A's
//    leftovers on a shared machine.
//  • Sign-out → wipe personal data and the BYOK key (a spending credential),
//    but KEEP preferences (theme, ayanamsa, presets) — the common solo-user
//    case shouldn't lose its setup by logging out.
//
// ⚠️ When adding a user-scoped localStorage key anywhere in the app, add it to
// PERSONAL_KEYS or PREFERENCE_KEYS below, or it leaks to the next account.

const LAST_UID_KEY = 'hora-prakash-last-uid'
const SESSIONS_KEY = 'hora-prakash-sessions'   // sessionStorage: open person tabs

/** Account data + personal traces — cleared on sign-out AND account switch. */
export const PERSONAL_KEYS = [
  'hora-prakash-profiles',        // Firestore mirror (main.js / profile-store.js)
  'hora-prakash-sessions',        // open person tabs (sessions.js)
  'hora-prakash-ai-key',          // BYOK Anthropic key (ai.js)
  'hora-prakash-location-cache',  // geocoding lookups (location-cache.js)
  'hora-prakash-today-location',  // Panchang "today" location (panchang.js)
]

/** Preferences/config — cleared only when a DIFFERENT account signs in. */
export const PREFERENCE_KEYS = [
  'hora-prakash-settings',
  'hora-prakash-export-presets',
  'hora-prakash-export-active-preset',
  'hora-prakash-people-columns',
  'hora-prakash-people-sort',
]

function drop(keys) {
  for (const k of keys) { try { localStorage.removeItem(k) } catch { /* storage unavailable */ } }
}
function dropSessions() {
  try {
    sessionStorage.removeItem(SESSIONS_KEY)
    localStorage.removeItem(SESSIONS_KEY)
  } catch { /* storage unavailable */ }
}

/**
 * Call right after sign-in, BEFORE anything reads the caches. Returns true when
 * they were wiped because the account changed — the caller must then re-load
 * settings/theme. A missing marker (pre-feature browser) grandfathers the
 * current caches to the signing-in user.
 */
export function reconcileUserScope(uid) {
  let last = null
  try { last = localStorage.getItem(LAST_UID_KEY) } catch { /* storage unavailable */ }
  try { localStorage.setItem(LAST_UID_KEY, uid) } catch { /* storage unavailable */ }
  if (!last || last === uid) return false
  drop(PERSONAL_KEYS)
  drop(PREFERENCE_KEYS)
  dropSessions()
  return true
}

/** Call on explicit sign-out, before the reload. */
export function clearPersonalCaches() {
  drop(PERSONAL_KEYS)
  dropSessions()
}
