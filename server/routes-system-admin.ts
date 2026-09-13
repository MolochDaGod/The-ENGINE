/**
 * Admin System Development console APIs.
 * Auth: admin passcode session OR player role admin/master.
 */
import type { Express } from "express";
import { sql, desc, count, eq } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  playerCharacters,
  playerDecks,
  playerIslands,
  playerGameSaves,
  walletConnections,
} from "@shared/schema";
import { getPlayer } from "./auth";
import { ensureAccountSchema } from "./db-ensure";
import { getFleetHealth, getServiceRegistry } from "./fleet-health";
import { UNIVERSE_LAUNCH } from "@shared/universe-catalog";
import { buildCanonicalAudit, SYSTEM_CANONICAL } from "@shared/system-audit";
import crypto from "crypto";
import * as universe from "./universe-store";
import { getGBuxBalance, listPlayerAssets } from "./grudachain";

function verifyAdminSession(req: any): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret) return false;
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((s: string) => s.trim())
    .find((s: string) => s.startsWith("gs_admin_session="));
  if (!cookie) return false;
  const token = decodeURIComponent(cookie.split("=")[1]);
  const parts = token.split(".");
  if (parts.length < 3) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireSystemAdmin(req: any, res: any, next: any) {
  if (verifyAdminSession(req)) return next();
  const player = getPlayer(req);
  if (player && (player.role === "admin" || player.role === "master")) return next();
  return res.status(401).json({ error: "Unauthorized — admin session or master role required" });
}

async function tableStats() {
  const tables = [
    "users",
    "player_characters",
    "player_decks",
    "player_islands",
    "player_game_saves",
    "scores",
    "challenges",
    "friends",
    "wallet_connections",
  ];
  const out: Record<string, number | string> = {};
  for (const t of tables) {
    try {
      const r = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${t}`));
      const row = (r as any).rows?.[0] ?? (Array.isArray(r) ? (r as any)[0] : null);
      out[t] = Number(row?.n ?? 0);
    } catch (e: any) {
      out[t] = `ERR: ${e?.message || e}`;
    }
  }
  return out;
}

function publicUserRow(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    grudgeId: u.grudgeId,
    puterId: u.puterId,
    puterUsername: u.puterId ? (u.displayName || u.username) : null,
    email: u.email,
    phone: u.phone,
    discordId: u.discordId,
    solanaAddress: u.solanaAddress,
    githubId: u.githubId,
    googleId: u.googleId,
    gbuxBalance: u.gbuxBalance,
    role: u.role,
    avatarUrl: u.avatarUrl,
    needsProfile: u.needsProfile,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

async function loadUserDetail(user: typeof users.$inferSelect) {
  const [wallets, assets, universeSnap, gbux] = await Promise.all([
    db
      .select()
      .from(walletConnections)
      .where(eq(walletConnections.userId, user.id))
      .catch(() => [] as typeof walletConnections.$inferSelect[]),
    listPlayerAssets(user.grudgeId),
    universe.bootstrapUniverse(user.id, user.displayName || user.username).catch(() => null),
    getGBuxBalance(user.grudgeId, user.solanaAddress || undefined).catch(() => null),
  ]);

  return {
    user: publicUserRow(user),
    wallets: wallets.map((w) => ({
      id: w.id,
      address: w.walletAddress,
      provider: w.provider,
      chain: w.chain,
      isActive: w.isActive,
      connectedAt: w.connectedAt,
    })),
    assets,
    gbux,
    universe: universeSnap,
  };
}

async function columnCheck() {
  try {
    const r = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('recent_plays','play_settings','grudge_id','gbux_balance')
      ORDER BY column_name
    `);
    const rows = ((r as any).rows ?? r) as Array<{ column_name: string }>;
    return rows.map((x) => x.column_name);
  } catch (e: any) {
    return { error: e?.message };
  }
}

export function registerSystemAdminRoutes(app: Express): void {
  app.get("/api/admin/system", requireSystemAdmin, async (_req, res) => {
    try {
      const ensure = await ensureAccountSchema();
      const [tables, columns, health, recentUsers, universeCounts] = await Promise.all([
        tableStats(),
        columnCheck(),
        getFleetHealth().catch(() => null),
        db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            grudgeId: users.grudgeId,
            puterId: users.puterId,
            email: users.email,
            phone: users.phone,
            discordId: users.discordId,
            solanaAddress: users.solanaAddress,
            gbuxBalance: users.gbuxBalance,
            role: users.role,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(desc(users.lastLoginAt))
          .limit(50)
          .catch(() => [] as any[]),
        (async () => {
          try {
            const [[chars], [decks], [islands], [saves], [userCount]] = await Promise.all([
              db.select({ n: count() }).from(playerCharacters),
              db.select({ n: count() }).from(playerDecks),
              db.select({ n: count() }).from(playerIslands),
              db.select({ n: count() }).from(playerGameSaves),
              db.select({ n: count() }).from(users),
            ]);
            return {
              users: userCount?.n ?? 0,
              characters: chars?.n ?? 0,
              decks: decks?.n ?? 0,
              islands: islands?.n ?? 0,
              saves: saves?.n ?? 0,
            };
          } catch {
            return null;
          }
        })(),
      ]);

      const audit = buildCanonicalAudit();

      res.json({
        ok: true,
        ts: new Date().toISOString(),
        ensure,
        database: { tables, userColumns: columns, universeCounts },
        universeLaunches: UNIVERSE_LAUNCH,
        canonical: SYSTEM_CANONICAL,
        fleet: {
          audit,
          services: getServiceRegistry().length,
          healthSummary: health
            ? {
                checkedAt: (health as any).checkedAt,
                online: (health as any).online,
                degraded: (health as any).degraded,
                down: (health as any).down,
              }
            : null,
        },
        recentUsers,
        agentHints: {
          fleetSdk: "https://grudge-studio.com/embed/grudge-universe.js",
          hydrate: "GrudgeUniverse.hydrate() → player, universe, playSettings, activeCharacter/deck/island",
          playSettings: "GET/PATCH /api/me/play-settings",
          universe: "GET /api/me/universe",
          saves: "PUT /api/me/saves { gameKey, progress }",
          auth: "cookie gs_player_session OR Authorization: Bearer <session|launch JWT>",
          systemDevUi: "https://grudge-studio.com/system-dev",
        },
      });
    } catch (error) {
      console.error("GET /api/admin/system", error);
      res.status(500).json({ error: "Failed to load system status" });
    }
  });

  app.post("/api/admin/system/ensure-schema", requireSystemAdmin, async (_req, res) => {
    const result = await ensureAccountSchema();
    res.json(result);
  });

  app.get("/api/admin/system/user/:grudgeId", requireSystemAdmin, async (req, res) => {
    try {
      const key = req.params.grudgeId;
      const isNumeric = /^\d+$/.test(key);
      const [user] = await db
        .select()
        .from(users)
        .where(isNumeric ? eq(users.id, Number(key)) : eq(users.grudgeId, key))
        .limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });
      const detail = await loadUserDetail(user);
      res.json({
        ...detail,
        playSettings: user.playSettings,
        recentPlays: user.recentPlays,
      });
    } catch (error) {
      console.error("GET /api/admin/system/user", error);
      res.status(500).json({ error: "Failed to load user universe" });
    }
  });

  app.get("/api/admin/system/user/:grudgeId/assets", requireSystemAdmin, async (req, res) => {
    try {
      const key = req.params.grudgeId;
      const isNumeric = /^\d+$/.test(key);
      const [user] = await db
        .select({ grudgeId: users.grudgeId })
        .from(users)
        .where(isNumeric ? eq(users.id, Number(key)) : eq(users.grudgeId, key))
        .limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });
      const assets = await listPlayerAssets(user.grudgeId);
      res.json({ grudgeId: user.grudgeId, assets });
    } catch (error) {
      console.error("GET /api/admin/system/user/assets", error);
      res.status(500).json({ error: "Failed to list assets" });
    }
  });

  app.patch("/api/admin/system/user/:grudgeId/role", requireSystemAdmin, async (req, res) => {
    try {
      const key = req.params.grudgeId;
      const isNumeric = /^\d+$/.test(key);
      const { role } = req.body;
      const validRoles = ["guest", "player", "member", "admin", "master"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Valid: ${validRoles.join(", ")}` });
      }
      const [updated] = await db
        .update(users)
        .set({ role })
        .where(isNumeric ? eq(users.id, Number(key)) : eq(users.grudgeId, key))
        .returning();
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ id: updated.id, username: updated.username, role: updated.role });
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.post("/api/admin/system/bootstrap/:grudgeId", requireSystemAdmin, async (req, res) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.grudgeId, req.params.grudgeId))
        .limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });
      const snap = await universe.bootstrapUniverse(user.id, user.displayName || user.username);
      res.json({ ok: true, ...snap });
    } catch (error) {
      console.error("POST bootstrap", error);
      res.status(500).json({ error: "Bootstrap failed" });
    }
  });

  app.get("/api/admin/system/canonical-audit", requireSystemAdmin, async (_req, res) => {
    res.json(buildCanonicalAudit());
  });

  app.get("/api/admin/system/universe-counts", requireSystemAdmin, async (_req, res) => {
    try {
      const [[chars], [decks], [islands], [saves], [userCount]] = await Promise.all([
        db.select({ n: count() }).from(playerCharacters),
        db.select({ n: count() }).from(playerDecks),
        db.select({ n: count() }).from(playerIslands),
        db.select({ n: count() }).from(playerGameSaves),
        db.select({ n: count() }).from(users),
      ]);
      res.json({
        users: userCount?.n ?? 0,
        characters: chars?.n ?? 0,
        decks: decks?.n ?? 0,
        islands: islands?.n ?? 0,
        saves: saves?.n ?? 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "count failed" });
    }
  });
}
