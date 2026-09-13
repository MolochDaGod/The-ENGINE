/**
 * In-memory Treaty presence (WebSocket roster).
 * Community / DM / game rooms share one Map — presence is not durable.
 */

import { WebSocket } from "ws";
import { parseGameRoom, roomKind } from "./treaty-chat";

export type ChatClientInfo = {
  username: string;
  displayName: string;
  grudgeId: string | null;
  room: string;
  userId: number | null;
  /** Human title when room is game:* */
  gameTitle?: string | null;
};

export const chatClients = new Map<WebSocket, ChatClientInfo>();

export function sendChatJson(ws: WebSocket, data: object) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(data));
  } catch (err) {
    console.warn("[ws/chat] send failed", err);
  }
}

export function broadcastChatToRoom(room: string, data: object, except?: WebSocket) {
  const msg = JSON.stringify(data);
  for (const [client, info] of chatClients) {
    if (info.room === room && client.readyState === WebSocket.OPEN && client !== except) {
      try {
        client.send(msg);
      } catch {
        /* drop */
      }
    }
  }
}

/** Push a private payload to every open socket owned by userId (all their tabs). */
export function sendToUserId(userId: number, data: object) {
  for (const [client, info] of chatClients) {
    if (info.userId === userId && client.readyState === WebSocket.OPEN) {
      sendChatJson(client, data);
    }
  }
}

export function getRoomUsers(room: string): string[] {
  const users: string[] = [];
  for (const [client, info] of chatClients) {
    if (info.room === room && client.readyState === WebSocket.OPEN) {
      const label = (info.displayName || info.username || "Guest").trim();
      if (label) users.push(label);
    }
  }
  // Ale is always active on Treaty — show in every live room roster
  const unique = [...new Set(users)];
  if (!unique.some((u) => u.toLowerCase() === "ale")) {
    unique.unshift("Ale");
  }
  return unique;
}

export function pushPresence(room: string, to?: WebSocket) {
  const users = getRoomUsers(room);
  const payload = { type: "users" as const, room, users };
  if (to) sendChatJson(to, payload);
  broadcastChatToRoom(room, payload, to);
}

export function isUserOnline(userId: number): boolean {
  if (!userId) return false;
  for (const [client, info] of chatClients) {
    if (info.userId === userId && client.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

export function getOnlinePresence(): Array<{
  userId: number;
  displayName: string;
  grudgeId: string | null;
  room: string;
  gameKey: string | null;
}> {
  const byUser = new Map<number, {
    userId: number;
    displayName: string;
    grudgeId: string | null;
    room: string;
    gameKey: string | null;
  }>();
  for (const [client, info] of chatClients) {
    if (!info.userId || client.readyState !== WebSocket.OPEN) continue;
    if (byUser.has(info.userId)) continue;
    byUser.set(info.userId, {
      userId: info.userId,
      displayName: info.displayName || info.username,
      grudgeId: info.grudgeId,
      room: info.room,
      gameKey: parseGameRoom(info.room),
    });
  }
  return [...byUser.values()];
}

export function listActiveGameRooms(): Array<{
  room: string;
  gameKey: string;
  gameTitle: string;
  online: number;
  users: string[];
}> {
  const map = new Map<string, { title: string; users: Set<string> }>();
  for (const [client, info] of chatClients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (roomKind(info.room) !== "game") continue;
    const key = parseGameRoom(info.room);
    if (!key) continue;
    let entry = map.get(info.room);
    if (!entry) {
      entry = {
        title: info.gameTitle || key.replace(/-/g, " "),
        users: new Set(),
      };
      map.set(info.room, entry);
    }
    if (info.gameTitle) entry.title = info.gameTitle;
    const label = (info.displayName || info.username || "").trim();
    if (label) entry.users.add(label);
  }
  return [...map.entries()]
    .map(([room, v]) => ({
      room,
      gameKey: parseGameRoom(room) || room,
      gameTitle: v.title,
      online: v.users.size,
      users: [...v.users],
    }))
    .sort((a, b) => b.online - a.online);
}
