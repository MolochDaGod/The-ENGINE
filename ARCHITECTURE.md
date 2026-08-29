# Grudge Studio — Architecture & Operations Guide

> **Last updated**: 2026-06-09
> **Owner**: Racalvin The Pirate King
> **Canonical backend**: The-ENGINE on Railway (`the-engine.up.railway.app`)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE  (56 DNS records)             │
│                                                                 │
│  CF Tunnels → Railway:                                          │
│    api.grudge-studio.com  ──→ Game API gateway                  │
│    id.grudge-studio.com   ──→ Auth gateway (SSO)                │
│    dash.grudge-studio.com ──→ Admin dashboard                   │
│    ws.grudge-studio.com   ──→ WebSocket endpoint                │
│                                                                 │
│  CF Workers (AAAA 100:: / A 192.0.2.1):                         │
│    ai.grudge-studio.com   ──→ Legion AI hub                     │
│    forge.grudge-studio.com──→ Forge Worker                      │
│    models.grudge-studio.com─→ 3D model API                      │
│    objectstore ──→ Worker + R2 + D1                             │
│    auth, characters, grudachain, vps                             │
│                                                                 │
│  CF R2:  assets.grudge-studio.com ──→ public.r2.dev             │
│  CF Pages: browse, coder, fleet, grudgedot, wcs                 │
│  CF Tunnel (VPS): conan.grudge-studio.com ──→ Conan server      │
│                                                                 │
│  17 Vercel CNAMEs → cname.vercel-dns.com (DNS only)             │
│  Email: 3 MX + SPF + DKIM                                      │
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

┌─────────────────────────────────────────────────────────────────┐
│                    PUTER PLATFORM                                │
│                                                                 │
│  *.puter.site        — Static sites (launcher, crafting, etc.)  │
│  *.puter.work        — Puter Workers (AI, GrudaChain, sprites)  │
│  puter.com/KV        — Player save cache, objectstore sync      │
│  puter.com/FS        — Uploaded assets, player content           │
│  puter.com/AI        — Client-side AI (user-pays model)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    GRUDGEYONKO VPS (game servers only)           │
│                                                                 │
│  Conan Exiles dedicated server (D:\ConanServer)                  │
│  Conan admin panel + Discord bot (D:\conan-admin)                │
│  Future: grudge-openworld-server (multiplayer rooms)             │
│  ⚠ NOT auth/API — those are Railway only                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    GRUDGE-WARLORDS ORG (GitHub)                  │
│                                                                 │
│  grudge-openworld-server — room-based multiplayer (pending)     │
│  → Connects to Railway for auth + persistence                   │
│  → Wired through cf-game-servers worker for matchmaking         │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Domain Inventory

### Backend Services (Cloudflare-proxied)
| Domain | Type | Origin | Status |
|--------|------|--------|--------|
| `api.grudge-studio.com` | CF Tunnel | Railway (The-ENGINE) | ✅ Live |
| `id.grudge-studio.com` | CF Tunnel | Railway (GrudgeID / Keel) | ✅ Live — 200 Sign in, no x-vercel. Player SSOT is Railway, not Neon. Auth front door, not The-ENGINE origin. |
| `auth.grudge-studio.com` | CF Worker (A 192.0.2.1) | Railway (legacy alias) | ✅ Live |
| `ws.grudge-studio.com` | CF Tunnel | Railway WebSocket | ✅ Live (WS only) |
| `dash.grudge-studio.com` | Vercel origin | Dashboard | ✅ Live — 200 Dashboard WITH x-vercel (2026-08-29) |
| `ai.grudge-studio.com` | CF Worker (AAAA 100::) | Legion AI hub | ✅ Live (401 auth-gated) |
| `assets.grudge-studio.com` | CNAME → public.r2.dev | R2 binary CDN | ✅ Live — CDN 2.2.0 (2026-08-29) |
| `objectstore.grudge-studio.com` | CF Worker (AAAA 100::) | R2 + D1 | ✅ Live — Worker objectstore-api 3.4.0, catalog JSON 5.0.0 (NOT a dead static SPA) |
| `models.grudge-studio.com` | CF Worker (AAAA 100::) | 3D model API | ✅ Live |
| `forge.grudge-studio.com` | CF Worker (AAAA 100::) | Forge Worker | ✅ Live |
| `vps.grudge-studio.com` | CF Worker (AAAA 100::) | VPS proxy | ✅ Live |
| `wallet.grudge-studio.com` | A → 74.208.155.229 | Wallet UI (external) | ✅ Live |
| `conan.grudge-studio.com` | CF Tunnel | Conan game server (VPS) | ⚠️ 502 (server offline) |
| `account.grudge-studio.com` | | | ⚠️ 522 per verified facts (2026-08-29) |
| `assets-api.grudge-studio.com` | | | ⚠️ 522 per verified facts (2026-08-29) |

### Frontend Domains (Vercel — CNAME → cname.vercel-dns.com, DNS only)

**The-ENGINE Vercel Project** (verified 2026-08-29):
- Team: `grudgenexus`
- Project slug: `the-engine`
- Project ID: `prj_kzJDFjk5t5KJsXwmILyBabZ2T70S`
- GitHub: `MolochDaGod/The-ENGINE`
- Title: **Rec0deD:88 — Grudge Studio Gaming Portal**
- Production deployment: `dpl_2qxQkWQ7bBDMgKv2tssL6W5ARmdx` (main SHA `4fd24ca`, source: cli with gitDirty)

**Production domains:**

| Domain | Project | Status | Notes |
|--------|---------|--------|-------|
| `grudge-studio.com` | the-engine | ✅ Live | Apex — Cloudflare in front, Vercel origin |
| `www.grudge-studio.com` | the-engine | ✅ Live | WWW — Cloudflare in front, Vercel origin |

**Preview-only domains (NOT production):**

| Domain | Project | Notes |
|--------|---------|-------|
| `the-engine-grudgenexus.vercel.app` | the-engine | Preview only — never treat as prod |
| `the-engine-snowy.vercel.app` | the-engine | Preview only — never treat as prod |
| Per-deploy `*.vercel.app` | the-engine | Preview only — never treat as prod |
| ⚠️ `the-engine.vercel.app` | **NOT Grudge** | Unrelated civic OS — never point studio traffic here |

**Vercel aliases (listed on project but live via CF, not Vercel):**

| Domain | Listed on Vercel | Actual Live Route | Verified 2026-08-29 |
|--------|------------------|-------------------|---------------------|
| `id.grudge-studio.com` | ✅ | CF + Railway (GrudgeID / Keel) | ✅ 200 Sign in, no x-vercel |
| `fleet.grudge-studio.com` | ✅ | CF HTML | ✅ 200 Harbor Map, no x-vercel |
| `characters.grudge-studio.com` | ✅ | CF | ⚠️ 522 |
| `dash.grudge-studio.com` | Listed elsewhere | Vercel origin | ✅ 200 Dashboard WITH x-vercel |
| `account.grudge-studio.com` | | | ⚠️ 522 |
| `assets-api.grudge-studio.com` | | | ⚠️ 522 |

**Other Vercel Projects:**
| `grudgewarlords.com` | grudge-builder | ✅ Live | Separate project — GitHub MolochDaGod/Grudge-Builder |
| `warlord3d.grudge-studio.com` | grudge-builder | ✅ Live |
| `test.grudge-studio.com` | grudge-builder | ✅ Live |
| `ui.grudge-studio.com` | grudge-ui-editor | ✅ Live |
| `tv.grudge-studio.com` | grudatv | ✅ Live |
| `play.grudge-studio.com` | star-way-gruda-web-client | ✅ Live |
| `characters.grudge-studio.com` | playground | ⚠️ 522 | Verified 2026-08-29: CF 522, not Live |
| `dcq.grudge-studio.com` | dungeon-crawler-quest | ✅ Live |
| `metaverse.grudge-studio.com` | grudge-metaverse | ✅ Live |
| `info.grudge-studio.com` | objectstore-grudge | ✅ Live |
| `survival.grudge-studio.com` | survival | ✅ Live |
| `grudges.grudge-studio.com` | survival | ✅ Live |
| `armada.grudge-studio.com` | grim-armada-web | ✅ Live |
| `drive.grudge-studio.com` | grudge-drive | ✅ Live |
| `grudge6.grudge-studio.com` | character-viewer | ✅ Live |
| `grudge-arena.grudge-studio.com` | grudge-arena | ✅ Live |
| `wow.grudge-studio.com` | wow-frontend | ✅ Live |
| `dev.grudge-studio.com` | grudgedot-launcher | ✅ Live |
| `platform.grudge-studio.com` | grudachain | ✅ Live |
| `apps.grudge-studio.com` | grudge-platform | ✅ Live |
| `client.grudge-studio.com` | grudge-builder (alias) | ✅ Live |

### Cloudflare Pages
| Domain | Pages project | Status | Verified 2026-08-29 |
|--------|---------------|--------|---------------------|
| `browse.grudge-studio.com` | grudge-objectstore | ✅ Live | |
| `fleet.grudge-studio.com` | grudge-fleet | ✅ Live | 200 Harbor Map, CF HTML, no x-vercel |
| `coder.grudge-studio.com` | grudgechain-vibe-ide | ✅ Live | |
| `grudgedot.grudge-studio.com` | grudgedot | ✅ Live | |
| `wcs.grudge-studio.com` | grudge-wcs | ✅ Live | |

### Puter
| Domain | Serves | Status |
|--------|--------|--------|
| `grudge-crafting.puter.site` | Crafting frontend | ✅ Live |
| `grudge-ui-editor.puter.site` | UI Kit editor (mirror) | ✅ Live |
| `grudge-server.puter.work` | AI/sync worker | ✅ Live |

### Other Domains
| Domain | Status |
|--------|--------|
| `grudgeplatform.com` | ✅ Live (Squarespace) |
| `grudachain.grudgestudio.com` | ✅ Live (Vercel) |
| `grudgeplatform.io` | ❌ Offline (unverified in Vercel) |

### Decommissioned (2026-08-29)
| Record | Was | Reason |
|--------|-----|--------|
| `world.grudge-studio.com` | CNAME → dead CF tunnel | Removed — re-add when openworld server deploys |
| `nemesis.grudge-studio.com` | CNAME → stale Railway deploy | **NOW LIVE** at nemesis.grudge-studio.com (production TCG) |
| `battle.thc-labz.xyz.grudge-studio.com` | CNAME → dead CF tunnel | Removed — wrong zone (belongs on thc-labz.xyz) |
| `_railway-verify.nemesis` | TXT | Removed — orphaned verification record |
| ⚠️ `the-engine.vercel.app` | Was believed to be The-ENGINE | **NOT Grudge** — unrelated civic OS. Never point studio traffic there. |

### Grudge-Warlords GitHub Org
| Repo | Purpose | Status |
|------|---------|--------|
| `grudge-openworld-server` | Multiplayer room server — room-based world instances with player sync | ⚠️ Not deployed |

The openworld server will connect to Railway (The-ENGINE) for auth + persistence. When deployed, re-add `world.grudge-studio.com` DNS.

## 3. Cloudflare Configuration

### DNS Management
DNS is managed via Cloudflare API using `CF_DNS_EDIT_TOKEN` (Zone DNS Edit scope on `grudge-studio.com`).
Zone ID: `e8c0c2ee3063f24eb31affddabf9730a`

**Adding a Vercel subdomain** (automated via API):
1. Create CNAME `subdomain → cname.vercel-dns.com` (proxy OFF)
2. Add domain to Vercel project
3. Issue SSL cert via Vercel API

**Adding a CF Worker subdomain**:
1. Create proxied A `subdomain → 192.0.2.1` or AAAA `→ 100::`
2. Add `[[routes]]` to Worker's `wrangler.toml`
3. Add origin to `ALLOWED_ORIGINS`
4. Deploy: `npx wrangler deploy`

### Workers
| Worker Name | Route | Backend | Source |
|-------------|-------|---------|--------|
| `grudge-identity-api` | `id.grudge-studio.com/*`, `grudge-studio.com/*` | Railway | `deploy/auth-gateway/` |
| `grudge-game-api` | `api.grudge-studio.com/*` | Railway | `deploy/game-api-gateway/` |
| `objectstore-api` | `objectstore.grudge-studio.com/*` | R2 + D1 | Separate repo |

### Cloudflare Tunnels
| Tunnel ID | Subdomains |
|-----------|------------|
| `fbba62f9-49df-...` | api, id, dash, ws |
| `2a20e3d9-ce4f-...` | conan (VPS) |

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

### Friends
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/friends/request` | ✅ | Send friend request (by userId or username) |
| POST | `/api/friends/:id/accept` | ✅ | Accept pending request |
| POST | `/api/friends/:id/block` | ✅ | Block user |
| DELETE | `/api/friends/:id` | ✅ | Remove friend |
| GET | `/api/friends` | ✅ | List accepted friends (with online status) |
| GET | `/api/friends/pending` | ✅ | List pending incoming requests |

### Tournaments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tournaments` | — | List tournaments (filter by ?status=) |
| GET | `/api/tournaments/:id` | — | Tournament detail + bracket + players |
| POST | `/api/tournaments` | ✅ | Create tournament (auto-joins creator) |
| POST | `/api/tournaments/:id/join` | ✅ | Join open tournament |
| POST | `/api/tournaments/:id/start` | admin | Start — generates bracket, seeds players |
| POST | `/api/tournaments/:tid/matches/:mid/result` | ✅ | Report match scores → auto-advance winner |

### Challenges (PvP)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/challenges` | ✅ | Create challenge (+ GBUX wager) |
| POST | `/api/challenges/:id/accept` | ✅ | Accept challenge |
| POST | `/api/challenges/:id/decline` | ✅ | Decline (refunds wager) |
| POST | `/api/challenges/:id/result` | ✅ | Submit scores → winner gets payout |
| GET | `/api/challenges/active` | ✅ | My active challenges |
| GET | `/api/challenges/pending` | ✅ | My pending challenges |

### Account / Profile
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me/stats` | ✅ | Player stats aggregate |
| GET | `/api/me/scores` | ✅ | Recent scores (limit param) |
| GET | `/api/me/games` | ✅ | Games played with best scores |
| PATCH | `/api/me/profile` | ✅ | Update displayName, bio, avatarUrl |
| GET | `/api/me/connections` | ✅ | All linked providers + wallets |
| GET | `/api/me/wallets` | ✅ | List wallet_connections rows |
| POST | `/api/me/wallets` | ✅ | Add wallet connection |
| DELETE | `/api/me/wallets/:id` | ✅ | Remove wallet connection |

### Economy
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | ✅ | GBUX transaction history |

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

- `users` — accounts with grudgeId, puterId, solanaAddress, discordId, bio, etc.
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

### Vercel (The-ENGINE frontend)

**Current Production State (2026-08-29):**
- Team: `grudgenexus`
- Project: `the-engine` (prj_kzJDFjk5t5KJsXwmILyBabZ2T70S)
- Deployment: `dpl_2qxQkWQ7bBDMgKv2tssL6W5ARmdx`
- Source: `cli` with `gitDirty` ⚠️
- Main SHA: `4fd24ca`
- ⚠️ **Hygiene issue:** Production is a dirty CLI deploy, not a clean git push.

**Deployment via Git (recommended):**
- Push to `main` branch → Vercel auto-deploys
- Build command: `npm run build:client`
- Rewrites in `vercel.json` proxy API calls to `id.grudge-studio.com` and `api.grudge-studio.com`

**Note:** `id.grudge-studio.com`, `fleet.grudge-studio.com`, and `characters.grudge-studio.com` are listed as Vercel aliases but actually served by Cloudflare (not Vercel origin). Keep DNS as-is.

## 10. Decommissioned Systems

| System | Was | Now | Notes |
|--------|-----|-----|-------|
| Linux VPS (74.208.155.229) | Docker: Coolify, MySQL, Redis, grudge-id, game-api, account-api, launcher-api, ws-service, watchtower | **DEAD** | All services migrated to Railway (The-ENGINE). VPS decommissioned. |
| Windows VPS Colyseus | Colyseus multiplayer rooms | **DEAD** | Never fully deployed. Replaced by Railway WS + planned grudge-openworld-server. |
| VPS Docker + Cloudflare Tunnel | `api.grudge-studio.com` backend | **DEAD** | Replaced by Railway. Tunnel disconnected. Worker gateway replaces it. |
| `grudge-backend` repo | Full game API + auth | **CODE SOURCE ONLY** | Schema/route patterns were reference for The-ENGINE. Do not restore. |
| `account.grudge-studio.com` | Planned separate account service | **NEVER EXISTED** | DNS record was never created. All account calls go through api.grudge-studio.com. |
| `edge.grudge-studio.com` | Badge-reader Worker | **NEVER EXISTED** | DNS record was never created. Worker source exists but was never deployed. |
| `ale.grudge-studio.com` | AI gateway Worker | **NEVER EXISTED** | DNS record was never created. ALE Worker source exists in grudge-backend. |
| `grudgeplatform.io` | Web3 hub | **OFFLINE** | Was Vercel, now 404. grudgeplatform.com still live. |
| `grudgedot-launcher.vercel.app` | GrudgeDot launcher | **DEAD** | 404. Canonical launcher will be at launcher.grudge-studio.com. |
| NeonDB | Serverless Postgres | **DEPRECATED** | Per project rules, do NOT use. Railway Postgres is primary. |

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

## 12. Account Page Architecture

The unified account page at `/account` is a tabbed layout that consolidates patterns from multiple earlier repos:

| Source Repo | What was reused | Files |
|-------------|----------------|-------|
| `GrudgeBuilder/client/src/pages/AccountPage.tsx` | Profile card, Grudge ID display, XP/GBUX, avatar | → `AccountOverview.tsx` |
| `GrudgeBuilder/client/src/pages/WalletPage.tsx` | Wallet management, cNFT listing, Crossmint flow | → `AccountWallet.tsx` |
| `Warlord-Crafting-Suite/client/src/pages/Settings.tsx` | Settings sidebar with account/avatar/security sections | → `AccountSettings.tsx` |

Tab components live in `client/src/components/account/`. The main page shell is `client/src/pages/account.tsx`.

**Key difference from older repos**: All API calls use The-ENGINE's cookie-based session pattern (`credentials: "include"`) at `/api/me/*` routes. No Bearer tokens, no localStorage auth. The older GrudgeBuilder repo used `authHeaders()` with `localStorage.getItem('grudge_auth_token')` — that pattern is retired for portal pages.

## 13. Puter App Integration

The Puter command hub app (grudgestudio-2) lives at `deploy/puter-app/index.html`. It connects to The-ENGINE via:
- Cookie-based auth against `id.grudge-studio.com/api/auth/*`
- Cross-domain SSO using `?grudge_token=` + `/api/auth/session/exchange`
- Puter SDK for auto-login (`puter.auth.signIn()` → `puterSSO`)

CORS for `https://puter.com` and `https://app.puter.com` is configured in both CF Worker gateways (auth + game API).

To deploy the Puter app:
1. Upload `deploy/puter-app/index.html` to Puter FS as `index.html` in the grudgestudio-2 site folder
2. The app auto-discovers the player's session from the `.grudge-studio.com` cookie or Puter SSO

## 14. Production Verification Log

### 2026-05-25 — Full deployment + integration test (commit `3bf3f4a`) [HISTORICAL LOG ONLY — NOT CURRENT PROD]

**⚠️ NOTE:** This section is a dated historical verification log from 2026-05-25. Service URLs listed here reflect that date's deployment state and may no longer be current production. See § "Production Deployment Status (2026-08-29)" in README.md for current verified hosts.

**Deployment status** — 11 services tested, all green (as of 2026-05-25):

| Service | URL | HTTP |
|---------|-----|------|
| GrudgeWarlords | grudgewarlords.com | ✅ 200 |
| GrudgeWarlords /wallet | grudgewarlords.com/wallet | ✅ 200 |
| GrudgeWarlords API | /api/health | ✅ healthy, DB connected |
| Client Hub | client.grudge-studio.com | ✅ 200 |
| Nexus Nemesis (Vercel) | nexus-nemesis-game.vercel.app | ✅ 200 |
| Nexus Nemesis (Railway) | /api/health | ✅ healthy, DB connected |
| Grudge Arena | grudge-arena.vercel.app | ✅ 200 |
| Dungeon Crawler | dungeon-crawler-quest.vercel.app | ✅ 200 |
| ObjectStore | molochdagod.github.io/ObjectStore | ✅ 200 |
| Fleet Map | fleet.grudge-studio.com | ✅ 200 |
| Match-3 WebGL | molochdagod.github.io/grudge-match-webgl | ✅ 200 |

**Backend health:**
- GrudgeWarlords: `healthy`, DB `connected`, 105MB RSS, 35MB heap, uptime 722s
- Nexus Nemesis: `healthy`, DB `connected`, 0 socket connections
- Vercel→Railway API proxy: working (Nexus Nemesis)

**E2E integration test:**

| Test | Result |
|------|--------|
| Guest auth (`POST /api/auth/guest`) | ✅ Created user, Grudge ID assigned, 0 GBUX |
| Auth guard (`GET /api/auth/me` no cookie) | ✅ 401 |
| Wallet endpoints (no session) | ✅ All return 401 (auth-gated) |
| Game library (`GET /api/games`) | ✅ 1360+ games, embed URLs correct per platform |
| GrudaChain status | ✅ Service available |

**Production hardening applied this session:**
- Added `compression` middleware (gzip for 3D assets)
- Added `helmet` security headers
- Replaced manual CORS with `cors` package
- Enhanced `/api/health` with DB probe (3s timeout), uptime, memory metrics
- Vercel config: `build:client` script, `--legacy-peer-deps`, asset cache headers
- Vite: manual chunks (three/cannon/vendor), 1500KB chunk warning limit

**Nexus Nemesis fix:** Restored missing `QueryClientProvider` + `AuthProvider` wrappers in App.tsx (all queries and auth were broken).

---

### 2026-05-08 — Initial verification (commit `35c5faf`)

| Endpoint | Method | Expected | Actual | Status |
|----------|--------|----------|--------|--------|
| `/api/health` | GET | 200 | 200 | ✅ |
| `/api/auth/me` (no cookie) | GET | 401 | 401 | ✅ |
| `/api/auth/puter-sso` | POST | Creates user, sets cookie | `{id, username, grudgeId, ...}` | ✅ |
| `/api/auth/me` (with cookie) | GET | Returns full profile incl. bio, providers | All fields present | ✅ |
| `/api/me/profile` | PATCH | Updates bio, displayName | `{displayName, bio, avatarUrl}` | ✅ |
| `/api/me/connections` | GET | Returns linked providers | `{discord, google, github, solana, puter, email, phone, wallets}` | ✅ |
| `/api/chat/rooms` | GET | 200 | 200 | ✅ |
| `/api/games/top` | GET | 200 | 200 | ✅ |
| `/api/leaderboards/global` | GET | 200 | 200 | ✅ |
| `/api/platforms` | GET | 200 | 200 | ✅ |

Fleet status: 11 live, 2 warn, 9 down (down = decommissioned VPS services, expected).

---

### 2026-06-08 — Fleet topology alignment (commit `f532405`)

**What changed**: Aligned `admin-harbor.html`, `fleet-health.ts`, and this doc to the single source of truth.

- Removed 11 dead VPS Docker vessels from admin-harbor FLEET
- Added Railway (The-ENGINE) + Railway Postgres + grudge-openworld-server vessels
- Replaced ~20 broken VPS connections with Railway-routed connections
- Removed `vps-linux` region, added `railway` region, renamed `vps-windows` to GRUDGEYONKO
- Updated captain diagnosis + PVP checks to reference Railway stack
- Added `openworld` git remote → `Grudge-Warlords/grudge-openworld-server.git`

**Fleet health (17 services):**

| Service | Status | Latency |
|---------|--------|---------|
| The-ENGINE (Railway) | ✅ live | 263ms |
| grudge-studio.com | ✅ live | 252ms |
| grudge-auth-gateway | ✅ live | 836ms |
| grudge-identity-api | ✅ live | 847ms |
| grudge-ai-hub | ⚠️ warn | 342ms |
| grudge-objectstore-api | ❌ down | 254ms |
| grudge-asset-cdn | ⚠️ warn | 720ms |
| grudge-dashboard | ⚠️ warn | 489ms |
| grudge-vercel-proxy | ✅ live | 175ms |
| Grudge Warlords | ✅ live | 335ms |
| Dungeon Crawler | ✅ live | 219ms |
| GrudgePlatform | ✅ live | 633ms |
| Puter | ✅ live | 349ms |
| grudgestudio.puter.site | ✅ live | 757ms |
| grudgeplatform.puter.site | ⚠️ warn | 556ms |
| Solana RPC | ✅ live | 447ms |
| Discord API | ✅ live | 76ms |

**Summary**: 12 live, 4 warn, 1 down (objectstore-api returning 404 on health endpoint).

## 15. Database Migration Notes

### Why `drizzle-kit push` fails locally
Railway's `DATABASE_URL` uses the internal hostname `postgres.railway.internal` which only resolves inside Railway's network. Running `npx railway run npm run db:push` also fails because it injects the internal URL.

### Working approach: Public proxy
Railway exposes a TCP proxy at `roundhouse.proxy.rlwy.net:21911`. To run migrations locally:

```bash
# Get the internal URL and swap the hostname for the public proxy
$DB_URL = (npx railway variables --kv | Select-String "DATABASE_URL=") -replace "DATABASE_URL=", ""
$PUBLIC_URL = $DB_URL -replace "postgres\.railway\.internal:\d+", "roundhouse.proxy.rlwy.net:21911"
$env:DATABASE_URL = $PUBLIC_URL
npx drizzle-kit push
```

### Known issue: Drizzle PK conflict
`drizzle-kit push` may error with `column "id" is in a primary key` on this DB due to schema drift. For simple column additions, use direct SQL instead:

```bash
node -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => c.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT')).then(() => { console.log('Done'); c.end(); })"
```

### Migration history
| Date | Change | Method | Notes |
|------|--------|--------|-------|
| 2026-05-08 | Add `bio TEXT` to users | Direct ALTER TABLE via public proxy | `drizzle-kit push` hit PK conflict, used raw SQL |
