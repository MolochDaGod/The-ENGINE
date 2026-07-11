/**
 * Studio Features — Admin, Friends, Tournaments
 *
 * Mount in routes.ts: registerStudioFeatures(app)
 *
 * Admin uses existing passcode session cookie (gs_admin_session).
 * Friends + Tournaments use player session cookie (gs_player_session).
 */

import type { Express } from "express";
import { eq, or, and, desc, ilike, sql, count } from "drizzle-orm";
import { db } from "../db";
import { users, friends, tournaments, tournamentEntries, tournamentMatches } from "@shared/schema";
import { getPlayer, requirePlayer } from "../auth";
import { isUserOnline } from "../chat-presence";
import { dmRoomId } from "../treaty-chat";
import crypto from "crypto";

// ── Admin auth helper (matches routes.ts pattern) ────────────────

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
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function requireAdmin(req: any, res: any, next: any) {
  if (!verifyAdminSession(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Also accept player session with admin/master role
function requireAdminOrMasterPlayer(req: any, res: any, next: any) {
  // Try admin passcode session first
  if (verifyAdminSession(req)) return next();
  // Try player session with elevated role
  const player = getPlayer(req);
  if (player && (player.role === "admin" || player.role === "master")) return next();
  return res.status(401).json({ error: "Unauthorized — admin or master role required" });
}

export function registerStudioFeatures(app: Express) {

  // ═══════════════════════════════════════════════════════════════
  // ADMIN — User Management
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/admin/users", requireAdminOrMasterPlayer, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string) || "";
      const roleFilter = req.query.role as string;

      let where: any = undefined;
      const conditions: any[] = [];

      if (search) {
        conditions.push(
          or(
            ilike(users.username, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(users.grudgeId, `%${search}%`)
          )
        );
      }
      if (roleFilter) {
        conditions.push(eq(users.role, roleFilter));
      }
      if (conditions.length === 1) where = conditions[0];
      else if (conditions.length > 1) where = and(...conditions);

      const [total] = await db.select({ count: count() }).from(users).where(where);
      const userList = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          email: users.email,
          grudgeId: users.grudgeId,
          role: users.role,
          gbuxBalance: users.gbuxBalance,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({
        users: userList,
        pagination: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) },
      });
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/users/:id", requireAdminOrMasterPlayer, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdminOrMasterPlayer, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { role } = req.body;
      const validRoles = ["guest", "player", "member", "admin", "master"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Valid: ${validRoles.join(", ")}` });
      }
      const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ id: updated.id, username: updated.username, role: updated.role });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/stats", requireAdminOrMasterPlayer, async (_req, res) => {
    try {
      const [userCount] = await db.select({ count: count() }).from(users);
      const [activeCount] = await db
        .select({ count: count() })
        .from(users)
        .where(sql`${users.lastLoginAt} > NOW() - INTERVAL '24 hours'`);
      res.json({
        totalUsers: userCount.count,
        activeUsers24h: activeCount.count,
      });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // FRIENDS
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/friends/request", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const { userId, username } = req.body;

      let recipientId = userId ? parseInt(userId) : null;
      if (!recipientId && username) {
        const [found] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
        if (found) recipientId = found.id;
      }
      if (!recipientId) return res.status(400).json({ error: "userId or username required" });
      if (recipientId === player.id) return res.status(400).json({ error: "Cannot friend yourself" });

      // Check existing
      const [existing] = await db
        .select()
        .from(friends)
        .where(
          or(
            and(eq(friends.requesterId, player.id), eq(friends.recipientId, recipientId)),
            and(eq(friends.requesterId, recipientId), eq(friends.recipientId, player.id))
          )
        )
        .limit(1);

      if (existing) {
        if (existing.status === "blocked") return res.status(403).json({ error: "Blocked" });
        if (existing.status === "accepted") return res.json({ message: "Already friends" });
        return res.json({ message: "Request already pending" });
      }

      const [created] = await db
        .insert(friends)
        .values({ requesterId: player.id, recipientId })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      console.error("Friend request error:", error);
      res.status(500).json({ error: "Failed to send request" });
    }
  });

  app.post("/api/friends/:id/accept", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id);
      const [request] = await db.select().from(friends).where(eq(friends.id, id)).limit(1);
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.recipientId !== player.id) return res.status(403).json({ error: "Not your request" });
      if (request.status !== "pending") return res.status(400).json({ error: "Not pending" });

      const [updated] = await db
        .update(friends)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(friends.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept" });
    }
  });

  app.post("/api/friends/:id/block", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id);
      const [request] = await db.select().from(friends).where(eq(friends.id, id)).limit(1);
      if (!request) return res.status(404).json({ error: "Not found" });
      if (request.requesterId !== player.id && request.recipientId !== player.id) {
        return res.status(403).json({ error: "Not your relationship" });
      }

      const [updated] = await db
        .update(friends)
        .set({ status: "blocked", updatedAt: new Date() })
        .where(eq(friends.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to block" });
    }
  });

  app.delete("/api/friends/:id", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id);
      const [request] = await db.select().from(friends).where(eq(friends.id, id)).limit(1);
      if (!request) return res.status(404).json({ error: "Not found" });
      if (request.requesterId !== player.id && request.recipientId !== player.id) {
        return res.status(403).json({ error: "Not your relationship" });
      }

      await db.delete(friends).where(eq(friends.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove" });
    }
  });

  app.get("/api/friends", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const rows = await db
        .select({
          id: friends.id,
          requesterId: friends.requesterId,
          recipientId: friends.recipientId,
          status: friends.status,
          createdAt: friends.createdAt,
        })
        .from(friends)
        .where(
          and(
            or(eq(friends.requesterId, player.id), eq(friends.recipientId, player.id)),
            eq(friends.status, "accepted")
          )
        );

      // Resolve friend user details
      const friendIds = rows.map((r) =>
        r.requesterId === player.id ? r.recipientId : r.requesterId
      );

      if (friendIds.length === 0) return res.json([]);

      const friendUsers = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          grudgeId: users.grudgeId,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`);

      const result = rows.map((r) => {
        const friendId = r.requesterId === player.id ? r.recipientId : r.requesterId;
        const friendUser = friendUsers.find((u) => u.id === friendId);
        return {
          friendshipId: r.id,
          ...friendUser,
          // Live Treaty WS presence (not last_login guess)
          isOnline: isUserOnline(friendId),
          dmRoom: dmRoomId(player.id, friendId),
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Friends list error:", error);
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });

  app.get("/api/friends/pending", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const rows = await db
        .select()
        .from(friends)
        .where(and(eq(friends.recipientId, player.id), eq(friends.status, "pending")))
        .orderBy(desc(friends.createdAt));

      // Resolve requester details
      const requesterIds = rows.map((r) => r.requesterId);
      if (requesterIds.length === 0) return res.json([]);

      const requesters = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(requesterIds.map(id => sql`${id}`), sql`, `)})`);

      const result = rows.map((r) => ({
        id: r.id,
        from: requesters.find((u) => u.id === r.requesterId),
        createdAt: r.createdAt,
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // TOURNAMENTS
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/tournaments", async (req, res) => {
    try {
      const status = req.query.status as string;
      let where: any = undefined;
      if (status) where = eq(tournaments.status, status);

      const rows = await db
        .select()
        .from(tournaments)
        .where(where)
        .orderBy(desc(tournaments.createdAt))
        .limit(50);

      // Count entries per tournament
      const result = await Promise.all(
        rows.map(async (t) => {
          const [{ count: entryCount }] = await db
            .select({ count: count() })
            .from(tournamentEntries)
            .where(eq(tournamentEntries.tournamentId, t.id));
          return { ...t, entryCount };
        })
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });

      const entries = await db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, id));
      const matches = await db
        .select()
        .from(tournamentMatches)
        .where(eq(tournamentMatches.tournamentId, id))
        .orderBy(tournamentMatches.round, tournamentMatches.matchIndex);

      // Resolve player names
      const playerIds = [...new Set([
        ...entries.map((e) => e.userId),
        ...matches.filter((m) => m.player1Id).map((m) => m.player1Id!),
        ...matches.filter((m) => m.player2Id).map((m) => m.player2Id!),
      ])];

      let playerMap: Record<number, { username: string; displayName: string | null }> = {};
      if (playerIds.length > 0) {
        const players = await db
          .select({ id: users.id, username: users.username, displayName: users.displayName })
          .from(users)
          .where(sql`${users.id} IN (${sql.join(playerIds.map(id => sql`${id}`), sql`, `)})`);
        playerMap = Object.fromEntries(players.map((p) => [p.id, p]));
      }

      res.json({ tournament, entries, matches, players: playerMap });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tournament" });
    }
  });

  app.post("/api/tournaments", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const { name, gameId, format, maxPlayers, entryFee } = req.body;
      if (!name || !gameId) return res.status(400).json({ error: "name and gameId required" });

      const [created] = await db
        .insert(tournaments)
        .values({
          name,
          gameId: parseInt(gameId),
          format: format || "single_elimination",
          maxPlayers: parseInt(maxPlayers) || 8,
          entryFee: (parseFloat(entryFee) || 0).toFixed(4),
          prizePool: "0",
          createdById: player.id,
        })
        .returning();

      // Auto-join creator
      await db.insert(tournamentEntries).values({ tournamentId: created.id, userId: player.id, seed: 1 });

      res.status(201).json(created);
    } catch (error) {
      console.error("Tournament create error:", error);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  app.post("/api/tournaments/:id/join", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const tournamentId = parseInt(req.params.id);
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "open") return res.status(400).json({ error: "Tournament is not open" });

      // Check already joined
      const [existing] = await db
        .select()
        .from(tournamentEntries)
        .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.userId, player.id)))
        .limit(1);
      if (existing) return res.status(400).json({ error: "Already joined" });

      // Check capacity
      const [{ count: entryCount }] = await db
        .select({ count: count() })
        .from(tournamentEntries)
        .where(eq(tournamentEntries.tournamentId, tournamentId));
      if (entryCount >= tournament.maxPlayers) return res.status(400).json({ error: "Tournament is full" });

      const [entry] = await db
        .insert(tournamentEntries)
        .values({ tournamentId, userId: player.id, seed: entryCount + 1 })
        .returning();

      // Update prize pool
      const fee = parseFloat(tournament.entryFee);
      if (fee > 0) {
        const newPool = parseFloat(tournament.prizePool) + fee;
        await db.update(tournaments).set({ prizePool: newPool.toFixed(4) }).where(eq(tournaments.id, tournamentId));
      }

      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to join tournament" });
    }
  });

  // Start tournament — generates single-elimination bracket
  app.post("/api/tournaments/:id/start", requireAdminOrMasterPlayer, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "open") return res.status(400).json({ error: "Tournament already started" });

      const entries = await db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, tournamentId));
      if (entries.length < 2) return res.status(400).json({ error: "Need at least 2 players" });

      // Shuffle entries for random seeding
      const shuffled = [...entries].sort(() => Math.random() - 0.5);

      // Generate single-elimination bracket
      const numRounds = Math.ceil(Math.log2(shuffled.length));
      const bracketSize = Math.pow(2, numRounds);
      const matchesR1: { player1Id: number | null; player2Id: number | null; status: string }[] = [];

      for (let i = 0; i < bracketSize / 2; i++) {
        const p1 = shuffled[i * 2]?.userId ?? null;
        const p2 = shuffled[i * 2 + 1]?.userId ?? null;
        const isBye = p1 === null || p2 === null;
        matchesR1.push({
          player1Id: p1,
          player2Id: p2,
          status: isBye ? "bye" : "pending",
        });
      }

      // Insert round 1 matches
      for (let i = 0; i < matchesR1.length; i++) {
        const m = matchesR1[i];
        await db.insert(tournamentMatches).values({
          tournamentId,
          round: 1,
          matchIndex: i,
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          winnerId: m.status === "bye" ? (m.player1Id || m.player2Id) : null,
          status: m.status === "bye" ? "completed" : "pending",
          completedAt: m.status === "bye" ? new Date() : null,
        });
      }

      // Create placeholder matches for subsequent rounds
      let prevRoundSize = matchesR1.length;
      for (let round = 2; round <= numRounds; round++) {
        const thisRoundSize = prevRoundSize / 2;
        for (let i = 0; i < thisRoundSize; i++) {
          await db.insert(tournamentMatches).values({
            tournamentId,
            round,
            matchIndex: i,
            status: "pending",
          });
        }
        prevRoundSize = thisRoundSize;
      }

      await db.update(tournaments).set({ status: "active", startAt: new Date() }).where(eq(tournaments.id, tournamentId));

      res.json({ success: true, rounds: numRounds, matchesRound1: matchesR1.length });
    } catch (error) {
      console.error("Tournament start error:", error);
      res.status(500).json({ error: "Failed to start tournament" });
    }
  });

  // Report match result — advances winner to next round
  app.post("/api/tournaments/:tournamentId/matches/:matchId/result", requirePlayer, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      const matchId = parseInt(req.params.matchId);
      const { player1Score, player2Score } = req.body;

      const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId)).limit(1);
      if (!match || match.tournamentId !== tournamentId) return res.status(404).json({ error: "Match not found" });
      if (match.status !== "pending" && match.status !== "active") return res.status(400).json({ error: "Match not in progress" });

      const p1Score = parseInt(player1Score);
      const p2Score = parseInt(player2Score);
      const winnerId = p1Score >= p2Score ? match.player1Id : match.player2Id;

      await db
        .update(tournamentMatches)
        .set({ player1Score: p1Score, player2Score: p2Score, winnerId, status: "completed", completedAt: new Date() })
        .where(eq(tournamentMatches.id, matchId));

      // Advance winner to next round
      const nextRound = match.round + 1;
      const nextMatchIndex = Math.floor(match.matchIndex / 2);
      const isTopSlot = match.matchIndex % 2 === 0;

      const [nextMatch] = await db
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournamentId, tournamentId),
            eq(tournamentMatches.round, nextRound),
            eq(tournamentMatches.matchIndex, nextMatchIndex)
          )
        )
        .limit(1);

      if (nextMatch) {
        const update = isTopSlot ? { player1Id: winnerId } : { player2Id: winnerId };
        await db.update(tournamentMatches).set(update).where(eq(tournamentMatches.id, nextMatch.id));
      } else {
        // No next match = this was the final — set tournament winner
        await db
          .update(tournaments)
          .set({ winnerId, status: "completed", endedAt: new Date() })
          .where(eq(tournaments.id, tournamentId));
      }

      res.json({ success: true, winnerId, advancedToRound: nextMatch ? nextRound : null });
    } catch (error) {
      console.error("Match result error:", error);
      res.status(500).json({ error: "Failed to report result" });
    }
  });
}
