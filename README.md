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
┌─ Vercel (static frontend) ──────────────────────────────┐
│  the-engine.vercel.app                                   │
│  └─ Vite build → dist/public (SPA + game assets)        │
│     /assets/* → Cache-Control: 1yr immutable             │
│     /models/* → Cache-Control: 1wk                       │
│     /* → SPA fallback → index.html                       │
└──────────────────────────────────────────────────────────┘

┌─ Railway (fullstack backend) ────────────────────────────┐
│  Docker (node:22-alpine, multi-stage)                    │
│  ├─ Express + compression + helmet + CORS                │
│  ├─ Player auth (8 providers, cookie sessions)           │
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
│  grudge-studio.com → Worker → Railway                    │
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
- **Physics** — Cannon-ES capsule bodies, ground detection, climb mechanics
- **AI enemies** — BaseAi with detection sphere, chase/attack behavior
- **Character presets** — Race stats, attack speed, movement speed, health per loadout

Engine source: `client/src/engine/` (GrudgeEngine, BaseCharacter, CharacterFSM, RoleControls, Attacker, BaseAi)

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

## Production Deployment Status (2026-05-25)

| Service | URL | Status |
|---------|-----|--------|
| ENGINE Vercel | the-engine.vercel.app | ✅ 200 |
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

## Integration Test Results (2026-05-25)

### Auth Flow
- `POST /api/auth/guest` → ✅ Created guest user with Grudge ID, 0 GBUX, role `guest`
- `GET /api/auth/me` (no cookie) → ✅ Returns 401

### Wallet & Account Endpoints
- `/api/me/stats` → ✅ Auth-gated (401 without session)
- `/api/me/wallets` → ✅ Auth-gated
- `/api/me/connections` → ✅ Auth-gated

### Game Library
- `/api/games` → ✅ Returns 1360+ games across NES, SNES, N64, Genesis, GBA, NDS
- Embed URLs correctly formatted per platform

### Backend Health
- GrudgeWarlords: `healthy`, DB `connected`, 105MB RSS, 35MB heap
- Nexus Nemesis: `healthy`, DB `connected`, Vercel→Railway proxy working

---

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full API surface, environment variables, domain inventory, and operational procedures.
