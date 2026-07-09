/**
 * Canonical Grudge Studio fleet registry — single source of truth for game URLs.
 *
 * portalProducts.ts and fleetGames.ts derive live hrefs from here.
 * Naming: `betta-warlords` (rpg-modular) ≠ `rpg-maker-studio` (portal demo).
 */

import { VOXGRUDGE_GAMES } from "@/lib/voxgrudge-urls";

export type FleetStatus = "live" | "beta" | "planned";
export type FleetTag = "pvp" | "pvpve" | "coop" | "solo" | "retro" | "arena" | "mmo" | "rts";

export interface FleetRegistryEntry {
  id: string;
  name: string;
  description: string;
  /** Primary play URL — subdomain preferred over *.vercel.app */
  canonicalUrl: string;
  /** Embed-safe URL for portal iframes (when different from canonical) */
  embedUrl?: string;
  allowEmbed?: boolean;
  status: FleetStatus;
  disambiguation?: string;
  authRequired?: boolean;
  tags?: FleetTag[];
  /** Show on /super-engine forge grid */
  forge?: boolean;
  repo?: string;
}

/** @deprecated Deep links / bookmarks */
export const LEGACY_FLEET_IDS: Record<string, string> = {
  "rpg-modular": "betta-warlords",
  "survival": "survival-game",
};

export function resolveFleetId(id: string): string {
  return LEGACY_FLEET_IDS[id] ?? id;
}

export function getFleetEntry(id: string): FleetRegistryEntry | undefined {
  const resolved = resolveFleetId(id);
  return FLEET_REGISTRY.find((e) => e.id === resolved);
}

export const FLEET_REGISTRY: FleetRegistryEntry[] = [
  // ── Flagship ──
  {
    id: "warlords",
    name: "Grudge Warlords",
    description: "Main live product: character creation, combat, islands, professions, and Warlords progression.",
    canonicalUrl: "https://grudgewarlords.com",
    status: "live",
    authRequired: true,
    tags: ["mmo", "pvp", "pvpve", "coop"],
    forge: true,
    allowEmbed: false,
    repo: "Grudge-Builder",
  },
  {
    id: "launcher",
    name: "Grudge Launcher",
    description: "Single entry launcher for Grudge products, entitlements, updates, and client handoff.",
    canonicalUrl: "https://launcher.grudge-studio.com",
    status: "beta",
    authRequired: true,
    repo: "grudgedot-launcher",
  },

  // ── Forge / live fleet games ──
  {
    id: "rts-grudge",
    name: "Grudge Warlords RTS",
    description: "Full 3D RTS with base building, unit production, hero mech, biome zones, AI squads, and wave combat.",
    canonicalUrl: "https://rts-grudge.vercel.app",
    status: "live",
    tags: ["rts", "pvp", "coop"],
    forge: true,
    repo: "RTS-Grudge",
  },
  {
    id: "survival-game",
    name: "Grudges — Survival ARPG",
    description: "Sci-fi survival action RPG. Bind a grudge, bear it forward. Crafting, combat, exploration.",
    canonicalUrl: "https://grudges.grudge-studio.com",
    status: "live",
    tags: ["solo", "coop", "pvpve"],
    forge: true,
    authRequired: true,
    repo: "survival",
  },
  {
    id: "grudge-arena",
    name: "Grudge Arena",
    description: "3D PvP combat arena with 6 playable races, WoW-style targeting, Socket.IO multiplayer.",
    canonicalUrl: "https://grudge-arena.grudge-studio.com",
    status: "live",
    authRequired: true,
    tags: ["pvp", "arena"],
    forge: true,
    repo: "grudge-arena",
  },
  {
    id: "grudge-drive",
    name: "Grudge Drive",
    description:
      "High-speed vehicular combat. Babylon.js + Havok — production canvas at drive.grudge-studio.com; Super Engine play terminal embeds it.",
    canonicalUrl: "https://drive.grudge-studio.com",
    embedUrl: "https://drive.grudge-studio.com/?embed=1",
    allowEmbed: true,
    status: "live",
    tags: ["pvp", "arena"],
    forge: true,
    repo: "grudge-drive",
    authRequired: true,
  },
  {
    id: "grudge-fishing",
    name: "Grudge Fishing",
    description: "3D fishing with procedural island, animated water, 35 fish species, 5 tiered rods, tension minigame.",
    canonicalUrl: "https://grudge-fishing-game.vercel.app",
    status: "live",
    tags: ["solo"],
    forge: true,
  },
  {
    id: "dungeon-crawler",
    name: "Dungeon Crawler Quest",
    description: "Voxel MOBA and dungeon crawler with procedural generation, AI enemies, loot, and map editor.",
    canonicalUrl: "https://dcq.grudge-studio.com",
    status: "live",
    tags: ["pvp", "coop", "arena"],
    forge: true,
    repo: "Dungeon-Crawler-Quest",
  },
  {
    id: "final-fighter",
    name: "Final Fighter",
    description: "3D fighting game with GLTF characters, Box3 hitbox/hurtbox collision, combo system, AI opponent.",
    canonicalUrl: "https://final-fighter.vercel.app",
    status: "live",
    tags: ["pvp", "solo", "arena"],
    forge: true,
    repo: "FinalFighter",
  },
  {
    id: "betta-warlords",
    name: "Betta Warlords",
    description: "Underwater freshwater adventure RPG. 8 betta breeds, 4 classes, 32 Warlord combinations.",
    canonicalUrl: "https://grudgewarlords.com/betta",
    embedUrl: "https://rpg-modular.vercel.app/embed/betta-embed.html",
    status: "live",
    authRequired: true,
    tags: ["pvp", "arena"],
    forge: true,
    disambiguation: "Freshwater RPG — not RPG Maker Studio",
    repo: "rpg-modular",
  },
  {
    id: "grim-armada",
    name: "Grim Armada",
    description: "SWG-inspired tactical combat. Three.js + React with Grudge Backend integration.",
    canonicalUrl: "https://armada.grudge-studio.com",
    status: "live",
    tags: ["pvp", "arena"],
    forge: true,
    repo: "grim-armada-web",
  },
  {
    id: "grudge-space-rts",
    name: "Grudge Space RTS",
    description: "Voxel space strategy with StarCraft-style controls, fleet management, and resource gathering.",
    canonicalUrl: "https://grudge-space-rts.vercel.app",
    status: "live",
    tags: ["rts", "pvp"],
    forge: true,
    repo: "GrudgeSpaceRTS",
  },
  {
    id: "mage-arena",
    name: "Mage Arena",
    description: "Dungeon crawler with Foozle Lucifer heroes, Mythology bosses, mouse-aimed combat, and AI teammates.",
    canonicalUrl: "https://mage-arena-seven.vercel.app",
    status: "live",
    tags: ["pvp", "pvpve", "arena", "coop"],
    forge: true,
  },
  {
    id: "nemesis-tcg",
    name: "Nexus Nemesis TCG",
    description: "Season 0 TCG — cNFT cards on Solana. Deckbuilder, ranked PvP, pack redemption.",
    canonicalUrl: "https://nemesis.grudge-studio.com",
    embedUrl: "https://nexus-nemesis-game.vercel.app",
    status: "live",
    authRequired: true,
    tags: ["pvp", "solo"],
    forge: true,
  },
  {
    id: "grudge-metaverse",
    name: "Grudge Metaverse",
    description: "3D multiplayer client. Explore the Grudge universe with other players in real time.",
    canonicalUrl: "https://grudge-metaverse.vercel.app",
    status: "live",
    tags: ["mmo", "coop"],
    forge: true,
  },
  {
    id: "wcs",
    name: "WCS — Betta Warlords Suite",
    description: "Warlord Crafting Suite shell for character, island, and profession workflows.",
    canonicalUrl: "https://wcs.grudge-studio.com",
    status: "live",
    authRequired: true,
    tags: ["mmo", "coop"],
    repo: "grudge-wcs",
  },
  {
    id: "grudge-mech-forge",
    name: "Grudge Mech Forge",
    description: "Modular real-time mech builder + dust-arena combat sim. R3F + Rapier3D.",
    canonicalUrl: "https://mech-playground.vercel.app",
    status: "beta",
    tags: ["solo", "arena"],
    forge: true,
    repo: "grudge-mech-forge",
  },

  // ── Portal-hosted forge demos ──
  {
    id: "annihilate-demo",
    name: "Grudge Engine Core",
    description: "Three.js + Cannon-ES + CharacterFSM. Combo FSM, capsule physics, animation blending.",
    canonicalUrl: "/annihilate-demo",
    embedUrl: "/annihilate-demo?embed=1",
    status: "beta",
    tags: ["coop", "pvpve"],
    forge: true,
  },
  {
    id: "grudge-controller",
    name: "Grudge Controller",
    description: "Third-person grudge6 locomotion — BVH capsule, artifact animator combat/OWR, grudge-control + CDN races.",
    canonicalUrl: "/grudge-controller",
    embedUrl: "/grudge-controller?embed=1",
    status: "beta",
    tags: ["solo", "pvpve"],
    forge: true,
    repo: "grudgecontrol",
  },
  {
    id: "voxel-sandbox",
    name: "Voxel Chaos Sandbox",
    description: "3D physics sandbox with 23 tools, ragdoll characters, NPC/zombie AI, scripting, vehicles.",
    canonicalUrl: "/voxel-sandbox",
    embedUrl: VOXGRUDGE_GAMES.voxelSandbox,
    status: "beta",
    tags: ["solo", "coop"],
    forge: true,
  },
  {
    id: "terraforge",
    name: "TerraForge",
    description: "Open-world voxel sandbox with FPS combat, city builder, castle fortress, NPC AI, world editor.",
    canonicalUrl: "/terraforge",
    embedUrl: VOXGRUDGE_GAMES.terraforge,
    status: "beta",
    tags: ["solo", "coop", "pvpve"],
    forge: true,
  },
  {
    id: "grudge-brawl",
    name: "Grudge Brawl",
    description: "Third-person arena combat with body-tracks-crosshair aiming, WASD movement, mobile touch.",
    canonicalUrl: "/grudge-brawl",
    embedUrl: VOXGRUDGE_GAMES.grudgeBrawl,
    status: "beta",
    tags: ["pvp", "arena"],
    forge: true,
  },
  {
    id: "polyfighter",
    name: "Grudge Smash",
    description: "2D Smash-style platform fighter — sprite warriors, AI opponents, online PvP, super attacks.",
    canonicalUrl: "/polyfighter",
    embedUrl: "https://grudge-rpg-sprite-attack.vercel.app",
    status: "live",
    tags: ["pvp", "solo", "arena"],
    forge: true,
  },

  // ── Portal internal betas (not on forge grid) ──
  {
    id: "wargus",
    name: "Wargus RTS",
    description: "Realtime strategy gameplay inside the Grudge universe.",
    canonicalUrl: "/wargus",
    status: "beta",
    tags: ["rts", "pvp", "coop"],
  },
  {
    id: "tower-defense",
    name: "Tower Defense",
    description: "Hold lanes, build defenses, and iterate on tactical encounters.",
    canonicalUrl: "/tower-defense",
    status: "beta",
    tags: ["solo", "coop"],
  },
  {
    id: "avernus-arena",
    name: "Avernus Arena",
    description: "Dark-fantasy arena combat with PvP and PvPvE rotations.",
    canonicalUrl: "/avernus-arena",
    status: "beta",
    tags: ["pvp", "pvpve", "arena"],
  },
  {
    id: "multiplayer-racing",
    name: "Overdrive Racing",
    description: "3D arcade racing with Cannon.js raycast vehicle physics and obstacle dodging.",
    canonicalUrl: "/overdrive-racing",
    status: "beta",
    tags: ["pvp", "arena"],
  },
  {
    id: "grudge-fighter",
    name: "Grudge Smash",
    description: "Alias for polyfighter portal route (Grudge Smash 2D fighter).",
    canonicalUrl: "/polyfighter",
    status: "live",
    tags: ["pvp", "solo", "arena"],
  },

  // ── Planned Armada era ──
  {
    id: "star-rts",
    name: "Star RTS",
    description: "Fleet-scale RTS in the Armada universe. Capital ships and orbital stations.",
    canonicalUrl: "/star-rts",
    status: "planned",
    tags: ["rts", "pvp"],
  },
  {
    id: "starway-gruda",
    name: "Starway Gruda",
    description: "Arcade space dogfighter in the Gruda starways.",
    canonicalUrl: "/starway-gruda",
    status: "planned",
    tags: ["solo", "coop", "arena"],
  },
  {
    id: "rts-star-armada",
    name: "RTS Star Armada",
    description: "Grand-scale fleet RTS. Build shipyards, command armadas across star systems.",
    canonicalUrl: "/rts-star-armada",
    status: "planned",
    tags: ["rts", "pvp", "coop"],
  },
  {
    id: "mech-armada",
    name: "Mech Armada",
    description: "Pilot custom war-mechs across deep-space colonies.",
    canonicalUrl: "/mech-armada",
    status: "planned",
    tags: ["solo", "coop", "pvp", "arena"],
  },

  // ── External / Puter / tools ──
  {
    id: "grudge-angler",
    name: "Grudge Angler",
    description: "Warlords-era fishing with daily Discord tournaments and seasonal catches.",
    canonicalUrl: "https://puter.com/app/grudge-angler",
    status: "live",
    tags: ["solo", "coop"],
  },
  {
    id: "grudge-crafting",
    name: "Crafting & Professions",
    description: "Canonical crafting suite — Miner, Forester, Mystic, Chef, Engineer on Puter.",
    canonicalUrl: "https://grudge-crafting.puter.site",
    status: "live",
    authRequired: true,
    tags: ["coop"],
  },
  {
    id: "grudge-studio-app",
    name: "Grudge Studio",
    description: "Grudge Studio hub on Puter — gateway to grudgewarlords.com.",
    canonicalUrl: "https://puter.com/app/gs",
    status: "live",
    authRequired: true,
    tags: ["mmo"],
  },
  {
    id: "grudge-studio-puter",
    name: "Grudge Studio",
    description: "Grudge Studio hub — character creation and crafting.",
    canonicalUrl: "https://grudgewarlords.com",
    status: "live",
    authRequired: true,
    tags: ["mmo"],
  },
  {
    id: "match-3-grudge",
    name: "Grudge Match-3",
    description: "Unity match-3 puzzle with Warlords lore and crafting material drops.",
    canonicalUrl: "https://molochdagod.github.io/grudge-match-webgl/",
    status: "live",
    tags: ["solo"],
  },
  {
    id: "grudge-three-port",
    name: "Grudge Three.js Port",
    description: "Three.js client with procedural island, 6-race characters, equipment, HUD, Forge editor.",
    canonicalUrl: "https://grudge-three-port.vercel.app",
    status: "live",
    tags: ["solo", "coop"],
  },
  {
    id: "rpg-sprite-attack",
    name: "RPG Sprite Attack",
    description: "Tactical RPG with sprite-based combat and AI integration.",
    canonicalUrl: "https://grudge-rpg-sprite-attack.vercel.app",
    status: "live",
    tags: ["solo", "pvp"],
  },
  {
    id: "rpg-sprite-attack-gh",
    name: "RPG Sprite Attack (GH Pages)",
    description: "GitHub Pages mirror of the tactical RPG sprite combat game.",
    canonicalUrl: "https://molochdagod.github.io/Grudge-RPG-Sprite-Attack/",
    status: "live",
    tags: ["solo", "pvp"],
  },
  {
    id: "thc-labz-battle",
    name: "THC Labz Battle",
    description: "Cannabis-themed trading card battle with deck building and ranked PvP.",
    canonicalUrl: "https://thc-labz-battle.vercel.app",
    status: "live",
    authRequired: true,
    tags: ["pvp", "solo"],
  },
  {
    id: "flare-boss-arena",
    name: "Flare Boss Arena",
    description: "3D boss battles — elemental bosses with spell combos and dodge mechanics.",
    canonicalUrl: "https://flare-boss-arena.vercel.app",
    status: "beta",
    tags: ["solo", "arena"],
  },
  {
    id: "grudge-warlords-rts",
    name: "Grudge Warlords RTS (Medieval)",
    description: "Medieval RTS with resource gathering, castle building, and army warfare.",
    canonicalUrl: "https://grudge-warlords-rts.vercel.app",
    status: "live",
    tags: ["rts", "pvp", "coop"],
  },
  {
    id: "retro-library",
    name: "Retro Game Library",
    description: "Classic emulator library and retro catalog.",
    canonicalUrl: "/games",
    status: "live",
    tags: ["retro", "solo"],
  },
  {
    id: "super-engine",
    name: "Grudge Studio Forge",
    description: "Live fleet hub — preview and launch every Grudge game from one shell.",
    canonicalUrl: "/super-engine",
    status: "live",
    tags: ["solo"],
    forge: false,
  },
];

export const FORGE_REGISTRY = FLEET_REGISTRY.filter((e) => e.forge);

/** Apply canonical URLs from the fleet registry onto portal product rows. */
export function syncProductHref<T extends { id: string; href: string; status?: string; external?: boolean }>(
  product: T,
): T {
  const entry = getFleetEntry(product.id);
  if (!entry) return product;
  const external = !entry.canonicalUrl.startsWith("/");
  const status = entry.status === "planned" ? product.status ?? "planned" : entry.status;
  return {
    ...product,
    href: entry.canonicalUrl,
    status: status as T["status"],
    external,
    ...(entry.authRequired !== undefined ? { authRequired: entry.authRequired } : {}),
  };
}