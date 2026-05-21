#!/usr/bin/env node
// diagnose-unresolved.mjs
//
// One-shot diagnostic: scans api/_games.json for entries that still don't have
// a No-Intro region suffix on their libretro-thumbnails URL and classifies each
// failure as either "wrong-platform" (the title exists on some other libretro
// repo we already know about) or "absent" (no libretro repo we've loaded has
// a credible match). Read-only; writes nothing.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const GAMES_JSON = resolve(ROOT, 'api/_games.json');

const REPOS = [
  'Nintendo_-_Nintendo_Entertainment_System',
  'Nintendo_-_Super_Nintendo_Entertainment_System',
  'Sega_-_Mega_Drive_-_Genesis',
  'Nintendo_-_Nintendo_64',
  'SNK_-_Neo_Geo_CD',
  'Sony_-_PlayStation',
  'Nintendo_-_Game_Boy',
  'Nintendo_-_Game_Boy_Color',
  'Nintendo_-_Game_Boy_Advance',
  'Nintendo_-_Nintendo_DS',
  'Sega_-_Master_System_-_Mark_III',
  'Sega_-_Game_Gear',
];

function normKey(s) {
  return s
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019\u02bc\u02bb]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s*[&_+]\s*/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchTreeKeys(repo) {
  const r = await fetch(`https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/master?recursive=1`, { headers: { 'User-Agent': 'diag' } });
  if (!r.ok) return null;
  const j = await r.json();
  if (!Array.isArray(j.tree)) return null;
  const keys = new Set();
  for (const t of j.tree) {
    if (t.type !== 'blob') continue;
    if (!t.path.startsWith('Named_Boxarts/') || !t.path.endsWith('.png')) continue;
    let base = t.path.slice('Named_Boxarts/'.length, -4);
    while (true) {
      const m = base.match(/\s*\(([^()]+)\)\s*$/);
      if (!m) break;
      base = base.slice(0, m.index).trimEnd();
    }
    keys.add(normKey(base));
    // article inversion alias
    const segs = base.split(/\s+-\s+/);
    const inv = segs.map((s) => { const m = s.match(/^(.+),\s*(The|A|An)$/); return m ? `${m[2]} ${m[1]}` : s; });
    if (inv.some((s, i) => s !== segs[i])) keys.add(normKey(inv.join(' - ')));
  }
  return keys;
}

async function main() {
  const games = JSON.parse(await readFile(GAMES_JSON, 'utf8'));
  const re = /libretro-thumbnails\/([^/@]+)@master\/Named_Boxarts\/(.+?)\.png(?:\?|$)/;
  const unresolved = [];
  for (const g of games) {
    if (typeof g.thumbnailUrl !== 'string') continue;
    const m = g.thumbnailUrl.match(re);
    if (!m) continue;
    const fname = decodeURIComponent(m[2]);
    if (/\([^)]+\)\s*$/.test(fname)) continue;
    unresolved.push({ platform: g.platform, title: g.title, current: fname, repo: m[1] });
  }
  console.log(`Unresolved entries: ${unresolved.length}`);

  console.log('Fetching trees...');
  const repoKeys = new Map();
  for (const repo of REPOS) {
    process.stdout.write(`  ${repo} ... `);
    const keys = await fetchTreeKeys(repo);
    if (!keys) { console.log('FAIL'); continue; }
    repoKeys.set(repo, keys);
    console.log(`${keys.size} keys`);
  }

  const stats = { wrongPlatform: [], absent: [] };
  for (const u of unresolved) {
    const k = normKey(u.title);
    const where = [];
    for (const [repo, keys] of repoKeys) {
      if (repo === u.repo) continue;
      if (keys.has(k)) where.push(repo);
    }
    if (where.length) stats.wrongPlatform.push({ ...u, foundIn: where });
    else stats.absent.push(u);
  }

  console.log(`\n=== Wrong-platform catalog entries: ${stats.wrongPlatform.length} ===`);
  for (const w of stats.wrongPlatform.slice(0, 40)) {
    console.log(`  [${w.platform}] ${w.title}  ->  exists in: ${w.foundIn.join(', ')}`);
  }
  if (stats.wrongPlatform.length > 40) console.log(`  ... ${stats.wrongPlatform.length - 40} more`);

  console.log(`\n=== Genuinely absent (no libretro match anywhere): ${stats.absent.length} ===`);
  for (const a of stats.absent.slice(0, 40)) {
    console.log(`  [${a.platform}] ${a.title}`);
  }
  if (stats.absent.length > 40) console.log(`  ... ${stats.absent.length - 40} more`);
}

main().catch((e) => { console.error(e); process.exit(1); });
