/**
 * Portable fishing systems ported from Grudge Angeler
 * (tension fight, fish roster, rods, bite/hook loop).
 */

export type FishRarity = "common" | "uncommon" | "rare" | "legendary" | "ultra_rare";

export interface FishSpecies {
  id: string;
  name: string;
  rarity: FishRarity;
  points: number;
  minDepth: number; // 0–1
  speed: number;
  weightMin: number;
  weightMax: number;
  fightPower: number; // 0.4–1.5
  color: string;
}

export interface RodStats {
  name: string;
  castRange: number;
  reelSpeedMult: number;
  lineStrength: number;
  catchZoneBonus: number;
}

/** Subset of Angeler rods for super-engine 3D loop */
export const RODS: RodStats[] = [
  { name: "Bamboo Rod", castRange: 28, reelSpeedMult: 1.0, lineStrength: 1.0, catchZoneBonus: 0 },
  { name: "Fiberglass Rod", castRange: 36, reelSpeedMult: 1.1, lineStrength: 1.15, catchZoneBonus: 0.02 },
  { name: "Carbon Rod", castRange: 44, reelSpeedMult: 1.2, lineStrength: 1.3, catchZoneBonus: 0.03 },
];

/** Compact fish table inspired by grudge-angeler FISH_TYPES */
export const FISH_SPECIES: FishSpecies[] = [
  { id: "minnow", name: "Minnow", rarity: "common", points: 10, minDepth: 0.05, speed: 1.4, weightMin: 0.1, weightMax: 0.4, fightPower: 0.45, color: "#a8c5d4" },
  { id: "perch", name: "Perch", rarity: "common", points: 20, minDepth: 0.1, speed: 1.1, weightMin: 0.3, weightMax: 1.2, fightPower: 0.55, color: "#6b8e4e" },
  { id: "bass", name: "Bass", rarity: "common", points: 35, minDepth: 0.15, speed: 1.0, weightMin: 0.8, weightMax: 3.0, fightPower: 0.7, color: "#4a6741" },
  { id: "salmon", name: "Salmon", rarity: "uncommon", points: 60, minDepth: 0.25, speed: 1.3, weightMin: 1.5, weightMax: 5.0, fightPower: 0.85, color: "#e07a5f" },
  { id: "catfish", name: "Catfish", rarity: "uncommon", points: 55, minDepth: 0.4, speed: 0.7, weightMin: 2.0, weightMax: 8.0, fightPower: 0.9, color: "#5c4b3a" },
  { id: "eel", name: "Eel", rarity: "uncommon", points: 50, minDepth: 0.35, speed: 1.2, weightMin: 0.5, weightMax: 2.5, fightPower: 0.8, color: "#3d3a4a" },
  { id: "trout", name: "Rainbow Trout", rarity: "rare", points: 90, minDepth: 0.3, speed: 1.5, weightMin: 1.0, weightMax: 4.0, fightPower: 1.0, color: "#7ec8e3" },
  { id: "swordfish", name: "Swordfish", rarity: "rare", points: 140, minDepth: 0.55, speed: 1.6, weightMin: 8, weightMax: 40, fightPower: 1.25, color: "#5b8def" },
  { id: "angler", name: "Deep Sea Angler", rarity: "legendary", points: 220, minDepth: 0.7, speed: 0.9, weightMin: 5, weightMax: 20, fightPower: 1.35, color: "#2a1a3a" },
  { id: "krakenling", name: "Krakenling", rarity: "ultra_rare", points: 400, minDepth: 0.85, speed: 1.1, weightMin: 15, weightMax: 60, fightPower: 1.5, color: "#8b0000" },
];

export const RARITY_WEIGHT: Record<FishRarity, number> = {
  common: 50,
  uncommon: 28,
  rare: 14,
  legendary: 6,
  ultra_rare: 2,
};

export type FightPhase = "idle" | "waiting" | "bite" | "fighting" | "landed" | "escaped" | "snapped";

export interface FightState {
  phase: FightPhase;
  fish: FishSpecies | null;
  weight: number;
  /** 0–1 green catch zone center */
  zoneCenter: number;
  zoneWidth: number;
  /** 0–1 cursor in tension bar (player control) */
  cursor: number;
  /** 0–1 fish stamina; deplete to land */
  fishStamina: number;
  /** 0–1 line stress; max snaps line */
  lineStress: number;
  /** seconds until auto-escape if ignored bite */
  biteTimer: number;
  message: string;
  score: number;
}

export function createIdleFight(): FightState {
  return {
    phase: "idle",
    fish: null,
    weight: 0,
    zoneCenter: 0.5,
    zoneWidth: 0.18,
    cursor: 0.5,
    fishStamina: 1,
    lineStress: 0,
    biteTimer: 0,
    message: "",
    score: 0,
  };
}

function pickWeighted<T extends { rarity: FishRarity }>(list: T[], rarityBoost = 1): T {
  const weights = list.map((f) => {
    let w = RARITY_WEIGHT[f.rarity] ?? 1;
    if (f.rarity !== "common") w *= rarityBoost;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

export function rollFishForDepth(depth01: number, rarityBoost = 1): { fish: FishSpecies; weight: number } {
  const candidates = FISH_SPECIES.filter((f) => depth01 >= f.minDepth * 0.85);
  const pool = candidates.length ? candidates : FISH_SPECIES.filter((f) => f.rarity === "common");
  const fish = pickWeighted(pool, rarityBoost);
  const t = Math.random();
  const weight = fish.weightMin + t * (fish.weightMax - fish.weightMin);
  return { fish, weight: Math.round(weight * 10) / 10 };
}

/** Start waiting for a bite after bobber lands */
export function beginWaiting(fight: FightState, depth01: number): void {
  fight.phase = "waiting";
  fight.fish = null;
  fight.lineStress = 0;
  fight.fishStamina = 1;
  fight.message = "Waiting for a bite…";
  // bite delay 2–8s, faster in deeper water slightly
  fight.biteTimer = 2 + Math.random() * 6 - depth01 * 1.5;
}

/** Call each frame while waiting/bite/fighting. Returns true if state changed meaningfully. */
export function updateFight(
  fight: FightState,
  dt: number,
  opts: {
    reeling: boolean;
    hookPressed: boolean;
    rod: RodStats;
    /** -1..1 horizontal mouse influence on cursor when fighting */
    aimX?: number;
  },
): void {
  const rod = opts.rod;

  if (fight.phase === "waiting") {
    fight.biteTimer -= dt;
    if (fight.biteTimer <= 0) {
      fight.phase = "bite";
      fight.biteTimer = 1.6 + Math.random() * 0.8; // window to press 3
      fight.message = "BITE! Press 3 to set the hook!";
    }
    if (opts.reeling) {
      fight.message = "Reeling in (empty)…";
    }
    return;
  }

  if (fight.phase === "bite") {
    fight.biteTimer -= dt;
    if (opts.hookPressed) {
      // successful hook — start fight
      const depthGuess = 0.3 + Math.random() * 0.5;
      const roll = rollFishForDepth(depthGuess);
      fight.fish = roll.fish;
      fight.weight = roll.weight;
      fight.phase = "fighting";
      fight.fishStamina = 1;
      fight.lineStress = 0.1;
      fight.zoneCenter = 0.35 + Math.random() * 0.3;
      fight.zoneWidth = Math.max(0.1, 0.2 + rod.catchZoneBonus - roll.fish.fightPower * 0.04);
      fight.cursor = 0.5;
      fight.message = `${roll.fish.name} hooked! Keep the bar in the green zone.`;
      return;
    }
    if (fight.biteTimer <= 0) {
      fight.phase = "escaped";
      fight.message = "Got away…";
      fight.biteTimer = 0;
    }
    return;
  }

  if (fight.phase === "fighting" && fight.fish) {
    // Fish oscillates the catch zone (Angeler-style)
    const t = performance.now() / 1000;
    const sway = Math.sin(t * (1.2 + fight.fish.speed * 0.4)) * 0.22 * fight.fish.fightPower;
    fight.zoneCenter = Math.max(0.15, Math.min(0.85, 0.5 + sway));

    // Player cursor: base drift + reel pulls toward zone + mouse aim
    const aim = opts.aimX ?? 0;
    fight.cursor += aim * dt * 1.8;
    if (opts.reeling) {
      // reel pulls cursor toward zone and drains fish stamina when in zone
      const pull = (fight.zoneCenter - fight.cursor) * dt * 2.2 * rod.reelSpeedMult;
      fight.cursor += pull;
    } else {
      // slack — cursor drifts and stress eases slightly
      fight.cursor += (Math.random() - 0.5) * dt * 0.4;
      fight.lineStress = Math.max(0, fight.lineStress - dt * 0.08);
    }
    fight.cursor = Math.max(0, Math.min(1, fight.cursor));

    const half = fight.zoneWidth / 2;
    const inZone = Math.abs(fight.cursor - fight.zoneCenter) <= half;

    if (opts.reeling) {
      if (inZone) {
        fight.fishStamina -= dt * (0.22 / fight.fish.fightPower) * rod.reelSpeedMult;
        fight.lineStress = Math.max(0, fight.lineStress - dt * 0.12 * rod.lineStrength);
        fight.message = `Fighting ${fight.fish.name}… Hold green!`;
      } else {
        fight.lineStress += dt * (0.35 * fight.fish.fightPower) / rod.lineStrength;
        fight.message = "Too much tension! Get back in the green!";
      }
    } else {
      fight.message = `Hold 2 to reel — ${fight.fish.name} (${fight.weight} lb)`;
      // fish recovers slightly when not reeling
      fight.fishStamina = Math.min(1, fight.fishStamina + dt * 0.04);
    }

    if (fight.lineStress >= 1) {
      fight.phase = "snapped";
      fight.message = "Line snapped!";
      fight.biteTimer = 0;
      return;
    }
    if (fight.fishStamina <= 0) {
      fight.phase = "landed";
      fight.score += fight.fish.points + Math.floor(fight.weight * 5);
      fight.message = `Caught ${fight.fish.name}! +${fight.fish.points} pts`;
      fight.biteTimer = 0;
    }
  }
}

export function rarityColor(r: FishRarity): string {
  switch (r) {
    case "common":
      return "#9ca3af";
    case "uncommon":
      return "#22c55e";
    case "rare":
      return "#3b82f6";
    case "legendary":
      return "#a855f7";
    case "ultra_rare":
      return "#f59e0b";
  }
}
