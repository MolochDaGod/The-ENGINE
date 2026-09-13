/** True when the page should run chromeless (portal iframe / ?embed=1). */
export function isPortalEmbedMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.self !== window.top) return true;
  return new URLSearchParams(window.location.search).get('embed') === '1';
}