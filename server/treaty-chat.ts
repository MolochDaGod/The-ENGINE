/**
 * Treaty Chat — social layer for Grudge Studio.
 * Community channels, DMs (dm:min_max), and per-game rooms (game:slug).
 * Shared by WebSocket (/ws/chat) and HTTP (/api/treaty/*).
 */

import type { ChatMessage, User } from "@shared/schema";

export const TREATY_ROOMS = [
  { id: "general", name: "General", description: "Main lobby — say hi, find your crew", category: "community" },
  { id: "builds", name: "Builds", description: "Show builds, demos, and work-in-progress", category: "community" },
  { id: "help", name: "Help", description: "Get unstuck — ask the community", category: "community" },
  { id: "retro-gaming", name: "Retro", description: "NES, SNES, N64 & classic arcade talk", category: "play" },
  { id: "custom-engines", name: "Engines", description: "Wargus, Avernus, Tower Defense & Nexus", category: "play" },
  { id: "trading", name: "Trading", description: "GBUX, assets, and marketplace deals", category: "economy" },
] as const;

export type TreatyRoomId = (typeof TREATY_ROOMS)[number]["id"];
export type TreatyRoomKind = "community" | "dm" | "game";

export interface TreatySender {
  grudgeId: string | null;
  username: string;
  displayName: string;
}

export interface TreatyMessage {
  id: string;
  roomId: string;
  from: TreatySender;
  text: string;
  ts: string;
}

/** Stable DM room id for two user PKs (sorted). */
export function dmRoomId(userA: number, userB: number): string {
  const a = Math.floor(Number(userA));
  const b = Math.floor(Number(userB));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 || a === b) {
    throw new Error("Invalid DM participants");
  }
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `dm:${lo}_${hi}`;
}

export function parseDmRoom(room: string): { a: number; b: number } | null {
  const m = /^dm:(\d+)_(\d+)$/.exec(String(room || ""));
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return { a, b };
}

/** Per-game channel — all players in that game share this room. */
export function gameRoomId(gameKey: string | number): string {
  const slug = String(gameKey ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 48);
  return `game:${slug || "lobby"}`;
}

export function parseGameRoom(room: string): string | null {
  const m = /^game:([a-z0-9_-]{1,48})$/.exec(String(room || ""));
  return m ? m[1] : null;
}

export function roomKind(room: string): TreatyRoomKind {
  if (String(room).startsWith("dm:")) return "dm";
  if (String(room).startsWith("game:")) return "game";
  return "community";
}

/**
 * Normalize room ids. Preserves dm: and game: prefixes (previously stripped `:`).
 */
export function normalizeRoomId(id: string | undefined | null): string {
  const raw = String(id || "general").trim().toLowerCase();

  if (raw.startsWith("dm:")) {
    const rest = raw.slice(3).replace(/[^0-9_]/g, "");
    const m = /^(\d+)_(\d+)$/.exec(rest);
    if (!m) return "general";
    try {
      return dmRoomId(Number(m[1]), Number(m[2]));
    } catch {
      return "general";
    }
  }

  if (raw.startsWith("game:")) {
    return gameRoomId(raw.slice(5));
  }

  const s = raw.replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return s || "general";
}

/** Who may join / read / write a room. */
export function canAccessRoom(
  room: string,
  userId: number | null | undefined,
): { ok: boolean; reason?: string; kind: TreatyRoomKind } {
  const kind = roomKind(room);
  if (kind === "community" || kind === "game") return { ok: true, kind };

  if (userId == null) return { ok: false, reason: "Sign in with Grudge ID to use DMs", kind };
  const dm = parseDmRoom(room);
  if (!dm) return { ok: false, reason: "Invalid DM room", kind };
  if (userId !== dm.a && userId !== dm.b) {
    return { ok: false, reason: "This DM is private", kind };
  }
  return { ok: true, kind };
}

export function dmPeerId(room: string, selfId: number): number | null {
  const dm = parseDmRoom(room);
  if (!dm) return null;
  if (selfId === dm.a) return dm.b;
  if (selfId === dm.b) return dm.a;
  return null;
}

export function normalizeSender(body: Record<string, unknown> | undefined, player?: User | null): TreatySender {
  if (player) {
    return {
      grudgeId: player.grudgeId,
      username: player.username,
      displayName: player.displayName || player.username,
    };
  }
  const b = body || {};
  const username = String(b.username || b.user || "guest").trim().slice(0, 30) || "guest";
  const displayName = String(b.displayName || b.user || b.username || username).trim().slice(0, 30) || username;
  const grudgeId = String(b.grudgeId || b.uuid || b.fromUuid || "").trim() || null;
  return { grudgeId, username, displayName };
}

export function treatyFromPlayer(player: User): TreatySender {
  return normalizeSender(undefined, player);
}

export function treatyDisplayName(sender: TreatySender): string {
  return sender.displayName || sender.username;
}

export function toTreatyMessage(row: ChatMessage, grudgeId?: string | null): TreatyMessage {
  return {
    id: String(row.id),
    roomId: row.room,
    from: {
      grudgeId: grudgeId ?? null,
      username: row.username,
      displayName: row.username,
    },
    text: row.message,
    ts: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

export function toWsPayload(row: ChatMessage, grudgeId?: string | null) {
  return {
    type: "message" as const,
    id: row.id,
    grudgeId: grudgeId ?? null,
    username: row.username,
    displayName: row.username,
    message: row.message,
    room: row.room,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
  };
}

export function shareUrl(portalOrigin: string, roomId: string): string {
  const base = (portalOrigin || "https://grudge-studio.com").replace(/\/$/, "");
  return `${base}/chat?room=${encodeURIComponent(normalizeRoomId(roomId))}`;
}
