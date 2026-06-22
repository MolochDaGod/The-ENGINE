/*!
 * Grudge Studio unified auth — embed script
 *
 * Usage:
 *   <script src="https://id.grudge-studio.com/embed/auth.js" defer></script>
 *   <button onclick="GrudgeAuth.open().then(({ token, player }) => { ... })">
 *     Sign in with Grudge
 *   </button>
 *
 * Opens the canonical Grudge ID page at id.grudge-studio.com/api/auth/page in a popup.
 * On success the popup postMessages a short-lived launch JWT + profile back.
 * Exchange via POST /api/auth/session/exchange on your backend, or use bridgeGrudgeLaunchToken.
 */
(function (global) {
  var DEFAULT_HOST = "https://id.grudge-studio.com";
  var POPUP_PATH = "/api/auth/page";

  function buildPopupUrl(authHost, audience, redirect) {
    var params = new URLSearchParams();
    params.set("origin", audience);
    if (redirect) params.set("redirect", redirect);
    return authHost + POPUP_PATH + "?" + params.toString();
  }

  function parseAuthMessage(data) {
    if (!data || typeof data !== "object" || !data.token) return null;
    if (data.type === "grudge-auth:success") {
      return { token: data.token, player: data.user || data.player || null };
    }
    if (data.type === "grudge:auth:success") {
      return { token: data.token, player: data.player || data.user || null };
    }
    return null;
  }

  function isTrustedAuthOrigin(eventOrigin, authHost) {
    if (!eventOrigin) return false;
    if (eventOrigin === authHost) return true;
    if (eventOrigin === "https://grudge-studio.com") return true;
    if (eventOrigin === "https://grudgewarlords.com") return true;
    if (/^https:\/\/([a-z0-9-]+\.)*grudge-studio\.com$/.test(eventOrigin)) return true;
    return false;
  }

  function open(options) {
    options = options || {};
    var authHost = (options.authHost || DEFAULT_HOST).replace(/\/$/, "");
    var audience = options.audience || global.location.origin;
    var redirect = options.redirect || null;
    var width = options.width || 440;
    var height = options.height || 720;
    var left = (global.screenX || 0) + ((global.outerWidth - width) / 2);
    var top = (global.screenY || 0) + ((global.outerHeight - height) / 2);

    return new Promise(function (resolve, reject) {
      var popup = global.open(
        buildPopupUrl(authHost, audience, redirect),
        "grudge-auth",
        "width=" + width + ",height=" + height + ",left=" + left + ",top=" + top + ",popup=yes"
      );
      if (!popup) return reject(new Error("Popup blocked — allow popups for this site or use redirect sign-in"));

      function sendInit() {
        try { popup.postMessage({ type: "grudge-auth:init", origin: audience }, authHost); } catch (e) {}
      }

      function cleanup() {
        global.removeEventListener("message", onMessage);
        if (popup && !popup.closed) { try { popup.close(); } catch (e) {} }
        clearInterval(poll);
        clearInterval(initRetry);
      }

      function onMessage(event) {
        if (!isTrustedAuthOrigin(event.origin, authHost)) return;
        var data = event.data;
        if (data && data.type === "grudge-auth:ready") {
          sendInit();
          return;
        }
        if (data && data.type === "grudge:auth:error") {
          cleanup();
          reject(new Error(data.error || "Authentication failed"));
          return;
        }
        if (data && data.type === "grudge:auth:cancel") {
          cleanup();
          reject(new Error("Authentication cancelled"));
          return;
        }
        var parsed = parseAuthMessage(data);
        if (parsed) {
          cleanup();
          resolve({ token: parsed.token, player: parsed.player, audience: audience });
        }
      }

      var poll = setInterval(function () {
        if (popup.closed) {
          cleanup();
          reject(new Error("Popup closed before authentication finished"));
        }
      }, 500);

      var initRetry = setInterval(sendInit, 400);
      setTimeout(function () { clearInterval(initRetry); }, 4000);

      global.addEventListener("message", onMessage);
      sendInit();
    });
  }

  function whoami(options) {
    options = options || {};
    var apiHost = (options.apiHost || DEFAULT_HOST).replace(/\/$/, "");
    return fetch(apiHost + "/api/auth/me", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function ensure(options) {
    return whoami(options).then(function (player) {
      if (player) return { player: player, token: null, audience: null };
      return open(options);
    });
  }

  global.GrudgeAuth = { open: open, whoami: whoami, ensure: ensure, version: "3" };
})(window);