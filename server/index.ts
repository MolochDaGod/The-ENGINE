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
// ── Serve Grudge ID auth page for id.grudge-studio.com ────────────
import path from "path";
app.get("/", (req, res, next) => {
  const host = req.hostname || req.headers.host || "";
  if (host === "id.grudge-studio.com" || host.startsWith("id.grudge-studio.com:")) {
    return res.sendFile(path.resolve("public/grudge-id.html"));
  }
  next();
});
// Serve the auth page at /grudge-id for direct access from any host
app.get("/grudge-id", (_req, res) => {
  res.sendFile(path.resolve("public/grudge-id.html"));
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
