// src/core/authz.js — who the signed-in user is allowed to be.
//
// The users/{uid} Firestore document is the single authority on role / plan /
// status (written only by Cloud Functions); custom claims mirror it into every
// ID token. This module parses those claims into an `access` object and keeps
// it fresh: it watches the doc's `claimsSyncedAt` field and force-refreshes the
// token when a function bumps it, so plan/role/status changes reach a live
// session in seconds instead of the ~1 h token lifetime.
//
// `accessFrom` is pure and Node-tested (tests/authz.test.mjs); only `initAuthz`
// touches Firebase, via lazy import — the same pattern ai.js uses to stay in
// the Node test graph.

export const DEFAULT_ACCESS = Object.freeze({
  role: 'user', plan: 'free', status: 'active', verified: false,
})

/** Parse token claims (+ the Auth emailVerified flag) into an access object. */
export function accessFrom(claims, { emailVerified = false } = {}) {
  const c = claims || {}
  return {
    role:     c.role === 'superadmin' ? 'superadmin' : 'user',
    plan:     typeof c.plan === 'string' && c.plan ? c.plan : 'free',
    status:   c.status === 'disabled' ? 'disabled' : 'active',
    verified: !!emailVerified,
  }
}

export function isSuperAdmin(a = getAccess()) { return a.role === 'superadmin' }
export function isDisabled(a = getAccess())   { return a.status === 'disabled' }

// ── live state ───────────────────────────────────────────────────────────────

let _access = { ...DEFAULT_ACCESS }
const _listeners = new Set()

export function getAccess() { return { ..._access } }

/** Subscribe to access changes (plan upgrade, disable). Returns unsubscribe. */
export function onAccessChanged(cb) { _listeners.add(cb); return () => _listeners.delete(cb) }

function _set(access) {
  const changed = JSON.stringify(access) !== JSON.stringify(_access)
  _access = access
  if (changed) for (const cb of _listeners) { try { cb(getAccess()) } catch { /* listener error */ } }
}

/**
 * Start claims tracking for the signed-in user (call once after requireAuth).
 * Reads the current token's claims, then watches users/{uid}.claimsSyncedAt —
 * every bump means a Cloud Function changed this user's claims.
 */
export async function initAuthz(user) {
  const t = await user.getIdTokenResult()
  _set(accessFrom(t.claims, { emailVerified: user.emailVerified }))
  const tokenHadClaims = t.claims.role !== undefined

  const [{ db }, { doc, onSnapshot }] = await Promise.all([
    import('../firebase.js'),
    import('firebase/firestore'),
  ])

  const refresh = async () => {
    try {
      const fresh = await user.getIdTokenResult(true)   // force refresh
      _set(accessFrom(fresh.claims, { emailVerified: user.emailVerified }))
    } catch { /* offline — the next natural token refresh catches up */ }
  }

  let lastSynced   // undefined = initial snapshot not yet processed
  onSnapshot(doc(db, 'users', user.uid), snap => {
    const at = snap.data()?.claimsSyncedAt?.toMillis?.() ?? null
    const initial = lastSynced === undefined
    if (at === lastSynced) return
    lastSynced = at
    // On the initial snapshot, re-read only when claims exist server-side but
    // this token predates them (first sign-in after a backfill). A brand-new
    // user's doc arrives moments later as a normal change and refreshes then.
    if (initial && (at === null || tokenHadClaims)) return
    refresh()
  }, () => { /* watch failed (offline/rules) — access stays as the token said */ })
}
