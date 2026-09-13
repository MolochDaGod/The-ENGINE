import type { Game } from "@shared/schema";

let catalogCache: Game[] | null = null;

/** Full retro catalog — static JSON on CDN (1,350 games), cached in memory. */
export async function loadRetroCatalog(): Promise<Game[]> {
  if (catalogCache) return catalogCache;
  const res = await fetch("/catalog/games.json", { credentials: "same-origin" });
  if (!res.ok) {
    const fallback = await fetch("/api/games", { credentials: "same-origin" });
    if (!fallback.ok) throw new Error("Failed to load game catalog");
    const data = await fallback.json();
    catalogCache = Array.isArray(data) ? data : (data.games ?? []);
    return catalogCache ?? [];
  }
  catalogCache = await res.json();
  return catalogCache ?? [];
}

export async function loadFeaturedRetroGames(): Promise<Game[]> {
  const all = await loadRetroCatalog();
  return all.filter((g) => g.isFeatured);
}

export async function loadRetroGameById(id: number): Promise<Game | undefined> {
  const all = await loadRetroCatalog();
  return all.find((g) => g.id === id);
}