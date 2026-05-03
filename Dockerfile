# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY tsconfig.json drizzle.config.ts vite.config.ts postcss.config.js tailwind.config.ts ./
COPY server ./server
COPY client ./client
COPY shared ./shared
COPY attached_assets ./attached_assets

# Build client (Vite → dist/public) and server (esbuild → dist/index.js)
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
# drizzle-kit needed for DB migrations at startup
RUN npm install drizzle-kit

# Copy built client + server
COPY --from=build /app/dist ./dist

# Copy source for drizzle-kit schema push (needs schema.ts)
COPY shared ./shared
COPY attached_assets ./attached_assets
COPY drizzle.config.ts ./

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Optionally run DB schema push, then start server
CMD ["sh", "-c", "if [ \"$RUN_DB_PUSH_ON_START\" = \"true\" ]; then npx drizzle-kit push --config=drizzle.config.ts; fi && node dist/index.js"]
