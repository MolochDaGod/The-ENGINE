import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  grudgeId: text("grudge_id").notNull().unique(),
  puterId: text("puter_id").unique(),
  email: text("email").unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  gbuxBalance: numeric("gbux_balance", { precision: 18, scale: 4 }).default("0").notNull(),
  role: text("role").default("player").notNull(), // player | guest | member | admin | master
  // External identities (all optional, all unique)
  solanaAddress: text("solana_address").unique(),
  discordId: text("discord_id").unique(),
  githubId: text("github_id").unique(),
  googleId: text("google_id").unique(),
  phone: text("phone").unique(),
  needsProfile: boolean("needs_profile").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const scrapingJobs = pgTable("scraping_jobs", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").notNull(),
  maxPages: integer("max_pages").default(10),
  crawlDepth: integer("crawl_depth").default(1),
  outputFormat: text("output_format").default("json"),
  progress: integer("progress").default(0),
  pagesFound: integer("pages_found").default(0),
  pagesScraped: integer("pages_scraped").default(0),
  results: jsonb("results"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const scrapedPages = pgTable("scraped_pages", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => scrapingJobs.id),
  url: text("url").notNull(),
  title: text("title"),
  content: text("content"),
  htmlSource: text("html_source"),
  contentLength: integer("content_length"),
  scrapedAt: timestamp("scraped_at").defaultNow(),
});

export const storeProducts = pgTable("store_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  features: text("features").array(),
  category: text("category").notNull(),
  image: text("image"),
  isActive: boolean("is_active").default(true),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  productId: integer("product_id").references(() => storeProducts.id),
  amount: integer("amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentProvider: text("payment_provider"),
  transactionId: text("transaction_id"),
  paymentStatus: text("payment_status").notNull(),
  billingAddress: text("billing_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gamePlatforms = pgTable("game_platforms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconEmoji: text("icon_emoji"),
  gameCount: integer("game_count").default(0),
});

export const gameLibrary = pgTable("game_library", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  platformId: integer("platform_id").references(() => gamePlatforms.id),
  platform: text("platform").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  sourceUrl: text("source_url"),
  embedUrl: text("embed_url"),
  category: text("category"),
  isPlayable: boolean("is_playable").default(false),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  category: text("category"),
  content: text("content"),
  excerpt: text("excerpt"),
  thumbnailUrl: text("thumbnail_url"),
  author: text("author"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  message: text("message").notNull(),
  room: text("room").notNull().default("general"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  gameId: integer("game_id").references(() => gameLibrary.id).notNull(),
  score: integer("score").notNull(),
  isPersonalBest: boolean("is_personal_best").default(false),
  isGlobalRecord: boolean("is_global_record").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  challengerId: integer("challenger_id").references(() => users.id).notNull(),
  opponentId: integer("opponent_id").references(() => users.id).notNull(),
  gameId: integer("game_id").references(() => gameLibrary.id).notNull(),
  gbuxWager: numeric("gbux_wager", { precision: 18, scale: 4 }).default("0").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | active | completed | cancelled
  challengerScore: integer("challenger_score"),
  opponentScore: integer("opponent_score"),
  winnerId: integer("winner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // wager_escrow | wager_win | wager_refund | reward | purchase
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 18, scale: 4 }).notNull(),
  referenceType: text("reference_type"), // challenge | score | store
  referenceId: integer("reference_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Web3 / Solana ────────────────────────────────────────────────

export const web3Transactions = pgTable("web3_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  txSignature: text("tx_signature").unique(),
  txType: text("tx_type").notNull(), // mint | swap | stake | burn | transfer | escrow | offboard | reward
  amount: numeric("amount", { precision: 18, scale: 4 }),
  tokenMint: text("token_mint"), // SPL mint address (GBUX, SOL, etc.)
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed | queued
  blockSlot: integer("block_slot"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // arbitrary extra data (gameId, score, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const walletConnections = pgTable("wallet_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  walletAddress: text("wallet_address").notNull(),
  provider: text("provider").notNull(), // phantom_connect | extension | google | apple | server
  chain: text("chain").notNull().default("solana"), // solana | ethereum
  isActive: boolean("is_active").default(true).notNull(),
  connectedAt: timestamp("connected_at").defaultNow(),
  disconnectedAt: timestamp("disconnected_at"),
});

// ── Friends ──────────────────────────────────────────────────────

export const friends = pgTable("friends", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").references(() => users.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | blocked
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Tournaments ──────────────────────────────────────────────────

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gameId: integer("game_id").references(() => gameLibrary.id).notNull(),
  format: text("format").notNull().default("single_elimination"), // single_elimination | double_elimination | round_robin
  maxPlayers: integer("max_players").notNull().default(8),
  entryFee: numeric("entry_fee", { precision: 18, scale: 4 }).default("0").notNull(),
  prizePool: numeric("prize_pool", { precision: 18, scale: 4 }).default("0").notNull(),
  status: text("status").notNull().default("open"), // open | active | completed | cancelled
  bracket: jsonb("bracket"), // tournament bracket structure
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  winnerId: integer("winner_id").references(() => users.id),
  startAt: timestamp("start_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tournamentEntries = pgTable("tournament_entries", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  seed: integer("seed"),
  eliminated: boolean("eliminated").default(false).notNull(),
  finalPlacement: integer("final_placement"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const tournamentMatches = pgTable("tournament_matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  round: integer("round").notNull(),
  matchIndex: integer("match_index").notNull(),
  player1Id: integer("player1_id").references(() => users.id),
  player2Id: integer("player2_id").references(() => users.id),
  player1Score: integer("player1_score"),
  player2Score: integer("player2_score"),
  winnerId: integer("winner_id").references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | active | completed | bye
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLoginAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertScoreSchema = createInsertSchema(scores).omit({ id: true, createdAt: true, isPersonalBest: true, isGlobalRecord: true });
export const insertChallengeSchema = createInsertSchema(challenges).omit({ id: true, status: true, challengerScore: true, opponentScore: true, winnerId: true, createdAt: true, resolvedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertScrapingJobSchema = createInsertSchema(scrapingJobs).omit({
  id: true, status: true, progress: true, pagesFound: true, pagesScraped: true, results: true, error: true, createdAt: true, completedAt: true,
});
export const insertStoreProductSchema = createInsertSchema(storeProducts).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertScrapedPageSchema = createInsertSchema(scrapedPages).omit({ id: true });
export const insertGamePlatformSchema = createInsertSchema(gamePlatforms).omit({ id: true });
export const insertGameSchema = createInsertSchema(gameLibrary).omit({ id: true, createdAt: true });
export const insertArticleSchema = createInsertSchema(articles).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;
export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapedPage = z.infer<typeof insertScrapedPageSchema>;
export type ScrapedPage = typeof scrapedPages.$inferSelect;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertGamePlatform = z.infer<typeof insertGamePlatformSchema>;
export type GamePlatform = typeof gamePlatforms.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gameLibrary.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertScore = z.infer<typeof insertScoreSchema>;
export type Score = typeof scores.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const insertWeb3TransactionSchema = createInsertSchema(web3Transactions).omit({ id: true, createdAt: true, confirmedAt: true });
export const insertWalletConnectionSchema = createInsertSchema(walletConnections).omit({ id: true, connectedAt: true, disconnectedAt: true });

export type InsertWeb3Transaction = z.infer<typeof insertWeb3TransactionSchema>;
export type Web3Transaction = typeof web3Transactions.$inferSelect;
export type InsertWalletConnection = z.infer<typeof insertWalletConnectionSchema>;
export type WalletConnection = typeof walletConnections.$inferSelect;
