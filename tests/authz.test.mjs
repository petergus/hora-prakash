// Unit tests for the pure access layer (src/core/authz.js) and the per-account
// cache hygiene (src/user-scope.js). Firebase is never touched — initAuthz's
// lazy imports are exactly what keeps these modules Node-safe.
// Run: node tests/authz.test.mjs

// Minimal storage shims so the modules import and run in Node.
const lstore = {}
const sstore = {}
globalThis.localStorage = {
  getItem: k => (k in lstore ? lstore[k] : null),
  setItem: (k, v) => { lstore[k] = String(v) },
  removeItem: k => { delete lstore[k] },
}
globalThis.sessionStorage = {
  getItem: k => (k in sstore ? sstore[k] : null),
  setItem: (k, v) => { sstore[k] = String(v) },
  removeItem: k => { delete sstore[k] },
}

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg) }
  else { failures++; console.error('  ✗ FAIL:', msg) }
}

const { accessFrom, DEFAULT_ACCESS, isSuperAdmin, isDisabled, getAccess, onAccessChanged } =
  await import('../src/core/authz.js')
const { reconcileUserScope, clearPersonalCaches, PERSONAL_KEYS, PREFERENCE_KEYS } =
  await import('../src/user-scope.js')

console.log('\n[claims → access]')
{
  const d = accessFrom(undefined)
  assert(d.role === 'user' && d.plan === 'free' && d.status === 'active' && d.verified === false,
    'no claims → user/free/active/unverified defaults')
  assert(accessFrom(null).role === 'user', 'null claims tolerated')

  assert(accessFrom({ role: 'superadmin' }).role === 'superadmin', 'superadmin role passes through')
  assert(accessFrom({ role: 'admin' }).role === 'user', 'unknown role folds to user (never invent privileges)')

  assert(accessFrom({ plan: 'plus' }).plan === 'plus', 'plan string passes through')
  assert(accessFrom({ plan: 42 }).plan === 'free', 'non-string plan folds to free')
  assert(accessFrom({ plan: '' }).plan === 'free', 'empty plan folds to free')

  assert(accessFrom({ status: 'disabled' }).status === 'disabled', 'disabled status recognised')
  assert(accessFrom({ status: 'weird' }).status === 'active', 'unknown status folds to active')

  assert(accessFrom({}, { emailVerified: true }).verified === true, 'emailVerified flag carried')

  assert(isSuperAdmin(accessFrom({ role: 'superadmin' })), 'isSuperAdmin true for superadmin')
  assert(!isSuperAdmin(accessFrom({})), 'isSuperAdmin false by default')
  assert(isDisabled(accessFrom({ status: 'disabled' })), 'isDisabled true when disabled')
  assert(!isDisabled(accessFrom({})), 'isDisabled false by default')
}

console.log('\n[live access state]')
{
  assert(JSON.stringify(getAccess()) === JSON.stringify(DEFAULT_ACCESS),
    'getAccess starts at DEFAULT_ACCESS before initAuthz')
  const a = getAccess()
  a.role = 'superadmin'
  assert(getAccess().role === 'user', 'getAccess returns a copy — mutation does not leak')
  try { DEFAULT_ACCESS.role = 'superadmin' } catch { /* frozen */ }
  assert(DEFAULT_ACCESS.role === 'user', 'DEFAULT_ACCESS is frozen')
  const off = onAccessChanged(() => {})
  assert(typeof off === 'function', 'onAccessChanged returns an unsubscribe function')
  off()
}

console.log('\n[user-scope: key coverage]')
{
  assert(PERSONAL_KEYS.includes('hora-prakash-profiles'), 'profiles mirror is personal')
  assert(PERSONAL_KEYS.includes('hora-prakash-ai-key'), 'BYOK key is personal (cleared on sign-out)')
  assert(PREFERENCE_KEYS.includes('hora-prakash-settings'), 'settings blob is a preference')
  const overlap = PERSONAL_KEYS.filter(k => PREFERENCE_KEYS.includes(k))
  assert(overlap.length === 0, 'personal and preference key lists do not overlap')
}

const seed = () => {
  for (const k of [...PERSONAL_KEYS, ...PREFERENCE_KEYS]) lstore[k] = 'x'
  sstore['hora-prakash-sessions'] = '{"entries":[]}'
}

console.log('\n[user-scope: reconcile on sign-in]')
{
  seed()
  delete lstore['hora-prakash-last-uid']
  assert(reconcileUserScope('alice') === false, 'first sign-in (no marker) grandfathers caches')
  assert(lstore['hora-prakash-profiles'] === 'x', '…nothing wiped')
  assert(lstore['hora-prakash-last-uid'] === 'alice', '…marker recorded')

  assert(reconcileUserScope('alice') === false, 'same account again → no wipe')
  assert(lstore['hora-prakash-settings'] === 'x', '…settings intact')

  assert(reconcileUserScope('bob') === true, 'DIFFERENT account → wipe reported')
  for (const k of [...PERSONAL_KEYS, ...PREFERENCE_KEYS])
    assert(!(k in lstore), `…${k} cleared`)
  assert(!('hora-prakash-sessions' in sstore), '…open-tab sessions cleared')
  assert(lstore['hora-prakash-last-uid'] === 'bob', '…marker now bob')
}

console.log('\n[user-scope: sign-out]')
{
  seed()
  clearPersonalCaches()
  for (const k of PERSONAL_KEYS)
    assert(!(k in lstore), `${k} cleared on sign-out`)
  for (const k of PREFERENCE_KEYS)
    assert(lstore[k] === 'x', `${k} KEPT on sign-out (solo-user convenience)`)
  assert(!('hora-prakash-sessions' in sstore), 'open-tab sessions cleared on sign-out')
}

if (failures) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll authz/user-scope tests passed.')
