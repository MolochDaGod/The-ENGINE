import type { CSSProperties } from "react";
import type { PortalProduct, PortalProductStatus, PortalProductTag } from "./portalProducts";

export type ArenaCategory =
  | "mmo"
  | "arena"
  | "rts"
  | "scifi"
  | "sandbox"
  | "racing"
  | "tcg"
  | "fishing"
  | "crafting";

export const ARENA_CATEGORY_BG: Record<ArenaCategory, string> = {
  mmo: "/assets/pvp/pvp-bg-mmo.jpg",
  arena: "/assets/pvp/pvp-bg-arena.jpg",
  rts: "/assets/pvp/pvp-bg-rts.jpg",
  scifi: "/assets/pvp/pvp-bg-scifi.jpg",
  sandbox: "/assets/pvp/pvp-bg-sandbox.jpg",
  racing: "/assets/pvp/pvp-bg-racing.jpg",
  tcg: "/assets/pvp/pvp-bg-tcg.jpg",
  fishing: "/assets/pvp/pvp-bg-fishing.jpg",
  crafting: "/assets/store/character_sprites.png",
};

/** Per-product card art overrides when portalProducts.image is missing or generic. */
export const ARENA_CARD_OVERRIDES: Record<string, string> = {
  warlords: "/assets/store/dark_fantasy_scenes.png",
  wargus: "/assets/games/game_wargus_rts.png",
  "tower-defense": "/assets/games/game_tower_defense.png",
  "mage-arena": "/assets/games/mage-card.png",
  "avernus-arena": "/assets/games/game_avernus_arena.png",
  "multiplayer-racing": "/assets/games/game_multiplayer_racing.png",
  "annihilate-demo": "/assets/games/final-fighter-card.png",
  "grudge-fighter": "/assets/games/final-fighter-card.png",
  "voxel-sandbox": "/assets/pvp/pvp-bg-sandbox.jpg",
  "grudge-brawl": "/assets/games/arena-card.png",
  terraforge: "/assets/pvp/pvp-bg-sandbox.jpg",
  "grudge-crafting": "/assets/store/character_sprites.png",
  "betta-warlords": "/assets/games/game_rpg_maker.png",
  "grudge-angler": "/assets/pvp/pvp-bg-fishing.jpg",
  "star-rts": "/assets/games/space-rts-card.webp",
  "survival-game": "/assets/games/survival-card.png",
  "starway-gruda": "/assets/pvp/pvp-bg-scifi.jpg",
  "rts-star-armada": "/assets/games/space-rts-card.webp",
  "mech-armada": "/assets/pvp/pvp-bg-scifi.jpg",
  "nemesis-tcg": "/assets/pvp/pvp-bg-tcg.jpg",
  "grim-armada": "/assets/games/arena-card.png",
  "grudge-drive": "/assets/games/game_overdrive_3d.png",
  "grudge-metaverse": "/assets/games/tavern-bg.png",
  "rts-grudge": "/assets/games/rts-grudge-card.jpg",
  "grudge-three-port": "/assets/games/dungeon-crawler-card.png",
  "thc-labz-battle": "/assets/games/thc-labz-card.png",
  "dungeon-crawler": "/assets/games/game_decay_survival.png",
  "grudge-space-rts": "/assets/games/space-rts-card.webp",
  "final-fighter": "/assets/games/final-fighter-card.png",
  "rpg-sprite-attack": "/assets/games/tactical-rpg-card.png",
  "grudge-arena": "/assets/games/arena-card.png",
  "grudge-rpg-puter": "/assets/games/tactical-rpg-card.png",
  "grudge-warlords-rts": "/assets/games/rts-grudge-card.jpg",
  "grudge-mech-forge": "/assets/pvp/pvp-bg-scifi.jpg",
  wcs: "/assets/store/character_sprites.png",
  "flare-boss-arena": "/assets/games/flare-boss-card.png",
  "rpg-sprite-attack-gh": "/assets/games/tactical-rpg-card.png",
};

const PRODUCT_CATEGORY: Record<string, ArenaCategory> = {
  warlords: "mmo",
  wcs: "mmo",
  "grudge-metaverse": "mmo",
  "mage-arena": "arena",
  "avernus-arena": "arena",
  "grudge-brawl": "arena",
  "grudge-arena": "arena",
  "flare-boss-arena": "arena",
  "final-fighter": "arena",
  "grudge-fighter": "arena",
  "dungeon-crawler": "arena",
  "grim-armada": "arena",
  "grudge-drive": "arena",
  "betta-warlords": "arena",
  "annihilate-demo": "arena",
  wargus: "rts",
  "tower-defense": "rts",
  "star-rts": "rts",
  "rts-star-armada": "rts",
  "grudge-warlords-rts": "rts",
  "grudge-space-rts": "rts",
  "rts-grudge": "rts",
  "survival-game": "scifi",
  "starway-gruda": "scifi",
  "mech-armada": "scifi",
  "grudge-mech-forge": "scifi",
  "voxel-sandbox": "sandbox",
  terraforge: "sandbox",
  "multiplayer-racing": "racing",
  "grudge-angler": "fishing",
  "grudge-crafting": "crafting",
  "nemesis-tcg": "tcg",
  "thc-labz-battle": "tcg",
  "rpg-sprite-attack": "tcg",
  "rpg-sprite-attack-gh": "tcg",
  "grudge-rpg-puter": "tcg",
  "grudge-three-port": "mmo",
};

const GENERIC_IMAGES = new Set(["/assets/store/scifi_environment.png"]);

export interface ArenaReadiness {
  status: PortalProductStatus;
  note?: string;
}

/** Quick readiness hints surfaced on arena cards. */
export const ARENA_READINESS: Record<string, ArenaReadiness> = {
  "star-rts": { status: "planned", note: "Fleet shell — assets wired, gameplay in progress" },
  "starway-gruda": { status: "planned", note: "Dogfighter prototype — arena routes reserved" },
  "rts-star-armada": { status: "planned", note: "Grand RTS map — use Grudge Space RTS meanwhile" },
  "mech-armada": { status: "planned", note: "Try Grudge Mech Forge for mech combat preview" },
  "tower-defense": { status: "beta", note: "TD projectiles + VFX verified locally" },
  wargus: { status: "beta", note: "RTS PvP shell — lobby via super-engine" },
  "avernus-arena": { status: "beta", note: "Arena rotations — 3D combat on /avernus-3d" },
  "grudge-brawl": { status: "beta", note: "Voxel arena — touch + crosshair aiming live" },
  "flare-boss-arena": { status: "beta", note: "Boss VFX combos — solo arena ready" },
  "nemesis-tcg": { status: "live", note: "Ranked PvP + deckbuilder on nemesis.grudge-studio.com" },
  "grudge-arena": { status: "live", note: "Socket.IO PvP — Grudge ID required" },
  warlords: { status: "live", note: "Canonical MMO — Grudge ID for progression" },
};

export type ArenaFilter = "all" | PortalProductTag | "live" | "beta" | "planned";

export function getArenaCategory(product: PortalProduct): ArenaCategory {
  if (PRODUCT_CATEGORY[product.id]) return PRODUCT_CATEGORY[product.id];
  if (product.tags?.includes("rts")) return "rts";
  if (product.tags?.includes("mmo")) return "mmo";
  if (product.tags?.includes("arena") || product.tags?.includes("pvp")) return "arena";
  if (product.tags?.includes("coop") && product.tags?.includes("solo")) return "sandbox";
  return "arena";
}

export function getArenaCardImage(product: PortalProduct): string {
  if (product.image && !GENERIC_IMAGES.has(product.image)) return product.image;
  if (ARENA_CARD_OVERRIDES[product.id]) return ARENA_CARD_OVERRIDES[product.id];
  return ARENA_CATEGORY_BG[getArenaCategory(product)];
}

export function getArenaHeroBackground(): string {
  return ARENA_CATEGORY_BG.arena;
}

export function cardBackgroundStyle(imageUrl: string, hover = false): CSSProperties {
  const top = hover ? 0.35 : 0.55;
  const bottom = hover ? 0.85 : 0.92;
  return {
    backgroundImage: `linear-gradient(to bottom, hsla(225,30%,8%,${top}), hsla(225,30%,6%,${bottom})), url(${imageUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export function filterArenaProducts(
  products: PortalProduct[],
  filter: ArenaFilter,
): PortalProduct[] {
  if (filter === "all") return products;
  if (filter === "live" || filter === "beta" || filter === "planned") {
    return products.filter((p) => p.status === filter);
  }
  return products.filter((p) => p.tags?.includes(filter));
}

export function groupArenasByStatus(products: PortalProduct[]): Record<PortalProductStatus, PortalProduct[]> {
  const order: PortalProductStatus[] = ["live", "beta", "planned", "admin"];
  const groups = Object.fromEntries(order.map((s) => [s, [] as PortalProduct[]])) as Record<
    PortalProductStatus,
    PortalProduct[]
  >;
  for (const p of products) {
    groups[p.status]?.push(p);
  }
  return groups;
}