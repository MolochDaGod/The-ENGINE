/**
 * Avernus baked animation system — low-lag weapon packs for grudge6 Bip001.
 *
 * Best practices (fleet SSOT):
 * 1. Prefer **rotation-only baked JSON** over raw FBX (smaller, pre-retargeted).
 * 2. **Global clip cache** — share AnimationClip across mixers (don't re-fetch).
 * 3. **Parallel Promise.all** for pack loads — never sequential FBX waterfall.
 * 4. **stripPositionTracks** on grounded kits (prevent hip float / 100× root motion).
 * 5. Race kits: SkeletonUtils clone via loadRaceWithEquipment (already cached).
 * 6. Heroes are NOT InstancedMesh (skinned) — instance VFX/props only.
 *
 * Baked mirror (proven 200):
 *   https://grudge-arena.grudge-studio.com/anims/baked/{rel}.json
 * Same-origin preferred when public/anims is shipped with the portal.
 */

import * as THREE from 'three';
import type { WeaponPackId } from './weaponPacks';

const ARENA_BAKED = 'https://grudge-arena.grudge-studio.com/anims/baked';

/** Shared across all Avernus heroes/enemies for the session. */
const clipCache = new Map<string, THREE.AnimationClip>();
const inflight = new Map<string, Promise<THREE.AnimationClip | null>>();

/** Action name → baked rel path (no .json). */
export type BakedPackMap = Record<string, string>;

/**
 * Core + combat clips per Avernus weapon pack.
 * Paths match grudge-arena public/anims/baked layout.
 */
export const BAKED_PACK_RELS: Record<WeaponPackId, BakedPackMap> = {
  'sword-shield': {
    idle: 'sword_shield/sword and shield idle',
    running: 'sword_shield/sword and shield run',
    walk: 'locomotion/walking',
    punch: 'sword_shield/sword and shield attack',
    fist: 'sword_shield/sword and shield attack (2)',
    strike: 'sword_shield/sword and shield slash',
    block: 'sword_shield/sword and shield block',
    hit: 'uploads/action/Aerial_Evade',
    jump: 'locomotion/jump',
    dashAttack: 'sword_shield/sword and shield attack',
    death: 'sword_shield/sword and shield idle',
  },
  'great-sword': {
    idle: 'sword_shield/sword and shield idle',
    running: 'sword_shield/sword and shield run',
    walk: 'locomotion/walking',
    punch: 'sword_shield/sword and shield attack',
    fist: 'sword_shield/sword and shield slash',
    strike: 'sword_shield/sword and shield attack (2)',
    whirlwind: 'sword_shield/sword and shield slash',
    block: 'sword_shield/sword and shield block',
    hit: 'uploads/action/Aerial_Evade',
    jump: 'locomotion/jump',
    dashAttack: 'sword_shield/sword and shield attack',
  },
  longbow: {
    idle: 'longbow/standing idle 01',
    running: 'longbow/standing run forward',
    walk: 'locomotion/walking',
    punch: 'longbow/standing aim recoil',
    strike: 'longbow/standing idle 01',
    fall: 'longbow/standing aim walk back',
    hit: 'uploads/action/Aerial_Evade',
  },
  'magic-caster': {
    idle: 'magic/standing idle',
    running: 'magic/Standing Run Forward',
    walk: 'locomotion/walking',
    punch: 'magic/standing 1h cast spell 01',
    strike: 'magic/standing 2h cast spell 01',
    jump: 'locomotion/jump',
    hit: 'uploads/action/Aerial_Evade',
    death: 'magic/standing idle',
  },
  unarmed: {
    idle: 'unarmed/fight_idle',
    running: 'locomotion/walking',
    walk: 'locomotion/walking',
    punch: 'unarmed/punching',
    fist: 'unarmed/punching',
    dashAttack: 'locomotion/dodging',
    hit: 'uploads/action/Aerial_Evade',
    jump: 'locomotion/jump',
  },
};

function encodeRel(rel: string): string {
  return rel
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** Ordered mirrors — first 200 JSON wins. */
export function bakedUrlCandidates(rel: string): string[] {
  const enc = encodeRel(rel);
  return [
    // Same-origin if portal ships public/anims (preferred, no CORS)
    `/anims/baked/${enc}.json`,
    // Arena production bake host
    `${ARENA_BAKED}/${enc}.json`,
    // Underscore variant of spaces
    `${ARENA_BAKED}/${encodeRel(rel.replace(/ /g, '_'))}.json`,
  ];
}

/**
 * Drop bone .position / .scale tracks so grounded kits don't float or explode.
 * Safe to call on shared cache entries once.
 */
export function stripPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const kept = clip.tracks.filter((t) => {
    const n = t.name;
    if (n.endsWith('.position') || n.includes('.position[')) return false;
    if (n.endsWith('.scale') || n.includes('.scale[')) return false;
    return true;
  });
  if (kept.length === clip.tracks.length) return clip;
  const next = clip.clone();
  next.tracks = kept.map((t) => t.clone());
  next.resetDuration();
  return next;
}

async function fetchBakedJson(rel: string): Promise<unknown | null> {
  for (const url of bakedUrlCandidates(rel)) {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) continue;
      return await res.json();
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

/**
 * Load one baked clip (cached). Clips are shared — do not dispose tracks.
 */
export async function loadBakedClip(rel: string): Promise<THREE.AnimationClip | null> {
  const cached = clipCache.get(rel);
  if (cached) return cached;

  let p = inflight.get(rel);
  if (!p) {
    p = (async () => {
      const json = await fetchBakedJson(rel);
      if (!json) return null;
      try {
        let clip = THREE.AnimationClip.parse(json as object);
        clip = stripPositionTracks(clip);
        if (!clip.tracks.length) return null;
        clipCache.set(rel, clip);
        return clip;
      } catch (e) {
        console.warn('[bakedAnim] parse fail', rel, e);
        return null;
      }
    })();
    inflight.set(rel, p);
  }
  return p;
}

export interface PackLoadResult {
  clips: Map<string, THREE.AnimationClip>;
  loaded: string[];
  missing: string[];
  source: 'baked' | 'empty';
}

/**
 * Parallel pack load — binds action names (idle, punch, …) to Bip001 clips.
 */
export async function loadBakedPack(packId: WeaponPackId): Promise<PackLoadResult> {
  const rels = BAKED_PACK_RELS[packId] || BAKED_PACK_RELS['sword-shield'];
  const entries = await Promise.all(
    Object.entries(rels).map(async ([action, rel]) => {
      const clip = await loadBakedClip(rel);
      if (!clip) return { action, clip: null as THREE.AnimationClip | null };
      // Named clone so mixer actions don't fight over clip.name
      const named = clip.clone();
      named.name = action;
      return { action, clip: named };
    }),
  );

  const clips = new Map<string, THREE.AnimationClip>();
  const loaded: string[] = [];
  const missing: string[] = [];
  for (const { action, clip } of entries) {
    if (clip) {
      clips.set(action, clip);
      loaded.push(action);
    } else {
      missing.push(action);
    }
  }
  return {
    clips,
    loaded,
    missing,
    source: loaded.length ? 'baked' : 'empty',
  };
}

/** Warm cache for packs used at match start (opening page / session create). */
export async function preloadAvernusAnims(
  packs: WeaponPackId[] = ['sword-shield', 'longbow', 'magic-caster', 'unarmed'],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const relSet = new Set<string>();
  for (const p of packs) {
    for (const rel of Object.values(BAKED_PACK_RELS[p] || {})) relSet.add(rel);
  }
  const rels = [...relSet];
  let done = 0;
  await Promise.all(
    rels.map(async (rel) => {
      await loadBakedClip(rel);
      done += 1;
      onProgress?.(done, rels.length);
    }),
  );
}

/** Apply pack clips onto an existing mixer + oaction map. */
export function bindClipsToMixer(
  mixer: THREE.AnimationMixer,
  oaction: Record<string, THREE.AnimationAction>,
  clips: Map<string, THREE.AnimationClip>,
  oneShotNames: string[] = [
    'punch',
    'fist',
    'strike',
    'dashAttack',
    'hit',
    'death',
    'jump',
    'whirlwind',
  ],
): string[] {
  const bound: string[] = [];
  for (const [name, clip] of clips) {
    if (oaction[name]) {
      try {
        oaction[name].stop();
      } catch {
        /* */
      }
    }
    const action = mixer.clipAction(clip);
    if (oneShotNames.includes(name)) {
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
    }
    oaction[name] = action;
    bound.push(name);
  }
  return bound;
}

export function bakedCacheStats(): { clips: number; inflight: number } {
  return { clips: clipCache.size, inflight: inflight.size };
}
