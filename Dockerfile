# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json drizzle.config.ts vite.config.ts postcss.config.js tailwind.config.ts ./
COPY server ./server
COPY client ./client
COPY shared ./shared

# Build client (Vite → dist/public) and server (esbuild → dist/index.js)
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
# Install production deps + drizzle-kit for migrations
RUN npm install --omit=dev && npm install drizzle-kit

# Copy built client + server
COPY --from=build /app/dist ./dist

# Copy source for drizzle-kit schema push (needs schema.ts)
COPY shared ./shared
COPY drizzle.config.ts ./

EXPOSE 5000

# Run DB migration then start server
CMD ["sh", "-c", "npx drizzle-kit push --config=drizzle.config.ts && node dist/index.js"]
