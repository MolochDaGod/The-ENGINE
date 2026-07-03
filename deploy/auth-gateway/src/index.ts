/**
 * Grudge Auth Gateway – Cloudflare Worker
 *
 * id.grudge-studio.com → canonical Grudge ID API (grudge-api-production).
 * One login surface for the whole fleet — no split-brain with The-ENGINE.
 */

export interface Env {
  /** Canonical auth API (grudge-builder Railway) */
  AUTH_UPSTREAM: string;
  /** Legacy fallback — unused for id host auth routes */
  BACKEND_URL: string;
  ALLOWED_ORIGINS: string;
  PORTAL_ORIGIN?: string;
}

const DEFAULT_AUTH_UPSTREAM = "https://grudge-api-production-0d46.up.railway.app";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://grudge-studio.com",
  "https://id.grudge-studio.com",
  "https://grudgewarlords.com",
  "https://grudgeplatform.com",
  "https://dungeon-crawler-quest.vercel.app",
  "https://warlord-crafting-suite.vercel.app",
  "https://grudgestudio.puter.site",
  "https://grudge-studio.puter.site",
  "https://grudgeplatform.puter.site",
  "https://puter.com",
  "https://app.puter.com",
  "https://grudge-crafting.puter.site",
  "https://dash.grudge-studio.com",
  "https://wallet.grudge-studio.com",
  "https://client.grudge-studio.com",
  "https://nexus.grudge-studio.com",
  "http://localhost:5173",
  "http://localhost:5000",
];

function getAllowedOrigins(env: Env): Set<string> {
  const raw = env.ALLOWED_ORIGINS || "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const combined = list.length > 0 ? list : DEFAULT_ALLOWED_ORIGINS;
  return new Set(combined);
}

function corsHeaders(origin: string | null, allowed: Set<string>): HeadersInit {
  if (!origin || !allowed.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
    "Vary": "Origin",
  };
}

function isAuthRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/login" ||
    pathname === "/account" ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/me")
  );
}

function normalizeIdHostPath(url: URL): void {
  if (url.pathname === "/" || url.pathname === "/index.html") {
    url.pathname = "/api/auth/page";
    return;
  }
  if (url.pathname === "/api/auth" || url.pathname === "/auth") {
    url.pathname = "/api/auth/page";
    return;
  }
  // Legacy fleet bootstrap: /auth/sso-check → grudge-api alias
  if (url.pathname.startsWith("/auth/")) {
    url.pathname = "/api" + url.pathname;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = getAllowedOrigins(env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowed),
      });
    }

    const portal = (env.PORTAL_ORIGIN || "https://grudge-studio.com").replace(/\/$/, "");

    if (url.host === "id.grudge-studio.com") {
      const isApi = url.pathname.startsWith("/api/");
      const isAuth = isAuthRoute(url.pathname);

      if (!isApi && !isAuth) {
        return Response.redirect(`${portal}${url.pathname}${url.search}`, 302);
      }

      normalizeIdHostPath(url);
    } else if (url.pathname.startsWith("/auth/") && url.pathname !== "/auth") {
      url.pathname = "/api" + url.pathname;
    }

    const authUpstream = (env.AUTH_UPSTREAM || DEFAULT_AUTH_UPSTREAM).replace(/\/$/, "");
    const upstreamBase =
      url.host === "id.grudge-studio.com" && isAuthRoute(url.pathname)
        ? authUpstream
        : (env.BACKEND_URL || "https://the-engine.up.railway.app").replace(/\/$/, "");

    const upstreamUrl = upstreamBase + url.pathname + url.search;

    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set("Host", new URL(upstreamBase).host);
    upstreamHeaders.set("X-Forwarded-Host", "id.grudge-studio.com");
    upstreamHeaders.set("X-Forwarded-Proto", "https");
    upstreamHeaders.set("X-Grudge-Auth-Gateway", "identity-v3");

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
        JSON.stringify({ error: "Grudge ID gateway error", detail: String(err) }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin, allowed),
          },
        },
      );
    }

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