/**
 * Unified account universe persistence — characters, decks, islands, game saves.
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  playerCharacters,
  playerDecks,
  playerIslands,
  playerGameSaves,
  type PlayerCharacter,
  type PlayerDeck,
  type PlayerIsland,
  type PlayerGameSave,
} from "@shared/schema";
import {
  STARTER_NEXUS_DECK,
  countDeckCards,
  isDeckValid,
  defaultHomeIsland,
} from "@shared/universe-catalog";

export async function listCharacters(userId: number): Promise<PlayerCharacter[]> {
  return db
    .select()
    .from(playerCharacters)
    .where(eq(playerCharacters.userId, userId))
    .orderBy(desc(playerCharacters.isActive), desc(playerCharacters.updatedAt));
}

export async function claimCharacter(
  userId: number,
  input: {
    prefabId: string;
    displayName: string;
    stats?: Record<string, number>;
    loadout?: PlayerCharacter["loadout"];
    setActive?: boolean;
  },
): Promise<PlayerCharacter> {
  const existing = await db
    .select()
    .from(playerCharacters)
    .where(and(eq(playerCharacters.userId, userId), eq(playerCharacters.prefabId, input.prefabId)))
    .limit(1);
  if (existing[0]) {
    throw Object.assign(new Error("Character already claimed"), { status: 409 });
  }

  const countRows = await db
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(playerCharacters)
    .where(eq(playerCharacters.userId, userId));
  const isFirst = (countRows[0]?.c ?? 0) === 0;
  const setActive = input.setActive ?? isFirst;

  if (setActive) {
    await db
      .update(playerCharacters)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(playerCharacters.userId, userId));
  }

  const [row] = await db
    .insert(playerCharacters)
    .values({
      userId,
      prefabId: input.prefabId,
      displayName: input.displayName.slice(0, 40),
      isActive: setActive,
      stats: input.stats ?? {},
      loadout: input.loadout ?? {},
      level: 1,
      xp: 0,
    })
    .returning();
  return row;
}

export async function updateCharacter(
  userId: number,
  id: number,
  updates: Partial<Pick<PlayerCharacter, "displayName" | "level" | "xp" | "stats" | "loadout" | "meta" | "isActive">>,
): Promise<PlayerCharacter | undefined> {
  if (updates.isActive === true) {
    await db
      .update(playerCharacters)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(playerCharacters.userId, userId));
  }
  const [row] = await db
    .update(playerCharacters)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(playerCharacters.id, id), eq(playerCharacters.userId, userId)))
    .returning();
  return row;
}

export async function deleteCharacter(userId: number, id: number): Promise<boolean> {
  const rows = await db
    .delete(playerCharacters)
    .where(and(eq(playerCharacters.id, id), eq(playerCharacters.userId, userId)))
    .returning({ id: playerCharacters.id });
  return rows.length > 0;
}

export async function listDecks(userId: number): Promise<PlayerDeck[]> {
  return db
    .select()
    .from(playerDecks)
    .where(eq(playerDecks.userId, userId))
    .orderBy(desc(playerDecks.isActive), desc(playerDecks.updatedAt));
}

export async function createDeck(
  userId: number,
  input: {
    name: string;
    description?: string;
    tribe?: string;
    cards?: PlayerDeck["cards"];
    setActive?: boolean;
  },
): Promise<PlayerDeck> {
  const cards = input.cards ?? [];
  const totalCards = countDeckCards(cards);
  const setActive = input.setActive ?? false;
  if (setActive) {
    await db
      .update(playerDecks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(playerDecks.userId, userId));
  }
  const [row] = await db
    .insert(playerDecks)
    .values({
      userId,
      name: input.name.slice(0, 80),
      description: input.description?.slice(0, 400) ?? null,
      tribe: input.tribe ?? null,
      cards,
      totalCards,
      isValid: isDeckValid(cards),
      isActive: setActive,
    })
    .returning();
  return row;
}

export async function updateDeck(
  userId: number,
  id: number,
  updates: {
    name?: string;
    description?: string | null;
    tribe?: string | null;
    cards?: PlayerDeck["cards"];
    isActive?: boolean;
    meta?: Record<string, unknown>;
  },
): Promise<PlayerDeck | undefined> {
  if (updates.isActive === true) {
    await db
      .update(playerDecks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(playerDecks.userId, userId));
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) patch.name = updates.name.slice(0, 80);
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.tribe !== undefined) patch.tribe = updates.tribe;
  if (updates.meta !== undefined) patch.meta = updates.meta;
  if (updates.isActive !== undefined) patch.isActive = updates.isActive;
  if (updates.cards !== undefined) {
    patch.cards = updates.cards;
    patch.totalCards = countDeckCards(updates.cards);
    patch.isValid = isDeckValid(updates.cards);
  }
  const [row] = await db
    .update(playerDecks)
    .set(patch)
    .where(and(eq(playerDecks.id, id), eq(playerDecks.userId, userId)))
    .returning();
  return row;
}

export async function deleteDeck(userId: number, id: number): Promise<boolean> {
  const rows = await db
    .delete(playerDecks)
    .where(and(eq(playerDecks.id, id), eq(playerDecks.userId, userId)))
    .returning({ id: playerDecks.id });
  return rows.length > 0;
}

export async function listIslands(userId: number): Promise<PlayerIsland[]> {
  return db
    .select()
    .from(playerIslands)
    .where(eq(playerIslands.userId, userId))
    .orderBy(desc(playerIslands.isHome), desc(playerIslands.updatedAt));
}

export async function createIsland(
  userId: number,
  input: {
    name: string;
    biome?: string;
    isHome?: boolean;
    layout?: PlayerIsland["layout"];
    progress?: PlayerIsland["progress"];
  },
): Promise<PlayerIsland> {
  if (input.isHome) {
    await db
      .update(playerIslands)
      .set({ isHome: false, updatedAt: new Date() })
      .where(eq(playerIslands.userId, userId));
  }
  const [row] = await db
    .insert(playerIslands)
    .values({
      userId,
      name: input.name.slice(0, 80),
      biome: input.biome ?? "tropical",
      isHome: input.isHome ?? false,
      layout: input.layout ?? {},
      progress: input.progress ?? {},
    })
    .returning();
  return row;
}

export async function updateIsland(
  userId: number,
  id: number,
  updates: Partial<Pick<PlayerIsland, "name" | "biome" | "isHome" | "layout" | "progress" | "meta">>,
): Promise<PlayerIsland | undefined> {
  if (updates.isHome === true) {
    await db
      .update(playerIslands)
      .set({ isHome: false, updatedAt: new Date() })
      .where(eq(playerIslands.userId, userId));
  }
  const [row] = await db
    .update(playerIslands)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(playerIslands.id, id), eq(playerIslands.userId, userId)))
    .returning();
  return row;
}

export async function deleteIsland(userId: number, id: number): Promise<boolean> {
  const rows = await db
    .delete(playerIslands)
    .where(and(eq(playerIslands.id, id), eq(playerIslands.userId, userId)))
    .returning({ id: playerIslands.id });
  return rows.length > 0;
}

export async function listGameSaves(userId: number, gameKey?: string): Promise<PlayerGameSave[]> {
  if (gameKey) {
    return db
      .select()
      .from(playerGameSaves)
      .where(and(eq(playerGameSaves.userId, userId), eq(playerGameSaves.gameKey, gameKey)))
      .orderBy(playerGameSaves.slot);
  }
  return db
    .select()
    .from(playerGameSaves)
    .where(eq(playerGameSaves.userId, userId))
    .orderBy(desc(playerGameSaves.updatedAt));
}

export async function upsertGameSave(
  userId: number,
  input: {
    gameKey: string;
    slot?: number;
    label?: string;
    progress: Record<string, unknown>;
  },
): Promise<PlayerGameSave> {
  const slot = input.slot ?? 0;
  const existing = await db
    .select()
    .from(playerGameSaves)
    .where(
      and(
        eq(playerGameSaves.userId, userId),
        eq(playerGameSaves.gameKey, input.gameKey),
        eq(playerGameSaves.slot, slot),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(playerGameSaves)
      .set({
        label: input.label ?? existing[0].label,
        progress: input.progress,
        updatedAt: new Date(),
      })
      .where(eq(playerGameSaves.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(playerGameSaves)
    .values({
      userId,
      gameKey: input.gameKey,
      slot,
      label: input.label ?? null,
      progress: input.progress,
    })
    .returning();
  return row;
}

/** Ensure starter deck + home island exist for a player (idempotent). */
export async function bootstrapUniverse(
  userId: number,
  displayName: string,
): Promise<{
  characters: PlayerCharacter[];
  decks: PlayerDeck[];
  islands: PlayerIsland[];
  saves: PlayerGameSave[];
  bootstrapped: { deck: boolean; island: boolean };
}> {
  const bootstrapped = { deck: false, island: false };
  let decks = await listDecks(userId);
  if (decks.length === 0) {
    const deck = await createDeck(userId, {
      name: STARTER_NEXUS_DECK.name,
      description: STARTER_NEXUS_DECK.description,
      tribe: STARTER_NEXUS_DECK.tribe,
      cards: STARTER_NEXUS_DECK.cards,
      setActive: true,
    });
    decks = [deck];
    bootstrapped.deck = true;
  }

  let islands = await listIslands(userId);
  if (islands.length === 0) {
    const home = defaultHomeIsland(displayName || "Warlord");
    const island = await createIsland(userId, home);
    islands = [island];
    bootstrapped.island = true;
  }

  const [characters, saves] = await Promise.all([
    listCharacters(userId),
    listGameSaves(userId),
  ]);

  return { characters, decks, islands, saves, bootstrapped };
}
