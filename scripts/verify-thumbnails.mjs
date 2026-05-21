#!/usr/bin/env node
// verify-thumbnails.mjs
//
// Walk every libretro-thumbnails URL in api/_games.json that lacks a No-Intro
// region tag at the end of the filename and HEAD-check it against jsDelivr. Some
// of these are legit (e.g. Neo Geo arcade releases live in SNK_-_Neo_Geo without
// region suffixes); others are leftover unresolved entries pointing at a missing
// filename. Prints a classified report only — does NOT mutate the catalog.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const GAMES_JSON = resolve(ROOT, "api/_games.json");

const RE = /libretro-thumbnails\/([^/@]+)@master\/Named_Boxarts\/(.+?)\.png(?:\?|$)/;

async function head(url) {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow" });
    return r.status;
  } catch {
    return 0;
  }
}

async function main() {
  const games = JSON.parse(await readFile(GAMES_JSON, "utf8"));
  const candidates = [];
  for (const g of games) {
    if (typeof g.thumbnailUrl !== "string") continue;
    const m = g.thumbnailUrl.match(RE);
    if (!m) continue;
    const fname = decodeURIComponent(m[2]);
    if (/\([^)]+\)\s*$/.test(fname)) continue;
    candidates.push({ game: g, url: g.thumbnailUrl });
  }
  console.log(`Checking ${candidates.length} region-tagless URLs in parallel batches...`);

  const ok = [],
    bad = [];
  const BATCH = 12;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((c) => head(c.url)));
    for (let j = 0; j < slice.length; j++) {
      const c = slice[j];
      const s = results[j];
      if (s === 200) ok.push({ ...c, status: s });
      else bad.push({ ...c, status: s });
    }
    process.stdout.write(
      `  ${Math.min(i + BATCH, candidates.length)}/${candidates.length}\r`,
    );
  }
  console.log();

  console.log(`\nVerified OK: ${ok.length}`);
  console.log(`Verified BROKEN: ${bad.length}`);
  if (bad.length) {
    console.log("\nBroken URLs (sample):");
    for (const b of bad.slice(0, 40)) {
      console.log(`  [${b.status}] ${b.game.platform}/${b.game.title}`);
    }
    if (bad.length > 40) console.log(`  ... ${bad.length - 40} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
