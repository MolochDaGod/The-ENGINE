/**
 * Canonical Grudge Studio domains for The Engine (apex portal).
 * Prefer *.grudge-studio.com over *.vercel.app / puter.site previews.
 */

export const CANONICAL = {
  engine: "https://grudge-studio.com",
  client: "https://client.grudge-studio.com",
  auth: "https://id.grudge-studio.com",
  api: "https://api.grudge-studio.com",
  assets: "https://assets.grudge-studio.com",
  objectStore: "https://objectstore.grudge-studio.com",
  /** Map / scene editor (R3F). Prefer over dead grudge-studio-forge.vercel.app */
  forge: "https://forge.grudge-studio.com",
  /** Alternate map editor host (same product family). */
  studioEditor: "https://studio.grudge-studio.com",
  arena: "https://grudge-arena.grudge-studio.com",
  launcher: "https://launcher.grudge-studio.com",
  game: "https://game.grudge-studio.com",
  nemesis: "https://nemesis.grudge-studio.com",
  drive: "https://drive.grudge-studio.com",
  survival: "https://grudges.grudge-studio.com",
  threePort: "https://grudge-three-port.vercel.app",
  warlords: "https://client.grudge-studio.com",
  warlordsLegacy: "https://grudgewarlords.com",
  /** Pending DNS — fall back to vercel until CNAME live */
  metaverse: "https://grudge-metaverse.vercel.app",
  warlordGenesis: "https://warlord-genesis.vercel.app/play",
  islands: "https://island-crusade-combat-sandbox.vercel.app/arena",
} as const;

/** Roles that unlock paid Forge IDE / premium studio tools. */
export const FORGE_PAID_ROLES = new Set([
  "admin",
  "developer",
  "premium",
  "founder",
  "vip",
  "pro",
  "paid",
  "subscriber",
]);

export interface ForgeAccessPlayer {
  role?: string | null;
  gbuxBalance?: string | number | null;
  grudgeId?: string | null;
  id?: number | string | null;
}

/**
 * Paid Forge access — admin/premium roles or non-zero GBUX (entitlement proxy).
 * Extend with real entitlement API when available.
 */
export function hasForgePaidAccess(player: ForgeAccessPlayer | null | undefined): boolean {
  if (!player) return false;
  const role = String(player.role ?? "").toLowerCase().trim();
  if (FORGE_PAID_ROLES.has(role)) return true;
  const gbux = typeof player.gbuxBalance === "number"
    ? player.gbuxBalance
    : parseFloat(String(player.gbuxBalance ?? "0"));
  if (Number.isFinite(gbux) && gbux >= 1) return true;
  return false;
}

/** Build forge launch URL with SSO handoff query params. */
export function buildForgeLaunchUrl(opts?: {
  token?: string | null;
  grudgeId?: string | null;
  returnTo?: string | null;
}): string {
  const u = new URL(CANONICAL.forge);
  if (opts?.token) u.searchParams.set("grudge_token", opts.token);
  if (opts?.grudgeId) u.searchParams.set("grudge_id", opts.grudgeId);
  if (opts?.returnTo) u.searchParams.set("returnTo", opts.returnTo);
  u.searchParams.set("from", "engine");
  return u.toString();
}

export function toCanonicalUrl(url: string): string {
  const map: Record<string, string> = {
    "https://grudge-studio-forge.vercel.app": CANONICAL.forge,
    "https://grudge-studio-forge-grudgenexus.vercel.app": CANONICAL.forge,
    "https://warlord-crafting-suite.vercel.app": CANONICAL.client,
    "https://wcs.grudge-studio.com": CANONICAL.client,
    "https://grudgewarlords.com": CANONICAL.warlords,
    "https://www.grudgewarlords.com": CANONICAL.warlords,
    "https://nexus-nemesis-game.vercel.app": CANONICAL.nemesis,
    "https://nemesis.grudge-studio.com/": CANONICAL.nemesis,
    "https://islands.grudge-studio.com": CANONICAL.islands,
    "https://islands.grudge-studio.com/": CANONICAL.islands,
  };
  const bare = url.replace(/\/$/, "");
  return map[bare] ?? map[url] ?? url;
}
