# Avernus Arena — grudge6 stack

**Live:** https://grudge-studio.com/avernus-arena  
**Code:** `client/src/pages/avernus-arena.tsx` · `client/src/pages/avernus/*`  
**REST:** `GET /api/avernus/config` · `POST /api/avernus/session` · scores via fleet `/api/scores`

---

## What changed (v2)

| Before | After |
|--------|--------|
| Capsule player + toon-shooter guns | **grudge6 Toon RTS** race kits via `loadRaceWithEquipment` |
| Ad-hoc orbit camera | **GameCamera FOLLOW** (Danger Room TPS) |
| No opening funnel | **Opening page**: mode · race · champion · weapon |
| Procedural-only combat | **RoleControls** + weapon FBX packs + Q/E/R/F skills |
| No REST surface | **Config + session API** + leaderboard/scores |

---

## Runtime stack

```
Opening page (React)
  → POST /api/avernus/session
  → GrudgeEngine (Three + Cannon-ES)
       ├─ buildAvernusArena (procedural pit)
       ├─ AvernusHero (loadRaceWithEquipment + loadWeaponPack)
       ├─ RoleControls (ROLE_HOTKEYS SSOT)
       ├─ GameCamera.FOLLOW
       ├─ CombatVfx + MeleeHitbox (Attacker)
       └─ AvernusEnemy + BaseAi (wave modes)
```

Hotkeys SSOT: `ROLE_HOTKEYS` in `client/src/engine/character/RoleControls.ts`  
Weapon packs: `client/src/pages/avernus/weaponPacks.ts`  
Hero presets: `CHARACTER_PREFABS` → `avernus/characters.ts`

---

## REST

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/avernus/config` | Modes, races, weapons, controls, camera |
| POST | `/api/avernus/session` | Start tracked run |
| GET | `/api/avernus/session?id=` | Fetch session |
| POST | `/api/scores` | Submit score (`gameId: avernus-arena`) |
| GET | `/api/leaderboards/avernus-arena` | Board |

Vercel: `api/avernus/config.ts`, `api/avernus/session.ts`  
Railway Express: same paths in `server/routes.ts`

---

## Character rules (must keep)

1. **No Meshy / capsules** as primary hero (capsule only as last-resort fallback).
2. **SI height** ~1.8 m via `normalizeRaceModel` / `HUMAN_HEIGHT_M`.
3. Equipment default **unarmed** for player, then `loadWeaponPack` → **equipped**.
4. Anim packs: sword-shield · great-sword · longbow · magic-caster · unarmed.
5. Import from `@/engine` — do not reimplement camera/controls in the page.

---

## Low-lag instances · baked · skeletons · weapon skills

| Layer | Do | Don't |
|-------|----|--------|
| **Race kits** | `loadRaceWithEquipment` + **SkeletonUtils** clone cache | `scene.clone(true)` on SkinnedMesh |
| **Anims** | Baked **JSON** Bip001 (`bakedAnimSystem.ts`), global clip cache, **parallel** `Promise.all` | Sequential FBX waterfall per skill |
| **Root motion** | `stripPositionTracks` on grounded kits | Play full Mixamo position tracks on SI feet |
| **Weapon skills** | Baked pack first → FBX fill missing → equip wardrobe | Load whole fireball.glb or re-fetch pack every enemy |
| **Enemies** | Share baked cache + race GLB cache | One FBX download per grunt |
| **Instancing** | **InstancedMesh** for VFX/props/torches only | InstancedMesh for unique skinned heroes |
| **Preload** | Opening page warms packs before **Enter Avernus** | Start match then wait on first attack |

Code: `client/src/pages/avernus/bakedAnimSystem.ts`  
Baked host: `https://grudge-arena.grudge-studio.com/anims/baked/{pack}/{clip}.json`  
Fleet skill: `grudge6-combat-runtime` + `three-instanced-lod` (props/VFX only).

---

## Related

- `docs/ANNIHILATE_GRUDGE6_STACK.md`
- Open Danger Room: https://open.grudge-studio.com/danger
- grudge-arena Teidland (island) is a separate product surface
