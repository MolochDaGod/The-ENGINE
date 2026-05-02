/**
 * Solana Client — shared Connection + keypair helpers
 *
 * Every server-side module that talks to Solana imports from here.
 * Keypairs are loaded from env vars (base58-encoded secret keys).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  type ConfirmOptions,
  type TransactionSignature,
} from "@solana/web3.js";
import bs58 from "bs58";

// ── Connection singleton ─────────────────────────────────────────

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const NETWORK = process.env.SOLANA_NETWORK || "devnet";

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, "confirmed");
    console.log(`[solana] Connected to ${NETWORK} at ${RPC_URL}`);
  }
  return _connection;
}

export function getSolanaNetwork(): string {
  return NETWORK;
}

// ── Keypair loaders ──────────────────────────────────────────────

function loadKeypairFromEnv(envVar: string): Keypair | null {
  const raw = process.env[envVar];
  if (!raw) return null;
  try {
    // Try base58 first (standard solana-keygen export)
    const bytes = bs58.decode(raw);
    return Keypair.fromSecretKey(bytes);
  } catch {
    try {
      // Fall back to JSON array format [1,2,3,...,64]
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Keypair.fromSecretKey(new Uint8Array(parsed));
      }
    } catch {
      // ignore
    }
  }
  console.warn(`[solana] Failed to load keypair from ${envVar}`);
  return null;
}

/** Platform treasury wallet (GRUDGE_SOL_WALLET) */
export function getTreasuryKeypair(): Keypair | null {
  return loadKeypairFromEnv("GRUDGE_SOL_WALLET");
}

/** Admin AI agent operational key (ADMIN_AI_WALLET_KEY) — limited authority. */
export function getAdminAIKeypair(): Keypair | null {
  return loadKeypairFromEnv("ADMIN_AI_WALLET_KEY");
}

/** Master admin key (ADMIN_WALLET_PRIVATE_KEY) — for manual emergency ops only. */
export function getMasterKeypair(): Keypair | null {
  return loadKeypairFromEnv("ADMIN_WALLET_PRIVATE_KEY");
}

/** GBUX SPL token mint address. */
export function getGBUXMint(): PublicKey | null {
  const mint = process.env.GBUX_TOKEN_MINT;
  if (!mint) return null;
  try {
    return new PublicKey(mint);
  } catch {
    return null;
  }
}

// ── Balance helpers ──────────────────────────────────────────────

export async function getSolBalance(address: string): Promise<number> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);
  const lamports = await conn.getBalance(pubkey);
  return lamports / LAMPORTS_PER_SOL;
}

export async function getSplTokenBalance(
  ownerAddress: string,
  mintAddress: string,
): Promise<{ amount: string; decimals: number; uiAmount: number }> {
  const conn = getConnection();
  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(mintAddress);

  // Import dynamically to avoid top-level await issues
  const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");
  const ata = await getAssociatedTokenAddress(mint, owner);

  try {
    const account = await getAccount(conn, ata);
    const decimals = 4; // GBUX uses 4 decimals, matching DB precision
    const uiAmount = Number(account.amount) / Math.pow(10, decimals);
    return { amount: account.amount.toString(), decimals, uiAmount };
  } catch {
    // Token account doesn't exist — zero balance
    return { amount: "0", decimals: 4, uiAmount: 0 };
  }
}

// ── Transaction helpers ──────────────────────────────────────────

export async function getRecentTransactions(
  address: string,
  limit: number = 20,
): Promise<Array<{
  signature: string;
  slot: number;
  blockTime: number | null | undefined;
  err: any;
}>> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);
  const sigs = await conn.getSignaturesForAddress(pubkey, { limit });
  return sigs.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    blockTime: s.blockTime,
    err: s.err,
  }));
}

export async function confirmTransaction(
  signature: TransactionSignature,
  opts?: ConfirmOptions,
): Promise<boolean> {
  const conn = getConnection();
  try {
    const result = await conn.confirmTransaction(signature, opts?.commitment || "confirmed");
    return !result.value.err;
  } catch {
    return false;
  }
}

/** Check whether the platform wallets are configured and funded. */
export async function getWalletStatus(): Promise<{
  treasury: { configured: boolean; address: string | null; solBalance: number | null };
  adminAI: { configured: boolean; address: string | null; solBalance: number | null };
  gbuxMint: { configured: boolean; address: string | null };
  network: string;
  rpcUrl: string;
}> {
  const treasury = getTreasuryKeypair();
  const adminAI = getAdminAIKeypair();
  const gbuxMint = getGBUXMint();

  let treasuryBalance: number | null = null;
  let adminAIBalance: number | null = null;

  if (treasury) {
    try { treasuryBalance = await getSolBalance(treasury.publicKey.toBase58()); } catch { /* */ }
  }
  if (adminAI) {
    try { adminAIBalance = await getSolBalance(adminAI.publicKey.toBase58()); } catch { /* */ }
  }

  return {
    treasury: {
      configured: !!treasury,
      address: treasury?.publicKey.toBase58() || null,
      solBalance: treasuryBalance,
    },
    adminAI: {
      configured: !!adminAI,
      address: adminAI?.publicKey.toBase58() || null,
      solBalance: adminAIBalance,
    },
    gbuxMint: {
      configured: !!gbuxMint,
      address: gbuxMint?.toBase58() || null,
    },
    network: NETWORK,
    rpcUrl: RPC_URL,
  };
}
