/**
 * Pull real battle decks from grudgeplatform.io (nexus-nemesis) into portal mirror.
 * Never invents cards — only maps API rows from user_season0_cards battledeck.
 */
import { NEXUS_TCG_ORIGIN as NEXUS_DEFAULT } from "@shared/universe-catalog";

const NEXUS_TCG_ORIGIN =
  process.env.NEXUS_TCG_ORIGIN ||
  process.env.GRUDGEPLATFORM_URL ||
  NEXUS_DEFAULT;

export type NexusBattleCard = {
  cardKey: string;
  name: string;
  qty: number;
  cost?: number;
  attack?: number;
  health?: number;
  rarity?: string;
  tribe?: string | null;
  type?: string;
  isTribal?: boolean;
  tribalType?: string | null;
  uuid?: string;
};

export type NexusBattleDeckMirror = {
  name: string;
  description: string;
  tribe: string | null;
  cards: NexusBattleCard[];
  totalCards: number;
  isValid: boolean;
  source: "grudgeplatform-battledeck";
  syncedAt: string;
};

/**
 * Fetch the authenticated user's battle deck from production Nexus.
 * `bearerToken` must be a JWT accepted by grudgeplatform (same JWT_SECRET fleet).
 */
export async function fetchNexusBattleDeck(
  bearerToken: string,
): Promise<NexusBattleDeckMirror | null> {
  if (!bearerToken) return null;

  const url = `${NEXUS_TCG_ORIGIN.replace(/\/$/, "")}/api/user/battledeck`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    console.warn("[nexus-deck-sync] battledeck fetch failed:", e);
    return null;
  }

  if (res.status === 401 || res.status === 403) {
    console.warn("[nexus-deck-sync] unauthorized — JWT not accepted by Nexus");
    return null;
  }
  if (!res.ok) {
    console.warn("[nexus-deck-sync] HTTP", res.status);
    return null;
  }

  const body = (await res.json()) as any;
  const rawCards: any[] = body?.deck?.cards || body?.cards || [];
  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    return null;
  }

  // Collapse instances → cardKey + qty (portal deck schema)
  const byKey = new Map<string, NexusBattleCard>();
  for (const row of rawCards) {
    const cardKey = String(row.cardId ?? row.card_id ?? row.id ?? "").trim();
    if (!cardKey || !/^\d+$/.test(cardKey)) continue; // only real season0 template ids
    const name = String(row.name || `Card ${cardKey}`);
    const existing = byKey.get(cardKey);
    if (existing) {
      existing.qty += 1;
      continue;
    }
    byKey.set(cardKey, {
      cardKey,
      name,
      qty: 1,
      cost: Number(row.cost ?? row.manaCost ?? row.mana_cost ?? 0) || undefined,
      attack: Number(row.attack ?? 0) || undefined,
      health: Number(row.health ?? 0) || undefined,
      rarity: row.rarity || undefined,
      tribe: row.tribalType || row.tribal_type || row.sub_type || null,
      type: row.type || undefined,
      isTribal: !!(row.isTribal || row.is_tribal),
      tribalType: row.tribalType || row.tribal_type || null,
      uuid: row.uuid || undefined,
    });
  }

  const cards = Array.from(byKey.values());
  if (!cards.length) return null;

  const totalCards = cards.reduce((s, c) => s + c.qty, 0);
  return {
    name: body?.deck?.name || "Battle Deck",
    description: `Synced from ${NEXUS_TCG_ORIGIN} · user_season0_cards (is_in_deck)`,
    tribe: null,
    cards,
    totalCards,
    isValid: totalCards === 20 || body?.deck?.isValid === true,
    source: "grudgeplatform-battledeck",
    syncedAt: new Date().toISOString(),
  };
}

/** Extract Bearer token from Express request (session JWT for fleet). */
export function bearerFromRequest(req: {
  headers?: Record<string, unknown>;
  cookies?: Record<string, string>;
}): string | null {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  // Portal often keeps grudge_token in cookie after SSO
  const cookies = req.cookies || {};
  for (const k of ["grudge_token", "sso_token", "grudge_auth_token", "gs_player_session"]) {
    const v = cookies[k];
    if (typeof v === "string" && v.length > 20) return decodeURIComponent(v);
  }
  return null;
}
