/**
 * Grudge Game API Gateway — Cloudflare Worker
 *
 * Host: api.grudge-studio.com
 *
 * This is NOT The-ENGINE portal SPA and NOT player-bag SSOT by itself.
 * - `/` `/health` `/api/*`  → Railway grudge-api (player JSON)
 * - `/assets*` `/gamedata*` → sibling Worker `grudge-asset-api` (more-specific CF routes)
 * - `/lobby*` `/lobbies`    → grudge-game-servers service binding
 *
 * Do not point BACKEND_URL at:
 *   - the-engine.up.railway.app (portal; `/` 302s to HTML)
 *   - grudge-api-production.up.railway.app (dead hostname; serves marketing HTML)
 *
 * Deploy:
 *   cd deploy/game-api-gateway
 *   npx wrangler deploy
 */

export interface Env {
  BACKEND_URL: string;
  ALLOWED_ORIGINS: string;
  GAME_SERVERS?: Fetcher;
}

/** Player characters / bag / island / wallet — Railway Postgres. */
const PLAYER_API = "https://grudge-api-production-0d46.up.railway.app";

const HTML_SPA_BACKENDS = [
  "https://the-engine.up.railway.app",
  "https://grudge-api-production.up.railway.app",
];

const DEFAULT_ALLOWED_ORIGINS = [
  "https://grudgewarlords.com",
  "https://www.grudgewarlords.com",
  "https://client.grudge-studio.com",
  "https://grudge-studio.com",
  "https://id.grudge-studio.com",
  "https://dash.grudge-studio.com",
  "https://open.grudge-studio.com",
  "https://grudox.grudge-studio.com",
  "https://forge.grudge-studio.com",
  "https://character.grudge-studio.com",
  "https://wallet.grudge-studio.com",
  "https://coder.grudge-studio.com",
  "https://grudge-studio-dash.pages.dev",
  "https://grudgedot.pages.dev",
  "https://grudge-crafting.puter.site",
  "https://grudgewarlords.puter.site",
  "https://grudgestudio.puter.site",
  "https://grudgeplatform.com",
  "https://molochdagod.github.io",
  "https://puter.com",
  "https://app.puter.com",
  "http://localhost:5173",
  "http://localhost:5000",
];

function getAllowedOrigins(env: Env): Set<string> {
  const raw = env.ALLOWED_ORIGINS || "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return new Set(list.length > 0 ? list : DEFAULT_ALLOWED_ORIGINS);
}

function originAllowed(origin: string | null, allowed: Set<string>): boolean {
  if (!origin) return false;
  if (allowed.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === "grudge-studio.com" || host.endsWith(".grudge-studio.com")) return true;
    if (host === "grudgewarlords.com" || host.endsWith(".grudgewarlords.com")) return true;
    if (host.endsWith(".vercel.app")) return true;
    if (host.endsWith(".puter.site") || host.endsWith(".puter.work")) return true;
    if (host === "localhost" || host === "127.0.0.1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function corsHeaders(origin: string | null, allowed: Set<string>): Record<string, string> {
  if (!originAllowed(origin, allowed)) return {};
  return {
    "Access-Control-Allow-Origin": origin as string,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Session-Token, X-Puter-Token, X-Request-ID, X-Admin-Token",
    Vary: "Origin",
  };
}

function json(
  body: unknown,
  status: number,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

/**
 * Never send traffic to the portal SPA or the dead `grudge-api-production`
 * hostname (no -0d46). Those return 200 text/html for API paths.
 */
function resolveBackend(env: Env): string {
  const raw = (env.BACKEND_URL || PLAYER_API).replace(/\/$/, "");
  if (!raw || HTML_SPA_BACKENDS.includes(raw)) return PLAYER_API;
  if (raw === PLAYER_API) return PLAYER_API;
  // Any other grudge-api-production* host without 0d46 is the HTML ghost.
  if (/grudge-api-production(?!-0d46)/.test(raw)) return PLAYER_API;
  return raw;
}

/**
 * Satellite vercel.json often rewrites `/api/:path*` → `api.grudge-studio.com/:path*`
 * (strips `/api`). Railway grudge-api mounts REST under `/api/*`.
 * `/health` on Railway is 404; `/api/health` is the live probe.
 */
function mapUpstreamPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return "/";
  if (p === "/health" || p === "/healthz") return "/api/health";
  if (p === "/api") return "/api/health";
  if (p.startsWith("/api/")) return p;
  return `/api${p}`;
}

function looksLikeHtml(contentType: string | null): boolean {
  return (contentType || "").toLowerCase().includes("text/html");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = getAllowedOrigins(env);
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const isGameServersPath =
      url.pathname === "/lobbies" ||
      url.pathname === "/lobby" ||
      url.pathname.startsWith("/lobby/");
    if (isGameServersPath) {
      if (!env.GAME_SERVERS) {
        return json(
          { error: "Lobby service unavailable — GAME_SERVERS binding missing" },
          503,
          cors,
        );
      }
      const lobbyResponse = await env.GAME_SERVERS.fetch(request);
      const headers = new Headers(lobbyResponse.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(lobbyResponse.body, {
        status: lobbyResponse.status,
        statusText: lobbyResponse.statusText,
        headers,
        webSocket: lobbyResponse.webSocket,
      });
    }

    const upstreamBase = resolveBackend(env);

    if (url.pathname === "/__edge/health") {
      return json(
        {
          ok: true,
          worker: "grudge-game-api",
          backend: upstreamBase,
          assets: "https://api.grudge-studio.com/assets",
          time: new Date().toISOString(),
        },
        200,
        cors,
      );
    }

    // Visiting the API host in a browser must never dump The-ENGINE marketing HTML.
    if ((url.pathname === "/" || url.pathname === "") && request.method === "GET") {
      return json(
        {
          service: "grudge-game-api",
          status: "ok",
          playerApi: upstreamBase,
          health: "/api/health",
          assets: "/assets",
          gamedata: "/gamedata/:key",
          note: "D1 index is /assets. Player bag/characters are Railway /api/* — not this HTML portal.",
        },
        200,
        cors,
      );
    }

    const upstreamPath = mapUpstreamPath(url.pathname);
    const upstreamUrl = upstreamBase + upstreamPath + url.search;

    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set("Host", new URL(upstreamBase).host);
    upstreamHeaders.set("X-Forwarded-Host", url.host);
    upstreamHeaders.set("X-Forwarded-Proto", "https");
    upstreamHeaders.set("X-Gateway", "grudge-game-api");

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
        redirect: "manual",
      });
    } catch (err) {
      return json(
        { error: "Gateway error — Railway backend unreachable", detail: String(err) },
        502,
        cors,
      );
    }

    if (looksLikeHtml(upstreamResponse.headers.get("content-type"))) {
      const status = upstreamResponse.status === 404 ? 404 : 502;
      return json(
        {
          error:
            status === 404
              ? "Not found"
              : "API upstream served HTML — refused (wrong Railway app or SPA fallback)",
          backend: upstreamBase,
          path: upstreamPath,
        },
        status,
        cors,
      );
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const [k, v] of Object.entries(cors)) responseHeaders.set(k, v);
    responseHeaders.set("X-Gateway", "grudge-game-api");
    responseHeaders.set("X-Gateway-Upstream", upstreamBase);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
