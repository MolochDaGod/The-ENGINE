import { 
  users, scrapingJobs, scrapedPages, storeProducts, orders, gamePlatforms, gameLibrary, articles, chatMessages,
  type User, type InsertUser,
  type ScrapingJob, type InsertScrapingJob,
  type ScrapedPage, type InsertScrapedPage,
  type StoreProduct, type InsertStoreProduct,
  type Order, type InsertOrder,
  type GamePlatform, type InsertGamePlatform,
  type Game, type InsertGame,
  type Article, type InsertArticle,
  type ChatMessage, type InsertChatMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, like, desc, sql, and } from "drizzle-orm";

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
        image: "/attached_assets/store/grudge_launcher.png",
        isActive: true,
      },
      {
        name: "Wargus RTS Engine",
        description: "Complete 3D real-time strategy engine with bloom post-processing, physics, water shaders, fog of war, and AI opponents. Ready to deploy.",
        price: 79900,
        features: ["3D RTS engine with Three.js", "cannon-es physics system", "AI opponent logic", "Full source code"],
        category: "software",
        image: "/attached_assets/store/wargus_rts_engine.png",
        isActive: true,
      },
      {
        name: "Retro Game Library",
        description: "1,360+ scraped retro games across 9 platforms with EmulatorJS integration, ROM proxy, and a full game library browser.",
        price: 29900,
        features: ["1,360+ games, 9 platforms", "EmulatorJS in-app player", "Search and filter system", "Scraping tools included"],
        category: "software",
        image: "/attached_assets/store/retro_library.png",
        isActive: true,
      },
      {
        name: "MMO Game Development",
        description: "Complete MMO game development services — real-time multiplayer, persistent worlds, and custom game mechanics built to scale.",
        price: 149900,
        features: ["MMO architecture", "Real-time multiplayer", "Custom game mechanics", "Full source code"],
        category: "enterprise",
        image: "/attached_assets/store/mmo_development.png",
        isActive: true,
      },
      {
        name: "Custom Development Solutions",
        description: "Full-custom development solutions that comprehend and tackle any development challenge with precision and innovation.",
        price: 199900,
        features: ["Custom development", "Scalable architecture", "Ongoing support", "Performance optimization"],
        category: "enterprise",
        image: "/attached_assets/store/custom_development.png",
        isActive: true,
      },
      {
        name: "Dark Fantasy Scene Pack",
        description: "Medieval dungeons, lava caves, enchanted forests, and castle environments for dark fantasy games.",
        price: 4900,
        features: ["20+ environment scenes", "Seamless tiling textures", "PBR materials included"],
        category: "asset",
        image: "/attached_assets/store/dark_fantasy_scenes.png",
        isActive: true,
      },
      {
        name: "Sci-Fi Environment Pack",
        description: "Neon-lit cyberpunk streets, futuristic interiors, and space station environments for sci-fi games.",
        price: 4900,
        features: ["15+ environment scenes", "Emissive/glow materials", "Modular building pieces"],
        category: "asset",
        image: "/attached_assets/store/scifi_environment.png",
        isActive: true,
      },
      {
        name: "Character Sprite Collection",
        description: "Warriors, mages, archers, and creatures — animated sprite sheets ready for 2D or 2.5D games.",
        price: 3900,
        features: ["50+ character sprites", "Walk/attack/idle animations", "Multiple factions included"],
        category: "asset",
        image: "/attached_assets/store/character_sprites.png",
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
}

const storage = new DatabaseStorage();

(async () => {
  await storage.initializeStoreProducts();
  await storage.initializePlatforms();
})();

export { storage };
