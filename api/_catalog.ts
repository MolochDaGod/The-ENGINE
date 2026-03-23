// Shared game/platform data for Vercel serverless functions.
// Loaded from the embedded catalog — no database required.
// NOTE: uses relative path from api/ to root server/ directory

import { CATALOG } from './_catalog-data';

export interface GameEntry {
  id: number;
  title: string;
  slug: string;
  platform: string;
  embedUrl: string | null;
  isFeatured: boolean;
  category: string;
  isPlayable: boolean;
  description: string;
  thumbnailUrl: null;
  sourceUrl: null;
  platformId: null;
  createdAt: null;
}

export const GAMES: GameEntry[] = CATALOG.map(
  ([, title, slug, platform, embedUrl, isFeatured], index) => ({
    id: index + 1,
    title,
    slug,
    platform,
    embedUrl,
    isFeatured,
    category: 'retro',
    isPlayable: true,
    description: `Play ${title} online`,
    thumbnailUrl: null,
    sourceUrl: null,
    platformId: null,
    createdAt: null,
  })
);

export const PLATFORMS = [
  { id: 1, name: 'NES',               slug: 'nes',         description: 'Nintendo Entertainment System',        iconEmoji: '🎮', gameCount: 158 },
  { id: 2, name: 'SNES',              slug: 'snes',        description: 'Super Nintendo Entertainment System',  iconEmoji: '🕹️', gameCount: 132 },
  { id: 3, name: 'Sega Genesis',      slug: 'genesis',     description: 'Sega Genesis / Mega Drive',            iconEmoji: '🎯', gameCount: 107 },
  { id: 4, name: 'Nintendo 64',       slug: 'n64',         description: 'Nintendo 64',                          iconEmoji: '🏆', gameCount: 188 },
  { id: 5, name: 'Neo Geo',           slug: 'neogeo',      description: 'SNK Neo Geo',                          iconEmoji: '⚡', gameCount: 76  },
  { id: 6, name: 'PlayStation',       slug: 'playstation', description: 'Sony PlayStation',                     iconEmoji: '🎲', gameCount: 117 },
  { id: 7, name: 'Game Boy',          slug: 'gameboy',     description: 'Nintendo Game Boy',                    iconEmoji: '📱', gameCount: 171 },
  { id: 8, name: 'Game Boy Advance',  slug: 'gba',         description: 'Nintendo Game Boy Advance',            iconEmoji: '🌟', gameCount: 299 },
  { id: 9, name: 'Nintendo DS',       slug: 'nds',         description: 'Nintendo DS',                          iconEmoji: '📺', gameCount: 112 },
];
