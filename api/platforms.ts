const PLATFORMS = [
  { id: 1, name: 'NES',              slug: 'nes',         description: 'Nintendo Entertainment System',       iconEmoji: '\ud83c\udfae', gameCount: 148 },
  { id: 2, name: 'SNES',             slug: 'snes',        description: 'Super Nintendo Entertainment System', iconEmoji: '\ud83d\udd79\ufe0f', gameCount: 132 },
  { id: 3, name: 'Sega Genesis',     slug: 'genesis',     description: 'Sega Genesis / Mega Drive',           iconEmoji: '\ud83c\udfaf', gameCount: 107 },
  { id: 4, name: 'Nintendo 64',      slug: 'n64',         description: 'Nintendo 64',                         iconEmoji: '\ud83c\udfc6', gameCount: 188 },
  { id: 5, name: 'Neo Geo',          slug: 'neogeo',      description: 'SNK Neo Geo',                         iconEmoji: '\u26a1', gameCount: 76  },
  { id: 6, name: 'PlayStation',      slug: 'playstation', description: 'Sony PlayStation',                    iconEmoji: '\ud83c\udfb2', gameCount: 117 },
  { id: 7, name: 'Game Boy',         slug: 'gameboy',     description: 'Nintendo Game Boy',                   iconEmoji: '\ud83d\udcf1', gameCount: 171 },
  { id: 8, name: 'Game Boy Advance', slug: 'gba',         description: 'Nintendo Game Boy Advance',           iconEmoji: '\ud83c\udf1f', gameCount: 299 },
  { id: 9, name: 'Nintendo DS',      slug: 'nds',         description: 'Nintendo DS',                         iconEmoji: '\ud83d\udcfa', gameCount: 112 },
];

export default function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.json(PLATFORMS);
}
