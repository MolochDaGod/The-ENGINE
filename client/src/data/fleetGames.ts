/**
 * Super-engine (/super-engine) card presentation — URLs come from fleetRegistry.ts.
 */

import gameImgWargus from "@assets/game_wargus_rts.png";
import gameImgTowerDef from "@assets/game_tower_defense.png";
import gameImgAvernus3d from "@assets/game_avernus_3d.png";
import gameImgAvernusArena from "@assets/game_avernus_arena.png";
import gameImgDecay from "@assets/game_decay_survival.png";
import gameImgOverdrive from "@assets/game_overdrive_3d.png";
import gameImgRpgMaker from "@assets/game_rpg_maker.png";
import gameImgRacing from "@assets/game_multiplayer_racing.png";
import gameImgPuzzle from "@assets/game_puzzle_platformer.png";
import { Car, Cpu, Gamepad, Globe, Shield, Swords, type LucideIcon } from "lucide-react";
import { FORGE_REGISTRY, LEGACY_FLEET_IDS, resolveFleetId, type FleetRegistryEntry } from "./fleetRegistry";

export type Capability = "3D" | "Physics" | "Multiplayer" | "AI" | "2D" | "Particles";

export interface FleetGameCard {
  id: string;
  name: string;
  disambiguation?: string;
  description: string;
  type: string;
  engine: string;
  route: string;
  embedRoute?: string;
  allowEmbed?: boolean;
  emoji: string;
  color: string;
  gradientBorder: string;
  icon: LucideIcon;
  capabilities: Capability[];
  previewType: "threejs" | "canvas2d" | "static";
  cardImage?: string;
}

interface ForgeCardMeta {
  type: string;
  emoji: string;
  color: string;
  gradientBorder: string;
  icon: LucideIcon;
  capabilities: Capability[];
  previewType: "threejs" | "canvas2d" | "static";
  cardImage?: string;
}

const DEFAULT_META: ForgeCardMeta = {
  type: "Grudge Game",
  emoji: "🎮",
  color: "from-slate-900/60 to-slate-800/30",
  gradientBorder: "from-slate-500 via-gray-500 to-zinc-500",
  icon: Gamepad,
  capabilities: ["3D"],
  previewType: "threejs",
};

const FORGE_CARD_META: Record<string, ForgeCardMeta> = {
  warlords: {
    type: "MMO / RPG",
    emoji: "⚔️",
    color: "from-amber-900/60 to-amber-800/30",
    gradientBorder: "from-amber-500 via-yellow-500 to-orange-500",
    icon: Swords,
    capabilities: ["3D", "Multiplayer", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgWargus,
  },
  "rts-grudge": {
    type: "RTS",
    emoji: "⚔️",
    color: "from-red-900/60 to-red-800/30",
    gradientBorder: "from-red-500 via-orange-500 to-yellow-500",
    icon: Swords,
    capabilities: ["3D", "AI", "Physics", "Particles"],
    previewType: "static",
    cardImage: gameImgWargus,
  },
  "survival-game": {
    type: "Survival ARPG",
    emoji: "🔥",
    color: "from-orange-900/60 to-orange-800/30",
    gradientBorder: "from-orange-500 via-red-500 to-pink-500",
    icon: Shield,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgAvernus3d,
  },
  "grudge-arena": {
    type: "Arena PvP",
    emoji: "🗡️",
    color: "from-purple-900/60 to-purple-800/30",
    gradientBorder: "from-purple-500 via-pink-500 to-red-500",
    icon: Swords,
    capabilities: ["3D", "Multiplayer", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgAvernusArena,
  },
  "grudge-drive": {
    type: "Racing / Combat",
    emoji: "🏎️",
    color: "from-blue-900/60 to-blue-800/30",
    gradientBorder: "from-blue-500 via-cyan-500 to-teal-500",
    icon: Car,
    capabilities: ["3D", "Physics", "Particles"],
    previewType: "static",
    cardImage: gameImgOverdrive,
  },
  "grudge-fishing": {
    type: "Fishing / Casual",
    emoji: "🎣",
    color: "from-cyan-900/60 to-cyan-800/30",
    gradientBorder: "from-cyan-500 via-blue-500 to-indigo-500",
    icon: Gamepad,
    capabilities: ["3D", "Physics", "Particles"],
    previewType: "static",
    cardImage: gameImgPuzzle,
  },
  "dungeon-crawler": {
    type: "Dungeon Crawler",
    emoji: "🐉",
    color: "from-green-900/60 to-green-800/30",
    gradientBorder: "from-green-500 via-emerald-500 to-teal-500",
    icon: Shield,
    capabilities: ["3D", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgDecay,
  },
  "final-fighter": {
    type: "3D Fighting",
    emoji: "🥊",
    color: "from-amber-900/60 to-amber-800/30",
    gradientBorder: "from-amber-500 via-yellow-500 to-orange-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI"],
    previewType: "static",
    cardImage: gameImgTowerDef,
  },
  "betta-warlords": {
    type: "RPG / Adventure",
    emoji: "🐟",
    color: "from-indigo-900/60 to-indigo-800/30",
    gradientBorder: "from-indigo-500 via-violet-500 to-purple-500",
    icon: Gamepad,
    capabilities: ["2D", "AI", "Multiplayer"],
    previewType: "static",
    cardImage: gameImgRpgMaker,
  },
  "grim-armada": {
    type: "Tactical Combat",
    emoji: "🚀",
    color: "from-slate-900/60 to-slate-800/30",
    gradientBorder: "from-slate-500 via-gray-500 to-zinc-500",
    icon: Shield,
    capabilities: ["3D", "AI", "Physics"],
    previewType: "static",
    cardImage: gameImgWargus,
  },
  "grudge-space-rts": {
    type: "Space RTS",
    emoji: "🛸",
    color: "from-indigo-900/60 to-blue-800/30",
    gradientBorder: "from-indigo-500 via-blue-500 to-cyan-500",
    icon: Globe,
    capabilities: ["3D", "AI", "Multiplayer"],
    previewType: "static",
    cardImage: gameImgWargus,
  },
  "mage-arena": {
    type: "Dungeon Crawler",
    emoji: "🔮",
    color: "from-violet-900/60 to-purple-800/30",
    gradientBorder: "from-violet-500 via-purple-500 to-fuchsia-500",
    icon: Shield,
    capabilities: ["3D", "AI", "Multiplayer", "Particles"],
    previewType: "static",
    cardImage: gameImgDecay,
  },
  "nemesis-tcg": {
    type: "Trading Card",
    emoji: "🃏",
    color: "from-rose-900/60 to-rose-800/30",
    gradientBorder: "from-rose-500 via-red-500 to-orange-500",
    icon: Gamepad,
    capabilities: ["2D", "Multiplayer", "AI"],
    previewType: "static",
    cardImage: gameImgRpgMaker,
  },
  "grudge-metaverse": {
    type: "MMO Hub",
    emoji: "🌐",
    color: "from-teal-900/60 to-teal-800/30",
    gradientBorder: "from-teal-500 via-cyan-500 to-blue-500",
    icon: Globe,
    capabilities: ["3D", "Multiplayer"],
    previewType: "static",
    cardImage: gameImgAvernus3d,
  },
  "grudge-mech-forge": {
    type: "Mech Combat",
    emoji: "🤖",
    color: "from-zinc-900/60 to-zinc-800/30",
    gradientBorder: "from-zinc-500 via-slate-500 to-gray-500",
    icon: Cpu,
    capabilities: ["3D", "Physics", "AI"],
    previewType: "static",
    cardImage: gameImgOverdrive,
  },
  "annihilate-demo": {
    type: "3D Engine Demo",
    emoji: "⚙️",
    color: "from-violet-900/60 to-purple-800/30",
    gradientBorder: "from-violet-500 via-purple-500 to-pink-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgAvernusArena,
  },
  "grudge-controller": {
    type: "Character Controller",
    emoji: "🎮",
    color: "from-amber-900/60 to-yellow-800/30",
    gradientBorder: "from-amber-500 via-yellow-500 to-orange-500",
    icon: Gamepad,
    capabilities: ["3D", "Physics", "AI"],
    previewType: "static",
    cardImage: gameImgRacing,
  },
  "voxel-sandbox": {
    type: "Sandbox / Physics",
    emoji: "🧱",
    color: "from-emerald-900/60 to-emerald-800/30",
    gradientBorder: "from-emerald-500 via-green-500 to-lime-500",
    icon: Cpu,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgPuzzle,
  },
  terraforge: {
    type: "Open World Sandbox",
    emoji: "🌍",
    color: "from-lime-900/60 to-green-800/30",
    gradientBorder: "from-lime-500 via-green-500 to-emerald-500",
    icon: Globe,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgDecay,
  },
  "grudge-brawl": {
    type: "Arena Combat",
    emoji: "⚔️",
    color: "from-red-900/60 to-orange-800/30",
    gradientBorder: "from-red-500 via-orange-500 to-yellow-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI", "Particles"],
    previewType: "static",
    cardImage: gameImgAvernusArena,
  },
  polyfighter: {
    type: "3D Fighting",
    emoji: "🥊",
    color: "from-pink-900/60 to-rose-800/30",
    gradientBorder: "from-pink-500 via-red-500 to-rose-500",
    icon: Swords,
    capabilities: ["3D", "Physics", "AI"],
    previewType: "static",
    cardImage: gameImgTowerDef,
  },
};

function entryToCard(entry: FleetRegistryEntry): FleetGameCard {
  const meta = FORGE_CARD_META[entry.id] ?? DEFAULT_META;
  return {
    id: entry.id,
    name: entry.name,
    disambiguation: entry.disambiguation,
    description: entry.description,
    type: meta.type,
    engine: "Grudge Studio Forge",
    route: entry.canonicalUrl,
    embedRoute: entry.embedUrl,
    allowEmbed: entry.allowEmbed,
    emoji: meta.emoji,
    color: meta.color,
    gradientBorder: meta.gradientBorder,
    icon: meta.icon,
    capabilities: meta.capabilities,
    previewType: meta.previewType,
    cardImage: meta.cardImage,
  };
}

/** Ordered forge grid — flagship first, then live fleet, then portal demos. */
const FORGE_ORDER = [
  "warlords",
  "survival-game",
  "betta-warlords",
  "grudge-arena",
  "rts-grudge",
  "grim-armada",
  "grudge-drive",
  "dungeon-crawler",
  "grudge-space-rts",
  "mage-arena",
  "nemesis-tcg",
  "grudge-metaverse",
  "grudge-fishing",
  "final-fighter",
  "grudge-mech-forge",
  "annihilate-demo",
  "grudge-controller",
  "voxel-sandbox",
  "terraforge",
  "grudge-brawl",
  "polyfighter",
] as const;

export const FORGE_GAMES: FleetGameCard[] = FORGE_ORDER.map((id) => {
  const entry = FORGE_REGISTRY.find((e) => e.id === id);
  if (!entry) throw new Error(`Missing forge registry entry: ${id}`);
  return entryToCard(entry);
});

/** @deprecated Use resolveFleetId from fleetRegistry */
export const LEGACY_GAME_IDS = LEGACY_FLEET_IDS;

export function resolveFleetGameId(id: string): string {
  return resolveFleetId(id);
}