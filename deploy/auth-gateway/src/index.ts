/**
 * Grudge Auth Gateway – Cloudflare Worker
 *
 * Proxies all requests from id.grudge-studio.com → the-engine.up.railway.app
 *
 * Extra responsibilities:
 *  - Dynamic CORS for trusted origins (from ALLOWED_ORIGINS env var)
 *  - Path alias: /auth/* → /api/auth/*
 *  - Serves canonical sign-in HTML at the edge (GET /api/auth/page)
 *  - Forwards cookies and credentials transparently
 */

import { AUTH_PAGE_HTML } from "./auth-page-bundled";

export interface Env {
  BACKEND_URL: string;       // https://the-engine.up.railway.app
  ALLOWED_ORIGINS: string;   // comma-separated list of trusted origins
  PORTAL_ORIGIN?: string;    // Vercel SPA — grudge-studio.com
}

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
  "http://localhost:5173",
  "http://localhost:5000",
];

function isAuthPagePath(pathname: string): boolean {
  return pathname === "/api/auth/page" || pathname === "/api/auth/popup";
}

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = getAllowedOrigins(env);

    // Handle CORS pre-flight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowed),
      });
    }

    // Path alias: /auth/* → /api/auth/*
    if (url.pathname.startsWith("/auth/") && url.pathname !== "/auth") {
      url.pathname = "/api" + url.pathname;
    }

    // id.grudge-studio.com — auth only; portal SPA lives on grudge-studio.com (Vercel)
    if (url.host === "id.grudge-studio.com") {
      const portal = (env.PORTAL_ORIGIN || "https://grudge-studio.com").replace(/\/$/, "");
      const isApi = url.pathname.startsWith("/api/");
      const isAuth =
        url.pathname === "/" ||
        url.pathname === "/index.html" ||
        url.pathname === "/login" ||
        url.pathname === "/auth" ||
        url.pathname.startsWith("/auth/") ||
        url.pathname.startsWith("/api/auth");

      if (!isApi && !isAuth) {
        return Response.redirect(`${portal}${url.pathname}${url.search}`, 302);
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        url.pathname = "/api/auth/page";
      } else if (url.pathname === "/api/auth" || url.pathname === "/auth") {
        const accept = request.headers.get("accept") || "";
        const wantsJson = accept.includes("application/json") && !accept.includes("text/html");
        if (!wantsJson) {
          url.pathname = "/api/auth/page";
        }
      }
    }

    // Serve fixed sign-in HTML at the edge (Railway may still ship the broken regex build)
    if (request.method === "GET" && isAuthPagePath(url.pathname)) {
      return new Response(AUTH_PAGE_HTML, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
          "X-Grudge-Auth-Page": "edge-v2",
          ...corsHeaders(origin, allowed),
        },
      });
    }

    // Build the upstream URL
    const backendBase = (env.BACKEND_URL || "https://the-engine.up.railway.app").replace(/\/$/, "");
    const upstreamUrl = backendBase + url.pathname + url.search;

    // Forward the request – clone headers and strip host so Railway accepts it
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set("Host", new URL(backendBase).host);
    // Let Railway know the real origin domain
    upstreamHeaders.set("X-Forwarded-Host", url.host);
    upstreamHeaders.set("X-Forwarded-Proto", "https");

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
        redirect: "manual", // pass 3xx through to the browser
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Gateway error", detail: String(err) }), {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(origin, allowed),
        },
      });
    }

    // Build response with merged CORS headers
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
