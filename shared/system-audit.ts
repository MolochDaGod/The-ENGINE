/**
 * Server-safe fleet/canonical audit data (no client imports).
 * Keep launch URLs aligned with fleetRegistry + universe-catalog.
 */
import { UNIVERSE_LAUNCH } from "./universe-catalog";

export const SYSTEM_CANONICAL = {
  engine: "https://grudge-studio.com",
  client: "https://client.grudge-studio.com",
  auth: "https://id.grudge-studio.com",
  api: "https://api.grudge-studio.com",
  forge: "https://forge.grudge-studio.com",
  nemesis: "https://nemesis.grudge-studio.com",
  arena: "https://grudge-arena.grudge-studio.com",
  survival: "https://grudges.grudge-studio.com",
  drive: "https://drive.grudge-studio.com",
  launcher: "https://launcher.grudge-studio.com",
  warlordsLegacy: "https://grudgewarlords.com",
  metaverse: "https://metaverse.grudge-studio.com",
  warlordGenesis: "https://genesis.grudge-studio.com/play",
  islands: "https://islands.grudge-studio.com/arena",
} as const;

/** Subset of fleet registry for admin grade checks */
export const FLEET_CANONICAL_AUDIT: Array<{
  id: string;
  name: string;
  status: string;
  forge?: boolean;
  canonicalUrl: string;
  embedUrl?: string;
}> = [
  { id: "warlords", name: "Grudge Warlords", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.client },
  { id: "wcs", name: "WCS Client", status: "live", canonicalUrl: SYSTEM_CANONICAL.client },
  { id: "nemesis-tcg", name: "Nexus Nemesis", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.nemesis, embedUrl: "https://nexus-nemesis-game.vercel.app" },
  { id: "warlord-genesis", name: "Warlord Genesis", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.warlordGenesis },
  { id: "grudge-metaverse", name: "Metaverse", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.metaverse },
  { id: "island-crusade-combat-sandbox", name: "Island Crusade", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.islands },
  { id: "grudge-arena", name: "Grudge Arena", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.arena },
  { id: "survival-game", name: "Grudges Survival", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.survival },
  { id: "grudge-drive", name: "Grudge Drive", status: "live", forge: true, canonicalUrl: SYSTEM_CANONICAL.drive, embedUrl: "https://drive.grudge-studio.com/?embed=1" },
  { id: "grudge-forge", name: "Studio Forge", status: "live", forge: true, canonicalUrl: "/studio-forge" },
  { id: "rts-grudge", name: "RTS Grudge", status: "live", forge: true, canonicalUrl: "https://rts-grudge.vercel.app" },
  { id: "voxel-sandbox", name: "Voxel Sandbox", status: "beta", forge: true, canonicalUrl: "/voxel-sandbox", embedUrl: "/embed/vox/grudge-warlords-vox.html" },
  { id: "terraforge", name: "TerraForge", status: "beta", forge: true, canonicalUrl: "/terraforge", embedUrl: "/embed/vox/grudge-warlords-openworld.html" },
  { id: "grudge-brawl", name: "Grudge Brawl", status: "beta", forge: true, canonicalUrl: "/grudge-brawl", embedUrl: "/embed/vox/z-brawl.html" },
];

export function gradeFleetUrl(url: string): "canonical" | "vercel-pending" | "external" | "internal" {
  if (url.startsWith("/")) return "internal";
  if (url.includes("grudge-studio.com") || url.includes("grudgewarlords.com")) return "canonical";
  if (url.includes("vercel.app")) return "vercel-pending";
  return "external";
}

export function buildCanonicalAudit() {
  const rows = FLEET_CANONICAL_AUDIT.map((e) => ({
    ...e,
    grade: gradeFleetUrl(e.canonicalUrl),
  }));
  return {
    summary: {
      total: rows.length,
      canonical: rows.filter((r) => r.grade === "canonical" || r.grade === "internal").length,
      vercelPending: rows.filter((r) => r.grade === "vercel-pending").length,
      external: rows.filter((r) => r.grade === "external").length,
    },
    rows,
    universeLaunch: UNIVERSE_LAUNCH,
    canonicalMap: SYSTEM_CANONICAL,
  };
}
