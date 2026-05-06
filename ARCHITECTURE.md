# Grudge Studio — Architecture & Operations Guide

> **Last updated**: 2026-05-06
> **Owner**: Racalvin The Pirate King
> **Canonical backend**: The-ENGINE on Railway (`the-engine.up.railway.app`)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE EDGE                          │
│                                                                 │
│  grudge-studio.com ──┐                                          │
│  id.grudge-studio.com ──→ Worker: grudge-identity-api ──┐       │
│  www.grudge-studio.com ─┘                                │       │
│                                                          ▼       │
│  api.grudge-studio.com ──→ Worker: grudge-game-api ──→ Railway  │
│                                                                 │
│  assets.grudge-studio.com ──→ R2 bucket: grudge-assets          │
│  objectstore.grudge-studio.com ──→ Worker: objectstore-api      │
│                                                                 │
│  client.grudge-studio.com ──→ CNAME → Vercel (GrudgeBuilder)   │
│  grudgewarlords.com ──→ Vercel (GrudgeBuilder)                  │
│  wallet.grudge-studio.com ──→ Cloudflare Pages (static)        │
│  dash.grudge-studio.com ──→ Cloudflare Access (→ Pages)        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY                                  │
│                                                                 │
│  The-ENGINE (Node.js + Express + Vite SSR)                      │
│  ├── Player auth (all providers)                                │
│  ├── Game library (1360+ games)                                 │
│  ├── Leaderboards + scores                                      │
│  ├── PvP challenges + GBUX wagers                               │
│  ├── Chat rooms (WebSocket)                                     │
│  ├── Arena rooms (WebSocket multiplayer)                        │
│  ├── Web3/Solana wallets                                        │
│  ├── Discord webhooks                                           │
│  ├── Legion AI (NPC dialogue, moderation, quests)               │
│  ├── GrudaChain (saves, Puter linking)                          │
│  ├── Fleet health monitoring                                    │
│  └── Admin panel (passcode auth)                                │
│                                                                 │
│  PostgreSQL (Railway managed)                                   │
│  └── Drizzle ORM, auto-migrate via `db:push`                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Domain Inventory

| Domain | Platform | Serves | Status |
|--------|----------|--------|--------|
| `grudge-studio.com` | CF Worker → Railway | Portal SPA + API | ✅ Live |
| `id.grudge-studio.com` | CF Worker → Railway | Auth gateway (SSO) | ✅ Live |
| `api.grudge-studio.com` | CF Worker → Railway | Game API (deploy Worker to activate) | ⚠️ Deploy needed |
| `client.grudge-studio.com` | CNAME → Vercel | GrudgeBuilder SPA alias | ✅ Live |
| `grudgewarlords.com` | Vercel | GrudgeBuilder SPA (main) | ✅ Live |
| `assets.grudge-studio.com` | CF R2 | Binary assets CDN | ✅ Live |
| `objectstore.grudge-studio.com` | CF Worker + R2 + D1 | ObjectStore API | ✅ Live |
| `wallet.grudge-studio.com` | CF Pages | Wallet UI | ✅ Live |
| `dash.grudge-studio.com` | CF Access + Pages | Admin dashboard | ⚠️ Needs Grudge auth |
| `ws.grudge-studio.com` | Planned | WebSocket (Railway) | 🔜 Planned |
| `launcher.grudge-studio.com` | DNS exists, nothing deployed | GrudgeDot launcher | 🔜 Planned |
| `grudge-crafting.puter.site` | Puter hosting | Crafting frontend | ✅ Live |
| `grudge-server.puter.work` | Puter Worker | AI/sync worker | ✅ Live |
| `grudgeplatform.com` | Squarespace/static | Command center landing | ✅ Live |
| `grudgeplatform.io` | Dead | Was Web3 hub | ❌ Offline |
| `account.grudge-studio.com` | None | Never had DNS record | ❌ Remove refs |
| `edge.grudge-studio.com` | None | Never had DNS record | ❌ Remove refs |
| `ale.grudge-studio.com` | None | Never had DNS record | ❌ Remove refs |

## 3. Cloudflare Workers

| Worker Name | Route | Backend | Source |
|-------------|-------|---------|--------|
| `grudge-identity-api` | `id.grudge-studio.com/*`, `grudge-studio.com/*` | Railway | `deploy/auth-gateway/` |
| `grudge-game-api` | `api.grudge-studio.com/*` | Railway | `deploy/game-api-gateway/` |
| `objectstore-api` | `objectstore.grudge-studio.com/*` | R2 + D1 | Separate repo |

### Deploying a Worker
```bash
cd deploy/game-api-gateway   # or auth-gateway
npx wrangler deploy
```

### Adding a new subdomain
1. In Cloudflare DNS: add proxied A record `subdomain → 192.0.2.1` (dummy IP, Worker intercepts)
2. Add `[[routes]]` entry to the appropriate Worker's `wrangler.toml`
3. Add origin to `ALLOWED_ORIGINS` in `wrangler.toml`
4. Redeploy: `npx wrangler deploy`

## 4. Authentication Flow

```
User clicks "Sign In" on any Grudge frontend
        │
        ▼
Option A: Grudge ID SSO
  → Redirect to id.grudge-studio.com
  → User logs in (password, Puter, Discord, Google, GitHub, Phantom, phone)
  → Railway sets gs_player_session cookie (domain: .grudge-studio.com)
  → Redirect back with ?grudge_token=<JWT> for cross-domain sites
  → Target site calls POST /api/auth/session/exchange to get its own cookie

Option B: Direct API (same-origin)
  → POST /api/auth/login { username, password }
  → POST /api/auth/guest
  → POST /api/auth/puter-sso { puterId, puterUsername }
  → POST /api/auth/phantom/nonce → POST /api/auth/phantom/verify
  → Response: { id, username, grudgeId, gbuxBalance, role, ... }
  → Cookie set automatically

All subsequent requests:
  → Cookie: gs_player_session=<HMAC token>
  → Middleware: loadPlayer → req.player = { id, username, grudgeId, ... }
```

### Auth providers supported
- Username + password
- Guest (anonymous, upgradeable)
- Puter SDK (auto-creates Grudge account)
- Phantom / Solflare (Ed25519 signature)
- Discord OAuth2
- Google OAuth2
- GitHub OAuth2
- Phone / SMS (Twilio)

### Role hierarchy
`guest (0) → player (1) → member (2) → admin (3) → master (4)`

## 5. API Surface

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login (username/email/grudgeId) |
| POST | `/api/auth/guest` | — | Guest sign-in |
| POST | `/api/auth/puter-sso` | — | Puter → Grudge account |
| POST | `/api/auth/phantom/nonce` | — | Wallet challenge |
| POST | `/api/auth/phantom/verify` | — | Wallet verify + login |
| GET | `/api/auth/discord/start` | — | Discord OAuth redirect |
| GET | `/api/auth/google/start` | — | Google OAuth redirect |
| GET | `/api/auth/github/start` | — | GitHub OAuth redirect |
| POST | `/api/auth/phone/send` | — | SMS verification code |
| POST | `/api/auth/phone/verify` | — | Verify code → login |
| GET | `/api/auth/me` | ✅ | Current user info |
| POST | `/api/auth/logout` | — | Clear session |
| POST | `/api/auth/complete-profile` | ✅ | Claim username after quick-link |
| POST | `/api/auth/popup-token` | ✅ | Mint cross-domain JWT |
| POST | `/api/auth/session/exchange` | — | Exchange JWT for cookie |

### Leaderboards & Scores
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/scores` | ✅ | Submit score |
| GET | `/api/leaderboards/global` | — | Global top players |
| GET | `/api/leaderboards/:gameId` | — | Per-game leaderboard |
| GET | `/api/leaderboards/:gameId/me` | ✅ | My rank on a game |

### Challenges (PvP)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/challenges` | ✅ | Create challenge (+ GBUX wager) |
| POST | `/api/challenges/:id/accept` | ✅ | Accept challenge |
| POST | `/api/challenges/:id/decline` | ✅ | Decline (refunds wager) |
| POST | `/api/challenges/:id/result` | ✅ | Submit scores → winner gets payout |
| GET | `/api/challenges/active` | ✅ | My active challenges |
| GET | `/api/challenges/pending` | ✅ | My pending challenges |

### Economy
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | ✅ | GBUX transaction history |
| GET | `/api/me/stats` | ✅ | Player stats + balance |

### Chat (REST + WebSocket)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/chat/messages?room=` | — | Chat history |
| GET | `/api/chat/rooms` | — | Available rooms |
| WS | `/ws/chat` | cookie | Real-time chat |

### Arena (WebSocket)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| WS | `/ws/arena` | — | Multiplayer arena rooms |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/login` | passcode | Admin login |
| GET | `/api/admin/session` | cookie | Check admin session |
| GET | `/api/admin/fleet/health` | admin | Service health |
| GET | `/api/admin/fleet/services` | — | Service registry |

### Other
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Health check |
| GET | `/api/fleet/status` | — | Public fleet health |
| POST | `/api/legion/chat` | — | AI chat |
| GET | `/api/games/top` | — | Popular games |
| GET | `/api/public/landing` | — | Landing page data feed |

## 6. Database Schema (Railway Postgres)

Core tables managed by Drizzle ORM (`shared/schema.ts`):

- `users` — accounts with grudgeId, puterId, solanaAddress, discordId, etc.
- `scores` — per-game score entries with personal best / global record flags
- `challenges` — PvP challenges with GBUX wager escrow
- `transactions` — GBUX ledger (wager, reward, purchase, refund)
- `web3_transactions` — Solana on-chain transaction log
- `wallet_connections` — linked wallet addresses per user
- `game_library` — 1360+ playable games
- `game_platforms` — NES, SNES, N64, etc.
- `chat_messages` — persistent chat history
- `scraping_jobs` / `scraped_pages` — web scraper
- `store_products` / `orders` — GBUX store
- `articles` — news feed

### Running migrations
```bash
npm run db:push   # applies schema changes to Railway Postgres
```

## 7. Environment Variables (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Railway Postgres connection string |
| `SESSION_SECRET` | ✅ | HMAC signing key for player sessions |
| `JWT_SECRET` | ✅ | HS256 signing key for launch tokens (shared with Workers) |
| `ADMIN_PASSCODE` | ✅ | Admin panel passcode |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `DISCORD_CLIENT_ID` | ⚠️ | Discord OAuth |
| `DISCORD_CLIENT_SECRET` | ⚠️ | Discord OAuth |
| `DISCORD_REDIRECT_URI` | ⚠️ | e.g. `https://id.grudge-studio.com/api/auth/discord/callback` |
| `GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ⚠️ | Google OAuth |
| `GOOGLE_REDIRECT_URI` | ⚠️ | e.g. `https://id.grudge-studio.com/api/auth/google/callback` |
| `GITHUB_CLIENT_ID` | ⚠️ | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | ⚠️ | GitHub OAuth |
| `GITHUB_REDIRECT_URI` | ⚠️ | e.g. `https://id.grudge-studio.com/api/auth/github/callback` |
| `TWILIO_ACCOUNT_SID` | ⚠️ | Phone auth |
| `TWILIO_AUTH_TOKEN` | ⚠️ | Phone auth |
| `TWILIO_PHONE_NUMBER` | ⚠️ | SMS sender number |
| `DISCORD_WEBHOOK_URL` | ⚠️ | Score/challenge notifications |
| `SOLANA_RPC_URL` | ⚠️ | Solana RPC for Web3 features |
| `TREASURY_PRIVATE_KEY` | ⚠️ | Platform treasury wallet |
| `GBUX_MINT_ADDRESS` | ⚠️ | GBUX SPL token mint |

## 8. Adding a New Game or Service

### Adding a game to the library
1. Insert into `game_library` table (via admin panel or SQL)
2. Set `platform`, `embedUrl`, `thumbnailUrl`
3. Game automatically appears in leaderboards, challenges, and the portal

### Adding a new frontend/service
1. Deploy frontend to Vercel / Cloudflare Pages / Puter
2. Add its origin to `CORS_ORIGINS` in Railway env vars AND in the appropriate Worker's `ALLOWED_ORIGINS`
3. Integrate auth: load `https://js.puter.com/v2/` and use Puter SSO, OR redirect to `id.grudge-studio.com`
4. Use `?grudge_token=<jwt>` → `POST /api/auth/session/exchange` for cross-domain cookie
5. Add to `ARCHITECTURE.md` domain inventory

### Adding a new API module
1. Create `server/my-feature.ts` with Express Router
2. Import and mount in `server/routes.ts`: `app.use("/api/my-feature", myFeatureRouter)`
3. Add schema tables to `shared/schema.ts` if needed
4. Run `npm run db:push` on Railway
5. Document endpoints in this file

## 9. Deploy Procedures

### Railway (backend)
- Push to `main` branch → Railway auto-deploys
- Build: `vite build && esbuild server/index.ts`
- Start: `node dist/index.js`
- Migrations: run automatically if `db:push` is in start script, or run manually via Railway shell

### Cloudflare Workers
```bash
cd deploy/auth-gateway       # or game-api-gateway
npx wrangler deploy          # deploys to production
npx wrangler tail             # live logs
```

### Vercel (GrudgeBuilder)
- Push to `main` branch → Vercel auto-deploys
- Rewrites in `vercel.json` proxy API calls to `id.grudge-studio.com` and `api.grudge-studio.com`

## 10. Decommissioned Systems

| System | Was | Now | Notes |
|--------|-----|-----|-------|
| VPS Docker + Cloudflare Tunnel | `api.grudge-studio.com` backend | **DEAD** | Replaced by Railway. Tunnel disconnected. Worker gateway replaces it. |
| `grudge-backend` repo | Full game API + auth | **CODE SOURCE ONLY** | Schema/route patterns were reference for The-ENGINE. Do not restore. |
| `account.grudge-studio.com` | Planned separate account service | **NEVER EXISTED** | DNS record was never created. All account calls go through api.grudge-studio.com. |
| `edge.grudge-studio.com` | Badge-reader Worker | **NEVER EXISTED** | DNS record was never created. Worker source exists but was never deployed. |
| `ale.grudge-studio.com` | AI gateway Worker | **NEVER EXISTED** | DNS record was never created. ALE Worker source exists in grudge-backend. |
| `grudgeplatform.io` | Web3 hub | **OFFLINE** | Was Vercel, now 404. grudgeplatform.com still live. |
| `grudgedot-launcher.vercel.app` | GrudgeDot launcher | **DEAD** | 404. Canonical launcher will be at launcher.grudge-studio.com. |

## 11. Patterns & Conventions

- **Single backend**: Everything goes through Railway (The-ENGINE). No separate microservices.
- **Cloudflare Workers as reverse proxies**: Workers handle DNS routing and CORS. They don't contain business logic.
- **Cookie-based sessions**: HMAC-signed `gs_player_session` cookie, domain `.grudge-studio.com`, 7-day TTL.
- **Launch tokens for cross-domain**: Short-lived HS256 JWTs (`grudge_token`) for handoff between domains.
- **Drizzle ORM**: All DB access through Drizzle. Schema in `shared/schema.ts`. Migrate with `db:push`.
- **No localStorage for identity**: Sessions are server-side cookies. Client stores minimal display data only.
- **GBUX is the universal currency**: Earned via scores, wagered in challenges, spent in store.
- **Discord webhooks**: Scores, records, and challenge results auto-post to Discord.
- **Puter SDK for AI**: Client-side AI calls go through `puter.ai.*` (user pays). Server AI uses Legion module.
