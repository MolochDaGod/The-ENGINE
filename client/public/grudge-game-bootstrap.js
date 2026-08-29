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
  var TOKEN_KEYS = [
    'grudge.open.token',
    'grudge_auth_token',
    'grudge_session_token',
    'grudge.token',
    'sso_token',
    'grudge_token'
  ];
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
    /** Treaty chat + presence — The-ENGINE Railway (owns /ws/chat) */
    ws: 'wss://the-engine.up.railway.app/ws/chat',
    engineApi: 'https://the-engine.up.railway.app',
    world: 'wss://world.grudge-studio.com',
    portal: 'https://grudge-studio.com',
    engine: 'https://grudge-studio.com',
    open: 'https://gameopen.vercel.app',
    puterSdk: 'https://js.puter.com/v2/'
  };

  function readStoredToken() {
    for (var i = 0; i < TOKEN_KEYS.length; i++) {
      var v = localStorage.getItem(TOKEN_KEYS[i]);
      if (v) return v;
    }
    return null;
  }

  function getSession() {
    var token = readStoredToken();
    return {
      token: token,
      grudgeId: localStorage.getItem(ID_KEY),
      username: localStorage.getItem(USER_KEY),
      signedIn: !!token
    };
  }

  function saveSession(data) {
    if (!data) return;
    var user = data.user || data.player || data.profile || null;
    var token = data.token || data.access_token || data.sso_token || data.sessionToken || (user && user.token);
    if (token) {
      TOKEN_KEYS.forEach(function (k) { localStorage.setItem(k, token); });
    }
    var gid = data.grudge_id || data.grudgeId || (user && user.grudgeId);
    if (gid) localStorage.setItem(ID_KEY, gid);
    var name = data.username || (user && (user.username || user.displayName));
    if (name) localStorage.setItem(USER_KEY, name);
  }

  function clearSession() {
    TOKEN_KEYS.concat([ID_KEY, USER_KEY, 'grudge_user']).forEach(function (k) {
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

  function postExchange(url, launchToken) {
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + launchToken
      },
      body: JSON.stringify({ token: launchToken, audience: location.origin })
    }).then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; });
  }

  function exchangeLaunchToken(launchToken) {
    // Identity SSOT (Grudge ID) plus same-origin engine cookie so play saves attach.
    return Promise.all([
      postExchange(FLEET.auth + '/api/auth/session/exchange', launchToken),
      postExchange('/api/auth/session/exchange', launchToken)
    ]).then(function (profiles) {
      var profile = profiles[0] || profiles[1];
      if (!profile) return false;
      saveSession(profile);
      global.dispatchEvent(new CustomEvent('grudge-auth:success', { detail: getSession() }));
      document.dispatchEvent(new CustomEvent('grudge-auth-changed'));
      return true;
    }).catch(function () { return false; });
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
      exchangeLaunchToken(token);
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

  /**
   * Treaty in-game chat — one WebSocket room per game for the whole fleet.
   *
   *   GrudgeTreaty.connect({ gameId: 'avernus-3d', gameTitle: 'Avernus 3D' })
   *   GrudgeTreaty.send('gg everyone')
   *   GrudgeTreaty.onMessage(function (msg) { ... })
   *   GrudgeTreaty.disconnect()
   */
  var treatyWs = null;
  var treatyRoom = null;
  var treatyHandlers = { message: [], system: [], users: [], error: [], open: [], close: [] };
  var treatyReconnect = null;
  var treatyClosed = true;

  function treatyGameRoom(gameKey) {
    var slug = String(gameKey || 'lobby').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48);
    return 'game:' + (slug || 'lobby');
  }

  function treatyEmit(kind, payload) {
    (treatyHandlers[kind] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) {}
    });
  }

  function treatyConnect(opts) {
    opts = opts || {};
    var gameKey = opts.gameId || opts.gameKey || opts.slug || 'lobby';
    var gameTitle = opts.gameTitle || opts.title || gameKey;
    treatyRoom = treatyGameRoom(gameKey);
    treatyClosed = false;

    if (treatyWs && (treatyWs.readyState === 0 || treatyWs.readyState === 1)) {
      try {
        treatyWs.send(JSON.stringify({ type: 'switch_room', room: treatyRoom, gameTitle: gameTitle }));
      } catch (e) {}
      return treatyWs;
    }

    var url = opts.wsUrl || FLEET.ws;
    if (url.indexOf('/ws/chat') < 0) {
      url = url.replace(/\/$/, '') + (url.indexOf('ws') === 0 ? '' : '');
      if (url.indexOf('wss:') !== 0 && url.indexOf('ws:') !== 0) {
        url = 'wss://the-engine.up.railway.app/ws/chat';
      } else if (url.indexOf('/ws/chat') < 0) {
        url = url.replace(/\/$/, '') + '/ws/chat';
      }
    }

    try {
      treatyWs = new WebSocket(url);
    } catch (e) {
      treatyEmit('error', { message: String(e && e.message || e) });
      return null;
    }

    treatyWs.onopen = function () {
      var sess = getSession();
      var username = opts.username || sess.username || ('Guest' + Math.floor(Math.random() * 999));
      try {
        treatyWs.send(JSON.stringify({
          type: 'join',
          username: username,
          grudgeId: sess.grudgeId || null,
          room: treatyRoom,
          gameTitle: gameTitle
        }));
      } catch (e) {}
      treatyEmit('open', { room: treatyRoom });
    };

    treatyWs.onmessage = function (ev) {
      var data;
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      if (data.type === 'message') treatyEmit('message', data);
      else if (data.type === 'system') treatyEmit('system', data);
      else if (data.type === 'users' || data.type === 'joined') treatyEmit('users', data);
      else if (data.type === 'error') treatyEmit('error', data);
    };

    treatyWs.onclose = function () {
      treatyEmit('close', {});
      treatyWs = null;
      if (!treatyClosed) {
        clearTimeout(treatyReconnect);
        treatyReconnect = setTimeout(function () {
          if (!treatyClosed) treatyConnect(opts);
        }, 2500);
      }
    };

    treatyWs.onerror = function () {
      treatyEmit('error', { message: 'Treaty socket error' });
    };

    return treatyWs;
  }

  function treatySend(text) {
    if (!treatyWs || treatyWs.readyState !== 1) return false;
    var msg = String(text || '').trim().slice(0, 500);
    if (!msg) return false;
    try {
      treatyWs.send(JSON.stringify({ type: 'message', message: msg }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function treatyOn(kind, fn) {
    if (!treatyHandlers[kind]) treatyHandlers[kind] = [];
    treatyHandlers[kind].push(fn);
    return function () {
      treatyHandlers[kind] = treatyHandlers[kind].filter(function (f) { return f !== fn; });
    };
  }

  function treatyDisconnect() {
    treatyClosed = true;
    clearTimeout(treatyReconnect);
    try { if (treatyWs) treatyWs.close(); } catch (e) {}
    treatyWs = null;
  }

  handleSsoCallback();
  listenAuthPopup();

  global.GRUDGE_FLEET = FLEET;
  global.GrudgeTreaty = {
    connect: treatyConnect,
    send: treatySend,
    disconnect: treatyDisconnect,
    onMessage: function (fn) { return treatyOn('message', fn); },
    onSystem: function (fn) { return treatyOn('system', fn); },
    onUsers: function (fn) { return treatyOn('users', fn); },
    onError: function (fn) { return treatyOn('error', fn); },
    on: treatyOn,
    gameRoom: treatyGameRoom,
    get room() { return treatyRoom; },
    get connected() { return !!(treatyWs && treatyWs.readyState === 1); }
  };
  global.GrudgeGameBootstrap = {
    fleet: FLEET,
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearSession,
    buildLoginUrl: buildLoginUrl,
    openLogin: openLogin,
    apiFetch: apiFetch,
    exchangeLaunchToken: exchangeLaunchToken,
    treaty: global.GrudgeTreaty
  };
})(typeof window !== 'undefined' ? window : this);