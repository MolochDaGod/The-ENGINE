/**
 * Discord Webhook Helper — The Engine
 *
 * Sends rich embeds to a Discord channel when:
 *   - A player beats their personal best
 *   - A new global record is set
 *   - A GBUX challenge is completed
 *   - Players are actively gaming (batched)
 *
 * Env var: DISCORD_ENGINE_WEBHOOK_URL
 */

const WEBHOOK_URL = process.env.DISCORD_ENGINE_WEBHOOK_URL || "";
const GRUDGE_COLOR = 0xDB6331;  // Grudge orange
const GOLD_COLOR   = 0xF0C060;  // Gold for records
const CRIMSON      = 0x8B0000;  // Challenge results

export enum DiscordEmbedType {
  PERSONAL_BEST   = "personal_best",
  GLOBAL_RECORD   = "global_record",
  CHALLENGE_RESULT = "challenge_result",
  NOW_PLAYING     = "now_playing",
}

interface PersonalBestData {
  username: string;
  gameTitle: string;
  score: number;
}

interface GlobalRecordData {
  username: string;
  gameTitle: string;
  score: number;
  thumbnailUrl?: string;
}

interface ChallengeResultData {
  winnerName: string;
  loserName: string;
  gameTitle: string;
  gbuxWager: number;
  winnerScore: number;
  loserScore: number;
}

interface NowPlayingData {
  playerCount: number;
  games: string[];
}

type WebhookData = PersonalBestData | GlobalRecordData | ChallengeResultData | NowPlayingData;

function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}

function buildEmbed(type: DiscordEmbedType, data: WebhookData) {
  switch (type) {
    case DiscordEmbedType.PERSONAL_BEST: {
      const d = data as PersonalBestData;
      return {
        embeds: [{
          color: GRUDGE_COLOR,
          title: "🏆 New Personal Best!",
          description: `**${d.username}** just beat their high score on **${d.gameTitle}**!`,
          fields: [
            { name: "Score", value: formatScore(d.score), inline: true },
          ],
          footer: { text: "The Engine · grudge-studio.com" },
          timestamp: new Date().toISOString(),
        }],
      };
    }

    case DiscordEmbedType.GLOBAL_RECORD: {
      const d = data as GlobalRecordData;
      return {
        embeds: [{
          color: GOLD_COLOR,
          title: "🔥 NEW WORLD RECORD! 🔥",
          description: `**${d.username}** just set a new global record on **${d.gameTitle}**!`,
          fields: [
            { name: "Score", value: `**${formatScore(d.score)}**`, inline: true },
          ],
          thumbnail: d.thumbnailUrl ? { url: d.thumbnailUrl } : undefined,
          footer: { text: "The Engine · grudge-studio.com" },
          timestamp: new Date().toISOString(),
        }],
      };
    }

    case DiscordEmbedType.CHALLENGE_RESULT: {
      const d = data as ChallengeResultData;
      return {
        embeds: [{
          color: CRIMSON,
          title: "⚔️ GBUX Challenge Complete!",
          description: `**${d.winnerName}** defeated **${d.loserName}** in a **${d.gameTitle}** challenge!`,
          fields: [
            { name: "Winner Score", value: formatScore(d.winnerScore), inline: true },
            { name: "Loser Score", value: formatScore(d.loserScore), inline: true },
            { name: "GBUX Won", value: `${d.gbuxWager.toFixed(2)} GBUX`, inline: true },
          ],
          footer: { text: "The Engine · GBUX Challenges" },
          timestamp: new Date().toISOString(),
        }],
      };
    }

    case DiscordEmbedType.NOW_PLAYING: {
      const d = data as NowPlayingData;
      return {
        embeds: [{
          color: GRUDGE_COLOR,
          title: "🎮 Active on The Engine",
          description: `**${d.playerCount}** player${d.playerCount !== 1 ? "s" : ""} playing right now!`,
          fields: [
            { name: "Games", value: d.games.slice(0, 5).join(", ") || "Various games" },
          ],
          footer: { text: "The Engine · grudge-studio.com" },
          timestamp: new Date().toISOString(),
        }],
      };
    }
  }
}

export async function sendDiscordWebhook(type: DiscordEmbedType, data: WebhookData): Promise<void> {
  if (!WEBHOOK_URL) {
    console.log(`[discord-webhook] No DISCORD_ENGINE_WEBHOOK_URL set — skipping ${type}`);
    return;
  }

  const payload = buildEmbed(type, data);
  if (!payload) return;

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[discord-webhook] ${type} failed: HTTP ${response.status}`);
    }
  } catch (err: any) {
    console.error(`[discord-webhook] ${type} error:`, err.message);
  }
}

// ── Batched "Now Playing" — avoids spam ────────────────────────
let nowPlayingTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingPlayers: Set<string> = new Set();
let pendingGames: Set<string> = new Set();

export function trackNowPlaying(username: string, gameTitle: string): void {
  pendingPlayers.add(username);
  pendingGames.add(gameTitle);

  // Batch: send at most once per 5 minutes
  if (!nowPlayingTimeout) {
    nowPlayingTimeout = setTimeout(() => {
      if (pendingPlayers.size > 0) {
        sendDiscordWebhook(DiscordEmbedType.NOW_PLAYING, {
          playerCount: pendingPlayers.size,
          games: Array.from(pendingGames),
        });
      }
      pendingPlayers.clear();
      pendingGames.clear();
      nowPlayingTimeout = null;
    }, 5 * 60 * 1000);
  }
}
