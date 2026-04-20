/*!
 * Grudge Studio unified auth — embed script
 *
 * Usage (drop onto any allowlisted frontend, e.g. grudgeplatform.io):
 *
 *   <script src="https://grudge-studio.com/embed/auth.js" defer></script>
 *   <button onclick="GrudgeAuth.open().then(({ token, player }) => { ... })">
 *     Sign in with Grudge
 *   </button>
 *
 * The popup shows the same modal used across grudge-studio.com and
 * grudgewarlords.com. On success it postMessages back a 5-minute JWT
 * launch token plus the PlayerProfile. Exchange that token with your
 * own backend (POST /api/auth/session/exchange { token }) or attach it
 * as Authorization: Bearer <token> when calling api.grudge-studio.com.
 *
 * The caller's origin must be in AUTH_ALLOWED_ORIGINS on the server.
 */
(function (global) {
  var DEFAULT_HOST = "https://grudge-studio.com";

  function open(options) {
    options = options || {};
    var authHost = (options.authHost || DEFAULT_HOST).replace(/\/$/, "");
    var audience = options.audience || global.location.origin;
    var width = options.width || 420;
    var height = options.height || 640;
    var left = (global.screenX || 0) + ((global.outerWidth - width) / 2);
    var top = (global.screenY || 0) + ((global.outerHeight - height) / 2);

    return new Promise(function (resolve, reject) {
      var popup = global.open(
        authHost + "/auth/popup?audience=" + encodeURIComponent(audience),
        "grudge-auth",
        "width=" + width + ",height=" + height + ",left=" + left + ",top=" + top + ",popup=yes"
      );
      if (!popup) return reject(new Error("Popup blocked"));

      function cleanup() {
        global.removeEventListener("message", onMessage);
        if (popup && !popup.closed) { try { popup.close(); } catch (e) {} }
        clearInterval(poll);
      }

      function onMessage(event) {
        if (event.origin !== authHost) return;
        var data = event.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "grudge:auth:success" && data.token && data.player) {
          cleanup();
          resolve({ token: data.token, player: data.player, audience: data.audience });
        } else if (data.type === "grudge:auth:error") {
          cleanup();
          reject(new Error(data.error || "Authentication failed"));
        } else if (data.type === "grudge:auth:cancel") {
          cleanup();
          reject(new Error("Authentication cancelled"));
        }
      }

      var poll = setInterval(function () {
        if (popup.closed) {
          cleanup();
          reject(new Error("Popup closed before authentication finished"));
        }
      }, 500);

      global.addEventListener("message", onMessage);
    });
  }

  global.GrudgeAuth = { open: open, version: "1" };
})(window);
