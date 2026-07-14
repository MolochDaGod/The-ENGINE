/**
 * Full voxgrudge game builds (TerraForge open world).
 *
 * Direct cross-origin embeds can hit frame-ancestors issues, so the portal
 * uses same-origin /embed/vox/* — middleware.ts proxies to the production
 * voxgrudge host, strips XFO, and keeps assets on static same-origin paths.
 */
export const VOXGRUDGE_ORIGIN = "https://voxgrudge.vercel.app";

/** Same-origin proxy prefix — handled by middleware.ts on The Engine. */
export const VOXGRUDGE_EMBED_PREFIX = "/embed/vox";

function proxied(file: string): string {
  // Cache-bust when proxy upstream / asset config changes
  return `${VOXGRUDGE_EMBED_PREFIX}/${file}?v=fleet3`;
}

export const VOXGRUDGE_GAMES = {
  /** Open-world voxel: classes, crafting, city/build, NPC AI, minimap */
  terraforge: proxied("grudge-warlords-openworld.html"),
  /** VOX edition physics sandbox */
  voxelSandbox: proxied("grudge-warlords-vox.html"),
  /** Z-BRAWL day/night survival arena combat */
  grudgeBrawl: proxied("z-brawl.html"),
} as const;

/** Absolute play URLs (new tab) when proxy unavailable. */
export const VOXGRUDGE_PLAY = {
  terraforge: `${VOXGRUDGE_ORIGIN}/grudge-warlords-openworld.html`,
  voxelSandbox: `${VOXGRUDGE_ORIGIN}/grudge-warlords-vox.html`,
  grudgeBrawl: `${VOXGRUDGE_ORIGIN}/z-brawl.html`,
} as const;
