# The-ENGINE

> Grudge Studio game portal & backend — Node.js + Express + Vite + Three.js + Cannon-ES
>
> **Created by Racalvin The Pirate King**

Production deployment powering [grudgewarlords.com](https://grudgewarlords.com), the Grudge Studio game ecosystem, and the Annihilate 3D combat engine.

---

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Tailwind CSS, Wouter, Radix UI |
| **3D Engine** | Three.js, Cannon-ES, FBXLoader, postprocessing |
| **Backend** | Express 4, Node 22, WebSocket (ws), Drizzle ORM |
| **Database** | PostgreSQL (Railway managed) |
| **Auth** | Cookie sessions (HMAC), Discord/Google/GitHub/Phantom/Puter/Twilio |
| **Hosting** | Railway (fullstack), Vercel (static frontend), Cloudflare Workers (edge proxy) |
| **Web3** | Solana, Crossmint wallets, SPL tokens (GBUX) |

## Quick Start

```bash
# Install
npm install --legacy-peer-deps

# Development (Express + Vite HMR)
npm run dev

# Build (client + server)
npm run build

# Start production server
npm start
```

## Build Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server with Vite HMR |
| `npm run build` | Full build: Vite client → `dist/public`, esbuild server → `dist/index.js` |
| `npm run build:client` | Client-only build (used by Vercel) |
| `npm run build:server` | Server-only bundle |
| `npm start` | Production: `node dist/index.js` |
| `npm run db:push` | Apply Drizzle schema to PostgreSQL |

## Production Architecture

```
┌─ Vercel (static frontend + API proxy) ───────────────────┐
│  grudge-studio.com / the-engine.vercel.app               │
│  └─ Vite build → dist/public (SPA + game assets)        │
│     /api/*    → PROXY → the-engine.up.railway.app       │
│     /ws/*     → PROXY → the-engine.up.railway.app       │
│     /assets/* → Cache-Control: 1yr immutable             │
│     /models/* → Cache-Control: 1wk                       │
│     /*        → SPA fallback → index.html                │
└──────────────────────────────────────────────────────────┘

┌─ Railway (API backend) ──────────────────────────────────┐
│  the-engine.up.railway.app                               │
│  Docker (node:22-alpine, multi-stage)                    │
│  ├─ Express + compression + helmet + CORS                │
│  ├─ Player auth (6 providers + smart email linking)      │
│  ├─ Game library (1360+ retro games)                     │
│  ├─ Leaderboards, PvP challenges, GBUX economy           │
│  ├─ WebSocket: chat rooms + arena multiplayer            │
│  ├─ Web3: Solana wallets, Crossmint, SPL tokens          │
│  ├─ Legion AI: NPC dialogue, moderation, quests          │
│  ├─ GrudaChain: Puter KV saves, account linking         │
│  ├─ Fleet health monitoring                              │
│  └─ /api/health → DB probe + uptime + memory metrics    │
│                                                          │
│  PostgreSQL (Drizzle ORM, auto-migrate)                  │
└──────────────────────────────────────────────────────────┘

┌─ Cloudflare Edge ────────────────────────────────────────┐
│  grudge-studio.com → Vercel (DNS)                        │
│  id.grudge-studio.com → Worker → Railway (SSO)           │
│  assets.grudge-studio.com → R2 bucket                    │
│  objectstore.grudge-studio.com → Worker + R2 + D1        │
│  client.grudge-studio.com → CNAME → Vercel               │
└──────────────────────────────────────────────────────────┘
```

## Production Middleware

- **compression** — gzip all responses (critical for 3D model/FBX assets)
- **helmet** — security headers (CSP disabled for game canvas, CORP cross-origin for CDN)
- **cors** — origin allowlist with Puter/Vercel/localhost wildcard support
- **trust proxy** — enabled for Railway/Vercel reverse proxies
- **10MB body limit** — supports large game state payloads

## Annihilate 3D Combat Engine

The engine at `/annihilate-demo` features:

- **6 Grudge race characters** — Human, Elf, Dwarf, Orc, Barbarian, Undead (GLB models)
- **4 weapon animation packs** — Sword & Shield, Great Sword, Longbow, Magic Caster (FBX)
- **Full FSM combat** — 35+ states: combo attacks, charge, block, dash, jump, whirlwind, hadouken
- **Physics** — Cannon-ES capsule bodies, **velocity-based movement** (slopes, walls, terrain resolve via solver), ground detection, climb mechanics
- **Camera-relative WASD** — input is rotated by the camera yaw so "forward" always matches the player's view
- **AI enemies** — BaseAi with detection sphere, chase/attack behavior
- **Character presets** — Race stats, attack speed, movement speed, health per loadout

### Control Scheme (Grudge Hotkey Standard)

| Input | Action |
|-------|--------|
| `W A S D` / Arrows | Move (camera-relative) |
| `LMB` | Light attack |
| `RMB` | Heavy attack / bash |
| `Space` | Jump |
| `Shift` | Dash / dodge |
| `Ctrl` (hold) | Block |
| `1` | Dash attack |
| `2` | Launch (uppercut) |
| `3` | Bash (kbd) |
| `4` | Pop / special |
| `→ ↓ → LMB` | Shoryuken combo |
| `↓ ← Space` | Ajejebloken combo |

Engine source: `client/src/engine/` (GrudgeEngine, BaseCharacter, CharacterFSM, RoleControls, Attacker, BaseAi)

## Cross-Domain SSO — Launch Token Flow

Grudge ID (`id.grudge-studio.com`) brokers single sign-on to external Grudge apps
hosted on Puter (`*.puter.com`, `*.puter.site`) and Vercel (`*.vercel.app`):

1. User clicks an auth-gated product (e.g. **Nexus Nemesis**, **Warlords**) in the portal.
2. Client (`useLaunchNav` hook) calls `POST /api/auth/popup-token` with `{ audience: <target origin> }`.
3. Backend mints a short-lived HMAC-signed JWT (`server/auth.ts → mintLaunchToken`).
4. Target site opens with `?grudge_token=<jwt>` appended; it exchanges the token for a session cookie via `POST /api/auth/session/exchange`.
5. If the player isn't signed in, the auth modal opens instead.

Origin allowlist (`isOriginAllowed`) auto-trusts:

- Configured `AUTH_ALLOWED_ORIGINS` / `CORS_ORIGINS` entries
- `*.puter.com`, `*.puter.site`
- `*.vercel.app`
- `localhost:*`

Wired in: `client/src/hooks/useLaunchNav.ts`, `client/src/components/header.tsx`, `client/src/components/product-card.tsx`, `server/auth.ts`.

## Deployment

### Railway (backend)
Push to `main` → Railway auto-deploys via Dockerfile.

### Vercel (frontend)
Push to `main` → Vercel auto-builds via `npm run build:client`.

### Cloudflare Workers
```bash
cd deploy/auth-gateway && npx wrangler deploy
cd deploy/game-api-gateway && npx wrangler deploy
```

## Health Check

```
GET /api/health
```
```json
{
  "status": "healthy",
  "ts": 1779666646035,
  "env": "production",
  "uptime": 722,
  "database": "connected",
  "memory": { "rss": 105, "heap": 35 }
}
```

## Auth System (6 providers + smart email linking)

| Button | Provider | Flow |
|--------|----------|------|
| Discord | Discord OAuth | `/api/auth/discord/start` → callback → cookie |
| Google | Phantom SDK (google) | Phantom embedded wallet with Google social login |
| Grudge | Puter auth | Puter SDK → `/api/auth/puter-sso` → cookie |
| Solana | Phantom SDK (auto) | Extension or embedded wallet → nonce/verify |
| Phone | Twilio Verify | OTP via SMS → `/api/auth/twilio/verify` |
| GitHub | GitHub OAuth | `/api/auth/github/start` → callback → cookie |

**Smart email linking:** When a user signs in via Discord/GitHub/Google/Puter and their OAuth email matches an existing account, the provider is linked to that account instead of creating a duplicate.

**Unlink:** `DELETE /api/auth/link/:provider` (discord, github, google, phone, puter, solana)

## Live Game Catalog (54 products)

### Verified Live Games (2026-05-31)
| Game | URL | Type |
|------|-----|------|
| Grudge Warlords | grudgewarlords.com | MMO RPG |
| Nexus Nemesis TCG | nexus-nemesis-game.vercel.app | Card Game |
| Grim Armada | grim-armada-web.vercel.app | Tactical Combat |
| Grudge Drive | grudge-drive.vercel.app | Vehicular Combat |
| Grudge Metaverse | grudge-metaverse.vercel.app | 3D Multiplayer |
| RTS GRUDGE | rts-grudge.vercel.app | Survival RPG |
| Grudge Fishing | grudge-fishing-game.vercel.app | 3D Fishing |
| Grudge Three.js Port | grudge-three-port.vercel.app | 3D RPG |
| THC Labz Battle | thc-labz-battle.vercel.app | Card Battle |
| Dungeon Crawler Quest | dungeon-crawler-quest.vercel.app | Voxel MOBA |
| Grudge Space RTS | grudge-space-rts.vercel.app | Space Strategy |
| Final Fighter | final-fighter.vercel.app | 3D Fighting |
| RPG Sprite Attack | grudge-rpg-sprite-attack.vercel.app | Tactical RPG |
| Grudge Arena | grudge-arena.vercel.app | PvP Arena |
| Grudge Warlords RTS | grudge-warlords-rts.vercel.app | Medieval RTS |
| Grudge RPG | puter.com/app/grudgeRPG | RPG (Puter) |
| Grudge Angler | puter.com/app/grudge-angler | Fishing (Puter) |
| Grudge Match-3 | molochdagod.github.io/grudge-match-webgl | Puzzle (Unity) |
| Betta Warlords | betta-grudgedev.replit.app | PvP Arena |

### Studio Tools
| Tool | URL |
|------|-----|
| Grudge Studio Forge | grudge-studio-forge.vercel.app |
| Grudge Pipeline | grudge-pipeline.vercel.app |
| Asset Rig Editor | asset-rig-editor.vercel.app |
| Character Builder | molochdagod.github.io/grudge-character-builder |
| Grudge Coder | coder.grudge-studio.com |
| ObjectStore | browse.grudge-studio.com |

## Production Deployment Status (2026-05-31)

| Service | URL | Status |
|---------|-----|--------|
| Grudge Studio (Vercel) | grudge-studio.com | ✅ 200 |
| Railway Backend | the-engine.up.railway.app | ✅ healthy, DB connected |
| API Proxy | grudge-studio.com/api/* → Railway | ✅ proxied via vercel.json |
| GrudgeWarlords | grudgewarlords.com | ✅ 200 |
| Nexus Nemesis | nexus-nemesis-game.vercel.app | ✅ 200 |
| Grudge Arena | grudge-arena.vercel.app | ✅ 200 |
| Dungeon Crawler | dungeon-crawler-quest.vercel.app | ✅ 200 |
| ObjectStore | molochdagod.github.io/ObjectStore | ✅ 200 |

---

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full API surface, environment variables, domain inventory, and operational procedures.
