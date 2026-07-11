/**
 * In-memory Treaty Chat presence (WebSocket roster).
 * Shared by /ws/chat and HTTP /api/treaty/* so HTTP sends fan out to live sockets.
 * Not durable — presence dies with the process (Railway single instance).
 */

import { WebSocket } from "ws";

export type ChatClientInfo = {
  username: string;
  displayName: string;
  grudgeId: string | null;
  room: string;
  userId: number | null;
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

export function getRoomUsers(room: string): string[] {
  const users: string[] = [];
  for (const [client, info] of chatClients) {
    if (info.room === room && client.readyState === WebSocket.OPEN) {
      const label = (info.displayName || info.username || "Guest").trim();
      if (label) users.push(label);
    }
  }
  return [...new Set(users)];
}

/** Push presence to one socket + rest of room (joiner always gets a users list). */
export function pushPresence(room: string, to?: WebSocket) {
  const users = getRoomUsers(room);
  const payload = { type: "users" as const, room, users };
  if (to) sendChatJson(to, payload);
  broadcastChatToRoom(room, payload, to);
}
