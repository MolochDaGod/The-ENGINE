/**
 * Fleet game launch helpers — iframe vs new-tab with embed fallback.
 *
 * CSP `frame-ancestors https://*.grudge-studio.com` does NOT cover the apex
 * domain grudge-studio.com. Games that only allow subdomains will refuse portal
 * iframes; use embedRoute when available or open a dedicated tab.
 */

export type GameLaunchMode = "internal" | "embed" | "tab";

export interface LaunchableGame {
  id: string;
  route: string;
  embedRoute?: string;
  /** When false, always open in a new tab (no iframe preview). */
  allowEmbed?: boolean;
}

export interface ResolvedLaunch {
  playUrl: string;
  embedUrl: string | null;
  mode: GameLaunchMode;
}

export function isInternalRoute(route: string): boolean {
  return route.startsWith("/");
}

export function resolveGameLaunch(game: LaunchableGame): ResolvedLaunch {
  if (isInternalRoute(game.route)) {
    return { playUrl: game.route, embedUrl: game.route, mode: "internal" };
  }

  if (game.allowEmbed === false) {
    return { playUrl: game.route, embedUrl: null, mode: "tab" };
  }

  const embedUrl = game.embedRoute ?? game.route;
  return { playUrl: game.route, embedUrl, mode: "embed" };
}

export function openGameTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function navigateGame(route: string, navigate: (path: string) => void): void {
  if (isInternalRoute(route)) {
    navigate(route);
    return;
  }
  openGameTab(route);
}

/** Hosts known to block apex grudge-studio.com in frame-ancestors. */
const APEX_EMBED_BLOCKLIST = new Set([
  "rpg-modular.vercel.app",
]);

export function prefersTabLaunch(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return APEX_EMBED_BLOCKLIST.has(host) && !url.includes("/embed/");
  } catch {
    return false;
  }
}