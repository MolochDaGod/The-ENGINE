/**
 * /api/me/universe* — characters, decks, islands, game saves.
 */
import type { Express } from "express";
import { z } from "zod";
import { requirePlayer, getPlayer } from "./auth";
import * as universe from "./universe-store";
import { getPrefab } from "@shared/character-prefabs";
import { ISLAND_BIOMES, UNIVERSE_LAUNCH } from "@shared/universe-catalog";

const claimCharSchema = z.object({
  prefabId: z.string().min(2).max(64),
  displayName: z.string().min(1).max(40).optional(),
  setActive: z.boolean().optional(),
  loadout: z
    .object({
      primaryWeapon: z.string().optional(),
      secondaryWeapon: z.string().nullable().optional(),
    })
    .optional(),
});

const deckSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  tribe: z.string().max(40).optional(),
  cards: z
    .array(
      z.object({
        cardKey: z.string(),
        name: z.string(),
        qty: z.number().int().min(1).max(4),
        cost: z.number().optional(),
        attack: z.number().optional(),
        health: z.number().optional(),
        rarity: z.string().optional(),
        tribe: z.string().optional(),
      }),
    )
    .optional(),
  setActive: z.boolean().optional(),
});

const islandSchema = z.object({
  name: z.string().min(1).max(80),
  biome: z.string().max(32).optional(),
  isHome: z.boolean().optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
  progress: z.record(z.string(), z.unknown()).optional(),
});

const saveSchema = z.object({
  gameKey: z.string().min(1).max(64),
  slot: z.number().int().min(0).max(9).optional(),
  label: z.string().max(80).optional(),
  progress: z.record(z.string(), z.unknown()),
});

export function registerUniverseRoutes(app: Express): void {
  // Full universe snapshot + bootstrap starter content
  app.get("/api/me/universe", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const data = await universe.bootstrapUniverse(
        player.id,
        player.displayName || player.username,
      );
      return res.json({
        ...data,
        catalog: {
          biomes: ISLAND_BIOMES,
          launches: UNIVERSE_LAUNCH,
        },
      });
    } catch (error) {
      console.error("GET /api/me/universe", error);
      return res.status(500).json({ error: "Failed to load universe" });
    }
  });

  // ── Characters ──────────────────────────────────────────────
  app.get("/api/me/characters", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const rows = await universe.listCharacters(player.id);
      return res.json(rows);
    } catch (error) {
      console.error("GET /api/me/characters", error);
      return res.status(500).json({ error: "Failed to list characters" });
    }
  });

  app.post("/api/me/characters", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const body = claimCharSchema.parse(req.body);
      const prefab = getPrefab(body.prefabId);
      if (!prefab) return res.status(400).json({ error: "Unknown prefabId" });

      const row = await universe.claimCharacter(player.id, {
        prefabId: body.prefabId,
        displayName: body.displayName || prefab.name,
        stats: { ...prefab.baseStats },
        loadout: body.loadout ?? {
          primaryWeapon: "pistol",
          secondaryWeapon: "knife",
        },
        setActive: body.setActive,
      });
      return res.status(201).json(row);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ error: error.errors });
      if (error?.status === 409) return res.status(409).json({ error: error.message });
      console.error("POST /api/me/characters", error);
      return res.status(500).json({ error: "Failed to claim character" });
    }
  });

  app.patch("/api/me/characters/:id", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
      const { displayName, level, xp, stats, loadout, meta, isActive } = req.body ?? {};
      const row = await universe.updateCharacter(player.id, id, {
        ...(displayName !== undefined ? { displayName: String(displayName).slice(0, 40) } : {}),
        ...(level !== undefined ? { level: Number(level) } : {}),
        ...(xp !== undefined ? { xp: Number(xp) } : {}),
        ...(stats !== undefined ? { stats } : {}),
        ...(loadout !== undefined ? { loadout } : {}),
        ...(meta !== undefined ? { meta } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      });
      if (!row) return res.status(404).json({ error: "Character not found" });
      return res.json(row);
    } catch (error) {
      console.error("PATCH /api/me/characters/:id", error);
      return res.status(500).json({ error: "Failed to update character" });
    }
  });

  app.delete("/api/me/characters/:id", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id, 10);
      const ok = await universe.deleteCharacter(player.id, id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      return res.json({ ok: true });
    } catch (error) {
      console.error("DELETE /api/me/characters/:id", error);
      return res.status(500).json({ error: "Failed to delete character" });
    }
  });

  // ── Decks ───────────────────────────────────────────────────
  app.get("/api/me/decks", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      return res.json(await universe.listDecks(player.id));
    } catch (error) {
      console.error("GET /api/me/decks", error);
      return res.status(500).json({ error: "Failed to list decks" });
    }
  });

  app.post("/api/me/decks", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const body = deckSchema.parse(req.body);
      const row = await universe.createDeck(player.id, body);
      return res.status(201).json(row);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ error: error.errors });
      console.error("POST /api/me/decks", error);
      return res.status(500).json({ error: "Failed to create deck" });
    }
  });

  app.patch("/api/me/decks/:id", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id, 10);
      const body = req.body ?? {};
      const row = await universe.updateDeck(player.id, id, {
        name: body.name,
        description: body.description,
        tribe: body.tribe,
        cards: body.cards,
        isActive: body.isActive,
        meta: body.meta,
      });
      if (!row) return res.status(404).json({ error: "Deck not found" });
      return res.json(row);
    } catch (error) {
      console.error("PATCH /api/me/decks/:id", error);
      return res.status(500).json({ error: "Failed to update deck" });
    }
  });

  app.delete("/api/me/decks/:id", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id, 10);
      const ok = await universe.deleteDeck(player.id, id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      return res.json({ ok: true });
    } catch (error) {
      console.error("DELETE /api/me/decks/:id", error);
      return res.status(500).json({ error: "Failed to delete deck" });
    }
  });

  // ── Islands ─────────────────────────────────────────────────
  app.get("/api/me/islands", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      return res.json(await universe.listIslands(player.id));
    } catch (error) {
      console.error("GET /api/me/islands", error);
      return res.status(500).json({ error: "Failed to list islands" });
    }
  });

  app.post("/api/me/islands", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const body = islandSchema.parse(req.body);
      const row = await universe.createIsland(player.id, {
        name: body.name,
        biome: body.biome,
        isHome: body.isHome,
        layout: body.layout as any,
        progress: body.progress as any,
      });
      return res.status(201).json(row);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ error: error.errors });
      console.error("POST /api/me/islands", error);
      return res.status(500).json({ error: "Failed to create island" });
    }
  });

  app.patch("/api/me/islands/:id", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id, 10);
      const body = req.body ?? {};
      const row = await universe.updateIsland(player.id, id, {
        name: body.name,
        biome: body.biome,
        isHome: body.isHome,
        layout: body.layout,
        progress: body.progress,
        meta: body.meta,
      });
      if (!row) return res.status(404).json({ error: "Island not found" });
      return res.json(row);
    } catch (error) {
      console.error("PATCH /api/me/islands/:id", error);
      return res.status(500).json({ error: "Failed to update island" });
    }
  });

  app.delete("/api/me/islands/:id", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const id = parseInt(req.params.id, 10);
      const ok = await universe.deleteIsland(player.id, id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      return res.json({ ok: true });
    } catch (error) {
      console.error("DELETE /api/me/islands/:id", error);
      return res.status(500).json({ error: "Failed to delete island" });
    }
  });

  // ── Game saves ──────────────────────────────────────────────
  app.get("/api/me/saves", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const gameKey = typeof req.query.gameKey === "string" ? req.query.gameKey : undefined;
      return res.json(await universe.listGameSaves(player.id, gameKey));
    } catch (error) {
      console.error("GET /api/me/saves", error);
      return res.status(500).json({ error: "Failed to list saves" });
    }
  });

  app.put("/api/me/saves", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const body = saveSchema.parse(req.body);
      const row = await universe.upsertGameSave(player.id, body);
      return res.json(row);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ error: error.errors });
      console.error("PUT /api/me/saves", error);
      return res.status(500).json({ error: "Failed to save progress" });
    }
  });
}
