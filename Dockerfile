# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --ignore-scripts || npm install --legacy-peer-deps --ignore-scripts

COPY tsconfig.json drizzle.config.ts vite.config.ts ./
COPY server ./server
COPY shared ./shared
# storage.ts imports catalog JSON via ../api/_games.json
COPY api ./api

# API-only Railway image — Vercel serves the Vite client
RUN npm run build:server
RUN mkdir -p dist/public

# ── Stage 2: Production ────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache git

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts || npm install --omit=dev --legacy-peer-deps --ignore-scripts
# drizzle-kit needed for DB migrations at startup (must keep legacy-peer-deps — grudge-control peerOptional)
RUN npm install drizzle-kit --legacy-peer-deps --ignore-scripts

# Copy built client + server
COPY --from=build /app/dist ./dist

# Copy source for drizzle-kit schema push (needs schema.ts)
COPY shared ./shared
COPY drizzle.config.ts ./
# API image is not the asset host (Vercel + CDN). Keep an empty dir so
# /api/assets readdir does not throw if the folder is railwayignored.
RUN mkdir -p attached_assets

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

# Optionally run DB schema push, then start server
CMD ["sh", "-c", "if [ \"$RUN_DB_PUSH_ON_START\" = \"true\" ]; then npx drizzle-kit push --config=drizzle.config.ts; fi && node dist/index.js"]
