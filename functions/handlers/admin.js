// functions/handlers/admin.js — the /buro backend's business logic, extracted
// from the onCall wiring in index.js so it can be unit-tested against a
// lightweight in-memory fake instead of the emulator (tests/admin-handlers.test.mjs).
//
// Every handler takes (ctx, params, actor):
//   ctx    = { db, auth }         — injected Admin SDK instances (or fakes)
//   params = request.data         — the callable's input
//   actor  = { uid, email }       — the CALLING admin, from the verified ID token
//
// Every handler re-verifies superadmin status against Firestore (the source
// of truth — see D2/D3 in docs/USER_INTEGRATION_PLAN.md) rather than trusting
// the caller's token claims, which can lag a demotion by up to the token's
// refresh window. This is the single choke point for admin mutations; every
// one of them writes an auditLogs entry.
const admin = require('firebase-admin')
const { syncClaims } = require('../claims')
const { writeAudit } = require('../lib/audit')

const ROLES = new Set(['user', 'superadmin'])
const STATUSES = new Set(['active', 'disabled'])
// Provisional — Phase 4 (entitlements.js) makes this a real, config-driven
// plan matrix. /buro just needs plan IDENTIFIERS to assign and count by.
const PLAN_IDS = ['free', 'plus', 'pro']

class HttpsLikeError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

async function assertSuperAdmin(db, callerUid) {
  if (!callerUid) throw new HttpsLikeError('unauthenticated', 'Sign in required.')
  const snap = await db.doc(`users/${callerUid}`).get()
  const role = snap.exists ? snap.data().role : 'user'
  if (role !== 'superadmin') throw new HttpsLikeError('permission-denied', 'Superadmin access required.')
}

// ── dashboardStats ───────────────────────────────────────────────────────────

async function dashboardStats({ db }, _params, actor) {
  await assertSuperAdmin(db, actor.uid)
  const users = db.collection('users')
  const since = days => admin.firestore.Timestamp.fromMillis(Date.now() - days * 86400000)

  const [total, new7, new30, disabled, superadmins, ...planCounts] = await Promise.all([
    users.count().get(),
    users.where('createdAt', '>=', since(7)).count().get(),
    users.where('createdAt', '>=', since(30)).count().get(),
    users.where('status', '==', 'disabled').count().get(),
    users.where('role', '==', 'superadmin').count().get(),
    ...PLAN_IDS.map(p => users.where('plan', '==', p).count().get()),
  ])

  return {
    total: total.data().count,
    new7d: new7.data().count,
    new30d: new30.data().count,
    disabled: disabled.data().count,
    superadmins: superadmins.data().count,
    byPlan: Object.fromEntries(PLAN_IDS.map((p, i) => [p, planCounts[i].data().count])),
  }
}

// ── listUsers ────────────────────────────────────────────────────────────────
// Firestore has no substring search, so `search` does a prefix match on email
// and — because a range filter + orderBy on a DIFFERENT field needs a
// composite index we don't want to multiply — is mutually exclusive with the
// plan/status/role filters (the UI enforces this too; firestore.indexes.json
// only declares the (filter, createdAt) composites, not every combination).

function pageSizeOf(params) {
  return Math.min(Math.max(parseInt(params.pageSize, 10) || 25, 1), 100)
}

async function listUsers({ db, auth }, params = {}, actor) {
  await assertSuperAdmin(db, actor.uid)
  const pageSize = pageSizeOf(params)
  const { plan, status, role, search, cursor } = params

  let q
  if (search) {
    const s = String(search).trim().toLowerCase()
    q = db.collection('users').orderBy('email').where('email', '>=', s).where('email', '<', s + '\uf8ff')
  } else {
    q = db.collection('users').orderBy('createdAt', 'desc')
    if (plan)   q = q.where('plan', '==', plan)
    if (status) q = q.where('status', '==', status)
    if (role)   q = q.where('role', '==', role)
  }
  if (cursor) {
    const cursorSnap = await db.doc(`users/${cursor}`).get()
    if (cursorSnap.exists) q = q.startAfter(cursorSnap)
  }

  const snap = await q.limit(pageSize).get()
  const docs = snap.docs
  const uids = docs.map(d => d.id)

  let authByUid = new Map()
  if (uids.length) {
    const res = await auth.getUsers(uids.map(uid => ({ uid })))
    authByUid = new Map(res.users.map(u => [u.uid, u]))
  }

  const items = docs.map(d => {
    const data = d.data()
    const a = authByUid.get(d.id)
    return {
      uid: d.id,
      email: data.email ?? a?.email ?? null,
      displayName: data.displayName ?? a?.displayName ?? null,
      role: data.role || 'user',
      plan: data.plan || 'free',
      planSource: data.planSource || 'default',
      status: data.status || 'active',
      createdAt: data.createdAt?.toMillis?.() ?? null,
      emailVerified: !!a?.emailVerified,
      authDisabled: !!a?.disabled,
      lastSignInAt: a?.metadata?.lastSignInTime ? Date.parse(a.metadata.lastSignInTime) : null,
    }
  })

  return { items, nextCursor: docs.length === pageSize ? docs[docs.length - 1].id : null }
}

// ── getUser ──────────────────────────────────────────────────────────────────

async function getUser({ db, auth }, params, actor) {
  await assertSuperAdmin(db, actor.uid)
  const uid = params?.uid
  if (!uid) throw new HttpsLikeError('invalid-argument', 'uid is required.')

  const [docSnap, profilesSnap, authRecord] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/profiles`).get(),
    auth.getUser(uid).catch(() => null),
  ])
  if (!docSnap.exists && !authRecord) throw new HttpsLikeError('not-found', 'No such user.')
  const data = docSnap.exists ? docSnap.data() : {}

  return {
    uid,
    email: data.email ?? authRecord?.email ?? null,
    displayName: data.displayName ?? authRecord?.displayName ?? null,
    role: data.role || 'user',
    plan: data.plan || 'free',
    planSource: data.planSource || 'default',
    planUntil: data.planUntil?.toMillis?.() ?? null,
    status: data.status || 'active',
    createdAt: data.createdAt?.toMillis?.() ?? null,
    stripeCustomerId: data.stripeCustomerId || null,
    emailVerified: !!authRecord?.emailVerified,
    authDisabled: !!authRecord?.disabled,
    lastSignInAt: authRecord?.metadata?.lastSignInTime ? Date.parse(authRecord.metadata.lastSignInTime) : null,
    profiles: profilesSnap.docs.map(d => ({ id: d.id, name: d.data().name || null, dob: d.data().dob || null })),
  }
}

// ── createUser ───────────────────────────────────────────────────────────────
// No password is ever set by an admin — Auth creates a passwordless account
// and we hand back a "set your password" reset link for the admin to send.

async function createUser({ db, auth }, params, actor) {
  await assertSuperAdmin(db, actor.uid)
  const email = (params?.email || '').trim().toLowerCase()
  if (!email) throw new HttpsLikeError('invalid-argument', 'email is required.')
  const role = ROLES.has(params.role) ? params.role : 'user'
  const plan = (params.plan ? String(params.plan).trim() : '') || 'free'
  const displayName = params.displayName?.trim() || undefined

  let userRecord
  try {
    userRecord = await auth.createUser({ email, displayName, emailVerified: false })
  } catch (err) {
    if (err?.code === 'auth/email-already-exists') throw new HttpsLikeError('already-exists', 'An account with this email already exists.')
    throw err
  }

  // Merge, not create: functions/index.js#onUserCreated may already have (or
  // may yet) provision the baseline doc for this uid — whichever write lands
  // first sets the shape, the other merges on top. See the plan doc's D1.
  await db.doc(`users/${userRecord.uid}`).set({
    email, displayName: displayName || null,
    role, plan, planSource: 'admin', status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  await syncClaims({ db, auth }, userRecord.uid)
  const resetLink = await auth.generatePasswordResetLink(email)

  await writeAudit(db, { actor, action: 'user.create', targetUid: userRecord.uid, after: { email, role, plan } })
  return { uid: userRecord.uid, resetLink }
}

// ── setAccess ────────────────────────────────────────────────────────────────

async function setAccess({ db, auth }, params, actor) {
  await assertSuperAdmin(db, actor.uid)
  const uid = params?.uid
  if (!uid) throw new HttpsLikeError('invalid-argument', 'uid is required.')

  const patch = {}
  if (params.role !== undefined) {
    if (!ROLES.has(params.role)) throw new HttpsLikeError('invalid-argument', 'Invalid role.')
    patch.role = params.role
  }
  if (params.status !== undefined) {
    if (!STATUSES.has(params.status)) throw new HttpsLikeError('invalid-argument', 'Invalid status.')
    patch.status = params.status
  }
  if (params.plan !== undefined) {
    const plan = String(params.plan).trim()
    if (!plan) throw new HttpsLikeError('invalid-argument', 'Invalid plan.')
    patch.plan = plan
    patch.planSource = 'admin'
  }
  if (params.planUntil !== undefined) {
    patch.planUntil = params.planUntil ? admin.firestore.Timestamp.fromMillis(params.planUntil) : null
  }
  if (!Object.keys(patch).length) throw new HttpsLikeError('invalid-argument', 'Nothing to change.')

  // An admin locking out the only superadmin (self-demote or self-disable) is
  // a severe, awkward-to-recover mistake — recovery needs re-running the
  // backfill script from a service account. Guard it rather than trust clicks.
  if (uid === actor.uid) {
    if (patch.role && patch.role !== 'superadmin') throw new HttpsLikeError('failed-precondition', 'You cannot change your own role.')
    if (patch.status === 'disabled') throw new HttpsLikeError('failed-precondition', 'You cannot disable your own account.')
  }

  const ref = db.doc(`users/${uid}`)
  const before = (await ref.get()).data() || {}
  await ref.set(patch, { merge: true })
  await syncClaims({ db, auth }, uid)
  if (patch.status === 'disabled') await auth.revokeRefreshTokens(uid).catch(() => {})

  await writeAudit(db, { actor, action: 'user.setAccess', targetUid: uid, before, after: patch })
  return { ok: true }
}

// ── sendReset ────────────────────────────────────────────────────────────────
// Doubles as "resend invite" for an admin-created account that hasn't set a
// password yet — it's the same underlying link either way.

async function sendReset({ db, auth }, params, actor) {
  await assertSuperAdmin(db, actor.uid)
  const uid = params?.uid
  if (!uid) throw new HttpsLikeError('invalid-argument', 'uid is required.')
  const rec = await auth.getUser(uid)
  const resetLink = await auth.generatePasswordResetLink(rec.email)
  await writeAudit(db, { actor, action: 'user.sendReset', targetUid: uid })
  return { resetLink }
}

// ── deleteUser ───────────────────────────────────────────────────────────────

async function deleteUser({ db, auth }, params, actor) {
  await assertSuperAdmin(db, actor.uid)
  const uid = params?.uid
  if (!uid) throw new HttpsLikeError('invalid-argument', 'uid is required.')
  if (uid === actor.uid) throw new HttpsLikeError('failed-precondition', 'You cannot delete your own account.')

  const ref = db.doc(`users/${uid}`)
  const before = (await ref.get()).data() || null
  await db.recursiveDelete(ref)
  await auth.deleteUser(uid).catch(() => {})   // already gone from Auth → ignore

  await writeAudit(db, { actor, action: 'user.delete', targetUid: uid, before })
  return { ok: true }
}

module.exports = {
  HttpsLikeError, assertSuperAdmin,
  dashboardStats, listUsers, getUser, createUser, setAccess, sendReset, deleteUser,
  ROLES, STATUSES, PLAN_IDS,
}
