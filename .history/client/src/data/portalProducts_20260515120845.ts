export type PortalProductStatus = "live" | "planned" | "beta" | "admin";
export type PortalProductSection = "featured" | "play" | "studio" | "legacy";
export type PortalProductTag = "pvp" | "pvpve" | "coop" | "solo" | "retro" | "arena" | "mmo" | "rts";

export interface PortalProduct {
  id: string;
  name: string;
  href: string;
  description: string;
  status: PortalProductStatus;
  section: PortalProductSection;
  external?: boolean;
  authRequired?: boolean;
  note?: string;
  tags?: PortalProductTag[];
  /** Background image URL for the product card (R2 CDN or local asset) */
  image?: string;
}

export const PORTAL_PRODUCTS: PortalProduct[] = [
  {
    id: "warlords",
    name: "Grudge Warlords",
    href: "https://grudgewarlords.com",
    description: "The main live product: character creation, combat, islands, professions, and Warlords progression.",
    status: "live",
    section: "featured",
    external: true,
    authRequired: true,
    tags: ["mmo", "pvp", "pvpve", "coop"],
    image: "https://assets.grudge-studio.com/portal/warlords-card.jpg",
  },
  {
    id: "launcher",
    name: "Grudge Launcher",
    href: "https://grudgedot-launcher.vercel.app",
    description: "Single entry launcher for Grudge products, entitlements, updates, and client handoff.",
    status: "planned",
    section: "featured",
    external: true,
    authRequired: true,
    note: "Mission-phase target — launcher build in progress",
    image: "https://assets.grudge-studio.com/portal/launcher-card.jpg",
  },
  {
    id: "dashboard",
    name: "Studio Dashboard",
    href: "https://dash.grudge-studio.com",
    description: "Operations hub for accounts, systems, economy, moderation, and studio administration.",
    status: "live",
    section: "featured",
    external: true,
    authRequired: true,
    image: "https://assets.grudge-studio.com/portal/dashboard-card.jpg",
  },
  {
    id: "ai-hub",
    name: "AI Hub",
    href: "https://ai.grudge-studio.com",
    description: "Gruda Legion AI tools, workflows, and automation surfaces for the Grudge ecosystem.",
    status: "live",
    section: "featured",
    external: true,
    authRequired: true,
    image: "https://assets.grudge-studio.com/portal/ai-hub-card.jpg",
  },
  {
    id: "wargus",
    name: "Wargus RTS",
    href: "/wargus",
    description: "Realtime strategy gameplay inside the Grudge universe.",
    status: "beta",
    section: "play",
    tags: ["rts", "pvp", "coop"],
    image: "https://assets.grudge-studio.com/portal/wargus-card.jpg",
  },
  {
    id: "tower-defense",
    name: "Tower Defense",
    href: "/tower-defense",
    description: "Hold lanes, build defenses, and iterate on tactical encounters.",
    status: "beta",
    section: "play",
    tags: ["solo", "coop"],
    image: "https://assets.grudge-studio.com/portal/tower-defense-card.jpg",
  },
  {
    id: "mage-arena",
    name: "Mage Arena",
    href: "/mage-arena",
    description: "Fast PvP skirmishes in the mage arena playtest surface.",
    status: "beta",
    section: "play",
    tags: ["pvp", "arena"],
    image: "https://assets.grudge-studio.com/portal/mage-arena-card.jpg",
  },
  {
    id: "avernus-arena",
    name: "Avernus Arena",
    href: "/avernus-arena",
    description: "Dark-fantasy arena combat with PvP and PvPvE rotations.",
    status: "beta",
    section: "play",
    tags: ["pvp", "pvpve", "arena"],
    image: "https://assets.grudge-studio.com/portal/avernus-card.jpg",
  },
  {
    id: "multiplayer-racing",
    name: "Overdrive Racing",
    href: "/overdrive-racing",
    description: "Multiplayer arcade racing across Grudge tracks.",
    status: "beta",
    section: "play",
    tags: ["pvp", "arena"],
    image: "https://assets.grudge-studio.com/portal/overdrive-card.jpg",
  },
  {
    id: "annihilate-demo",
    name: "Annihilate Demo",
    href: "/annihilate-demo",
    description: "Co-op wave survival demo inside the Grudge universe.",
    status: "beta",
    section: "play",
    tags: ["coop", "pvpve"],
    image: "https://assets.grudge-studio.com/portal/annihilate-card.jpg",
  },
  {
    id: "grudge-crafting",
    name: "Crafting & Professions",
    href: "https://grudge-crafting.puter.site",
    description: "Canonical crafting suite — Miner, Forester, Mystic, Chef, Engineer. Auto-harvest, recipes, inventory. Runs on Puter with full cloud sync.",
    status: "live",
    section: "featured",
    external: true,
    authRequired: true,
    tags: ["coop"],
    image: "https://assets.grudge-studio.com/portal/crafting-card.jpg",
  },
  {
    id: "grudge-studio-puter",
    name: "Grudge Studio",
    href: "https://grudgewarlords.com",
    description: "The Grudge Studio hub on Puter — gateway to grudgewarlords.com with character creation and crafting.",
    status: "live",
    section: "featured",
    external: true,
    authRequired: true,
    tags: ["mmo"],
    image: "https://assets.grudge-studio.com/portal/studio-card.jpg",
  },
  {
    id: "catalog",
    name: "Item Catalog",
    href: "/catalog",
    description: "Live item database for all Grudge products — tiers, rarities, crafting workstations, NFT items. Sourced from the launcher on Puter.",
    status: "live",
    section: "studio",
    note: "Live feed",
  },
  {
    id: "my-cloud",
    name: "My Grudge Cloud",
    href: "/cloud",
    description: "Your personal Puter cloud, stylized for Grudge Studio — scenes, games, characters, wallet visuals, and saves across every Grudge tool.",
    status: "beta",
    section: "studio",
    authRequired: true,
    note: "Puter · Phase 1 shell live",
  },
  {
    id: "asset-store",
    name: "Asset Store",
    href: "/asset-store",
    description: "Browse studio assets, packs, and product-ready content surfaces.",
    status: "live",
    section: "studio",
  },
  {
    id: "objectstore",
    name: "ObjectStore",
    href: "https://browse.grudge-studio.com",
    description: "Structured storage, metadata, search, and asset delivery for the whole studio.",
    status: "live",
    section: "studio",
    external: true,
    note: "API: objectstore.grudge-studio.com",
  },
  {
    id: "retro-library",
    name: "Retro Game Library",
    href: "/games",
    description: "Classic emulator library and retro catalog. Still available, but no longer the primary identity of the portal.",
    status: "live",
    section: "legacy",
    tags: ["retro", "solo"],
  },
  // ── Puter / External games ──
  {
    id: "betta-warlords",
    name: "Betta Warlords",
    href: "https://betta-grudgedev.replit.app/",
    description: "Completed Nexus-era competitive game with Discord & Puter login. Full PvP gameplay loop.",
    status: "live",
    section: "play",
    external: true,
    authRequired: true,
    note: "Replit",
    tags: ["pvp", "arena"],
  },
  {
    id: "grudge-angler",
    name: "Grudge Angler",
    href: "https://puter.com/app/grudge-angler",
    description: "Warlords-era fishing game with daily Discord tournaments, leaderboards, and seasonal catches.",
    status: "live",
    section: "play",
    external: true,
    note: "Puter",
    tags: ["solo", "coop"],
  },
  {
    id: "grudge-studio-app",
    name: "Grudge Studio",
    href: "https://puter.com/app/gs",
    description: "The Grudge Studio hub on Puter — gateway to grudgewarlords.com with character creation and crafting.",
    status: "live",
    section: "featured",
    external: true,
    authRequired: true,
    note: "Puter",
  },
  {
    id: "star-rts",
    name: "Star RTS",
    href: "/star-rts",
    description: "Fleet-scale real-time strategy in the Armada universe. Command capital ships and orbital stations.",
    status: "planned",
    section: "play",
    tags: ["rts", "pvp"],
  },
  {
    id: "survival-game",
    name: "Survival: Deep Space",
    href: "/survival",
    description: "Open-world survival in the Armada era. Scavenge, craft, build outposts, and survive hostile space.",
    status: "planned",
    section: "play",
    tags: ["solo", "coop", "pvpve"],
  },
  {
    id: "nemesis-tcg",
    name: "Nexus Nemesis TCG",
    href: "/nemesis-tcg",
    description: "Trading card game set in the Nexus era. Collect, build decks, and duel in ranked or casual matches.",
    status: "beta",
    section: "play",
    tags: ["pvp", "solo"],
  },
  {
    id: "grudge-forge",
    name: "Grudge Studio Forge",
    href: "https://grudge-studio-forge.pages.dev",
    description: "Game-making IDE for the Grudge ecosystem. Build scenes, edit assets, and deploy games directly from the browser.",
    status: "live",
    section: "studio",
    external: true,
    authRequired: true,
    note: "IDE",
  },
  {
    id: "grudge-coder",
    name: "Grudge Coder",
    href: "https://coder.grudge-studio.com",
    description: "Cloud development environment for Grudge services. Code, test, and deploy backend and frontend from anywhere.",
    status: "live",
    section: "studio",
    external: true,
    authRequired: true,
    note: "Cloud IDE",
  },
  {
    id: "match-3-grudge",
    name: "Grudge Match-3",
    href: "https://molochdagod.github.io/grudge-match-webgl/",
    description: "Unity-powered match-3 puzzle game with Warlords lore, seasonal events, and crafting material drops.",
    status: "live",
    section: "play",
    external: true,
    note: "Unity WebGL",
    tags: ["solo"],
  },
];

export const featuredProducts = PORTAL_PRODUCTS.filter((product) => product.section === "featured");
export const playProducts = PORTAL_PRODUCTS.filter((product) => product.section === "play");
export const studioProducts = PORTAL_PRODUCTS.filter((product) => product.section === "studio");
export const legacyProducts = PORTAL_PRODUCTS.filter((product) => product.section === "legacy");

export function productsByTag(tag: PortalProductTag): PortalProduct[] {
  return PORTAL_PRODUCTS.filter((product) => product.tags?.includes(tag));
}

export const pvpProducts = PORTAL_PRODUCTS.filter((product) =>
  product.tags?.some((tag) => tag === "pvp" || tag === "pvpve" || tag === "coop" || tag === "arena"),
);

export const portalStats = {
  totalProducts: PORTAL_PRODUCTS.length,
  live: PORTAL_PRODUCTS.filter((product) => product.status === "live").length,
  planned: PORTAL_PRODUCTS.filter((product) => product.status === "planned").length,
  authRequired: PORTAL_PRODUCTS.filter((product) => product.authRequired).length,
  multiplayer: PORTAL_PRODUCTS.filter((product) => product.tags?.some((tag) => tag === "pvp" || tag === "pvpve" || tag === "coop")).length,
};
