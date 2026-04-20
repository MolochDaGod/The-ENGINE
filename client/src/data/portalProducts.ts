export type PortalProductStatus = "live" | "planned" | "beta" | "admin";
export type PortalProductSection = "featured" | "play" | "studio" | "legacy";

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
  },
  {
    id: "launcher",
    name: "Grudge Launcher",
    href: "https://launcher.grudge-studio.com",
    description: "Single entry launcher for Grudge products, entitlements, updates, and client handoff.",
    status: "planned",
    section: "featured",
    external: true,
    authRequired: true,
    note: "Mission-phase target",
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
  },
  {
    id: "wargus",
    name: "Wargus RTS",
    href: "/wargus",
    description: "Realtime strategy gameplay inside the Grudge universe.",
    status: "beta",
    section: "play",
  },
  {
    id: "tower-defense",
    name: "Tower Defense",
    href: "/tower-defense",
    description: "Hold lanes, build defenses, and iterate on tactical encounters.",
    status: "beta",
    section: "play",
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
    href: "https://objectstore.grudge-studio.com",
    description: "Structured storage, metadata, search, and asset delivery for the whole studio.",
    status: "live",
    section: "studio",
    external: true,
  },
  {
    id: "legacy-editor",
    name: "Legacy Editor",
    href: "https://engine.grudge-studio.com",
    description: "Older editor surface kept accessible while the portal shifts to a client-first model.",
    status: "beta",
    section: "studio",
    external: true,
    note: "Legacy",
  },
  {
    id: "retro-library",
    name: "Retro Game Library",
    href: "/games",
    description: "Classic emulator library and retro catalog. Still available, but no longer the primary identity of the portal.",
    status: "live",
    section: "legacy",
  },
];

export const featuredProducts = PORTAL_PRODUCTS.filter((product) => product.section === "featured");
export const playProducts = PORTAL_PRODUCTS.filter((product) => product.section === "play");
export const studioProducts = PORTAL_PRODUCTS.filter((product) => product.section === "studio");
export const legacyProducts = PORTAL_PRODUCTS.filter((product) => product.section === "legacy");

export const portalStats = {
  totalProducts: PORTAL_PRODUCTS.length,
  live: PORTAL_PRODUCTS.filter((product) => product.status === "live").length,
  planned: PORTAL_PRODUCTS.filter((product) => product.status === "planned").length,
  authRequired: PORTAL_PRODUCTS.filter((product) => product.authRequired).length,
};
