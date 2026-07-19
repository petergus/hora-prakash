// functions/claims.js — mirror the users/{uid} authority doc into custom claims.
//
// The Firestore doc is the single source of truth for role/plan/status; claims
// are the fast copy embedded in every ID token (read by security rules as
// request.auth.token.*, by the client via getIdTokenResult, and by aiProxy).
// Every sync bumps `claimsSyncedAt` on the doc — the client (src/core/authz.js)
// watches that field and force-refreshes its token, so changes land in live
// sessions in seconds instead of the ~1 h token lifetime.

const admin = require('firebase-admin')

const CLAIM_DEFAULTS = { role: 'user', plan: 'free', status: 'active' }

async function syncClaims(uid) {
  const ref = admin.firestore().doc(`users/${uid}`)
  const snap = await ref.get()
  const d = snap.exists ? snap.data() : {}
  const claims = {
    role:   d.role   || CLAIM_DEFAULTS.role,
    plan:   d.plan   || CLAIM_DEFAULTS.plan,
    status: d.status || CLAIM_DEFAULTS.status,
  }
  await admin.auth().setCustomUserClaims(uid, claims)
  await ref.set({ claimsSyncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
  return claims
}

module.exports = { syncClaims, CLAIM_DEFAULTS }
