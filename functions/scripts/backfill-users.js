#!/usr/bin/env node
// One-off / repair script: ensure every existing Auth user has a users/{uid}
// authority doc and synced custom claims; optionally grant superadmin.
// Idempotent — safe to re-run any time claims and docs drift.
//
// Usage (from the repo root):
//   cd functions && npm install
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
//     node scripts/backfill-users.js --super you@example.com
//
// Credentials: a service-account key (Firebase console → Project settings →
// Service accounts → Generate new private key) or
// `gcloud auth application-default login`.
// Superadmin bootstrap lives ONLY here — never expose it as an HTTP endpoint.

const admin = require('firebase-admin')
const { syncClaims } = require('../claims')

const args = process.argv.slice(2)
const superIdx = args.indexOf('--super')
const superEmail = superIdx >= 0 ? (args[superIdx + 1] || '').toLowerCase() : null
if (superIdx >= 0 && !superEmail) {
  console.error('--super requires an email argument')
  process.exit(1)
}

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'astro1-df340' })

async function run() {
  const db = admin.firestore()
  let pageToken
  let total = 0, created = 0, granted = 0

  do {
    const page = await admin.auth().listUsers(1000, pageToken)
    for (const u of page.users) {
      total++
      const ref = db.doc(`users/${u.uid}`)
      const snap = await ref.get()
      if (!snap.exists) {
        await ref.set({
          email: u.email || null,
          displayName: u.displayName || null,
          role: 'user',
          plan: 'free',
          planSource: 'default',
          status: 'active',
          createdAt: admin.firestore.Timestamp.fromDate(new Date(u.metadata.creationTime)),
        })
        created++
      }
      if (superEmail && (u.email || '').toLowerCase() === superEmail) {
        await ref.set({ role: 'superadmin' }, { merge: true })
        granted++
      }
      const claims = await syncClaims({ db, auth: admin.auth() }, u.uid)
      console.log(`✓ ${u.email || u.uid}  role=${claims.role} plan=${claims.plan} status=${claims.status}`)
    }
    pageToken = page.pageToken
  } while (pageToken)

  console.log(`\n${total} user(s), ${created} doc(s) created, ${granted} superadmin grant(s).`)
  if (superEmail && !granted) console.warn(`⚠ No user matched --super ${superEmail}`)
}

run().then(
  () => process.exit(0),
  err => { console.error(err); process.exit(1) },
)
