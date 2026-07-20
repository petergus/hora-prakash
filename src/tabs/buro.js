// src/tabs/buro.js — the /buro super-admin backend: dashboard stats, a
// filterable/searchable/paginated users table, per-user detail + actions
// (set plan/role, disable/enable, send a password-set link, delete), account
// creation, and an audit-log view. Every mutation goes through admin-api.js's
// callables, which re-verify superadmin status server-side — this page is
// convenience UI, not the security boundary (see router.js's adminOnly guard
// and docs/USER_INTEGRATION_PLAN.md D3).
import {
  adminDashboardStats, adminListUsers, adminGetUser, adminCreateUser,
  adminSetAccess, adminSendReset, adminDeleteUser,
} from '../admin-api.js'
import { db, auth } from '../firebase.js'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { openModal, confirmModal } from '../ui/modal.js'
import { copyText } from '../utils/clipboard.js'

// Mirrors functions/handlers/admin.js#PLAN_IDS — provisional identifiers for
// the "set plan" dropdown until Phase 4's entitlements.js makes this a real,
// config-driven matrix (server enforcement lives there regardless of this list).
const PLAN_IDS = ['free', 'plus', 'pro']

let filters = { search: '', plan: '', status: '', role: '' }
let cursor = null
let cursorStack = []
let view = 'users'   // 'users' | 'audit'
let stats = null
let items = []
let nextCursor = null
let loadError = null

export async function renderBuro() {
  const panel = document.getElementById('tab-buro')
  if (!panel) return
  panel.innerHTML = shellHtml()
  wireShell(panel)
  await Promise.all([loadStats(panel), view === 'users' ? loadUsers(panel) : loadAudit(panel)])
}

// ── shell ────────────────────────────────────────────────────────────────────

function shellHtml() {
  return `
    <div class="card buro-card">
      <div class="buro-header">
        <h3>Admin</h3>
        <div class="buro-header-actions">
          <button type="button" class="btn-secondary" id="buro-view-toggle">${view === 'users' ? 'View audit log' : '← Back to users'}</button>
          ${view === 'users' ? '<button type="button" class="btn btn-primary" id="buro-new-user">+ New user</button>' : ''}
        </div>
      </div>
      <div id="buro-stats-slot">${statsHtml(stats)}</div>
      <div id="buro-body-slot"><p class="buro-loading">Loading…</p></div>
    </div>`
}

function wireShell(panel) {
  panel.querySelector('#buro-view-toggle')?.addEventListener('click', () => {
    view = view === 'users' ? 'audit' : 'users'
    renderBuro()
  })
  panel.querySelector('#buro-new-user')?.addEventListener('click', () => openCreateUserModal(() => loadUsers(panel)))
}

async function loadStats(panel) {
  try { stats = await adminDashboardStats() } catch { stats = null }
  panel.querySelector('#buro-stats-slot').innerHTML = statsHtml(stats)
}

function statsHtml(s) {
  if (!s) return '<p class="buro-stats-loading">Loading stats…</p>'
  const planChips = Object.entries(s.byPlan).map(([p, n]) => `<span class="buro-chip">${esc(p)}: ${n}</span>`).join('')
  return `
    <div class="buro-stats">
      <div class="buro-stat"><span class="buro-stat-n">${s.total}</span><span class="buro-stat-l">Total users</span></div>
      <div class="buro-stat"><span class="buro-stat-n">${s.new7d}</span><span class="buro-stat-l">New (7d)</span></div>
      <div class="buro-stat"><span class="buro-stat-n">${s.new30d}</span><span class="buro-stat-l">New (30d)</span></div>
      <div class="buro-stat"><span class="buro-stat-n">${s.disabled}</span><span class="buro-stat-l">Disabled</span></div>
      <div class="buro-stat"><span class="buro-stat-n">${s.superadmins}</span><span class="buro-stat-l">Superadmins</span></div>
      <div class="buro-stat buro-stat-plans"><span class="buro-stat-l">By plan</span><div class="buro-chips">${planChips}</div></div>
    </div>`
}

// ── users view ───────────────────────────────────────────────────────────────

function resetPaging() { cursor = null; cursorStack = [] }

function activeParams() {
  if (filters.search) return { search: filters.search }
  const p = {}
  if (filters.plan)   p.plan = filters.plan
  if (filters.status) p.status = filters.status
  if (filters.role)   p.role = filters.role
  return p
}

async function loadUsers(panel) {
  const slot = panel.querySelector('#buro-body-slot')
  try {
    const res = await adminListUsers({ ...activeParams(), cursor, pageSize: 25 })
    items = res.items
    nextCursor = res.nextCursor
    loadError = null
  } catch (err) {
    items = []
    nextCursor = null
    loadError = describeError(err)
  }
  slot.innerHTML = usersBodyHtml()
  wireUsersBody(panel)
}

function usersBodyHtml() {
  return `
    ${toolbarHtml()}
    ${loadError ? `<p class="buro-error">${esc(loadError)}</p>` : usersTableHtml(items)}
    <div class="buro-pager">
      <button type="button" class="btn-secondary" id="buro-prev" ${cursorStack.length ? '' : 'disabled'}>← Prev</button>
      <button type="button" class="btn-secondary" id="buro-next" ${nextCursor ? '' : 'disabled'}>Next →</button>
    </div>`
}

function toolbarHtml() {
  const hasFilter = filters.search || filters.plan || filters.status || filters.role
  return `
    <div class="buro-toolbar">
      <form id="buro-search-form" class="buro-search">
        <input type="search" id="buro-search-input" placeholder="Search by email prefix…" value="${esc(filters.search)}" />
        <button type="submit" class="btn-secondary">Search</button>
      </form>
      <select id="buro-filter-plan" ${filters.search ? 'disabled' : ''}>
        <option value="">All plans</option>
        ${PLAN_IDS.map(p => `<option value="${p}" ${filters.plan === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      </select>
      <select id="buro-filter-status" ${filters.search ? 'disabled' : ''}>
        <option value="">All statuses</option>
        <option value="active" ${filters.status === 'active' ? 'selected' : ''}>active</option>
        <option value="disabled" ${filters.status === 'disabled' ? 'selected' : ''}>disabled</option>
      </select>
      <select id="buro-filter-role" ${filters.search ? 'disabled' : ''}>
        <option value="">All roles</option>
        <option value="user" ${filters.role === 'user' ? 'selected' : ''}>user</option>
        <option value="superadmin" ${filters.role === 'superadmin' ? 'selected' : ''}>superadmin</option>
      </select>
      ${hasFilter ? '<button type="button" class="buro-linkbtn" id="buro-clear-filters">Clear</button>' : ''}
    </div>
    <p class="buro-hint">Filters apply one at a time — search and the dropdowns clear each other.</p>`
}

function usersTableHtml(rows) {
  if (!rows.length) return '<p class="buro-empty">No users match these filters.</p>'
  return `
    <div class="table-scroll">
      <table class="people-table buro-table">
        <thead><tr>
          <th>Email</th><th>Name</th><th>Role</th><th>Plan</th><th>Status</th><th>Verified</th><th>Created</th><th>Last sign-in</th>
        </tr></thead>
        <tbody>${rows.map(userRowHtml).join('')}</tbody>
      </table>
    </div>`
}

function userRowHtml(u) {
  return `
    <tr class="buro-row" data-uid="${esc(u.uid)}">
      <td class="pt-nowrap" data-label="Email">${esc(u.email || '—')}</td>
      <td class="pt-nowrap" data-label="Name">${esc(u.displayName || '—')}</td>
      <td data-label="Role">${roleBadge(u.role)}</td>
      <td data-label="Plan">${esc(u.plan)}${u.planSource === 'admin' ? ' <span class="buro-tag">admin</span>' : ''}</td>
      <td data-label="Status">${statusBadge(u.status)}</td>
      <td data-label="Verified">${u.emailVerified ? '✓' : '—'}</td>
      <td class="pt-nowrap" data-label="Created">${fmtDate(u.createdAt)}</td>
      <td class="pt-nowrap" data-label="Last sign-in">${fmtDate(u.lastSignInAt)}</td>
    </tr>`
}

function wireUsersBody(panel) {
  panel.querySelector('#buro-search-form')?.addEventListener('submit', e => {
    e.preventDefault()
    filters = { search: panel.querySelector('#buro-search-input').value.trim(), plan: '', status: '', role: '' }
    resetPaging()
    loadUsers(panel)
  })
  for (const dim of ['plan', 'status', 'role']) {
    panel.querySelector(`#buro-filter-${dim}`)?.addEventListener('change', e => {
      filters = { search: '', plan: '', status: '', role: '', [dim]: e.target.value }
      resetPaging()
      loadUsers(panel)
    })
  }
  panel.querySelector('#buro-clear-filters')?.addEventListener('click', () => {
    filters = { search: '', plan: '', status: '', role: '' }
    resetPaging()
    loadUsers(panel)
  })
  panel.querySelector('#buro-prev')?.addEventListener('click', () => {
    cursor = cursorStack.pop() ?? null
    loadUsers(panel)
  })
  panel.querySelector('#buro-next')?.addEventListener('click', () => {
    cursorStack.push(cursor)
    cursor = nextCursor
    loadUsers(panel)
  })
  panel.querySelectorAll('tr.buro-row').forEach(tr => {
    tr.addEventListener('click', () => openUserDetail(tr.dataset.uid, () => loadUsers(panel)))
  })
}

// ── audit view ───────────────────────────────────────────────────────────────

async function loadAudit(panel) {
  const slot = panel.querySelector('#buro-body-slot')
  try {
    const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(50)))
    slot.innerHTML = auditBodyHtml(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (err) {
    slot.innerHTML = `<p class="buro-error">${esc(describeError(err))}</p>`
  }
}

function auditBodyHtml(rows) {
  if (!rows.length) return '<p class="buro-empty">No audit entries yet.</p>'
  return `
    <div class="table-scroll">
      <table class="people-table buro-table">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
        <tbody>${rows.map(auditRowHtml).join('')}</tbody>
      </table>
    </div>`
}

function auditRowHtml(a) {
  return `
    <tr>
      <td class="pt-nowrap" data-label="When">${fmtTimestamp(a.at)}</td>
      <td class="pt-nowrap" data-label="Actor">${esc(a.actorEmail || a.actorUid || '—')}</td>
      <td data-label="Action">${esc(a.action || '—')}</td>
      <td class="pt-nowrap" data-label="Target">${esc(a.targetUid || '—')}</td>
    </tr>`
}

// ── user detail modal ───────────────────────────────────────────────────────

async function openUserDetail(uid, reloadList) {
  const { el, close } = openModal({
    title: 'Loading…',
    width: '560px',
    content: '<p class="buro-loading">Loading…</p>',
    actions: [{ label: 'Close', variant: 'ghost' }],
  })
  await loadDetail(el, uid, close, reloadList)
}

async function loadDetail(el, uid, close, reloadList) {
  let u
  try {
    u = await adminGetUser(uid)
  } catch (err) {
    el.querySelector('.modal-body').innerHTML = `<p class="buro-error">${esc(describeError(err))}</p>`
    return
  }
  el.querySelector('.modal-title').textContent = u.displayName || u.email || uid
  el.querySelector('.modal-body').innerHTML = detailBodyHtml(u)
  wireDetailActions(el, u, () => loadDetail(el, uid, close, reloadList), close, reloadList)
}

function detailBodyHtml(u) {
  const isMe = u.uid === auth.currentUser?.uid
  return `
    <div class="buro-detail-badges">
      ${roleBadge(u.role)} ${statusBadge(u.status)}
      ${u.emailVerified
        ? '<span class="buro-badge buro-badge-verified">verified</span>'
        : '<span class="buro-badge buro-badge-unverified">unverified</span>'}
    </div>
    <dl class="buro-detail-grid">
      <dt>Email</dt><dd>${esc(u.email || '—')}</dd>
      <dt>Name</dt><dd>${esc(u.displayName || '—')}</dd>
      <dt>UID</dt><dd class="buro-mono">${esc(u.uid)}</dd>
      <dt>Created</dt><dd>${fmtDate(u.createdAt)}</dd>
      <dt>Last sign-in</dt><dd>${fmtDate(u.lastSignInAt)}</dd>
      <dt>Plan</dt><dd>${esc(u.plan)} <span class="buro-muted">(${esc(u.planSource)}${u.planUntil ? `, until ${fmtDate(u.planUntil)}` : ''})</span></dd>
    </dl>

    <div class="buro-detail-section">
      <h4>People (${u.profiles.length})</h4>
      ${u.profiles.length
        ? `<ul class="buro-profile-list">${u.profiles.map(p => `<li>${esc(p.name || 'Unnamed')} — ${esc(p.dob || '—')}</li>`).join('')}</ul>`
        : '<p class="buro-muted">No saved people.</p>'}
    </div>

    <div class="buro-detail-section">
      <h4>Access</h4>
      <div class="buro-action-row">
        <label>Plan</label>
        <select id="buro-plan-select">${PLAN_IDS.map(p => `<option value="${p}" ${p === u.plan ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <button type="button" class="buro-btn" id="buro-plan-save">Save</button>
      </div>
      <div class="buro-action-row">
        <label>Role</label>
        <select id="buro-role-select" ${isMe ? 'disabled' : ''}>
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
          <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>superadmin</option>
        </select>
        <button type="button" class="buro-btn" id="buro-role-save" ${isMe ? 'disabled' : ''}>Save</button>
      </div>
      ${isMe ? '<p class="buro-hint">You cannot change your own role or status.</p>' : ''}
      <div class="buro-action-row">
        <button type="button" class="buro-btn" id="buro-status-toggle" ${isMe ? 'disabled' : ''}>
          ${u.status === 'disabled' ? 'Enable account' : 'Disable account'}
        </button>
        <button type="button" class="buro-btn" id="buro-send-reset">Send password-set link</button>
      </div>
      <div id="buro-reset-result"></div>
      <p class="buro-error" id="buro-action-error"></p>
    </div>

    <div class="buro-detail-section buro-danger-zone">
      <h4>Danger zone</h4>
      <button type="button" class="btn-danger-sm" id="buro-delete-user" ${isMe ? 'disabled' : ''}>Delete this account</button>
      ${isMe ? '<p class="buro-hint">You cannot delete your own account.</p>' : ''}
    </div>`
}

function wireDetailActions(el, u, refresh, close, reloadList) {
  const setErr = msg => { const e = el.querySelector('#buro-action-error'); if (e) e.textContent = msg || '' }

  el.querySelector('#buro-plan-save')?.addEventListener('click', async () => {
    setErr('')
    try {
      await adminSetAccess({ uid: u.uid, plan: el.querySelector('#buro-plan-select').value })
      await refresh(); reloadList()
    } catch (err) { setErr(describeError(err)) }
  })

  el.querySelector('#buro-role-save')?.addEventListener('click', async () => {
    setErr('')
    try {
      await adminSetAccess({ uid: u.uid, role: el.querySelector('#buro-role-select').value })
      await refresh(); reloadList()
    } catch (err) { setErr(describeError(err)) }
  })

  el.querySelector('#buro-status-toggle')?.addEventListener('click', async () => {
    const next = u.status === 'disabled' ? 'active' : 'disabled'
    if (next === 'disabled') {
      const ok = await confirmModal(`Disable ${u.email || 'this account'}? They will be signed out immediately.`,
        { title: 'Disable account', confirmLabel: 'Disable', danger: true })
      if (!ok) return
    }
    setErr('')
    try {
      await adminSetAccess({ uid: u.uid, status: next })
      await refresh(); reloadList()
    } catch (err) { setErr(describeError(err)) }
  })

  el.querySelector('#buro-send-reset')?.addEventListener('click', async () => {
    setErr('')
    try {
      const { resetLink } = await adminSendReset(u.uid)
      const resultEl = el.querySelector('#buro-reset-result')
      resultEl.innerHTML = `
        <div class="modal-field"><input type="text" readonly value="${esc(resetLink)}" id="buro-reset-link-out" /></div>
        <button type="button" class="buro-btn" id="buro-copy-reset">Copy link</button>`
      resultEl.querySelector('#buro-copy-reset').addEventListener('click', () => copyText(resetLink))
    } catch (err) { setErr(describeError(err)) }
  })

  el.querySelector('#buro-delete-user')?.addEventListener('click', async () => {
    const ok = await confirmModal(`Permanently delete ${u.email || 'this account'} and all their data? This cannot be undone.`,
      { title: 'Delete account', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    setErr('')
    try {
      await adminDeleteUser(u.uid)
      close(); reloadList()
    } catch (err) { setErr(describeError(err)) }
  })
}

// ── create user modal ───────────────────────────────────────────────────────

function openCreateUserModal(reloadList) {
  const { el } = openModal({
    title: 'New user',
    width: '420px',
    content: `
      <div class="modal-field"><label>Email</label><input type="email" id="buro-new-email" autocomplete="off" /></div>
      <div class="modal-field"><label>Name (optional)</label><input type="text" id="buro-new-name" autocomplete="off" /></div>
      <div class="modal-field"><label>Plan</label>
        <select id="buro-new-plan">${PLAN_IDS.map(p => `<option value="${p}">${esc(p)}</option>`).join('')}</select>
      </div>
      <div class="modal-field"><label>Role</label>
        <select id="buro-new-role"><option value="user" selected>user</option><option value="superadmin">superadmin</option></select>
      </div>
      <p class="buro-hint">No password is set — you'll get a link to send them so they can set their own.</p>
      <p class="buro-error" id="buro-new-error"></p>
    `,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Create', variant: 'primary', onClick: async closeThis => {
          const email = el.querySelector('#buro-new-email').value.trim()
          const displayName = el.querySelector('#buro-new-name').value.trim()
          const plan = el.querySelector('#buro-new-plan').value
          const role = el.querySelector('#buro-new-role').value
          const errEl = el.querySelector('#buro-new-error')
          if (!email) { errEl.textContent = 'Email is required.'; return }
          try {
            const res = await adminCreateUser({ email, displayName, plan, role })
            closeThis()
            reloadList()
            showResetLinkModal(res.resetLink, email)
          } catch (err) { errEl.textContent = describeError(err) }
        },
      },
    ],
  })
}

function showResetLinkModal(link, email) {
  openModal({
    title: 'Account created',
    width: '460px',
    content: `
      <p>Send this link to <strong>${esc(email)}</strong> so they can set their password. It is not emailed automatically.</p>
      <div class="modal-field"><input type="text" readonly value="${esc(link)}" id="buro-link-out" /></div>
    `,
    actions: [
      { label: 'Copy link', variant: 'primary', onClick: async close => { await copyText(link); close() } },
      { label: 'Done', variant: 'ghost' },
    ],
  })
}

// ── helpers ──────────────────────────────────────────────────────────────────

function roleBadge(role) {
  return role === 'superadmin'
    ? '<span class="buro-badge buro-badge-role-superadmin">superadmin</span>'
    : '<span class="buro-badge buro-badge-role-user">user</span>'
}
function statusBadge(status) {
  return status === 'disabled'
    ? '<span class="buro-badge buro-badge-status-disabled">disabled</span>'
    : '<span class="buro-badge buro-badge-status-active">active</span>'
}
function fmtDate(ms) { return ms ? new Date(ms).toLocaleDateString() : '—' }
function fmtTimestamp(ts) { return ts?.toDate ? ts.toDate().toLocaleString() : '—' }
function describeError(err) { return err?.message || 'Something went wrong.' }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
