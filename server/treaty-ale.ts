/**
 * Ale — Treaty AI assistant.
 * Mention with @ale in any Treaty room (channels, DMs, game chats).
 * Powered by Legion AI cascade (hub → Puter → Anthropic → fallback).
 */

import { legionAI } from "./legion-ai";
import { storage } from "./storage";
import { broadcastChatToRoom, getRoomUsers } from "./chat-presence";
import { toWsPayload } from "./treaty-chat";

export const ALE_DISPLAY_NAME = "Ale";
export const ALE_USERNAME = "Ale";
/** Synthetic id for client badges — not a real player row */
export const ALE_GRUDGE_ID = "ale";

const MENTION_RE = /@ale\b/gi;
const COOLDOWN_MS = 2_500;
const MAX_REPLY = 800;
const ROOM_HISTORY = 8;

/** Per-user cooldown to avoid spam / cost blowups */
const lastCallByUser = new Map<string, number>();

export function mentionsAle(text: string): boolean {
  return MENTION_RE.test(text);
}

export function stripAleMention(text: string): string {
  const cleaned = text.replace(MENTION_RE, " ").replace(/\s+/g, " ").trim();
  return cleaned || "Hey Ale — what's good?";
}

export function withAleInRoster(users: string[]): string[] {
  const list = users.filter(Boolean);
  if (!list.some((u) => u.toLowerCase() === "ale")) {
    list.unshift(ALE_DISPLAY_NAME);
  }
  return list;
}

function cooldownKey(userId: number | null, username: string, room: string): string {
  return `${userId ?? username}:${room}`;
}

function underCooldown(key: string): boolean {
  const last = lastCallByUser.get(key) || 0;
  return Date.now() - last < COOLDOWN_MS;
}

function markCooldown(key: string) {
  lastCallByUser.set(key, Date.now());
  // prune old keys occasionally
  if (lastCallByUser.size > 500) {
    const cutoff = Date.now() - 60_000;
    for (const [k, t] of lastCallByUser) {
      if (t < cutoff) lastCallByUser.delete(k);
    }
  }
}

async function recentRoomContext(room: string): Promise<string> {
  try {
    const rows = await storage.listChatMessages(room, ROOM_HISTORY);
    // list is newest-first
    return rows
      .slice()
      .reverse()
      .filter((r) => r.username !== ALE_USERNAME)
      .map((r) => `${r.username}: ${r.message}`)
      .join("\n")
      .slice(0, 1500);
  } catch {
    return "";
  }
}

/**
 * If message mentions @ale, generate a reply and post it into the room.
 * Fire-and-forget from chat handlers — never blocks the user send path long.
 */
export async function maybeHandleAleMention(opts: {
  room: string;
  text: string;
  fromName: string;
  userId: number | null;
}): Promise<boolean> {
  const { room, text, fromName, userId } = opts;
  if (!mentionsAle(text)) return false;
  // Don't reply to ourselves
  if (fromName === ALE_DISPLAY_NAME || fromName === ALE_USERNAME) return false;

  const key = cooldownKey(userId, fromName, room);
  if (underCooldown(key)) {
    broadcastChatToRoom(room, {
      type: "system",
      message: "Ale is catching up — wait a moment before @ale again.",
      room,
    });
    return true;
  }
  markCooldown(key);

  const question = stripAleMention(text);
  const online = withAleInRoster(getRoomUsers(room)).join(", ");
  const history = await recentRoomContext(room);

  // Typing indicator (system line) so the room feels live
  broadcastChatToRoom(room, {
    type: "system",
    message: "Ale is thinking…",
    room,
  });

  let replyText: string;
  try {
    const result = await legionAI({
      task: "ale",
      prompt: [
        `Room: ${room}`,
        `Online now: ${online || "just you"}`,
        `Player ${fromName} said: ${question}`,
        history ? `Recent chat:\n${history}` : "",
        "Reply as Ale in 1–4 short sentences unless they need a list. Stay helpful and on-brand.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      maxTokens: 400,
      temperature: 0.75,
      context: { room, fromName, userId },
    });
    replyText = (result.text || "").trim().slice(0, MAX_REPLY);
    if (!replyText) {
      replyText = "I'm here — try asking again, or ping me with @ale and a clear question.";
    }
  } catch (err) {
    console.warn("[treaty-ale] AI failed", err);
    replyText =
      "My circuits hiccupped. Try @ale again in a sec — or check https://grudge-studio.com/chat.";
  }

  try {
    const saved = await storage.createChatMessage({
      username: ALE_DISPLAY_NAME,
      message: replyText,
      room,
      userId: null,
    });
    broadcastChatToRoom(room, {
      ...toWsPayload(saved, ALE_GRUDGE_ID),
      displayName: ALE_DISPLAY_NAME,
      username: ALE_USERNAME,
    });
  } catch (err) {
    console.warn("[treaty-ale] persist/broadcast failed", err);
    // Still try to surface the reply even if DB write fails
    broadcastChatToRoom(room, {
      type: "message",
      grudgeId: ALE_GRUDGE_ID,
      username: ALE_USERNAME,
      displayName: ALE_DISPLAY_NAME,
      message: replyText,
      room,
      createdAt: new Date().toISOString(),
    });
  }

  return true;
}
