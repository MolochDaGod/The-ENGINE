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
│  grudgewarlords.com (Grudge-Builder)                      │
│  grudge-studio.com / the-engine.vercel.app (The-ENGINE)  │
│  └─ Vite build → dist/public (SPA + game assets)        │
│     /api/*    → PROXY → Railway via CF Workers           │
│     /ws/*     → PROXY → Railway WebSocket                │
│     /assets/* → Cache-Control: 1yr immutable             │
│     /models/* → Cache-Control: 1wk                       │
│     /*        → SPA fallback → index.html                │
└──────────────────────────────────────────────────────────┘

┌─ Railway (canonical backend — single source of truth) ───┐
│  the-engine.up.railway.app                               │
│  ├─ Player auth (8 providers + smart email linking)      │
│  ├─ Game library (1360+ retro games)                     │
│  ├─ Leaderboards, PvP challenges, GBUX economy           │
│  ├─ WebSocket: chat rooms + arena multiplayer            │
│  ├─ Web3: Solana wallets, Crossmint, SPL tokens          │
│  ├─ Legion AI: NPC dialogue, moderation, quests          │
│  ├─ GrudaChain: Puter KV saves, account linking         │
│  ├─ Fleet health monitoring (17 services)                │
│  └─ /api/health → DB probe + uptime + memory metrics    │
│                                                          │
│  PostgreSQL (Drizzle ORM, auto-migrate via db:push)      │
└──────────────────────────────────────────────────────────┘

┌─ Cloudflare Edge ────────────────────────────────────────┐
│  id.grudge-studio.com → Worker → Railway (SSO)           │
│  api.grudge-studio.com → Worker → Railway (game API)     │
│  info.grudge-studio.com → Game Info Hub (items, data)    │
│  assets.grudge-studio.com → R2 bucket (CDN)              │
│  client.grudge-studio.com → CNAME → Vercel               │
└──────────────────────────────────────────────────────────┘

┌─ Puter Platform ─────────────────────────────────────────┐
│  grudgestudio.puter.site — Command hub                   │
│  grudge-crafting.puter.site — Crafting suite              │
│  Puter Workers — AI agent, GrudaChain, sprites           │
│  Puter KV/FS/AI — player saves, assets, client AI        │
└──────────────────────────────────────────────────────────┘

┌─ Grudge-Warlords Org ────────────────────────────────────┐
│  grudge-openworld-server — multiplayer room server       │
│  → Connects to Railway for auth + persistence            │
│  → Wired through cf-game-servers for matchmaking         │
└──────────────────────────────────────────────────────────┘
```

## Production Middleware

- **compression** — gzip all responses (critical for 3D model/FBX assets)
- **helmet** — security headers (CSP disabled server-side — managed via Vercel headers)
- **cors** — origin allowlist with Puter/Vercel/localhost wildcard support
- **trust proxy** — enabled for Railway/Vercel reverse proxies
- **10MB body limit** — supports large game state payloads

## Content Security Policy

CSP is set in `vercel.json` headers (both The-ENGINE and Grudge-Builder), **not** in helmet (which has `contentSecurityPolicy: false`). The policy allows game assets from any HTTPS source while restricting scripts to known origins.

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Baseline restriction |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' https://js.puter.com https://*.grudge-studio.com https://*.vercel.app https://vercel.live` | Puter SDK, CF Workers, Vercel previews |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Google Fonts CSS |
| `font-src` | `'self' https://fonts.gstatic.com data:` | Google Fonts files |
| `img-src` | `'self' data: blob: https: http:` | **Permissive** — game thumbnails, CDNs, avatars from any source |
| `connect-src` | `'self' https: wss: data: blob:` | **Permissive** — Railway, Solana RPC, Puter, Discord; **`data:` required** for GLTFLoader embedded textures (annihilate-demo / Three.js) |
| `frame-src` | `'self' https://*.puter.com https://*.grudge-studio.com https://*.vercel.app` | Puter embeds, studio iframes |
| `media-src` | `'self' https://assets.grudge-studio.com blob:` | Audio/video from R2 CDN |
| `worker-src` | `'self' blob:` | Service workers, game workers |

**Important:** The CSP lives in two places:
- `D:\The-ENGINE\vercel.json` — for grudge-studio.com / the-engine.vercel.app
- `E:\Grudge-Builder\vercel.json` — for grudgewarlords.com (the main game client)

Both must be updated together. If images or API calls break, check `img-src` and `connect-src`.

## Grudge AI — Provider Priority

The floating AI assistant (⚡ button, `Ctrl+Shift+G`) auto-selects the best available provider:

| Priority | Provider | Indicator | Model | Cost | When active |
|----------|----------|-----------|-------|------|-------------|
| 1 | **Ollama** (local) | 🟢 green | grudge-dev / llama3 | Free (local GPU) | Dev machine with Ollama running |
| 2 | **Cloud gateway** | 🔵 blue | gpt-5.4-pro / claude | API key billing | `ai.grudge-studio.com` responds 200 |
| 3 | **Puter AI** | 🟣 purple | gpt-4o-mini | Free (Puter-pays) | Puter SDK loaded + user signed in |
| 4 | **Offline** | 🔴 red | — | — | No providers available |

**How it works:**
- `getStatus()` probes the cloud gateway AND checks `isPuterReady()` from `puterIntegration.ts`
- `chatRaw()` tries cloud first; if it returns 401/error or is unreachable, auto-falls back to Puter
- `chatStream()` does the same (Puter doesn't support SSE, so it yields the full response at once)
- Users with a Puter ID get free AI with zero configuration

**Key files (Grudge-Builder repo):**
- `client/src/lib/aiClient.ts` — provider detection, routing, Puter fallback
- `client/src/lib/puterIntegration.ts` — `puterAI.chat()`, `isPuterReady()`
- `client/src/lib/aiGateway.ts` — typed SDK for `ai.grudge-studio.com` (when available)
- `client/src/components/GrudgeAI.tsx` — floating chat panel UI

## Weapon Animation Architecture

All 6 Grudge race characters (Human, Barbarian, Dwarf, Elf, Orc, Undead) use the **Mixamo 24-joint skeleton** and share a unified weapon animation library. The game has **17 weapon types** that map to **4 animation categories** on the R2 CDN.

### Weapon → Animation Category Mapping

```
17 Weapon Types ──→ 4 Animation Categories ──→ 4 CDN Folders
```

| Category | CDN Folder | Weapon Types | Anim States |
|----------|-----------|--------------|-------------|
| **1h melee** | `animations/sword-shield/` | Sword, Axe, Dagger, Hammer1h, Mace | 15 (idle, run, attack1-3, block, death, jump, kick, slash1-2, cast, crouch, impact, draw) |
| **2h melee** | `animations/greatsword/` | Greatsword, Greataxe, Hammer2h, Spear | 14 (idle, run, walk, attack1-2, slash1-2, block, death, jump, special, kick, cast, impact, draw) |
| **Ranged** | `animations/longbow/` | Bow, Crossbow, Gun | 12 (idle, run, walk, attack1-3, block, death, dodge, kick, draw, special) |
| **Caster** | `animations/magic/` | Fire/Frost/Nature/Holy/Arcane/Lightning Staff + all Tomes | 9 (idle, attack1-3, cast, special, block, blockIdle, crouch) |

### How it works

1. `WeaponType` (27 values) = the full union of all weapon types + legacy aliases
2. `AnimCategory` (4 values) = `sword-shield`, `greatsword`, `longbow`, `magic`
3. `WEAPON_ANIM_CATEGORY` maps every `WeaponType` → `AnimCategory`
4. `getAnimationSet(weaponType)` resolves any weapon to the correct CDN folder
5. Class defaults: warrior→`sword`, ranger→`bow`, mage→`arcane-staff`, worg→`greatsword`

### Adding weapon-specific animations

When dedicated animations are uploaded to R2 (e.g. `animations/dagger/` with stab motions):
1. Add a new entry to `WEAPON_ANIMATION_SETS` keyed by the weapon type
2. Update `getAnimationSet()` to check for direct matches before category fallback
3. Or use `animOverrides` on a specific `ModelUnit` for per-model customization

### Key files (Grudge-Builder repo)

- `client/src/lib/modelManifest.ts` — `WeaponType`, `AnimCategory`, `WEAPON_ANIM_CATEGORY`, `WEAPON_ANIMATION_SETS`
- `shared/definitions/weaponsData.ts` — 17 weapon types, 6 weapons each (102 weapons total)
- `shared/definitions/weaponSkillsNew.ts` — skill slots per weapon type (primary, secondary, ability, ultimate)

### Verified (2026-06-08)

- 28/28 weapon types resolve to the correct animation category
- 24/24 race×class combos produce valid weapon→animation chains
- 17/17 animation files load from R2 CDN (one per weapon type tested)
- All 6 Grudge race model GLBs load (248KB–4.7MB)

## Annihilate 3D Combat Engine

The engine at `/annihilate-demo` features:

- **6 Grudge race characters** — Human, Elf, Dwarf, Orc, Barbarian, Undead (GLB models)
- **17 weapon types** mapped to 4 animation categories (50 animation states total)
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
| Game Info Hub | info.grudge-studio.com |
| Grudge Studio Forge | grudge-studio-forge.vercel.app |
| Grudge Pipeline | grudge-pipeline.vercel.app |
| Asset Rig Editor | asset-rig-editor.vercel.app |
| Character Builder | molochdagod.github.io/grudge-character-builder |
| Grudge Coder | coder.grudge-studio.com |

## Consolidated Services (2026-06-08)

The following services were consolidated into `info.grudge-studio.com`:
- `objects.grudge-studio.com` — DNS dead, never resolved
- `objectstore.grudge-studio.com` — static SPA only, no API
- `dash.grudge-studio.com` — 404, nothing deployed
- `browse.grudge-studio.com` — legacy reference

## Production Deployment Status (2026-06-08)

| Service | URL | Status |
|---------|-----|--------|
| GrudgeWarlords | grudgewarlords.com | ✅ 200 (154ms) |
| Railway Backend | the-engine.up.railway.app/api/health | ✅ healthy, DB connected (344ms) |
| API Proxy | grudgewarlords.com/api/health → Railway | ✅ proxied (623ms) |
| Auth Gateway | id.grudge-studio.com | ✅ 200 (786ms) |
| Game Info Hub | info.grudge-studio.com | ✅ 200 (355ms) |
| Assets CDN | assets.grudge-studio.com | ✅ 200 (167ms) |
| Grudge Studio | grudge-studio.com | ✅ 200 |
| Dungeon Crawler | dungeon-crawler-quest.vercel.app | ✅ 200 |
| GrudgePlatform | grudgeplatform.com | ✅ 200 |
| Puter Command Hub | grudgestudio.puter.site | ✅ 200 |

---

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full API surface, environment variables, domain inventory, and operational procedures.
