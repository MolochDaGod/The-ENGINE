/**
 * Full voxgrudge game builds on grudox — NOT the portal micro-stubs in /games/*.html.
 * SSOT for TerraForge, Voxel Sandbox, and Grudge Brawl iframe targets.
 */
export const VOXGRUDGE_BASE = "https://grudox.grudge-studio.com/voxgrudge";

export const VOXGRUDGE_GAMES = {
  /** Open-world voxel: classes, crafting, city/build, NPC AI, minimap */
  terraforge: `${VOXGRUDGE_BASE}/grudge-warlords-openworld.html`,
  /** VOX edition physics sandbox */
  voxelSandbox: `${VOXGRUDGE_BASE}/grudge-warlords-vox.html`,
  /** Z-BRAWL day/night survival arena combat */
  grudgeBrawl: `${VOXGRUDGE_BASE}/z-brawl.html`,
} as const;