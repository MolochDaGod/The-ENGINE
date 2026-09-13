/**
 * Single upgrade dispatcher for raw WebSocket paths.
 *
 * Multiple `new WebSocketServer({ server, path })` on the same HTTP server
 * corrupt frames (RSV1 / "Invalid WebSocket frame") — each attaches its own
 * upgrade listener and races. Use noServer + this router instead.
 *
 * Socket.IO keeps its own /socket.io upgrade handler; we only claim our paths.
 */

import type { Server, IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocketServer, type ServerOptions } from "ws";

const hubs = new Map<string, WebSocketServer>();
let attached: Server | null = null;

export function createPathWss(
  path: string,
  options: Omit<ServerOptions, "server" | "noServer" | "path"> = {},
): WebSocketServer {
  if (hubs.has(path)) {
    throw new Error(`[ws-upgrade] path already registered: ${path}`);
  }
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    ...options,
  });
  hubs.set(path, wss);
  return wss;
}

export function attachWsUpgrade(httpServer: Server) {
  if (attached === httpServer) return;
  if (attached) {
    console.warn("[ws-upgrade] re-attaching to a different HTTP server");
  }
  attached = httpServer;

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let pathname = "/";
    try {
      pathname = new URL(req.url || "/", "http://localhost").pathname;
    } catch {
      return;
    }

    const wss = hubs.get(pathname);
    if (!wss) {
      // Not ours — leave socket alone so Socket.IO / other handlers can claim it
      return;
    }

    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch (err) {
      console.warn("[ws-upgrade] handleUpgrade failed", pathname, err);
      try {
        socket.destroy();
      } catch {
        /* */
      }
    }
  });
}
