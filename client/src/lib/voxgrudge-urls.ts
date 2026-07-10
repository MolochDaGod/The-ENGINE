/**
 * Full voxgrudge game builds on grudox.
 *
 * Direct grudox URLs send X-Frame-Options: SAMEORIGIN and cannot iframe
 * on the apex portal. Use same-origin /embed/vox/* proxies (vercel.json)
 * so the terminal container can host real HTML5 builds.
 */
export const VOXGRUDGE_ORIGIN = "https://grudox.grudge-studio.com/voxgrudge";

/** Same-origin proxy prefix — rewrites to VOXGRUDGE_ORIGIN on The Engine. */
export const VOXGRUDGE_EMBED_PREFIX = "/embed/vox";

function proxied(file: string): string {
  return `${VOXGRUDGE_EMBED_PREFIX}/${file}`;
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
