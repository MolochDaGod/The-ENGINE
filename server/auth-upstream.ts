/**
 * id.grudge-studio.com → canonical Grudge ID (The-ENGINE Railway).
 * Prevents split-brain auth when the identity domain points at The-ENGINE Railway.
 */
import type { Express, Request, Response } from "express";

export const GRUDGE_AUTH_UPSTREAM =
  process.env.GRUDGE_AUTH_UPSTREAM ||
  "https://the-engine.up.railway.app";

const LOGO_URL = "https://grudge-studio.com/grudge-logo.png";

function isIdentityHost(req: Request): boolean {
  const host = (req.get("x-forwarded-host") || req.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return host === "id.grudge-studio.com";
}

function shouldProxyAuth(path: string): boolean {
  return (
    path === "/login" ||
    path === "/auth" ||
    path.startsWith("/api/auth") ||
    path.startsWith("/auth/")
  );
}

async function proxyToUpstream(req: Request, res: Response): Promise<void> {
  const url = `${GRUDGE_AUTH_UPSTREAM}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || key === "host" || key === "connection") continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("x-forwarded-host", "id.grudge-studio.com");
  headers.set("x-grudge-auth-proxy", "the-engine");

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
    const body =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body
          : JSON.stringify(req.body);
    init.body = body;
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  try {
    const upstream = await fetch(url, init);
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key === "transfer-encoding" || key === "connection") return;
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error("[auth-upstream] proxy failed:", err);
    res.status(502).json({
      success: false,
      error: "Grudge ID service unavailable",
      upstream: GRUDGE_AUTH_UPSTREAM,
    });
  }
}

export function mountAuthUpstreamProxy(app: Express): void {
  app.use((req, res, next) => {
    if (!isIdentityHost(req)) return next();

    if (req.path === "/grudge-logo.png") {
      return res.redirect(302, LOGO_URL);
    }

    if (shouldProxyAuth(req.path)) {
      return void proxyToUpstream(req, res);
    }

    if (req.path === "/" || req.path === "/index.html") {
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(302, `/api/auth/page${qs}`);
    }

    next();
  });
}