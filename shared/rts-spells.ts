/**
 * Grudge RTS — Spell / Skill System + AI Behaviors
 *
 * Defines all castable abilities for units and heroes, plus smart AI
 * decision-making for the PvE computer opponent.
 *
 * Each spell has: damage/heal, range, cooldown, mana cost, target type,
 * VFX particle config, and projectile behavior.
 *
 * AI behaviors: mages cast on enemies, paladins heal allies, knights charge,
 * archers kite, workers flee, and the strategic AI builds diverse armies.
 */

// ═══════════════════════════════════════════════════════════════════
// SPELL TYPES
// ═══════════════════════════════════════════════════════════════════

export type SpellTarget = "enemy" | "ally" | "self" | "ground" | "ally_wounded";
export type SpellVFXType = "fireball" | "lightning" | "heal" | "frost" | "holy" | "dark" | "slash" | "explosion" | "shield" | "wind" | "poison";

export interface SpellDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Who can be targeted */
  target: SpellTarget;
  /** Damage dealt (negative = heal) */
  damage: number;
  /** Heal amount (if heal spell) */
  heal: number;
  /** Cast range in world units */
  range: number;
  /** Cooldown in seconds */
  cooldown: number;
  /** Mana cost (0 for passive/free skills) */
  manaCost: number;
  /** Area of effect radius (0 = single target) */
  aoeRadius: number;
  /** Duration for buffs/debuffs in seconds */
  duration: number;
  /** Projectile speed (0 = instant) */
  projectileSpeed: number;
  /** VFX type for particle system */
  vfx: SpellVFXType;
  /** Particle color (hex) */
  vfxColor: number;
  /** Which unit types can use this spell */
  usableBy: string[];
  /** Status effect applied */
  statusEffect?: "slow" | "stun" | "burn" | "freeze" | "regen" | "shield" | "haste";
  /** Status effect strength (slow %, burn dps, etc.) */
  statusStrength?: number;
}

// ═══════════════════════════════════════════════════════════════════
// SPELL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const SPELLS: Record<string, SpellDef> = {
  // ── Mage spells ─────────────────────────────────────────────────
  fireball: {
    id: "fireball", name: "Fireball", icon: "🔥", description: "Hurls a ball of fire at the target.",
    target: "enemy", damage: 25, heal: 0, range: 6, cooldown: 4, manaCost: 15,
    aoeRadius: 1.5, duration: 0, projectileSpeed: 12, vfx: "fireball", vfxColor: 0xff4400,
    usableBy: ["mage", "wisdom_seer", "hex_shaman", "nature_channeler"],
    statusEffect: "burn", statusStrength: 3,
  },
  chain_lightning: {
    id: "chain_lightning", name: "Chain Lightning", icon: "⚡", description: "Lightning that jumps between enemies.",
    target: "enemy", damage: 18, heal: 0, range: 5, cooldown: 6, manaCost: 20,
    aoeRadius: 3, duration: 0, projectileSpeed: 0, vfx: "lightning", vfxColor: 0x44aaff,
    usableBy: ["mage", "wisdom_seer", "hex_shaman"],
  },
  frost_bolt: {
    id: "frost_bolt", name: "Frost Bolt", icon: "❄️", description: "Slows and damages the target.",
    target: "enemy", damage: 15, heal: 0, range: 5, cooldown: 3, manaCost: 10,
    aoeRadius: 0, duration: 4, projectileSpeed: 10, vfx: "frost", vfxColor: 0x88ddff,
    usableBy: ["mage", "wisdom_seer", "nature_channeler"],
    statusEffect: "slow", statusStrength: 40,
  },
  // ── Paladin / healer spells ─────────────────────────────────────
  holy_heal: {
    id: "holy_heal", name: "Holy Heal", icon: "✨", description: "Heals a wounded ally.",
    target: "ally_wounded", damage: 0, heal: 30, range: 5, cooldown: 5, manaCost: 15,
    aoeRadius: 0, duration: 0, projectileSpeed: 0, vfx: "heal", vfxColor: 0x44ff44,
    usableBy: ["paladin", "wisdom_seer", "nature_channeler"],
  },
  mass_heal: {
    id: "mass_heal", name: "Mass Heal", icon: "🌟", description: "Heals all nearby allies.",
    target: "self", damage: 0, heal: 15, range: 0, cooldown: 12, manaCost: 30,
    aoeRadius: 5, duration: 0, projectileSpeed: 0, vfx: "holy", vfxColor: 0xffffaa,
    usableBy: ["paladin"],
  },
  divine_shield: {
    id: "divine_shield", name: "Divine Shield", icon: "🛡️", description: "Grants a damage shield to self.",
    target: "self", damage: 0, heal: 0, range: 0, cooldown: 20, manaCost: 25,
    aoeRadius: 0, duration: 8, projectileSpeed: 0, vfx: "shield", vfxColor: 0xffdd00,
    usableBy: ["paladin", "knight"],
    statusEffect: "shield", statusStrength: 50,
  },
  // ── Knight / warrior spells ─────────────────────────────────────
  charge: {
    id: "charge", name: "Charge", icon: "💨", description: "Rush to target, dealing bonus damage.",
    target: "enemy", damage: 15, heal: 0, range: 8, cooldown: 8, manaCost: 0,
    aoeRadius: 0, duration: 0, projectileSpeed: 0, vfx: "wind", vfxColor: 0xaaddff,
    usableBy: ["knight", "footman"],
    statusEffect: "stun", statusStrength: 1.5,
  },
  war_cry: {
    id: "war_cry", name: "War Cry", icon: "📯", description: "Boosts nearby allies' speed.",
    target: "self", damage: 0, heal: 0, range: 0, cooldown: 15, manaCost: 0,
    aoeRadius: 6, duration: 8, projectileSpeed: 0, vfx: "slash", vfxColor: 0xffaa00,
    usableBy: ["knight", "footman"],
    statusEffect: "haste", statusStrength: 30,
  },
  // ── Archer spells ───────────────────────────────────────────────
  poison_arrow: {
    id: "poison_arrow", name: "Poison Arrow", icon: "☠️", description: "Shoots a poisoned arrow.",
    target: "enemy", damage: 10, heal: 0, range: 6, cooldown: 5, manaCost: 0,
    aoeRadius: 0, duration: 6, projectileSpeed: 15, vfx: "poison", vfxColor: 0x44ff00,
    usableBy: ["archer"],
    statusEffect: "burn", statusStrength: 2,
  },
  volley: {
    id: "volley", name: "Volley", icon: "🏹", description: "Rain arrows on an area.",
    target: "ground", damage: 8, heal: 0, range: 7, cooldown: 10, manaCost: 0,
    aoeRadius: 3, duration: 0, projectileSpeed: 12, vfx: "slash", vfxColor: 0x886644,
    usableBy: ["archer"],
  },
  // ── Dark / undead spells ────────────────────────────────────────
  raise_dead: {
    id: "raise_dead", name: "Raise Dead", icon: "💀", description: "Summons a skeleton at target location.",
    target: "ground", damage: 0, heal: 0, range: 6, cooldown: 20, manaCost: 30,
    aoeRadius: 0, duration: 30, projectileSpeed: 0, vfx: "dark", vfxColor: 0x6600aa,
    usableBy: ["mage"],
  },
  soul_drain: {
    id: "soul_drain", name: "Soul Drain", icon: "👻", description: "Drains HP from target, healing caster.",
    target: "enemy", damage: 20, heal: 15, range: 4, cooldown: 6, manaCost: 15,
    aoeRadius: 0, duration: 0, projectileSpeed: 8, vfx: "dark", vfxColor: 0x9900cc,
    usableBy: ["mage", "hex_shaman"],
  },
};

/** Get spells available for a given unit type */
export function getSpellsForUnit(unitType: string): SpellDef[] {
  return Object.values(SPELLS).filter(s => s.usableBy.includes(unitType));
}

// ═══════════════════════════════════════════════════════════════════
// VFX PARTICLE CONFIGS — per-spell visual effects
// ═══════════════════════════════════════════════════════════════════

export interface VFXConfig {
  type: SpellVFXType;
  /** Number of particles to spawn */
  count: number;
  /** Base particle size */
  size: number;
  /** Spread radius */
  spread: number;
  /** Upward velocity */
  upVelocity: number;
  /** Horizontal velocity */
  sideVelocity: number;
  /** Lifetime in seconds */
  lifetime: number;
  /** Does it spawn a ground ring */
  groundRing: boolean;
  /** Ground ring color */
  ringColor?: number;
  /** Ring max radius */
  ringRadius?: number;
}

export const VFX_CONFIGS: Record<SpellVFXType, VFXConfig> = {
  fireball:   { type: "fireball",   count: 12, size: 0.15, spread: 0.5, upVelocity: 2, sideVelocity: 2, lifetime: 0.5, groundRing: true, ringColor: 0xff4400, ringRadius: 1.5 },
  lightning:  { type: "lightning",   count: 8,  size: 0.08, spread: 0.3, upVelocity: 4, sideVelocity: 1, lifetime: 0.3, groundRing: false },
  heal:       { type: "heal",       count: 15, size: 0.1,  spread: 0.8, upVelocity: 3, sideVelocity: 0.5, lifetime: 0.8, groundRing: true, ringColor: 0x44ff44, ringRadius: 1 },
  frost:      { type: "frost",      count: 10, size: 0.12, spread: 0.4, upVelocity: 1, sideVelocity: 1.5, lifetime: 0.6, groundRing: true, ringColor: 0x88ddff, ringRadius: 1 },
  holy:       { type: "holy",       count: 20, size: 0.08, spread: 1.2, upVelocity: 4, sideVelocity: 0.3, lifetime: 1.0, groundRing: true, ringColor: 0xffffaa, ringRadius: 5 },
  dark:       { type: "dark",       count: 10, size: 0.14, spread: 0.6, upVelocity: 1, sideVelocity: 2, lifetime: 0.7, groundRing: true, ringColor: 0x6600aa, ringRadius: 1.5 },
  slash:      { type: "slash",      count: 6,  size: 0.1,  spread: 0.3, upVelocity: 1, sideVelocity: 3, lifetime: 0.3, groundRing: false },
  explosion:  { type: "explosion",  count: 25, size: 0.2,  spread: 2,   upVelocity: 5, sideVelocity: 4, lifetime: 0.6, groundRing: true, ringColor: 0xff8800, ringRadius: 3 },
  shield:     { type: "shield",     count: 8,  size: 0.06, spread: 0.5, upVelocity: 2, sideVelocity: 0.3, lifetime: 0.5, groundRing: true, ringColor: 0xffdd00, ringRadius: 1 },
  wind:       { type: "wind",       count: 6,  size: 0.08, spread: 0.4, upVelocity: 0.5, sideVelocity: 5, lifetime: 0.4, groundRing: false },
  poison:     { type: "poison",     count: 8,  size: 0.1,  spread: 0.5, upVelocity: 1.5, sideVelocity: 1, lifetime: 0.6, groundRing: false },
};

// ═══════════════════════════════════════════════════════════════════
// AI BEHAVIOR — Smart unit decision-making
// ═══════════════════════════════════════════════════════════════════

export type AIRole = "attacker" | "healer" | "caster" | "tank" | "ranged" | "worker" | "scout";

/** Map unit types to their AI combat role */
export const UNIT_AI_ROLE: Record<string, AIRole> = {
  peasant: "worker",
  footman: "tank",
  archer: "ranged",
  knight: "attacker",
  ballista: "ranged",
  mage: "caster",
  paladin: "healer",
  // Faction-specific (from grudge-rts-data)
  sky_serf: "worker", thrall_worker: "worker", grove_tender: "worker",
  valor_guard: "tank", chaos_grunt: "tank", root_warden: "tank",
  fate_lancer: "attacker", doom_berserker: "attacker", stone_sentinel: "tank",
  rune_marksman: "ranged", shadow_hunter: "ranged", leaf_archer: "ranged",
  thunder_charger: "attacker", warg_rider: "attacker", grove_rider: "attacker",
  cosmic_ram: "ranged", doom_catapult: "ranged", treant_ram: "ranged",
  wisdom_seer: "healer", hex_shaman: "caster", nature_channeler: "healer",
  raven_scout: "scout", plague_bat: "scout", bark_scout: "scout",
  eye_watcher: "caster", void_wraith: "caster", sylph_watcher: "caster",
};

export interface AIUnitState {
  unitId: string;
  unitType: string;
  role: AIRole;
  health: number;
  maxHealth: number;
  position: { x: number; z: number };
  hasTarget: boolean;
  /** Spell cooldowns (spell ID -> remaining seconds) */
  spellCooldowns: Record<string, number>;
}

export interface AIWorldState {
  friendlyUnits: AIUnitState[];
  enemyUnits: AIUnitState[];
  friendlyBuildings: Array<{ id: string; position: { x: number; z: number }; health: number; maxHealth: number }>;
  enemyBuildings: Array<{ id: string; position: { x: number; z: number }; health: number; maxHealth: number }>;
}

export interface AIDecision {
  unitId: string;
  action: "cast_spell" | "move" | "attack" | "flee" | "idle";
  spellId?: string;
  targetId?: string;
  targetPosition?: { x: number; z: number };
}

/**
 * Make AI decisions for a single unit based on its role, spells, and surroundings.
 * Called once per unit per AI tick (every ~0.5s).
 */
export function decideUnitAction(unit: AIUnitState, world: AIWorldState): AIDecision {
  const role = unit.role;
  const healthPct = unit.health / unit.maxHealth;
  const spells = getSpellsForUnit(unit.unitType);
  const readySpells = spells.filter(s => (unit.spellCooldowns[s.id] || 0) <= 0);

  // ── WORKER: flee from combat ─────────────────────────────────────
  if (role === "worker") {
    const nearbyEnemy = findNearestEnemy(unit, world, 6);
    if (nearbyEnemy) {
      // Run away from enemy
      const dx = unit.position.x - nearbyEnemy.position.x;
      const dz = unit.position.z - nearbyEnemy.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      return {
        unitId: unit.unitId,
        action: "flee",
        targetPosition: { x: unit.position.x + (dx / dist) * 8, z: unit.position.z + (dz / dist) * 8 },
      };
    }
    return { unitId: unit.unitId, action: "idle" };
  }

  // ── HEALER: prioritize healing wounded allies ─────────────────────
  if (role === "healer") {
    // Find most wounded ally in range
    const healSpell = readySpells.find(s => s.target === "ally_wounded" || (s.target === "self" && s.heal > 0));
    if (healSpell) {
      const woundedAlly = world.friendlyUnits
        .filter(u => u.unitId !== unit.unitId && u.health < u.maxHealth * 0.7)
        .sort((a, b) => (a.health / a.maxHealth) - (b.health / b.maxHealth))[0];

      if (woundedAlly && distBetween(unit, woundedAlly) <= healSpell.range) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: healSpell.id, targetId: woundedAlly.unitId };
      }
    }

    // Mass heal if self is low and has the spell
    if (healthPct < 0.5) {
      const massHeal = readySpells.find(s => s.id === "mass_heal");
      if (massHeal) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: massHeal.id };
      }
    }

    // Fall through to attack if no one needs healing
    const nearbyEnemy = findNearestEnemy(unit, world, 5);
    if (nearbyEnemy) {
      const dmgSpell = readySpells.find(s => s.target === "enemy" && s.damage > 0);
      if (dmgSpell && distBetween(unit, nearbyEnemy) <= dmgSpell.range) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: dmgSpell.id, targetId: nearbyEnemy.unitId };
      }
      return { unitId: unit.unitId, action: "attack", targetId: nearbyEnemy.unitId };
    }
    return { unitId: unit.unitId, action: "idle" };
  }

  // ── CASTER: use damage spells on enemies ──────────────────────────
  if (role === "caster") {
    const nearbyEnemy = findNearestEnemy(unit, world, 8);
    if (nearbyEnemy) {
      // Prioritize AoE if multiple enemies nearby
      const enemiesNearTarget = world.enemyUnits.filter(e => distBetween(nearbyEnemy, e) < 3).length;
      const aoeSpell = readySpells.find(s => s.target === "enemy" && s.aoeRadius > 1 && s.damage > 0);
      const singleSpell = readySpells.find(s => s.target === "enemy" && s.damage > 0);

      if (aoeSpell && enemiesNearTarget >= 3 && distBetween(unit, nearbyEnemy) <= aoeSpell.range) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: aoeSpell.id, targetId: nearbyEnemy.unitId };
      }
      if (singleSpell && distBetween(unit, nearbyEnemy) <= singleSpell.range) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: singleSpell.id, targetId: nearbyEnemy.unitId };
      }
      // Too close? Kite away
      if (distBetween(unit, nearbyEnemy) < 2) {
        const dx = unit.position.x - nearbyEnemy.position.x;
        const dz = unit.position.z - nearbyEnemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        return {
          unitId: unit.unitId,
          action: "move",
          targetPosition: { x: unit.position.x + (dx / dist) * 4, z: unit.position.z + (dz / dist) * 4 },
        };
      }
      return { unitId: unit.unitId, action: "attack", targetId: nearbyEnemy.unitId };
    }
    return { unitId: unit.unitId, action: "idle" };
  }

  // ── RANGED: kite and use skills ──────────────────────────────────
  if (role === "ranged") {
    const nearbyEnemy = findNearestEnemy(unit, world, 8);
    if (nearbyEnemy) {
      const rangedSpell = readySpells.find(s => s.target === "enemy" && s.damage > 0);
      if (rangedSpell && distBetween(unit, nearbyEnemy) <= rangedSpell.range) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: rangedSpell.id, targetId: nearbyEnemy.unitId };
      }
      // Kite: keep distance
      if (distBetween(unit, nearbyEnemy) < 3) {
        const dx = unit.position.x - nearbyEnemy.position.x;
        const dz = unit.position.z - nearbyEnemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        return {
          unitId: unit.unitId,
          action: "move",
          targetPosition: { x: unit.position.x + (dx / dist) * 3, z: unit.position.z + (dz / dist) * 3 },
        };
      }
      return { unitId: unit.unitId, action: "attack", targetId: nearbyEnemy.unitId };
    }
    return { unitId: unit.unitId, action: "idle" };
  }

  // ── ATTACKER: charge in and use melee skills ──────────────────────
  if (role === "attacker") {
    const nearbyEnemy = findNearestEnemy(unit, world, 10);
    if (nearbyEnemy) {
      // Use charge if far away
      const chargeSpell = readySpells.find(s => s.id === "charge");
      if (chargeSpell && distBetween(unit, nearbyEnemy) > 3 && distBetween(unit, nearbyEnemy) <= chargeSpell.range) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: chargeSpell.id, targetId: nearbyEnemy.unitId };
      }
      // War cry if in melee range with allies nearby
      const warCry = readySpells.find(s => s.id === "war_cry");
      const alliesNearby = world.friendlyUnits.filter(a => a.unitId !== unit.unitId && distBetween(unit, a) < 6).length;
      if (warCry && alliesNearby >= 2 && distBetween(unit, nearbyEnemy) < 3) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: warCry.id };
      }
      return { unitId: unit.unitId, action: "attack", targetId: nearbyEnemy.unitId };
    }
    return { unitId: unit.unitId, action: "idle" };
  }

  // ── TANK: protect allies, body-block ──────────────────────────────
  if (role === "tank") {
    const nearbyEnemy = findNearestEnemy(unit, world, 6);
    if (nearbyEnemy) {
      // Shield self if low HP
      const shieldSpell = readySpells.find(s => s.statusEffect === "shield");
      if (shieldSpell && healthPct < 0.4) {
        return { unitId: unit.unitId, action: "cast_spell", spellId: shieldSpell.id };
      }
      return { unitId: unit.unitId, action: "attack", targetId: nearbyEnemy.unitId };
    }
    return { unitId: unit.unitId, action: "idle" };
  }

  // ── SCOUT: hit and run ─────────────────────────────────────────
  if (role === "scout") {
    const nearbyEnemy = findNearestEnemy(unit, world, 10);
    if (nearbyEnemy) {
      if (healthPct < 0.3) {
        const dx = unit.position.x - nearbyEnemy.position.x;
        const dz = unit.position.z - nearbyEnemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        return {
          unitId: unit.unitId,
          action: "flee",
          targetPosition: { x: unit.position.x + (dx / dist) * 10, z: unit.position.z + (dz / dist) * 10 },
        };
      }
      return { unitId: unit.unitId, action: "attack", targetId: nearbyEnemy.unitId };
    }
    return { unitId: unit.unitId, action: "idle" };
  }

  return { unitId: unit.unitId, action: "idle" };
}

// ═══════════════════════════════════════════════════════════════════
// STRATEGIC AI — army composition and build order
// ═══════════════════════════════════════════════════════════════════

export type BuildPriority = "economy" | "army" | "tech" | "defense";

export interface StrategicDecision {
  trainUnit?: string;       // unit type to train
  buildBuilding?: string;   // building type to construct
  researchUpgrade?: string; // upgrade to research
  attackNow?: boolean;      // should army attack?
}

/**
 * High-level strategic AI — decides what to build and when to attack.
 * Called every few seconds.
 */
export function strategicAI(
  gold: number,
  lumber: number,
  foodUsed: number,
  foodMax: number,
  armySize: number,
  enemyArmyEstimate: number,
  hasBarracks: boolean,
  hasStable: boolean,
  hasChurch: boolean,
  gameTimeSeconds: number,
): StrategicDecision {
  const decision: StrategicDecision = {};

  // Phase 1: Early game (< 2 min) — economy focus
  if (gameTimeSeconds < 120) {
    if (foodUsed >= foodMax - 1 && gold >= 500 && lumber >= 250) {
      decision.buildBuilding = "farm";
    } else if (!hasBarracks && gold >= 700 && lumber >= 450) {
      decision.buildBuilding = "barracks";
    } else if (gold >= 400) {
      decision.trainUnit = "peasant";
    }
    return decision;
  }

  // Phase 2: Mid game (2-5 min) — army building
  if (gameTimeSeconds < 300) {
    if (foodUsed >= foodMax - 2 && gold >= 500 && lumber >= 250) {
      decision.buildBuilding = "farm";
    } else if (!hasStable && gold >= 1000 && lumber >= 300) {
      decision.buildBuilding = "stable";
    } else if (!hasChurch && gold >= 900 && lumber >= 500) {
      decision.buildBuilding = "church";
    } else if (hasStable && gold >= 800 && Math.random() > 0.5) {
      decision.trainUnit = "knight";
    } else if (hasChurch && gold >= 1200 && Math.random() > 0.7) {
      decision.trainUnit = "mage";
    } else if (hasBarracks && gold >= 600) {
      // Mix of footmen and archers
      decision.trainUnit = Math.random() > 0.4 ? "footman" : "archer";
    }

    // Attack if army is large enough
    if (armySize >= 8 && armySize > enemyArmyEstimate * 0.8) {
      decision.attackNow = true;
    }
    return decision;
  }

  // Phase 3: Late game (> 5 min) — full aggression with diverse army
  if (foodUsed >= foodMax - 2 && gold >= 500 && lumber >= 250) {
    decision.buildBuilding = "farm";
  } else {
    const roll = Math.random();
    if (hasChurch && gold >= 1200 && roll < 0.2) {
      decision.trainUnit = "mage";
    } else if (hasStable && gold >= 800 && roll < 0.5) {
      decision.trainUnit = Math.random() > 0.5 ? "knight" : "paladin";
    } else if (hasBarracks && gold >= 600) {
      decision.trainUnit = Math.random() > 0.3 ? "footman" : "archer";
    } else if (gold >= 900 && lumber >= 300) {
      decision.trainUnit = "ballista";
    }
  }

  // Always attack in late game if army exists
  if (armySize >= 4) {
    decision.attackNow = true;
  }

  return decision;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function distBetween(a: { position: { x: number; z: number } }, b: { position: { x: number; z: number } }): number {
  const dx = a.position.x - b.position.x;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function findNearestEnemy(unit: AIUnitState, world: AIWorldState, maxRange: number): AIUnitState | null {
  let nearest: AIUnitState | null = null;
  let nearestDist = maxRange;
  for (const enemy of world.enemyUnits) {
    const d = distBetween(unit, enemy);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = enemy;
    }
  }
  return nearest;
}
