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

  listGames(platform?: string): Promise<Game[]>;
  getGame(id: number): Promise<Game | undefined>;
  createGame(game: InsertGame): Promise<Game>;
  searchGames(query: string, platform?: string): Promise<Game[]>;

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
    totalScores: number;
    personalBests: number;
    globalRecords: number;
    challengesWon: number;
    challengesLost: number;
  }>;
  getRecentPlayerScores(userId: number, limit?: number): Promise<Array<Score & { gameTitle: string; platform: string; thumbnailUrl: string | null }>>;
  getPlayerGames(userId: number): Promise<Array<{ game: Game; bestScore: number; personalBestAt: Date | null }>>;
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
      const values = batch.map(([, title, slug, platform, embedUrl, isFeatured]) => ({
        title,
        slug,
        platform,
        platformId: null,
        description: `Play ${title} online`,
        thumbnailUrl: null,
        sourceUrl: null,
        embedUrl,
        category: "retro",
        isPlayable: true,
        isFeatured,
      }));
      await db.insert(gameLibrary).values(values);
    }

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

  async listGames(platform?: string): Promise<Game[]> {
    if (platform) {
      return await db.select().from(gameLibrary).where(eq(gameLibrary.platform, platform)).orderBy(gameLibrary.title);
    }
    return await db.select().from(gameLibrary).orderBy(gameLibrary.title);
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [g] = await db.select().from(gameLibrary).where(eq(gameLibrary.id, id));
    return g || undefined;
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [g] = await db.insert(gameLibrary).values(game).returning();
    return g;
  }

  async searchGames(query: string, platform?: string): Promise<Game[]> {
    const conditions = [ilike(gameLibrary.title, `%${query}%`)];
    if (platform) conditions.push(eq(gameLibrary.platform, platform));
    return await db.select().from(gameLibrary).where(and(...conditions)).orderBy(gameLibrary.title);
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

  async getPlayerStats(userId: number) {
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

    return {
      gamesPlayed: gamesPlayedRow?.count ?? 0,
      totalScores: totalScoresRow?.count ?? 0,
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

(async () => {
  await storage.initializeStoreProducts();
  await storage.initializePlatforms();
  await storage.initializeGames();
})();

export { storage };
