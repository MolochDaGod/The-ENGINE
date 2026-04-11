/**
 * Grudge Engine — Collision Groups
 * Direct port of gonnavis/annihilate src/global.js
 *
 * IMPORTANT: all values MUST be powers of 2.
 * Start from 2 to avoid conflict with Cannon-ES default (1).
 * https://pmndrs.github.io/cannon-es/docs/classes/body.html
 */

export const GROUP_SCENE        = 2;    // static world geometry (ground, walls, boxes)
export const GROUP_ROLE         = 4;    // player-controlled character
export const GROUP_ENEMY        = 8;    // AI-controlled enemies
export const GROUP_ROLE_ATTACKER= 16;   // player weapon / hitbox
export const GROUP_ENEMY_ATTACKER= 32;  // enemy weapon / hitbox
export const GROUP_TRIGGER      = 64;   // invisible trigger volumes (AI detectors, teleporters)
export const GROUP_ENEMY_SHIELD = 128;  // enemy shield body
export const GROUP_NO_COLLIDE   = 256;  // opt-out of all collisions

/** Max delta time clamped per frame to prevent physics tunnelling on tab-switch */
export const MAX_DT = 1 / 60;
