#!/usr/bin/env node
// probe-thumbnails.mjs
//
// Walks api/_games.json, and for every libretro-thumbnails Named_Boxarts
// thumbnailUrl that doesn't already have a No-Intro region suffix, HEAD-checks
// the bare URL plus a short fallback chain ((USA), (USA, Europe), (Europe),
// (Japan), (Japan, USA), (World)). The first URL that returns 200 is written
// back to the JSON in place. Entries that already have a (...) suffix or that
// don't point at libretro-thumbnails are left alone.
//
// Idempotent: rerunning the script after a successful pass is a no-op. Failures
// (every candidate 4xx/5xx) are reported and the original URL is preserved so
// the client-side fallback can still try them on render.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const GAMES_JSON = resolve(ROOT, 'api/_games.json');

const REGION_SUFFIXES = [
  ' (USA)',
  ' (USA, Europe)',
  ' (Europe)',
  ' (Japan)',
  ' (Japan, USA)',
  ' (World)',
];
const NAMED_BOXARTS_MARKER = '/Named_Boxarts/';
const CONCURRENCY = 8;
const TIMEOUT_MS = 8000;

function buildCandidates(url) {
  const idx = url.indexOf(NAMED_BOXARTS_MARKER);
  if (idx === -1) return null;
  const prefix = url.slice(0, idx + NAMED_BOXARTS_MARKER.length);
  const tail = url.slice(idx + NAMED_BOXARTS_MARKER.length);
  const qIdx = tail.indexOf('?');
  const query = qIdx === -1 ? '' : tail.slice(qIdx);
  const tailNoQuery = qIdx === -1 ? tail : tail.slice(0, qIdx);
  const dot = tailNoQuery.lastIndexOf('.');
  if (dot === -1) return null;
  const baseEncoded = tailNoQuery.slice(0, dot);
  const ext = tailNoQuery.slice(dot);
  let baseDecoded;
  try {
    baseDecoded = decodeURIComponent(baseEncoded);
  } catch {
    return null;
  }
  // Already region-suffixed → trust it, skip probing.
  if (/\([^)]+\)\s*$/.test(baseDecoded)) return { suffixed: true, urls: [url] };
  const urls = [url];
  for (const suffix of REGION_SUFFIXES) {
    urls.push(`${prefix}${encodeURIComponent(baseDecoded + suffix)}${ext}${query}`);
  }
  return { suffixed: false, urls };
}

async function head(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'HEAD', signal: ac.signal });
    return r.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

async function resolveBest(urls) {
  for (const u of urls) {
    const status = await head(u);
    if (status === 200) return { url: u, status };
  }
  return { url: null, status: 0 };
}

async function runPool(items, worker, concurrency) {
  let i = 0;
  const results = new Array(items.length);
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  const raw = await readFile(GAMES_JSON, 'utf8');
  const games = JSON.parse(raw);
  const targets = [];
  for (const g of games) {
    if (typeof g.thumbnailUrl !== 'string') continue;
    const c = buildCandidates(g.thumbnailUrl);
    if (!c) continue;
    if (c.suffixed) continue;
    targets.push({ game: g, candidates: c.urls });
  }
  console.log(`Probing ${targets.length} thumbnails (skipped ${games.length - targets.length} already-suffixed/non-libretro)...`);

  let fixed = 0;
  let unchanged = 0;
  let unresolved = 0;
  const failed = [];
  let done = 0;

  await runPool(targets, async ({ game, candidates }) => {
    const { url } = await resolveBest(candidates);
    done++;
    if (done % 50 === 0) process.stdout.write(`  ${done}/${targets.length}\r`);
    if (!url) {
      unresolved++;
      failed.push(`${game.platform}/${game.title}`);
      return;
    }
    if (url === game.thumbnailUrl) {
      unchanged++;
    } else {
      game.thumbnailUrl = url;
      fixed++;
    }
  }, CONCURRENCY);

  // Preserve the existing single-line minified format (matches what api/games.ts ships).
  await writeFile(GAMES_JSON, JSON.stringify(games));

  console.log(`\nDone.`);
  console.log(`  Fixed:      ${fixed}`);
  console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  Unresolved: ${unresolved}`);
  if (failed.length) {
    console.log(`\nUnresolved titles (no candidate returned 200):`);
    for (const t of failed.slice(0, 50)) console.log(`  - ${t}`);
    if (failed.length > 50) console.log(`  ... and ${failed.length - 50} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
