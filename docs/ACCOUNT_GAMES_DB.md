# Account ↔ games database (Rec0deD best practices)

## One account, one games DB

Portal accounts and retro scores share **The-ENGINE Railway Postgres** (not grudge-api Warlords characters).
Login is **Grudge ID JWT**; the engine links `users.grudge_id` + `users.fleet_user_id` (UUID) onto that row so scores/saves follow the same human. Do not invent a second login host.

```
users (id, grudge_id, gbux_balance, recent_plays, …)
   │
   ├─ scores.user_id  → users.id
   ├─ scores.game_id  → game_library.id   ← MUST equal catalog /play/:id
   ├─ challenges.*    → users.id + game_library.id
   └─ recent_plays    → jsonb on users (fleet + retro timeline)
```

| Concern | Table / field | API |
|---------|---------------|-----|
| Identity | `users.grudge_id` | `/api/auth/*`, cookie session |
| Wallet | `users.gbux_balance` | challenges wager, rewards |
| Retro score | `scores` | `POST /api/scores` |
| Leaderboards | `scores` + join `users` | `GET /api/leaderboards/*` |
| Account hub | stats + scores + competitive | `/api/me/stats`, `/api/me/scores`, `/api/me/competitive` |
| Play history | `users.recent_plays` | `POST /api/me/play` |

**Warlords / Foundry characters** live on **grudge-api-production** (`player` characters UUID).  
They share **Grudge ID** string identity with portal `users.grudge_id` when SSO is used, but **not** the same Postgres for scores.

## Critical fix: portal id = game_library.id

Two historical lists drifted:

| Source | Used by | Risk |
|--------|---------|------|
| `api/_games.json` | Vercel `/api/games`, `/play/:id` | **Play SSOT** |
| `server/catalog-data.ts` | Old Railway seed | IDs can differ for same title |

Bug: seed dropped ids **and** catalog-data ≠ games.json, so scores could not share accounts with the game the player opened.

**Rule:** `game_library.id` **must equal** `api/_games.json` id (portal play id).

Heal path:

- `storage.ensureCatalogGame(id)` — upsert from **games.json first**, then catalog-data, then competitive meta + art  
- `storage.ensureCompetitiveGames()` — Top 10 on boot + competitive GET  
- Score + challenge create call ensure before FK insert  
- Competitive API **always** returns meta title/art for Top 10 (never wrong seed titles)  
- New seeds should insert with `id: catalogId` from **games.json**

## Art best practices

1. Prefer **libretro Named_Boxarts** with region suffix: `(USA)`, `(Europe)`, `(World)`.  
2. Competitive SSOT thumbs: `shared/retroCompetitive.ts` → `thumbnailUrl`.  
3. UI: `GameCover` walks region fallbacks; gradient letter placeholder if all fail.  
4. Never ship 1×1 placeholders as “featured” art.

## Account hub best practices

1. Signed-in only for scores / challenges / competitive board.  
2. Guests can **play** emulators; prompt sign-in to **submit**.  
3. On play: `POST /api/me/play` with `category: "retro"`, `gameKey: "retro:{id}"`.  
4. On score: write `scores` **and** append `recent_plays`.  
5. Account overview shows competitive grid from `GET /api/me/competitive`.

## Vercel routing

| Path | Origin |
|------|--------|
| `/api/games`, `/api/games/*` | Vercel serverless (static catalog) |
| `/api/games/competitive` | Vercel (proxies Railway when possible) |
| `/api/auth/*`, `/api/me/*`, `/api/scores`, `/api/leaderboards/*`, `/api/challenges*` | Railway The-ENGINE |

Do not put scores on a second DB.

## Smoke

```bash
# Catalog id present after ensure
curl -s https://the-engine.up.railway.app/api/games/146 | head -c 200

# Competitive art
curl -s https://grudge-studio.com/api/games/competitive | jq '.[0].thumbnailUrl'

# Account (cookie required)
curl -s -b cookies.txt https://grudge-studio.com/api/me/competitive
```

## Agent rules

1. Never invent parallel score tables.  
2. Never seed games without catalog `id`.  
3. Extend `ensureCatalogGame` for new competitive titles.  
4. Keep Vercel competitive roster thumbs in sync with `shared/retroCompetitive.ts`.
