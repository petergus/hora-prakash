# User Integration & SaaS Plan

**Status:** v1, 2026-07-18 — Phases 1–2 implemented on `claude/user-integration-saas-plan-xbsms8` (sign-up, `users/{uid}` + claims, rules v2, cache hygiene, backfill script); Phases 3–6 open
**Scope:** Self-service sign-up, super-admin backend (`/buro`), per-user data isolation, entitlements
prepared for Stripe subscription tiers, and the surrounding modern-SaaS table stakes.

This plan is grounded in the code as it exists today. Every phase lists the real files it touches.
Nothing here is implemented yet; this document is the agreement on *what* and *in which order*.

---

## 1. Where the app stands today

What already exists (and is kept):

| Piece | File | State |
|---|---|---|
| Auth gate | `src/auth-ui.js` | Email/password **sign-in only** overlay; password reset works; **no sign-up path** |
| Firebase init | `src/firebase.js` | Project `astro1-df340`, Auth + Firestore, local persistence |
| Per-user data | `src/cloud-store.js` | `users/{uid}/profiles/{pid}` + `users/{uid}/horoscopes/{profileId}` |
| Security rules | `firestore.rules` | Owner-only on `users/{uid}/**` — isolation between users **already holds** |
| Cloud Functions | `functions/index.js` | `aiProxy` (europe-west6, Blaze plan already active) — verifies ID token, forwards to Anthropic |
| Profile mirror | `src/main.js` | On login, Firestore profiles are mirrored into localStorage `hora-prakash-profiles` |
| Page registry | `src/ui/nav-registry.js` | `PAGE_MAP` + hash router — the documented "adding a page" recipe is exactly how `/buro` goes in |

What is missing for a SaaS:

- **No sign-up.** Only accounts you create by hand in the Firebase console can log in.
- **No user record.** There is no `users/{uid}` *document* — only subcollections. No role, no plan,
  no status, no created-at. Nothing to hang entitlements or admin state on.
- **No roles.** Every authenticated user is equal; there is no admin concept anywhere.
- **No usage limits on `aiProxy`.** Any signed-in user can burn unlimited Anthropic tokens on the
  server key. This is the single biggest cost/abuse hole and gets fixed in Phase 4.
- **Local caches are not per-user.** `hora-prakash-profiles`, `hora-prakash-settings`, and the
  sessionStorage session snapshots are shared per browser. On a shared machine, user B signing in
  after user A can briefly see A's persisted sessions/settings until overwritten. Fixed in Phase 1.
- **No billing, no entitlements, no legal pages, no account page, no email verification.**

Architecture stance: **stay serverless on Firebase.** Auth + Firestore + Functions cover everything
below without introducing a server. The app's ethos (no framework, small testable modules,
injectable dependencies) carries over: entitlements become a pure Node-testable module, functions
get pure extracted handlers, and admin UI is one more lazy-loaded page in `PAGE_MAP`.

---

## 2. Core design decisions

These five decisions shape everything; the phases just execute them.

### D1 — `users/{uid}` document is the single authority on who a user is

Auth answers "who are you"; the user doc answers "what may you do":

```
users/{uid}  (document — new; subcollections profiles/horoscopes stay as-is)
  email            string   (mirror, for admin listing/search)
  displayName      string?
  role             'user' | 'superadmin'
  plan             'free' | 'plus' | 'pro'        // tier ids, see §6
  planSource       'default' | 'admin' | 'stripe' // who set the plan
  planUntil        timestamp?                     // for admin-granted comps/trials
  status           'active' | 'disabled'
  createdAt, lastSeenAt, tosAcceptedAt, tosVersion
  stripeCustomerId string?
  claimsSyncedAt   timestamp   // bumped whenever claims change → client refreshes token
```

Only Cloud Functions (Admin SDK) write `role`, `plan`, `status`, `stripeCustomerId` — rules forbid
users touching those fields on their own doc. This is what makes Stripe "prep" real: **Stripe, the
admin panel, and manual comps are all just different writers of the same `plan` field.** Nothing
downstream cares who set it.

### D2 — Custom claims mirror the user doc; the doc is truth

`role`, `plan`, `status` are copied into Firebase **custom claims** by a `syncClaims(uid)` helper in
functions. Claims make authorization *fast and universal*:

- Firestore rules read them as `request.auth.token.role` — no extra lookup per request.
- The client reads them from `getIdTokenResult()` — no Firestore read to render the UI.
- `aiProxy` gets them inside the already-verified token.

Claims lag tokens by up to ~1 h, so: every claims change bumps `claimsSyncedAt` on the user doc; the
client keeps a snapshot listener on its own user doc and calls `getIdToken(true)` when it moves.
Result: plan changes (purchase, admin grant, disable) propagate to a live session in seconds. On
`disable` the function additionally calls `revokeRefreshTokens(uid)`.

### D3 — Superadmin reads via rules, mutates via audited callables

- **Read:** rules grant `role == 'superadmin'` read on `users/{**}` and admin collections. You are
  the project owner and can already see everything in the Firebase console, so this adds no new
  exposure class — it just lets `/buro` use ordinary Firestore queries with real-time updates.
- **Write:** admin *mutations* (create user, change plan/role, disable, delete) go through callable
  functions only. Every callable writes an `auditLogs` entry (actor, action, target, before → after,
  timestamp). Rules keep `auditLogs` write-closed (Admin SDK bypasses rules) and superadmin-read.

Single choke point, complete audit trail, no client-side Admin SDK ever.

### D4 — Entitlements are a pure module, decided before Stripe exists

`src/core/entitlements.js` — dependency-free, Node-testable (same pattern as every core module):

```js
export const PLANS = {
  free: { maxPeople: 3,  ai: false, aiMsgsPerMonth: 0,   calendarIcs: false, muhurta: false,
          pdfExport: false, compare: true, allDivisionals: false },
  plus: { maxPeople: 10, ai: true,  aiMsgsPerMonth: 50,  calendarIcs: true,  muhurta: true,
          pdfExport: true,  compare: true, allDivisionals: true },
  pro:  { maxPeople: Infinity, ai: true, aiMsgsPerMonth: 300, /* everything on */ },
}
export function entitlementsFor({ plan, role, status }) { /* superadmin ⇒ all; disabled ⇒ none */ }
export function can(ent, feature)      // boolean gates
export function limit(ent, key)        // numeric gates
```

- **UI gating:** `PAGE_MAP` entries get an optional `feature` key; the router shows an upsell panel
  instead of the page when `!can(...)`. Non-page gates (AI button, ICS button, "add person" beyond
  the limit, PDF option in the export modal) call the same helper and render a lock + upgrade hint.
  UI gating is UX only — never security.
- **Server enforcement:** `aiProxy` (and later any paid endpoint) enforces the same table
  server-side (§ Phase 4). The table is shared with `functions/` via a predeploy copy step
  (`firebase.json` predeploy hook copies `src/core/entitlements.js` → `functions/entitlements.mjs`
  with a GENERATED header), because a functions deploy cannot reach outside its source dir.

**This is the Stripe prep.** Once every feature checks `can(ent, …)` and the plan matrix is config,
"integrating Stripe" reduces to: a webhook that sets `plan` on the user doc. Pricing tiers can be
re-cut at any time by editing one table — no feature code changes.

### D5 — Stripe = hosted Checkout + hosted Billing Portal + one webhook

No card forms in the app, no PCI scope, ~3 small functions (§ Phase 5). The community Firebase
extension (`firestore-stripe-payments`, now Invertase-maintained) is the alternative, but it imposes
its own schema and opaque sync; ~300 lines of custom functions keep full control and match this
repo's style. Decision point noted in §9.

---

## 3. Phase 1 — Account foundation (sign-up, user docs, hygiene)

**Goal:** strangers can create accounts; every account has a user doc; shared-browser hygiene.

1. **Sign-up UI** in `src/auth-ui.js`: the overlay gets a Sign in / Create account toggle.
   Create account = display name (optional) + email + password (min 8) + ToS/privacy checkbox →
   `createUserWithEmailAndPassword` → `sendEmailVerification` → `updateProfile({ displayName })`.
   Friendly error mapping extends `friendlyError()` (email-already-in-use, weak-password).
2. **User doc provisioning** — `functions/`: v1 auth trigger `auth.user().onCreate` creates
   `users/{uid}` with `{ role:'user', plan:'free', status:'active', createdAt, email }` and calls
   `syncClaims`. (Trigger, not client write, so a hostile client can never choose its own plan.)
   A client-side `ensureUserDoc()` fallback covers the trigger's cold-start race by waiting for the
   doc after first sign-in.
3. **Email verification policy — soft gate:** unverified users may use the app (calculation suite
   is the hook; don't add friction), but a dismissible banner nags, and AI + any future paid
   feature require `email_verified` (enforced in `aiProxy`, it's already in the token).
4. **Disabled-account handling:** `requireAuth()` checks `status` claim after sign-in; disabled →
   signed out with a "account disabled, contact support" message. (Native `disabled` flag blocks
   new sign-ins; the claim + token revocation covers live sessions.)
5. **Per-user local cache hygiene** in `src/main.js`: store `hora-prakash-last-uid`; when the
   signed-in uid differs, clear `hora-prakash-profiles`, `hora-prakash-settings`,
   `hora-prakash-export-presets`, the location cache, and the sessionStorage session snapshots
   before mirroring. (BYOK key `hora-prakash-ai-key` is cleared too — it belongs to the departing
   user.) Sign-out (`logout()` in auth-ui.js) does the same clear before `location.reload()`.
6. **`src/core/authz.js` (new, Node-safe):** caches `getIdTokenResult()` claims; exposes
   `getClaims()`, `isSuperAdmin()`, `entitlements()` (composing entitlements.js), and
   `onAccessChanged(cb)` wired to the user-doc snapshot listener from D2.
7. **Optional, recommended:** "Continue with Google" (`GoogleAuthProvider`) — one popup call in
   auth-ui.js, meaningfully lowers sign-up friction. Flagged as decision §9.

**Migration:** one-off script `scripts/backfill-users.js` (Admin SDK, run locally with a service
account): iterate existing Auth users → create their user docs → grant `superadmin` to
`gustafsonpw@gmail.com`. Superadmin bootstrap lives **only** in this script — never an HTTP endpoint.

**Tests:** `tests/authz.test.mjs` — pure claim→entitlement resolution, disabled/unverified states
(no Firebase imports, same style as `tests/ai.test.mjs`).

---

## 4. Phase 2 — Security rules v2

**Goal:** rules express the role model and protect the authority fields. Ships with Phase 1
(the trigger needs the field-guard in place).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn()  { return request.auth != null; }
    function isOwner(uid){ return signedIn() && request.auth.uid == uid; }
    function isSuper()   { return signedIn() && request.auth.token.role == 'superadmin'; }
    function activeOwner(uid) { return isOwner(uid) && request.auth.token.status == 'active'; }

    match /users/{uid} {
      allow read: if isOwner(uid) || isSuper();
      // Users may update only their harmless fields; authority fields are function-only.
      allow update: if activeOwner(uid)
        && !request.resource.data.diff(resource.data).affectedKeys()
             .hasAny(['role','plan','planSource','planUntil','status','stripeCustomerId','claimsSyncedAt','email']);
      allow create, delete: if false;   // functions only

      match /profiles/{pid}   { allow read: if isOwner(uid) || isSuper();  allow write: if activeOwner(uid); }
      match /horoscopes/{pid} { allow read: if isOwner(uid) || isSuper();  allow write: if activeOwner(uid); }
      match /usage/{period}   { allow read: if isOwner(uid) || isSuper();  allow write: if false; }  // functions only
      match /billing/{doc}    { allow read: if isOwner(uid) || isSuper();  allow write: if false; }
      match /settings/{doc}   { allow read, write: if activeOwner(uid) || (isSuper() && request.method == 'get'); }
    }

    match /auditLogs/{id} { allow read: if isSuper(); allow write: if false; }
    match /config/{doc}   { allow read: if signedIn(); allow write: if false; }  // plan matrix, flags
  }
}
```

Notes: superadmin has **read** everywhere but no rules-write on user content (mutations go through
audited callables, D3). `activeOwner` makes `disabled` bite at the data layer, not just sign-in.

**Tests:** `tests/rules.test.mjs` using `@firebase/rules-unit-testing` against the emulator — new
script `npm run test:rules`, kept **out of** `npm test` exactly like the ephemeris suites (needs the
emulator binary). Cases: owner CRUD, cross-user denial, privilege-field escalation attempt,
superadmin read / write-denial, disabled-user write denial.

---

## 5. Phase 3 — `/buro`: the super-admin backend

**Goal:** you manage the whole user base from inside the app, with every action audited.

### Routing & shell (follows the documented "adding a page" recipe)

- `PAGE_MAP.buro = { label:'Buro', scope:'global', requiresData:false, adminOnly:true, render: () => import('../tabs/buro.js')… }`
  plus `<section id="tab-buro">` and a sidebar `.side-item[data-nav="buro"]`.
- The sidebar item is **injected only when `isSuperAdmin()`** (in `initShell`, which already
  receives the user); `router.js#handleRoute` gets one guard line: `adminOnly && !isSuperAdmin()` →
  redirect to the default route. The page module stays lazy-loaded, so admin code is a separate
  chunk regular users never download (obscurity, not security — the rules/callables are security).

### `/buro` v1 feature set

| Area | Contents |
|---|---|
| **Dashboard** | Totals: users, new sign-ups (7/30 d), plan breakdown, AI messages this month, recent sign-ins. All from Firestore queries + `usage` docs. MRR arrives with Phase 5 (from `billing` mirrors). |
| **Users table** | Search by email/name (user-doc query), filter by plan/status/role. Columns: email, created, last seen, plan (+source/until), status, verified, profile count, AI usage this month. Pagination via `adminListUsers` (joins Auth `listUsers()` with user docs). |
| **User detail** | Auth record + claims + user doc; their saved people (names/birth data via superadmin rules-read — this is the "see all data" requirement); usage counters; per-user audit trail; deep link to the Stripe customer (Phase 5). |
| **Actions** (each = one audited callable) | Create account · invite resend · disable/enable · send password reset · mark verified · set role · **set plan** (with `planSource:'admin'`, optional `planUntil` expiry — this is comps/trials before and after Stripe) · delete user (double-confirm, typed email). |
| **Audit log** | Filterable list of `auditLogs` (actor, action, target, diff, at). |

**Create-account flow (admin-created users):** callable `adminCreateUser({ email, displayName, plan })`
→ Admin SDK `createUser` (no password) → user doc + claims → `generatePasswordResetLink(email)`
returned/e-mailed as a **"set your password" invite**. The admin never sees or sets a password.
Pre-assigned plan comes with `planSource:'admin'`. Same account works with the normal login page
afterwards — which satisfies "I create accounts in the backend *or* they sign up on the login page."

**"View as user" (support tool):** deferred to v1.1 — v1's user detail already shows the raw
profiles. v1.1: a read-only mode that loads a target user's profiles into the normal workspace
under a persistent red banner. No token impersonation, ever — it's rules-read + UI.

### Functions inventory for this phase (all `onCall`, all `region: 'europe-west6'`, all requiring `role == 'superadmin'` **re-verified server-side**, all writing `auditLogs`)

`adminListUsers` · `adminGetUser` · `adminCreateUser` · `adminSetAccess` ({role?, plan?, planUntil?, status?} → doc + `syncClaims` + revoke-on-disable) · `adminSendReset` · `adminDeleteUser` (Auth user + Firestore subtree + Stripe customer cancel later).

Handlers are extracted pure (`functions/handlers/*.js`, injected `{ db, auth }`), so
`tests/admin-handlers.test.mjs` can cover authorization denials and audit-writing without the
emulator — mirroring the injectable-`swe` pattern the core modules use.

---

## 6. Phase 4 — Entitlements live + AI cost control

**Goal:** every gate in the app runs through `entitlements.js`, and the Anthropic key stops being an
open tap. This phase makes tiers *real* while everyone is still on manually-assigned plans.

1. **Ship `src/core/entitlements.js`** (D4) + `tests/entitlements.test.mjs` (pure; belongs in
   `npm test`).
2. **Gate the UI** (all soft, all with a consistent upsell panel component):
   - Page-level via `PAGE_MAP.feature`: `calendar` (ICS/muhurta inside it), `compare`, AI sub-tabs
     of Reading.
   - Sub-page gates: AI Reading/Ask buttons, muhurta finder, ICS export button, PDF/PNG in
     `chart-export.js`, dasha depth 3+ in export, divisional charts beyond the free set,
     "add person" beyond `maxPeople` (checked in `newPerson()` + profile save).
   - The plan matrix itself also mirrors to `config/plans` (read-only doc) so `/buro` and the
     future pricing page can render it without a deploy; **code table remains authoritative** for
     enforcement.
3. **Server enforcement in `aiProxy`** (the critical one):
   - After `verifyIdToken`: require `email_verified`, `status == 'active'`, and
     `can(ent, 'ai')` from the token claims.
   - **Monthly quota:** transaction on `users/{uid}/usage/{YYYYMM}` `{ aiMsgs: increment }`;
     over `aiMsgsPerMonth` → `429 { error: 'quota' }`. Month-keyed docs self-partition — no cron.
   - **Clamp `max_tokens`** to a server-side ceiling and pin the allowed model list (the proxy
     currently forwards whatever the client asks for).
   - **Global kill switch:** `config/flags.aiEnabled` checked per request — one console toggle if
     spend ever runs away.
   - Client: `src/core/ai.js` maps 429/403 to a friendly upsell/verify message in the Reading UI
     instead of a raw API error.
4. **BYOK interplay:** BYOK mode bypasses the proxy (user's own key, their own spend) — it remains
   available on any plan and is *not* counted against quota. The `plan.ai` gate governs the
   **proxy** transport only.

**Definition of done:** a `free` user cannot spend a cent of the server Anthropic key, even with
hand-crafted fetches; flipping a user's plan in `/buro` visibly unlocks features within seconds
(D2 token-refresh path) — which is exactly the mechanism Stripe will drive in the next phase.

---

## 7. Phase 5 — Stripe

**Goal:** self-service subscriptions driving the same `plan` field the admin panel drives.

1. **Stripe side:** Products `plus`/`pro`, monthly + yearly Prices. Price→plan mapping lives in
   `config/stripe` (priceId → plan id), so price changes never need a code deploy. Test mode first;
   webhook via `stripe listen` locally.
2. **Functions (3):**
   - `createCheckoutSession` (callable): reuse/create Customer (store `stripeCustomerId` on the
     user doc; set `metadata.uid` on the customer), `mode:'subscription'`, success/cancel URLs back
     into the app (hash routes survive redirects) → return session URL.
   - `createPortalSession` (callable): hosted Billing Portal — upgrades, downgrades, card changes,
     cancellation, invoices all live there. **We build no billing management UI.**
   - `stripeWebhook` (onRequest): `constructEvent` signature verification (secret via
     `defineSecret`, same pattern as `ANTHROPIC_API_KEY`); handle `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
     Resolve uid via customer metadata → set `plan`/`planSource:'stripe'` + mirror
     `users/{uid}/billing/current` `{ subId, priceId, status, currentPeriodEnd, cancelAtPeriodEnd }`
     → `syncClaims`. **Idempotency:** processed event ids recorded in `stripeEvents/{eventId}`
     (transaction; skip if seen).
   - Handlers extracted pure with injected `{ db, stripe }` → `tests/stripe-handlers.test.mjs` over
     fixture events (checked in), incl. the out-of-order `subscription.updated`-before-`completed`
     case (guard on event `created` timestamps).
3. **Billing states:** `past_due` → app-wide soft banner ("payment failed — update your card"),
   entitlements *keep working* during Stripe's smart-retry window; subscription `deleted`/`canceled`
   → plan reverts to `free` (data is never deleted — over-limit people become read-only, not gone).
   `planSource:'admin'` grants are **never** overwritten by webhook events (comps survive billing
   noise).
4. **App UI:** an **Account / Upgrade** section in the settings modal (or the auth-footer area):
   current plan, usage meter (AI msgs this month), Upgrade → Checkout, Manage billing → Portal.
   A simple pricing table (from `config/plans`) shown to free users at upsell points.
5. **Tax/invoicing:** enable Stripe Tax + automatic receipts at go-live — configuration, not code.

---

## 8. Phase 6 — SaaS table stakes & polish

Rounding out what a modern SaaS is expected to have. Each item is small; batch as convenient.

- **Account page:** change display name / email (`verifyBeforeUpdateEmail`) / password; **Export my
  data** (callable `exportMyData` → JSON of user doc + profiles + horoscopes); **Delete my account**
  (callable `deleteMyAccount`: cancel Stripe sub → delete subtree → delete Auth user; typed
  confirmation). Export + delete = GDPR arts. 15/17 — you're in the EU and so is the data
  (europe-west6), this is not optional.
- **Legal:** Terms + Privacy pages (public static routes), versioned; sign-up checkbox records
  `tosVersion`/`tosAcceptedAt` (Phase 1 already stores them). Privacy policy must disclose
  admin access to user data and Anthropic as an AI subprocessor.
- **App Check** (reCAPTCHA v3) enforced on Firestore + Functions — raises the bar against scripted
  abuse of `aiProxy` and rules probing. Do it after core flows stabilise; it adds a debugging tax.
- **Transactional email:** Firebase Auth templates (verify/reset/invite) on a custom domain first;
  a provider (e.g. Resend) only when product email (welcome, "payment failed") is wanted. Stripe
  sends its own receipts. The H2 weekly digest (FUTURE_IDEAS) plugs in here later as a paid-tier
  retention feature.
- **Settings sync:** move `hora-prakash-settings` to `users/{uid}/settings/app` (BYOK key stays
  local-only by design — the storage split in `ai.js` already guarantees this).
- **Observability:** Cloud Monitoring alert on function error-rate; budget alerts on the GCP
  project; a `stats/daily` rollup written by a scheduled function if dashboard queries get slow.
  Firestore TTL policy on `auditLogs` (e.g. 400 days).
- **Public face:** the app is 100 % login-walled. Minimal v1: the auth overlay gains a one-line
  pitch + pricing link. A real marketing/landing page is a separate decision (§9) — likely a
  static page outside the app bundle.
- **Backups:** enable Firestore scheduled backups (console setting) before real customers arrive.

Growth features from `FUTURE_IDEAS.md` that become monetisation-relevant once tiers exist:
H1 share links (acquisition), E4 birth card (acquisition), B4 daily guidance + notifications
(retention, natural paid-tier feature), H2 digest (retention). H3 ("free = calculation, paid =
interpretation/AI/reports") is exactly the seam the §6 matrix formalises.

---

## 9. Open decisions (answer before the relevant phase)

1. **Tier names & pricing** (Phase 4 config, Phase 5 Stripe): proposal `free / plus / pro` as in
   §D4 — final feature split and price points are yours. Currency EUR? CHF? (Stripe multi-currency
   prices handle both.)
2. **Trial:** recommend **no card-required trial**; the free tier *is* the trial. `planUntil` +
   admin grants cover bespoke trials.
3. **Google sign-in** at launch? (Recommend yes — trivial cost, real conversion win.)
4. **Custom Stripe functions vs `firestore-stripe-payments` extension:** recommend custom (§D5).
5. **Email verification: soft gate** (recommended, §Phase 1) or hard wall before app use?
6. **Marketing/landing page:** in-repo static page vs separate site vs none-for-now.
7. **License:** the repo is **AGPL-3.0**. Running it as a commercial SaaS is compatible *if* you
   offer the source to users (network-copyleft). As sole copyright holder you can also relicense /
   dual-license before launch. Decide deliberately.
8. **Support role** (read-only admin, no access changes): schema supports it (`role` enum);
   recommend deferring until a second human needs access.

---

## 10. Delivery order, effort, and test map

| Phase | Ships | Effort | Tests added |
|---|---|---|---|
| 1 + 2 | Sign-up, user docs, claims, rules v2, cache hygiene, superadmin bootstrap | **M** | `authz.test.mjs` (in `npm test`), `rules.test.mjs` (`test:rules`, emulator) |
| 3 | `/buro` v1 + admin callables + audit log | **L** | `admin-handlers.test.mjs` (pure handlers) |
| 4 | Entitlements module, UI gates, `aiProxy` enforcement + quotas | **M** | `entitlements.test.mjs` (in `npm test`) |
| 5 | Stripe checkout/portal/webhook, billing states, account/upgrade UI | **M–L** | `stripe-handlers.test.mjs` (fixture events) |
| 6 | GDPR export/delete, legal, App Check, settings sync, observability | **M** (batchable) | extends existing suites |

Sequencing rationale: 1+2 unblock everything and close the shared-browser leak; 3 gives you user
management *before* strangers arrive; 4 must precede any public sign-up announcement (it closes the
AI cost hole) and makes tiers demonstrable with zero billing code; 5 then only automates what 4+3
already do by hand; 6 hardens for real customers. After Phase 4 you can already run a private beta
with hand-granted plans — Stripe is not on the critical path to first users.

Each phase lands as its own PR on a feature branch, `npm test` green, with the new suites wired as
described (emulator-dependent suites stay out of `npm test`, same as `test:ephemeris`).
