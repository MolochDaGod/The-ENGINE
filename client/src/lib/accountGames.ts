/**
 * Account game catalog — fleet (new), retro, and combined launch helpers.
 */

import { FLEET_REGISTRY, getFleetEntry, type FleetRegistryEntry } from "@/data/fleetRegistry";

export type AccountGameCategory = "fleet" | "retro" | "all";

export interface AccountGamePlay {
  gameKey: string;
  category: "fleet" | "retro";
  title: string;
  lastPlayedAt: string;
  playCount: number;
  url?: string;
}

export interface AccountGameCard {
  id: string;
  title: string;
  description: string;
  url: string;
  category: "fleet" | "retro";
  status?: string;
  authRequired?: boolean;
  tags?: string[];
}

const RETRO_LIBRARY: AccountGameCard = {
  id: "retro-library",
  title: "Retro Game Library",
  description: "1,350+ classic NES, SNES, Genesis, N64, and more — emulator plays with scores.",
  url: "/games",
  category: "retro",
  status: "live",
  tags: ["retro", "solo"],
};

const FLEET_SKIP = new Set(["retro-library", "super-engine", "launcher"]);

export function getFleetAccountGames(): AccountGameCard[] {
  return FLEET_REGISTRY.filter((e) => {
    if (FLEET_SKIP.has(e.id)) return false;
    if (e.status === "planned") return false;
    if (e.canonicalUrl.startsWith("/") && !e.forge) return false;
    return true;
  }).map(fleetEntryToCard);
}

export function getRetroAccountGames(): AccountGameCard[] {
  return [RETRO_LIBRARY];
}

export function getAllAccountGames(): AccountGameCard[] {
  return [...getFleetAccountGames(), ...getRetroAccountGames()];
}

export function getAccountGamesByCategory(category: AccountGameCategory): AccountGameCard[] {
  if (category === "fleet") return getFleetAccountGames();
  if (category === "retro") return getRetroAccountGames();
  return getAllAccountGames();
}

function fleetEntryToCard(entry: FleetRegistryEntry): AccountGameCard {
  return {
    id: entry.id,
    title: entry.name,
    description: entry.description,
    url: entry.canonicalUrl,
    category: entry.tags?.includes("retro") ? "retro" : "fleet",
    status: entry.status,
    authRequired: entry.authRequired,
    tags: entry.tags,
  };
}

export function resolveAccountGameCard(id: string): AccountGameCard | undefined {
  if (id === "retro-library") return RETRO_LIBRARY;
  const entry = getFleetEntry(id);
  return entry ? fleetEntryToCard(entry) : undefined;
}

export function mergeAccountPlayHistory(
  fleetPlays: AccountGamePlay[],
  retroRows: Array<{
    game: { id: number; title: string; platform: string };
    personalBestAt: Date | string | null;
  }>,
): AccountGamePlay[] {
  const retroPlays: AccountGamePlay[] = retroRows.map((row) => ({
    gameKey: `retro:${row.game.id}`,
    category: "retro" as const,
    title: row.game.title,
    lastPlayedAt: row.personalBestAt
      ? new Date(row.personalBestAt).toISOString()
      : new Date().toISOString(),
    playCount: 1,
    url: `/play/${row.game.id}`,
  }));

  const byKey = new Map<string, AccountGamePlay>();
  for (const p of [...fleetPlays, ...retroPlays]) {
    const existing = byKey.get(p.gameKey);
    if (!existing || new Date(p.lastPlayedAt) > new Date(existing.lastPlayedAt)) {
      byKey.set(p.gameKey, p);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime(),
  );
}

const RECENT_PLAYS_KEY = "grudge_recent_plays";

export function readLocalFleetPlays(grudgeId?: string | null): AccountGamePlay[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${RECENT_PLAYS_KEY}:${grudgeId || "anon"}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccountGamePlay[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalFleetPlay(play: AccountGamePlay, grudgeId?: string | null): void {
  if (typeof localStorage === "undefined") return;
  const key = `${RECENT_PLAYS_KEY}:${grudgeId || "anon"}`;
  const existing = readLocalFleetPlays(grudgeId);
  const hit = existing.find((p) => p.gameKey === play.gameKey);
  const next = hit
    ? existing.map((p) =>
        p.gameKey === play.gameKey
          ? { ...p, playCount: p.playCount + 1, lastPlayedAt: play.lastPlayedAt }
          : p,
      )
    : [play, ...existing];
  localStorage.setItem(key, JSON.stringify(next.slice(0, 32)));
}

export async function recordAccountGamePlay(
  game: Pick<AccountGameCard, "id" | "title" | "url" | "category">,
  grudgeId?: string | null,
): Promise<void> {
  const play: AccountGamePlay = {
    gameKey: game.id,
    category: game.category === "retro" ? "retro" : "fleet",
    title: game.title,
    url: game.url,
    lastPlayedAt: new Date().toISOString(),
    playCount: 1,
  };
  writeLocalFleetPlay(play, grudgeId);
  try {
    await fetch("/api/me/play", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameKey: play.gameKey,
        category: play.category,
        title: play.title,
        url: play.url,
      }),
    });
  } catch {
    /* offline — localStorage is enough for UI */
  }
}