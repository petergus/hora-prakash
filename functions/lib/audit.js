// functions/lib/audit.js — the append-only trail every /buro mutation writes.
// auditLogs is function-write-only (firestore.rules) and superadmin-read, so
// this is the single place admin actions become visible after the fact.
const admin = require('firebase-admin')

async function writeAudit(db, { actor, action, targetUid = null, before = null, after = null }) {
  await db.collection('auditLogs').add({
    actorUid: actor.uid,
    actorEmail: actor.email || null,
    action,
    targetUid,
    before,
    after,
    at: admin.firestore.FieldValue.serverTimestamp(),
  })
}

module.exports = { writeAudit }
