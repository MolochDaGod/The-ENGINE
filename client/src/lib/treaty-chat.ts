/**
 * Treaty Chat client — Grudge ID identity + WebSocket transport.
 * Used by /chat and GrudgePanel Social tab.
 */

import { WS_URL } from "./api-config";
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
  type: "message" | "system" | "users";
  id?: number;
  grudgeId?: string | null;
  username?: string;
  displayName?: string;
  message?: string;
  room?: string;
  createdAt?: string;
  users?: string[];
}

const GUEST_NAME_KEY = "grudge_treaty_guest_name";

export function identityFromPlayer(player: PlayerProfile | null | undefined, guestName?: string): TreatyIdentity {
  if (player) {
    return {
      grudgeId: player.grudgeId,
      username: player.username,
      displayName: player.displayName || player.username,
      isVerified: true,
    };
  }
  const name = guestName?.trim() || localStorage.getItem(GUEST_NAME_KEY) || "";
  return {
    grudgeId: null,
    username: name || "guest",
    displayName: name || "Guest",
    isVerified: false,
  };
}

export function persistGuestName(name: string) {
  localStorage.setItem(GUEST_NAME_KEY, name);
}

export function getTreatyWsUrl(): string {
  const base = WS_URL.replace(/\/$/, "");
  if (base.startsWith("https://")) return `${base.replace(/^https:/, "wss:")}/ws/chat`;
  if (base.startsWith("http://")) return `${base.replace(/^http:/, "ws:")}/ws/chat`;
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/chat`;
  }
  return "wss://ws.grudge-studio.com/ws/chat";
}

export function buildJoinPayload(identity: TreatyIdentity, room: string) {
  return {
    type: "join" as const,
    username: identity.displayName || identity.username,
    grudgeId: identity.grudgeId,
    room,
  };
}

export function shareTreatyUrl(roomId: string): string {
  const url = new URL("/chat", window.location.origin);
  url.searchParams.set("room", roomId);
  return url.toString();
}

export function isValidChannelId(id: string | null): id is TreatyChannelId {
  return TREATY_CHANNELS.some((c) => c.id === id);
}

/** HTTP fallback — GrudaNode /api/treaty parity */
export async function fetchTreatyMessages(roomId: string): Promise<TreatyWsMessage[]> {
  const res = await fetch(`/api/treaty/room/${encodeURIComponent(roomId)}/messages`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.messages || []).map((m: { id: string; from: TreatyIdentity; text: string; ts: string }) => ({
    type: "message" as const,
    id: Number(m.id) || undefined,
    grudgeId: m.from?.grudgeId ?? null,
    username: m.from?.username,
    displayName: m.from?.displayName || m.from?.username,
    message: m.text,
    createdAt: m.ts,
  }));
}

export async function sendTreatyHttp(roomId: string, text: string, identity: TreatyIdentity) {
  const res = await fetch(`/api/treaty/room/${encodeURIComponent(roomId)}/send`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grudgeId: identity.grudgeId,
      username: identity.username,
      displayName: identity.displayName,
      text,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}