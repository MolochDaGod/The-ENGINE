/**
 * Treaty Chat client — community channels, DMs, friends, per-game rooms.
 * Used by /chat, GrudgePanel Social tab, and game embeds via bootstrap.
 */

import { ENGINE_WS_ORIGIN, apiUrl } from "./api-config";
import type { PlayerProfile } from "./player-auth";

export type TreatyChannelCategory = "community" | "play" | "economy";
export type TreatyRoomKind = "community" | "dm" | "game";

export interface TreatyChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TreatyChannelCategory;
  hue: number;
}

export const TREATY_CHANNELS: TreatyChannel[] = [
  { id: "general", name: "General", description: "Main lobby — say hi, find your crew · try @ale", icon: "💬", category: "community", hue: 43 },
  { id: "builds", name: "Builds", description: "Show builds, demos, and work-in-progress", icon: "🔨", category: "community", hue: 280 },
  { id: "help", name: "Help", description: "Get unstuck — ask the community or @ale", icon: "🆘", category: "community", hue: 200 },
  { id: "retro-gaming", name: "Retro", description: "NES, SNES, N64 & classic arcade talk", icon: "🕹️", category: "play", hue: 120 },
  { id: "custom-engines", name: "Engines", description: "Wargus, Avernus, Tower Defense & Nexus", icon: "⚙️", category: "play", hue: 270 },
  { id: "trading", name: "Trading", description: "GBUX, assets, and marketplace deals", icon: "💰", category: "economy", hue: 35 },
];

/** Always-on Treaty AI — mention with @ale */
export const ALE_BOT = {
  name: "Ale",
  mention: "@ale",
  grudgeId: "ale",
} as const;

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
  type: "message" | "system" | "users" | "joined" | "error" | "dm_notify";
  id?: number;
  grudgeId?: string | null;
  username?: string;
  displayName?: string;
  message?: string;
  room?: string;
  kind?: TreatyRoomKind;
  createdAt?: string;
  users?: string[];
  ok?: boolean;
}

export interface TreatyFriend {
  friendshipId?: number;
  id: number;
  username?: string;
  displayName?: string;
  grudgeId?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  room?: string | null;
  gameKey?: string | null;
  dmRoom?: string;
}

export interface TreatyDmThread {
  room: string;
  lastMessage: string;
  lastAt: string | null;
  lastFrom: string;
  peer: {
    id: number;
    username: string;
    displayName: string;
    grudgeId?: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
  } | null;
}

export interface TreatyGameRoom {
  room: string;
  gameKey: string;
  gameTitle: string;
  online: number;
  users: string[];
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
  const name =
    guestName?.trim() ||
    (typeof localStorage !== "undefined" ? localStorage.getItem(GUEST_NAME_KEY) : null) ||
    "";
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

export function dmRoomId(userA: number, userB: number): string {
  const [lo, hi] = userA < userB ? [userA, userB] : [userB, userA];
  return `dm:${lo}_${hi}`;
}

export function gameRoomId(gameKey: string | number): string {
  const slug = String(gameKey ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 48);
  return `game:${slug || "lobby"}`;
}

export function roomKind(room: string): TreatyRoomKind {
  if (room.startsWith("dm:")) return "dm";
  if (room.startsWith("game:")) return "game";
  return "community";
}

export function isValidChannelId(id: string | null): id is TreatyChannelId {
  return TREATY_CHANNELS.some((c) => c.id === id);
}

/** Accept community ids, dm:*, game:* */
export function isValidRoomId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (isValidChannelId(id)) return true;
  if (/^dm:\d+_\d+$/.test(id)) return true;
  if (/^game:[a-z0-9_-]{1,48}$/.test(id)) return true;
  return false;
}

export function roomLabel(room: string): { icon: string; name: string; description: string } {
  const ch = TREATY_CHANNELS.find((c) => c.id === room);
  if (ch) return { icon: ch.icon, name: ch.name, description: ch.description };
  if (room.startsWith("dm:")) {
    return { icon: "✉️", name: "Direct message", description: "Private conversation" };
  }
  if (room.startsWith("game:")) {
    const key = room.slice(5);
    return {
      icon: "🎮",
      name: key.replace(/-/g, " "),
      description: "In-game Treaty channel",
    };
  }
  return { icon: "💬", name: room, description: "" };
}

export function getTreatyWsUrl(): string {
  const env = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_ENGINE_WS_ORIGIN || "")
    .trim()
    .replace(/\/$/, "");

  if (env) {
    if (env.startsWith("wss://") || env.startsWith("ws://")) {
      return env.includes("/ws/chat") ? env : `${env}/ws/chat`;
    }
    if (env.startsWith("https://")) return `${env.replace(/^https:/, "wss:")}/ws/chat`;
    if (env.startsWith("http://")) return `${env.replace(/^http:/, "ws:")}/ws/chat`;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws/chat`;
    }
  }

  const base = ENGINE_WS_ORIGIN.replace(/\/$/, "");
  if (base.startsWith("https://")) return `${base.replace(/^https:/, "wss:")}/ws/chat`;
  if (base.startsWith("http://")) return `${base.replace(/^http:/, "ws:")}/ws/chat`;
  return "wss://the-engine.up.railway.app/ws/chat";
}

export function buildJoinPayload(
  identity: TreatyIdentity,
  room: string,
  extra?: { gameTitle?: string },
) {
  return {
    type: "join" as const,
    username: identity.displayName || identity.username || "Guest",
    grudgeId: identity.grudgeId,
    room: room || "general",
    ...(extra?.gameTitle ? { gameTitle: extra.gameTitle } : {}),
  };
}

export function buildSwitchRoomPayload(room: string, extra?: { gameTitle?: string }) {
  return {
    type: "switch_room" as const,
    room: room || "general",
    ...(extra?.gameTitle ? { gameTitle: extra.gameTitle } : {}),
  };
}

export function shareTreatyUrl(roomId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://grudge-studio.com";
  const url = new URL("/chat", origin);
  url.searchParams.set("room", roomId);
  return url.toString();
}

export function normalizeTreatyMessage(m: {
  id?: string | number;
  from?: TreatyIdentity;
  text?: string;
  message?: string;
  ts?: string;
  createdAt?: string;
  username?: string;
  displayName?: string;
  grudgeId?: string | null;
  room?: string;
  roomId?: string;
}): TreatyWsMessage {
  return {
    type: "message",
    id: m.id != null ? Number(m.id) || undefined : undefined,
    grudgeId: m.from?.grudgeId ?? m.grudgeId ?? null,
    username: m.from?.username || m.username,
    displayName: m.from?.displayName || m.from?.username || m.displayName || m.username,
    message: m.text || m.message,
    room: m.room || m.roomId,
    createdAt: m.ts || m.createdAt,
  };
}

export async function fetchTreatyMessages(roomId: string): Promise<TreatyWsMessage[]> {
  const res = await fetch(apiUrl(`/api/treaty/room/${encodeURIComponent(roomId)}/messages`), {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const rows = Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [];
  return rows.map(normalizeTreatyMessage);
}

export async function sendTreatyHttp(
  roomId: string,
  text: string,
  identity: TreatyIdentity,
): Promise<{ ok: boolean; message?: unknown }> {
  const res = await fetch(apiUrl(`/api/treaty/room/${encodeURIComponent(roomId)}/send`), {
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
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 120)}` : ""}`);
  }
  return res.json();
}

export async function fetchTreatyFriends(): Promise<TreatyFriend[]> {
  const res = await fetch(apiUrl("/api/treaty/friends"), { credentials: "include" });
  if (!res.ok) {
    // fallback to legacy friends route
    const legacy = await fetch(apiUrl("/api/friends"), { credentials: "include" });
    if (!legacy.ok) return [];
    const data = await legacy.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.friends) ? data.friends : Array.isArray(data) ? data : [];
}

export async function fetchTreatyDms(): Promise<TreatyDmThread[]> {
  const res = await fetch(apiUrl("/api/treaty/dms"), { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.dms) ? data.dms : [];
}

export async function openTreatyDm(peer: {
  userId?: number;
  username?: string;
  grudgeId?: string;
}): Promise<{ room: string; peer: TreatyFriend; areFriends?: boolean } | null> {
  const res = await fetch(apiUrl("/api/treaty/dm"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(peer),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.room ? data : null;
}

export async function fetchActiveGameRooms(): Promise<TreatyGameRoom[]> {
  const res = await fetch(apiUrl("/api/treaty/games"), { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.games) ? data.games : [];
}

export async function requestFriend(usernameOrId: { username?: string; userId?: number }) {
  const res = await fetch(apiUrl("/api/friends/request"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(usernameOrId),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function acceptFriend(requestId: number) {
  const res = await fetch(apiUrl(`/api/friends/${requestId}/accept`), {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchPendingFriends(): Promise<
  Array<{ id: number; from?: { username?: string; displayName?: string }; createdAt?: string }>
> {
  const res = await fetch(apiUrl("/api/friends/pending"), { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}
