# Annihilate Demo — Grudge6 stack, deps & animated controls

**Live:** https://grudge-studio.com/annihilate-demo  
**Code:** `client/src/pages/annihilate-demo.tsx` · `client/src/engine/**`  
**Hotkeys SSOT:** `ROLE_HOTKEYS` in `client/src/engine/character/RoleControls.ts`

---

## 1. Console errors you can ignore

| Message | Source | Action |
|---------|--------|--------|
| `Cannot find menu item with id translate-page` | **Browser extension** (page translator / Chromium menu) | Not engine code — ignore or disable extension |
| `runtime.lastError` / message channel closed | **Chrome extension** async listener | Ignore |
| `CSP connect-src data:` (fixed 63cb11b) | Was portal CSP | Fixed — `data: blob:` allowed for GLTF embeds |

---

## 2. Runtime stack (what annihilate actually uses)

```
React page (annihilate-demo)
  └─ GrudgeEngine (Three r181 WebGL + Cannon-ES world)
       ├─ GrudgeCharacter extends BaseCharacter
       │    ├─ GLTF / multi-mesh race wardrobe (Toon-RTS D1 grudge6)
       │    ├─ AnimationMixer + oaction map + crossFade
       │    ├─ CharacterFSM (xstate-style service)
       │    ├─ FootIK (optional)
       │    └─ Cannon capsule body (fixedRotation)
       ├─ RoleControls (hotkeys + camera-relative WASD)
       ├─ GameCamera (isometric / follow)
       ├─ CombatVfx + Attacker hitboxes
       └─ BaseAi enemies
```

| Layer | Package / module | Role |
|-------|------------------|------|
| Renderer | `three` ^0.181 | Scene, meshes, mixer, camera |
| GLTF | `three/examples/jsm/loaders/GLTFLoader` | Race wardrobe GLB |
| FBX anims | `three/examples/jsm/loaders/FBXLoader` | Weapon animation packs |
| Physics | `cannon-es` | Capsule body, velocities, groups |
| Path (optional) | `three-pathfinding` | Navmesh agents elsewhere in engine |
| Raycast speed | `three-mesh-bvh` | Faster picks when used |
| Post | `postprocessing` | Bloom etc. when enabled |
| Input | `RoleControls` | Keyboard + mouse → FSM events |
| Control pkg | `grudge-control` (GitHub) | Shared control helpers (fleet) |

**Not used in annihilate today:** Rapier, R3F, CSS character animation.

---

## 3. Recommended npm dependencies (best practice)

### Must keep (production annihilate)

```json
{
  "three": "^0.181.0 || ^0.184.0",
  "@types/three": "matching",
  "cannon-es": "^0.20.0",
  "three-mesh-bvh": "^0.9.x",
  "three-pathfinding": "^1.3.x",
  "postprocessing": "^6.x"
}
```

### Strongly recommended (loaders / quality)

| Package | Why |
|---------|-----|
| Built-in `DRACOLoader` + `MeshoptDecoder` (three examples) | Compress race/building GLBs; faster downloads |
| `meshoptimizer` / `@gltf-transform/cli` | Offline pipeline: meshopt + quantize textures |
| `draco3dgltf` | Encode Draco for CDN pipeline |

Wire after GLTFLoader construct:

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(draco);
loader.setMeshoptDecoder(MeshoptDecoder);
```

### Animated character best practices (Three)

| Practice | How |
|----------|-----|
| Clone skinned meshes | `SkeletonUtils.clone(gltf.scene)` — never share skeletons |
| One mixer per instance | `new AnimationMixer(root)` per hero/enemy |
| Crossfade | `fadeOut` previous → `reset().fadeIn().play()` next (BaseCharacter.fadeToAction) |
| Shared clips | Load weapon pack FBX once, retarget/share clips by name |
| Equipment meshes | Grudge6 wardrobe: unarmed default → class set via `setRaceEquipmentMode` |
| Foot IK | `character.enableFootIK()` after load |
| Dispose | `mixer.stopAllAction()`, geometry/mat dispose on hero switch |

### Physics: Cannon now, Rapier later

| | Cannon-ES (current) | Rapier (optional upgrade) |
|--|---------------------|---------------------------|
| Package | `cannon-es` | `@dimforge/rapier3d-compat` |
| Status | Annihilate SSOT | Use for new zones needing CCD / better capsules |
| Character | Velocity on fixedRotation capsule | Kinematic character controller |

Do **not** run both engines on the same body.

### Input / hotkeys

| Practice | How |
|----------|-----|
| SSOT map | `ROLE_HOTKEYS` export — UI legend imports it |
| One listener set | RoleControls owns window key/mouse; destroy on unmount |
| tickKey vs holdKey | Edge-trigger actions once; hold for block/move |
| preventDefault | Space/arrows in game focus only; don't steal browser shortcuts outside canvas |
| Pointer lock | Optional for free-look; annihilate uses ISO camera today |

### CSP (portal host)

`connect-src` **must** include `data: blob:` so GLTFLoader can fetch embedded textures (see commit `63cb11b`).

---

## 4. Hotkeys (selected grudge6 character)

| Keys | Action | FSM event |
|------|--------|-----------|
| WASD / Arrows | Move (camera-relative) | tags `canMove` |
| LMB | Light attack / combo | `attack` |
| RMB | Heavy / bash / whirlwind | `bash` |
| Space | Jump | `jump` |
| Shift | Dash | `dash` |
| **Ctrl (hold)** | **Block** | `block` |
| **1** | **Dash attack** | `dashAttack` |
| 2 | Launch | `launch` |
| 3 | Bash (kbd) | `bash` |
| 4 | Special / pop | `pop` |
| Block + ↓→ LMB | Hadouken | `hadouken` |
| Block + →↓→ LMB | Shoryuken | `shoryuken` |
| Block + ↓← Space | Ajejebloken | `ajejebloken` |

Hero select: right-side roster or dropdown — spawns `GrudgeCharacter` for that prefab (race × class).

---

## 5. Character select flow

1. User picks preset from `CHARACTER_PRESETS` / `CHARACTER_PREFABS`
2. `spawnCharacter(preset)` → `new GrudgeCharacter` → `load()` race GLB + wardrobe
3. `enableFootIK()` · `attachCombat` · `new RoleControls(character)`
4. `loadWeaponPack(weapon)` — FBX clips into mixer by action name
5. Gear button toggles `unarmed` ↔ `equipped` multi-mesh visibility

---

## 6. Packages to avoid / clean up

| Package | Note |
|---------|------|
| `three.js` (old npm name) | Duplicate of `three` — prefer single `three` only |
| CSS keyframe locomotion | Do not drive skeleton with CSS |
| Second physics engine without migration plan | Avoid dual Cannon+Rapier |
| Photon / Nakama for this demo | Overkill — local AI only |

---

## 7. File map

| Concern | Path |
|---------|------|
| Demo page | `client/src/pages/annihilate-demo.tsx` |
| Hotkeys + movement | `client/src/engine/character/RoleControls.ts` |
| Body + mixer + GLTF | `client/src/engine/character/BaseCharacter.ts` |
| Grudge6 wardrobe | `client/src/engine/character/RaceEquipment.ts` |
| FSM states | `client/src/engine/character/states/*` |
| Prefabs | `shared/character-prefabs` |
| Engine world | `client/src/engine/core/GrudgeEngine.ts` |
| Public export | `client/src/engine/index.ts` |

---

## 8. One-line

**Three + GLTF/FBX mixers + Cannon capsules + RoleControls hotkeys + grudge6 multi-mesh wardrobe** — hotkeys from `ROLE_HOTKEYS`; browser `translate-page` errors are not your engine.
