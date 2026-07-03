/**
 * grudge-sso.js — Cross-App Single Sign-On for Grudge Studio
 *
 * Include this script on any Grudge Studio app to enable seamless auth
 * across all sites. It does two things:
 *
 *  1. INBOUND: On page load, captures ?token=...&username=...&grudge_id=...
 *     from the URL, stores them in localStorage, and cleans the URL.
 *
 *  2. OUTBOUND: Intercepts clicks on links to other Grudge Studio domains
 *     and appends the current user's auth token as URL params. The target
 *     app picks them up via step 1.
 *
 * Compatible with all Grudge apps: vanilla HTML, React, Vue, etc.
 * Just add: <script src="/grudge-sso.js"></script>
 * Or for CDN: <script src="https://grudachain.grudgestudio.com/grudge-sso.js"></script>
 */

(function () {
  'use strict';

  // ── Config ──
  var TOKEN_KEY   = 'grudge_auth_token';
  var USER_KEY    = 'grudge_username';
  var ID_KEY      = 'grudge_id';
  var USERID_KEY  = 'grudge_user_id';

  // Domains that participate in Grudge SSO
  var SSO_DOMAINS = [
    'nexus.grudge-studio.com',
    'grudachain.grudge-studio.com',
    'grudachain.grudgestudio.com',
    'grudachain-rho.vercel.app',
    'grudge-platform.vercel.app',
    'gdevelop-assistant.vercel.app',
    'warlord-crafting-suite.vercel.app',
    'grudgewarlords.com',
    'www.grudgewarlords.com',
    'id.grudge-studio.com',
    'api.grudge-studio.com',
    'dash.grudge-studio.com',
    'account.grudge-studio.com',
  ];

  // Also match any *.vercel.app or *.grudge-studio.com or *.grudgestudio.com
  function isGrudgeDomain(hostname) {
    if (SSO_DOMAINS.indexOf(hostname) !== -1) return true;
    if (/\.vercel\.app$/.test(hostname)) return true;
    if (/\.grudge-studio\.com$/.test(hostname)) return true;
    if (/\.grudgestudio\.com$/.test(hostname)) return true;
    if (/\.puter\.site$/.test(hostname)) return true;
    return false;
  }

  function isSameOrigin(hostname) {
    return hostname === window.location.hostname;
  }

  var AUTH_GATEWAY = 'https://id.grudge-studio.com';
  var GAME_API = 'https://api.grudge-studio.com';

  var AUTH_PARAM_KEYS = [
    'token', 'sso_token', 'auth_token', 'grudge_token', 'puter_token',
    'username', 'grudge_username', 'auth_user',
    'grudge_id', 'auth_grudge_id', 'grudge_user_id',
    'displayName', 'provider', 'isNew'
  ];

  function cleanAuthParamsFromUrl() {
    var cleanUrl = new URL(window.location.href);
    AUTH_PARAM_KEYS.forEach(function (k) { cleanUrl.searchParams.delete(k); });
    var cleanStr = cleanUrl.pathname + cleanUrl.search + cleanUrl.hash;
    window.history.replaceState({}, '', cleanStr || '/');
  }

  /** Canonical Grudge ID login URL (Puter SSO page, not /auth portal SPA). */
  function buildAuthUrl(returnUrl, app) {
    return AUTH_GATEWAY + '/api/auth/page?app=' + encodeURIComponent(app || 'fleet') +
      '&redirect=' + encodeURIComponent(returnUrl || window.location.href);
  }

  /**
   * Two-step scoped auth: simple Puter identity → Grudge ID (+ email account link).
   * Requires https://js.puter.com/v2/ loaded on the page.
   */
  function scopePuterToGrudgeId(appLabel) {
    if (typeof window.puter === 'undefined') {
      return Promise.reject(new Error('Puter SDK not loaded'));
    }
    var signIn = puter.auth.isSignedIn()
      ? Promise.resolve()
      : puter.auth.signIn();
    var puterUser = null;
    return signIn
      .then(function () { return puter.auth.getUser(); })
      .then(function (pu) {
        puterUser = pu;
        if (!pu || !pu.uuid) throw new Error('Puter sign-in cancelled');
        return fetch(AUTH_GATEWAY + '/api/auth/puter-sso', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            puterId: pu.uuid,
            puterUsername: pu.username,
            email: pu.email || undefined,
            app: appLabel || 'fleet'
          })
        });
      })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (e) { throw new Error(e.error || 'Grudge ID scope failed'); });
        return res.json();
      })
      .then(function (profile) {
        var jwt = profile && (profile.token || profile.sessionToken);
        if (jwt) {
          localStorage.setItem(TOKEN_KEY, jwt);
          if (profile.grudgeId) localStorage.setItem(ID_KEY, profile.grudgeId);
          if (profile.username || profile.displayName) {
            localStorage.setItem(USER_KEY, profile.displayName || profile.username);
          }
          if (profile.id) localStorage.setItem(USERID_KEY, String(profile.id));
          document.dispatchEvent(new CustomEvent('grudge-auth-changed'));
        }
        return { profile: profile, token: jwt, puterUser: puterUser };
      });
  }

  /** Bridge id.grudge-studio.com launch token → local session JWT. */
  function bridgeLaunchToken(launchToken) {
    return fetch(AUTH_GATEWAY + '/api/auth/session/exchange', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify({ token: launchToken, audience: window.location.origin })
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (profile) {
        if (!profile) return false;
        var jwt = profile.token || profile.sessionToken;
        if (!jwt || !profile.grudgeId) return false;
        localStorage.setItem(TOKEN_KEY, jwt);
        localStorage.setItem(ID_KEY, profile.grudgeId);
        if (profile.username || profile.displayName) {
          localStorage.setItem(USER_KEY, profile.displayName || profile.username);
        }
        if (profile.id) localStorage.setItem(USERID_KEY, String(profile.id));
        document.dispatchEvent(new CustomEvent('grudge-auth-changed'));
        return true;
      })
      .catch(function () { return false; });
  }

  // ── 1. INBOUND: Capture token from URL params ──
  function captureInboundToken() {
    var params = new URLSearchParams(window.location.search);
    var launchToken = params.get('grudge_token') || params.get('puter_token');
    var token    = params.get('token') || params.get('sso_token') || params.get('auth_token');
    var username = params.get('username') || params.get('grudge_username') || params.get('auth_user');
    var grudgeId = params.get('grudge_id') || params.get('auth_grudge_id');
    var userId   = params.get('grudge_user_id');

    if (launchToken && !token) {
      cleanAuthParamsFromUrl();
      bridgeLaunchToken(launchToken).then(function (ok) {
        if (ok) console.log('[GrudgeSSO] Grudge ID launch token bridged');
      });
      return 'pending';
    }

    if (!token) return false;

    localStorage.setItem(TOKEN_KEY, token);
    if (username) localStorage.setItem(USER_KEY, username);
    if (grudgeId) localStorage.setItem(ID_KEY, grudgeId);
    if (userId)   localStorage.setItem(USERID_KEY, userId);

    cleanAuthParamsFromUrl();
    document.dispatchEvent(new CustomEvent('grudge-auth-changed'));
    return true;
  }

  // ── 2. OUTBOUND: Append token to cross-app links ──
  function getAuthParams() {
    var token    = localStorage.getItem(TOKEN_KEY);
    var username = localStorage.getItem(USER_KEY);
    var grudgeId = localStorage.getItem(ID_KEY);
    if (!token) return null;
    var p = new URLSearchParams();
    p.set('token', token);
    if (username) p.set('username', username);
    if (grudgeId) p.set('grudge_id', grudgeId);
    return p;
  }

  function handleClick(e) {
    // Find closest <a> tag
    var link = e.target.closest ? e.target.closest('a[href]') : null;
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    // Parse the target URL
    var url;
    try { url = new URL(href, window.location.origin); } catch { return; }

    // Only relay to Grudge domains, not same origin
    if (isSameOrigin(url.hostname)) return;
    if (!isGrudgeDomain(url.hostname)) return;

    // Don't relay to non-HTTP (mailto, etc.)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    var authParams = getAuthParams();
    if (!authParams) return;

    // Don't double-add if token already in URL
    if (url.searchParams.has('token')) return;

    // Append auth params
    authParams.forEach(function (v, k) { url.searchParams.set(k, v); });

    // Update the link click target
    e.preventDefault();
    if (link.target === '_blank') {
      window.open(url.toString(), '_blank', 'noopener');
    } else {
      window.location.href = url.toString();
    }
  }

  // ── Init ──
  var captured = captureInboundToken();

  // Attach outbound handler
  document.addEventListener('click', handleClick, true);

  // Expose for programmatic use
  window.GrudgeSSO = {
    captureInboundToken: captureInboundToken,
    bridgeLaunchToken: bridgeLaunchToken,
    scopePuterToGrudgeId: scopePuterToGrudgeId,
    buildAuthUrl: buildAuthUrl,
    getAuthParams: getAuthParams,
    isGrudgeDomain: isGrudgeDomain,
    /** Build a cross-app URL with auth params attached */
    buildUrl: function (targetUrl) {
      var url = new URL(targetUrl);
      var params = getAuthParams();
      if (params) params.forEach(function (v, k) { url.searchParams.set(k, v); });
      return url.toString();
    },
    /** Navigate to another Grudge app with auth */
    navigate: function (targetUrl) {
      window.location.href = this.buildUrl(targetUrl);
    },
  };

  if (captured === true) {
    console.log('[GrudgeSSO] Auth captured from URL — session restored');
  } else if (captured === 'pending') {
    console.log('[GrudgeSSO] Bridging Grudge ID launch token…');
  }
})();
