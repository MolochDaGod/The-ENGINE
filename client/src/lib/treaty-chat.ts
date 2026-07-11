/**
 * Treaty Chat client — Grudge ID identity + WebSocket transport.
 * Used by /chat and GrudgePanel Social tab.
 */

import { ENGINE_WS_ORIGIN } from "./api-config";
import type { PlayerProfile } from "./player-auth";

export type TreatyChannelCategory = "community" | "play" | "economy";

export interface TreatyChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TreatyChannelCategory;
  hue: number;
}

export const TREATY_CHANNELS: TreatyChannel[] = [
  { id: "general", name: "General", description: "Main lobby — say hi, find your crew", icon: "💬", category: "community", hue: 43 },
  { id: "builds", name: "Builds", description: "Show builds, demos, and work-in-progress", icon: "🔨", category: "community", hue: 280 },
  { id: "help", name: "Help", description: "Get unstuck — ask the community", icon: "🆘", category: "community", hue: 200 },
  { id: "retro-gaming", name: "Retro", description: "NES, SNES, N64 & classic arcade talk", icon: "🕹️", category: "play", hue: 120 },
  { id: "custom-engines", name: "Engines", description: "Wargus, Avernus, Tower Defense & Nexus", icon: "⚙️", category: "play", hue: 270 },
  { id: "trading", name: "Trading", description: "GBUX, assets, and marketplace deals", icon: "💰", category: "economy", hue: 35 },
];

/** @deprecated use TREATY_CHANNELS */
export const TREATY_ROOMS = TREATY_CHANNELS;

export type TreatyChannelId = (typeof TREATY_CHANNELS)[number]["id"];

export interface TreatyIdentity {
  grudgeId: string | null;
  username: string;
  displayName: string;
  isVerified: boolean;
}

export interface TreatyWsMessage {
  type: "message" | "system" | "users" | "joined" | "error";
  id?: number;
  grudgeId?: string | null;
  username?: string;
  displayName?: string;
  message?: string;
  room?: string;
  createdAt?: string;
  users?: string[];
  /** Server ack after join/switch */
  ok?: boolean;
}

const GUEST_NAME_KEY = "grudge_treaty_guest_name";

export function identityFromPlayer(player: PlayerProfile | null | undefined, guestName?: string): TreatyIdentity {
  if (player) {
    return {
      grudgeId: player.grudgeId ?? null,
      username: player.username || "player",
      displayName: player.displayName || player.username || "Player",
      isVerified: true,
    };
  }
  const name = guestName?.trim() || (typeof localStorage !== "undefined" ? localStorage.getItem(GUEST_NAME_KEY) : null) || "";
  return {
    grudgeId: null,
    username: name || "guest",
    displayName: name || "Guest",
    isVerified: false,
  };
}

export function persistGuestName(name: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(GUEST_NAME_KEY, name);
  }
}

/**
 * Resolve WebSocket URL for Treaty Chat.
 * Hits The-ENGINE process that owns `WebSocketServer({ path: "/ws/chat" })`.
 */
export function getTreatyWsUrl(): string {
  const env = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_ENGINE_WS_ORIGIN || "").trim().replace(/\/$/, "");

  if (env) {
    if (env.startsWith("wss://") || env.startsWith("ws://")) {
      return env.includes("/ws/chat") ? env : `${env}/ws/chat`;
    }
    if (env.startsWith("https://")) return `${env.replace(/^https:/, "wss:")}/ws/chat`;
    if (env.startsWith("http://")) return `${env.replace(/^http:/, "ws:")}/ws/chat`;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Local ENGINE dev — same host runs HTTP + WS
    if (host === "localhost" || host === "127.0.0.1") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws/chat`;
    }
  }

  // Production default: Railway The-ENGINE (same process as chat_messages + /ws/chat)
  const base = ENGINE_WS_ORIGIN.replace(/\/$/, "");
  if (base.startsWith("https://")) return `${base.replace(/^https:/, "wss:")}/ws/chat`;
  if (base.startsWith("http://")) return `${base.replace(/^http:/, "ws:")}/ws/chat`;
  return "wss://the-engine.up.railway.app/ws/chat";
}

export function buildJoinPayload(identity: TreatyIdentity, room: string) {
  return {
    type: "join" as const,
    username: identity.displayName || identity.username || "Guest",
    grudgeId: identity.grudgeId,
    room: room || "general",
  };
}

export function buildSwitchRoomPayload(room: string) {
  return {
    type: "switch_room" as const,
    room: room || "general",
  };
}

export function shareTreatyUrl(roomId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://grudge-studio.com";
  const url = new URL("/chat", origin);
  url.searchParams.set("room", roomId);
  return url.toString();
}

export function isValidChannelId(id: string | null): id is TreatyChannelId {
  return TREATY_CHANNELS.some((c) => c.id === id);
}

/** HTTP fallback — works when WebSocket path is down (Railway/edge) */
export async function fetchTreatyMessages(roomId: string): Promise<TreatyWsMessage[]> {
  const res = await fetch(`/api/treaty/room/${encodeURIComponent(roomId)}/messages`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.messages || []).map(
    (m: {
      id?: string | number;
      from?: TreatyIdentity;
      text?: string;
      message?: string;
      ts?: string;
      createdAt?: string;
      username?: string;
      displayName?: string;
      grudgeId?: string | null;
    }) => ({
      type: "message" as const,
      id: m.id != null ? Number(m.id) || undefined : undefined,
      grudgeId: m.from?.grudgeId ?? m.grudgeId ?? null,
      username: m.from?.username || m.username,
      displayName: m.from?.displayName || m.from?.username || m.displayName || m.username,
      message: m.text || m.message,
      createdAt: m.ts || m.createdAt,
    }),
  );
}

export async function sendTreatyHttp(
  roomId: string,
  text: string,
  identity: TreatyIdentity,
): Promise<{ ok: boolean; message?: unknown }> {
  const res = await fetch(`/api/treaty/room/${encodeURIComponent(roomId)}/send`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      message: text,
      grudgeId: identity.grudgeId,
      username: identity.username,
      displayName: identity.displayName,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
