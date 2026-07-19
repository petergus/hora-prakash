// Unit tests for the /buro admin handlers (functions/handlers/admin.js)
// against lightweight in-memory fakes — no emulator, no network. Covers the
// parts that are cheap and high-value to unit-test: the superadmin
// authorization gate, setAccess's validation + self-lockout guards,
// deleteUser's self-delete guard, createUser's defaulting, and the shape of
// every audit-log entry a mutation writes. listUsers/dashboardStats lean on
// Firestore query/aggregation features (composite indexes, .count()) that a
// hand-rolled fake can't faithfully reproduce — those are exercised manually
// against the emulator/console instead, same call as the deferred
// firestore.rules emulator suite (see docs/USER_INTEGRATION_PLAN.md Phase 2).
// Run: node tests/admin-handlers.test.mjs

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}
async function assertThrows(fn, codeIncludes, msg) {
  try {
    await fn()
    failures++
    console.error('  ✗ FAIL:', msg, '(did not throw)')
  } catch (err) {
    if (err.code === codeIncludes) { console.log('  ✓', msg) }
    else { failures++; console.error('  ✗ FAIL:', msg, `(threw code=${err.code}, expected ${codeIncludes})`) }
  }
}

const {
  assertSuperAdmin, createUser, setAccess, sendReset, deleteUser,
} = await import('../functions/handlers/admin.js')

// ── fakes ────────────────────────────────────────────────────────────────────

function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed))
  const audit = []
  return {
    doc(path) {
      return {
        async get() {
          const data = store.get(path)
          return { exists: data !== undefined, data: () => data }
        },
        async set(patch, opts) {
          const cur = store.get(path) || {}
          store.set(path, opts?.merge ? { ...cur, ...patch } : { ...patch })
        },
      }
    },
    collection(path) {
      return {
        async add(data) {
          if (path === 'auditLogs') audit.push(data)
          return { id: `fake-${audit.length}` }
        },
        async get() { return { docs: [] } },   // profiles subcollection reads (unused by these tests)
      }
    },
    async recursiveDelete() { /* no-op — deleteUser's data wipe is emulator territory */ },
    _store: store,
    _audit: audit,
  }
}

function makeFakeAuth(users = {}) {
  const created = []
  const revoked = []
  const claims = {}
  return {
    async getUser(uid) {
      const u = users[uid]
      if (!u) { const e = new Error('no user'); e.code = 'auth/user-not-found'; throw e }
      return u
    },
    async createUser(data) {
      const uid = `new-${created.length}`
      const rec = { uid, ...data }
      created.push(rec)
      users[uid] = rec
      return rec
    },
    async setCustomUserClaims(uid, c) { claims[uid] = c },
    async generatePasswordResetLink(email) { return `https://fake.link/reset?email=${encodeURIComponent(email)}` },
    async revokeRefreshTokens(uid) { revoked.push(uid) },
    async deleteUser() {},
    _created: created,
    _revoked: revoked,
    _claims: claims,
  }
}

const SUPER = { uid: 'super1', email: 'admin@example.com' }
const PLAIN = { uid: 'plain1', email: 'plain@example.com' }
const seedDocs = {
  'users/super1': { role: 'superadmin', plan: 'pro', status: 'active' },
  'users/plain1': { role: 'user', plan: 'free', status: 'active' },
  'users/target1': { role: 'user', plan: 'free', status: 'active', email: 'target@example.com' },
}

console.log('\n[assertSuperAdmin]')
{
  const db = makeFakeDb(seedDocs)
  await assertThrows(() => assertSuperAdmin(db, undefined), 'unauthenticated', 'no uid → unauthenticated')
  await assertThrows(() => assertSuperAdmin(db, 'plain1'), 'permission-denied', 'plain user → permission-denied')
  await assertThrows(() => assertSuperAdmin(db, 'ghost-uid'), 'permission-denied', 'no doc at all → folds to user → permission-denied')
  let threw = false
  try { await assertSuperAdmin(db, 'super1') } catch { threw = true }
  assert(!threw, 'superadmin → passes')
}

console.log('\n[setAccess: authorization]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth()
  await assertThrows(
    () => setAccess({ db, auth }, { uid: 'target1', plan: 'plus' }, PLAIN),
    'permission-denied', 'non-superadmin caller is denied')
}

console.log('\n[setAccess: validation]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth()
  await assertThrows(() => setAccess({ db, auth }, { uid: 'target1', role: 'admin' }, SUPER),
    'invalid-argument', 'unknown role rejected')
  await assertThrows(() => setAccess({ db, auth }, { uid: 'target1', status: 'banned' }, SUPER),
    'invalid-argument', 'unknown status rejected')
  await assertThrows(() => setAccess({ db, auth }, { uid: 'target1', plan: '   ' }, SUPER),
    'invalid-argument', 'blank plan rejected')
  await assertThrows(() => setAccess({ db, auth }, { uid: 'target1' }, SUPER),
    'invalid-argument', 'empty patch rejected')
  await assertThrows(() => setAccess({ db, auth }, {}, SUPER),
    'invalid-argument', 'missing uid rejected')
}

console.log('\n[setAccess: self-lockout guard]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth()
  await assertThrows(() => setAccess({ db, auth }, { uid: 'super1', role: 'user' }, SUPER),
    'failed-precondition', 'superadmin cannot demote themself')
  await assertThrows(() => setAccess({ db, auth }, { uid: 'super1', status: 'disabled' }, SUPER),
    'failed-precondition', 'superadmin cannot disable themself')
  // Setting role to the SAME value (superadmin→superadmin) alongside another
  // field is not a lockout attempt — must not be blocked by the guard.
  const res = await setAccess({ db, auth }, { uid: 'super1', role: 'superadmin', plan: 'pro' }, SUPER)
  assert(res.ok === true, 'no-op self role-confirmation + a real change still succeeds')
}

console.log('\n[setAccess: happy path + audit + claims + revoke]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth()
  const res = await setAccess({ db, auth }, { uid: 'target1', plan: 'plus', status: 'disabled' }, SUPER)
  assert(res.ok === true, 'returns ok')
  const after = db._store.get('users/target1')
  assert(after.plan === 'plus' && after.planSource === 'admin', 'plan + planSource written')
  assert(after.status === 'disabled', 'status written')
  assert(after.role === 'user', 'untouched fields (role) survive the merge')
  assert(auth._revoked.includes('target1'), 'disabling revokes refresh tokens')
  const entry = db._audit.at(-1)
  assert(entry.action === 'user.setAccess', 'audit action recorded')
  assert(entry.actorUid === 'super1' && entry.actorEmail === 'admin@example.com', 'audit actor recorded')
  assert(entry.targetUid === 'target1', 'audit target recorded')
  assert(entry.before.plan === 'free', 'audit captures before-state')
  assert(entry.after.plan === 'plus' && entry.after.status === 'disabled', 'audit captures after-patch')
}

console.log('\n[setAccess: enabling does NOT revoke tokens]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth()
  await setAccess({ db, auth }, { uid: 'target1', status: 'active' }, SUPER)
  assert(auth._revoked.length === 0, 'no revoke call when re-enabling')
}

console.log('\n[deleteUser]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth()
  await assertThrows(() => deleteUser({ db, auth }, { uid: 'super1' }, SUPER),
    'failed-precondition', 'cannot delete your own account')
  await assertThrows(() => deleteUser({ db, auth }, {}, SUPER),
    'invalid-argument', 'missing uid rejected')
  await assertThrows(() => deleteUser({ db, auth }, { uid: 'target1' }, PLAIN),
    'permission-denied', 'non-superadmin caller is denied')

  const res = await deleteUser({ db, auth }, { uid: 'target1' }, SUPER)
  assert(res.ok === true, 'delete succeeds for superadmin on another account')
  const entry = db._audit.at(-1)
  assert(entry.action === 'user.delete' && entry.targetUid === 'target1', 'audit entry recorded')
  assert(entry.before.email === 'target@example.com', 'audit captures the deleted doc as before-state')
}

console.log('\n[createUser]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth()
  await assertThrows(() => createUser({ db, auth }, { email: '' }, SUPER),
    'invalid-argument', 'missing email rejected')
  await assertThrows(() => createUser({ db, auth }, { email: 'x@example.com' }, PLAIN),
    'permission-denied', 'non-superadmin caller is denied')

  const res = await createUser({ db, auth }, { email: 'New.User@Example.com', displayName: 'New User' }, SUPER)
  assert(!!res.uid, 'returns the new uid')
  assert(res.resetLink.includes('new.user%40example.com'), 'returns a password-set link for the lowercased email')
  assert(auth._created[0].email === 'new.user@example.com', 'Auth account created with lowercased email')
  const doc = db._store.get(`users/${res.uid}`)
  assert(doc.role === 'user' && doc.plan === 'free', 'defaults role=user, plan=free when omitted')
  assert(doc.planSource === 'admin', 'admin-created accounts are tagged planSource=admin')
  const entry = db._audit.at(-1)
  assert(entry.action === 'user.create' && entry.targetUid === res.uid, 'audit entry recorded')

  const res2 = await createUser({ db, auth }, { email: 'super2@example.com', role: 'superadmin', plan: 'pro' }, SUPER)
  const doc2 = db._store.get(`users/${res2.uid}`)
  assert(doc2.role === 'superadmin' && doc2.plan === 'pro', 'explicit role/plan honored')

  const res3 = await createUser({ db, auth }, { email: 'bogus-role@example.com', role: 'god-mode' }, SUPER)
  assert(db._store.get(`users/${res3.uid}`).role === 'user',
    'an unrecognized role silently folds to user, never invents privilege')
}

console.log('\n[sendReset]')
{
  const db = makeFakeDb(seedDocs)
  const auth = makeFakeAuth({ target1: { uid: 'target1', email: 'target@example.com' } })
  await assertThrows(() => sendReset({ db, auth }, { uid: 'target1' }, PLAIN),
    'permission-denied', 'non-superadmin caller is denied')
  const res = await sendReset({ db, auth }, { uid: 'target1' }, SUPER)
  assert(res.resetLink.includes('target%40example.com'), 'returns a reset link for the target')
  const entry = db._audit.at(-1)
  assert(entry.action === 'user.sendReset' && entry.targetUid === 'target1', 'audit entry recorded')
}

if (failures) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll admin-handler tests passed.')
