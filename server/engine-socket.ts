/**
 * Socket.IO /engine namespace — presence + activity for engine-sdk.
 * Proxied via ws.grudge-studio.com → Railway (grudge-ws-api worker).
 */
import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

interface EngineSocketData {
  grudgeId?: string;
  username?: string;
  gameId?: number;
  gameTitle?: string;
}

const presence = new Map<string, { grudgeId: string; username: string; gameId?: number; gameTitle?: string }>();

function broadcastPresence(io: SocketIOServer) {
  const users = [...presence.values()];
  io.of("/engine").emit("engine:presence", { count: users.length, users });
}

export function setupEngineSocket(httpServer: HttpServer): void {
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (
          /^https:\/\/([a-z0-9-]+\.)*grudge-studio\.com$/.test(origin) ||
          origin.includes("grudgewarlords.com") ||
          origin.includes("vercel.app") ||
          origin.includes("puter.com") ||
          origin.includes("puter.site") ||
          origin.startsWith("http://localhost:")
        ) {
          return cb(null, true);
        }
        cb(null, false);
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  const engine = io.of("/engine");

  engine.on("connection", (socket) => {
    const auth = socket.handshake.auth as EngineSocketData;
    const grudgeId = auth?.grudgeId || `anon-${socket.id.slice(0, 8)}`;
    const username = auth?.username || "Guest";

    presence.set(socket.id, { grudgeId, username });
    broadcastPresence(io);

    socket.on("engine:join_game", (data: { gameId?: number; gameTitle?: string; game_id?: number; game_title?: string }) => {
      const entry = presence.get(socket.id);
      const gameId = data?.gameId ?? data?.game_id;
      const gameTitle = data?.gameTitle ?? data?.game_title;
      if (entry) {
        entry.gameId = gameId;
        entry.gameTitle = gameTitle;
        presence.set(socket.id, entry);
        broadcastPresence(io);
        engine.emit("engine:activity", {
          type: "join",
          grudgeId,
          username,
          gameId,
          gameTitle,
          ts: Date.now(),
        });
      }
    });

    socket.on("disconnect", () => {
      presence.delete(socket.id);
      broadcastPresence(io);
    });
  });

  console.log("[engine-socket] Socket.IO /engine namespace ready (path /socket.io)");
}