import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.CORS_ORIGINS || [
  "https://grudge-studio.com",
  "https://grudgewarlords.com",
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
      /^https:\/\/[a-z0-9-]+\.grudge-studio\.com$/.test(origin) ||  // all *.grudge-studio.com subdomains
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
// ── Serve Grudge ID auth page (inlined HTML — no filesystem dependency) ────
import { AUTH_PAGE_HTML } from "./auth-page-html";
// Intercept id.grudge-studio.com at the top level — runs before Vite/static.
app.use((req, res, next) => {
  // Resolve hostname from all possible sources (CF Tunnel, Railway proxy, direct)
  const host = (
    req.get("host") ||
    req.hostname ||
    (req.headers["x-forwarded-host"] as string) ||
    ""
  ).replace(/:\d+$/, "");
  // Serve auth page at root of id.grudge-studio.com
  if (host === "id.grudge-studio.com" && (req.path === "/" || req.path === "/index.html")) {
    return res.type("html").send(AUTH_PAGE_HTML);
  }
  next();
});
app.get("/api/auth/page", (_req, res) => { res.type("html").send(AUTH_PAGE_HTML); });
// Diagnostic: see what hostname the server resolves (remove after debugging)
app.get("/api/debug/host", (req, res) => {
  res.json({
    hostname: req.hostname,
    host_header: req.headers.host,
    x_forwarded_host: req.headers["x-forwarded-host"],
    get_host: req.get("host"),
    resolved: (req.get("host") || req.hostname || "").replace(/:\d+$/, ""),
  });
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
