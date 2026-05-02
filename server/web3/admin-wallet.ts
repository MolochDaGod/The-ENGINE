/**
 * Admin AI Wallet — server-side wallet management
 *
 * Provides tooling for the admin AI agent to:
 *   - Read balances (SOL + GBUX) for any platform wallet
 *   - List recent on-chain transactions
 *   - Co-sign reward mints (ADMIN_AI_WALLET_KEY)
 *   - Reconcile on-chain balances vs DB
 *   - Transfer GBUX between platform wallets
 *   - Log everything to web3_transactions table
 *
 * Key hierarchy:
 *   GRUDGE_SOL_WALLET      → Treasury (receives SOL from swaps)
 *   ADMIN_AI_WALLET_KEY    → Agent ops (co-sign mints, reconcile)
 *   ADMIN_WALLET_PRIVATE_KEY → Master (Racalvin, manual only)
 */

import { db } from "../db";
import { web3Transactions, walletConnections, users } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  getConnection,
  getSolBalance,
  getSplTokenBalance,
  getRecentTransactions,
  getTreasuryKeypair,
  getAdminAIKeypair,
  getGBUXMint,
  getWalletStatus,
} from "./solana-client";
import { sendDiscordWebhook, DiscordEmbedType } from "../discord-webhooks";

// ── Balance reads ────────────────────────────────────────────────

export interface WalletBalanceResult {
  address: string;
  solBalance: number;
  gbuxBalance: { amount: string; uiAmount: number } | null;
}

/** Get SOL + GBUX balance for any address. */
export async function getWalletBalance(address: string): Promise<WalletBalanceResult> {
  const sol = await getSolBalance(address);
  const gbuxMint = getGBUXMint();

  let gbux: { amount: string; uiAmount: number } | null = null;
  if (gbuxMint) {
    const tokenBal = await getSplTokenBalance(address, gbuxMint.toBase58());
    gbux = { amount: tokenBal.amount, uiAmount: tokenBal.uiAmount };
  }

  return { address, solBalance: sol, gbuxBalance: gbux };
}

/** Get balances for all platform wallets at once. */
export async function getPlatformBalances(): Promise<{
  status: Awaited<ReturnType<typeof getWalletStatus>>;
  treasury: WalletBalanceResult | null;
  adminAI: WalletBalanceResult | null;
}> {
  const status = await getWalletStatus();
  let treasury: WalletBalanceResult | null = null;
  let adminAI: WalletBalanceResult | null = null;

  if (status.treasury.address) {
    treasury = await getWalletBalance(status.treasury.address);
  }
  if (status.adminAI.address) {
    adminAI = await getWalletBalance(status.adminAI.address);
  }

  return { status, treasury, adminAI };
}

// ── Transaction reads ────────────────────────────────────────────

/** List recent on-chain transactions for a platform wallet. */
export async function listOnChainTransactions(
  walletType: "treasury" | "adminAI",
  limit: number = 20,
) {
  const kp = walletType === "treasury" ? getTreasuryKeypair() : getAdminAIKeypair();
  if (!kp) throw new Error(`${walletType} wallet not configured`);
  return getRecentTransactions(kp.publicKey.toBase58(), limit);
}

/** List web3_transactions from DB for a user or globally. */
export async function listDBTransactions(
  userId?: number,
  limit: number = 50,
) {
  const where = userId ? eq(web3Transactions.userId, userId) : undefined;
  return db
    .select()
    .from(web3Transactions)
    .where(where)
    .orderBy(desc(web3Transactions.createdAt))
    .limit(limit);
}

// ── Logging ──────────────────────────────────────────────────────

/** Log a web3 transaction to the database. */
export async function logWeb3Transaction(data: {
  userId?: number;
  txSignature?: string;
  txType: string;
  amount?: string;
  tokenMint?: string;
  fromAddress?: string;
  toAddress?: string;
  status?: string;
  blockSlot?: number;
  errorMessage?: string;
  metadata?: any;
}) {
  const [row] = await db
    .insert(web3Transactions)
    .values({
      userId: data.userId || null,
      txSignature: data.txSignature || null,
      txType: data.txType,
      amount: data.amount || null,
      tokenMint: data.tokenMint || null,
      fromAddress: data.fromAddress || null,
      toAddress: data.toAddress || null,
      status: data.status || "pending",
      blockSlot: data.blockSlot || null,
      errorMessage: data.errorMessage || null,
      metadata: data.metadata || null,
    })
    .returning();

  return row;
}

/** Update a web3 transaction status after confirmation. */
export async function updateWeb3TransactionStatus(
  id: number,
  updates: { status: string; blockSlot?: number; errorMessage?: string; txSignature?: string },
) {
  const [row] = await db
    .update(web3Transactions)
    .set({
      ...updates,
      confirmedAt: updates.status === "confirmed" ? new Date() : undefined,
    })
    .where(eq(web3Transactions.id, id))
    .returning();

  return row;
}

// ── Reconciliation ───────────────────────────────────────────────

export interface ReconciliationResult {
  userId: number;
  username: string;
  grudgeId: string;
  solanaAddress: string;
  dbBalance: string;
  onChainBalance: number;
  drift: number; // positive = on-chain has more, negative = DB has more
}

/**
 * Compare on-chain GBUX balances vs DB gbuxBalance for all users
 * that have a solanaAddress set. Returns users with drift.
 */
export async function reconcileBalances(): Promise<ReconciliationResult[]> {
  const gbuxMint = getGBUXMint();
  if (!gbuxMint) return [];

  const usersWithWallet = await db
    .select({
      id: users.id,
      username: users.username,
      grudgeId: users.grudgeId,
      solanaAddress: users.solanaAddress,
      gbuxBalance: users.gbuxBalance,
    })
    .from(users)
    .where(
      // Only users that have a Solana address linked
      and(
        eq(users.solanaAddress, users.solanaAddress), // non-null filter via manual check below
      ),
    );

  const results: ReconciliationResult[] = [];

  for (const u of usersWithWallet) {
    if (!u.solanaAddress) continue;
    try {
      const onChain = await getSplTokenBalance(u.solanaAddress, gbuxMint.toBase58());
      const dbBal = parseFloat(u.gbuxBalance);
      const drift = onChain.uiAmount - dbBal;

      if (Math.abs(drift) > 0.001) {
        results.push({
          userId: u.id,
          username: u.username,
          grudgeId: u.grudgeId,
          solanaAddress: u.solanaAddress,
          dbBalance: u.gbuxBalance,
          onChainBalance: onChain.uiAmount,
          drift,
        });
      }
    } catch {
      // RPC error for this user, skip
    }
  }

  return results;
}

// ── Wallet connection management ─────────────────────────────────

export async function recordWalletConnection(
  userId: number,
  walletAddress: string,
  provider: string,
  chain: string = "solana",
) {
  const [row] = await db
    .insert(walletConnections)
    .values({ userId, walletAddress, provider, chain, isActive: true })
    .returning();
  return row;
}

export async function disconnectWallet(userId: number) {
  // Mark all active connections for this user as disconnected
  await db
    .update(walletConnections)
    .set({ isActive: false, disconnectedAt: new Date() })
    .where(and(eq(walletConnections.userId, userId), eq(walletConnections.isActive, true)));

  // Null out the user's solanaAddress
  await db
    .update(users)
    .set({ solanaAddress: null })
    .where(eq(users.id, userId));

  // Log the offboard event
  await logWeb3Transaction({
    userId,
    txType: "offboard",
    status: "confirmed",
    metadata: { reason: "user_disconnect" },
  });
}

export async function getActiveConnections(userId: number) {
  return db
    .select()
    .from(walletConnections)
    .where(and(eq(walletConnections.userId, userId), eq(walletConnections.isActive, true)));
}
