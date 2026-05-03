/**
 * GrudaChain Bridge — Grudge Studio
 *
 * Connects to:
 *  1. the-grench-worker (Puter Worker) — GBux SPL token operations
 *  2. Puter KV — player save data (user-pays model)
 *  3. Puter Auth — guest ID → Grudge ID linking
 *  4. Solana RPC — on-chain GBux balance verification
 *
 * This module is the single integration point between the Express backend
 * and the Puter/GrudaChain ecosystem. All other server modules import from here.
 */

import { getConnection, getGBUXMint, getSplTokenBalance } from "./web3/solana-client";

// ═══ PUTER SDK (server-side, deployer-paid) ═══
let _puter: any = null;

async function getPuter() {
  if (_puter) return _puter;
  try {
    const { init } = await import("@heyputer/puter.js/src/init.cjs");
    const token = process.env.PUTER_DEPLOYER_TOKEN;
    if (!token) {
      console.warn("[grudachain] PUTER_DEPLOYER_TOKEN not set — Puter features disabled");
      return null;
    }
    _puter = init(token);
    console.log("[grudachain] Puter SDK initialized (deployer-paid)");
    return _puter;
  } catch (err) {
    console.warn("[grudachain] Puter SDK not available:", (err as Error).message);
    return null;
  }
}

// ═══ GRENCH WORKER (GBux SPL operations) ═══
const GRENCH_WORKER_URL = process.env.GRENCH_WORKER_URL || "https://the-grench-worker.puter.site";

export interface GBuxBalance {
  grudgeId: string;
  dbBalance: number;       // balance tracked in MySQL (fast, authoritative for gameplay)
  onChainBalance: number;  // balance on Solana (source of truth for withdrawals)
  synced: boolean;         // whether they match
}

/**
 * Get GBux balance from both DB and on-chain.
 */
export async function getGBuxBalance(grudgeId: string, walletAddress?: string): Promise<GBuxBalance> {
  // DB balance (from existing storage layer — fast)
  const dbBalance = 0; // TODO: wire to storage.getPlayerBalance(grudgeId) when available

  // On-chain balance (Solana SPL)
  let onChainBalance = 0;
  if (walletAddress) {
    const mint = getGBUXMint();
    if (mint) {
      try {
        const spl = await getSplTokenBalance(walletAddress, mint.toBase58());
        onChainBalance = spl.uiAmount;
      } catch { /* wallet may not have token account */ }
    }
  }

  return {
    grudgeId,
    dbBalance,
    onChainBalance,
    synced: Math.abs(dbBalance - onChainBalance) < 0.01,
  };
}

/**
 * Request GBux minting via the Grench worker.
 * This calls the Puter Worker which has authority to mint SPL tokens.
 */
export async function requestGBuxMint(
  recipientWallet: string,
  amount: number,
  reason: string,
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  try {
    const resp = await fetch(`${GRENCH_WORKER_URL}/api/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: recipientWallet, amount, reason }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, error: `Grench worker error: ${resp.status} ${err}` };
    }

    const data = (await resp.json()) as any;
    return { success: true, txSignature: data.signature || data.tx };
  } catch (err: any) {
    return { success: false, error: err.message || "Grench worker unreachable" };
  }
}

// ═══ PUTER KV — Player Save Data ═══

/**
 * Save player data to Puter KV (deployer-paid, centralized).
 * Key format: save:{grudgeId}:{slot}
 */
export async function savePlayerData(
  grudgeId: string,
  slot: string,
  data: Record<string, any>,
): Promise<boolean> {
  const puter = await getPuter();
  if (!puter) return false;

  try {
    await puter.kv.set(`save:${grudgeId}:${slot}`, data);
    return true;
  } catch (err) {
    console.error("[grudachain] Failed to save player data:", err);
    return false;
  }
}

/**
 * Load player data from Puter KV.
 */
export async function loadPlayerData(
  grudgeId: string,
  slot: string,
): Promise<Record<string, any> | null> {
  const puter = await getPuter();
  if (!puter) return null;

  try {
    return await puter.kv.get(`save:${grudgeId}:${slot}`);
  } catch {
    return null;
  }
}

/**
 * List all save slots for a player.
 */
export async function listPlayerSaves(grudgeId: string): Promise<string[]> {
  const puter = await getPuter();
  if (!puter) return [];

  try {
    const keys = await puter.kv.list(`save:${grudgeId}:`);
    return keys.map((k: string) => k.replace(`save:${grudgeId}:`, ""));
  } catch {
    return [];
  }
}

/**
 * Delete a save slot.
 */
export async function deletePlayerSave(grudgeId: string, slot: string): Promise<boolean> {
  const puter = await getPuter();
  if (!puter) return false;

  try {
    await puter.kv.del(`save:${grudgeId}:${slot}`);
    return true;
  } catch {
    return false;
  }
}

// ═══ PUTER AUTH — Guest ID → Grudge ID Linking ═══

export interface PuterGrudgeLink {
  puterId: string;
  grudgeId: string;
  linkedAt: string;
}

/**
 * Link a Puter guest ID to a Grudge ID.
 * Per project rules: every Puter ID auto-creates a Grudge ID.
 */
export async function linkPuterToGrudge(
  puterId: string,
  grudgeId: string,
): Promise<boolean> {
  const puter = await getPuter();
  if (!puter) return false;

  try {
    // Store bidirectional mapping
    await puter.kv.set(`link:puter:${puterId}`, { grudgeId, linkedAt: new Date().toISOString() });
    await puter.kv.set(`link:grudge:${grudgeId}`, { puterId, linkedAt: new Date().toISOString() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a Puter ID to a Grudge ID.
 */
export async function resolveGrudgeId(puterId: string): Promise<string | null> {
  const puter = await getPuter();
  if (!puter) return null;

  try {
    const link = await puter.kv.get(`link:puter:${puterId}`);
    return link?.grudgeId || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Grudge ID to a Puter ID.
 */
export async function resolvePuterId(grudgeId: string): Promise<string | null> {
  const puter = await getPuter();
  if (!puter) return null;

  try {
    const link = await puter.kv.get(`link:grudge:${grudgeId}`);
    return link?.puterId || null;
  } catch {
    return null;
  }
}

// ═══ PUTER CLOUD STORAGE — Player Assets ═══

/**
 * Upload a player asset (GLB, screenshot, etc.) to Puter FS.
 * Stored under the deployer's namespace for centralized access.
 */
export async function uploadPlayerAsset(
  grudgeId: string,
  filename: string,
  data: Buffer,
): Promise<string | null> {
  const puter = await getPuter();
  if (!puter) return null;

  try {
    const path = `PlayerAssets/${grudgeId}/${filename}`;
    await puter.fs.write(path, data);
    const url = await puter.fs.getReadURL(path, { ttl: 86400 }); // 24h URL
    return url;
  } catch (err) {
    console.error("[grudachain] Asset upload failed:", err);
    return null;
  }
}

/**
 * Get a shareable URL for a player asset.
 */
export async function getPlayerAssetURL(
  grudgeId: string,
  filename: string,
  ttlSeconds = 3600,
): Promise<string | null> {
  const puter = await getPuter();
  if (!puter) return null;

  try {
    return await puter.fs.getReadURL(`PlayerAssets/${grudgeId}/${filename}`, { ttl: ttlSeconds });
  } catch {
    return null;
  }
}

// ═══ HEALTH CHECK ═══

export async function getGrudaChainStatus(): Promise<{
  puter: { connected: boolean; kvWorking: boolean };
  grenchWorker: { reachable: boolean; url: string };
  solana: { gbuxMint: string | null; network: string };
}> {
  // Check Puter
  let puterConnected = false;
  let kvWorking = false;
  const puter = await getPuter();
  if (puter) {
    puterConnected = true;
    try {
      await puter.kv.set("__healthcheck", Date.now(), Math.floor(Date.now() / 1000) + 60);
      kvWorking = true;
    } catch { /* */ }
  }

  // Check Grench Worker
  let grenchReachable = false;
  try {
    const resp = await fetch(`${GRENCH_WORKER_URL}/health`, { signal: AbortSignal.timeout(5000) });
    grenchReachable = resp.ok;
  } catch { /* */ }

  // Solana
  const mint = getGBUXMint();

  return {
    puter: { connected: puterConnected, kvWorking },
    grenchWorker: { reachable: grenchReachable, url: GRENCH_WORKER_URL },
    solana: {
      gbuxMint: mint?.toBase58() || null,
      network: process.env.SOLANA_NETWORK || "devnet",
    },
  };
}
