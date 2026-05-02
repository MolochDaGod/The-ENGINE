/**
 * Reward Worker — autonomous GBUX economy engine
 *
 * Hooks into score and challenge result events to automatically
 * distribute GBUX rewards. Batches on-chain mints every 60s to
 * reduce RPC load. Falls back to DB-only rewards if Solana is down.
 *
 * Reward rules (configurable):
 *   - Score submitted:   1 GBUX
 *   - Personal best:    10 GBUX
 *   - Global record:   100 GBUX
 *   - Challenge win:    wager amount (already handled in routes)
 *   - First game play:   5 GBUX (welcome bonus)
 */

import { db } from "../db";
import { users, transactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logWeb3Transaction, updateWeb3TransactionStatus } from "./admin-wallet";
import { getGBUXMint } from "./solana-client";
import { sendDiscordWebhook, DiscordEmbedType } from "../discord-webhooks";

// ── Reward configuration ─────────────────────────────────────────

export const REWARD_RULES = {
  SCORE_SUBMIT: 1,       // any score submitted
  PERSONAL_BEST: 10,     // beat your own record
  GLOBAL_RECORD: 100,    // beat the global record
  FIRST_PLAY: 5,         // first score on any game
  CHALLENGE_WIN_BONUS: 5, // bonus on top of wager payout
} as const;

// ── Pending reward queue (batched for on-chain efficiency) ───────

interface PendingReward {
  userId: number;
  amount: number;
  reason: string;
  gameId?: number;
  scoreId?: number;
  web3TxId?: number; // ID in web3_transactions table
}

const pendingRewards: PendingReward[] = [];
let batchTimer: ReturnType<typeof setInterval> | null = null;

// ── Core reward function ─────────────────────────────────────────

/**
 * Queue a GBUX reward for a player. Immediately updates the DB balance;
 * on-chain mint is batched every 60s.
 */
export async function queueReward(params: {
  userId: number;
  amount: number;
  reason: string;
  gameId?: number;
  scoreId?: number;
}): Promise<void> {
  const { userId, amount, reason, gameId, scoreId } = params;
  if (amount <= 0) return;

  // 1. Update DB balance immediately (players see it right away)
  const [user] = await db
    .select({ id: users.id, gbuxBalance: users.gbuxBalance })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return;

  const newBalance = parseFloat(user.gbuxBalance) + amount;
  await db
    .update(users)
    .set({ gbuxBalance: newBalance.toFixed(4) })
    .where(eq(users.id, userId));

  // 2. Log the GBUX transaction in the standard transactions table
  await db.insert(transactions).values({
    userId,
    type: "reward",
    amount: amount.toFixed(4),
    balanceAfter: newBalance.toFixed(4),
    referenceType: scoreId ? "score" : "challenge",
    referenceId: scoreId || gameId || null,
    description: reason,
  });

  // 3. Log to web3_transactions (pending on-chain mint)
  const gbuxMint = getGBUXMint();
  const web3Tx = await logWeb3Transaction({
    userId,
    txType: "reward",
    amount: amount.toFixed(4),
    tokenMint: gbuxMint?.toBase58() || "GBUX_DB_ONLY",
    status: gbuxMint ? "queued" : "confirmed", // queued if we have a mint, confirmed if DB-only
    metadata: { reason, gameId, scoreId },
  });

  // 4. Add to batch queue for on-chain processing
  if (gbuxMint && web3Tx) {
    pendingRewards.push({
      userId,
      amount,
      reason,
      gameId,
      scoreId,
      web3TxId: web3Tx.id,
    });
  }
}

// ── Score event handler (called from routes.ts) ──────────────────

/**
 * Called after a score is submitted. Calculates and queues GBUX rewards.
 */
export async function onScoreSubmitted(params: {
  userId: number;
  gameId: number;
  score: number;
  scoreId: number;
  isPersonalBest: boolean;
  isGlobalRecord: boolean;
  username: string;
  gameTitle: string;
}): Promise<{ totalReward: number }> {
  const { userId, gameId, score, scoreId, isPersonalBest, isGlobalRecord, username, gameTitle } = params;
  let totalReward = 0;

  // Base reward for any score
  totalReward += REWARD_RULES.SCORE_SUBMIT;
  await queueReward({
    userId,
    amount: REWARD_RULES.SCORE_SUBMIT,
    reason: `Score submitted: ${score} on ${gameTitle}`,
    gameId,
    scoreId,
  });

  // Personal best bonus
  if (isPersonalBest) {
    totalReward += REWARD_RULES.PERSONAL_BEST;
    await queueReward({
      userId,
      amount: REWARD_RULES.PERSONAL_BEST,
      reason: `Personal best: ${score} on ${gameTitle}`,
      gameId,
      scoreId,
    });
  }

  // Global record bonus
  if (isGlobalRecord) {
    totalReward += REWARD_RULES.GLOBAL_RECORD;
    await queueReward({
      userId,
      amount: REWARD_RULES.GLOBAL_RECORD,
      reason: `🏆 Global record: ${score} on ${gameTitle}`,
      gameId,
      scoreId,
    });

    // Discord announcement for global records with GBUX reward
    try {
      sendDiscordWebhook(DiscordEmbedType.GLOBAL_RECORD, {
        username,
        gameTitle,
        score,
      });
    } catch { /* non-critical */ }
  }

  return { totalReward };
}

// ── Batch processor (runs every 60s) ─────────────────────────────

async function processBatch() {
  if (pendingRewards.length === 0) return;

  const batch = pendingRewards.splice(0, pendingRewards.length);
  console.log(`[reward-worker] Processing batch of ${batch.length} rewards`);

  // TODO: When GBUX smart contract is deployed, this is where we:
  // 1. Build a batch mint transaction (one tx with multiple mint instructions)
  // 2. Sign with ADMIN_AI_WALLET_KEY
  // 3. Send to Solana
  // 4. Update web3_transactions with tx signature + confirmed status
  //
  // For now, rewards are DB-only. Mark them as confirmed since DB was already updated.
  for (const reward of batch) {
    if (reward.web3TxId) {
      try {
        await updateWeb3TransactionStatus(reward.web3TxId, {
          status: "confirmed",
          // txSignature will be set when we have the actual on-chain mint
        });
      } catch (err) {
        console.error(`[reward-worker] Failed to update tx ${reward.web3TxId}:`, err);
      }
    }
  }
}

// ── Lifecycle ────────────────────────────────────────────────────

const BATCH_INTERVAL_MS = 60_000; // 60 seconds

export function startRewardWorker() {
  if (batchTimer) return;
  console.log("[reward-worker] Started — batching rewards every 60s");
  batchTimer = setInterval(processBatch, BATCH_INTERVAL_MS);
}

export function stopRewardWorker() {
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
    console.log("[reward-worker] Stopped");
  }
  // Flush remaining
  processBatch();
}

/** Get current queue status (for admin dashboard). */
export function getRewardQueueStatus() {
  return {
    pendingCount: pendingRewards.length,
    isRunning: !!batchTimer,
    rules: REWARD_RULES,
  };
}
