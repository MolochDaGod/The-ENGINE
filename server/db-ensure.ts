/**
 * Safe, idempotent schema ensure for account universe tables.
 * Prefer this over drizzle-kit push on Railway (push can fail on PK ops).
 */
import { pool } from "./db";

let ensured = false;

const STATEMENTS = [
  // Play settings on users
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS play_settings jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS recent_plays jsonb DEFAULT '[]'::jsonb`,

  // Indexes for universe tables
  `CREATE INDEX IF NOT EXISTS player_characters_user_id_idx ON player_characters (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS player_characters_user_prefab_uidx ON player_characters (user_id, prefab_id)`,
  `CREATE INDEX IF NOT EXISTS player_decks_user_id_idx ON player_decks (user_id)`,
  `CREATE INDEX IF NOT EXISTS player_islands_user_id_idx ON player_islands (user_id)`,
  `CREATE INDEX IF NOT EXISTS player_game_saves_user_id_idx ON player_game_saves (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS player_game_saves_user_game_slot_uidx ON player_game_saves (user_id, game_key, slot)`,
];

export async function ensureAccountSchema(): Promise<{ ok: boolean; applied: number; error?: string }> {
  if (ensured) return { ok: true, applied: 0 };
  let applied = 0;
  const client = await pool.connect();
  try {
    for (const sql of STATEMENTS) {
      await client.query(sql);
      applied += 1;
    }
    ensured = true;
    return { ok: true, applied };
  } catch (e: any) {
    console.error("[db-ensure] failed:", e?.message || e);
    return { ok: false, applied, error: e?.message || String(e) };
  } finally {
    client.release();
  }
}
