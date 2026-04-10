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

const WS_URL = import.meta.env.VITE_WS_URL || "https://ws.grudge-studio.com";
const API_BASE = "";  // same origin

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
    const resp = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
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
      headers: { "Content-Type": "application/json" },
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
    const resp = await fetch(`${API_BASE}/api/leaderboards/${gameId}/me`, { credentials: "include" });
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
      auth: player ? { grudgeId: player.grudgeId, username: player.username } : undefined,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
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
}

export function leaveGame(gameId: number) {
  if (engineSocket) {
    engineSocket.emit("engine:leave_game", { game_id: gameId });
  }
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
    const resp = await fetch(`${API_BASE}/api/challenges`, { credentials: "include" });
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
