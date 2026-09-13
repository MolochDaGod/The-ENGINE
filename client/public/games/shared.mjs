/** Shared helpers for portal iframe games */
export function installAuthBridge(gameId) {
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'grudge:auth') {
      window.__GRUDGE_PLAYER__ = e.data.player;
      window.__GRUDGE_TOKEN__ = e.data.token;
    }
    if (e.data?.type === 'grudge:settings' && window.applyGrudgeSettings) {
      window.applyGrudgeSettings(e.data.settings);
    }
  });
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'grudge:game:ready', game: gameId }, '*');
  }
}

export function createHud(lines = []) {
  const el = document.createElement('div');
  el.id = 'hud';
  el.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:20;padding:10px 12px;' +
    'background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.12);' +
    'border-radius:8px;color:#ddd;font:12px/1.5 system-ui,sans-serif;pointer-events:none;';
  el.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  document.body.appendChild(el);
  return el;
}

export function removeLoader() {
  const loader = document.querySelector('.loader');
  if (loader) loader.remove();
}