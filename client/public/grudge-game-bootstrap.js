/**
 * grudge-game-bootstrap.js — Fleet production bootstrap for Grudge Studio games
 *
 * Load early in <head> on every game / portal HTML entry point:
 *   <script src="https://client.grudge-studio.com/grudge-game-bootstrap.js"></script>
 *
 * - Disables browser auto-translate (prevents Microsoft Translator 401 console noise)
 * - Handles Grudge ID SSO return (?sso_token= & ?grudge_id=)
 * - Listens for grudge-auth:success postMessage from id.grudge-studio.com popups
 * - Exposes window.GRUDGE_FLEET endpoints + window.GrudgeGameBootstrap session helpers
 */
(function (global) {
  'use strict';

  try {
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
      var meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      (document.head || document.documentElement).appendChild(meta);
    }
  } catch (e) {}

  var TOKEN_KEY = 'grudge_auth_token';
  var ID_KEY = 'grudge_id';
  var USER_KEY = 'grudge_username';

  // ONE TRUTH fleet endpoints — prefer these over hard-coded per-game URLs.
  // gameData = Railway Postgres SSOT (characters/wallet/island).
  // api.grudge-studio.com is DEPRECATED (redirects to portal HTML).
  var FLEET = {
    auth: 'https://id.grudge-studio.com',
    /** @deprecated use gameData / same-origin /api on portal */
    api: 'https://grudge-api-production-0d46.up.railway.app',
    gameData: 'https://grudge-api-production-0d46.up.railway.app',
    account: 'https://grudge-api-production-0d46.up.railway.app',
    assets: 'https://assets.grudge-studio.com',
    objectstore: 'https://objectstore.grudge-studio.com',
    info: 'https://info.grudge-studio.com',
    browse: 'https://browse.grudge-studio.com',
    weaponSkills: 'https://objectstore.grudge-studio.com/api/v1/master-weaponSkills.json',
    ai: 'https://ai.grudge-studio.com',
    ws: 'wss://grudge-api-production-0d46.up.railway.app',
    world: 'wss://world.grudge-studio.com',
    portal: 'https://grudge-studio.com',
    engine: 'https://the-engine-snowy.vercel.app',
    open: 'https://gameopen.vercel.app',
    puterSdk: 'https://js.puter.com/v2/'
  };

  function getSession() {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      grudgeId: localStorage.getItem(ID_KEY),
      username: localStorage.getItem(USER_KEY),
      signedIn: !!localStorage.getItem(TOKEN_KEY)
    };
  }

  function saveSession(data) {
    if (!data) return;
    var user = data.user || data.player || data.profile || null;
    var token = data.token || data.access_token || data.sso_token || (user && user.token);
    if (token) localStorage.setItem(TOKEN_KEY, token);
    var gid = data.grudge_id || data.grudgeId || (user && user.grudgeId);
    if (gid) localStorage.setItem(ID_KEY, gid);
    var name = data.username || (user && (user.username || user.displayName));
    if (name) localStorage.setItem(USER_KEY, name);
  }

  function clearSession() {
    [TOKEN_KEY, ID_KEY, USER_KEY, 'grudge_user'].forEach(function (k) {
      localStorage.removeItem(k);
    });
  }

  function buildLoginUrl(app, returnUrl) {
    return FLEET.auth + '/api/auth/page?app=' +
      encodeURIComponent(app || 'grudge-game') +
      '&redirect=' + encodeURIComponent(returnUrl || location.href);
  }

  function openLogin(app) {
    var url = buildLoginUrl(app);
    var w = 480;
    var h = 640;
    var left = Math.max(0, (screen.width - w) / 2);
    var top = Math.max(0, (screen.height - h) / 2);
    global.open(url, 'grudge-id-login',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',noopener');
  }

  function exchangeLaunchToken(launchToken) {
    return fetch(FLEET.auth + '/api/auth/session/exchange', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': location.origin
      },
      body: JSON.stringify({ token: launchToken, audience: location.origin })
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (profile) {
        if (!profile || !profile.token) return false;
        saveSession(profile);
        global.dispatchEvent(new CustomEvent('grudge-auth:success', { detail: getSession() }));
        document.dispatchEvent(new CustomEvent('grudge-auth-changed'));
        return true;
      })
      .catch(function () { return false; });
  }

  function handleSsoCallback() {
    try {
      var params = new URLSearchParams(location.search);
      var launchToken = params.get('grudge_token') || params.get('puter_token');
      if (launchToken) {
        ['grudge_token', 'puter_token', 'auth', 'new'].forEach(function (k) { params.delete(k); });
        var qs = params.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
        exchangeLaunchToken(launchToken);
        return 'pending';
      }
      var token = params.get('sso_token') || params.get('token');
      if (!token) return false;
      saveSession({
        token: token,
        grudge_id: params.get('grudge_id') || params.get('grudgeId'),
        username: params.get('username')
      });
      ['sso_token', 'token', 'grudge_id', 'grudgeId', 'username'].forEach(function (k) {
        params.delete(k);
      });
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      global.dispatchEvent(new CustomEvent('grudge-auth:success', { detail: getSession() }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function listenAuthPopup() {
    global.addEventListener('message', function (ev) {
      var data = ev.data;
      if (!data) return;
      if (data.type !== 'grudge-auth:success' && data.type !== 'GRUDGE_AUTH_SUCCESS') return;
      try {
        var origin = ev.origin || '';
        if (origin &&
            origin.indexOf('grudge-studio.com') < 0 &&
            origin.indexOf('grudgewarlords.com') < 0 &&
            origin.indexOf('vercel.app') < 0 &&
            origin.indexOf('puter.site') < 0) {
          return;
        }
      } catch (e) {}
      saveSession(data.payload || data);
      document.dispatchEvent(new CustomEvent('grudge-auth-changed'));
      global.dispatchEvent(new CustomEvent('grudge-auth:success', { detail: getSession() }));
    });
  }

  function apiFetch(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers || {});
    var sess = getSession();
    if (sess.token && !opts.headers.Authorization) {
      opts.headers.Authorization = 'Bearer ' + sess.token;
    }
    var url = path.indexOf('http') === 0 ? path : '/api' + (path.charAt(0) === '/' ? path : '/' + path);
    return fetch(url, opts);
  }

  handleSsoCallback();
  listenAuthPopup();

  global.GRUDGE_FLEET = FLEET;
  global.GrudgeGameBootstrap = {
    fleet: FLEET,
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearSession,
    buildLoginUrl: buildLoginUrl,
    openLogin: openLogin,
    apiFetch: apiFetch,
    exchangeLaunchToken: exchangeLaunchToken
  };
})(typeof window !== 'undefined' ? window : this);