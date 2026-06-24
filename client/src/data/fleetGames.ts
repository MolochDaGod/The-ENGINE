/**
 * Canonical fleet game registry for Grudge Studio Forge (super-engine).
 *
 * Naming rules:
 * - `betta-warlords` = Betta Warlords RPG (repo: rpg-modular). NOT `/rpg-maker-studio`.
 * - `rpg-maker-studio` = portal demo page only (PS1 RPG Maker retro + studio mock).
 * - Prefer grudge-studio.com subdomains over bare *.vercel.app when listed in fleet map.
 */

import gameImgWargus from "@assets/game_wargus_rts.png";
import gameImgTowerDef from "@assets/game_tower_defense.png";
import gameImgAvernus3d from "@assets/game_avernus_3d.png";
import gameImgAvernusArena from "@assets/game_avernus_arena.png";
import gameImgDecay from "@assets/game_decay_survival.png";
import gameImgOverdrive from "@assets/game_overdrive_3d.png";
import gameImgRpgMaker from "@assets/game_rpg_maker.png";
import { Car, Cpu, Gamepad, Globe, Shield, Swords } from "lucide-react";

export type Capability = "3D" | "Physics" | "Multiplayer" | "AI" | "2D" | "Particles";

export interface FleetGameCard {
  id: string;
  name: string;
  /** Clarifies similarly-named products (shown in UI when set). */
  disambiguation?: string;
  description: string;
  type: string;
  engine: string;
  /** Canonical full-page URL */
  route: string;
  /** Optional embed-safe URL for portal iframes */
  embedRoute?: string;
  allowEmbed?: boolean;
  emoji: string;
  color: string;
  gradientBorder: string;
  icon: typeof Gamepad;
  capabilities: Capability[];
  previewType: "threejs" | "canvas2d" | "static";
  cardImage?: string;
}

export const FORGE_GAMES: FleetGameCard[] = [
  {
    id: "rts-grudge",
    name: "Grudge Warlords RTS",
    route: "https://rts-grudge.vercel.app",
    description: "Full 3D real-time strategy with base building, unit production, hero mech, biome zones, AI squads, and wave-based combat.",
    type: "RTS",
    engine: "Grudge Studio Forge",
    emoji: "⚔️",
    color: "from-red-900/60 to-red-800/30",
    gradientBorder: "from-red-500 via-orange-500 to-yellow-500",
    icon: Swords,
    capabilities: ["3D", "AI", "Physics", "Particles"],
    previewType: "threejs",
    cardImage: gameImgWargus,
  },
  {
    id: "survival",
    name: "Grudges — Survival ARPG",
    route: "https://grudges.grudge-studio.com",
    description: "Sci-fi survival action RPG. Bind a grudge, bear it forward. Crafting, combat, exploration in a hostile world.",
    type: "Survival ARPG",
    engine: "Grudge Studio Forge",
    emoji: "🔥",
    color: "from-orange-900/60 to-orange-800/30",
    gradientBorder: "from-orange-500 via-red-500 to-pink-500",
    icon: Shield,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "threejs",
    cardImage: gameImgAvernus3d,
  },
  {
    id: "grudge-arena",
    name: "Grudge Arena — PvP Combat",
    route: "https://grudge-arena.grudge-studio.com",
    description: "3D PvP combat arena with 6 playable races, WoW-style targeting, Socket.IO multiplayer, and Grudge ID authentication.",
    type: "Arena PvP",
    engine: "Grudge Studio Forge",
    emoji: "🗡️",
    color: "from-purple-900/60 to-purple-800/30",
    gradientBorder: "from-purple-500 via-pink-500 to-red-500",
    icon: Swords,
    capabilities: ["3D", "Multiplayer", "AI", "Particles"],
    previewType: "threejs",
    cardImage: gameImgAvernusArena,
  },
  {
    id: "grudge-drive",
    name: "Grudge Drive — Vehicular Combat",
    route: "https://drive.grudge-studio.com",
    description: "High-speed vehicular combat arena brawler. BabylonJS + Havok physics, destructible environments, boost pads.",
    type: "Racing / Combat",
    engine: "Grudge Studio Forge",
    emoji: "🏎️",
    color: "from-blue-900/60 to-blue-800/30",
    gradientBorder: "from-blue-500 via-cyan-500 to-teal-500",
    icon: Car,
    capabilities: ["3D", "Physics", "Particles"],
    previewType: "threejs",
    cardImage: gameImgOverdrive,
  },
  {
    id: "grudge-fishing",
    name: "Grudge Fishing",
    route: "https://grudge-fishing-game.vercel.app",
    description: "3D fishing game with procedural island, animated water shaders, 35 fish species, 5 tiered rods, and tension minigame.",
    type: "Fishing / Casual",
    engine: "Grudge Studio Forge",
    emoji: "🎣",
    color: "from-cyan-900/60 to-cyan-800/30",
    gradientBorder: "from-cyan-500 via-blue-500 to-indigo-500",
    icon: Gamepad,
    capabilities: ["3D", "Physics", "Particles"],
    previewType: "threejs",
  },
  {
    id: "dungeon-crawler",
    name: "Dungeon Crawler Quest",
    route: "https://dcq.grudge-studio.com",
    description: "Voxel MOBA and dungeon crawler with procedural generation, AI enemies, loot system, and map editor.",
    type: "Dungeon Crawler",
    engine: "Grudge Studio Forge",
    emoji: "🐉",
    color: "from-green-900/60 to-green-800/30",
    gradientBorder: "from-green-500 via-emerald-500 to-teal-500",
    icon: Shield,
    capabilities: ["3D", "AI", "Particles"],
    previewType: "threejs",
    cardImage: gameImgDecay,
  },
  {
    id: "final-fighter",
    name: "Final Fighter",
    route: "https://final-fighter.vercel.app",
    description: "3D fighting game with GLTF characters, Box3 hitbox/hurtbox collision, combo system, and AI opponent.",
    type: "3D Fighting",
    engine: "Grudge Studio Forge",
    emoji: "🥊",
    color: "from-amber-900/60 to-amber-800/30",
    gradientBorder: "from-amber-500 via-yellow-500 to-orange-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI"],
    previewType: "threejs",
    cardImage: gameImgTowerDef,
  },
  {
    id: "betta-warlords",
    name: "Betta Warlords",
    disambiguation: "Freshwater RPG — not RPG Maker Studio",
    description: "Underwater freshwater adventure RPG. 8 betta breeds, 4 classes, 32 Warlord combinations. Modular skill trees and faction warfare.",
    type: "RPG / Adventure",
    engine: "Grudge Studio Forge",
    route: "https://grudgewarlords.com/betta",
    embedRoute: "https://rpg-modular.vercel.app/embed/betta-embed.html",
    emoji: "🐟",
    color: "from-indigo-900/60 to-indigo-800/30",
    gradientBorder: "from-indigo-500 via-violet-500 to-purple-500",
    icon: Gamepad,
    capabilities: ["2D", "AI", "Multiplayer"],
    previewType: "canvas2d",
    cardImage: gameImgRpgMaker,
  },
  {
    id: "grim-armada",
    name: "Grim Armada",
    route: "https://armada.grudge-studio.com",
    description: "SWG-inspired tactical combat web game. Three.js + React with Grudge Backend integration. Space fleet battles and ground combat.",
    type: "Tactical Combat",
    engine: "Grudge Studio Forge",
    emoji: "🚀",
    color: "from-slate-900/60 to-slate-800/30",
    gradientBorder: "from-slate-500 via-gray-500 to-zinc-500",
    icon: Shield,
    capabilities: ["3D", "AI", "Physics"],
    previewType: "threejs",
  },
  {
    id: "annihilate-demo",
    name: "Grudge Engine Core",
    route: "/annihilate-demo",
    description: "Three.js + Cannon-ES + CharacterFSM. Full combo FSM, capsule physics, animation blending, and RoleControls.",
    type: "3D Engine Demo",
    engine: "Grudge Studio Forge",
    emoji: "⚙️",
    color: "from-violet-900/60 to-purple-800/30",
    gradientBorder: "from-violet-500 via-purple-500 to-pink-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "threejs",
  },
  {
    id: "voxel-sandbox",
    name: "Voxel Chaos Sandbox",
    route: "/voxel-sandbox",
    description: "3D physics sandbox with 23 tools, ragdoll voxel characters, NPC/zombie AI, scripting, vehicles, and world save/load.",
    type: "Sandbox / Physics",
    engine: "Grudge Studio Forge",
    emoji: "🧱",
    color: "from-emerald-900/60 to-emerald-800/30",
    gradientBorder: "from-emerald-500 via-green-500 to-lime-500",
    icon: Cpu,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "threejs",
  },
  {
    id: "terraforge",
    name: "TerraForge",
    route: "/terraforge",
    description: "Open-world voxel sandbox with FPS combat, city builder, castle fortress, NPC AI, item shop, and world editor.",
    type: "Open World Sandbox",
    engine: "Grudge Studio Forge",
    emoji: "🌍",
    color: "from-lime-900/60 to-green-800/30",
    gradientBorder: "from-lime-500 via-green-500 to-emerald-500",
    icon: Globe,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "threejs",
  },
  {
    id: "grudge-brawl",
    name: "Grudge Brawl",
    route: "/grudge-brawl",
    description: "Third-person arena combat with body-tracks-crosshair aiming, WASD movement, AI opponents, and mobile touch support.",
    type: "Arena Combat",
    engine: "Grudge Studio Forge",
    emoji: "⚔️",
    color: "from-red-900/60 to-orange-800/30",
    gradientBorder: "from-red-500 via-orange-500 to-yellow-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "threejs",
  },
  {
    id: "polyfighter",
    name: "Grudge Fighter",
    route: "/polyfighter",
    description: "3D fighting game with custom character creator, level editor, HD city stages, voxel characters, and trimesh combat.",
    type: "3D Fighting",
    engine: "Grudge Studio Forge",
    emoji: "🥊",
    color: "from-pink-900/60 to-rose-800/30",
    gradientBorder: "from-pink-500 via-red-500 to-rose-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI"],
    previewType: "threejs",
  },
];

/** @deprecated Use `betta-warlords` — kept for deep links / bookmarks */
export const LEGACY_GAME_IDS: Record<string, string> = {
  "rpg-modular": "betta-warlords",
};

export function resolveFleetGameId(id: string): string {
  return LEGACY_GAME_IDS[id] ?? id;
}