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

const DEFAULT_PLAY_SETTINGS = {
  graphics: { quality: "high" as const, shadows: true, particleDensity: 1, maxDpr: 1.5 },
  audio: { master: 0.8, music: 0.6, sfx: 0.85, muted: false },
  controls: { mouseSensitivity: 1, mouseInvertY: false, keybindPreset: "default" },
  forge: {
    lighting: "forge",
    camera: "orbit",
    toneMapping: "aces",
    exposure: 1.1,
    pixelRatio: 1.5,
    showGrid: true,
    fogEnabled: true,
    autoRotate: true,
    shadows: true,
  },
  accessibility: { reduceMotion: false, colorblindMode: null, subtitles: true },
};

function deepMergeSettings(base: any, patch: any): any {
  if (!patch || typeof patch !== "object") return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof (base as any)[k] === "object") {
      out[k] = deepMergeSettings((base as any)[k] ?? {}, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function registerUniverseRoutes(app: Express): void {
  // Cross-game play settings (graphics / audio / controls / forge)
  app.get("/api/me/play-settings", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const stored = (player as any).playSettings ?? {};
      const settings = deepMergeSettings(DEFAULT_PLAY_SETTINGS, stored);
      return res.json({ settings, defaults: DEFAULT_PLAY_SETTINGS });
    } catch (error) {
      console.error("GET /api/me/play-settings", error);
      return res.status(500).json({ error: "Failed to load play settings" });
    }
  });

  app.patch("/api/me/play-settings", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const body = req.body?.settings ?? req.body ?? {};
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ error: "settings object required" });
      }
      const current = (player as any).playSettings ?? {};
      const merged = deepMergeSettings(
        deepMergeSettings(DEFAULT_PLAY_SETTINGS, current),
        body,
      );
      merged.updatedAt = new Date().toISOString();
      const { storage } = await import("./storage");
      const updated = await storage.updateUser(player.id, { playSettings: merged } as any);
      return res.json({ settings: updated?.playSettings ?? merged });
    } catch (error) {
      console.error("PATCH /api/me/play-settings", error);
      return res.status(500).json({ error: "Failed to save play settings" });
    }
  });

  // Full universe snapshot — real data only (purge fakes; optional Nexus battledeck sync)
  app.get("/api/me/universe", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const { bearerFromRequest } = await import("./nexus-deck-sync");
      const nexusBearer =
        bearerFromRequest(req as any) ||
        (typeof req.headers["x-grudge-token"] === "string"
          ? req.headers["x-grudge-token"]
          : null);

      const data = await universe.bootstrapUniverse(
        player.id,
        player.displayName || player.username,
        { nexusBearer },
      );
      return res.json({
        ...data,
        catalog: {
          biomes: ISLAND_BIOMES,
          launches: UNIVERSE_LAUNCH,
        },
        policy: {
          noFakeData: true,
          decksSource: "grudgeplatform.io /api/user/battledeck (mirror only)",
          note: "Portal never invents cards. Build decks on grudgeplatform.io.",
        },
      });
    } catch (error) {
      console.error("GET /api/me/universe", error);
      return res.status(500).json({ error: "Failed to load universe" });
    }
  });

  // Explicit resync of real battle deck from Nexus
  app.post("/api/me/universe/sync-nexus-deck", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const { bearerFromRequest, fetchNexusBattleDeck } = await import("./nexus-deck-sync");
      const token =
        (typeof req.body?.token === "string" && req.body.token) ||
        bearerFromRequest(req as any);
      if (!token) {
        return res.status(401).json({
          error: "Need a fleet JWT (Bearer / grudge_token) accepted by grudgeplatform.io",
        });
      }
      const mirror = await fetchNexusBattleDeck(token);
      if (!mirror) {
        return res.status(404).json({
          error: "No battle deck on grudgeplatform — save 20 cards at /deck-builder first",
          origin: "https://grudgeplatform.io",
        });
      }
      const data = await universe.bootstrapUniverse(
        player.id,
        player.displayName || player.username,
        { nexusBearer: token },
      );
      return res.json({ ok: true, mirror, decks: data.decks, nexus: data.nexus });
    } catch (error) {
      console.error("POST /api/me/universe/sync-nexus-deck", error);
      return res.status(500).json({ error: "Nexus deck sync failed" });
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
