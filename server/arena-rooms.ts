import type { Server } from "http";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { HEROES, type HeroId, type GameMode } from "@shared/mage-arena-types";

type ArenaRoomState = "lobby" | "active" | "ended";

interface ArenaClient {
  ws: WebSocket;
  pid: string;
  rid: string;
  hid: HeroId;
  name: string;
  mode: GameMode;
  x: number;
  y: number;
  ang: number;
  hp: number;
  mp: number;
  alive: boolean;
  kills: number;
  deaths: number;
  shielded: boolean;
  stoneHardened: boolean;
  isHost: boolean;
}

interface ArenaRoom {
  id: string;
  mode: GameMode;
  state: ArenaRoomState;
  maxPlayers: number;
  clients: Set<WebSocket>;
}

const arenaClients = new Map<WebSocket, ArenaClient>();
const arenaRooms = new Map<string, ArenaRoom>();

function roomClients(roomId: string): ArenaClient[] {
  const room = arenaRooms.get(roomId);
  if (!room) return [];

  const clients: ArenaClient[] = [];
  for (const ws of Array.from(room.clients)) {
    const client = arenaClients.get(ws);
    if (client && ws.readyState === WebSocket.OPEN) {
      clients.push(client);
    }
  }
  return clients;
}

function broadcast(roomId: string, payload: object, except?: WebSocket) {
  const data = JSON.stringify(payload);
  for (const client of roomClients(roomId)) {
    if (client.ws !== except) {
      client.ws.send(data);
    }
  }
}

function toPlayer(client: ArenaClient) {
  const hero = HEROES[client.hid];
  return {
    id: client.pid,
    name: client.name,
    heroId: client.hid,
    x: client.x,
    y: client.y,
    angle: client.ang,
    health: client.hp,
    maxHealth: hero.maxHealth,
    mana: client.mp,
    maxMana: hero.maxMana,
    alive: client.alive,
    kills: client.kills,
    deaths: client.deaths,
    shielded: client.shielded,
    stoneHardened: client.stoneHardened,
    isHost: client.isHost,
  };
}

function deleteClient(client: ArenaClient) {
  const room = arenaRooms.get(client.rid);
  if (!room) {
    arenaClients.delete(client.ws);
    return;
  }

  room.clients.delete(client.ws);
  arenaClients.delete(client.ws);
  broadcast(client.rid, { t: "pleave", pid: client.pid });

  const remaining = roomClients(client.rid);
  if (remaining.length === 0) {
    arenaRooms.delete(room.id);
    return;
  }

  if (!remaining.some((c) => c.isHost)) {
    remaining[0].isHost = true;
  }
}

export function setupArenaRooms(server: Server) {
  const arenaWss = new WebSocketServer({ server, path: "/ws/arena" });

  arenaWss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const existingClient = arenaClients.get(ws);

        if (msg.t === "join") {
          const requestedMode = (msg.mode || "pvp") as GameMode;
          const mode: GameMode = requestedMode === "pve" || requestedMode === "solo" ? requestedMode : "pvp";
          const hid = (msg.hid || "death_mage") as HeroId;
          const heroId: HeroId = HEROES[hid] ? hid : "death_mage";
          const requestedRoom = typeof msg.rid === "string" ? msg.rid.trim().slice(0, 12).toUpperCase() : "";
          const roomId = requestedRoom || crypto.randomBytes(3).toString("hex").toUpperCase();

          if (!arenaRooms.has(roomId)) {
            arenaRooms.set(roomId, {
              id: roomId,
              mode,
              state: "lobby",
              maxPlayers: mode === "solo" ? 1 : 4,
              clients: new Set(),
            });
          }

          const room = arenaRooms.get(roomId)!;
          if (room.clients.size >= room.maxPlayers) {
            ws.send(JSON.stringify({ t: "err", msg: "Room full" }));
            return;
          }

          const hero = HEROES[heroId];
          const pid = crypto.randomBytes(5).toString("hex");
          const isHost = room.clients.size === 0;

          const client: ArenaClient = {
            ws,
            pid,
            rid: roomId,
            hid: heroId,
            name: (msg.name || "Stranger").slice(0, 24),
            mode,
            x: 480 + (room.clients.size * 30),
            y: 320 + (room.clients.size * 20),
            ang: 0,
            hp: hero.maxHealth,
            mp: hero.maxMana,
            alive: true,
            kills: 0,
            deaths: 0,
            shielded: false,
            stoneHardened: false,
            isHost,
          };

          room.clients.add(ws);
          arenaClients.set(ws, client);

          const players = roomClients(roomId)
            .filter((c) => c.pid !== pid)
            .map(toPlayer);

          ws.send(JSON.stringify({
            t: "joined",
            pid,
            rid: roomId,
            players,
            isHost,
          }));

          broadcast(roomId, { t: "pjoin", p: toPlayer(client) }, ws);
          return;
        }

        if (!existingClient) return;

        if (msg.t === "state") {
          existingClient.x = Number(msg.x ?? existingClient.x);
          existingClient.y = Number(msg.y ?? existingClient.y);
          existingClient.ang = Number(msg.ang ?? existingClient.ang);
          existingClient.hp = Number(msg.hp ?? existingClient.hp);
          existingClient.mp = Number(msg.mp ?? existingClient.mp);
          existingClient.alive = existingClient.hp > 0;
          existingClient.shielded = Boolean(msg.sh);

          broadcast(existingClient.rid, {
            t: "pstate",
            players: [{
              id: existingClient.pid,
              x: existingClient.x,
              y: existingClient.y,
              angle: existingClient.ang,
              health: existingClient.hp,
              mana: existingClient.mp,
              shielded: existingClient.shielded,
              stoneHardened: existingClient.stoneHardened,
              alive: existingClient.alive,
              kills: existingClient.kills,
              deaths: existingClient.deaths,
            }],
          }, ws);
          return;
        }

        if (msg.t === "cast") {
          broadcast(existingClient.rid, {
            t: "cast",
            pid: existingClient.pid,
            qi: msg.qi,
            tx: msg.tx,
            ty: msg.ty,
          }, ws);
          return;
        }

        if (msg.t === "enemies" && existingClient.isHost) {
          broadcast(existingClient.rid, { t: "enemies", list: msg.list || [] }, ws);
          return;
        }

        if (msg.t === "start" && existingClient.isHost) {
          const room = arenaRooms.get(existingClient.rid);
          if (room) room.state = "active";
          broadcast(existingClient.rid, { t: "started" });
          return;
        }

        if (msg.t === "dead") {
          existingClient.alive = false;
          existingClient.deaths += 1;
          existingClient.kills = Number(msg.kills ?? existingClient.kills);

          const room = arenaRooms.get(existingClient.rid);
          if (room?.mode === "pvp" && room.state === "active") {
            const alive = roomClients(existingClient.rid).filter((c) => c.alive);
            if (alive.length <= 1) {
              room.state = "ended";
              broadcast(existingClient.rid, {
                t: "ended",
                wid: alive[0]?.pid,
                reason: "last_standing",
              });
            }
          }
          return;
        }

        if (msg.t === "leave") {
          deleteClient(existingClient);
        }
      } catch {
        ws.send(JSON.stringify({ t: "err", msg: "Invalid arena message" }));
      }
    });

    ws.on("close", () => {
      const client = arenaClients.get(ws);
      if (client) {
        deleteClient(client);
      }
    });
  });
}
