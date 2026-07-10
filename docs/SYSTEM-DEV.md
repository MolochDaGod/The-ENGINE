# System Development Console

**UI:** https://grudge-studio.com/system-dev  
**API:** `GET /api/admin/system` (admin passcode session or player `admin`/`master` role)

## What it is

Operator + agent control plane for:

- Account DB table counts / schema ensure
- Universe loops (characters, Nexus decks, home islands, game saves)
- Play settings (`users.play_settings`)
- Fleet canonical audit (vercel-pending vs `*.grudge-studio.com`)
- Per-user bootstrap + inspection

## Auth for agents

```bash
# Admin passcode cookie (portal)
curl -c cookies.txt -X POST https://api.grudge-studio.com/api/portal-admin/login \
  -H 'Content-Type: application/json' \
  -d '{"passcode":"YOUR_ADMIN_PASS"}'

curl -b cookies.txt https://api.grudge-studio.com/api/admin/system
```

Or sign in as a Grudge player with `role: admin|master` and use `gs_player_session` cookie.

## Fleet hydrate (any game)

```html
<script src="https://grudge-studio.com/embed/grudge-universe.js"></script>
<script>
  GrudgeUniverse.hydrate().then((state) => {
    // state.player, state.universe, state.playSettings
    // state.activeCharacter, state.activeDeck, state.homeIsland
  });
</script>
```

Auth accepted on portal API:

1. Cookie `gs_player_session`
2. `Authorization: Bearer <session JWT>`
3. `Authorization: Bearer <launch JWT>` from `grudge_token` query
4. Header `X-Grudge-Token`

## Key endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/me/universe` | Bootstrap deck + home island; list all |
| GET/PATCH | `/api/me/play-settings` | Graphics/audio/controls/forge |
| GET/POST | `/api/me/characters` | Claim Warlords prefabs |
| GET/POST | `/api/me/decks` | Nexus deck snapshots |
| GET/POST | `/api/me/islands` | Home islands |
| PUT | `/api/me/saves` | Generic game progress |
| GET | `/api/admin/system` | Full dashboard JSON |
| POST | `/api/admin/system/ensure-schema` | Idempotent indexes/columns |
| GET | `/api/admin/system/user/:grudgeId` | Inspect player universe |
| POST | `/api/admin/system/bootstrap/:grudgeId` | Force starter content |

## Wired clients

- **The Engine** account tabs + super-engine forge settings load/save
- **WCS deploy** (`client.grudge-studio.com`) — `portalUniverse.ts` on boot
- **Nexus Nemesis** — deck hydrate on `App.tsx` boot
- **WCS grudge-sdk** — `Grudge.universe.hydrate()`
