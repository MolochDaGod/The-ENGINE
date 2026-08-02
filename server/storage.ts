import { 
  users, scrapingJobs, scrapedPages, storeProducts, orders, gamePlatforms, gameLibrary, articles, chatMessages,
  scores, challenges, transactions,
  type User, type InsertUser,
  type ScrapingJob, type InsertScrapingJob,
  type ScrapedPage, type InsertScrapedPage,
  type StoreProduct, type InsertStoreProduct,
  type Order, type InsertOrder,
  type GamePlatform, type InsertGamePlatform,
  type Game, type InsertGame,
  type Article, type InsertArticle,
  type ChatMessage, type InsertChatMessage,
  type Score, type InsertScore,
  type Challenge, type InsertChallenge,
  type Transaction, type InsertTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, desc, asc, sql, and, or } from "drizzle-orm";
import { CATALOG } from "./catalog-data";
import GAMES_JSON from "../api/_games.json" with { type: "json" };
import {
  RETRO_COMPETITIVE_TOP10,
  getCompetitiveMeta,
  libretroBoxartUrl,
} from "@shared/retroCompetitive";

/** Portal play SSOT — same ids as /play/:id and api/games on Vercel */
type PortalGameRow = {
  id: number;
  title: string;
  slug?: string;
  platform: string;
  embedUrl?: string | null;
  thumbnailUrl?: string | null;
  isFeatured?: boolean;
  description?: string | null;
};
const PORTAL_GAMES = GAMES_JSON as PortalGameRow[];

export interface GameListOptions {
  limit?: number;
  offset?: number;
  letter?: string;
}

export interface GameListResult {
  games: Game[];
  total: number;
}

export type FleetPlayRecord = {
  gameKey: string;
  category: "fleet" | "retro";
  title: string;
  url?: string;
  lastPlayedAt: string;
  playCount: number;
};

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createScrapingJob(job: InsertScrapingJob): Promise<ScrapingJob>;
  getScrapingJob(id: number): Promise<ScrapingJob | undefined>;
  updateScrapingJob(id: number, updates: Partial<ScrapingJob>): Promise<ScrapingJob | undefined>;
  listScrapingJobs(): Promise<ScrapingJob[]>;

  createScrapedPage(page: InsertScrapedPage): Promise<ScrapedPage>;
  getScrapedPagesByJobId(jobId: number): Promise<ScrapedPage[]>;

  listStoreProducts(): Promise<StoreProduct[]>;
  getStoreProduct(id: number): Promise<StoreProduct | undefined>;
  createStoreProduct(product: InsertStoreProduct): Promise<StoreProduct>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  listOrders(): Promise<Order[]>;

  listPlatforms(): Promise<GamePlatform[]>;
  getPlatform(id: number): Promise<GamePlatform | undefined>;
  createPlatform(platform: InsertGamePlatform): Promise<GamePlatform>;

  listGames(platform?: string, options?: GameListOptions): Promise<GameListResult>;
  getGame(id: number): Promise<Game | undefined>;
  /** Lookup by slug (e.g. avernus-arena) for string gameId leaderboard paths. */
  getGameBySlug(slug: string): Promise<Game | undefined>;
  /**
   * Resolve numeric catalog id OR string slug to a game_library row.
   * Ensures first-party studio games exist when missing.
   */
  resolveGameRef(ref: string | number): Promise<Game | undefined>;
  /**
   * Ensure game_library row uses **catalog id** (portal /play/:id / scores FK).
   * Seed historically ignored catalog ids — this heals competitive + score path.
   */
  ensureCatalogGame(catalogId: number): Promise<Game | undefined>;
  /** Upsert all competitive Top 10 into game_library with art + correct ids. */
  ensureCompetitiveGames(): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  searchGames(query: string, platform?: string, options?: GameListOptions): Promise<GameListResult>;

  listArticles(category?: string): Promise<Article[]>;
  getArticle(id: number): Promise<Article | undefined>;
  createArticle(article: InsertArticle): Promise<Article>;

  listChatMessages(room: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;

  // Extended user lookups
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPuterId(puterId: string): Promise<User | undefined>;
  getUserByGrudgeId(grudgeId: string): Promise<User | undefined>;
  getUserBySolanaAddress(address: string): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;

  // Scores / Leaderboards
  createScore(score: InsertScore): Promise<Score>;
  getTopScores(gameId: number, limit?: number): Promise<(Score & { username: string; displayName: string | null })[]>;
  getPlayerBestScore(userId: number, gameId: number): Promise<Score | undefined>;
  getGlobalBestScore(gameId: number): Promise<Score | undefined>;

  // Portal aggregates
  getPlayerStats(userId: number): Promise<{
    gamesPlayed: number;
    retroGamesPlayed: number;
    fleetGamesPlayed: number;
    totalScores: number;
    retroScores: number;
    fleetPlays: number;
    personalBests: number;
    globalRecords: number;
    challengesWon: number;
    challengesLost: number;
  }>;
  getRecentPlayerScores(userId: number, limit?: number): Promise<Array<Score & { gameTitle: string; platform: string; thumbnailUrl: string | null }>>;
  getPlayerGames(userId: number): Promise<Array<{ game: Game; bestScore: number; personalBestAt: Date | null }>>;
  getFleetPlays(userId: number): Promise<FleetPlayRecord[]>;
  recordFleetPlay(userId: number, play: Omit<FleetPlayRecord, "playCount" | "lastPlayedAt"> & { lastPlayedAt?: string }): Promise<FleetPlayRecord[]>;
  getTopGames(limit?: number, windowDays?: number): Promise<Array<Game & { playerCount: number; scoreCount: number }>>;
  getGlobalTopPlayers(limit?: number): Promise<Array<{ userId: number; username: string; displayName: string | null; avatarUrl: string | null; totalScore: number; personalBests: number; globalRecords: number }>>;

  // Challenges
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  getChallenge(id: number): Promise<Challenge | undefined>;
  updateChallenge(id: number, updates: Partial<Challenge>): Promise<Challenge | undefined>;
  listActiveChallenges(userId: number): Promise<Challenge[]>;
  listPendingChallenges(userId: number): Promise<Challenge[]>;

  // Transactions
  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  listTransactions(userId: number, limit?: number): Promise<Transaction[]>;
}

export class DatabaseStorage implements IStorage {
  async initializeStoreProducts() {
    const existingProducts = await db.select().from(storeProducts).limit(1);
    if (existingProducts.length > 0) return;

    const products: InsertStoreProduct[] = [
      {
        name: "Grudge Launcher License",
        description: "A fully featured gaming launcher and white-label solution for companies, enabling smooth monetization and packed with diverse functionalities.",
        price: 49900,
        features: ["Gaming launcher platform", "White-label solution", "Monetization tools", "Full customization"],
        category: "software",
        image: "/assets/store/grudge_launcher.png",
        isActive: true,
      },
      {
        name: "Wargus RTS Engine",
        description: "Complete 3D real-time strategy engine with bloom post-processing, physics, water shaders, fog of war, and AI opponents. Ready to deploy.",
        price: 79900,
        features: ["3D RTS engine with Three.js", "cannon-es physics system", "AI opponent logic", "Full source code"],
        category: "software",
        image: "/assets/store/wargus_rts_engine.png",
        isActive: true,
      },
      {
        name: "Retro Game Library",
        description: "1,360+ retro games across 9 platforms with EmulatorJS integration, ROM proxy, and full game library browser.",
        price: 29900,
        features: ["1,360+ games, 9 platforms", "EmulatorJS in-app player", "Search and filter system", "Platform cover art"],
        category: "software",
        image: "/assets/store/retro_library.png",
        isActive: true,
      },
      {
        name: "MMO Game Development",
        description: "Complete MMO game development services — real-time multiplayer, persistent worlds, and custom game mechanics built to scale.",
        price: 149900,
        features: ["MMO architecture", "Real-time multiplayer", "Custom game mechanics", "Full source code"],
        category: "enterprise",
        image: "/assets/store/mmo_development.png",
        isActive: true,
      },
      {
        name: "Custom Development Solutions",
        description: "Full-custom development solutions that comprehend and tackle any development challenge with precision and innovation.",
        price: 199900,
        features: ["Custom development", "Scalable architecture", "Ongoing support", "Performance optimization"],
        category: "enterprise",
        image: "/assets/store/custom_development.png",
        isActive: true,
      },
      {
        name: "Dark Fantasy Scene Pack",
        description: "Medieval dungeons, lava caves, enchanted forests, and castle environments for dark fantasy games.",
        price: 4900,
        features: ["20+ environment scenes", "Seamless tiling textures", "PBR materials included"],
        category: "asset",
        image: "/assets/store/dark_fantasy_scenes.png",
        isActive: true,
      },
      {
        name: "Sci-Fi Environment Pack",
        description: "Neon-lit cyberpunk streets, futuristic interiors, and space station environments for sci-fi games.",
        price: 4900,
        features: ["15+ environment scenes", "Emissive/glow materials", "Modular building pieces"],
        category: "asset",
        image: "/assets/store/scifi_environment.png",
        isActive: true,
      },
      {
        name: "Character Sprite Collection",
        description: "Warriors, mages, archers, and creatures — animated sprite sheets ready for 2D or 2.5D games.",
        price: 3900,
        features: ["50+ character sprites", "Walk/attack/idle animations", "Multiple factions included"],
        category: "asset",
        image: "/assets/store/character_sprites.png",
        isActive: true,
      },
    ];

    await db.insert(storeProducts).values(products);
  }

  async initializeHydraProducts() {
    const existing = await db.select().from(storeProducts).where(eq(storeProducts.name, "HYDRA Input Configurator")).limit(1);
    if (existing.length > 0) return;

    await db.insert(storeProducts).values({
      name: "HYDRA Input Configurator",
      description: "Professional keybinding editor for game developers and players. Bind 32 game actions across keyboard and mouse, manage hotbar slots, detect conflicts, and export your config as JSON. Part of the HYDRA Tool Kit by Grudge Studio.",
      price: 0,
      gbuxPrice: 5,
      features: ["32 game actions across 4 categories", "Full keyboard + mouse visual map", "10-slot hotbar manager", "Conflict detection & JSON export/import"],
      category: "tool",
      image: "/assets/store/hydra_input_configurator.png",
      isActive: true,
    });
  }

  async initializePlatforms() {
    const existing = await db.select().from(gamePlatforms).limit(1);
    if (existing.length > 0) return;

    const platforms: InsertGamePlatform[] = [
      { name: "NES", slug: "nes", description: "Nintendo Entertainment System", iconEmoji: "🎮", gameCount: 0 },
      { name: "SNES", slug: "snes", description: "Super Nintendo Entertainment System", iconEmoji: "🕹️", gameCount: 0 },
      { name: "Sega Genesis", slug: "genesis", description: "Sega Genesis / Mega Drive", iconEmoji: "🎯", gameCount: 0 },
      { name: "Nintendo 64", slug: "n64", description: "Nintendo 64", iconEmoji: "🏆", gameCount: 0 },
      { name: "Neo Geo", slug: "neogeo", description: "SNK Neo Geo", iconEmoji: "⚡", gameCount: 0 },
      { name: "PlayStation", slug: "playstation", description: "Sony PlayStation", iconEmoji: "🎲", gameCount: 0 },
      { name: "Game Boy", slug: "gameboy", description: "Nintendo Game Boy", iconEmoji: "📱", gameCount: 0 },
      { name: "Game Boy Advance", slug: "gba", description: "Nintendo Game Boy Advance", iconEmoji: "🌟", gameCount: 0 },
      { name: "Nintendo DS", slug: "nds", description: "Nintendo DS", iconEmoji: "📺", gameCount: 0 },
      { name: "Custom Engine", slug: "custom", description: "Custom built game engines", iconEmoji: "🔧", gameCount: 0 },
    ];

    await db.insert(gamePlatforms).values(platforms);
  }

  async initializeGames() {
    const existing = await db.select().from(gameLibrary).limit(1);
    if (existing.length > 0) return;
    await this._seedGamesFromCatalog();
  }

  async reseedGames() {
    await db.delete(gameLibrary);
    await this._seedGamesFromCatalog();
  }

  private async _seedGamesFromCatalog() {
    const BATCH = 50;
    for (let i = 0; i < CATALOG.length; i += BATCH) {
      const batch = CATALOG.slice(i, i + BATCH);
      // Preserve catalog id so portal /play/:id matches scores.game_id FK.
      const values = batch.map(([catalogId, title, slug, platform, embedUrl, isFeatured]) => {
        const comp = getCompetitiveMeta(catalogId);
        return {
          id: catalogId,
          title,
          slug,
          platform,
          platformId: null,
          description: comp?.blurb || `Play ${title} online`,
          thumbnailUrl: comp?.thumbnailUrl || null,
          sourceUrl: null,
          embedUrl,
          category: "retro",
          isPlayable: true,
          isFeatured: isFeatured || Boolean(comp),
        };
      });
      await db.insert(gameLibrary).values(values);
    }

    // Keep serial sequence ahead of max explicit id
    await db.execute(
      sql`SELECT setval(pg_get_serial_sequence('game_library', 'id'), COALESCE((SELECT MAX(id) FROM game_library), 1))`,
    );

    // Update platform game counts
    const platformSlugs = ["nes", "snes", "genesis", "n64", "neogeo", "playstation", "gameboy", "gba", "nds"];
    for (const slug of platformSlugs) {
      const [{ count }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(gameLibrary)
        .where(eq(gameLibrary.platform, slug));
      await db.update(gamePlatforms).set({ gameCount: count }).where(eq(gamePlatforms.slug, slug));
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createScrapingJob(insertJob: InsertScrapingJob): Promise<ScrapingJob> {
    const [job] = await db
      .insert(scrapingJobs)
      .values({ ...insertJob, status: "pending", progress: 0, pagesFound: 0, pagesScraped: 0, results: null, error: null, createdAt: new Date(), completedAt: null })
      .returning();
    return job;
  }

  async getScrapingJob(id: number): Promise<ScrapingJob | undefined> {
    const [job] = await db.select().from(scrapingJobs).where(eq(scrapingJobs.id, id));
    return job || undefined;
  }

  async updateScrapingJob(id: number, updates: Partial<ScrapingJob>): Promise<ScrapingJob | undefined> {
    const [job] = await db.update(scrapingJobs).set(updates).where(eq(scrapingJobs.id, id)).returning();
    return job || undefined;
  }

  async listScrapingJobs(): Promise<ScrapingJob[]> {
    return await db.select().from(scrapingJobs).orderBy(scrapingJobs.createdAt);
  }

  async createScrapedPage(insertPage: InsertScrapedPage): Promise<ScrapedPage> {
    const [page] = await db.insert(scrapedPages).values({ ...insertPage, scrapedAt: new Date() }).returning();
    return page;
  }

  async getScrapedPagesByJobId(jobId: number): Promise<ScrapedPage[]> {
    return await db.select().from(scrapedPages).where(eq(scrapedPages.jobId, jobId));
  }

  async listStoreProducts(): Promise<StoreProduct[]> {
    return await db.select().from(storeProducts).where(eq(storeProducts.isActive, true));
  }

  async getStoreProduct(id: number): Promise<StoreProduct | undefined> {
    const [product] = await db.select().from(storeProducts).where(eq(storeProducts.id, id));
    return product || undefined;
  }

  async createStoreProduct(insertProduct: InsertStoreProduct): Promise<StoreProduct> {
    const [product] = await db.insert(storeProducts).values(insertProduct).returning();
    return product;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values({ ...insertOrder, createdAt: new Date() }).returning();
    return order;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async listOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(orders.createdAt);
  }

  async listPlatforms(): Promise<GamePlatform[]> {
    return await db.select().from(gamePlatforms);
  }

  async getPlatform(id: number): Promise<GamePlatform | undefined> {
    const [p] = await db.select().from(gamePlatforms).where(eq(gamePlatforms.id, id));
    return p || undefined;
  }

  async createPlatform(platform: InsertGamePlatform): Promise<GamePlatform> {
    const [p] = await db.insert(gamePlatforms).values(platform).returning();
    return p;
  }

  async listGames(platform?: string, options?: GameListOptions): Promise<GameListResult> {
    const conditions = [];
    if (platform) conditions.push(eq(gameLibrary.platform, platform));
    if (options?.letter) {
      if (options.letter === "#") {
        conditions.push(sql`${gameLibrary.title} !~ '^[A-Za-z]'`);
      } else {
        conditions.push(ilike(gameLibrary.title, `${options.letter}%`));
      }
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameLibrary)
      .where(whereClause);

    let query = db.select().from(gameLibrary).where(whereClause).orderBy(gameLibrary.title).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);

    const games = await query;
    return { games, total: count };
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [g] = await db.select().from(gameLibrary).where(eq(gameLibrary.id, id));
    return g || undefined;
  }

  async getGameBySlug(slug: string): Promise<Game | undefined> {
    const s = String(slug || "").trim().toLowerCase();
    if (!s) return undefined;
    const [g] = await db.select().from(gameLibrary).where(eq(gameLibrary.slug, s)).limit(1);
    return g || undefined;
  }

  /**
   * First-party studio games that score by slug (not retro catalog int ids).
   * Kept small — only games that call /api/leaderboards/:slug.
   */
  private static readonly STUDIO_SLUG_GAMES: Record<
    string,
    { title: string; platform: string; thumbnailUrl?: string }
  > = {
    "avernus-arena": {
      title: "Avernus Arena",
      platform: "custom",
      thumbnailUrl: "/assets/games/game_avernus_arena.png",
    },
    "avernus-3d": {
      title: "Avernus 3D",
      platform: "custom",
      thumbnailUrl: "/assets/games/game_avernus_3d.png",
    },
  };

  async resolveGameRef(ref: string | number): Promise<Game | undefined> {
    if (typeof ref === "number" || /^\d+$/.test(String(ref))) {
      const id = typeof ref === "number" ? ref : parseInt(String(ref), 10);
      return (await this.ensureCatalogGame(id)) || (await this.getGame(id));
    }

    const slug = String(ref).trim().toLowerCase();
    if (!slug) return undefined;

    let game = await this.getGameBySlug(slug);
    if (game) return game;

    const meta = DatabaseStorage.STUDIO_SLUG_GAMES[slug];
    if (!meta) return undefined;

    try {
      const [inserted] = await db
        .insert(gameLibrary)
        .values({
          title: meta.title,
          slug,
          platform: meta.platform,
          thumbnailUrl: meta.thumbnailUrl ?? null,
          isFeatured: true,
          isPlayable: true,
          embedUrl: `/${slug}`,
          description: `${meta.title} — Grudge Studio first-party game`,
        })
        .returning();
      return inserted;
    } catch {
      // race / unique slug — re-read
      return this.getGameBySlug(slug);
    }
  }

  async ensureCatalogGame(catalogId: number): Promise<Game | undefined> {
    if (!Number.isFinite(catalogId) || catalogId <= 0) return undefined;

    const existing = await this.getGame(catalogId);
    // Prefer portal _games.json (play URL ids), then catalog-data, then competitive meta
    const portal = PORTAL_GAMES.find((g) => g.id === catalogId);
    const catalog = CATALOG.find((row) => row[0] === catalogId);
    const comp = getCompetitiveMeta(catalogId);

    if (!portal && !catalog && !comp && !existing) return undefined;

    const title =
      portal?.title || catalog?.[1] || comp?.title || existing?.title || `Game ${catalogId}`;
    const slug =
      portal?.slug ||
      catalog?.[2] ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const platform =
      portal?.platform || catalog?.[3] || comp?.platform || existing?.platform || "nes";
    const embedUrl = portal?.embedUrl || catalog?.[4] || existing?.embedUrl || null;
    const isFeatured =
      portal?.isFeatured || catalog?.[5] || Boolean(comp) || existing?.isFeatured || false;
    const thumbnailUrl =
      comp?.thumbnailUrl ||
      portal?.thumbnailUrl ||
      existing?.thumbnailUrl ||
      (title ? libretroBoxartUrl(platform, `${title} (USA).png`) : null);

    const row = {
      id: catalogId,
      title,
      slug,
      platform,
      platformId: existing?.platformId ?? null,
      description: comp?.blurb || portal?.description || existing?.description || `Play ${title} online`,
      thumbnailUrl,
      sourceUrl: existing?.sourceUrl ?? null,
      embedUrl,
      category: existing?.category || "retro",
      isPlayable: true,
      isFeatured: Boolean(isFeatured),
    };

    if (existing) {
      const [updated] = await db
        .update(gameLibrary)
        .set({
          title: row.title,
          slug: row.slug,
          platform: row.platform,
          description: row.description,
          thumbnailUrl: row.thumbnailUrl,
          embedUrl: row.embedUrl,
          isPlayable: true,
          isFeatured: row.isFeatured,
        })
        .where(eq(gameLibrary.id, catalogId))
        .returning();
      return updated;
    }

    try {
      const [inserted] = await db.insert(gameLibrary).values(row).returning();
      await db.execute(
        sql`SELECT setval(pg_get_serial_sequence('game_library', 'id'), COALESCE((SELECT MAX(id) FROM game_library), 1))`,
      );
      return inserted;
    } catch (err) {
      // Race: another request inserted — re-read
      console.warn("[ensureCatalogGame] insert race", catalogId, err);
      return this.getGame(catalogId);
    }
  }

  async ensureCompetitiveGames(): Promise<Game[]> {
    const out: Game[] = [];
    for (const meta of RETRO_COMPETITIVE_TOP10) {
      const g = await this.ensureCatalogGame(meta.gameId);
      if (g) out.push(g);
    }
    return out;
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [g] = await db.insert(gameLibrary).values(game).returning();
    return g;
  }

  async searchGames(query: string, platform?: string, options?: GameListOptions): Promise<GameListResult> {
    const conditions = [ilike(gameLibrary.title, `%${query}%`)];
    if (platform) conditions.push(eq(gameLibrary.platform, platform));
    if (options?.letter) {
      if (options.letter === "#") {
        conditions.push(sql`${gameLibrary.title} !~ '^[A-Za-z]'`);
      } else {
        conditions.push(ilike(gameLibrary.title, `${options.letter}%`));
      }
    }
    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameLibrary)
      .where(whereClause);

    let q = db.select().from(gameLibrary).where(whereClause).orderBy(gameLibrary.title).$dynamic();
    if (options?.limit) q = q.limit(options.limit);
    if (options?.offset) q = q.offset(options.offset);

    const games = await q;
    return { games, total: count };
  }

  async listArticles(category?: string): Promise<Article[]> {
    if (category) {
      return await db.select().from(articles).where(eq(articles.category, category)).orderBy(desc(articles.createdAt));
    }
    return await db.select().from(articles).orderBy(desc(articles.createdAt));
  }

  async getArticle(id: number): Promise<Article | undefined> {
    const [a] = await db.select().from(articles).where(eq(articles.id, id));
    return a || undefined;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [a] = await db.insert(articles).values(article).returning();
    return a;
  }

  async listChatMessages(room: string, limit: number = 100): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages)
      .where(eq(chatMessages.room, room))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [m] = await db.insert(chatMessages).values(msg).returning();
    return m;
  }

  // ── Extended user lookups ──────────────────────────────────────

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPuterId(puterId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.puterId, puterId));
    return user || undefined;
  }

  async getUserByGrudgeId(grudgeId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.grudgeId, grudgeId));
    return user || undefined;
  }

  async getUserBySolanaAddress(address: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.solanaAddress, address));
    return user || undefined;
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.discordId, discordId));
    return user || undefined;
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.githubId, githubId));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // ── Scores / Leaderboards ─────────────────────────────────────

  async createScore(insertScore: InsertScore): Promise<Score> {
    const [s] = await db.insert(scores).values(insertScore).returning();
    return s;
  }

  async getTopScores(gameId: number, limit: number = 50): Promise<(Score & { username: string; displayName: string | null })[]> {
    const rows = await db
      .select({
        id: scores.id,
        userId: scores.userId,
        gameId: scores.gameId,
        score: scores.score,
        isPersonalBest: scores.isPersonalBest,
        isGlobalRecord: scores.isGlobalRecord,
        createdAt: scores.createdAt,
        username: users.username,
        displayName: users.displayName,
      })
      .from(scores)
      .innerJoin(users, eq(scores.userId, users.id))
      .where(and(eq(scores.gameId, gameId), eq(scores.isPersonalBest, true)))
      .orderBy(desc(scores.score))
      .limit(limit);
    return rows as any;
  }

  async getPlayerBestScore(userId: number, gameId: number): Promise<Score | undefined> {
    const [s] = await db.select().from(scores)
      .where(and(eq(scores.userId, userId), eq(scores.gameId, gameId), eq(scores.isPersonalBest, true)));
    return s || undefined;
  }

  async getGlobalBestScore(gameId: number): Promise<Score | undefined> {
    const [s] = await db.select().from(scores)
      .where(and(eq(scores.gameId, gameId), eq(scores.isGlobalRecord, true)));
    return s || undefined;
  }

  // ── Challenges ────────────────────────────────────────────────

  async createChallenge(insertChallenge: InsertChallenge): Promise<Challenge> {
    const [c] = await db.insert(challenges).values(insertChallenge).returning();
    return c;
  }

  async getChallenge(id: number): Promise<Challenge | undefined> {
    const [c] = await db.select().from(challenges).where(eq(challenges.id, id));
    return c || undefined;
  }

  async updateChallenge(id: number, updates: Partial<Challenge>): Promise<Challenge | undefined> {
    const [c] = await db.update(challenges).set(updates).where(eq(challenges.id, id)).returning();
    return c || undefined;
  }

  async listActiveChallenges(userId: number): Promise<Challenge[]> {
    return await db.select().from(challenges)
      .where(
        and(
          or(eq(challenges.challengerId, userId), eq(challenges.opponentId, userId)),
          or(eq(challenges.status, "pending"), eq(challenges.status, "accepted"), eq(challenges.status, "active"))
        )
      )
      .orderBy(desc(challenges.createdAt));
  }

  async listPendingChallenges(userId: number): Promise<Challenge[]> {
    return await db.select().from(challenges)
      .where(and(eq(challenges.opponentId, userId), eq(challenges.status, "pending")))
      .orderBy(desc(challenges.createdAt));
  }

  // ── Transactions ──────────────────────────────────────────────

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const [t] = await db.insert(transactions).values(tx).returning();
    return t;
  }

  async listTransactions(userId: number, limit: number = 50): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  // ── Portal aggregates ────────────────────────────────────────

  async getFleetPlays(userId: number): Promise<FleetPlayRecord[]> {
    const [user] = await db.select({ recentPlays: users.recentPlays }).from(users).where(eq(users.id, userId)).limit(1);
    const plays = user?.recentPlays;
    return Array.isArray(plays) ? plays : [];
  }

  async recordFleetPlay(
    userId: number,
    play: Omit<FleetPlayRecord, "playCount" | "lastPlayedAt"> & { lastPlayedAt?: string },
  ): Promise<FleetPlayRecord[]> {
    const existing = await this.getFleetPlays(userId);
    const now = play.lastPlayedAt ?? new Date().toISOString();
    const hit = existing.find((p) => p.gameKey === play.gameKey);
    const next: FleetPlayRecord[] = hit
      ? existing.map((p) =>
          p.gameKey === play.gameKey
            ? { ...p, ...play, playCount: p.playCount + 1, lastPlayedAt: now }
            : p,
        )
      : [{ ...play, playCount: 1, lastPlayedAt: now }, ...existing];
    const trimmed = next.slice(0, 48);
    await db.update(users).set({ recentPlays: trimmed }).where(eq(users.id, userId));
    return trimmed;
  }

  async getPlayerStats(userId: number) {
    const fleetPlays = await this.getFleetPlays(userId);
    const fleetGameCount = new Set(
      fleetPlays.filter((p) => p.category === "fleet").map((p) => p.gameKey),
    ).size;
    const fleetPlayCount = fleetPlays.reduce((sum, p) => sum + (p.playCount ?? 1), 0);

    const [[gamesPlayedRow], [totalScoresRow], [personalBestsRow], [globalRecordsRow], [challengesWonRow], [challengesLostRow]] = await Promise.all([
      db.select({ count: sql<number>`cast(count(distinct ${scores.gameId}) as int)` })
        .from(scores)
        .where(eq(scores.userId, userId)),
      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(scores)
        .where(eq(scores.userId, userId)),
      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(scores)
        .where(and(eq(scores.userId, userId), eq(scores.isPersonalBest, true))),
      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(scores)
        .where(and(eq(scores.userId, userId), eq(scores.isGlobalRecord, true))),
      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(challenges)
        .where(and(eq(challenges.winnerId, userId), eq(challenges.status, "completed"))),
      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(challenges)
        .where(and(
          eq(challenges.status, "completed"),
          or(eq(challenges.challengerId, userId), eq(challenges.opponentId, userId)),
          sql`${challenges.winnerId} IS NOT NULL AND ${challenges.winnerId} <> ${userId}`
        )),
    ]);

    const retroGamesPlayed = gamesPlayedRow?.count ?? 0;
    return {
      gamesPlayed: retroGamesPlayed + fleetGameCount,
      retroGamesPlayed,
      fleetGamesPlayed: fleetGameCount,
      totalScores: (totalScoresRow?.count ?? 0) + fleetPlayCount,
      retroScores: totalScoresRow?.count ?? 0,
      fleetPlays: fleetPlayCount,
      personalBests: personalBestsRow?.count ?? 0,
      globalRecords: globalRecordsRow?.count ?? 0,
      challengesWon: challengesWonRow?.count ?? 0,
      challengesLost: challengesLostRow?.count ?? 0,
    };
  }

  async getRecentPlayerScores(userId: number, limit: number = 20) {
    const rows = await db
      .select({
        id: scores.id,
        userId: scores.userId,
        gameId: scores.gameId,
        score: scores.score,
        isPersonalBest: scores.isPersonalBest,
        isGlobalRecord: scores.isGlobalRecord,
        createdAt: scores.createdAt,
        gameTitle: gameLibrary.title,
        platform: gameLibrary.platform,
        thumbnailUrl: gameLibrary.thumbnailUrl,
      })
      .from(scores)
      .innerJoin(gameLibrary, eq(scores.gameId, gameLibrary.id))
      .where(eq(scores.userId, userId))
      .orderBy(desc(scores.createdAt))
      .limit(limit);
    return rows as any;
  }

  async getPlayerGames(userId: number) {
    const rows = await db
      .select({
        game: gameLibrary,
        bestScore: sql<number>`cast(max(${scores.score}) as int)`,
        personalBestAt: sql<Date | null>`max(${scores.createdAt})`,
      })
      .from(scores)
      .innerJoin(gameLibrary, eq(scores.gameId, gameLibrary.id))
      .where(eq(scores.userId, userId))
      .groupBy(gameLibrary.id)
      .orderBy(desc(sql<number>`max(${scores.score})`));
    return rows.map((row) => ({
      game: row.game as Game,
      bestScore: Number(row.bestScore ?? 0),
      personalBestAt: row.personalBestAt ?? null,
    }));
  }

  async getTopGames(limit: number = 12, windowDays: number = 7) {
    const rows = await db
      .select({
        game: gameLibrary,
        playerCount: sql<number>`cast(count(distinct ${scores.userId}) as int)`,
        scoreCount: sql<number>`cast(count(${scores.id}) as int)`,
      })
      .from(gameLibrary)
      .leftJoin(
        scores,
        and(
          eq(scores.gameId, gameLibrary.id),
          sql`${scores.createdAt} >= now() - (${windowDays} || ' days')::interval`,
        ),
      )
      .groupBy(gameLibrary.id)
      .orderBy(
        desc(sql<number>`count(distinct ${scores.userId})`),
        desc(sql<number>`count(${scores.id})`),
        desc(gameLibrary.isFeatured),
        gameLibrary.title,
      )
      .limit(limit);
    return rows.map((row) => ({
      ...(row.game as Game),
      playerCount: Number(row.playerCount ?? 0),
      scoreCount: Number(row.scoreCount ?? 0),
    }));
  }

  async getGlobalTopPlayers(limit: number = 25) {
    const rows = await db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        totalScore: sql<number>`cast(coalesce(sum(case when ${scores.isPersonalBest} then ${scores.score} else 0 end), 0) as bigint)`,
        personalBests: sql<number>`cast(sum(case when ${scores.isPersonalBest} then 1 else 0 end) as int)`,
        globalRecords: sql<number>`cast(sum(case when ${scores.isGlobalRecord} then 1 else 0 end) as int)`,
      })
      .from(users)
      .leftJoin(scores, eq(scores.userId, users.id))
      .groupBy(users.id)
      .orderBy(
        desc(sql<number>`coalesce(sum(case when ${scores.isPersonalBest} then ${scores.score} else 0 end), 0)`),
        desc(sql<number>`sum(case when ${scores.isGlobalRecord} then 1 else 0 end)`),
      )
      .limit(limit);
    return rows
      .map((row) => ({
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        totalScore: Number(row.totalScore ?? 0),
        personalBests: Number(row.personalBests ?? 0),
        globalRecords: Number(row.globalRecords ?? 0),
      }))
      .filter((row) => row.totalScore > 0);
  }
}

const storage = new DatabaseStorage();

async function ensureStoreProductColumns() {
  try {
    await db.execute(
      sql`ALTER TABLE store_products ADD COLUMN IF NOT EXISTS gbux_price INTEGER`,
    );
  } catch (err) {
    console.warn("[storage] gbux_price column ensure skipped:", err);
  }
}

async function ensureRecentPlaysColumn() {
  try {
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS recent_plays JSONB DEFAULT '[]'::jsonb`,
    );
  } catch (err) {
    console.warn("[storage] recent_plays column ensure skipped:", err);
  }
}

async function bootstrapStorage() {
  await ensureStoreProductColumns();
  await ensureRecentPlaysColumn();
  const steps: Array<[string, () => Promise<void>]> = [
    ["store products", () => storage.initializeStoreProducts()],
    ["hydra products", () => storage.initializeHydraProducts()],
    ["platforms", () => storage.initializePlatforms()],
    ["games", () => storage.initializeGames()],
  ];
  for (const [label, fn] of steps) {
    try {
      await fn();
    } catch (err) {
      console.error(`[storage] initialize ${label} failed:`, err);
    }
  }
}

void bootstrapStorage();

export { storage };
