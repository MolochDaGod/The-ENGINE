/**
 * Grudge Universe SDK — drop into any fleet game for account hydrate.
 *
 * <script src="https://grudge-studio.com/embed/grudge-universe.js"></script>
 * <script>
 *   GrudgeUniverse.hydrate().then((state) => {
 *     // state.player, state.universe, state.playSettings
 *   });
 * </script>
 *
 * Also auto-runs if window.GRUDGE_UNIVERSE_AUTO !== false
 * Reads grudge_token / hero / deckId / islandId from URL query.
 */
(function (global) {
  "use strict";

  var API = (global.GRUDGE_API_HOST || "https://api.grudge-studio.com").replace(/\/$/, "");
  var TOKEN_KEYS = ["grudge_auth_token", "grudge_session_token", "gs_player_session"];
  var CACHE_KEY = "grudge_universe_cache_v1";

  function qs(name) {
    try {
      return new URLSearchParams(global.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function getStoredToken() {
    for (var i = 0; i < TOKEN_KEYS.length; i++) {
      var t = global.localStorage && global.localStorage.getItem(TOKEN_KEYS[i]);
      if (t) return t;
      t = global.sessionStorage && global.sessionStorage.getItem(TOKEN_KEYS[i]);
      if (t) return t;
    }
    return null;
  }

  function setStoredToken(token) {
    if (!token) return;
    try {
      global.localStorage.setItem("grudge_auth_token", token);
      global.sessionStorage.setItem("grudge_auth_token", token);
    } catch (e) {}
  }

  function captureLaunchQuery() {
    var token = qs("grudge_token") || qs("token");
    if (token) {
      setStoredToken(token);
      // strip token from URL without reload
      try {
        var u = new URL(global.location.href);
        u.searchParams.delete("grudge_token");
        u.searchParams.delete("token");
        global.history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (e) {}
    }
    return {
      token: token || getStoredToken(),
      hero: qs("hero") || qs("prefabId"),
      characterId: qs("characterId"),
      deckId: qs("deckId"),
      islandId: qs("islandId"),
      primary: qs("primary"),
      secondary: qs("secondary"),
    };
  }

  function authHeaders(token) {
    var h = { Accept: "application/json", "Content-Type": "application/json" };
    if (token) {
      h.Authorization = "Bearer " + token;
      h["X-Grudge-Token"] = token;
    }
    return h;
  }

  async function apiGet(path, token) {
    var res = await fetch(API + path, {
      credentials: "include",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () {
        return { error: res.statusText };
      });
      throw new Error(err.error || "HTTP " + res.status);
    }
    return res.json();
  }

  async function apiSend(method, path, body, token) {
    var res = await fetch(API + path, {
      method: method,
      credentials: "include",
      headers: authHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      var err = await res.json().catch(function () {
        return { error: res.statusText };
      });
      throw new Error(err.error || "HTTP " + res.status);
    }
    return res.json();
  }

  /**
   * Exchange short launch JWT for longer session cookie (best-effort).
   */
  async function exchangeLaunchToken(token) {
    try {
      var data = await apiSend(
        "POST",
        "/api/auth/session/exchange",
        { token: token, audience: global.location.origin },
        null,
      );
      if (data && data.token) setStoredToken(data.token);
      return data;
    } catch (e) {
      return null;
    }
  }

  async function hydrate(options) {
    options = options || {};
    var launch = captureLaunchQuery();
    var token = options.token || launch.token;
    var apiHost = options.apiHost || API;
    if (options.apiHost) API = String(options.apiHost).replace(/\/$/, "");

    // Prefer exchanging launch token once so cookie works for subsequent calls
    if (token && token.split(".").length === 3) {
      await exchangeLaunchToken(token);
      token = getStoredToken() || token;
    }

    var player = null;
    var universe = null;
    var playSettings = null;
    var errors = [];

    try {
      player = await apiGet("/api/auth/me", token);
    } catch (e) {
      errors.push("me: " + (e && e.message));
    }

    try {
      universe = await apiGet("/api/me/universe", token);
    } catch (e) {
      errors.push("universe: " + (e && e.message));
    }

    try {
      var ps = await apiGet("/api/me/play-settings", token);
      playSettings = ps.settings || ps;
    } catch (e) {
      errors.push("play-settings: " + (e && e.message));
    }

    var activeCharacter =
      (universe &&
        universe.characters &&
        universe.characters.find(function (c) {
          return c.isActive;
        })) ||
      (universe && universe.characters && universe.characters[0]) ||
      null;

    if (launch.characterId && universe && universe.characters) {
      var byId = universe.characters.find(function (c) {
        return String(c.id) === String(launch.characterId);
      });
      if (byId) activeCharacter = byId;
    }
    if (launch.hero && universe && universe.characters) {
      var byHero = universe.characters.find(function (c) {
        return c.prefabId === launch.hero;
      });
      if (byHero) activeCharacter = byHero;
    }

    var activeDeck =
      (universe &&
        universe.decks &&
        universe.decks.find(function (d) {
          return d.isActive;
        })) ||
      (universe && universe.decks && universe.decks[0]) ||
      null;
    if (launch.deckId && universe && universe.decks) {
      var deckHit = universe.decks.find(function (d) {
        return String(d.id) === String(launch.deckId);
      });
      if (deckHit) activeDeck = deckHit;
    }

    var homeIsland =
      (universe &&
        universe.islands &&
        universe.islands.find(function (i) {
          return i.isHome;
        })) ||
      (universe && universe.islands && universe.islands[0]) ||
      null;
    if (launch.islandId && universe && universe.islands) {
      var isl = universe.islands.find(function (i) {
        return String(i.id) === String(launch.islandId);
      });
      if (isl) homeIsland = isl;
    }

    var state = {
      ok: !!(player || universe),
      apiHost: API,
      token: getStoredToken(),
      launch: launch,
      player: player,
      universe: universe,
      playSettings: playSettings,
      activeCharacter: activeCharacter,
      activeDeck: activeDeck,
      homeIsland: homeIsland,
      errors: errors,
      hydratedAt: new Date().toISOString(),
    };

    try {
      global.localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    } catch (e) {}

    global.__GRUDGE_UNIVERSE__ = state;
    try {
      global.dispatchEvent(new CustomEvent("grudge:universe:ready", { detail: state }));
    } catch (e) {}

    return state;
  }

  function getCached() {
    try {
      var raw = global.localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function putSave(gameKey, progress, slot) {
    return apiSend(
      "PUT",
      "/api/me/saves",
      { gameKey: gameKey, slot: slot || 0, progress: progress },
      getStoredToken(),
    );
  }

  function patchPlaySettings(settings) {
    return apiSend("PATCH", "/api/me/play-settings", { settings: settings }, getStoredToken());
  }

  var api = {
    API: API,
    hydrate: hydrate,
    getCached: getCached,
    getToken: getStoredToken,
    putSave: putSave,
    patchPlaySettings: patchPlaySettings,
    captureLaunchQuery: captureLaunchQuery,
  };

  global.GrudgeUniverse = api;

  if (global.GRUDGE_UNIVERSE_AUTO !== false) {
    // Auto hydrate after DOM ready
    if (global.document && global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", function () {
        hydrate().catch(function () {});
      });
    } else {
      hydrate().catch(function () {});
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
