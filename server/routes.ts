import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupArenaRooms } from "./arena-rooms";
import { storage } from "./storage";
import { insertScrapingJobSchema, insertOrderSchema, insertGameSchema, insertArticleSchema, gameLibrary, scores, users } from "@shared/schema";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  loadPlayer, requirePlayer, getPlayer,
  hashPassword, verifyPassword, generateGrudgeId,
  createPlayerToken, setPlayerCookie, clearPlayerCookie, verifyPlayerToken,
  parseCookies as parsePlayerCookies, PLAYER_COOKIE,
  createLaunchToken, verifyLaunchToken, LAUNCH_TOKEN_TTL_MS,
  allowedAuthOrigins, isOriginAllowed,
} from "./auth";
import { sendDiscordWebhook, DiscordEmbedType, trackNowPlaying } from "./discord-webhooks";

const ADMIN_SESSION_COOKIE = "gs_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

/** Normalize smart/curly punctuation to ASCII so ROM filenames resolve on rec0ded88.com */
function normalizeRomName(name: string): string {
  return name
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u00A0]/g, " ");
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, segment) => {
    const [rawKey, ...rest] = segment.trim().split("=");
    if (!rawKey || rest.length === 0) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function createAdminSessionToken(secret: string) {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  const payload = `${expiresAt}.${crypto.randomBytes(8).toString("hex")}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyAdminSessionToken(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length < 3) return false;

  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return safeCompare(sig, expectedSig);
}

// Mock scraping functionality - in production, use Puppeteer
async function scrapePage(url: string): Promise<{ title: string; content: string; htmlSource: string; links: string[] }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const htmlSource = await response.text();
    const $ = cheerio.load(htmlSource);
    
    // Extract title
    const title = $('title').text() || url;
    
    // Extract main content (remove script, style, nav, footer)
    $('script, style, nav, footer, header').remove();
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    
    // Extract internal links
    const links: string[] = [];
    const baseUrl = new URL(url);
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const linkUrl = new URL(href, baseUrl);
          if (linkUrl.hostname === baseUrl.hostname) {
            links.push(linkUrl.href);
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });
    
    return {
      title,
      content,
      htmlSource,
      links: Array.from(new Set(links)) // Remove duplicates
    };
  } catch (error) {
    throw new Error(`Failed to scrape ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function processScrapingJob(jobId: number) {
  const job = await storage.getScrapingJob(jobId);
  if (!job) return;

  try {
    await storage.updateScrapingJob(jobId, { status: "running" });

    const urlsToScrape = new Set<string>([job.url]);
    const scrapedUrls = new Set<string>();
    const urlsQueue = [job.url];
    
    let currentDepth = 0;
    const maxDepth = job.crawlDepth || 1;
    const maxPages = job.maxPages || 10;

    while (urlsQueue.length > 0 && scrapedUrls.size < maxPages && currentDepth < maxDepth) {
      const currentBatch = [...urlsQueue];
      urlsQueue.length = 0;

      for (const url of currentBatch) {
        if (scrapedUrls.has(url) || scrapedUrls.size >= maxPages) continue;

        try {
          // Rate limiting - wait 1 second between requests
          await new Promise(resolve => setTimeout(resolve, 1000));

          const pageData = await scrapePage(url);
          scrapedUrls.add(url);

          // Save scraped page
          await storage.createScrapedPage({
            jobId: jobId,
            url: url,
            title: pageData.title,
            content: pageData.content,
            htmlSource: pageData.htmlSource,
            contentLength: pageData.content.length,
          });

          // Add new links to queue for next depth level
          if (currentDepth < maxDepth - 1) {
            for (const link of pageData.links) {
              if (!scrapedUrls.has(link) && !urlsToScrape.has(link)) {
                urlsToScrape.add(link);
                urlsQueue.push(link);
              }
            }
          }

          // Update progress
          const progress = Math.round((scrapedUrls.size / Math.min(urlsToScrape.size, maxPages)) * 100);
          await storage.updateScrapingJob(jobId, {
            progress,
            pagesFound: urlsToScrape.size,
            pagesScraped: scrapedUrls.size,
          });

        } catch (error) {
          console.error(`Error scraping ${url}:`, error);
          // Continue with other URLs
        }
      }

      currentDepth++;
    }

    // Get all scraped pages for results
    const scrapedPages = await storage.getScrapedPagesByJobId(jobId);
    const results = scrapedPages.map(page => ({
      url: page.url,
      title: page.title,
      contentLength: page.contentLength,
      scrapedAt: page.scrapedAt,
    }));

    await storage.updateScrapingJob(jobId, {
      status: "completed",
      progress: 100,
      results: results,
      completedAt: new Date(),
    });

  } catch (error) {
    await storage.updateScrapingJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Attach player session to every request (non-blocking)
  app.use(loadPlayer);

  // ═══════════════════════════════════════════════════════════════
  // PLAYER AUTH
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email, displayName } = req.body;
      if (!username || !password || typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "username and password are required" });
      }
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: "username must be 3-30 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "password must be at least 6 characters" });
      }

      // Check uniqueness
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: "Username already taken" });
      if (email) {
        const emailUser = await storage.getUserByEmail(email);
        if (emailUser) return res.status(409).json({ error: "Email already registered" });
      }

      const grudgeId = generateGrudgeId();
      const hashed = hashPassword(password);

      const user = await storage.createUser({
        username,
        password: hashed,
        grudgeId,
        email: email || null,
        displayName: displayName || username,
        puterId: null,
        avatarUrl: null,
        gbuxBalance: "0",
        role: "player",
      });

      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);

      return res.json({
        id: user.id,
        username: user.username,
        grudgeId: user.grudgeId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        gbuxBalance: user.gbuxBalance,
        role: user.role,
      });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);

      return res.json({
        id: user.id,
        username: user.username,
        grudgeId: user.grudgeId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        gbuxBalance: user.gbuxBalance,
        role: user.role,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/lookup", async (req, res) => {
    try {
      const username = typeof req.query.username === "string" ? req.query.username.trim() : "";
      if (!username) return res.status(400).json({ error: "username query is required" });
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ error: "Not found" });
      return res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        grudgeId: user.grudgeId,
      });
    } catch {
      return res.status(500).json({ error: "Lookup failed" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const player = getPlayer(req);
    if (!player) return res.status(401).json({ error: "Not authenticated" });
    return res.json({
      id: player.id,
      username: player.username,
      grudgeId: player.grudgeId,
      puterId: player.puterId,
      email: player.email,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      gbuxBalance: player.gbuxBalance,
      role: player.role,
      createdAt: player.createdAt,
    });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearPlayerCookie(res);
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // UNIFIED QUICK-LINK AUTH: guest, phantom wallet, discord OAuth, twilio phone
  // ═══════════════════════════════════════════════════════════════

  // Shared helpers ------------------------------------------------
  const phantomNonces = new Map<string, { message: string; expiresAt: number }>();
  const PHANTOM_NONCE_TTL_MS = 5 * 60 * 1000;

  const phoneCodes = new Map<string, { code: string; expiresAt: number }>();
  const PHONE_CODE_TTL_MS = 10 * 60 * 1000;

  const discordOauthState = new Map<string, { redirect: string; expiresAt: number }>();
  const DISCORD_STATE_TTL_MS = 10 * 60 * 1000;

  function pruneMap<T extends { expiresAt: number }>(m: Map<string, T>) {
    const now = Date.now();
    const expired: string[] = [];
    m.forEach((v, k) => {
      if (v.expiresAt < now) expired.push(k);
    });
    expired.forEach((k) => m.delete(k));
  }

  function sanitizeUsername(candidate: string): string {
    return candidate.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30) || "player";
  }

  async function uniqueUsername(base: string): Promise<string> {
    const safe = sanitizeUsername(base);
    let attempt = safe;
    let suffix = 0;
    while (await storage.getUserByUsername(attempt)) {
      suffix += 1;
      const tail = suffix.toString();
      attempt = `${safe.slice(0, 30 - tail.length - 1)}_${tail}`;
    }
    return attempt;
  }

  function publicPlayer(user: any, isNew = false) {
    return {
      id: user.id,
      username: user.username,
      grudgeId: user.grudgeId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      gbuxBalance: user.gbuxBalance,
      role: user.role,
      needsProfile: !!user.needsProfile,
      isNew,
    };
  }

  // Guest sign-in -------------------------------------------------
  app.post("/api/auth/guest", async (_req, res) => {
    try {
      const suffix = crypto.randomBytes(3).toString("hex");
      const username = await uniqueUsername(`guest_${suffix}`);
      const grudgeId = generateGrudgeId();
      const user = await storage.createUser({
        username,
        password: hashPassword(crypto.randomBytes(16).toString("hex")),
        grudgeId,
        puterId: null,
        email: null,
        displayName: username,
        avatarUrl: null,
        gbuxBalance: "0",
        role: "guest",
        solanaAddress: null,
        discordId: null,
        phone: null,
        needsProfile: true,
      });
      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);
      return res.json(publicPlayer(user, true));
    } catch (error) {
      console.error("Guest sign-in error:", error);
      return res.status(500).json({ error: "Guest sign-in failed" });
    }
  });

  // Complete-profile: claim/change username after quick-link auth -
  app.post("/api/auth/complete-profile", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const { username, displayName, email } = req.body || {};
      const updates: Record<string, any> = { needsProfile: false };

      if (typeof username === "string" && username.trim()) {
        const safe = sanitizeUsername(username.trim());
        if (safe.length < 3) return res.status(400).json({ error: "Username must be 3-30 characters" });
        const existing = await storage.getUserByUsername(safe);
        if (existing && existing.id !== player.id) return res.status(409).json({ error: "Username already taken" });
        updates.username = safe;
      }
      if (typeof displayName === "string" && displayName.trim()) updates.displayName = displayName.trim().slice(0, 60);
      if (typeof email === "string" && email.trim()) {
        const existing = await storage.getUserByEmail(email.trim());
        if (existing && existing.id !== player.id) return res.status(409).json({ error: "Email already in use" });
        updates.email = email.trim();
      }

      const updated = await storage.updateUser(player.id, updates);
      return res.json(publicPlayer(updated || player, false));
    } catch (error) {
      console.error("Complete-profile error:", error);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Phantom wallet (Solana) ---------------------------------------
  app.post("/api/auth/phantom/nonce", async (req, res) => {
    try {
      const { address } = req.body || {};
      if (!address || typeof address !== "string") return res.status(400).json({ error: "address is required" });
      pruneMap(phantomNonces);
      const nonce = crypto.randomBytes(16).toString("hex");
      const message = `Sign in to Grudge Studio\n\nAddress: ${address}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`;
      phantomNonces.set(`${address}:${nonce}`, { message, expiresAt: Date.now() + PHANTOM_NONCE_TTL_MS });
      return res.json({ nonce, message });
    } catch (error) {
      return res.status(500).json({ error: "Failed to issue nonce" });
    }
  });

  app.post("/api/auth/phantom/verify", async (req, res) => {
    try {
      const { address, nonce, signature } = req.body || {};
      if (!address || !nonce || !signature) return res.status(400).json({ error: "address, nonce, signature are required" });
      const key = `${address}:${nonce}`;
      const entry = phantomNonces.get(key);
      if (!entry || entry.expiresAt < Date.now()) {
        phantomNonces.delete(key);
        return res.status(400).json({ error: "Nonce expired or not found" });
      }
      phantomNonces.delete(key);

      let pubKey: Uint8Array;
      let sigBytes: Uint8Array;
      try {
        pubKey = bs58.decode(address);
        sigBytes = bs58.decode(signature);
      } catch {
        return res.status(400).json({ error: "Invalid base58 in address or signature" });
      }
      if (pubKey.length !== 32 || sigBytes.length !== 64) return res.status(400).json({ error: "Invalid key or signature length" });

      const messageBytes = new TextEncoder().encode(entry.message);
      const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pubKey);
      if (!ok) return res.status(401).json({ error: "Signature verification failed" });

      let user = await storage.getUserBySolanaAddress(address);
      let isNew = false;
      if (!user) {
        const baseName = `sol_${address.slice(0, 6)}`;
        const username = await uniqueUsername(baseName);
        user = await storage.createUser({
          username,
          password: hashPassword(crypto.randomBytes(16).toString("hex")),
          grudgeId: generateGrudgeId(),
          puterId: null,
          email: null,
          displayName: username,
          avatarUrl: null,
          gbuxBalance: "0",
          role: "player",
          solanaAddress: address,
          discordId: null,
          phone: null,
          needsProfile: true,
        });
        isNew = true;
      } else {
        await storage.updateUser(user.id, { lastLoginAt: new Date() });
      }

      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);
      return res.json(publicPlayer(user, isNew));
    } catch (error) {
      console.error("Phantom verify error:", error);
      return res.status(500).json({ error: "Wallet auth failed" });
    }
  });

  // GitHub OAuth --------------------------------------------------
  const githubOauthState = new Map<string, { redirect: string; expiresAt: number }>();

  app.get("/api/auth/github/start", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return res.status(501).json({ error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_REDIRECT_URI." });
    }
    pruneMap(githubOauthState);
    const state = crypto.randomBytes(16).toString("hex");
    const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "/";
    githubOauthState.set(state, { redirect, expiresAt: Date.now() + DISCORD_STATE_TTL_MS });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    return res.redirect(url.toString());
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      const redirectUri = process.env.GITHUB_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        return res.status(501).json({ error: "GitHub OAuth not configured." });
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state) return res.status(400).send("Missing code or state");
      const stateEntry = githubOauthState.get(state);
      if (!stateEntry || stateEntry.expiresAt < Date.now()) {
        githubOauthState.delete(state);
        return res.status(400).send("Invalid or expired state");
      }
      githubOauthState.delete(state);

      const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });
      if (!tokenResp.ok) return res.status(502).send("GitHub token exchange failed");
      const tokenJson = (await tokenResp.json()) as { access_token?: string };
      if (!tokenJson.access_token) return res.status(502).send("No GitHub access_token");

      const userResp = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}`, "User-Agent": "grudge-studio-auth" },
      });
      if (!userResp.ok) return res.status(502).send("GitHub user fetch failed");
      const ghUser = (await userResp.json()) as { id: number; login: string; name?: string | null; avatar_url?: string | null; email?: string | null };

      let email: string | null = ghUser.email || null;
      if (!email) {
        // GitHub hides primary email by default — pull the verified one if scope allows.
        try {
          const emailsResp = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${tokenJson.access_token}`, "User-Agent": "grudge-studio-auth" },
          });
          if (emailsResp.ok) {
            const emails = (await emailsResp.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
            const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
            if (primary) email = primary.email;
          }
        } catch { /* ignore */ }
      }

      const ghIdString = String(ghUser.id);
      let user = await storage.getUserByGithubId(ghIdString);
      let isNew = false;
      if (!user) {
        const base = ghUser.login || ghUser.name || `gh_${ghIdString.slice(-6)}`;
        const username = await uniqueUsername(base);
        user = await storage.createUser({
          username,
          password: hashPassword(crypto.randomBytes(16).toString("hex")),
          grudgeId: generateGrudgeId(),
          puterId: null,
          email,
          displayName: ghUser.name || ghUser.login || username,
          avatarUrl: ghUser.avatar_url || null,
          gbuxBalance: "0",
          role: "player",
          solanaAddress: null,
          discordId: null,
          githubId: ghIdString,
          phone: null,
          needsProfile: false,
        });
        isNew = true;
      } else {
        await storage.updateUser(user.id, { lastLoginAt: new Date() });
      }

      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);
      const target = stateEntry.redirect && stateEntry.redirect.startsWith("/") ? stateEntry.redirect : "/";
      const sep = target.includes("?") ? "&" : "?";
      return res.redirect(`${target}${sep}auth=github&new=${isNew ? 1 : 0}`);
    } catch (error) {
      console.error("GitHub callback error:", error);
      return res.status(500).send("GitHub auth failed");
    }
  });

  // Discord OAuth -------------------------------------------------
  app.get("/api/auth/discord/start", (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return res.status(501).json({ error: "Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_REDIRECT_URI." });
    }
    pruneMap(discordOauthState);
    const state = crypto.randomBytes(16).toString("hex");
    const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "/";
    discordOauthState.set(state, { redirect, expiresAt: Date.now() + DISCORD_STATE_TTL_MS });
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify email");
    url.searchParams.set("state", state);
    return res.redirect(url.toString());
  });

  app.get("/api/auth/discord/callback", async (req, res) => {
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      const redirectUri = process.env.DISCORD_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        return res.status(501).json({ error: "Discord OAuth not configured." });
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state) return res.status(400).send("Missing code or state");
      const stateEntry = discordOauthState.get(state);
      if (!stateEntry || stateEntry.expiresAt < Date.now()) {
        discordOauthState.delete(state);
        return res.status(400).send("Invalid or expired state");
      }
      discordOauthState.delete(state);

      // Exchange code for token
      const tokenResp = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });
      if (!tokenResp.ok) return res.status(502).send("Discord token exchange failed");
      const tokenJson = (await tokenResp.json()) as { access_token?: string };
      if (!tokenJson.access_token) return res.status(502).send("No access_token");

      const userResp = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!userResp.ok) return res.status(502).send("Discord user fetch failed");
      const dUser = (await userResp.json()) as { id: string; username: string; global_name?: string; avatar?: string | null; email?: string | null };

      let user = await storage.getUserByDiscordId(dUser.id);
      let isNew = false;
      if (!user) {
        const base = dUser.username || dUser.global_name || `discord_${dUser.id.slice(-6)}`;
        const username = await uniqueUsername(base);
        const avatarUrl = dUser.avatar ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png` : null;
        user = await storage.createUser({
          username,
          password: hashPassword(crypto.randomBytes(16).toString("hex")),
          grudgeId: generateGrudgeId(),
          puterId: null,
          email: dUser.email || null,
          displayName: dUser.global_name || dUser.username || username,
          avatarUrl,
          gbuxBalance: "0",
          role: "player",
          solanaAddress: null,
          discordId: dUser.id,
          phone: null,
          needsProfile: false,
        });
        isNew = true;
      } else {
        await storage.updateUser(user.id, { lastLoginAt: new Date() });
      }

      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);
      const target = stateEntry.redirect && stateEntry.redirect.startsWith("/") ? stateEntry.redirect : "/";
      const sep = target.includes("?") ? "&" : "?";
      return res.redirect(`${target}${sep}auth=discord&new=${isNew ? 1 : 0}`);
    } catch (error) {
      console.error("Discord callback error:", error);
      return res.status(500).send("Discord auth failed");
    }
  });

  // Twilio Verify (phone OTP) -------------------------------------
  // Accept both TWILIO_VERIFY_SID (our .env) and TWILIO_VERIFY_SERVICE_SID (Twilio docs alias).
  function twilioVerifyServiceSid(): string | undefined {
    return process.env.TWILIO_VERIFY_SID || process.env.TWILIO_VERIFY_SERVICE_SID;
  }
  function twilioConfigured() {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && twilioVerifyServiceSid());
  }
  function twilioAuthHeader() {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
  }

  app.post("/api/auth/twilio/start", async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone || typeof phone !== "string") return res.status(400).json({ error: "phone is required" });
      const normalized = phone.trim();
      if (!/^\+\d{8,15}$/.test(normalized)) return res.status(400).json({ error: "Use E.164 format, e.g. +15551234567" });

      if (!twilioConfigured()) {
        // Dev fallback: generate a deterministic one-time code the user can read from server logs.
        const code = (crypto.randomInt(100000, 999999)).toString();
        phoneCodes.set(normalized, { code, expiresAt: Date.now() + PHONE_CODE_TTL_MS });
        console.log(`[twilio:dev] OTP for ${normalized}: ${code}`);
        return res.json({ status: "dev", message: "Twilio not configured; check server logs for dev OTP." });
      }

      const sid = twilioVerifyServiceSid()!;
      const resp = await fetch(`https://verify.twilio.com/v2/Services/${sid}/Verifications`, {
        method: "POST",
        headers: { Authorization: twilioAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: normalized, Channel: "sms" }).toString(),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(502).json({ error: `Twilio start failed: ${text}` });
      }
      return res.json({ status: "sent" });
    } catch (error) {
      console.error("Twilio start error:", error);
      return res.status(500).json({ error: "Failed to send code" });
    }
  });

  app.post("/api/auth/twilio/verify", async (req, res) => {
    try {
      const { phone, code } = req.body || {};
      if (!phone || !code) return res.status(400).json({ error: "phone and code are required" });
      const normalized = String(phone).trim();

      pruneMap(phoneCodes);
      let verified = false;
      if (twilioConfigured()) {
        const sid = twilioVerifyServiceSid()!;
        const resp = await fetch(`https://verify.twilio.com/v2/Services/${sid}/VerificationCheck`, {
          method: "POST",
          headers: { Authorization: twilioAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: normalized, Code: String(code) }).toString(),
        });
        if (resp.ok) {
          const json = (await resp.json()) as { status?: string };
          verified = json.status === "approved";
        }
      } else {
        const entry = phoneCodes.get(normalized);
        verified = !!entry && entry.code === String(code) && entry.expiresAt >= Date.now();
        if (verified) phoneCodes.delete(normalized);
      }
      if (!verified) return res.status(401).json({ error: "Invalid or expired code" });

      let user = await storage.getUserByPhone(normalized);
      let isNew = false;
      if (!user) {
        const base = `phone_${normalized.slice(-6)}`;
        const username = await uniqueUsername(base);
        user = await storage.createUser({
          username,
          password: hashPassword(crypto.randomBytes(16).toString("hex")),
          grudgeId: generateGrudgeId(),
          puterId: null,
          email: null,
          displayName: username,
          avatarUrl: null,
          gbuxBalance: "0",
          role: "player",
          solanaAddress: null,
          discordId: null,
          phone: normalized,
          needsProfile: true,
        });
        isNew = true;
      } else {
        await storage.updateUser(user.id, { lastLoginAt: new Date() });
      }

      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);
      return res.json(publicPlayer(user, isNew));
    } catch (error) {
      console.error("Twilio verify error:", error);
      return res.status(500).json({ error: "Failed to verify code" });
    }
  });

  // Cross-domain popup handoff ------------------------------------
  // Any allowlisted frontend (grudgewarlords.com, launcher.grudge-studio.com, ...)
  // can open /auth/popup on grudge-studio.com, let the user sign in with the
  // unified modal, then receive a signed JWT back via postMessage and hand it
  // to their own backend (or api.grudge-studio.com) to establish a session.

  app.get("/api/auth/allowed-origins", (_req, res) => {
    res.json({ origins: allowedAuthOrigins() });
  });

  app.post("/api/auth/popup-token", requirePlayer, (req, res) => {
    try {
      const player = getPlayer(req)!;
      const audience = typeof req.body?.audience === "string" ? req.body.audience : undefined;
      if (audience && !isOriginAllowed(audience)) {
        return res.status(403).json({ error: "Audience origin is not allowlisted" });
      }
      const token = createLaunchToken(player, audience);
      res.json({ token, expiresIn: Math.floor(LAUNCH_TOKEN_TTL_MS / 1000), audience: audience || null });
    } catch (error) {
      console.error("popup-token error:", error);
      res.status(500).json({ error: "Failed to mint launch token" });
    }
  });

  app.post("/api/auth/session/exchange", async (req, res) => {
    try {
      const { token, audience } = req.body || {};
      if (!token || typeof token !== "string") return res.status(400).json({ error: "token is required" });
      const claims = verifyLaunchToken(token);
      if (!claims) return res.status(401).json({ error: "Invalid or expired launch token" });

      // Audience check: if the token was minted for a specific audience, enforce it.
      // Also require the inbound Origin to be allowlisted so any allowlisted frontend
      // on this same backend can establish a fresh cookie from the handoff JWT.
      const origin = (req.headers.origin as string | undefined) || audience;
      if (!isOriginAllowed(origin)) return res.status(403).json({ error: "Origin is not allowlisted" });
      if (claims.aud && origin && claims.aud !== origin) {
        return res.status(403).json({ error: "Launch token audience does not match request origin" });
      }

      const user = await storage.getUser(claims.sub);
      if (!user) return res.status(404).json({ error: "User not found" });

      const sessionToken = createPlayerToken(user.id);
      setPlayerCookie(res, sessionToken);
      return res.json(publicPlayer(user, false));
    } catch (error) {
      console.error("session/exchange error:", error);
      return res.status(500).json({ error: "Exchange failed" });
    }
  });

  /** Puter SSO: auto-create or link a Grudge account from a Puter ID */
  app.post("/api/auth/puter-sso", async (req, res) => {
    try {
      const { puterId, puterUsername, email } = req.body;
      if (!puterId || typeof puterId !== "string") {
        return res.status(400).json({ error: "puterId is required" });
      }

      // Check if puter account already linked
      let user = await storage.getUserByPuterId(puterId);
      if (user) {
        await storage.updateUser(user.id, { lastLoginAt: new Date() });
        const token = createPlayerToken(user.id);
        setPlayerCookie(res, token);
        return res.json({
          id: user.id, username: user.username, grudgeId: user.grudgeId,
          displayName: user.displayName, avatarUrl: user.avatarUrl,
          gbuxBalance: user.gbuxBalance, role: user.role, isNew: false,
        });
      }

      // Auto-create a Grudge account for this Puter user
      const grudgeId = generateGrudgeId();
      const username = puterUsername || `puter_${puterId.slice(0, 8)}`;
      // Generate a random password (user can set one later)
      const randomPass = crypto.randomBytes(16).toString("hex");

      user = await storage.createUser({
        username,
        password: hashPassword(randomPass),
        grudgeId,
        puterId,
        email: email || null,
        displayName: puterUsername || username,
        avatarUrl: null,
        gbuxBalance: "0",
        role: "player",
      });

      const token = createPlayerToken(user.id);
      setPlayerCookie(res, token);

      return res.json({
        id: user.id, username: user.username, grudgeId: user.grudgeId,
        displayName: user.displayName, avatarUrl: user.avatarUrl,
        gbuxBalance: user.gbuxBalance, role: user.role, isNew: true,
      });
    } catch (error) {
      console.error("Puter SSO error:", error);
      return res.status(500).json({ error: "SSO failed" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // LEADERBOARDS / SCORES
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/scores", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const { gameId, score } = req.body;
      if (!gameId || score == null) {
        return res.status(400).json({ error: "gameId and score are required" });
      }

      const game = await storage.getGame(parseInt(gameId));
      if (!game) return res.status(404).json({ error: "Game not found" });

      // Determine personal best / global record flags
      const prevBest = await storage.getPlayerBestScore(player.id, game.id);
      const globalBest = await storage.getGlobalBestScore(game.id);

      const isPersonalBest = !prevBest || score > prevBest.score;
      const isGlobalRecord = !globalBest || score > globalBest.score;

      // If new personal best, un-flag old one
      if (isPersonalBest && prevBest) {
        await db.update(scores).set({ isPersonalBest: false }).where(eq(scores.id, prevBest.id));
      }
      if (isGlobalRecord && globalBest) {
        await db.update(scores).set({ isGlobalRecord: false }).where(eq(scores.id, globalBest.id));
      }

      const newScore = await storage.createScore({
        userId: player.id,
        gameId: game.id,
        score: parseInt(score),
      });

      // Update flags on the new score
      await db.update(scores).set({ isPersonalBest, isGlobalRecord }).where(eq(scores.id, newScore.id));

      // Track activity + fire Discord webhooks
      trackNowPlaying(player.displayName || player.username, game.title);

      if (isPersonalBest) {
        sendDiscordWebhook(DiscordEmbedType.PERSONAL_BEST, {
          username: player.displayName || player.username,
          gameTitle: game.title,
          score: parseInt(score),
        });
      }
      if (isGlobalRecord) {
        sendDiscordWebhook(DiscordEmbedType.GLOBAL_RECORD, {
          username: player.displayName || player.username,
          gameTitle: game.title,
          score: parseInt(score),
          thumbnailUrl: game.thumbnailUrl || undefined,
        });
      }

      return res.json({ ...newScore, isPersonalBest, isGlobalRecord });
    } catch (error) {
      console.error("Score submit error:", error);
      return res.status(500).json({ error: "Failed to submit score" });
    }
  });

  app.get("/api/leaderboards/global", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const rows = await storage.getGlobalTopPlayers(limit);
      return res.json(rows);
    } catch (error) {
      console.error("/api/leaderboards/global error:", error);
      return res.status(500).json({ error: "Failed to fetch top players" });
    }
  });

  app.get("/api/leaderboards/:gameId", async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      if (!Number.isFinite(gameId)) return res.status(400).json({ error: "Invalid gameId" });
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const topScores = await storage.getTopScores(gameId, limit);
      return res.json(topScores);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboards/:gameId/me", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const gameId = parseInt(req.params.gameId);
      const best = await storage.getPlayerBestScore(player.id, gameId);
      if (!best) return res.json({ rank: null, score: null });

      // Compute rank: count how many distinct personal-best scores are higher
      const [{ count }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(scores)
        .where(
          sql`${scores.gameId} = ${gameId} AND ${scores.isPersonalBest} = true AND ${scores.score} > ${best.score}`
        );

      return res.json({ rank: (count || 0) + 1, score: best.score });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch player rank" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PVP CHALLENGES
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/challenges", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const { opponentId, gameId, gbuxWager } = req.body;
      if (!opponentId || !gameId) {
        return res.status(400).json({ error: "opponentId and gameId are required" });
      }
      if (opponentId === player.id) {
        return res.status(400).json({ error: "Cannot challenge yourself" });
      }

      const opponent = await storage.getUser(parseInt(opponentId));
      if (!opponent) return res.status(404).json({ error: "Opponent not found" });

      const game = await storage.getGame(parseInt(gameId));
      if (!game) return res.status(404).json({ error: "Game not found" });

      const wager = parseFloat(gbuxWager || "0");

      // Verify challenger has enough GBUX for wager
      if (wager > 0 && parseFloat(player.gbuxBalance) < wager) {
        return res.status(400).json({ error: "Insufficient GBUX balance" });
      }

      // Escrow wager from challenger
      if (wager > 0) {
        const newBalance = parseFloat(player.gbuxBalance) - wager;
        await storage.updateUser(player.id, { gbuxBalance: newBalance.toFixed(4) });
        await storage.createTransaction({
          userId: player.id,
          type: "wager_escrow",
          amount: (-wager).toFixed(4),
          balanceAfter: newBalance.toFixed(4),
          referenceType: "challenge",
          description: `Wager escrow for challenge vs ${opponent.displayName || opponent.username}`,
        });
      }

      const challenge = await storage.createChallenge({
        challengerId: player.id,
        opponentId: parseInt(opponentId),
        gameId: parseInt(gameId),
        gbuxWager: wager.toFixed(4),
      });

      return res.json(challenge);
    } catch (error) {
      console.error("Challenge create error:", error);
      return res.status(500).json({ error: "Failed to create challenge" });
    }
  });

  app.post("/api/challenges/:id/accept", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const challenge = await storage.getChallenge(parseInt(req.params.id));
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.opponentId !== player.id) return res.status(403).json({ error: "Not your challenge" });
      if (challenge.status !== "pending") return res.status(400).json({ error: "Challenge is not pending" });

      const wager = parseFloat(challenge.gbuxWager);

      // Escrow wager from opponent
      if (wager > 0) {
        if (parseFloat(player.gbuxBalance) < wager) {
          return res.status(400).json({ error: "Insufficient GBUX balance" });
        }
        const newBalance = parseFloat(player.gbuxBalance) - wager;
        await storage.updateUser(player.id, { gbuxBalance: newBalance.toFixed(4) });
        await storage.createTransaction({
          userId: player.id,
          type: "wager_escrow",
          amount: (-wager).toFixed(4),
          balanceAfter: newBalance.toFixed(4),
          referenceType: "challenge",
          referenceId: challenge.id,
          description: `Wager escrow for accepted challenge`,
        });
      }

      const updated = await storage.updateChallenge(challenge.id, { status: "active" });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "Failed to accept challenge" });
    }
  });

  app.post("/api/challenges/:id/decline", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const challenge = await storage.getChallenge(parseInt(req.params.id));
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.opponentId !== player.id) return res.status(403).json({ error: "Not your challenge" });
      if (challenge.status !== "pending") return res.status(400).json({ error: "Challenge is not pending" });

      // Refund challenger wager
      const wager = parseFloat(challenge.gbuxWager);
      if (wager > 0) {
        const challenger = await storage.getUser(challenge.challengerId);
        if (challenger) {
          const newBalance = parseFloat(challenger.gbuxBalance) + wager;
          await storage.updateUser(challenger.id, { gbuxBalance: newBalance.toFixed(4) });
          await storage.createTransaction({
            userId: challenger.id,
            type: "wager_refund",
            amount: wager.toFixed(4),
            balanceAfter: newBalance.toFixed(4),
            referenceType: "challenge",
            referenceId: challenge.id,
            description: "Challenge declined — wager refunded",
          });
        }
      }

      const updated = await storage.updateChallenge(challenge.id, { status: "declined" });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "Failed to decline challenge" });
    }
  });

  app.post("/api/challenges/:id/result", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const challenge = await storage.getChallenge(parseInt(req.params.id));
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.status !== "active") return res.status(400).json({ error: "Challenge is not active" });
      if (challenge.challengerId !== player.id && challenge.opponentId !== player.id) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const { challengerScore, opponentScore } = req.body;
      if (challengerScore == null || opponentScore == null) {
        return res.status(400).json({ error: "Both scores are required" });
      }

      const cScore = parseInt(challengerScore);
      const oScore = parseInt(opponentScore);
      const winnerId = cScore >= oScore ? challenge.challengerId : challenge.opponentId;
      const loserId = winnerId === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
      const wager = parseFloat(challenge.gbuxWager);

      // Pay out wager to winner (both escrows combined)
      if (wager > 0) {
        const winner = await storage.getUser(winnerId);
        if (winner) {
          const payout = wager * 2;
          const newBalance = parseFloat(winner.gbuxBalance) + payout;
          await storage.updateUser(winner.id, { gbuxBalance: newBalance.toFixed(4) });
          await storage.createTransaction({
            userId: winner.id,
            type: "wager_win",
            amount: payout.toFixed(4),
            balanceAfter: newBalance.toFixed(4),
            referenceType: "challenge",
            referenceId: challenge.id,
            description: `Won challenge wager`,
          });
        }
      }

      const updated = await storage.updateChallenge(challenge.id, {
        challengerScore: cScore,
        opponentScore: oScore,
        winnerId,
        status: "completed",
        resolvedAt: new Date(),
      });

      // Discord webhook
      const challenger = await storage.getUser(challenge.challengerId);
      const opponent = await storage.getUser(challenge.opponentId);
      const game = await storage.getGame(challenge.gameId);
      if (challenger && opponent && game) {
        const winnerUser = winnerId === challenger.id ? challenger : opponent;
        const loserUser = winnerId === challenger.id ? opponent : challenger;
        sendDiscordWebhook(DiscordEmbedType.CHALLENGE_RESULT, {
          winnerName: winnerUser.displayName || winnerUser.username,
          loserName: loserUser.displayName || loserUser.username,
          gameTitle: game.title,
          gbuxWager: wager,
          winnerScore: winnerId === challenger.id ? cScore : oScore,
          loserScore: winnerId === challenger.id ? oScore : cScore,
        });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Challenge result error:", error);
      return res.status(500).json({ error: "Failed to submit result" });
    }
  });

  app.get("/api/challenges/active", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const active = await storage.listActiveChallenges(player.id);
      return res.json(active);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  app.get("/api/challenges/pending", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const pending = await storage.listPendingChallenges(player.id);
      return res.json(pending);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // GBUX TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════

  app.get("/api/transactions", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const txs = await storage.listTransactions(player.id, limit);
      return res.json(txs);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // PORTAL AGGREGATES (account, top games, top players)
  // ═════════════════════════════════════════════════════════════════

  app.get("/api/me/stats", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const stats = await storage.getPlayerStats(player.id);
      return res.json({
        ...stats,
        gbuxBalance: player.gbuxBalance,
        grudgeId: player.grudgeId,
        displayName: player.displayName,
        username: player.username,
        avatarUrl: player.avatarUrl,
        role: player.role,
      });
    } catch (error) {
      console.error("/api/me/stats error:", error);
      return res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/me/scores", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const rows = await storage.getRecentPlayerScores(player.id, limit);
      return res.json(rows);
    } catch (error) {
      console.error("/api/me/scores error:", error);
      return res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  app.get("/api/me/games", requirePlayer, async (req, res) => {
    try {
      const player = getPlayer(req)!;
      const rows = await storage.getPlayerGames(player.id);
      return res.json(rows);
    } catch (error) {
      console.error("/api/me/games error:", error);
      return res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.get("/api/games/top", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
      const windowDays = Math.min(parseInt(req.query.windowDays as string) || 7, 365);
      const rows = await storage.getTopGames(limit, windowDays);
      return res.json(rows);
    } catch (error) {
      console.error("/api/games/top error:", error);
      return res.status(500).json({ error: "Failed to fetch top games" });
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // ADMIN AUTH (existing)
  // ═════════════════════════════════════════════════════════════════

  app.post("/api/admin/login", (req, res) => {
    const submittedPasscode = String(req.body?.passcode || "");
    const expectedPasscode = process.env.ADMIN_PASSCODE;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET;

    if (!expectedPasscode || !sessionSecret) {
      return res.status(500).json({ authenticated: false, error: "Admin auth is not configured" });
    }

    if (!safeCompare(submittedPasscode, expectedPasscode)) {
      return res.status(401).json({ authenticated: false, error: "Invalid credentials" });
    }

    const sessionToken = createAdminSessionToken(sessionSecret);
    const isSecure = process.env.NODE_ENV === "production";
    const cookieParts = [
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      `Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`,
    ];

    if (isSecure) cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));
    return res.json({ authenticated: true });
  });

  app.get("/api/admin/session", (req, res) => {
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET;
    if (!sessionSecret) {
      return res.status(500).json({ authenticated: false, error: "Admin auth is not configured" });
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[ADMIN_SESSION_COOKIE];
    if (!token || !verifyAdminSessionToken(token, sessionSecret)) {
      return res.status(401).json({ authenticated: false });
    }

    return res.json({ authenticated: true });
  });

  app.post("/api/admin/seed-games", async (req, res) => {
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET;
    if (!sessionSecret) return res.status(500).json({ error: "Admin auth not configured" });
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[ADMIN_SESSION_COOKIE];
    if (!token || !verifyAdminSessionToken(token, sessionSecret)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      await storage.reseedGames();
      res.json({ success: true, message: "Game catalog re-seeded (1360 games)" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Seed failed" });
    }
  });

  app.post("/api/admin/logout", (_req, res) => {
    const isSecure = process.env.NODE_ENV === "production";
    const cookieParts = [
      `${ADMIN_SESSION_COOKIE}=`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      "Max-Age=0",
    ];

    if (isSecure) cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));
    return res.json({ success: true });
  });
  // Engine launching API - returns navigation URL for in-browser engine
  app.post("/api/launch-engine", async (req, res) => {
    try {
      const { engine } = req.body;
      console.log(`Launching ${engine}...`);
      
      // Map engines to their in-browser pages
      const engineRoutes: { [key: string]: string } = {
        'construct3': '/puzzle-platformer',
        'buildbox': '/multiplayer-racing',
        'gdevelop': '/puzzle-platformer',
        'stencyl': '/enhanced-gcombat',
        'rpgmaker': '/rpg-maker-studio',
        'yahaha': '/yahaha-3d-world',
        'gamefroot': '/puzzle-platformer',
        'unity': '/yahaha-3d-world',
        'unreal': '/yahaha-3d-world',
        'godot': '/enhanced-gcombat'
      };
      
      const route = engineRoutes[engine] || '/super-engine';
      
      res.json({ 
        success: true, 
        message: `${engine} ready to launch`,
        route: route,
        engineId: engine
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get engine route' 
      });
    }
  });

  // Project opening API - returns navigation URL for project
  app.post("/api/open-project", async (req, res) => {
    try {
      const { projectId, engine } = req.body;
      console.log(`Opening project ${projectId}...`);
      
      // Map project types to their pages
      const projectRoutes: { [key: string]: string } = {
        'construct3': '/puzzle-platformer',
        'buildbox': '/multiplayer-racing',
        'gdevelop': '/puzzle-platformer',
        'stencyl': '/enhanced-gcombat',
        'rpgmaker': '/rpg-maker-studio',
        'yahaha': '/yahaha-3d-world'
      };
      
      const route = projectRoutes[engine] || '/super-engine';
      
      res.json({ 
        success: true, 
        message: `Project ${projectId} ready to open`,
        route: route,
        projectId: projectId
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to open project' 
      });
    }
  });

  // Real-time collaboration API
  app.post("/api/collaboration/join", async (req, res) => {
    try {
      const { sessionId, userId } = req.body;
      
      // Store active collaboration session
      res.json({ 
        success: true, 
        sessionId,
        participants: [],
        status: 'connected'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to join collaboration session' 
      });
    }
  });

  // Asset management API - scan actual files
  app.get("/api/assets", async (req, res) => {
    try {
      const assetsDir = './attached_assets';
      
      // Check if directory exists
      try {
        await fs.promises.access(assetsDir);
      } catch (e) {
        return res.json({ success: true, assets: [] });
      }
      
      const files = await fs.promises.readdir(assetsDir);
      
      const assets = await Promise.all(files.map(async (file: string, index: number) => {
        try {
          const filePath = path.join(assetsDir, file);
          const stats = await fs.promises.stat(filePath);
          const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
          
          return {
            id: `asset_${index}`,
            name: file.replace(/\.[^/.]+$/, ""),
            type: path.extname(file).slice(1) || 'file',
            path: filePath,
            size: `${sizeInMB} MB`,
            uploaded: stats.mtime.toISOString(),
            description: getFileDescription(file)
          };
        } catch (e) {
          return {
            id: `asset_${index}`,
            name: file,
            type: 'unknown',
            path: `${assetsDir}/${file}`,
            size: '0 MB',
            uploaded: new Date().toISOString()
          };
        }
      }));
      
      res.json({ success: true, assets });
    } catch (error) {
      console.error('Asset scanning error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to scan asset files' 
      });
    }
  });

  function getFileDescription(fileName: string): string {
    if (fileName.includes('RPGVX')) return 'RPG Maker VX Ace executable - authentic game development tool';
    if (fileName.includes('Stencyl')) return 'Stencyl game engine configuration files';
    if (fileName.includes('log4j')) return 'Java logging configuration for game engines';
    if (fileName.includes('build')) return 'Build configuration file';
    if (fileName.endsWith('.png') || fileName.endsWith('.jpg')) return 'Image asset for game development';
    if (fileName.endsWith('.json')) return 'Data configuration file';
    if (fileName.endsWith('.md')) return 'Documentation file';
    if (fileName.endsWith('.html')) return 'Web content file';
    return 'Project asset file';
  }

  // Engine status API - detect real engines
  app.get("/api/engines/status", async (req, res) => {
    const detectedEngines = [];
    
    try {
      const files = await fs.promises.readdir('./attached_assets');
      
      // Check for Stencyl files
      const stencylFiles = files.filter((f: string) => 
        f.includes('Stencyl') || f.endsWith('.desktop') || f.endsWith('.bat') || f.endsWith('.command')
      );
      
      if (stencylFiles.length > 0) {
        detectedEngines.push({
          id: 'stencyl',
          name: 'Stencyl',
          status: 'installed',
          version: '4.1.4',
          description: 'Detected from attached configuration files',
          category: '2D',
          platforms: ['Web', 'Mobile', 'Desktop'],
          features: ['Drag & Drop', 'Behaviors', 'Scene Designer'],
          projectCount: 0,
          configFiles: stencylFiles
        });
      }
      
      // Check for RPG Maker files
      const rpgFiles = files.filter((f: string) => f.includes('RPGVX') || f.includes('rpg'));
      
      if (rpgFiles.length > 0) {
        detectedEngines.push({
          id: 'rpgmaker',
          name: 'RPG Maker VX',
          status: 'installed',
          version: 'VX Ace',
          description: 'Detected executable and resources',
          category: 'RPG',
          platforms: ['Desktop'],
          features: ['Character Creator', 'Map Editor', 'Event System'],
          projectCount: 0,
          executableFiles: rpgFiles
        });
      }
      
      // Check for other game development files
      const buildFiles = files.filter((f: string) => 
        f.includes('build') || f.includes('log4j') || f.endsWith('.xml')
      );
      
      if (buildFiles.length > 0) {
        detectedEngines.push({
          id: 'java-engine',
          name: 'Java Game Engine',
          status: 'detected',
          version: '1.0',
          description: 'Detected from build configuration and logging files',
          category: 'Multi-Platform',
          platforms: ['Desktop', 'Web'],
          features: ['Cross-Platform', 'Logging', 'Build System'],
          projectCount: 0,
          configFiles: buildFiles
        });
      }
      
      res.json({ success: true, engines: detectedEngines });
    } catch (error) {
      console.error('Engine detection error:', error);
      res.json({ success: true, engines: [] }); // Return empty array instead of error
    }
  });

  // Projects API - scan real project files
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = [];
      
      // Scan for project directories or files
      try {
        const files = await fs.promises.readdir('./');
        const projectDirs = files.filter((f: string) => 
          f.includes('project') || f.includes('game') || f.includes('stencyl')
        );
        
        for (const dir of projectDirs) {
          try {
            const stats = await fs.promises.stat(`./${dir}`);
            if (stats.isDirectory()) {
              projects.push({
                id: dir,
                name: dir.charAt(0).toUpperCase() + dir.slice(1),
                engine: 'detected',
                type: 'Game Project',
                lastModified: stats.mtime.toISOString(),
                size: '0 MB',
                status: 'ready'
              });
            }
          } catch (e) {}
        }
      } catch (e) {}
      
      res.json({ success: true, projects });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to scan projects' 
      });
    }
  });

  // Asset preview API for interactive hover zoom
  app.get("/api/assets/preview/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const assetIndex = parseInt(id.replace('asset_', ''));
      
      const files = await fs.promises.readdir('./attached_assets');
      
      if (assetIndex >= 0 && assetIndex < files.length) {
        const fileName = files[assetIndex];
        const filePath = path.join('./attached_assets', fileName);
        const ext = path.extname(fileName).toLowerCase();
        
        // Check if it's an image file
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
          try {
            await fs.promises.access(filePath);
            const stats = await fs.promises.stat(filePath);
            
            // Set appropriate content type for images
            const contentType = ext === '.png' ? 'image/png' : 
                              ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                              ext === '.gif' ? 'image/gif' :
                              ext === '.webp' ? 'image/webp' : 'application/octet-stream';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
          } catch (e) {
            res.status(404).json({ error: 'Image file not found' });
          }
        } else {
          res.status(400).json({ error: 'File is not an image' });
        }
      } else {
        res.status(404).json({ error: 'Asset not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to serve image preview' });
    }
  });

  // Asset download API
  app.get("/api/assets/download/:id", async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const { id } = req.params;
      
      // Get asset info
      const files = await require('fs').promises.readdir('./attached_assets');
      const assetIndex = parseInt(id.replace('asset_', ''));
      const fileName = files[assetIndex];
      
      if (!fileName) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      const filePath = path.join('./attached_assets', fileName);
      
      if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to download asset' 
      });
    }
  });
  // Scraping job routes
  app.post("/api/scraping/start", async (req, res) => {
    try {
      const jobData = insertScrapingJobSchema.parse(req.body);
      const job = await storage.createScrapingJob(jobData);
      
      // Start scraping in background
      processScrapingJob(job.id).catch(console.error);
      
      res.json(job);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid request data" 
      });
    }
  });

  app.get("/api/scraping/jobs", async (req, res) => {
    try {
      const jobs = await storage.listScrapingJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch jobs" 
      });
    }
  });

  app.get("/api/scraping/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getScrapingJob(id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch job" 
      });
    }
  });

  app.get("/api/scraping/jobs/:id/pages", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pages = await storage.getScrapedPagesByJobId(id);
      res.json(pages);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch pages" 
      });
    }
  });

  app.get("/api/scraping/jobs/:id/download", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getScrapingJob(id);
      const pages = await storage.getScrapedPagesByJobId(id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const format = req.query.format as string || job.outputFormat || "json";
      
      res.setHeader('Content-Disposition', `attachment; filename="scraped_data_${id}.${format}"`);
      
      switch (format) {
        case "json":
          res.setHeader('Content-Type', 'application/json');
          res.json({ job, pages });
          break;
        case "csv":
          res.setHeader('Content-Type', 'text/csv');
          const csvHeader = "URL,Title,Content Length,Scraped At\n";
          const csvRows = pages.map(p => 
            `"${p.url}","${p.title?.replace(/"/g, '""') || ''}","${p.contentLength}","${p.scrapedAt}"`
          ).join('\n');
          res.send(csvHeader + csvRows);
          break;
        case "html":
          res.setHeader('Content-Type', 'text/html');
          const html = `
            <html>
              <head><title>Scraped Data - Job ${id}</title></head>
              <body>
                <h1>Scraped Data for ${job.url}</h1>
                <p>Pages scraped: ${pages.length}</p>
                ${pages.map(p => `
                  <div style="margin: 20px 0; border: 1px solid #ccc; padding: 10px;">
                    <h3>${p.title || 'Untitled'}</h3>
                    <p><strong>URL:</strong> ${p.url}</p>
                    <p><strong>Content Length:</strong> ${p.contentLength} characters</p>
                    <p><strong>Scraped:</strong> ${p.scrapedAt}</p>
                  </div>
                `).join('')}
              </body>
            </html>
          `;
          res.send(html);
          break;
        default:
          res.status(400).json({ error: "Unsupported format" });
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to download data" 
      });
    }
  });

  // Store routes
  app.get("/api/store/products", async (req, res) => {
    try {
      const products = await storage.listStoreProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch products" 
      });
    }
  });

  app.get("/api/store/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getStoreProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch product" 
      });
    }
  });

  app.post("/api/store/orders", async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      
      // Simulate payment processing based on payment method
      let paymentStatus = "pending";
      let transactionId = null;
      let paymentProvider = null;

      switch (orderData.paymentMethod) {
        case "card":
          paymentProvider = "stripe";
          transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          paymentStatus = "completed";
          break;
        case "paypal":
          paymentProvider = "paypal";
          transactionId = `pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          paymentStatus = "completed";
          break;
        case "crypto":
          paymentProvider = "coinbase";
          transactionId = `crypto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          paymentStatus = "pending"; // Crypto payments typically need confirmation
          break;
      }

      const enrichedOrderData = {
        ...orderData,
        paymentProvider,
        transactionId,
        paymentStatus
      };

      const order = await storage.createOrder(enrichedOrderData);
      res.json(order);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid order data" 
      });
    }
  });

  app.get("/api/store/orders", async (req, res) => {
    try {
      const orders = await storage.listOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch orders" 
      });
    }
  });

  // Download routes for white label templates and asset packs
  app.get("/downloads/:templateName", async (req, res) => {
    const { templateName } = req.params;
    
    // Template definitions with comprehensive asset information
    const templates: Record<string, any> = {
      // Game Engine Templates
      "construct3-template.zip": {
        name: "Construct 3 Starter Template",
        size: "12.5 MB",
        files: ["main.c3p", "sprites/player.png", "sprites/enemy.png", "sounds/jump.wav", "README.md"],
        description: "Complete Construct 3 project template with physics, animations, and mobile controls",
        category: "Game Engine"
      },
      "buildbox-starter.zip": {
        name: "Buildbox Game Kit",
        size: "8.2 MB", 
        files: ["game.bbdoc", "assets/characters/", "scripts/movement.js", "guide.pdf"],
        description: "Buildbox template with 2D/3D examples and comprehensive documentation",
        category: "Game Engine"
      },
      "gdevelop-template.zip": {
        name: "GDevelop Visual Scripting Kit",
        size: "15.1 MB",
        files: ["project.json", "objects/player.json", "events/gameplay.json", "extensions/", "tutorial.md"],
        description: "GDevelop project with visual scripting examples and particle systems",
        category: "Game Engine"
      },
      "stencyl-kit.zip": {
        name: "Stencyl Cross-Platform Kit",
        size: "9.8 MB",
        files: ["game.stencyl", "resources/graphics/", "behaviors/platformer.hx", "setup.txt"],
        description: "Stencyl template optimized for multiple platform deployment",
        category: "Game Engine"
      },
      "gamefroot-starter.zip": {
        name: "Gamefroot Web Game Kit",
        size: "6.3 MB",
        files: ["project.gf", "assets/sprites/", "config.json", "instructions.md"],
        description: "Gamefroot template for browser-based game development",
        category: "Game Engine"
      },
      "yahaha-template.zip": {
        name: "Yahaha Studios 3D Kit",
        size: "18.7 MB",
        files: ["scene.yahaha", "models/character.fbx", "scripts/controller.lua", "quickstart.pdf"],
        description: "Yahaha Studios template with 3D assets and no-code examples",
        category: "Game Engine"
      },
      "rpgmaker-assets.zip": {
        name: "RPG Maker Complete Kit",
        size: "25.4 MB",
        files: ["game.rpgproject", "characters/hero.png", "tilesets/dungeon.png", "music/battle.ogg", "manual.pdf"],
        description: "RPG Maker template with characters, environments, and battle systems",
        category: "Game Engine"
      },
      
      // Asset Creation Tools
      "photoshop-game-assets.zip": {
        name: "Photoshop Game Asset Collection",
        size: "45.3 MB",
        files: ["templates/ui_elements.psd", "brushes/texture_pack.abr", "actions/sprite_export.atn", "guide.pdf"],
        description: "Professional Photoshop templates and brushes for game asset creation",
        category: "Graphics"
      },
      "blender-game-models.zip": {
        name: "Blender 3D Game Model Pack",
        size: "67.8 MB",
        files: ["models/character_rig.blend", "textures/pbr_materials/", "scripts/export_tools.py", "tutorial.md"],
        description: "Blender files with rigged characters and game-ready 3D assets",
        category: "3D Modeling"
      },
      "aseprite-sprites.zip": {
        name: "Aseprite Pixel Art Collection",
        size: "12.7 MB",
        files: ["sprites/character_animations.aseprite", "palettes/retro_colors.pal", "templates/tile_set.aseprite"],
        description: "Pixel art templates and animated sprites for retro-style games",
        category: "Pixel Art"
      },
      "inkscape-vectors.zip": {
        name: "Inkscape Vector UI Kit",
        size: "8.9 MB",
        files: ["ui/buttons.svg", "icons/game_icons.svg", "backgrounds/patterns.svg", "style_guide.pdf"],
        description: "Vector graphics templates for scalable game UI elements",
        category: "Vector Graphics"
      },
      
      // Audio Tools
      "fl-studio-game-music.zip": {
        name: "FL Studio Game Music Pack",
        size: "34.2 MB",
        files: ["projects/epic_boss.flp", "samples/orchestral/", "presets/game_sounds.fst", "mixing_guide.pdf"],
        description: "FL Studio projects with game music templates and sound libraries",
        category: "Music Production"
      },
      "audacity-sfx-pack.zip": {
        name: "Audacity Sound Effects Kit",
        size: "28.5 MB",
        files: ["projects/sfx_templates.aup3", "samples/impacts/", "samples/ambients/", "effect_chain_guide.txt"],
        description: "Audacity projects and sound effect samples for game audio",
        category: "Audio Editing"
      },
      "lmms-game-tracks.zip": {
        name: "LMMS Game Music Collection",
        size: "19.4 MB",
        files: ["projects/8bit_adventure.mmp", "instruments/chiptune.sf2", "patterns/drum_loops/", "tutorial.md"],
        description: "LMMS projects featuring chiptune and modern game music styles",
        category: "Music Production"
      },
      "retro-sfx-collection.zip": {
        name: "Retro Sound Effects Pack",
        size: "22.1 MB",
        files: ["8bit_sounds/", "arcade_effects/", "menu_sounds/", "power_ups/", "license.txt"],
        description: "Classic arcade and retro game sound effects collection",
        category: "Audio Effects"
      },
      
      // Super Engine Bundle
      "super-engine-complete.zip": {
        name: "Grudge Studio Super Game Engine - Complete Bundle",
        size: "2.5 GB",
        files: [
          "engines/construct3/",
          "engines/buildbox/", 
          "engines/gdevelop/",
          "engines/stencyl/",
          "engines/yahaha/",
          "engines/rpgmaker/",
          "engines/gamefroot/",
          "assets/graphics/",
          "assets/audio/",
          "assets/3d_models/",
          "templates/2d_platformer/",
          "templates/3d_adventure/",
          "templates/rpg_starter/",
          "templates/puzzle_game/",
          "documentation/",
          "tutorials/",
          "tools/",
          "super_engine_launcher.exe",
          "README.md"
        ],
        description: "Complete Super Game Engine bundle with all 7 engines, assets, templates, and unified launcher",
        category: "Super Engine"
      },
      
      // Level Design
      "tiled-map-templates.zip": {
        name: "Tiled Map Editor Kit",
        size: "22.1 MB",
        files: ["maps/platformer_level.tmx", "tilesets/dungeon_tiles.tsx", "objects/collectibles.json", "export_guide.md"],
        description: "Professional map templates and tilesets for various game genres",
        category: "Level Design"
      }
    };

    const template = templates[templateName];
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Set download headers for actual file download
    res.setHeader('Content-Disposition', `attachment; filename="${templateName}"`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', template.size);
    
    // Return comprehensive template information
    res.json({
      success: true,
      message: "Download initiated",
      template: {
        name: template.name,
        description: template.description,
        category: template.category,
        size: template.size,
        fileCount: template.files.length,
        files: template.files,
        downloadUrl: `/downloads/${templateName}`,
        timestamp: new Date().toISOString(),
        provider: "Grudge Studio"
      }
    });
  });

  // Super Engine download endpoint
  app.post("/api/super-engine/download", async (req, res) => {
    try {
      const engineList = [
        "construct3-template.zip",
        "buildbox-starter.zip", 
        "gdevelop-template.zip",
        "stencyl-kit.zip",
        "yahaha-template.zip",
        "rpgmaker-assets.zip",
        "gamefroot-starter.zip"
      ];

      // Simulate download progress for each engine
      const downloadResults = engineList.map((engine, index) => ({
        engine: engine.replace('-template.zip', '').replace('-starter.zip', '').replace('-kit.zip', '').replace('-assets.zip', ''),
        status: 'downloaded',
        size: Math.floor(Math.random() * 50 + 10) + " MB",
        progress: 100,
        downloadUrl: `/downloads/${engine}`
      }));

      res.json({
        success: true,
        message: "Super Engine download package prepared",
        totalSize: "2.5 GB",
        engines: downloadResults,
        bundleInfo: {
          name: "Grudge Studio Super Game Engine",
          version: "1.0.0",
          includes: [
            "7 Complete Game Engines",
            "200+ Game Templates", 
            "1000+ Art Assets",
            "Audio Libraries",
            "3D Model Collections",
            "Unified Launcher",
            "Documentation & Tutorials"
          ],
          downloadUrl: "/downloads/super-engine-complete.zip",
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to prepare Super Engine download"
      });
    }
  });

  app.get("/api/rom-proxy", async (req, res) => {
    let { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Missing url parameter" });
    }
    try {
      // Normalize smart punctuation in the URL so ROM filenames match server files
      url = normalizeRomName(decodeURIComponent(url));
      url = encodeURI(url);

      const allowed = url.startsWith('https://rec0ded88.com/') || url.startsWith('https://cdn.emulatorjs.org/');
      if (!allowed) {
        return res.status(403).json({ error: "URL not allowed" });
      }
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "ROM not found" });
      }
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ROM" });
    }
  });

  app.get("/api/platforms", async (_req, res) => {
    try {
      const platforms = await storage.listPlatforms();
      res.json(platforms);
    } catch (error) {
      res.status(500).json({ error: "Failed to list platforms" });
    }
  });

  app.get("/api/games", async (req, res) => {
    try {
      const { platform, q } = req.query;
      if (q && typeof q === 'string') {
        const games = await storage.searchGames(q, platform as string | undefined);
        return res.json(games);
      }
      const games = await storage.listGames(platform as string | undefined);
      res.json(games);
    } catch (error) {
      res.status(500).json({ error: "Failed to list games" });
    }
  });

  app.get("/api/games/featured", async (_req, res) => {
    try {
      const games = await db.select().from(gameLibrary).where(eq(gameLibrary.isFeatured, true)).orderBy(gameLibrary.title);
      res.json(games);
    } catch (error) {
      res.status(500).json({ error: "Failed to list featured games" });
    }
  });

  app.get("/api/games/:id", async (req, res) => {
    try {
      const game = await storage.getGame(parseInt(req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });
      res.json(game);
    } catch (error) {
      res.status(500).json({ error: "Failed to get game" });
    }
  });

  app.get("/api/articles", async (req, res) => {
    try {
      const { category } = req.query;
      const articlesList = await storage.listArticles(category as string | undefined);
      res.json(articlesList);
    } catch (error) {
      res.status(500).json({ error: "Failed to list articles" });
    }
  });

  app.post("/api/scrape/games", async (req, res) => {
    try {
      const { platformUrl, platform } = req.body;
      if (!platformUrl || !platform) {
        return res.status(400).json({ error: "platformUrl and platform required" });
      }

      const response = await fetch(platformUrl);
      const html = await response.text();
      const $ = cheerio.load(html);

      const games: Array<{ title: string; url: string; slug: string }> = [];
      $('a[href*="play-retro-games-online"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim().replace(/^Play\s+/, '');
        if (title && href) {
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          games.push({ title, url: href, slug });
        }
      });

      $('a.cvplbd, a[class*="cvplbd"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim().replace(/^Play\s+/, '');
        if (title && href && !games.find(g => g.url === href)) {
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          games.push({ title, url: href, slug });
        }
      });

      let created = 0;
      for (const game of games) {
        try {
          await storage.createGame({
            title: game.title,
            slug: game.slug,
            platform: platform,
            platformId: null,
            description: `Play ${game.title} online`,
            thumbnailUrl: null,
            sourceUrl: game.url,
            embedUrl: null,
            category: "retro",
            isPlayable: true,
            isFeatured: false,
          });
          created++;
        } catch (e) {
        }
      }

      res.json({ success: true, found: games.length, created, platform });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Scrape failed" });
    }
  });

  app.post("/api/scrape/articles", async (req, res) => {
    try {
      const { sourceUrl } = req.body;
      const url = sourceUrl || 'https://rec0ded88.com/';

      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      const articlesList: Array<{ title: string; url: string; category: string; excerpt: string }> = [];

      $('article').each((_, el) => {
        const titleEl = $(el).find('h3 a, h2 a').first();
        const title = titleEl.text().trim();
        const href = titleEl.attr('href') || '';
        const category = $(el).find('.category').first().text().trim() || 'Gaming';
        const excerpt = $(el).find('.excerpt, .post-excerpt, p').first().text().trim().slice(0, 300);

        if (title && href) {
          articlesList.push({ title, url: href, category, excerpt });
        }
      });

      let created = 0;
      for (const article of articlesList) {
        try {
          const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          await storage.createArticle({
            title: article.title,
            slug,
            category: article.category,
            content: null,
            excerpt: article.excerpt || null,
            thumbnailUrl: null,
            author: "Rec0deD:88",
            sourceUrl: article.url,
          });
          created++;
        } catch (e) {
        }
      }

      res.json({ success: true, found: articlesList.length, created });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Scrape failed" });
    }
  });

  app.post("/api/scrape/game-embeds", async (req, res) => {
    try {
      const { platform } = req.body;
      const games = await storage.listGames(platform || undefined);
      let updated = 0;

      for (const game of games) {
        if (game.embedUrl || !game.sourceUrl) continue;
        try {
          await new Promise(r => setTimeout(r, 500));
          const response = await fetch(game.sourceUrl);
          const html = await response.text();
          const match = html.match(/gameIframe\.src\s*=\s*'([^']+)'/);
          if (match) {
            let embedPath = match[1].split(' allowfullscreen')[0].trim();
            await db.update(gameLibrary).set({ embedUrl: embedPath }).where(eq(gameLibrary.id, game.id));
            updated++;
          }
        } catch (e) {}
      }

      res.json({ success: true, total: games.length, updated });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Scrape failed" });
    }
  });

  const PLATFORM_EMBED_MAP: Record<string, string> = {
    nes: "play-nes.html",
    snes: "play-snes.html",
    genesis: "play-sega-genesis.html",
    n64: "play-n64.html",
    neogeo: "play-neo-geo.html",
    playstation: "play-ps1.html",
    gameboy: "play-gb.html",
    gba: "play-gba.html",
    nds: "play-nds.html",
  };

  app.post("/api/games/generate-embed-urls", async (req, res) => {
    try {
      const allGames = await db.select().from(gameLibrary);
      let updated = 0;

      for (const game of allGames) {
        if (game.embedUrl) continue;

        const embedFile = PLATFORM_EMBED_MAP[game.platform];
        if (!embedFile) continue;

        const gameName = encodeURIComponent(normalizeRomName(game.title));
        const embedUrl = `/wp-content/emu/html/${embedFile}?gameName=${gameName}.zip&gameID=${game.id}`;

        await db.update(gameLibrary).set({ embedUrl }).where(eq(gameLibrary.id, game.id));
        updated++;
      }

      res.json({ success: true, total: allGames.length, updated });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate embed URLs" });
    }
  });

  app.post("/api/games/:id/feature", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [updated] = await db.update(gameLibrary).set({ isFeatured: true }).where(eq(gameLibrary.id, id)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to feature game" });
    }
  });

  app.get("/api/chat/messages", async (req, res) => {
    try {
      const room = (req.query.room as string) || "general";
      const messages = await storage.listChatMessages(room, 100);
      res.json(messages.reverse());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/chat/rooms", (_req, res) => {
    const rooms = [
      { id: "general", name: "General", description: "Main chat for everyone" },
      { id: "retro-gaming", name: "Retro Gaming", description: "NES, SNES, N64 and classic games" },
      { id: "custom-engines", name: "Custom Engines", description: "Wargus, Avernus, Tower Defense talk" },
      { id: "trading", name: "Trading Post", description: "Buy, sell, trade GBUX and assets" },
    ];
    res.json(rooms);
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });
  const clients = new Map<WebSocket, { username: string; room: string; userId: number | null }>();

  function broadcastToRoom(room: string, data: object) {
    const msg = JSON.stringify(data);
    for (const [ws, info] of clients) {
      if (info.room === room && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  function getRoomUsers(room: string): string[] {
    const users: string[] = [];
    for (const [ws, info] of clients) {
      if (info.room === room && ws.readyState === WebSocket.OPEN) {
        users.push(info.username);
      }
    }
    return [...new Set(users)];
  }

  wss.on("connection", (ws, req) => {
    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === "join") {
          let username = (data.username || "Anonymous").slice(0, 30);
          let userId: number | null = null;
          const room = (data.room || "general").slice(0, 50);

          // If the client has a player session cookie, prefer real account
          const cookies = parsePlayerCookies(req.headers.cookie);
          const token = cookies[PLAYER_COOKIE];
          if (token) {
            const resolvedId = verifyPlayerToken(token);
            if (resolvedId !== null) {
              const player = await storage.getUser(resolvedId);
              if (player) {
                username = player.displayName || player.username;
                userId = player.id;
              }
            }
          }

          clients.set(ws, { username, room, userId });
          broadcastToRoom(room, { type: "users", users: getRoomUsers(room) });
          broadcastToRoom(room, { type: "system", message: `${username} joined the room` });
        }

        if (data.type === "message") {
          const info = clients.get(ws);
          if (!info) return;
          const text = (data.message || "").slice(0, 500).trim();
          if (!text) return;

          const saved = await storage.createChatMessage({
            username: info.username,
            message: text,
            room: info.room,
            userId: info.userId,
          });

          broadcastToRoom(info.room, {
            type: "message",
            id: saved.id,
            username: saved.username,
            message: saved.message,
            room: saved.room,
            createdAt: saved.createdAt,
          });
        }

        if (data.type === "switch_room") {
          const info = clients.get(ws);
          if (!info) return;
          const oldRoom = info.room;
          const newRoom = (data.room || "general").slice(0, 50);
          broadcastToRoom(oldRoom, { type: "system", message: `${info.username} left the room` });
          info.room = newRoom;
          broadcastToRoom(newRoom, { type: "users", users: getRoomUsers(newRoom) });
          broadcastToRoom(newRoom, { type: "system", message: `${info.username} joined the room` });
        }
      } catch (e) {}
    });

    ws.on("close", () => {
      const info = clients.get(ws);
      if (info) {
        clients.delete(ws);
        broadcastToRoom(info.room, { type: "users", users: getRoomUsers(info.room) });
        broadcastToRoom(info.room, { type: "system", message: `${info.username} left the room` });
      }
    });
  });

  setupArenaRooms(httpServer);

  return httpServer;
}
