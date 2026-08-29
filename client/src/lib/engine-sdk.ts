/**
 * The Engine SDK — Client-side integration
 *
 * Provides:
 *  - Emulator score injection via postMessage
 *  - Socket.IO connection to ws.grudge-studio.com/engine
 *  - Score submission to /api/scores (cookie-authenticated)
 *  - Leaderboard fetch from /api/leaderboards/:gameId
 *  - Challenge interaction
 *  - Presence tracking
 */

import { WS_URL, apiUrl } from "./api-config";
import { fleetAuthHeaders } from "./player-auth";
import {
  getTreatyWsUrl,
  gameRoomId,
  buildJoinPayload,
  buildSwitchRoomPayload,
  identityFromPlayer,
} from "./treaty-chat";

const API_BASE = "";  // same origin on portal; apiUrl() used where needed

// ── Auth helpers (cookie-based, same session as /api/auth/*) ──
interface CachedPlayer {
  id: number;
  username: string;
  grudgeId: string;
  displayName: string | null;
}

let _cachedPlayer: CachedPlayer | null | undefined = undefined; // undefined = not checked yet

/** Resolves the current player from the session cookie via /api/auth/me.
 *  Caches the result until clearPlayerCache() is called. */
async function resolvePlayer(): Promise<CachedPlayer | null> {
  if (_cachedPlayer !== undefined) return _cachedPlayer;
  try {
    const resp = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
      headers: fleetAuthHeaders(),
    });
    if (!resp.ok) { _cachedPlayer = null; return null; }
    const data = await resp.json();
    _cachedPlayer = { id: data.id, username: data.username, grudgeId: data.grudgeId, displayName: data.displayName };
    return _cachedPlayer;
  } catch {
    _cachedPlayer = null;
    return null;
  }
}

/** Call after login/logout to force re-fetch on next SDK call. */
export function clearPlayerCache() { _cachedPlayer = undefined; }

// ── Score submission ──────────────────────────────────────────
export async function submitScore(
  gameId: number,
  score: number,
): Promise<{ isPersonalBest: boolean; isGlobalRecord: boolean } | null> {
  const player = await resolvePlayer();
  if (!player) {
    console.log("[engine-sdk] Not authenticated — score not submitted");
    return null;
  }

  try {
    const resp = await fetch(`${API_BASE}/api/scores`, {
      method: "POST",
      credentials: "include",
      headers: fleetAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ gameId, score }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err: any) {
    console.error("[engine-sdk] Score submit failed:", err.message);
    return null;
  }
}

// ── Fetch leaderboard ─────────────────────────────────────────
export async function fetchLeaderboard(gameId: number, limit: number = 10) {
  try {
    const resp = await fetch(`${API_BASE}/api/leaderboards/${gameId}?limit=${limit}`);
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

// ── Fetch personal best ───────────────────────────────────────
export async function fetchPersonalBest(gameId: number) {
  try {
    const resp = await fetch(`${API_BASE}/api/leaderboards/${gameId}/me`, {
      credentials: "include",
      headers: fleetAuthHeaders(),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.score ?? null;
  } catch {
    return null;
  }
}

// ── Emulator score interception via postMessage ───────────────
// The emulator iframe can post score data when a game ends or when
// the player pauses. This listens for those messages.
//
// Expected message format from emulator:
//   { type: "grudge:score", score: number, metadata?: object }
//   { type: "grudge:game_end", score: number, metadata?: object }
//
// EmulatorJS also fires internal events we can intercept.

let scoreListenerActive = false;

export function startScoreListener(
  gameId: number,
  onScore?: (data: { score: number; isPersonalBest: boolean; isGlobalRecord: boolean }) => void
) {
  if (scoreListenerActive) return;
  scoreListenerActive = true;

  const handler = async (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "grudge:score" || data.type === "grudge:game_end") {
      const score = Number(data.score);
      if (!isFinite(score) || score <= 0) return;

      const result = await submitScore(gameId, score);
      if (result && onScore) {
        onScore({ score, isPersonalBest: result.isPersonalBest, isGlobalRecord: result.isGlobalRecord });
      }
    }
  };

  window.addEventListener("message", handler);

  return () => {
    window.removeEventListener("message", handler);
    scoreListenerActive = false;
  };
}

// ── Socket.IO presence (lazy loaded) ──────────────────────────
let engineSocket: any = null;
let presenceCallbacks: Array<(data: any) => void> = [];
let activityCallbacks: Array<(data: any) => void> = [];

export async function connectEngine() {
  if (engineSocket) return engineSocket;

  try {
    // Dynamically import socket.io-client to avoid bundling if not needed
    const { io } = await import("socket.io-client");
    const player = await resolvePlayer();

    engineSocket = io(`${WS_URL}/engine`, {
      path: "/socket.io",
      auth: player ? { grudgeId: player.grudgeId, username: player.username } : undefined,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      withCredentials: true,
    });

    engineSocket.on("engine:presence", (data: any) => {
      presenceCallbacks.forEach((cb) => cb(data));
    });

    engineSocket.on("engine:activity", (data: any) => {
      activityCallbacks.forEach((cb) => cb(data));
    });

    engineSocket.on("engine:score_event", (data: any) => {
      activityCallbacks.forEach((cb) => cb({ type: "score", ...data }));
    });

    engineSocket.on("engine:challenge", (data: any) => {
      activityCallbacks.forEach((cb) => cb({ type: "challenge", ...data }));
    });

    return engineSocket;
  } catch (err: any) {
    console.warn("[engine-sdk] Socket.IO connect failed:", err.message);
    return null;
  }
}

export function joinGame(gameId: number, gameTitle: string) {
  if (engineSocket) {
    engineSocket.emit("engine:join_game", { game_id: gameId, game_title: gameTitle });
  }
  // Also join Treaty per-game chat room (community social layer)
  void joinTreatyGameChat(gameId, gameTitle);
}

export function leaveGame(gameId: number) {
  if (engineSocket) {
    engineSocket.emit("engine:leave_game", { game_id: gameId });
  }
  leaveTreatyGameChat();
}

// ── Treaty game chat (raw WS /ws/chat room game:{id}) ─────────
let treatyWs: WebSocket | null = null;
let treatyRoom: string | null = null;
const treatyMessageCbs: Array<(data: unknown) => void> = [];

/** Connect / switch into a per-game Treaty room so all fleet games share chat. */
export async function joinTreatyGameChat(gameKey: string | number, gameTitle?: string) {
  const room = gameRoomId(gameKey);
  treatyRoom = room;
  const player = await resolvePlayer();
  const identity = identityFromPlayer(
    player
      ? ({
          grudgeId: player.grudgeId,
          username: player.username,
          displayName: player.displayName || player.username,
        } as any)
      : null,
  );

  if (treatyWs && treatyWs.readyState === WebSocket.OPEN) {
    treatyWs.send(JSON.stringify(buildSwitchRoomPayload(room, { gameTitle })));
    return treatyWs;
  }

  try {
    const ws = new WebSocket(getTreatyWsUrl());
    treatyWs = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify(buildJoinPayload(identity, room, { gameTitle })));
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "message" || data.type === "system") {
          treatyMessageCbs.forEach((cb) => cb(data));
        }
      } catch {
        /* */
      }
    };
    ws.onclose = () => {
      if (treatyWs === ws) treatyWs = null;
    };
    return ws;
  } catch (err: any) {
    console.warn("[engine-sdk] Treaty chat connect failed:", err?.message);
    return null;
  }
}

export function leaveTreatyGameChat() {
  try {
    treatyWs?.close();
  } catch {
    /* */
  }
  treatyWs = null;
  treatyRoom = null;
}

export function sendTreatyGameMessage(text: string): boolean {
  if (!treatyWs || treatyWs.readyState !== WebSocket.OPEN) return false;
  const msg = text.trim().slice(0, 500);
  if (!msg) return false;
  try {
    treatyWs.send(JSON.stringify({ type: "message", message: msg }));
    return true;
  } catch {
    return false;
  }
}

export function onTreatyGameMessage(cb: (data: unknown) => void) {
  treatyMessageCbs.push(cb);
  return () => {
    const i = treatyMessageCbs.indexOf(cb);
    if (i >= 0) treatyMessageCbs.splice(i, 1);
  };
}

export function getTreatyGameRoom() {
  return treatyRoom;
}

export function onPresenceUpdate(callback: (data: { game_id: string; game_title: string; player_count: number }) => void) {
  presenceCallbacks.push(callback);
  return () => {
    presenceCallbacks = presenceCallbacks.filter((cb) => cb !== callback);
  };
}

export function onActivity(callback: (data: any) => void) {
  activityCallbacks.push(callback);
  return () => {
    activityCallbacks = activityCallbacks.filter((cb) => cb !== callback);
  };
}

// ── Challenge helpers ─────────────────────────────────────────
export async function fetchOpenChallenges() {
  try {
    const resp = await fetch(`${API_BASE}/api/challenges`, {
      credentials: "include",
      headers: fleetAuthHeaders(),
    });
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

export async function createChallenge(
  gameId: number,
  gbuxWager: number,
  opponentId: number,
) {
  const player = await resolvePlayer();
  if (!player) return null;

  try {
    const resp = await fetch(`${API_BASE}/api/challenges`, {
      method: "POST",
      credentials: "include",
      headers: fleetAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ opponentId, gameId, gbuxWager }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function acceptChallenge(challengeId: number) {
  try {
    const resp = await fetch(`${API_BASE}/api/challenges/${challengeId}/accept`, {
      method: "POST",
      credentials: "include",
      headers: fleetAuthHeaders({ "Content-Type": "application/json" }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
