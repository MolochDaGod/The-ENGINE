/**
 * Fleet game launch helpers — iframe vs new-tab with embed fallback.
 *
 * CSP `frame-ancestors https://*.grudge-studio.com` does NOT cover the apex
 * domain grudge-studio.com. Fleet games on *.grudge-studio.com subdomains
 * must open in a tab when the portal host is the apex domain.
 */

export type GameLaunchMode = 'internal' | 'embed' | 'tab';

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

const APEX_HOSTS = new Set(['grudge-studio.com', 'www.grudge-studio.com']);

/** Hosts that ship a dedicated /embed/ document for portal iframes. */
const APEX_EMBED_BLOCKLIST = new Set(['rpg-modular.vercel.app']);

/** Fleet subdomains that allow iframe embed from the apex portal (no frame-ancestors block). */
const APEX_EMBED_ALLOWLIST = new Set([
  'grudox.grudge-studio.com',
  'play.grudge-studio.com',
]);

export function isInternalRoute(route: string): boolean {
  return route.startsWith('/');
}

export function isApexPortalHost(): boolean {
  if (typeof window === 'undefined') return false;
  return APEX_HOSTS.has(window.location.hostname);
}

/** Subdomain fleet URLs whose frame-ancestors omit the apex portal host. */
export function blocksApexEmbed(url: string): boolean {
  if (!isApexPortalHost()) return false;
  try {
    const host = new URL(url, window.location.origin).hostname;
    if (APEX_EMBED_ALLOWLIST.has(host)) return false;
    if (host.endsWith('.grudge-studio.com') && !APEX_HOSTS.has(host)) {
      return true;
    }
    return APEX_EMBED_BLOCKLIST.has(host) && !url.includes('/embed/');
  } catch {
    return false;
  }
}

export function prefersTabLaunch(url: string): boolean {
  return blocksApexEmbed(url);
}

export function resolveGameLaunch(game: LaunchableGame): ResolvedLaunch {
  const playUrl = game.route;

  if (game.allowEmbed === false) {
    return { playUrl, embedUrl: null, mode: 'tab' };
  }

  const embedCandidate = game.embedRoute ?? game.route;

  if (prefersTabLaunch(embedCandidate)) {
    return { playUrl, embedUrl: null, mode: 'tab' };
  }

  if (isInternalRoute(embedCandidate)) {
    return { playUrl, embedUrl: embedCandidate, mode: 'internal' };
  }

  return { playUrl, embedUrl: embedCandidate, mode: 'embed' };
}

export function openGameTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function navigateGame(route: string, navigate: (path: string) => void): void {
  // Paid Forge IDE — always use portal gate
  if (
    route === "https://forge.grudge-studio.com" ||
    route.startsWith("https://forge.grudge-studio.com/") ||
    route === "/forge"
  ) {
    navigate("/forge");
    return;
  }
  if (isInternalRoute(route)) {
    navigate(route);
    return;
  }
  openGameTab(route);
}