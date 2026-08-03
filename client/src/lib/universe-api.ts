/**
 * Client helpers for the unified account universe APIs.
 */
import { UNIVERSE_LAUNCH } from "@shared/universe-catalog";
import { buildRosterSearch, type PlayerLoadout } from "@shared/game-roster";

export type UniverseCharacter = {
  id: number;
  prefabId: string;
  displayName: string;
  level: number;
  xp: number;
  isActive: boolean;
  stats: Record<string, number>;
  loadout: {
    primaryWeapon?: string;
    secondaryWeapon?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type UniverseDeckCard = {
  cardKey: string;
  name: string;
  qty: number;
  cost?: number;
  attack?: number;
  health?: number;
  rarity?: string;
  tribe?: string;
};

export type UniverseDeck = {
  id: number;
  name: string;
  description: string | null;
  tribe: string | null;
  isActive: boolean;
  isValid: boolean;
  cards: UniverseDeckCard[];
  totalCards: number;
};

export type UniverseIsland = {
  id: number;
  name: string;
  biome: string;
  isHome: boolean;
  layout: Record<string, unknown>;
  progress: {
    level?: number;
    defense?: number;
    population?: number;
    lastHarvestAt?: string;
  };
};

export type UniverseSnapshot = {
  characters: UniverseCharacter[];
  decks: UniverseDeck[];
  islands: UniverseIsland[];
  saves: Array<{ id: number; gameKey: string; slot: number; progress: Record<string, unknown> }>;
  bootstrapped: { deck: boolean; island: boolean };
  catalog: {
    biomes: Array<{ id: string; label: string; emoji: string }>;
    launches: typeof UNIVERSE_LAUNCH;
  };
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fetchUniverse(): Promise<UniverseSnapshot> {
  return json("/api/me/universe");
}

export function claimCharacter(body: {
  prefabId: string;
  displayName?: string;
  setActive?: boolean;
  loadout?: PlayerLoadout;
}): Promise<UniverseCharacter> {
  return json("/api/me/characters", { method: "POST", body: JSON.stringify(body) });
}

export function patchCharacter(
  id: number,
  body: Partial<UniverseCharacter>,
): Promise<UniverseCharacter> {
  return json(`/api/me/characters/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function createDeck(body: {
  name: string;
  description?: string;
  tribe?: string;
  cards?: UniverseDeckCard[];
  setActive?: boolean;
}): Promise<UniverseDeck> {
  return json("/api/me/decks", { method: "POST", body: JSON.stringify(body) });
}

export function patchDeck(
  id: number,
  body: Partial<UniverseDeck> & { isActive?: boolean },
): Promise<UniverseDeck> {
  return json(`/api/me/decks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function createIsland(body: {
  name: string;
  biome?: string;
  isHome?: boolean;
}): Promise<UniverseIsland> {
  return json("/api/me/islands", { method: "POST", body: JSON.stringify(body) });
}

export function patchIsland(
  id: number,
  body: Partial<UniverseIsland>,
): Promise<UniverseIsland> {
  return json(`/api/me/islands/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function putGameSave(body: {
  gameKey: string;
  slot?: number;
  label?: string;
  progress: Record<string, unknown>;
}): Promise<unknown> {
  return json("/api/me/saves", { method: "PUT", body: JSON.stringify(body) });
}

async function withLaunchToken(href: string): Promise<string> {
  if (href.startsWith("/")) return href;
  try {
    const origin = new URL(href, window.location.origin).origin;
    const resp = await fetch("/api/auth/popup-token", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: origin }),
    });
    if (!resp.ok) return href;
    const { token } = (await resp.json()) as { token: string };
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}grudge_token=${encodeURIComponent(token)}`;
  } catch {
    return href;
  }
}

function appendParams(url: string, params: Record<string, string | number | undefined | null>): string {
  const u = new URL(url, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.searchParams.set(k, String(v));
  }
  // relative path keep relative
  if (url.startsWith("/")) {
    return `${u.pathname}${u.search}`;
  }
  return u.toString();
}

/** Launch Warlords / Genesis with active character loadout. */
export async function launchWithCharacter(
  character: UniverseCharacter,
  target: "warlords" | "warlordGenesis" = "warlords",
  navigate?: (path: string) => void,
): Promise<void> {
  const base = UNIVERSE_LAUNCH[target].route;
  const loadout: PlayerLoadout = {
    heroId: character.prefabId,
    primaryWeapon: character.loadout?.primaryWeapon || "pistol",
    secondaryWeapon: character.loadout?.secondaryWeapon ?? "knife",
  };
  const roster = buildRosterSearch(loadout);
  let url = appendParams(base + (base.includes("?") ? "" : ""), {
    hero: loadout.heroId,
    primary: loadout.primaryWeapon,
    secondary: loadout.secondaryWeapon,
    characterId: character.id,
  });
  // Prefer roster query from shared helper when base has no query
  if (!base.includes("?")) {
    url = `${base}${roster}&characterId=${character.id}`;
  }
  url = await withLaunchToken(url);
  await putGameSave({
    gameKey: UNIVERSE_LAUNCH[target].gameKey,
    progress: { lastCharacterId: character.id, prefabId: character.prefabId, at: new Date().toISOString() },
  }).catch(() => {});
  if (url.startsWith("/") && navigate) navigate(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** Launch Nexus Nemesis on grudgeplatform.io (real battledeck SSOT). */
export async function launchWithDeck(deck: UniverseDeck): Promise<void> {
  // Playable deck ownership is grudgeplatform.io /api/user/battledeck — not portal player_decks filler.
  // Open library/deck-builder with SSO; portal deckId is advisory only.
  let url = appendParams(UNIVERSE_LAUNCH.nemesis.route, {
    from: "portal-account",
    portalDeckId: deck.id,
    deck: deck.name,
  });
  // Prefer deck builder when list is incomplete / placeholder snapshot
  if (!deck.isValid || deck.totalCards !== 20) {
    url = appendParams(UNIVERSE_LAUNCH.nemesisDeck.route, {
      from: "portal-account",
      portalDeckId: deck.id,
    });
  }
  url = await withLaunchToken(url);
  await putGameSave({
    gameKey: UNIVERSE_LAUNCH.nemesis.gameKey,
    progress: { lastDeckId: deck.id, totalCards: deck.totalCards, at: new Date().toISOString() },
  }).catch(() => {});
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Launch home island / metaverse with island id. */
export async function launchWithIsland(
  island: UniverseIsland,
  target: "islands" | "metaverse" = "islands",
  navigate?: (path: string) => void,
): Promise<void> {
  const base = UNIVERSE_LAUNCH[target].route;
  let url = appendParams(base, {
    islandId: island.id,
    biome: island.biome,
    home: island.isHome ? "1" : "0",
  });
  url = await withLaunchToken(url);
  await putGameSave({
    gameKey: UNIVERSE_LAUNCH[target].gameKey,
    progress: { lastIslandId: island.id, biome: island.biome, at: new Date().toISOString() },
  }).catch(() => {});
  if (url.startsWith("/") && navigate) navigate(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
