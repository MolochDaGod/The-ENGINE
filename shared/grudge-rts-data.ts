/**
 * Grudge RTS — Complete Game Data
 *
 * Data-driven architecture (ConfigTD pattern): all game entities defined as typed
 * config. The game loop reads from these definitions — no hardcoded stats.
 *
 * 3 Factions:
 *   - Crusade (Human + Barbarian) — God: Odin the All-Father
 *   - Fabled  (Dwarf + Elf)      — God: Yggdrasil the World-Tree
 *   - Legion  (Orc + Undead)     — God: Entropy the Void-Maw
 *
 * Each faction has:
 *   - 13 buildings
 *   - 9 base units
 *   - 8-10 heroes (purchased at specific buildings)
 *   - 64 upgrades (10 categories, some multi-level up to L4)
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type FactionId = "crusade" | "fabled" | "legion";
export type CharacterRace = "human" | "barbarian" | "dwarf" | "elf" | "orc" | "undead";
export type HeroClass = "warrior" | "mage" | "ranger" | "worg";
export type UnitRole = "worker" | "melee" | "ranged" | "cavalry" | "siege" | "support" | "recon" | "air";
export type BuildingRole = "economy" | "melee_production" | "ranged_production" | "cavalry_production" | "siege_production" | "mage_production" | "worg_production" | "upgrade" | "defense" | "population" | "resource" | "expansion" | "armor_upgrade";
export type UpgradeCategory = "melee" | "ranged" | "armor" | "skills" | "units" | "buildings" | "spells" | "health" | "towers" | "faction";
export type DamageClass = "physical" | "magic" | "pierce" | "siege";
export type AttackStrategy = "first" | "last" | "strongest" | "weakest" | "nearest" | "farthest";

export interface ResourceCost {
  gold: number;
  wood: number;
}

export interface FactionConfig {
  id: FactionId;
  name: string;
  races: [CharacterRace, CharacterRace];
  god: string;
  godTitle: string;
  theme: string;
  motto: string;
  lore: string;
  colors: { primary: number; secondary: number; accent: number };
}

export interface BuildingDef {
  id: string;
  name: string;
  faction: FactionId;
  role: BuildingRole;
  cost: ResourceCost;
  buildTime: number;
  hp: number;
  food: number;
  trains: string[];      // unit IDs this building can produce
  heroSlots: string[];   // hero IDs purchasable here
  icon: string;
}

export interface UnitDef {
  id: string;
  name: string;
  faction: FactionId;
  role: UnitRole;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  cost: ResourceCost;
  buildTime: number;
  pop: number;
  damageClass: DamageClass;
  trainedAt: string;     // building ID
  abilities?: string[];
}

export interface HeroDef {
  id: string;
  name: string;
  faction: FactionId;
  race: CharacterRace;
  heroClass: HeroClass;
  purchaseBuilding: string;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  mp: number;
  abilities: string[];
  lore?: string;
  secret?: boolean;
}

export interface UpgradeDef {
  id: string;
  name: string;
  faction: FactionId;
  category: UpgradeCategory;
  level: number;         // 1-4 for multi-level
  maxLevel: number;
  cost: ResourceCost;
  researchTime: number;
  researchedAt: string;  // building ID
  prerequisite: string | null;  // upgrade ID or building ID
  effect: string;        // human-readable
  statMod?: Record<string, number>;  // e.g. { "melee_atk_pct": 5 }
}

// ═══════════════════════════════════════════════════════════════════
// FACTION CONFIGS
// ═══════════════════════════════════════════════════════════════════

export const FACTIONS: Record<FactionId, FactionConfig> = {
  crusade: {
    id: "crusade",
    name: "Crusade",
    races: ["human", "barbarian"],
    god: "Odin",
    godTitle: "The All-Father",
    theme: "Victory Through Valor",
    motto: "We March Forward!",
    lore: "Worshipers gain battle foresight and weapon mastery; temples on mountain peaks near the Cosmic Waterfall.",
    colors: { primary: 0x4169e1, secondary: 0xffd700, accent: 0xf0f0f0 },
  },
  fabled: {
    id: "fabled",
    name: "Fabled",
    races: ["dwarf", "elf"],
    god: "Yggdrasil",
    godTitle: "The World-Tree",
    theme: "Balance Through Unity",
    motto: "In Harmony We Stand!",
    lore: "Guardians of the ancient groves; their magic flows from the roots of the World-Tree that connects all realms.",
    colors: { primary: 0x228b22, secondary: 0xc0c0c0, accent: 0x8b4513 },
  },
  legion: {
    id: "legion",
    name: "Legion",
    races: ["orc", "undead"],
    god: "Entropy",
    godTitle: "The Void-Maw",
    theme: "Power Through Chaos",
    motto: "From Ashes We Rise!",
    lore: "Followers of the Void-Maw draw strength from destruction itself; their citadels rise from the bones of fallen worlds.",
    colors: { primary: 0xdc143c, secondary: 0x2f0030, accent: 0x00ff00 },
  },
};

// ═══════════════════════════════════════════════════════════════════
// CRUSADE — Buildings, Units, Heroes, Upgrades
// ═══════════════════════════════════════════════════════════════════

export const CRUSADE_BUILDINGS: BuildingDef[] = [
  { id: "odins_hall", name: "Odin's Hall", faction: "crusade", role: "economy", cost: { gold: 400, wood: 200 }, buildTime: 45, hp: 1200, food: 1, trains: ["sky_serf"], heroSlots: [], icon: "🏰" },
  { id: "valor_barracks", name: "Valor Barracks", faction: "crusade", role: "melee_production", cost: { gold: 150, wood: 50 }, buildTime: 20, hp: 800, food: 0, trains: ["valor_guard", "fate_lancer"], heroSlots: ["sir_aldric_valorheart", "ulfgar_bonecrusher"], icon: "🏛️" },
  { id: "rune_archery", name: "Rune Archery", faction: "crusade", role: "ranged_production", cost: { gold: 140, wood: 70 }, buildTime: 18, hp: 700, food: 0, trains: ["rune_marksman"], heroSlots: ["kael_shadowblade", "svala_windrider"], icon: "🏹" },
  { id: "thunder_stable", name: "Thunder Stable", faction: "crusade", role: "cavalry_production", cost: { gold: 220, wood: 120 }, buildTime: 25, hp: 600, food: 0, trains: ["thunder_charger"], heroSlots: [], icon: "🐎" },
  { id: "fate_forge", name: "Fate Forge", faction: "crusade", role: "upgrade", cost: { gold: 150, wood: 100 }, buildTime: 22, hp: 750, food: 0, trains: [], heroSlots: [], icon: "⚒️" },
  { id: "raven_tower", name: "Raven Tower", faction: "crusade", role: "defense", cost: { gold: 100, wood: 80 }, buildTime: 15, hp: 500, food: 0, trains: ["raven_scout"], heroSlots: [], icon: "🗼" },
  { id: "valhalla_farm", name: "Valhalla Farm", faction: "crusade", role: "population", cost: { gold: 80, wood: 40 }, buildTime: 15, hp: 400, food: 4, trains: [], heroSlots: [], icon: "🌾" },
  { id: "gungnir_mill", name: "Gungnir Mill", faction: "crusade", role: "resource", cost: { gold: 120, wood: 60 }, buildTime: 20, hp: 600, food: 0, trains: [], heroSlots: [], icon: "🪓" },
  { id: "wisdom_chapel", name: "Wisdom Chapel", faction: "crusade", role: "mage_production", cost: { gold: 200, wood: 100 }, buildTime: 25, hp: 650, food: 0, trains: ["wisdom_seer"], heroSlots: ["archmage_elara_brightspire", "volka_stormborn"], icon: "⛪" },
  { id: "allfather_armory", name: "Allfather Armory", faction: "crusade", role: "armor_upgrade", cost: { gold: 180, wood: 90 }, buildTime: 22, hp: 700, food: 0, trains: [], heroSlots: [], icon: "🛡️" },
  { id: "spear_workshop", name: "Spear Workshop", faction: "crusade", role: "siege_production", cost: { gold: 250, wood: 150 }, buildTime: 30, hp: 800, food: 0, trains: ["cosmic_ram"], heroSlots: [], icon: "🎯" },
  { id: "foresight_outpost", name: "Foresight Outpost", faction: "crusade", role: "expansion", cost: { gold: 300, wood: 100 }, buildTime: 35, hp: 500, food: 0, trains: ["eye_watcher"], heroSlots: [], icon: "🔭" },
  { id: "wolf_den", name: "Wolf Den", faction: "crusade", role: "worg_production", cost: { gold: 190, wood: 110 }, buildTime: 24, hp: 650, food: 0, trains: [], heroSlots: ["gareth_moonshadow", "hrothgar_fangborn"], icon: "🐺" },
];

export const CRUSADE_UNITS: UnitDef[] = [
  { id: "sky_serf", name: "Sky Serf", faction: "crusade", role: "worker", icon: "👷", hp: 75, atk: 4, def: 1, spd: 40, rng: 1.0, cost: { gold: 50, wood: 0 }, buildTime: 12, pop: 1, damageClass: "physical", trainedAt: "odins_hall" },
  { id: "valor_guard", name: "Valor Guard", faction: "crusade", role: "melee", icon: "⚔️", hp: 200, atk: 18, def: 10, spd: 45, rng: 1.0, cost: { gold: 75, wood: 10 }, buildTime: 14, pop: 1, damageClass: "physical", trainedAt: "valor_barracks" },
  { id: "fate_lancer", name: "Fate Lancer", faction: "crusade", role: "melee", icon: "🔱", hp: 230, atk: 20, def: 12, spd: 42, rng: 1.0, cost: { gold: 90, wood: 15 }, buildTime: 16, pop: 1, damageClass: "physical", trainedAt: "valor_barracks" },
  { id: "rune_marksman", name: "Rune Marksman", faction: "crusade", role: "ranged", icon: "🏹", hp: 150, atk: 22, def: 8, spd: 60, rng: 5.0, cost: { gold: 110, wood: 25 }, buildTime: 18, pop: 1, damageClass: "pierce", trainedAt: "rune_archery" },
  { id: "thunder_charger", name: "Thunder Charger", faction: "crusade", role: "cavalry", icon: "🐴", hp: 330, atk: 28, def: 16, spd: 68, rng: 1.0, cost: { gold: 200, wood: 50 }, buildTime: 24, pop: 2, damageClass: "physical", trainedAt: "thunder_stable" },
  { id: "cosmic_ram", name: "Cosmic Ram", faction: "crusade", role: "siege", icon: "🪨", hp: 450, atk: 40, def: 6, spd: 20, rng: 8.0, cost: { gold: 300, wood: 200 }, buildTime: 35, pop: 3, damageClass: "siege", trainedAt: "spear_workshop" },
  { id: "wisdom_seer", name: "Wisdom Seer", faction: "crusade", role: "support", icon: "🧙", hp: 120, atk: 10, def: 5, spd: 50, rng: 4.0, cost: { gold: 130, wood: 30 }, buildTime: 20, pop: 1, damageClass: "magic", trainedAt: "wisdom_chapel" },
  { id: "raven_scout", name: "Raven Scout", faction: "crusade", role: "recon", icon: "🦅", hp: 100, atk: 8, def: 4, spd: 80, rng: 2.0, cost: { gold: 60, wood: 20 }, buildTime: 15, pop: 1, damageClass: "physical", trainedAt: "raven_tower" },
  { id: "eye_watcher", name: "Eye Watcher", faction: "crusade", role: "air", icon: "👁️", hp: 220, atk: 24, def: 8, spd: 75, rng: 5.0, cost: { gold: 180, wood: 100 }, buildTime: 24, pop: 2, damageClass: "magic", trainedAt: "foresight_outpost" },
];

export const CRUSADE_HEROES: HeroDef[] = [
  { id: "sir_aldric_valorheart", name: "Sir Aldric Valorheart", faction: "crusade", race: "human", heroClass: "warrior", purchaseBuilding: "valor_barracks", icon: "⚔️", hp: 245, atk: 23, def: 19, spd: 57, rng: 1.5, mp: 95, abilities: ["shield_wall", "valor_charge", "battle_cry"] },
  { id: "gareth_moonshadow", name: "Gareth Moonshadow", faction: "crusade", race: "human", heroClass: "worg", purchaseBuilding: "wolf_den", icon: "🐺", hp: 235, atk: 22, def: 16, spd: 67, rng: 1.5, mp: 100, abilities: ["wolf_form", "shadow_pounce", "pack_howl"] },
  { id: "archmage_elara_brightspire", name: "Archmage Elara Brightspire", faction: "crusade", race: "human", heroClass: "mage", purchaseBuilding: "wisdom_chapel", icon: "✨", hp: 175, atk: 21, def: 9, spd: 62, rng: 5.5, mp: 155, abilities: ["arcane_blast", "mana_shield", "meteor_storm"] },
  { id: "kael_shadowblade", name: "Kael Shadowblade", faction: "crusade", race: "human", heroClass: "ranger", purchaseBuilding: "rune_archery", icon: "🎯", hp: 185, atk: 22, def: 11, spd: 72, rng: 6.5, mp: 115, abilities: ["aimed_shot", "shadow_step", "rain_of_arrows"] },
  { id: "ulfgar_bonecrusher", name: "Ulfgar Bonecrusher", faction: "crusade", race: "barbarian", heroClass: "warrior", purchaseBuilding: "valor_barracks", icon: "🪓", hp: 255, atk: 26, def: 17, spd: 58, rng: 1.5, mp: 85, abilities: ["ground_slam", "berserker_rage", "bone_crush"] },
  { id: "hrothgar_fangborn", name: "Hrothgar Fangborn", faction: "crusade", race: "barbarian", heroClass: "worg", purchaseBuilding: "wolf_den", icon: "🐻", hp: 245, atk: 25, def: 14, spd: 68, rng: 1.5, mp: 90, abilities: ["bear_form", "feral_charge", "primal_roar"] },
  { id: "volka_stormborn", name: "Volka Stormborn", faction: "crusade", race: "barbarian", heroClass: "mage", purchaseBuilding: "wisdom_chapel", icon: "⚡", hp: 185, atk: 24, def: 7, spd: 63, rng: 5.5, mp: 145, abilities: ["chain_lightning", "storm_shield", "thunder_crash"] },
  { id: "svala_windrider", name: "Svala Windrider", faction: "crusade", race: "barbarian", heroClass: "ranger", purchaseBuilding: "rune_archery", icon: "🦅", hp: 195, atk: 25, def: 9, spd: 73, rng: 6.5, mp: 105, abilities: ["wind_arrow", "eagle_eye", "gale_barrage"] },
  { id: "racalvin_the_pirate_king", name: "Racalvin the Pirate King", faction: "crusade", race: "human", heroClass: "worg", purchaseBuilding: "wolf_den", icon: "☠️", hp: 225, atk: 30, def: 9, spd: 78, rng: 6.5, mp: 105, abilities: ["plunder", "cannon_barrage", "kraken_call"], lore: "The legendary Pirate King who founded Grudge Studio.", secret: true },
  { id: "cpt_john_wayne", name: "Cpt. John Wayne", faction: "crusade", race: "human", heroClass: "warrior", purchaseBuilding: "valor_barracks", icon: "🏴‍☠️", hp: 240, atk: 30, def: 18, spd: 60, rng: 2.5, mp: 90, abilities: ["broadside", "grappling_hook", "walk_the_plank"], lore: "A fearless sea captain who fights with dual cutlasses.", secret: true },
];

// ── Crusade Upgrades (64 total) ──────────────────────────────────

function crusadeUpgrade(id: string, name: string, cat: UpgradeCategory, level: number, maxLevel: number, cost: ResourceCost, at: string, prereq: string | null, effect: string, statMod?: Record<string, number>): UpgradeDef {
  return { id, name, faction: "crusade", category: cat, level, maxLevel, cost, researchTime: Math.round(cost.gold / 5), researchedAt: at, prerequisite: prereq, effect, statMod };
}

export const CRUSADE_UPGRADES: UpgradeDef[] = [
  // Melee (10)
  crusadeUpgrade("c_melee_dmg_1", "Melee Damage L1", "melee", 1, 4, { gold: 100, wood: 50 }, "fate_forge", null, "+5% ATK for melee units", { melee_atk_pct: 5 }),
  crusadeUpgrade("c_melee_dmg_2", "Melee Damage L2", "melee", 2, 4, { gold: 200, wood: 100 }, "fate_forge", "c_melee_dmg_1", "+10% ATK for melee units", { melee_atk_pct: 10 }),
  crusadeUpgrade("c_melee_dmg_3", "Melee Damage L3", "melee", 3, 4, { gold: 300, wood: 150 }, "fate_forge", "c_melee_dmg_2", "+15% ATK for melee units", { melee_atk_pct: 15 }),
  crusadeUpgrade("c_melee_dmg_4", "Melee Damage L4", "melee", 4, 4, { gold: 400, wood: 200 }, "fate_forge", "c_melee_dmg_3", "+20% ATK for melee units", { melee_atk_pct: 20 }),
  crusadeUpgrade("c_melee_speed", "Melee Speed Boost", "melee", 1, 1, { gold: 150, wood: 75 }, "fate_forge", "valor_barracks", "+10% SPD for melee", { melee_spd_pct: 10 }),
  crusadeUpgrade("c_melee_cleave", "Melee Cleave", "melee", 1, 1, { gold: 250, wood: 125 }, "fate_forge", "fate_forge", "Cleave: 20% dmg to adjacent", { melee_cleave_pct: 20 }),
  crusadeUpgrade("c_melee_stun", "Melee Stun Chance", "melee", 1, 1, { gold: 180, wood: 90 }, "fate_forge", null, "5% stun on melee hit", { melee_stun_pct: 5 }),
  crusadeUpgrade("c_melee_regen", "Melee HP Regen", "melee", 1, 1, { gold: 220, wood: 110 }, "fate_forge", "valhalla_farm", "+2 HP/s for melee", { melee_hp_regen: 2 }),
  crusadeUpgrade("c_melee_charge", "Melee Charge", "melee", 1, 1, { gold: 280, wood: 140 }, "fate_forge", "thunder_stable", "+15% dmg on first hit", { melee_charge_pct: 15 }),
  crusadeUpgrade("c_melee_fury", "Melee Fury", "melee", 1, 1, { gold: 300, wood: 150 }, "fate_forge", "c_melee_dmg_2", "+5% ATK per kill (max 20%)", { melee_fury_pct: 5 }),
  // Ranged (10)
  crusadeUpgrade("c_ranged_dmg_1", "Ranged Damage L1", "ranged", 1, 4, { gold: 100, wood: 50 }, "fate_forge", null, "+5% ATK for ranged", { ranged_atk_pct: 5 }),
  crusadeUpgrade("c_ranged_dmg_2", "Ranged Damage L2", "ranged", 2, 4, { gold: 200, wood: 100 }, "fate_forge", "c_ranged_dmg_1", "+10% ATK for ranged", { ranged_atk_pct: 10 }),
  crusadeUpgrade("c_ranged_dmg_3", "Ranged Damage L3", "ranged", 3, 4, { gold: 300, wood: 150 }, "fate_forge", "c_ranged_dmg_2", "+15% ATK for ranged", { ranged_atk_pct: 15 }),
  crusadeUpgrade("c_ranged_dmg_4", "Ranged Damage L4", "ranged", 4, 4, { gold: 400, wood: 200 }, "fate_forge", "c_ranged_dmg_3", "+20% ATK for ranged", { ranged_atk_pct: 20 }),
  crusadeUpgrade("c_ranged_range", "Ranged Range Boost", "ranged", 1, 1, { gold: 150, wood: 75 }, "fate_forge", "rune_archery", "+1 RNG for ranged", { ranged_rng_flat: 1 }),
  crusadeUpgrade("c_ranged_pierce", "Ranged Pierce", "ranged", 1, 1, { gold: 250, wood: 125 }, "fate_forge", "fate_forge", "Ignores 10% DEF", { ranged_pierce_pct: 10 }),
  crusadeUpgrade("c_ranged_crit", "Ranged Crit Chance", "ranged", 1, 1, { gold: 180, wood: 90 }, "fate_forge", null, "10% crit (x2 dmg)", { ranged_crit_pct: 10 }),
  crusadeUpgrade("c_ranged_volley", "Ranged Volley", "ranged", 1, 1, { gold: 220, wood: 110 }, "fate_forge", "spear_workshop", "+1 projectile per attack", { ranged_extra_proj: 1 }),
  crusadeUpgrade("c_ranged_slow", "Ranged Slow", "ranged", 1, 1, { gold: 280, wood: 140 }, "fate_forge", "wisdom_chapel", "10% slow on hit", { ranged_slow_pct: 10 }),
  crusadeUpgrade("c_ranged_accuracy", "Ranged Accuracy", "ranged", 1, 1, { gold: 300, wood: 150 }, "fate_forge", "raven_tower", "+15% hit vs moving", { ranged_accuracy_pct: 15 }),
  // Armor (8)
  crusadeUpgrade("c_armor_1", "Armor Toughness L1", "armor", 1, 4, { gold: 120, wood: 60 }, "allfather_armory", null, "+5% DEF for all", { all_def_pct: 5 }),
  crusadeUpgrade("c_armor_2", "Armor Toughness L2", "armor", 2, 4, { gold: 240, wood: 120 }, "allfather_armory", "c_armor_1", "+10% DEF for all", { all_def_pct: 10 }),
  crusadeUpgrade("c_armor_3", "Armor Toughness L3", "armor", 3, 4, { gold: 360, wood: 180 }, "allfather_armory", "c_armor_2", "+15% DEF for all", { all_def_pct: 15 }),
  crusadeUpgrade("c_armor_4", "Armor Toughness L4", "armor", 4, 4, { gold: 480, wood: 240 }, "allfather_armory", "c_armor_3", "+20% DEF for all", { all_def_pct: 20 }),
  crusadeUpgrade("c_armor_resist", "Armor Resistance", "armor", 1, 1, { gold: 200, wood: 100 }, "allfather_armory", "allfather_armory", "+10% magic resist", { all_magic_resist_pct: 10 }),
  crusadeUpgrade("c_armor_shield", "Armor Shielding", "armor", 1, 1, { gold: 280, wood: 140 }, "allfather_armory", "fate_forge", "Blocks 5 dmg per hit", { all_flat_block: 5 }),
  crusadeUpgrade("c_armor_reflect", "Armor Reflection", "armor", 1, 1, { gold: 320, wood: 160 }, "allfather_armory", "c_armor_3", "5% dmg reflect", { all_reflect_pct: 5 }),
  crusadeUpgrade("c_armor_dur", "Armor Durability", "armor", 1, 1, { gold: 250, wood: 125 }, "allfather_armory", "thunder_stable", "+20% HP for armored", { armored_hp_pct: 20 }),
  // Skills (6)
  crusadeUpgrade("c_skill_cd_1", "Skill Cooldown L1", "skills", 1, 2, { gold: 150, wood: 75 }, "wisdom_chapel", "wisdom_chapel", "-5% ability cooldowns", { skill_cd_pct: -5 }),
  crusadeUpgrade("c_skill_cd_2", "Skill Cooldown L2", "skills", 2, 2, { gold: 300, wood: 150 }, "wisdom_chapel", "c_skill_cd_1", "-10% ability cooldowns", { skill_cd_pct: -10 }),
  crusadeUpgrade("c_skill_power", "Skill Power Boost", "skills", 1, 1, { gold: 200, wood: 100 }, "wisdom_chapel", null, "+10% skill dmg", { skill_dmg_pct: 10 }),
  crusadeUpgrade("c_skill_mana", "Skill Mana Efficiency", "skills", 1, 1, { gold: 250, wood: 125 }, "wisdom_chapel", "c_skill_cd_1", "-15% MP cost", { skill_mp_pct: -15 }),
  crusadeUpgrade("c_skill_duration", "Skill Duration", "skills", 1, 1, { gold: 280, wood: 140 }, "fate_forge", "fate_forge", "+20% buff/debuff duration", { skill_dur_pct: 20 }),
  crusadeUpgrade("c_skill_chain", "Skill Chain", "skills", 1, 1, { gold: 350, wood: 175 }, "wisdom_chapel", "odins_hall", "Skills chain to +1 target", { skill_chain_targets: 1 }),
  // Units (8)
  crusadeUpgrade("c_unit_train_1", "Unit Training L1", "units", 1, 2, { gold: 100, wood: 50 }, "odins_hall", "valor_barracks", "-10% build time", { unit_build_time_pct: -10 }),
  crusadeUpgrade("c_unit_train_2", "Unit Training L2", "units", 2, 2, { gold: 200, wood: 100 }, "odins_hall", "c_unit_train_1", "-15% build time", { unit_build_time_pct: -15 }),
  crusadeUpgrade("c_unit_hp", "Unit HP Boost", "units", 1, 1, { gold: 180, wood: 90 }, "odins_hall", "valhalla_farm", "+10% HP for all", { all_hp_pct: 10 }),
  crusadeUpgrade("c_unit_speed", "Unit Speed Enhance", "units", 1, 1, { gold: 220, wood: 110 }, "odins_hall", "thunder_stable", "+5 SPD for all", { all_spd_flat: 5 }),
  crusadeUpgrade("c_unit_pop", "Unit Pop Efficiency", "units", 1, 1, { gold: 300, wood: 150 }, "odins_hall", "c_unit_train_2", "-1 pop for basic units", { basic_pop_reduce: 1 }),
  crusadeUpgrade("c_unit_stealth", "Unit Stealth Mode", "units", 1, 1, { gold: 280, wood: 140 }, "rune_archery", "rune_archery", "Basic units gain short stealth", { unit_stealth_dur: 3 }),
  crusadeUpgrade("c_unit_heal_aura", "Unit Heal Aura", "units", 1, 1, { gold: 250, wood: 125 }, "wisdom_chapel", "wisdom_chapel", "Units regen 1% HP near heroes", { hero_aura_heal_pct: 1 }),
  crusadeUpgrade("c_unit_elite", "Unit Elite Variant", "units", 1, 1, { gold: 400, wood: 200 }, "odins_hall", "spear_workshop", "Unlocks elite tier (+20% stats)", { elite_stat_pct: 20 }),
  // Buildings (6)
  crusadeUpgrade("c_bld_dur_1", "Building Durability L1", "buildings", 1, 2, { gold: 120, wood: 60 }, "odins_hall", null, "+10% HP for buildings", { building_hp_pct: 10 }),
  crusadeUpgrade("c_bld_dur_2", "Building Durability L2", "buildings", 2, 2, { gold: 240, wood: 120 }, "odins_hall", "c_bld_dur_1", "+15% HP for buildings", { building_hp_pct: 15 }),
  crusadeUpgrade("c_bld_speed", "Building Build Speed", "buildings", 1, 1, { gold: 200, wood: 100 }, "gungnir_mill", "gungnir_mill", "-20% build time", { building_time_pct: -20 }),
  crusadeUpgrade("c_bld_resource", "Building Resource Boost", "buildings", 1, 1, { gold: 280, wood: 140 }, "odins_hall", "odins_hall", "+10% resource production", { resource_prod_pct: 10 }),
  crusadeUpgrade("c_bld_defense", "Building Defense", "buildings", 1, 1, { gold: 320, wood: 160 }, "raven_tower", "raven_tower", "Buildings gain auto-attack", { building_auto_atk: 1 }),
  crusadeUpgrade("c_bld_expand", "Building Expansion", "buildings", 1, 1, { gold: 350, wood: 175 }, "foresight_outpost", "foresight_outpost", "+1 expansion slot", { expansion_slots: 1 }),
  // Spells (4)
  crusadeUpgrade("c_spell_power_1", "Spell Power L1", "spells", 1, 2, { gold: 150, wood: 75 }, "wisdom_chapel", "wisdom_chapel", "+10% spell dmg", { spell_dmg_pct: 10 }),
  crusadeUpgrade("c_spell_power_2", "Spell Power L2", "spells", 2, 2, { gold: 300, wood: 150 }, "wisdom_chapel", "c_spell_power_1", "+15% spell dmg", { spell_dmg_pct: 15 }),
  crusadeUpgrade("c_spell_range", "Spell Range", "spells", 1, 1, { gold: 250, wood: 125 }, "fate_forge", "fate_forge", "+2 RNG for spells", { spell_rng_flat: 2 }),
  crusadeUpgrade("c_spell_ult", "Spell Ultimate", "spells", 1, 1, { gold: 400, wood: 200 }, "wisdom_chapel", "c_spell_power_2", "Unlocks faction ultimate spell"),
  // Health (4)
  crusadeUpgrade("c_hp_regen_1", "Health Regen L1", "health", 1, 2, { gold: 100, wood: 50 }, "valhalla_farm", "valhalla_farm", "+1 HP/s for all", { all_hp_regen: 1 }),
  crusadeUpgrade("c_hp_regen_2", "Health Regen L2", "health", 2, 2, { gold: 200, wood: 100 }, "valhalla_farm", "c_hp_regen_1", "+2 HP/s for all", { all_hp_regen: 2 }),
  crusadeUpgrade("c_hp_max", "Health Max Boost", "health", 1, 1, { gold: 250, wood: 125 }, "allfather_armory", "allfather_armory", "+10% max HP", { all_max_hp_pct: 10 }),
  crusadeUpgrade("c_hp_revive", "Health Resurrection", "health", 1, 1, { gold: 350, wood: 175 }, "wisdom_chapel", "wisdom_chapel", "5% chance to revive", { revive_chance_pct: 5 }),
  // Towers (4)
  crusadeUpgrade("c_tower_dmg_1", "Tower Damage L1", "towers", 1, 2, { gold: 120, wood: 60 }, "raven_tower", "raven_tower", "+10% ATK for towers", { tower_atk_pct: 10 }),
  crusadeUpgrade("c_tower_dmg_2", "Tower Damage L2", "towers", 2, 2, { gold: 240, wood: 120 }, "raven_tower", "c_tower_dmg_1", "+15% ATK for towers", { tower_atk_pct: 15 }),
  crusadeUpgrade("c_tower_range", "Tower Range", "towers", 1, 1, { gold: 200, wood: 100 }, "rune_archery", "rune_archery", "+2 RNG for towers", { tower_rng_flat: 2 }),
  crusadeUpgrade("c_tower_splash", "Tower Splash", "towers", 1, 1, { gold: 300, wood: 150 }, "fate_forge", "fate_forge", "AoE for tower attacks", { tower_splash: 1 }),
  // Faction (4)
  crusadeUpgrade("c_faction_valor", "Faction Valor", "faction", 1, 1, { gold: 500, wood: 250 }, "odins_hall", "c_armor_4", "+5% all stats", { all_stats_pct: 5 }),
  crusadeUpgrade("c_faction_wisdom", "Faction Wisdom", "faction", 1, 1, { gold: 400, wood: 200 }, "wisdom_chapel", "wisdom_chapel", "+10% XP gain", { xp_gain_pct: 10 }),
  crusadeUpgrade("c_faction_fate", "Faction Fate", "faction", 1, 1, { gold: 350, wood: 175 }, "foresight_outpost", "foresight_outpost", "Reveals map fog", { reveal_fog: 1 }),
  crusadeUpgrade("c_faction_victory", "Faction Victory", "faction", 1, 1, { gold: 450, wood: 225 }, "odins_hall", null, "+20% dmg vs heroes", { hero_dmg_pct: 20 }),
];

// ═══════════════════════════════════════════════════════════════════
// FABLED — Buildings, Units, Heroes, Upgrades
// ═══════════════════════════════════════════════════════════════════

export const FABLED_BUILDINGS: BuildingDef[] = [
  { id: "world_tree_hall", name: "World-Tree Hall", faction: "fabled", role: "economy", cost: { gold: 400, wood: 200 }, buildTime: 45, hp: 1200, food: 1, trains: ["grove_tender"], heroSlots: [], icon: "🌳" },
  { id: "eternal_barracks", name: "Eternal Barracks", faction: "fabled", role: "melee_production", cost: { gold: 150, wood: 50 }, buildTime: 20, hp: 800, food: 0, trains: ["root_warden", "stone_sentinel"], heroSlots: ["thane_ironshield", "thalion_bladedancer"], icon: "🏛️" },
  { id: "harmony_archery", name: "Harmony Archery", faction: "fabled", role: "ranged_production", cost: { gold: 140, wood: 70 }, buildTime: 18, hp: 700, food: 0, trains: ["leaf_archer"], heroSlots: ["durin_tunnelwatcher", "aelindra_swiftbow"], icon: "🏹" },
  { id: "ancient_stable", name: "Ancient Stable", faction: "fabled", role: "cavalry_production", cost: { gold: 220, wood: 120 }, buildTime: 25, hp: 600, food: 0, trains: ["grove_rider"], heroSlots: [], icon: "🦌" },
  { id: "balance_forge", name: "Balance Forge", faction: "fabled", role: "upgrade", cost: { gold: 150, wood: 100 }, buildTime: 22, hp: 750, food: 0, trains: [], heroSlots: [], icon: "⚒️" },
  { id: "sentinel_tower", name: "Sentinel Tower", faction: "fabled", role: "defense", cost: { gold: 100, wood: 80 }, buildTime: 15, hp: 500, food: 0, trains: ["bark_scout"], heroSlots: [], icon: "🗼" },
  { id: "eden_garden", name: "Eden Garden", faction: "fabled", role: "population", cost: { gold: 80, wood: 40 }, buildTime: 15, hp: 400, food: 4, trains: [], heroSlots: [], icon: "🌿" },
  { id: "crystal_mill", name: "Crystal Mill", faction: "fabled", role: "resource", cost: { gold: 120, wood: 60 }, buildTime: 20, hp: 600, food: 0, trains: [], heroSlots: [], icon: "💎" },
  { id: "unity_tower", name: "Unity Tower", faction: "fabled", role: "mage_production", cost: { gold: 200, wood: 100 }, buildTime: 25, hp: 650, food: 0, trains: ["nature_channeler"], heroSlots: ["runa_forgekeeper", "lyra_stormweaver"], icon: "🔮" },
  { id: "rootwood_armory", name: "Rootwood Armory", faction: "fabled", role: "armor_upgrade", cost: { gold: 180, wood: 90 }, buildTime: 22, hp: 700, food: 0, trains: [], heroSlots: [], icon: "🛡️" },
  { id: "earthen_workshop", name: "Earthen Workshop", faction: "fabled", role: "siege_production", cost: { gold: 250, wood: 150 }, buildTime: 30, hp: 800, food: 0, trains: ["treant_ram"], heroSlots: [], icon: "🪨" },
  { id: "starlight_outpost", name: "Starlight Outpost", faction: "fabled", role: "expansion", cost: { gold: 300, wood: 100 }, buildTime: 35, hp: 500, food: 0, trains: ["sylph_watcher"], heroSlots: [], icon: "⭐" },
  { id: "infinity_hut", name: "Infinity Hut", faction: "fabled", role: "worg_production", cost: { gold: 190, wood: 110 }, buildTime: 24, hp: 650, food: 0, trains: [], heroSlots: ["bromm_earthshaker", "sylara_wildheart"], icon: "🐾" },
];

export const FABLED_UNITS: UnitDef[] = [
  { id: "grove_tender", name: "Grove Tender", faction: "fabled", role: "worker", icon: "🧑‍🌾", hp: 80, atk: 3, def: 2, spd: 38, rng: 1.0, cost: { gold: 50, wood: 0 }, buildTime: 12, pop: 1, damageClass: "physical", trainedAt: "world_tree_hall" },
  { id: "root_warden", name: "Root Warden", faction: "fabled", role: "melee", icon: "⚔️", hp: 220, atk: 16, def: 14, spd: 40, rng: 1.0, cost: { gold: 75, wood: 10 }, buildTime: 14, pop: 1, damageClass: "physical", trainedAt: "eternal_barracks" },
  { id: "stone_sentinel", name: "Stone Sentinel", faction: "fabled", role: "melee", icon: "🗿", hp: 260, atk: 17, def: 16, spd: 35, rng: 1.0, cost: { gold: 90, wood: 15 }, buildTime: 16, pop: 1, damageClass: "physical", trainedAt: "eternal_barracks" },
  { id: "leaf_archer", name: "Leaf Archer", faction: "fabled", role: "ranged", icon: "🍃", hp: 140, atk: 20, def: 6, spd: 65, rng: 5.5, cost: { gold: 110, wood: 25 }, buildTime: 18, pop: 1, damageClass: "pierce", trainedAt: "harmony_archery" },
  { id: "grove_rider", name: "Grove Rider", faction: "fabled", role: "cavalry", icon: "🦌", hp: 310, atk: 24, def: 18, spd: 62, rng: 1.0, cost: { gold: 200, wood: 50 }, buildTime: 24, pop: 2, damageClass: "physical", trainedAt: "ancient_stable" },
  { id: "treant_ram", name: "Treant Ram", faction: "fabled", role: "siege", icon: "🌲", hp: 500, atk: 35, def: 10, spd: 18, rng: 7.0, cost: { gold: 300, wood: 200 }, buildTime: 35, pop: 3, damageClass: "siege", trainedAt: "earthen_workshop" },
  { id: "nature_channeler", name: "Nature Channeler", faction: "fabled", role: "support", icon: "🌸", hp: 130, atk: 12, def: 6, spd: 48, rng: 4.5, cost: { gold: 130, wood: 30 }, buildTime: 20, pop: 1, damageClass: "magic", trainedAt: "unity_tower" },
  { id: "bark_scout", name: "Bark Scout", faction: "fabled", role: "recon", icon: "🐿️", hp: 90, atk: 7, def: 5, spd: 85, rng: 2.0, cost: { gold: 60, wood: 20 }, buildTime: 15, pop: 1, damageClass: "physical", trainedAt: "sentinel_tower" },
  { id: "sylph_watcher", name: "Sylph Watcher", faction: "fabled", role: "air", icon: "🧚", hp: 200, atk: 22, def: 6, spd: 80, rng: 5.0, cost: { gold: 180, wood: 100 }, buildTime: 24, pop: 2, damageClass: "magic", trainedAt: "starlight_outpost" },
];

export const FABLED_HEROES: HeroDef[] = [
  { id: "thane_ironshield", name: "Thane Ironshield", faction: "fabled", race: "dwarf", heroClass: "warrior", purchaseBuilding: "eternal_barracks", icon: "🛡️", hp: 260, atk: 24, def: 23, spd: 47, rng: 1.5, mp: 90, abilities: ["iron_wall", "hammer_smash", "dwarven_fortitude"] },
  { id: "bromm_earthshaker", name: "Bromm Earthshaker", faction: "fabled", race: "dwarf", heroClass: "worg", purchaseBuilding: "infinity_hut", icon: "🐻", hp: 250, atk: 23, def: 20, spd: 57, rng: 1.5, mp: 95, abilities: ["earth_form", "seismic_charge", "tremor_roar"] },
  { id: "runa_forgekeeper", name: "Runa Forgekeeper", faction: "fabled", race: "dwarf", heroClass: "mage", purchaseBuilding: "unity_tower", icon: "🔥", hp: 190, atk: 22, def: 13, spd: 52, rng: 5.5, mp: 150, abilities: ["forge_fire", "rune_barrier", "magma_eruption"] },
  { id: "durin_tunnelwatcher", name: "Durin Tunnelwatcher", faction: "fabled", race: "dwarf", heroClass: "ranger", purchaseBuilding: "harmony_archery", icon: "🏹", hp: 200, atk: 23, def: 15, spd: 62, rng: 6.5, mp: 110, abilities: ["tunnel_shot", "stone_trap", "cave_barrage"] },
  { id: "thalion_bladedancer", name: "Thalion Bladedancer", faction: "fabled", race: "elf", heroClass: "warrior", purchaseBuilding: "eternal_barracks", icon: "💃", hp: 230, atk: 22, def: 16, spd: 60, rng: 1.5, mp: 120, abilities: ["blade_dance", "wind_slash", "elven_grace"] },
  { id: "sylara_wildheart", name: "Sylara Wildheart", faction: "fabled", race: "elf", heroClass: "worg", purchaseBuilding: "infinity_hut", icon: "🌿", hp: 220, atk: 21, def: 13, spd: 70, rng: 1.5, mp: 115, abilities: ["wild_form", "vine_lash", "nature_call"] },
  { id: "lyra_stormweaver", name: "Lyra Stormweaver", faction: "fabled", race: "elf", heroClass: "mage", purchaseBuilding: "unity_tower", icon: "🌊", hp: 160, atk: 20, def: 6, spd: 65, rng: 5.5, mp: 170, abilities: ["storm_bolt", "arcane_weave", "tempest_fury"] },
  { id: "aelindra_swiftbow", name: "Aelindra Swiftbow", faction: "fabled", race: "elf", heroClass: "ranger", purchaseBuilding: "harmony_archery", icon: "🎯", hp: 170, atk: 21, def: 8, spd: 75, rng: 6.5, mp: 130, abilities: ["swift_shot", "shadow_arrow", "starfall_volley"] },
];

// Fabled upgrades mirror Crusade structure with faction-themed names
function fabledUpgrade(id: string, name: string, cat: UpgradeCategory, level: number, maxLevel: number, cost: ResourceCost, at: string, prereq: string | null, effect: string, statMod?: Record<string, number>): UpgradeDef {
  return { id, name, faction: "fabled", category: cat, level, maxLevel, cost, researchTime: Math.round(cost.gold / 5), researchedAt: at, prerequisite: prereq, effect, statMod };
}

export const FABLED_UPGRADES: UpgradeDef[] = [
  // Melee (10)
  fabledUpgrade("f_melee_dmg_1", "Harmony Damage L1", "melee", 1, 4, { gold: 100, wood: 50 }, "balance_forge", null, "+5% ATK for melee", { melee_atk_pct: 5 }),
  fabledUpgrade("f_melee_dmg_2", "Harmony Damage L2", "melee", 2, 4, { gold: 200, wood: 100 }, "balance_forge", "f_melee_dmg_1", "+10% ATK for melee", { melee_atk_pct: 10 }),
  fabledUpgrade("f_melee_dmg_3", "Harmony Damage L3", "melee", 3, 4, { gold: 300, wood: 150 }, "balance_forge", "f_melee_dmg_2", "+15% ATK for melee", { melee_atk_pct: 15 }),
  fabledUpgrade("f_melee_dmg_4", "Harmony Damage L4", "melee", 4, 4, { gold: 400, wood: 200 }, "balance_forge", "f_melee_dmg_3", "+20% ATK for melee", { melee_atk_pct: 20 }),
  fabledUpgrade("f_melee_speed", "Root Speed Boost", "melee", 1, 1, { gold: 150, wood: 75 }, "balance_forge", "eternal_barracks", "+10% SPD for melee", { melee_spd_pct: 10 }),
  fabledUpgrade("f_melee_cleave", "Bark Cleave", "melee", 1, 1, { gold: 250, wood: 125 }, "balance_forge", "balance_forge", "Cleave: 20% dmg to adjacent", { melee_cleave_pct: 20 }),
  fabledUpgrade("f_melee_stun", "Stone Stun", "melee", 1, 1, { gold: 180, wood: 90 }, "balance_forge", null, "5% stun on melee hit", { melee_stun_pct: 5 }),
  fabledUpgrade("f_melee_regen", "Nature's Mend", "melee", 1, 1, { gold: 220, wood: 110 }, "balance_forge", "eden_garden", "+2 HP/s for melee", { melee_hp_regen: 2 }),
  fabledUpgrade("f_melee_charge", "Grove Charge", "melee", 1, 1, { gold: 280, wood: 140 }, "balance_forge", "ancient_stable", "+15% dmg on first hit", { melee_charge_pct: 15 }),
  fabledUpgrade("f_melee_fury", "Ancient Fury", "melee", 1, 1, { gold: 300, wood: 150 }, "balance_forge", "f_melee_dmg_2", "+5% ATK per kill (max 20%)", { melee_fury_pct: 5 }),
  // Ranged (10)
  fabledUpgrade("f_ranged_dmg_1", "Leaf Damage L1", "ranged", 1, 4, { gold: 100, wood: 50 }, "balance_forge", null, "+5% ATK for ranged", { ranged_atk_pct: 5 }),
  fabledUpgrade("f_ranged_dmg_2", "Leaf Damage L2", "ranged", 2, 4, { gold: 200, wood: 100 }, "balance_forge", "f_ranged_dmg_1", "+10% ATK for ranged", { ranged_atk_pct: 10 }),
  fabledUpgrade("f_ranged_dmg_3", "Leaf Damage L3", "ranged", 3, 4, { gold: 300, wood: 150 }, "balance_forge", "f_ranged_dmg_2", "+15% ATK for ranged", { ranged_atk_pct: 15 }),
  fabledUpgrade("f_ranged_dmg_4", "Leaf Damage L4", "ranged", 4, 4, { gold: 400, wood: 200 }, "balance_forge", "f_ranged_dmg_3", "+20% ATK for ranged", { ranged_atk_pct: 20 }),
  fabledUpgrade("f_ranged_range", "Elven Range", "ranged", 1, 1, { gold: 150, wood: 75 }, "balance_forge", "harmony_archery", "+1 RNG for ranged", { ranged_rng_flat: 1 }),
  fabledUpgrade("f_ranged_pierce", "Crystal Pierce", "ranged", 1, 1, { gold: 250, wood: 125 }, "balance_forge", "balance_forge", "Ignores 10% DEF", { ranged_pierce_pct: 10 }),
  fabledUpgrade("f_ranged_crit", "Starlight Crit", "ranged", 1, 1, { gold: 180, wood: 90 }, "balance_forge", null, "10% crit (x2 dmg)", { ranged_crit_pct: 10 }),
  fabledUpgrade("f_ranged_volley", "Nature Volley", "ranged", 1, 1, { gold: 220, wood: 110 }, "balance_forge", "earthen_workshop", "+1 projectile per attack", { ranged_extra_proj: 1 }),
  fabledUpgrade("f_ranged_slow", "Vine Slow", "ranged", 1, 1, { gold: 280, wood: 140 }, "balance_forge", "unity_tower", "10% slow on hit", { ranged_slow_pct: 10 }),
  fabledUpgrade("f_ranged_accuracy", "Eagle Accuracy", "ranged", 1, 1, { gold: 300, wood: 150 }, "balance_forge", "sentinel_tower", "+15% hit vs moving", { ranged_accuracy_pct: 15 }),
  // Armor (8)
  fabledUpgrade("f_armor_1", "Bark Toughness L1", "armor", 1, 4, { gold: 120, wood: 60 }, "rootwood_armory", null, "+5% DEF for all", { all_def_pct: 5 }),
  fabledUpgrade("f_armor_2", "Bark Toughness L2", "armor", 2, 4, { gold: 240, wood: 120 }, "rootwood_armory", "f_armor_1", "+10% DEF for all", { all_def_pct: 10 }),
  fabledUpgrade("f_armor_3", "Bark Toughness L3", "armor", 3, 4, { gold: 360, wood: 180 }, "rootwood_armory", "f_armor_2", "+15% DEF for all", { all_def_pct: 15 }),
  fabledUpgrade("f_armor_4", "Bark Toughness L4", "armor", 4, 4, { gold: 480, wood: 240 }, "rootwood_armory", "f_armor_3", "+20% DEF for all", { all_def_pct: 20 }),
  fabledUpgrade("f_armor_resist", "Nature Resistance", "armor", 1, 1, { gold: 200, wood: 100 }, "rootwood_armory", "rootwood_armory", "+10% magic resist", { all_magic_resist_pct: 10 }),
  fabledUpgrade("f_armor_shield", "Stone Shielding", "armor", 1, 1, { gold: 280, wood: 140 }, "rootwood_armory", "balance_forge", "Blocks 5 dmg per hit", { all_flat_block: 5 }),
  fabledUpgrade("f_armor_reflect", "Thorn Reflection", "armor", 1, 1, { gold: 320, wood: 160 }, "rootwood_armory", "f_armor_3", "5% dmg reflect", { all_reflect_pct: 5 }),
  fabledUpgrade("f_armor_dur", "Ancient Durability", "armor", 1, 1, { gold: 250, wood: 125 }, "rootwood_armory", "ancient_stable", "+20% HP for armored", { armored_hp_pct: 20 }),
  // Skills (6)
  fabledUpgrade("f_skill_cd_1", "Unity Cooldown L1", "skills", 1, 2, { gold: 150, wood: 75 }, "unity_tower", "unity_tower", "-5% ability cooldowns", { skill_cd_pct: -5 }),
  fabledUpgrade("f_skill_cd_2", "Unity Cooldown L2", "skills", 2, 2, { gold: 300, wood: 150 }, "unity_tower", "f_skill_cd_1", "-10% ability cooldowns", { skill_cd_pct: -10 }),
  fabledUpgrade("f_skill_power", "Balance Power", "skills", 1, 1, { gold: 200, wood: 100 }, "unity_tower", null, "+10% skill dmg", { skill_dmg_pct: 10 }),
  fabledUpgrade("f_skill_mana", "Crystal Efficiency", "skills", 1, 1, { gold: 250, wood: 125 }, "unity_tower", "f_skill_cd_1", "-15% MP cost", { skill_mp_pct: -15 }),
  fabledUpgrade("f_skill_duration", "Eternal Duration", "skills", 1, 1, { gold: 280, wood: 140 }, "balance_forge", "balance_forge", "+20% buff/debuff duration", { skill_dur_pct: 20 }),
  fabledUpgrade("f_skill_chain", "Harmony Chain", "skills", 1, 1, { gold: 350, wood: 175 }, "unity_tower", "world_tree_hall", "Skills chain to +1 target", { skill_chain_targets: 1 }),
  // Units (8)
  fabledUpgrade("f_unit_train_1", "Grove Training L1", "units", 1, 2, { gold: 100, wood: 50 }, "world_tree_hall", "eternal_barracks", "-10% build time", { unit_build_time_pct: -10 }),
  fabledUpgrade("f_unit_train_2", "Grove Training L2", "units", 2, 2, { gold: 200, wood: 100 }, "world_tree_hall", "f_unit_train_1", "-15% build time", { unit_build_time_pct: -15 }),
  fabledUpgrade("f_unit_hp", "Ancient Vitality", "units", 1, 1, { gold: 180, wood: 90 }, "world_tree_hall", "eden_garden", "+10% HP for all", { all_hp_pct: 10 }),
  fabledUpgrade("f_unit_speed", "Wind Enhancement", "units", 1, 1, { gold: 220, wood: 110 }, "world_tree_hall", "ancient_stable", "+5 SPD for all", { all_spd_flat: 5 }),
  fabledUpgrade("f_unit_pop", "Root Efficiency", "units", 1, 1, { gold: 300, wood: 150 }, "world_tree_hall", "f_unit_train_2", "-1 pop for basic units", { basic_pop_reduce: 1 }),
  fabledUpgrade("f_unit_stealth", "Shadow Canopy", "units", 1, 1, { gold: 280, wood: 140 }, "harmony_archery", "harmony_archery", "Basic units gain short stealth", { unit_stealth_dur: 3 }),
  fabledUpgrade("f_unit_heal_aura", "Life Blossom", "units", 1, 1, { gold: 250, wood: 125 }, "unity_tower", "unity_tower", "Units regen 1% HP near heroes", { hero_aura_heal_pct: 1 }),
  fabledUpgrade("f_unit_elite", "Ancient Elite", "units", 1, 1, { gold: 400, wood: 200 }, "world_tree_hall", "earthen_workshop", "Unlocks elite tier (+20% stats)", { elite_stat_pct: 20 }),
  // Buildings (6)
  fabledUpgrade("f_bld_dur_1", "Root Durability L1", "buildings", 1, 2, { gold: 120, wood: 60 }, "world_tree_hall", null, "+10% HP for buildings", { building_hp_pct: 10 }),
  fabledUpgrade("f_bld_dur_2", "Root Durability L2", "buildings", 2, 2, { gold: 240, wood: 120 }, "world_tree_hall", "f_bld_dur_1", "+15% HP for buildings", { building_hp_pct: 15 }),
  fabledUpgrade("f_bld_speed", "Crystal Construction", "buildings", 1, 1, { gold: 200, wood: 100 }, "crystal_mill", "crystal_mill", "-20% build time", { building_time_pct: -20 }),
  fabledUpgrade("f_bld_resource", "World-Tree Blessing", "buildings", 1, 1, { gold: 280, wood: 140 }, "world_tree_hall", "world_tree_hall", "+10% resource production", { resource_prod_pct: 10 }),
  fabledUpgrade("f_bld_defense", "Sentinel Defense", "buildings", 1, 1, { gold: 320, wood: 160 }, "sentinel_tower", "sentinel_tower", "Buildings gain auto-attack", { building_auto_atk: 1 }),
  fabledUpgrade("f_bld_expand", "Starlight Expansion", "buildings", 1, 1, { gold: 350, wood: 175 }, "starlight_outpost", "starlight_outpost", "+1 expansion slot", { expansion_slots: 1 }),
  // Spells (4)
  fabledUpgrade("f_spell_power_1", "Nature Power L1", "spells", 1, 2, { gold: 150, wood: 75 }, "unity_tower", "unity_tower", "+10% spell dmg", { spell_dmg_pct: 10 }),
  fabledUpgrade("f_spell_power_2", "Nature Power L2", "spells", 2, 2, { gold: 300, wood: 150 }, "unity_tower", "f_spell_power_1", "+15% spell dmg", { spell_dmg_pct: 15 }),
  fabledUpgrade("f_spell_range", "Starlight Range", "spells", 1, 1, { gold: 250, wood: 125 }, "balance_forge", "balance_forge", "+2 RNG for spells", { spell_rng_flat: 2 }),
  fabledUpgrade("f_spell_ult", "World-Tree Ultimate", "spells", 1, 1, { gold: 400, wood: 200 }, "unity_tower", "f_spell_power_2", "Unlocks faction ultimate spell"),
  // Health (4)
  fabledUpgrade("f_hp_regen_1", "Life Bloom L1", "health", 1, 2, { gold: 100, wood: 50 }, "eden_garden", "eden_garden", "+1 HP/s for all", { all_hp_regen: 1 }),
  fabledUpgrade("f_hp_regen_2", "Life Bloom L2", "health", 2, 2, { gold: 200, wood: 100 }, "eden_garden", "f_hp_regen_1", "+2 HP/s for all", { all_hp_regen: 2 }),
  fabledUpgrade("f_hp_max", "Ancient Vigor", "health", 1, 1, { gold: 250, wood: 125 }, "rootwood_armory", "rootwood_armory", "+10% max HP", { all_max_hp_pct: 10 }),
  fabledUpgrade("f_hp_revive", "Rebirth Seed", "health", 1, 1, { gold: 350, wood: 175 }, "unity_tower", "unity_tower", "5% chance to revive", { revive_chance_pct: 5 }),
  // Towers (4)
  fabledUpgrade("f_tower_dmg_1", "Sentinel Damage L1", "towers", 1, 2, { gold: 120, wood: 60 }, "sentinel_tower", "sentinel_tower", "+10% ATK for towers", { tower_atk_pct: 10 }),
  fabledUpgrade("f_tower_dmg_2", "Sentinel Damage L2", "towers", 2, 2, { gold: 240, wood: 120 }, "sentinel_tower", "f_tower_dmg_1", "+15% ATK for towers", { tower_atk_pct: 15 }),
  fabledUpgrade("f_tower_range", "Elven Sight", "towers", 1, 1, { gold: 200, wood: 100 }, "harmony_archery", "harmony_archery", "+2 RNG for towers", { tower_rng_flat: 2 }),
  fabledUpgrade("f_tower_splash", "Nature Splash", "towers", 1, 1, { gold: 300, wood: 150 }, "balance_forge", "balance_forge", "AoE for tower attacks", { tower_splash: 1 }),
  // Faction (4)
  fabledUpgrade("f_faction_balance", "Faction Balance", "faction", 1, 1, { gold: 500, wood: 250 }, "world_tree_hall", "f_armor_4", "+5% all stats", { all_stats_pct: 5 }),
  fabledUpgrade("f_faction_unity", "Faction Unity", "faction", 1, 1, { gold: 400, wood: 200 }, "unity_tower", "unity_tower", "+10% XP gain", { xp_gain_pct: 10 }),
  fabledUpgrade("f_faction_sight", "Faction Foresight", "faction", 1, 1, { gold: 350, wood: 175 }, "starlight_outpost", "starlight_outpost", "Reveals map fog", { reveal_fog: 1 }),
  fabledUpgrade("f_faction_harmony", "Faction Harmony", "faction", 1, 1, { gold: 450, wood: 225 }, "world_tree_hall", null, "+20% dmg vs heroes", { hero_dmg_pct: 20 }),
];

// ═══════════════════════════════════════════════════════════════════
// LEGION — Buildings, Units, Heroes, Upgrades
// ═══════════════════════════════════════════════════════════════════

export const LEGION_BUILDINGS: BuildingDef[] = [
  { id: "void_citadel", name: "Void Citadel", faction: "legion", role: "economy", cost: { gold: 400, wood: 200 }, buildTime: 45, hp: 1200, food: 1, trains: ["thrall_worker"], heroSlots: [], icon: "💀" },
  { id: "entropy_pit", name: "Entropy Pit", faction: "legion", role: "melee_production", cost: { gold: 150, wood: 50 }, buildTime: 20, hp: 800, food: 0, trains: ["chaos_grunt", "doom_berserker"], heroSlots: ["grommash_ironjaw", "lord_malachar"], icon: "🕳️" },
  { id: "riddle_hut", name: "Riddle Hut", faction: "legion", role: "ranged_production", cost: { gold: 140, wood: 70 }, buildTime: 18, hp: 700, food: 0, trains: ["shadow_hunter"], heroSlots: ["razak_deadeye", "shade_whisper"], icon: "🏚️" },
  { id: "blood_stable", name: "Blood Stable", faction: "legion", role: "cavalry_production", cost: { gold: 220, wood: 120 }, buildTime: 25, hp: 600, food: 0, trains: ["warg_rider"], heroSlots: [], icon: "🐗" },
  { id: "dark_forge", name: "Dark Forge", faction: "legion", role: "upgrade", cost: { gold: 150, wood: 100 }, buildTime: 22, hp: 750, food: 0, trains: [], heroSlots: [], icon: "🔨" },
  { id: "blight_tower", name: "Blight Tower", faction: "legion", role: "defense", cost: { gold: 100, wood: 80 }, buildTime: 15, hp: 500, food: 0, trains: ["plague_bat"], heroSlots: [], icon: "🗼" },
  { id: "bone_pit", name: "Bone Pit", faction: "legion", role: "population", cost: { gold: 80, wood: 40 }, buildTime: 15, hp: 400, food: 4, trains: [], heroSlots: [], icon: "🦴" },
  { id: "soul_mill", name: "Soul Mill", faction: "legion", role: "resource", cost: { gold: 120, wood: 60 }, buildTime: 20, hp: 600, food: 0, trains: [], heroSlots: [], icon: "⚙️" },
  { id: "void_crypt", name: "Void Crypt", faction: "legion", role: "mage_production", cost: { gold: 200, wood: 100 }, buildTime: 25, hp: 650, food: 0, trains: ["hex_shaman"], heroSlots: ["zuljin_the_hexmaster", "necromancer_vexis"], icon: "🏴" },
  { id: "iron_armory", name: "Iron Armory", faction: "legion", role: "armor_upgrade", cost: { gold: 180, wood: 90 }, buildTime: 22, hp: 700, food: 0, trains: [], heroSlots: [], icon: "⚔️" },
  { id: "siege_foundry", name: "Siege Foundry", faction: "legion", role: "siege_production", cost: { gold: 250, wood: 150 }, buildTime: 30, hp: 800, food: 0, trains: ["doom_catapult"], heroSlots: [], icon: "💣" },
  { id: "shadow_outpost", name: "Shadow Outpost", faction: "legion", role: "expansion", cost: { gold: 300, wood: 100 }, buildTime: 35, hp: 500, food: 0, trains: ["void_wraith"], heroSlots: [], icon: "👁️" },
  { id: "transformation_den", name: "Transformation Den", faction: "legion", role: "worg_production", cost: { gold: 190, wood: 110 }, buildTime: 24, hp: 650, food: 0, trains: [], heroSlots: ["fenris_bloodfang", "the_ghoulfather"], icon: "🐺" },
];

export const LEGION_UNITS: UnitDef[] = [
  { id: "thrall_worker", name: "Thrall Worker", faction: "legion", role: "worker", icon: "⛏️", hp: 70, atk: 5, def: 0, spd: 42, rng: 1.0, cost: { gold: 50, wood: 0 }, buildTime: 12, pop: 1, damageClass: "physical", trainedAt: "void_citadel" },
  { id: "chaos_grunt", name: "Chaos Grunt", faction: "legion", role: "melee", icon: "👹", hp: 190, atk: 20, def: 8, spd: 48, rng: 1.0, cost: { gold: 75, wood: 10 }, buildTime: 14, pop: 1, damageClass: "physical", trainedAt: "entropy_pit" },
  { id: "doom_berserker", name: "Doom Berserker", faction: "legion", role: "melee", icon: "🔥", hp: 210, atk: 24, def: 6, spd: 50, rng: 1.0, cost: { gold: 90, wood: 15 }, buildTime: 16, pop: 1, damageClass: "physical", trainedAt: "entropy_pit" },
  { id: "shadow_hunter", name: "Shadow Hunter", faction: "legion", role: "ranged", icon: "🏹", hp: 145, atk: 24, def: 7, spd: 58, rng: 5.0, cost: { gold: 110, wood: 25 }, buildTime: 18, pop: 1, damageClass: "pierce", trainedAt: "riddle_hut" },
  { id: "warg_rider", name: "Warg Rider", faction: "legion", role: "cavalry", icon: "🐗", hp: 320, atk: 30, def: 14, spd: 70, rng: 1.0, cost: { gold: 200, wood: 50 }, buildTime: 24, pop: 2, damageClass: "physical", trainedAt: "blood_stable" },
  { id: "doom_catapult", name: "Doom Catapult", faction: "legion", role: "siege", icon: "💣", hp: 420, atk: 45, def: 4, spd: 16, rng: 9.0, cost: { gold: 300, wood: 200 }, buildTime: 35, pop: 3, damageClass: "siege", trainedAt: "siege_foundry" },
  { id: "hex_shaman", name: "Hex Shaman", faction: "legion", role: "support", icon: "🧿", hp: 115, atk: 14, def: 4, spd: 52, rng: 4.0, cost: { gold: 130, wood: 30 }, buildTime: 20, pop: 1, damageClass: "magic", trainedAt: "void_crypt" },
  { id: "plague_bat", name: "Plague Bat", faction: "legion", role: "recon", icon: "🦇", hp: 85, atk: 10, def: 3, spd: 90, rng: 2.0, cost: { gold: 60, wood: 20 }, buildTime: 15, pop: 1, damageClass: "physical", trainedAt: "blight_tower" },
  { id: "void_wraith", name: "Void Wraith", faction: "legion", role: "air", icon: "👻", hp: 240, atk: 26, def: 10, spd: 72, rng: 4.5, cost: { gold: 180, wood: 100 }, buildTime: 24, pop: 2, damageClass: "magic", trainedAt: "shadow_outpost" },
];

export const LEGION_HEROES: HeroDef[] = [
  { id: "grommash_ironjaw", name: "Grommash Ironjaw", faction: "legion", race: "orc", heroClass: "warrior", purchaseBuilding: "entropy_pit", icon: "💀", hp: 250, atk: 27, def: 19, spd: 57, rng: 1.5, mp: 80, abilities: ["war_stomp", "bloodlust", "iron_fury"] },
  { id: "fenris_bloodfang", name: "Fenris Bloodfang", faction: "legion", race: "orc", heroClass: "worg", purchaseBuilding: "transformation_den", icon: "🐺", hp: 240, atk: 26, def: 16, spd: 67, rng: 1.5, mp: 85, abilities: ["dire_form", "blood_pounce", "feral_howl"] },
  { id: "zuljin_the_hexmaster", name: "Zul'jin the Hexmaster", faction: "legion", race: "orc", heroClass: "mage", purchaseBuilding: "void_crypt", icon: "🧿", hp: 180, atk: 25, def: 9, spd: 62, rng: 5.5, mp: 140, abilities: ["hex_bolt", "voodoo_ward", "spirit_storm"] },
  { id: "razak_deadeye", name: "Razak Deadeye", faction: "legion", race: "orc", heroClass: "ranger", purchaseBuilding: "riddle_hut", icon: "🎯", hp: 190, atk: 26, def: 11, spd: 72, rng: 6.5, mp: 100, abilities: ["poison_shot", "shadow_trap", "death_volley"] },
  { id: "lord_malachar", name: "Lord Malachar", faction: "legion", race: "undead", heroClass: "warrior", purchaseBuilding: "entropy_pit", icon: "⚔️", hp: 265, atk: 23, def: 20, spd: 52, rng: 1.5, mp: 95, abilities: ["death_grip", "unholy_shield", "soul_drain"] },
  { id: "the_ghoulfather", name: "The Ghoulfather", faction: "legion", race: "undead", heroClass: "worg", purchaseBuilding: "transformation_den", icon: "🧟", hp: 255, atk: 22, def: 17, spd: 62, rng: 1.5, mp: 100, abilities: ["ghoul_form", "corpse_explosion", "plague_aura"] },
  { id: "necromancer_vexis", name: "Necromancer Vexis", faction: "legion", race: "undead", heroClass: "mage", purchaseBuilding: "void_crypt", icon: "💀", hp: 195, atk: 21, def: 10, spd: 57, rng: 5.5, mp: 155, abilities: ["raise_dead", "soul_siphon", "death_nova"] },
  { id: "shade_whisper", name: "Shade Whisper", faction: "legion", race: "undead", heroClass: "ranger", purchaseBuilding: "riddle_hut", icon: "👤", hp: 205, atk: 22, def: 12, spd: 67, rng: 6.5, mp: 115, abilities: ["spectral_arrow", "shadow_walk", "phantom_barrage"] },
];

function legionUpgrade(id: string, name: string, cat: UpgradeCategory, level: number, maxLevel: number, cost: ResourceCost, at: string, prereq: string | null, effect: string, statMod?: Record<string, number>): UpgradeDef {
  return { id, name, faction: "legion", category: cat, level, maxLevel, cost, researchTime: Math.round(cost.gold / 5), researchedAt: at, prerequisite: prereq, effect, statMod };
}

export const LEGION_UPGRADES: UpgradeDef[] = [
  // Melee (10)
  legionUpgrade("l_melee_dmg_1", "Chaos Damage L1", "melee", 1, 4, { gold: 100, wood: 50 }, "dark_forge", null, "+5% ATK for melee", { melee_atk_pct: 5 }),
  legionUpgrade("l_melee_dmg_2", "Chaos Damage L2", "melee", 2, 4, { gold: 200, wood: 100 }, "dark_forge", "l_melee_dmg_1", "+10% ATK for melee", { melee_atk_pct: 10 }),
  legionUpgrade("l_melee_dmg_3", "Chaos Damage L3", "melee", 3, 4, { gold: 300, wood: 150 }, "dark_forge", "l_melee_dmg_2", "+15% ATK for melee", { melee_atk_pct: 15 }),
  legionUpgrade("l_melee_dmg_4", "Chaos Damage L4", "melee", 4, 4, { gold: 400, wood: 200 }, "dark_forge", "l_melee_dmg_3", "+20% ATK for melee", { melee_atk_pct: 20 }),
  legionUpgrade("l_melee_speed", "Blood Speed", "melee", 1, 1, { gold: 150, wood: 75 }, "dark_forge", "entropy_pit", "+10% SPD for melee", { melee_spd_pct: 10 }),
  legionUpgrade("l_melee_cleave", "Doom Cleave", "melee", 1, 1, { gold: 250, wood: 125 }, "dark_forge", "dark_forge", "Cleave: 20% dmg to adjacent", { melee_cleave_pct: 20 }),
  legionUpgrade("l_melee_stun", "Void Stun", "melee", 1, 1, { gold: 180, wood: 90 }, "dark_forge", null, "5% stun on melee hit", { melee_stun_pct: 5 }),
  legionUpgrade("l_melee_regen", "Blood Mend", "melee", 1, 1, { gold: 220, wood: 110 }, "dark_forge", "bone_pit", "+2 HP/s for melee", { melee_hp_regen: 2 }),
  legionUpgrade("l_melee_charge", "Warg Charge", "melee", 1, 1, { gold: 280, wood: 140 }, "dark_forge", "blood_stable", "+15% dmg on first hit", { melee_charge_pct: 15 }),
  legionUpgrade("l_melee_fury", "Berserker Fury", "melee", 1, 1, { gold: 300, wood: 150 }, "dark_forge", "l_melee_dmg_2", "+5% ATK per kill (max 20%)", { melee_fury_pct: 5 }),
  // Ranged (10)
  legionUpgrade("l_ranged_dmg_1", "Shadow Damage L1", "ranged", 1, 4, { gold: 100, wood: 50 }, "dark_forge", null, "+5% ATK for ranged", { ranged_atk_pct: 5 }),
  legionUpgrade("l_ranged_dmg_2", "Shadow Damage L2", "ranged", 2, 4, { gold: 200, wood: 100 }, "dark_forge", "l_ranged_dmg_1", "+10% ATK for ranged", { ranged_atk_pct: 10 }),
  legionUpgrade("l_ranged_dmg_3", "Shadow Damage L3", "ranged", 3, 4, { gold: 300, wood: 150 }, "dark_forge", "l_ranged_dmg_2", "+15% ATK for ranged", { ranged_atk_pct: 15 }),
  legionUpgrade("l_ranged_dmg_4", "Shadow Damage L4", "ranged", 4, 4, { gold: 400, wood: 200 }, "dark_forge", "l_ranged_dmg_3", "+20% ATK for ranged", { ranged_atk_pct: 20 }),
  legionUpgrade("l_ranged_range", "Dark Range", "ranged", 1, 1, { gold: 150, wood: 75 }, "dark_forge", "riddle_hut", "+1 RNG for ranged", { ranged_rng_flat: 1 }),
  legionUpgrade("l_ranged_pierce", "Void Pierce", "ranged", 1, 1, { gold: 250, wood: 125 }, "dark_forge", "dark_forge", "Ignores 10% DEF", { ranged_pierce_pct: 10 }),
  legionUpgrade("l_ranged_crit", "Death Crit", "ranged", 1, 1, { gold: 180, wood: 90 }, "dark_forge", null, "10% crit (x2 dmg)", { ranged_crit_pct: 10 }),
  legionUpgrade("l_ranged_volley", "Plague Volley", "ranged", 1, 1, { gold: 220, wood: 110 }, "dark_forge", "siege_foundry", "+1 projectile per attack", { ranged_extra_proj: 1 }),
  legionUpgrade("l_ranged_slow", "Hex Slow", "ranged", 1, 1, { gold: 280, wood: 140 }, "dark_forge", "void_crypt", "10% slow on hit", { ranged_slow_pct: 10 }),
  legionUpgrade("l_ranged_accuracy", "Deadeye Accuracy", "ranged", 1, 1, { gold: 300, wood: 150 }, "dark_forge", "blight_tower", "+15% hit vs moving", { ranged_accuracy_pct: 15 }),
  // Armor (8)
  legionUpgrade("l_armor_1", "Iron Toughness L1", "armor", 1, 4, { gold: 120, wood: 60 }, "iron_armory", null, "+5% DEF for all", { all_def_pct: 5 }),
  legionUpgrade("l_armor_2", "Iron Toughness L2", "armor", 2, 4, { gold: 240, wood: 120 }, "iron_armory", "l_armor_1", "+10% DEF for all", { all_def_pct: 10 }),
  legionUpgrade("l_armor_3", "Iron Toughness L3", "armor", 3, 4, { gold: 360, wood: 180 }, "iron_armory", "l_armor_2", "+15% DEF for all", { all_def_pct: 15 }),
  legionUpgrade("l_armor_4", "Iron Toughness L4", "armor", 4, 4, { gold: 480, wood: 240 }, "iron_armory", "l_armor_3", "+20% DEF for all", { all_def_pct: 20 }),
  legionUpgrade("l_armor_resist", "Void Resistance", "armor", 1, 1, { gold: 200, wood: 100 }, "iron_armory", "iron_armory", "+10% magic resist", { all_magic_resist_pct: 10 }),
  legionUpgrade("l_armor_shield", "Blood Shielding", "armor", 1, 1, { gold: 280, wood: 140 }, "iron_armory", "dark_forge", "Blocks 5 dmg per hit", { all_flat_block: 5 }),
  legionUpgrade("l_armor_reflect", "Soul Reflection", "armor", 1, 1, { gold: 320, wood: 160 }, "iron_armory", "l_armor_3", "5% dmg reflect", { all_reflect_pct: 5 }),
  legionUpgrade("l_armor_dur", "Undead Durability", "armor", 1, 1, { gold: 250, wood: 125 }, "iron_armory", "blood_stable", "+20% HP for armored", { armored_hp_pct: 20 }),
  // Skills (6)
  legionUpgrade("l_skill_cd_1", "Entropy Cooldown L1", "skills", 1, 2, { gold: 150, wood: 75 }, "void_crypt", "void_crypt", "-5% ability cooldowns", { skill_cd_pct: -5 }),
  legionUpgrade("l_skill_cd_2", "Entropy Cooldown L2", "skills", 2, 2, { gold: 300, wood: 150 }, "void_crypt", "l_skill_cd_1", "-10% ability cooldowns", { skill_cd_pct: -10 }),
  legionUpgrade("l_skill_power", "Chaos Power", "skills", 1, 1, { gold: 200, wood: 100 }, "void_crypt", null, "+10% skill dmg", { skill_dmg_pct: 10 }),
  legionUpgrade("l_skill_mana", "Soul Efficiency", "skills", 1, 1, { gold: 250, wood: 125 }, "void_crypt", "l_skill_cd_1", "-15% MP cost", { skill_mp_pct: -15 }),
  legionUpgrade("l_skill_duration", "Hex Duration", "skills", 1, 1, { gold: 280, wood: 140 }, "dark_forge", "dark_forge", "+20% buff/debuff duration", { skill_dur_pct: 20 }),
  legionUpgrade("l_skill_chain", "Void Chain", "skills", 1, 1, { gold: 350, wood: 175 }, "void_crypt", "void_citadel", "Skills chain to +1 target", { skill_chain_targets: 1 }),
  // Units (8)
  legionUpgrade("l_unit_train_1", "War Training L1", "units", 1, 2, { gold: 100, wood: 50 }, "void_citadel", "entropy_pit", "-10% build time", { unit_build_time_pct: -10 }),
  legionUpgrade("l_unit_train_2", "War Training L2", "units", 2, 2, { gold: 200, wood: 100 }, "void_citadel", "l_unit_train_1", "-15% build time", { unit_build_time_pct: -15 }),
  legionUpgrade("l_unit_hp", "Blood Vitality", "units", 1, 1, { gold: 180, wood: 90 }, "void_citadel", "bone_pit", "+10% HP for all", { all_hp_pct: 10 }),
  legionUpgrade("l_unit_speed", "Warg Speed", "units", 1, 1, { gold: 220, wood: 110 }, "void_citadel", "blood_stable", "+5 SPD for all", { all_spd_flat: 5 }),
  legionUpgrade("l_unit_pop", "Thrall Efficiency", "units", 1, 1, { gold: 300, wood: 150 }, "void_citadel", "l_unit_train_2", "-1 pop for basic units", { basic_pop_reduce: 1 }),
  legionUpgrade("l_unit_stealth", "Shadow Cloak", "units", 1, 1, { gold: 280, wood: 140 }, "riddle_hut", "riddle_hut", "Basic units gain short stealth", { unit_stealth_dur: 3 }),
  legionUpgrade("l_unit_heal_aura", "Death Aura", "units", 1, 1, { gold: 250, wood: 125 }, "void_crypt", "void_crypt", "Units regen 1% HP near heroes", { hero_aura_heal_pct: 1 }),
  legionUpgrade("l_unit_elite", "Doom Elite", "units", 1, 1, { gold: 400, wood: 200 }, "void_citadel", "siege_foundry", "Unlocks elite tier (+20% stats)", { elite_stat_pct: 20 }),
  // Buildings (6)
  legionUpgrade("l_bld_dur_1", "Bone Durability L1", "buildings", 1, 2, { gold: 120, wood: 60 }, "void_citadel", null, "+10% HP for buildings", { building_hp_pct: 10 }),
  legionUpgrade("l_bld_dur_2", "Bone Durability L2", "buildings", 2, 2, { gold: 240, wood: 120 }, "void_citadel", "l_bld_dur_1", "+15% HP for buildings", { building_hp_pct: 15 }),
  legionUpgrade("l_bld_speed", "Soul Construction", "buildings", 1, 1, { gold: 200, wood: 100 }, "soul_mill", "soul_mill", "-20% build time", { building_time_pct: -20 }),
  legionUpgrade("l_bld_resource", "Void Harvest", "buildings", 1, 1, { gold: 280, wood: 140 }, "void_citadel", "void_citadel", "+10% resource production", { resource_prod_pct: 10 }),
  legionUpgrade("l_bld_defense", "Blight Defense", "buildings", 1, 1, { gold: 320, wood: 160 }, "blight_tower", "blight_tower", "Buildings gain auto-attack", { building_auto_atk: 1 }),
  legionUpgrade("l_bld_expand", "Shadow Expansion", "buildings", 1, 1, { gold: 350, wood: 175 }, "shadow_outpost", "shadow_outpost", "+1 expansion slot", { expansion_slots: 1 }),
  // Spells (4)
  legionUpgrade("l_spell_power_1", "Hex Power L1", "spells", 1, 2, { gold: 150, wood: 75 }, "void_crypt", "void_crypt", "+10% spell dmg", { spell_dmg_pct: 10 }),
  legionUpgrade("l_spell_power_2", "Hex Power L2", "spells", 2, 2, { gold: 300, wood: 150 }, "void_crypt", "l_spell_power_1", "+15% spell dmg", { spell_dmg_pct: 15 }),
  legionUpgrade("l_spell_range", "Void Range", "spells", 1, 1, { gold: 250, wood: 125 }, "dark_forge", "dark_forge", "+2 RNG for spells", { spell_rng_flat: 2 }),
  legionUpgrade("l_spell_ult", "Doom Ultimate", "spells", 1, 1, { gold: 400, wood: 200 }, "void_crypt", "l_spell_power_2", "Unlocks faction ultimate spell"),
  // Health (4)
  legionUpgrade("l_hp_regen_1", "Blood Regen L1", "health", 1, 2, { gold: 100, wood: 50 }, "bone_pit", "bone_pit", "+1 HP/s for all", { all_hp_regen: 1 }),
  legionUpgrade("l_hp_regen_2", "Blood Regen L2", "health", 2, 2, { gold: 200, wood: 100 }, "bone_pit", "l_hp_regen_1", "+2 HP/s for all", { all_hp_regen: 2 }),
  legionUpgrade("l_hp_max", "Undeath Vigor", "health", 1, 1, { gold: 250, wood: 125 }, "iron_armory", "iron_armory", "+10% max HP", { all_max_hp_pct: 10 }),
  legionUpgrade("l_hp_revive", "Necromantic Revival", "health", 1, 1, { gold: 350, wood: 175 }, "void_crypt", "void_crypt", "5% chance to revive", { revive_chance_pct: 5 }),
  // Towers (4)
  legionUpgrade("l_tower_dmg_1", "Blight Damage L1", "towers", 1, 2, { gold: 120, wood: 60 }, "blight_tower", "blight_tower", "+10% ATK for towers", { tower_atk_pct: 10 }),
  legionUpgrade("l_tower_dmg_2", "Blight Damage L2", "towers", 2, 2, { gold: 240, wood: 120 }, "blight_tower", "l_tower_dmg_1", "+15% ATK for towers", { tower_atk_pct: 15 }),
  legionUpgrade("l_tower_range", "Shadow Range", "towers", 1, 1, { gold: 200, wood: 100 }, "riddle_hut", "riddle_hut", "+2 RNG for towers", { tower_rng_flat: 2 }),
  legionUpgrade("l_tower_splash", "Plague Splash", "towers", 1, 1, { gold: 300, wood: 150 }, "dark_forge", "dark_forge", "AoE for tower attacks", { tower_splash: 1 }),
  // Faction (4)
  legionUpgrade("l_faction_chaos", "Faction Chaos", "faction", 1, 1, { gold: 500, wood: 250 }, "void_citadel", "l_armor_4", "+5% all stats", { all_stats_pct: 5 }),
  legionUpgrade("l_faction_entropy", "Faction Entropy", "faction", 1, 1, { gold: 400, wood: 200 }, "void_crypt", "void_crypt", "+10% XP gain", { xp_gain_pct: 10 }),
  legionUpgrade("l_faction_void", "Faction Void Sight", "faction", 1, 1, { gold: 350, wood: 175 }, "shadow_outpost", "shadow_outpost", "Reveals map fog", { reveal_fog: 1 }),
  legionUpgrade("l_faction_doom", "Faction Doom", "faction", 1, 1, { gold: 450, wood: 225 }, "void_citadel", null, "+20% dmg vs heroes", { hero_dmg_pct: 20 }),
];

// ═══════════════════════════════════════════════════════════════════
// COMBINED DATA + HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export const ALL_BUILDINGS: BuildingDef[] = [...CRUSADE_BUILDINGS, ...FABLED_BUILDINGS, ...LEGION_BUILDINGS];
export const ALL_UNITS: UnitDef[] = [...CRUSADE_UNITS, ...FABLED_UNITS, ...LEGION_UNITS];
export const ALL_HEROES: HeroDef[] = [...CRUSADE_HEROES, ...FABLED_HEROES, ...LEGION_HEROES];
export const ALL_UPGRADES: UpgradeDef[] = [...CRUSADE_UPGRADES, ...FABLED_UPGRADES, ...LEGION_UPGRADES];

// ── Lookup helpers ───────────────────────────────────────────────

export function getFaction(id: FactionId): FactionConfig {
  return FACTIONS[id];
}

export function getBuildingsForFaction(faction: FactionId): BuildingDef[] {
  return ALL_BUILDINGS.filter(b => b.faction === faction);
}

export function getUnitsForFaction(faction: FactionId): UnitDef[] {
  return ALL_UNITS.filter(u => u.faction === faction);
}

export function getHeroesForFaction(faction: FactionId): HeroDef[] {
  return ALL_HEROES.filter(h => h.faction === faction);
}

export function getUpgradesForFaction(faction: FactionId): UpgradeDef[] {
  return ALL_UPGRADES.filter(u => u.faction === faction);
}

export function getBuilding(id: string): BuildingDef | undefined {
  return ALL_BUILDINGS.find(b => b.id === id);
}

export function getUnit(id: string): UnitDef | undefined {
  return ALL_UNITS.find(u => u.id === id);
}

export function getHero(id: string): HeroDef | undefined {
  return ALL_HEROES.find(h => h.id === id);
}

export function getUpgrade(id: string): UpgradeDef | undefined {
  return ALL_UPGRADES.find(u => u.id === id);
}

/** Get upgrades available at a specific building */
export function getUpgradesAtBuilding(buildingId: string, faction: FactionId): UpgradeDef[] {
  return ALL_UPGRADES.filter(u => u.faction === faction && u.researchedAt === buildingId);
}

/** Get upgrades by category for a faction */
export function getUpgradesByCategory(faction: FactionId, category: UpgradeCategory): UpgradeDef[] {
  return ALL_UPGRADES.filter(u => u.faction === faction && u.category === category);
}

/** Check if an upgrade's prerequisites are met */
export function canResearchUpgrade(upgradeId: string, researchedUpgrades: Set<string>, builtBuildings: Set<string>): boolean {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return false;
  if (!builtBuildings.has(upgrade.researchedAt)) return false;
  if (upgrade.prerequisite) {
    // Prerequisite can be an upgrade ID or a building ID
    if (!researchedUpgrades.has(upgrade.prerequisite) && !builtBuildings.has(upgrade.prerequisite)) {
      return false;
    }
  }
  return true;
}

/** Get heroes purchasable at a specific building */
export function getHeroesAtBuilding(buildingId: string, faction: FactionId): HeroDef[] {
  return ALL_HEROES.filter(h => h.faction === faction && h.purchaseBuilding === buildingId);
}

/** Get units trainable at a specific building */
export function getUnitsAtBuilding(buildingId: string, faction: FactionId): UnitDef[] {
  const building = getBuilding(buildingId);
  if (!building) return [];
  return building.trains.map(uid => getUnit(uid)).filter(Boolean) as UnitDef[];
}

// ── Stats summary ────────────────────────────────────────────────

export const RTS_STATS = {
  factions: Object.keys(FACTIONS).length,
  buildings: ALL_BUILDINGS.length,
  units: ALL_UNITS.length,
  heroes: ALL_HEROES.length,
  upgrades: ALL_UPGRADES.length,
  upgradesPerFaction: ALL_UPGRADES.length / Object.keys(FACTIONS).length,
} as const;
