# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY server ./server
COPY shared ./shared

# Build server only (no Vite frontend needed for API container)
RUN npm run build:server

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
# Install production deps + drizzle-kit for migrations
RUN npm ci --omit=dev && npm install drizzle-kit

# Copy built server
COPY --from=build /app/dist ./dist

# Copy source for drizzle-kit schema push (needs schema.ts)
COPY shared ./shared
COPY drizzle.config.ts ./

EXPOSE 5000

# Run DB migration then start server
CMD ["sh", "-c", "npx drizzle-kit push --config=drizzle.config.ts && node dist/index.js"]
