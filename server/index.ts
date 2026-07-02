import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { AUTH_PAGE_HTML } from "./auth-page-html";

const app = express();
const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.CORS_ORIGINS || [
  "https://grudge-studio.com",
  "https://grudgewarlords.com",
  "https://forge.grudge-studio.com",
  "https://studio-forge.vercel.app",
  "https://id.grudge-studio.com",
  "https://client.grudge-studio.com",
  "https://dash.grudge-studio.com",
  "https://ui.grudge-studio.com",
  "https://characters.grudge-studio.com",
  "https://nexus-nemesis-game.vercel.app",
  "https://the-engine.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
].join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// ── Trust proxy (Railway / Vercel) ─────────────────────────────
if (isProd) app.set("trust proxy", 1);

// ── Compression — gzip all responses (huge win for 3D game assets)
app.use(compression());

// ── Security headers via helmet ────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,          // managed per-route by the game
  crossOriginEmbedderPolicy: false,      // required for SharedArrayBuffer / game workers
  crossOriginResourcePolicy: { policy: "cross-origin" },  // allow CDN asset loading
}));

// ── CORS ────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / server-to-server
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/([a-z0-9-]+\.)*grudge-studio\.com$/.test(origin) ||
      origin.includes("puter.com") ||
      origin.includes("puter.site") ||
      /^https:\/\/.*\.vercel\.app$/.test(origin) ||
      origin.startsWith("http://localhost:")
    ) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
// ── Grudge ID auth page ──────────────────────────────────────────────────────
// Prefer public/grudge-id.html on disk (no regex-escape corruption in bundles).
function loadAuthPageHtml(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", "public", "grudge-id.html"),
    path.resolve(process.cwd(), "public", "grudge-id.html"),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
    } catch { /* try next */ }
  }
  return AUTH_PAGE_HTML;
}
const AUTH_PAGE_HTML_LIVE = loadAuthPageHtml();
function sendAuthPage(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.type("html").send(AUTH_PAGE_HTML_LIVE);
}
app.get("/api/auth/page", sendAuthPage);
app.get("/api/auth/popup", sendAuthPage);

// Bare /api/auth — discovery JSON for API clients; browsers → sign-in page
function sendAuthDiscovery(req: Request, res: Response) {
  const accept = req.get("accept") || "";
  const wantsHtml = accept.includes("text/html") && !accept.includes("application/json");
  if (wantsHtml) {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(302, `/api/auth/page${qs}`);
  }
  const idHost = process.env.AUTH_POPUP_HOST || "https://id.grudge-studio.com";
  res.json({
    success: true,
    service: "Grudge ID",
    version: "2.0.0",
    authPage: `${idHost}/api/auth/page`,
    embedScript: `${idHost}/embed/auth.js`,
    endpoints: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      guest: "POST /api/auth/guest",
      me: "GET /api/auth/me",
      logout: "POST /api/auth/logout",
      puterSso: "POST /api/auth/puter-sso",
      sessionExchange: "POST /api/auth/session/exchange",
      popupToken: "POST /api/auth/popup-token",
      discord: "GET /api/auth/discord/start",
      google: "GET /api/auth/google/start",
      github: "GET /api/auth/github/start",
      phantomNonce: "POST /api/auth/phantom/nonce",
      phantomVerify: "POST /api/auth/phantom/verify",
      twilioStart: "POST /api/auth/twilio/start",
      twilioVerify: "POST /api/auth/twilio/verify",
    },
    providers: {
      password: true,
      guest: true,
      puter: true,
      wallet: true,
      discord: !!process.env.DISCORD_CLIENT_ID,
      google: !!process.env.GOOGLE_CLIENT_ID,
      github: !!process.env.GITHUB_CLIENT_ID,
      phone: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_VERIFY_SERVICE_SID),
    },
    idDomain: idHost,
    apiDomain: process.env.GAME_API_HOST || "https://api.grudge-studio.com",
  });
}
app.get("/api/auth", sendAuthDiscovery);
app.get("/auth", sendAuthDiscovery);

// id.grudge-studio.com root → sign-in (Railway proxy strips Host; use X-Forwarded-Host)
app.use((req, res, next) => {
  const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  if (
    host === "id.grudge-studio.com" &&
    (req.path === "/" || req.path === "/index.html")
  ) {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(302, `/api/auth/page${qs}`);
  }
  next();
});

app.get("/login", (req, res) => {
  const redirect = (req.query.redirect_uri || req.query.redirect || "") as string;
  const origin = (req.query.origin as string) || "";
  const params = new URLSearchParams();
  if (redirect) params.set("redirect", redirect);
  if (origin) params.set("origin", origin);
  const qs = params.toString();
  res.redirect(302, `/api/auth/page${qs ? `?${qs}` : ""}`);
});

// ── Path alias: /auth/* → /api/auth/* ──────────────────────
app.use((req, _res, next) => {
  if (req.url.startsWith("/auth/")) req.url = "/api" + req.url;
  next();
});

// ── Favicon ────────────────────────────────────────────────────
app.get("/favicon.ico", (_req, res) => res.redirect(301, "/favicon.png"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
