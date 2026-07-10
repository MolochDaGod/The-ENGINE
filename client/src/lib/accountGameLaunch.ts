/**
 * Launch fleet / retro games from account with Grudge ID launch tokens.
 */

import { recordAccountGamePlay, type AccountGameCard } from "./accountGames";

async function externalLaunchUrl(href: string, authRequired: boolean): Promise<string> {
  if (!authRequired || href.startsWith("/")) return href;
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

export async function launchAccountGame(
  game: AccountGameCard,
  navigate: (path: string) => void,
  grudgeId?: string | null,
): Promise<void> {
  await recordAccountGamePlay(game, grudgeId);
  const target = await externalLaunchUrl(game.url, !!game.authRequired);
  if (target.startsWith("/")) {
    navigate(target);
    return;
  }
  window.open(target, "_blank", "noopener,noreferrer");
}