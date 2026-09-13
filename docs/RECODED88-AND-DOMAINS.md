# Rec0deD:88, grudge-studio.com, and Open — do not confuse

## What is Rec0deD:88?

**Rec0deD:88** is the **brand name** of the retro gaming product surface inside **The-ENGINE** portal.

| Item | Value |
|------|--------|
| Title tag | `Rec0deD:88 — Grudge Studio Gaming Portal` (`client/index.html`) |
| Host | **`https://grudge-studio.com`** (also `www`) |
| Repo | `MolochDaGod/The-ENGINE` (canonical, editable) |
| Library | 1,360+ ROMs via EmulatorJS + `rec0ded88.com` ROM proxy |
| Features | Catalog, `/play/:id`, `/pvp` challenges, `/leaderboards`, GBUX, chat |

It is **not** a separate company, **not** Open combat sandbox, **not** grudge6.

The string “Rec0deD” in earlier agent notes only meant “the portal SPA HTML title,” not a second product to replace.

## Domain map (no conflicts)

| Domain / path | Product | Repo |
|---------------|---------|------|
| `grudge-studio.com` | Portal home, company/era/info, **retro library**, PvP hub, leaderboards | The-ENGINE |
| `grudge-studio.com/annihilate-demo` | **Redirect** → Open (Danger Room + grudge6) | The-ENGINE `vercel.json` → gameopen |
| `open.grudge-studio.com` | Grudge Open combat labs | gameopen |
| `id.grudge-studio.com` | Auth gateway | The-ENGINE + Railway |
| `api.grudge-studio.com` | Game API (scores, challenges) | The-ENGINE Railway |

**Rule:** Path redirects on the portal (e.g. annihilate → Open) must **not** steal retro `/play`, `/pvp`, `/games`, or `/leaderboards`.

## Competitive Top 10 (PvP / PvE)

SSOT: `shared/retroCompetitive.ts`

| # | gameId | Title | Modes |
|---|--------|-------|-------|
| 1 | 548 | Super Smash Bros (N64) | pvp |
| 2 | 381 | Street Fighter II SCE (Genesis) | pvp |
| 3 | 261 | Mortal Kombat II (SNES) | pvp |
| 4 | 272 | Super Mario Kart (SNES) | pvp, pve |
| 5 | 648 | King of Fighters ’98 (Neo Geo) | pvp |
| 6 | 612 | Metal Slug (Neo Geo) | pve, coop |
| 7 | 49 | Contra (NES) | pve, coop |
| 8 | 146 | Tetris (NES) | pvp, pve |
| 9 | 35 | Bomberman (NES) | pvp, pve |
| 10 | 95 | Mike Tyson’s Punch-Out!! (NES) | pve |

- API: `GET /api/games/competitive?mode=pvp|pve|coop|all`
- UI: `/pvp` (grid + challenge preselect), `/leaderboards` (Competitive tab)
- Scores: `POST /api/scores` + manual submit on `/play/:id` (`RetroScoreSubmit`)

## Cloudflare + domain best practices (grudge-studio.com)

1. **One apex product** — `grudge-studio.com` = The-ENGINE portal only. Subdomains for specialized apps (`open.`, `id.`, `assets.`, `forge.`).
2. **Orange-cloud DNS** for apex → Vercel (or Worker). Prefer **proxied CNAME** to `cname.vercel-dns.com` when using Vercel custom domain.
3. **TLS** — Full (strict) when origin has valid cert; avoid Flexible.
4. **Cache** — HTML `max-age=0, must-revalidate`; catalog JSON short SWR; ROM/assets long cache or CDN.
5. **Path routing** — Prefer **Vercel redirects** (as annihilate) for “leave portal for another SPA.” Use CF Workers only when you need path proxy + WebSocket or multi-origin.
6. **Do not** put Open static assets under portal paths without rewrite of `/assets` + `/api` — Open has its own rewrites.
7. **CORS / auth** — Browser uses **same-origin** `/api/*` on portal; Railway is behind rewrites, not raw Railway URLs in SPA.
8. **Allowlists** — When adding a new path product, update CSP `frame-src` / `connect-src` in `vercel.json` headers if embeds or APIs change.

## Agent rules

1. Portal retro work → **The-ENGINE** only.
2. grudge6 / Danger Room → **gameopen** / Open URLs.
3. Never invent a third “Rec0deD repo.” Brand lives in The-ENGINE.
4. Competitive roster changes → edit `shared/retroCompetitive.ts` then redeploy portal + ensure Railway has the route if API-only.
5. **Accounts + scores** → see `ACCOUNT_GAMES_DB.md` (catalog id = `game_library.id`).
