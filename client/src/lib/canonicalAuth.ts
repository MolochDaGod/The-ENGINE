/**
 * Canonical Grudge ID SSO — ONE path for all portal surfaces.
 * Never invent alternate login modals with Discord/Google/Phone grids.
 *
 * Gateway: https://id.grudge-studio.com/login?redirect_uri=<app callback>
 * Handoff lands on /auth/callback with grudge_token / sso_token query params.
 */

export const GRUDGE_ID_GATEWAY = "https://id.grudge-studio.com";

/** Full absolute return URL for SSO (must be on fleet allowlist). */
export function buildAuthReturnUrl(pathOrUrl?: string): string {
  if (typeof window === "undefined") {
    return `${GRUDGE_ID_GATEWAY}/login`;
  }
  if (pathOrUrl && /^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const path = pathOrUrl
    ? pathOrUrl.startsWith("/")
      ? pathOrUrl
      : `/${pathOrUrl}`
    : `${window.location.pathname}${window.location.search}`;
  // Prefer dedicated callback so tokens are consumed consistently
  const returnPath = path.startsWith("/auth/callback")
    ? path
    : `/auth/callback?next=${encodeURIComponent(path)}`;
  return `${window.location.origin}${returnPath}`;
}

/**
 * Canonical browser login URL.
 * Uses /login?redirect_uri= (not /auth/sso-check — that rewrite is fragile).
 */
export function buildCanonicalLoginUrl(returnTo?: string): string {
  const redirect = buildAuthReturnUrl(returnTo);
  return `${GRUDGE_ID_GATEWAY}/login?redirect_uri=${encodeURIComponent(redirect)}`;
}

/** Hard navigation to Grudge ID — replaces any in-app multi-provider modal. */
export function redirectToCanonicalLogin(returnTo?: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(buildCanonicalLoginUrl(returnTo));
}
