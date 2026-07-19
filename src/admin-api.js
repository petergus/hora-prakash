// src/admin-api.js — thin wrappers around the /buro Cloud Functions callables
// (functions/handlers/admin.js). Every call re-verifies superadmin status
// server-side against Firestore; nothing here is itself a security boundary —
// it's just the typed client edge. Browser-only (imports firebase/functions),
// same as cloud-store.js.
import { functions } from './firebase.js'
import { httpsCallable } from 'firebase/functions'

const call = (name, data) => httpsCallable(functions, name)(data).then(r => r.data)

export const adminDashboardStats = ()       => call('adminDashboardStats')
export const adminListUsers      = params   => call('adminListUsers', params)
export const adminGetUser        = uid      => call('adminGetUser', { uid })
export const adminCreateUser     = params   => call('adminCreateUser', params)
export const adminSetAccess      = params   => call('adminSetAccess', params)
export const adminSendReset      = uid      => call('adminSendReset', { uid })
export const adminDeleteUser     = uid      => call('adminDeleteUser', { uid })
