# Grudge Studio — Authentication API

**Base URL:** `https://grudge-studio.com` (canonical)
Also served identically at `https://id.grudge-studio.com` and `https://www.grudge-studio.com`.
Path alias: `/auth/*` is automatically rewritten to `/api/auth/*` at the Cloudflare Worker layer.

---

## Session model

Every successful auth call sets an **HttpOnly** session cookie:

| Attribute | Value |
|---|---|
| Name | `gs_player_session` |
| Domain | `.grudge-studio.com` (shared across all subdomains) |
| SameSite | `None` (cross-site requests supported) |
| Secure | `true` in production |
| Max-Age | 7 days |

All subsequent requests must include `credentials: "include"` so the cookie is sent.
No `Authorization` header is required or used.

---

## PlayerProfile response shape

Every auth endpoint that creates or identifies a session returns this object:

```json
{
  "id": 7,
  "username": "racalvin",
  "grudgeId": "GRUDGE-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "Racalvin The Pirate King",
  "avatarUrl": "https://cdn.discordapp.com/...",
  "gbuxBalance": "0.0000",
  "role": "player",
  "needsProfile": false,
  "isNew": false
}
```

`needsProfile: true` means the user was created via a quick-link provider (guest, wallet,
phone) and should be prompted to claim a username via `POST /api/auth/complete-profile`.

---

## Endpoints

### Health

#### `GET /api/health`
No auth required.
```json
{ "status": "ok", "ts": 1714800000000, "env": "production" }
```

---

### Session management

#### `GET /api/auth/me`
Returns the current session's `PlayerProfile` or `401 { "error": "Not authenticated" }`.

#### `POST /api/auth/logout`
Clears the session cookie.
```json
{ "success": true }
```

#### `GET /api/auth/allowed-origins`
Returns the list of origins currently allowed for cross-domain auth.
```json
{ "origins": ["https://grudgewarlords.com", "https://grudge-studio.com", ...] }
```

---

### Username/password

#### `POST /api/auth/register`
```json
// Request
{ "username": "racalvin", "password": "min6chars", "email": "opt@example.com", "displayName": "Racalvin" }

// 200 → PlayerProfile
// 400 → { "error": "username must be 3-30 characters" }
// 409 → { "error": "Username already taken" }
```

#### `POST /api/auth/login`
Accepts `username`, `email`, or `GRUDGE-…` ID in the `username` field.
```json
// Request
{ "username": "racalvin", "password": "mypassword" }

// 200 → PlayerProfile
// 401 → { "error": "Invalid credentials" }
```

#### `GET /api/auth/lookup?username=<name>`
Public — no session needed. Returns minimal profile for a username.
```json
{ "id": 7, "username": "racalvin", "displayName": "...", "avatarUrl": "...", "grudgeId": "GRUDGE-..." }
```

---

### Guest

#### `POST /api/auth/guest`
Creates a temporary guest account, sets a session cookie, and returns a `PlayerProfile`
with `role: "guest"` and `needsProfile: true`.
No request body required.

The guest can be upgraded to a full account via `complete-profile`.

---

### Complete profile (post quick-link)

#### `POST /api/auth/complete-profile` 🔒
Required after guest, wallet, or phone sign-in when `needsProfile: true`.
All fields optional — only provided fields are updated.
```json
// Request
{ "username": "racalvin", "displayName": "Racalvin The Pirate King", "email": "opt@example.com" }

// 200 → PlayerProfile
// 400 → { "error": "Username must be 3-30 characters" }
// 409 → { "error": "Username already taken" }
```

---

### Google (via Puter SDK)

Google authentication is handled entirely through the Puter SDK on the frontend.
No Google Cloud Console credentials are required on the server.

**Frontend flow:**
```js
await puter.auth.signIn();              // opens Puter/Google OAuth dialog
const u = await puter.auth.getUser();   // { uuid, username, email }
// then POST /api/auth/puter-sso with the puter ID
```

The server-side Google OAuth routes (`/api/auth/google/start` and
`/api/auth/google/callback`) exist as a fallback but are unused in the
current frontend and require `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to be active.

---

### Puter SSO

#### `POST /api/auth/puter-sso`
Links or creates a Grudge account from a verified Puter user.
Called after `puter.auth.signIn()` on the frontend.
```json
// Request
{ "puterId": "puter-uuid-here", "puterUsername": "racalvin", "email": "opt@example.com" }

// 200 → PlayerProfile
// 400 → { "error": "puterId is required" }
```

---

### Discord OAuth

#### `GET /api/auth/discord/start?redirect=<url>`
Redirects the browser to Discord's authorization page.

- `redirect` — where to land after login. Same-domain paths (`/game`) are
  redirected directly with `?auth=discord&new=0|1` appended.
  Cross-domain allowlisted URLs receive a short-lived `grudge_token` JWT.

#### `GET /api/auth/discord/callback` (Discord calls this)
Completes the OAuth exchange, sets the session cookie, and redirects to
the URL that was stored in `state` when `/start` was called.

**Required env vars:** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`

---

### GitHub OAuth

#### `GET /api/auth/github/start?redirect=<url>`
Redirects to GitHub's authorization page (scope: `read:user user:email`).

#### `GET /api/auth/github/callback` (GitHub calls this)
Completes the exchange and redirects with the session set.

**Required env vars:** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`

---

### Phantom / Solana wallet

Three-step challenge–response flow. Works with any Solana wallet (Phantom extension,
Phantom embedded Google/Apple wallet, mobile deeplink).

#### Step 1 — `POST /api/auth/phantom/nonce`
```json
// Request
{ "address": "<base58 Solana public key>" }

// 200
{ "nonce": "f11922a5...", "message": "Sign in to Grudge Studio\n\nAddress: ...\nNonce: ...\nIssued: ..." }
```
Nonce expires in **5 minutes**.

#### Step 2 — sign on the client
```js
// Using Phantom Browser SDK
const result = await sdk.solana.signMessage(message);
const signatureB58 = base58Encode(result.signature);
```

#### Step 3 — `POST /api/auth/phantom/verify`
```json
// Request
{ "address": "<base58>", "nonce": "<hex>", "signature": "<base58 sig>" }

// 200 → PlayerProfile
// 400 → { "error": "Nonce expired or not found" }
// 401 → { "error": "Signature verification failed" }
```

**No env vars required** — ed25519 signature verification is done on-chain locally
using `tweetnacl`.

---

### Phone OTP (Twilio Verify)

#### `POST /api/auth/twilio/start`
```json
// Request — E.164 format required
{ "phone": "+15551234567" }

// 200 (Twilio configured)
{ "status": "sent" }

// 200 (Twilio not configured — dev fallback, OTP logged to server stdout)
{ "status": "dev", "message": "Twilio not configured; check server logs for dev OTP." }

// 500 → { "error": "Failed to send SMS code — phone provider error" }
```

#### `POST /api/auth/twilio/verify`
```json
// Request
{ "phone": "+15551234567", "code": "123456" }

// 200 → PlayerProfile (needsProfile: true)
// 401 → { "error": "Invalid or expired code" }
```

**Required env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID`
Phone codes expire in **10 minutes**.

---

### Cross-domain popup handoff

Used by external Grudge frontends (e.g. `grudgewarlords.com`) to embed the Grudge
sign-in modal and receive a session without direct database access.

**Flow:**

1. External site opens `https://grudge-studio.com/auth/popup?audience=https://grudgewarlords.com`
   in a popup window.
2. User signs in through the normal modal.
3. After sign-in, the popup calls `POST /api/auth/popup-token` to mint a short-lived JWT.
4. JWT is `postMessage`d back to the opener as `{ type: "grudge:auth:success", token, player }`.
5. Opener calls `POST /api/auth/session/exchange` on its own domain to redeem the JWT
   for a session cookie.

#### `POST /api/auth/popup-token` 🔒
```json
// Request (optional audience restriction)
{ "audience": "https://grudgewarlords.com" }

// 200
{ "token": "<HS256 JWT>", "expiresIn": 300, "audience": "https://grudgewarlords.com" }

// 403 → { "error": "Audience origin is not allowlisted" }
```
Token expires in **5 minutes** and is single-use by design.

#### `POST /api/auth/session/exchange`
```json
// Request
{ "token": "<HS256 JWT>", "audience": "https://grudgewarlords.com" }

// 200 → PlayerProfile + sets gs_player_session cookie
// 401 → { "error": "Invalid or expired launch token" }
// 403 → { "error": "Origin is not allowlisted" }
```
The caller's `Origin` header (or the `audience` body field) must match the token's
`aud` claim and be on the `AUTH_ALLOWED_ORIGINS` allowlist.

---

### Cross-domain OAuth callback redirect

When an OAuth `/start` is called with a cross-domain `redirect` URL, the server
appends a launch token to the callback:

```
https://grudgewarlords.com/auth-callback.html
  ?grudge_token=<JWT>
  &auth=discord
  &new=1
```

The receiving page should call `POST /api/auth/session/exchange` with that token to
establish a local session cookie for `grudgewarlords.com`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | ✅ | HMAC key for player session cookies and JWT fallback |
| `JWT_SECRET` | recommended | Dedicated key for cross-domain launch JWTs |
| `PLAYER_SESSION_SECRET` | optional | Separate key for player cookies (falls back to `SESSION_SECRET`) |
| `CORS_ORIGINS` | ✅ | Comma-separated origins allowed to call `/api/*` with credentials |
| `AUTH_ALLOWED_ORIGINS` | recommended | Origins allowed to receive launch JWTs (falls back to `CORS_ORIGINS`) |
| `DISCORD_CLIENT_ID` | for Discord OAuth | |
| `DISCORD_CLIENT_SECRET` | for Discord OAuth | |
| `DISCORD_REDIRECT_URI` | for Discord OAuth | e.g. `https://id.grudge-studio.com/auth/discord/callback` |
| `GITHUB_CLIENT_ID` | for GitHub OAuth | |
| `GITHUB_CLIENT_SECRET` | for GitHub OAuth | |
| `GITHUB_REDIRECT_URI` | for GitHub OAuth | e.g. `https://grudge-studio.com/api/auth/github/callback` |
| `TWILIO_ACCOUNT_SID` | for phone OTP | |
| `TWILIO_AUTH_TOKEN` | for phone OTP | |
| `TWILIO_VERIFY_SID` | for phone OTP | Twilio Verify service SID |
| `VITE_PHANTOM_APP_ID` | recommended | Phantom Portal app ID (defaults to project ID) |
| `PLAYER_COOKIE_DOMAIN` | optional | Cookie domain (defaults to `.grudge-studio.com` in production) |

Google OAuth uses the Puter SDK on the frontend — no `GOOGLE_CLIENT_ID` is required.

---

## Infrastructure

| Layer | Service | Notes |
|---|---|---|
| DNS / Proxy | Cloudflare Worker `grudge-identity-api` | Handles `grudge-studio.com`, `www.*`, `id.*` |
| Origin | Railway `the-engine` | Express + Vite, `the-engine.up.railway.app` |
| Database | Railway Postgres | Injected as `DATABASE_URL` |
| Path alias | Worker + Express | `/auth/*` → `/api/auth/*` at both layers |
| Cookie scope | Express `auth.ts` | `Domain=.grudge-studio.com` in production |

Worker source: `deploy/auth-gateway/src/index.ts`
Deploy: `cd deploy/auth-gateway && npx wrangler deploy`

---

## Quick integration snippet

```js
// From any Grudge frontend — sign in via the Grudge popup
import { openAuthPopup, exchangeLaunchToken } from "@grudge/player-auth";

const { token, player } = await openAuthPopup({
  authHost: "https://grudge-studio.com",
  audience: window.location.origin,
});

// Exchange token for a local session cookie on this domain
const result = await exchangeLaunchToken(token);
if (result.ok) {
  console.log("Signed in as", result.player.username);
}
```
