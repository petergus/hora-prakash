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
 * Force-refreshes the token once so a role/plan/status change made *before*
 * this session started (e.g. the backfill script granting superadmin, or an
 * admin action taken while this browser had no tab open) is picked up
 * immediately — a merely-cached token can carry claims that are stale rather
 * than absent, which a "does the token have a role at all" check can't tell
 * apart from current ones. Then watches users/{uid}.claimsSyncedAt for
 * changes made *during* the session (a live promotion/demotion/disable).
 */
export async function initAuthz(user) {
  const refresh = async () => {
    try {
      const fresh = await user.getIdTokenResult(true)   // force refresh
      _set(accessFrom(fresh.claims, { emailVerified: user.emailVerified }))
    } catch {
      // Offline, or the very first call right after sign-up racing the
      // onUserCreated trigger — fall back to whatever's cached so the app
      // isn't stuck; the snapshot listener below catches up once online.
      try {
        const cached = await user.getIdTokenResult()
        _set(accessFrom(cached.claims, { emailVerified: user.emailVerified }))
      } catch { /* leave DEFAULT_ACCESS */ }
    }
  }
  await refresh()

  const [{ db }, { doc, onSnapshot }] = await Promise.all([
    import('../firebase.js'),
    import('firebase/firestore'),
  ])

  let lastSynced   // undefined = initial snapshot not yet processed
  onSnapshot(doc(db, 'users', user.uid), snap => {
    const at = snap.data()?.claimsSyncedAt?.toMillis?.() ?? null
    // The initial snapshot just confirms what the forced refresh above
    // already established — only a LATER change (a bump during this
    // session) should trigger another refresh.
    if (lastSynced === undefined) { lastSynced = at; return }
    if (at === lastSynced) return
    lastSynced = at
    refresh()
  }, () => { /* watch failed (offline/rules) — access stays as the forced refresh said */ })
}
