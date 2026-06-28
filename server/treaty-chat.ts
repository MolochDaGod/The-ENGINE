/**
 * Treaty Chat — account-linked room chat (Grudge ID).
 * Shared by WebSocket (/ws/chat) and HTTP (/api/treaty/*) for GrudaNode parity.
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

export function normalizeRoomId(id: string | undefined | null): string {
  const s = String(id || "general").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return s || "general";
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