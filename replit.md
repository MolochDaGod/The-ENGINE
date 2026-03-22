# Rec0deD:88 Gaming Portal

## Overview

A retro gaming portal inspired by rec0ded88.com, combining a game library browser with custom-built game engines (Wargus RTS, Tower Defense, Avernus 3D, etc.). Features web scraping to populate the game library from external sources, EmulatorJS-powered game player at `/play/:id` with legacy iframe fallback, a digital product store, real-time chat with WebSocket, and comprehensive developer tools. All games play inside the app — no external redirects.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with CSS variables for theming, using shadcn/ui component library (New York style)
- **State Management**: TanStack Query (React Query) for server state, local React state for UI
- **Build Tool**: Vite with React plugin
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### Key Pages
- **Home (`/`)**: Gaming portal landing page with real DB data — platform counts, featured games, articles
- **Game Library (`/games`)**: Browsable game library with platform filters, A-Z tabs, case-insensitive search (works with platform filter), pagination, platform-colored game cards, scraping integration, play buttons
- **Game Player (`/play/:id`)**: EmulatorJS-powered player (CDN-loaded) with fullscreen, legacy iframe fallback, ROM proxy; all games play inside the app
- **Super Engine (`/super-engine`)**: Game cards with animated borders, capability badges, Three.js previews, FPS counter, retro games section, engine comparison table
- **Wargus (`/wargus`)**: Full 3D RTS with bloom post-processing, particles, water shader, cannon-es physics
- **Avernus 3D (`/avernus-3d`)**: 3D action combat with weapon selection, abilities, improved lighting
- **Tower Defense (`/tower-defense`)**: 3D tower defense with improved lighting
- **Decay Survival (`/decay-survival`)**: FPS survival horror
- **Overdrive 3D (`/overdrive-3d`)**: 3D racing with cannon-es physics, shadows, obstacles
- **Overdrive Racing (`/overdrive-racing`)**: 2D canvas racing with tire tracks, boost flames, speed lines, collision sparks
- **Puzzle Platformer (`/puzzle-platformer`)**: 2D canvas platformer with animated character, parallax backgrounds, collectible sparkles
- **Avernus Arena (`/avernus-arena`)**: 2D top-down arena combat with waves of demons
- **RPG Maker Studio (`/rpg-maker-studio`)**: RPG creation editor
- **Yahaha 3D World (`/yahaha-3d-world`)**: 3D world builder/editor
- **Asset Store (`/asset-store`)**: Game asset marketplace (templates, sprites, audio, 3D models)
- **Scraping (`/scraping`)**: Web scraping tool for extracting content
- **Store (`/store`)**: Digital product marketplace with 8 products across 3 categories
- **Chat (`/chat`)**: Real-time chat with WebSocket, 4 rooms (general, retro-gaming, custom-engines, trading), username via localStorage, messages persisted in DB

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api/` prefix
- **Static Assets**: Express serves `attached_assets/` at `/attached_assets/` for store product images

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (via Neon serverless driver)
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Managed via `drizzle-kit push` command

Key database tables:
- `users` - User accounts
- `game_platforms` - Platform definitions (NES, SNES, Genesis, N64, Neo Geo, PS1, GB, GBA, NDS, Custom)
- `game_library` - Scraped/added games with title, platform, slug, sourceUrl, embedUrl, isFeatured
- `articles` - Scraped articles with title, category, author, sourceUrl
- `scraping_jobs` - Web scraping job tracking
- `scraped_pages` - Individual scraped page data
- `store_products` - Digital products for sale (categories: software, enterprise, asset)
- `orders` - Customer purchase records
- `chat_messages` - Persisted chat messages with room, username, content, timestamp

### API Endpoints
- `GET /api/platforms` - List game platforms (with game counts)
- `GET /api/games?platform=&q=` - List/search games (case-insensitive, supports combined platform+search)
- `GET /api/games/featured` - List featured classic games (MUST be before `/api/games/:id` in routes)
- `GET /api/games/:id` - Get single game
- `GET /api/rom-proxy?url=` - Proxy ROM files from rec0ded88.com (bypass CORS for EmulatorJS)
- `GET /api/articles?category=` - List articles
- `GET /api/store/products` - List store products
- `GET /api/store/products/:id` - Get single product
- `POST /api/store/orders` - Create order
- `POST /api/scrape/games` - Scrape game listings from rec0ded88.com by platform
- `POST /api/scrape/articles` - Scrape article listings
- `POST /api/scraping-jobs` - Create web scraping job
- `GET /api/scraping-jobs/:id` - Get job status
- `GET /api/chat/rooms` - List chat rooms
- `GET /api/chat/messages?room=` - List chat messages by room
- `WebSocket /ws/chat` - Real-time chat (join/message/leave events)

### Shared Code
The `shared/` directory contains schema definitions and types used by both frontend and backend, ensuring type safety across the stack.

## External Dependencies

### Database
- **PostgreSQL**: Standard PostgreSQL via `pg` (node-postgres), connection via `DATABASE_URL` env var

### UI Components
- **shadcn/ui**: Component library built on Radix UI primitives
- **Framer Motion**: Animation library
- **Three.js**: 3D rendering for game engines (Wargus, Avernus, etc.)
- **cannon-es**: Physics engine for Wargus projectiles, debris, tree falling

### Web Scraping
- **Cheerio**: Server-side HTML parsing for scraping rec0ded88.com content

### Fonts
- Google Fonts: Cinzel, Cinzel Decorative, MedievalSharp, Uncial Antiqua, IM Fell English SC, Spectral SC, Inter

## Frontend Components (`client/src/components/`)
- `header.tsx` - Unified site header with hamburger nav, used globally via App.tsx
- `footer.tsx` - Site footer
- `store-section.tsx` - Store product grid with category sections
- `payment-form.tsx` - Payment modal for store purchases
- `scraping-tool.tsx` - Web scraping interface
- `enhanced-project-grid.tsx` - Project grid for engine launcher pages
- `ui/` - shadcn/ui component library

## Game Library Data
- 1,360+ games scraped across 9 platforms: NES(158), SNES(132), Genesis(107), N64(188), Neo Geo(76), PS1(117), GB(171), GBA(299), NDS(112)
- 12 featured classic games with cover art (Contra, Super Mario Bros, Zelda, Mega Man 2, Castlevania, Metroid, Double Dragon, Chrono Trigger, DK Country, FF3, Super Smash Bros, Call of Duty 4)
- 71 scraped articles
- Embed URL pattern: `/wp-content/emu/html/play-{platform}.html?gameName={name}.zip&gameID={id}`
- ROM URL pattern: `https://rec0ded88.com/wp-content/emu/games/{platform}/{gameName}.zip`

## EmulatorJS Integration
- `client/public/emulator.html` — standalone page that fetches ROM via proxy, creates blob URL, then starts EmulatorJS
- Parameters: `?core={emulatorCore}&platform={platformSlug}&game={gameTitle}`
- Supported cores: nes, snes, segaMD (genesis), n64, fbneo (neogeo), psx, gb, gba, nds
- ROM proxy fetches from rec0ded88.com, converts to blob URL to avoid CORS issues
- Fallback: Legacy player iframes rec0ded88.com's own player pages
- CDN: `https://cdn.emulatorjs.org/stable/data/`

## Store Products
- 8 products across 3 categories:
  - **Software** (3): Grudge Launcher License ($499), Wargus RTS Engine ($799), Retro Game Library ($299)
  - **Enterprise** (2): MMO Game Development ($1,499), Custom Development Solutions ($1,999)
  - **Asset** (3): Dark Fantasy Scene Pack ($49), Sci-Fi Environment Pack ($49), Character Sprite Collection ($39)
- All product images are locally generated and served from `/attached_assets/store/`
- Payment options: PayPal, Cryptocurrency, Credit/Debit Cards (UI only)

## Wargus RTS Engine Notes
- Full 3D RTS game at `/wargus` with Warcraft II-style gameplay
- Post-processing: EffectComposer with UnrealBloomPass for glow on gold mines, fires, projectiles
- Particle system: combat sparks, arrow trails, fire on damaged buildings, dust on unit movement
- Water shader: animated vertices with sin/cos waves, emissive glow
- cannon-es physics: ballista arcs, arrow trajectories, building debris, falling trees
- Features: unit combat with damage floating text, resource gathering with auto-repeat, fog of war, building construction, AI opponents
- Controls: WASD scroll, mouse wheel zoom, drag-select units, Ctrl+1-9 groups
- `lastGatherTarget` on units tracks auto-repeat harvesting
- Building cleanup: mesh + healthBar + auxMeshes; Resource cleanup: mesh + trunkMesh

## Important Route Ordering
- `/api/games/featured` MUST come BEFORE `/api/games/:id` in routes.ts to avoid "featured" being parsed as an ID

## Navigation Architecture
- **Unified Header** (`client/src/components/header.tsx`): Single header used site-wide via App.tsx
  - Left: Hamburger menu + Logo
  - Center: Nav links (Game Library, Super Engine, Store, Tools)
  - Right: Sign In + Play Games buttons
- **Slide-out Nav Panel**: Opens from left via hamburger, auto-closes on route change
  - Quick Access, Retro Games (platforms), Custom Games, Dev Tools sections
  - Accordion-style expandable sections
- Pages NO LONGER have their own headers — all use the shared header

## Image Assets
- **Logo/Favicon**: Golden helmet (`uXpJmRe`) — used as site logo, favicon, nav bar icon everywhere
- **Section Backgrounds** (imported via `@assets/`):
  - `YPyQLCN` (Broken Anchor tavern): Stats bar + Bounty Board section backgrounds
  - `AYGbVNN` (Cosmic arena statues): Super Engine Studio section background
  - `wuVFkl7` (Ancient temple): Heroes of the Grudge section background
  - `3KM8nDu` (Medieval marketplace): Featured Games + Articles section backgrounds
- **Page Backgrounds** (imported via `@assets/`):
  - `2kljxaj` (Necropolis): Home page
  - `HRuOcD2` (Moonlit Forest): Game Library
  - `jbIotta` (Forest Marketplace): Store
  - `IqGYJJe` (Crystal Fountain): Super Engine
  - `dcYwYe2` (Ancient Ruins): Scraping
- **Wanted Posters** (`7ZTde2Z`, `Emqj4q4`, `a6ejwT2`, `P1dQQZH`, `t56hW0q`): Bounty Board with GBUX objectives
- **Store Products**: Generated images at `attached_assets/store/` served via Express static
- **Game Covers**: Generated cover art at `attached_assets/game_covers/` for featured games
- All frontend images imported via `@assets/` alias — no external URLs for logos/images

## GBUX Currency System
- In-app currency called "GBUX"
- Earned by completing bounty board objectives (training/gameplay challenges)
- Rewards range from 2,500 to 15,000 GBUX per bounty

## Deployment (Self-Hosted)
- **No Replit dependencies** — fully portable, uses standard `pg` (node-postgres) driver
- **Build**: `npm run build` (Vite frontend build + esbuild server bundle -> `dist/`)
- **Run**: `npm run start` (Node.js production server from `dist/index.js`)
- **Port**: Configurable via `PORT` env var (default 5000)
- **Database**: Standard PostgreSQL (any provider — local, cloud, or managed)
- **Linux deploy**: `bash deploy-linux.sh` — installs Node.js, PostgreSQL, builds, and starts
- **Windows deploy**: `deploy-windows.bat` — builds and starts (requires Node.js + PostgreSQL pre-installed)
- **Systemd service**: `deploy/rec0ded88.service` — auto-start on boot
- **Nginx reverse proxy**: `deploy/nginx.conf` — serves on port 80

## Lighting Guidelines
- Avernus: HemisphereLight + strong DirectionalLight + lava PointLight, toneMappingExposure 1.8
- Tower Defense: AmbientLight 0.8 + HemisphereLight + DirectionalLight 1.5
- Decay Survival: Intentionally darker but AmbientLight 0.8, moonLight 1.2
- Wargus: Uses EffectComposer bloom, standard lighting setup

## UI Pattern Guidelines
- Fixed background overlay divs MUST have `pointer-events-none` to avoid blocking clicks
- Content areas use `relative z-10` to sit above backgrounds
- `ilike` (not `like`) for case-insensitive database search
- PLATFORM_COLORS map in game-library.tsx maps platform slug to CSS gradient + accent color
