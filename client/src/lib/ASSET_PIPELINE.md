# Grudge asset pipeline — process patterns (Wargus / The-ENGINE)

**SSOT hosts:** `https://assets.grudge-studio.com` (Cloudflare R2)  
**Code entry:** `production-gltf-loader.ts` · `RaceEquipment.ts` · `rts-grudge6-units.ts` · `grudge-assets.ts`

## Pattern A — Character units (grudge6)

```
1. productionRaceGlbCandidates(race)     // PROD GLB first
2. getProductionGltfLoader()             // DRACO + optional Meshopt
3. loadGltfInstance(url, forceSkinned)   // SkeletonUtils.clone
4. applyProductionRaceAtlas(race)        // webp, sRGB, flipY=false
5. applyRtsWorkerKit | applyEquipmentVisibility
6. setCarryVisuals(none) until gather
7. normalizeRaceModel (body Box3 + 100× decade + ground)
8. animPackClipCandidates(pack, clip) + stripPositionTracks
9. AnimationMixer on kit root
```

**Never for characters:** plain `scene.clone()`, Meshy capsules as final, toon-shooter soldier as SSOT.

## Pattern B — Buildings

```
createBuilding → BoxGeometry (or future structure GLB)
              → Rapier fixed cuboid (RtsRapierWorld)
              → NO skeleton / NO race atlas / NO human SI fit
```

## Pattern C — Siege / mounts

```
RTS_MODEL_MAP → rts_siege_* / rts_mount_*
              → rigid GLB via GrudgeAssets (SkeletonUtils only if skinned)
              → NO worker equip / NO 1.8 m human fit on weapons
```

## Pattern D — Bake / Cloudflare (offline)

```
Author FBX → grudge-convert (glb2glb, webp, meshopt/draco)
          → R2 put under models/grudge6/...
          → D1 registry (optional)
          → browser loads GLB only
```

FBX in browser = **fallback only**, not production SSOT.

## Purge / deprioritize

| Wrong / heavy | Prefer |
|---------------|--------|
| `toon-shooter/characters/*` as final hero | `models/grudge6/races/*_Characters.glb` |
| `grudge-arena…/cdn/assets/characters/*` | assets.grudge-studio.com only |
| plain `clone(true)` on skins | SkeletonUtils |
| full wardrobe visible | equip hide → show one set |
| ad-hoc anim URLs only | pack folders + known Idle fallback |
| bare `new GLTFLoader()` | `getProductionGltfLoader()` |

## Three + Cloudflare checklist

- [ ] `GLTFLoader` + `DRACOLoader` (gstatic 1.5.7)
- [ ] Meshopt when decoder present
- [ ] CDN CORS: assets.grudge-studio.com
- [ ] Atlas webp on R2 under textures/grudge6/...
- [ ] three pin toward 0.185 when upgrading fleet-wide
