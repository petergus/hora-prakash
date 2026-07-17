# Hora Prakash — Cloud Functions

One function: **`aiProxy`**, an auth-gated forwarder to the Anthropic Messages
API. It lets the app offer AI features (the AI Reading and Ask tabs) without
shipping an Anthropic key to the browser — the key stays server-side, and only
signed-in users can reach it.

## Prerequisites

- **Firebase Blaze (pay-as-you-go) plan.** Cloud Functions do not run on the
  free Spark plan. You pay for function invocations *and* all Anthropic API
  usage that flows through the proxy.
- An Anthropic API key.

## One-time setup

```bash
cd functions
npm install

# Store the Anthropic key as a Functions secret (never in code or env files)
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste the key when prompted
```

## Deploy

```bash
firebase deploy --only functions
```

After the first deploy, note the function URL (printed by the deploy, or in the
Firebase console). It looks like:

```
https://europe-west6-astro1-df340.cloudfunctions.net/aiProxy
```

Put that URL in the app under **Settings → AI → Proxy URL**, and set the AI mode
to **Proxy**. The app sends each signed-in user's Firebase ID token; the
function verifies it before forwarding.

## Notes

- Only `POST /v1/messages` is forwarded — no other Anthropic endpoint is
  reachable through the proxy.
- Streaming (SSE) passes straight through, so the Reading and Ask tabs stream.
- The region (`europe-west6`) matches the Firestore location in `firebase.json`.
  Change both together if you relocate.
- The **BYOK** mode (a user pasting their own key in Settings) needs none of
  this — it calls Anthropic directly from the browser. The proxy exists so the
  app can offer AI to users who don't have their own key.
