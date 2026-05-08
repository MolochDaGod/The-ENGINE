/**
 * Grudge Game API Gateway — Cloudflare Worker
 *
 * Proxies all requests from api.grudge-studio.com → the-engine.up.railway.app
 *
 * This Worker replaces the dead VPS Cloudflare Tunnel that previously served
 * api.grudge-studio.com. Now both id.grudge-studio.com (auth) and
 * api.grudge-studio.com (game API) route to the same Railway backend.
 *
 * Deploy:
 *   cd deploy/game-api-gateway
 *   npx wrangler deploy
 *
 * Before deploying:
 *   1. The api.grudge-studio.com DNS record in Cloudflare must be a proxied
 *      A record (e.g. 192.0.2.1) or AAAA (100::) — just needs to exist so
 *      the Worker route can attach to it. The old tunnel record works fine.
 *   2. Delete or disable the old Cloudflare Tunnel for api.grudge-studio.com
 *      in Zero Trust → Tunnels so it doesn't conflict.
 */

export interface Env {
  BACKEND_URL: string;
  ALLOWED_ORIGINS: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://grudgewarlords.com",
  "https://www.grudgewarlords.com",
  "https://client.grudge-studio.com",
  "https://grudge-studio.com",
  "https://id.grudge-studio.com",
  "https://dash.grudge-studio.com",
  "https://grudge-studio-dash.pages.dev",
  "https://grudgedot.pages.dev",
  "https://grudge-crafting.puter.site",
  "https://grudgewarlords.puter.site",
  "https://grudgestudio.puter.site",
  "https://grudgeplatform.com",
  "https://wallet.grudge-studio.com",
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

function corsHeaders(origin: string | null, allowed: Set<string>): Record<string, string> {
  if (!origin || !allowed.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token, X-Puter-Token, X-Request-ID",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = getAllowedOrigins(env);

    // CORS pre-flight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowed),
      });
    }

    // Edge health check — responds without hitting Railway
    if (url.pathname === "/__edge/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          worker: "grudge-game-api",
          backend: env.BACKEND_URL,
          time: new Date().toISOString(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin, allowed),
          },
        }
      );
    }

    // Build upstream URL — forward path + query as-is to Railway
    const backendBase = (env.BACKEND_URL || "https://the-engine.up.railway.app").replace(/\/$/, "");
    const upstreamUrl = backendBase + url.pathname + url.search;

    // Forward request with proper headers
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set("Host", new URL(backendBase).host);
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
      return new Response(
        JSON.stringify({ error: "Gateway error — Railway backend unreachable", detail: String(err) }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin, allowed),
          },
        }
      );
    }

    // Merge CORS headers into response
    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin, allowed))) {
      responseHeaders.set(k, v);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
