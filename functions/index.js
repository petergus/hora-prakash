// functions/index.js
// aiProxy — a thin, auth-gated forwarder to the Anthropic Messages API.
//
// The browser (see src/core/ai.js, proxy transport) points the Anthropic SDK's
// baseURL at this function and sends the user's Firebase ID token as a Bearer
// token. This function verifies the token, then replays the request to
// api.anthropic.com with the server-held key (never exposed to the client) and
// streams the response straight back.
//
// Requires the Firebase Blaze (pay-as-you-go) plan — Cloud Functions are not on
// the free Spark plan. The Anthropic key is stored as a Functions secret:
//   firebase functions:secrets:set ANTHROPIC_API_KEY
// Deploy with:
//   firebase deploy --only functions

const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const { Readable } = require('node:stream')

admin.initializeApp()

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

const ANTHROPIC_BASE = 'https://api.anthropic.com'
// Only the Messages API is forwarded — nothing else is reachable through here.
const ALLOWED_PATHS = new Set(['/v1/messages'])

exports.aiProxy = onRequest(
  {
    secrets: [ANTHROPIC_API_KEY],
    cors: true,             // allow the hosted web app's origin (preflight handled)
    timeoutSeconds: 300,    // long readings/chats can run a while
    memory: '256MiB',
    region: 'europe-west6', // matches the Firestore location in firebase.json
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return }

    // 1 · Verify the Firebase ID token.
    const authz = req.get('Authorization') || ''
    const m = authz.match(/^Bearer (.+)$/)
    if (!m) { res.status(401).json({ error: 'missing bearer token' }); return }
    try {
      await admin.auth().verifyIdToken(m[1])
    } catch {
      res.status(401).json({ error: 'invalid token' }); return
    }

    // 2 · Only forward the Messages API.
    const path = (req.path || '').replace(/\/$/, '') || '/v1/messages'
    if (!ALLOWED_PATHS.has(path)) { res.status(404).json({ error: 'not found' }); return }

    // 3 · Replay to Anthropic with the server-held key. Forward the beta header
    //     (tool use / thinking) and the version; supply our own auth.
    const headers = {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY.value(),
      'anthropic-version': req.get('anthropic-version') || '2023-06-01',
    }
    const beta = req.get('anthropic-beta')
    if (beta) headers['anthropic-beta'] = beta

    // req.rawBody is a Buffer when the body was JSON-parsed by the runtime.
    const body = req.rawBody ? req.rawBody : JSON.stringify(req.body ?? {})

    let upstream
    try {
      upstream = await fetch(`${ANTHROPIC_BASE}${path}`, { method: 'POST', headers, body })
    } catch (err) {
      res.status(502).json({ error: 'upstream request failed', detail: String(err) }); return
    }

    // 4 · Stream the response back verbatim (SSE for streaming, JSON otherwise).
    res.status(upstream.status)
    const ct = upstream.headers.get('content-type')
    if (ct) res.set('content-type', ct)
    res.set('cache-control', 'no-store')

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res)
    } else {
      res.end(await upstream.text())
    }
  },
)
