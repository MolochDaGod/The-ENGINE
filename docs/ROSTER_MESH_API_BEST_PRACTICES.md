# Roster · Mesh labels · API best practices

## Surfaces

| URL | Role |
|-----|------|
| `https://grudge-studio.com/roster` | Portal Rec0deD / The-ENGINE roster |
| `https://character.grudge-studio.com/roster` | Dedicated character host (same page) |

## What we ship

1. **Mesh-level detection** — `shared/mesh-material-labels.ts`  
   Labels each Toon RTS / grudge6 mesh: `skin | cloth | leather | metal | armor_plate | weapon | cape | wing | …`  
   with Three.js `MeshStandardMaterial` presets (metalness/roughness; **keep atlas maps**).

2. **Unity cosmetics on roster** — `shared/cosmetics-roster.ts`  
   Wings (polygonal / angel / phoenix) + capes (cloth / dragon / stalker / web weaver).  
   CDN GLB preferred; **procedural fallback** until `grudge-asset-convert` bakes FBX → R2.

3. **Class skills** — from `CHARACTER_PREFABS` / class configs on selection.  
4. **Weapon skills** — ObjectStore `master-weaponSkills.json` via `client/src/lib/weapon-skills.ts`.

## Grudge Studio API layering (do not mix)

```
Browser (roster SPA)
  │
  ├─ Identity     → id.grudge-studio.com  (JWT)
  ├─ Characters   → Railway /api/characters  (SSOT Postgres)
  ├─ Definitions  → objectstore.grudge-studio.com/api/v1/*  (skills, items)
  ├─ Mesh API     → api.grudge-studio.com/v1  (D1 meshes, T0 equip) — asset index
  └─ Binaries     → assets.grudge-studio.com  (GLB, icons, cosmetics)
```

| Concern | Authority | Never |
|---------|-----------|--------|
| Login | Grudge ID + Railway auth | Second auth host |
| Character list / progress | Railway Postgres | D1, localStorage-only |
| Mesh ids / gear presets | D1 `grudge-assets-db` + ObjectStore JSON | Invent mesh names |
| Material labels | Shared code + optional D1 columns later | PATCH onto character progress |
| Wings/capes binaries | R2 after convert | Raw Unity FBX as only prod path forever |

### Same-origin

First-party apps: browser → own origin `/api/*` rewrites → Railway.  
Puter sites: explicit Railway + ObjectStore URLs + CORS.

### Scope

- **Account:** bag, GBUX  
- **Character:** equipment, skills XP, cosmetics selection  
- **Definitions:** static catalogs (weapon skills, cosmetic list)

### Cosmetics convert chain

```
Unity FBX (ObjectStore mounts/…)
  → grudge-asset-convert (fbx2gltf / glb2glb)
  → R2 assets…/models/cosmetics/{wings|capes}/*.glb
  → roster loads glbUrl; fallback if 404
```

Jobs helper: `cosmeticConvertJobs()` in `shared/cosmetics-roster.ts`.

## Agent load order

1. `grudge-studio`  
2. `grudge-production-wiring` (API truth)  
3. `grudge6-modular-characters` + `grudge-character-correctness`  
4. This roster stack in The-ENGINE  

## Confirm before “done”

- [ ] `/roster` shows hero + weapons + wings/cape pick  
- [ ] Class skills list for selected class  
- [ ] Weapon skills load from ObjectStore (or graceful err)  
- [ ] Mesh label panel lists skin/cloth/leather/metal  
- [ ] Material apply does not strip atlas maps  
- [ ] Loadout URL has `hero`, `primary`, optional `wings`, `cape`  
