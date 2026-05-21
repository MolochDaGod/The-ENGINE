#!/usr/bin/env node
// fuzzy-match-thumbnails.mjs
//
// Phase 2 of asset normalization. For every libretro-thumbnails URL in
// api/_games.json that still lacks a No-Intro region suffix (i.e. probe-thumbnails
// couldn't resolve it), fetch the full Named_Boxarts file list from the matching
// libretro-thumbnails GitHub repo and try to match against title variants:
//   - en-dash / em-dash -> hyphen
//   - curly quotes -> straight
//   - "and" <-> "&"
//   - article inversion: "The X" -> "X, The" (also A/An)
//   - colon -> " -"
//   - case-insensitive compare, punctuation/whitespace stripped for the key.
// Picks the first 200-bound region in preference order (USA > USA,Europe > Europe
// > World > Japan,USA > Japan).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const GAMES_JSON = resolve(ROOT, 'api/_games.json');
const REGION_PRIORITY = [
  /^\(USA\)$/i, /^\(USA, Europe\)$/i, /^\(Europe\)$/i, /^\(World\)$/i,
  /^\(Japan, USA\)$/i, /^\(USA, Japan\)$/i, /^\(Japan\)$/i, /^\(.*\)$/,
];

function normKey(s) {
  return s
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019\u02bc\u02bb]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleVariants(title) {
  const base = title
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019\u02bc\u02bb]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  const variants = new Set([base]);
  // article inversion
  const articleMatch = base.match(/^(The|A|An)\s+(.+)$/);
  if (articleMatch) variants.add(`${articleMatch[2]}, ${articleMatch[1]}`);
  // and <-> &
  if (/ and /i.test(base)) variants.add(base.replace(/ and /gi, ' & '));
  if (/ & /.test(base)) variants.add(base.replace(/ & /g, ' and '));
  // colon -> " -"
  if (base.includes(':')) variants.add(base.replace(/:\s*/g, ' - '));
  // combo: article inversion + and<->&
  for (const v of [...variants]) {
    const am = v.match(/^(The|A|An)\s+(.+)$/);
    if (am) variants.add(`${am[2]}, ${am[1]}`);
    if (/ and /i.test(v)) variants.add(v.replace(/ and /gi, ' & '));
  }
  return [...variants];
}

async function fetchTree(repo) {
  // Try `master` then `main`.
  for (const ref of ['master', 'main']) {
    const r = await fetch(`https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/${ref}?recursive=1`,
      { headers: { 'User-Agent': 'thumb-fuzzy-match', Accept: 'application/vnd.github+json' } });
    if (!r.ok) continue;
    const j = await r.json();
    if (!Array.isArray(j.tree)) continue;
    return { ref, files: j.tree.filter(t => t.type === 'blob' && t.path.startsWith('Named_Boxarts/') && t.path.endsWith('.png')).map(t => t.path.slice('Named_Boxarts/'.length)) };
  }
  return null;
}

function buildIndex(files) {
  // key -> list of { full, region, base }
  const map = new Map();
  for (const f of files) {
    const noExt = f.replace(/\.png$/i, '');
    const regionM = noExt.match(/\s*\(([^)]+)\)\s*$/);
    const base = regionM ? noExt.slice(0, regionM.index).trim() : noExt;
    const region = regionM ? `(${regionM[1]})` : '';
    const key = normKey(base);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ full: f, region, base });
  }
  return map;
}

function pickBest(entries) {
  for (const pat of REGION_PRIORITY) {
    const hit = entries.find(e => pat.test(e.region));
    if (hit) return hit;
  }
  return entries[0];
}

async function main() {
  const raw = await readFile(GAMES_JSON, 'utf8');
  const games = JSON.parse(raw);
  const repoRe = /libretro-thumbnails\/([^/@]+)@master\/Named_Boxarts\/(.+?)\.png(?:\?|$)/;
  const targets = [];
  for (const g of games) {
    if (typeof g.thumbnailUrl !== 'string') continue;
    const m = g.thumbnailUrl.match(repoRe);
    if (!m) continue;
    const fname = decodeURIComponent(m[2]);
    if (/\([^)]+\)\s*$/.test(fname)) continue; // already suffixed
    targets.push({ game: g, repo: m[1], current: fname });
  }
  const repos = [...new Set(targets.map(t => t.repo))];
  console.log(`Unresolved targets: ${targets.length} across ${repos.length} repos`);

  const indexes = new Map();
  for (const repo of repos) {
    process.stdout.write(`  fetching tree: ${repo} ... `);
    const tree = await fetchTree(repo);
    if (!tree) { console.log('FAILED'); continue; }
    const idx = buildIndex(tree.files);
    indexes.set(repo, idx);
    console.log(`${tree.files.length} files, ${idx.size} unique titles`);
  }

  let fixed = 0, missed = 0;
  const misses = [];
  for (const { game, repo, current } of targets) {
    const idx = indexes.get(repo);
    if (!idx) { missed++; continue; }
    const variants = titleVariants(current);
    let hit = null;
    for (const v of variants) {
      const entries = idx.get(normKey(v));
      if (entries && entries.length) { hit = pickBest(entries); break; }
    }
    if (!hit) { missed++; misses.push(`${game.platform}/${current}`); continue; }
    game.thumbnailUrl = `https://cdn.jsdelivr.net/gh/libretro-thumbnails/${repo}@master/Named_Boxarts/${encodeURIComponent(hit.full)}`;
    fixed++;
  }

  await writeFile(GAMES_JSON, JSON.stringify(games));
  console.log(`\nFixed: ${fixed}  Missed: ${missed}`);
  if (misses.length) {
    console.log(`\nStill unresolved (sample):`);
    for (const m of misses.slice(0, 40)) console.log(`  - ${m}`);
    if (misses.length > 40) console.log(`  ... and ${misses.length - 40} more`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
