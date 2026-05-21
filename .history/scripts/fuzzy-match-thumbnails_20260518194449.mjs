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

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const GAMES_JSON = resolve(ROOT, "api/_games.json");

// Fallback repos checked (in order) when a title doesn't resolve in its primary
// repo. Currently only used for Neo Geo: the catalog points all Neo Geo titles at
// SNK_-_Neo_Geo_CD (which has ~160 CD-only releases), but the bulk of recognizable
// Neo Geo titles are MVS/AES arcade games living in SNK_-_Neo_Geo and the FBNeo
// arcade roms repo. If a fallback resolves, we rewrite the URL to that repo.
const REPO_FALLBACKS = {
  SNK_minus_Neo_Geo_CD: ["SNK_-_Neo_Geo", "FBNeo_-_Arcade_Games"],
  "SNK_-_Neo_Geo_CD": ["SNK_-_Neo_Geo", "FBNeo_-_Arcade_Games"],
};
const REGION_PRIORITY = [
  /^\(USA\)$/i,
  /^\(USA, Europe\)$/i,
  /^\(Europe\)$/i,
  /^\(World\)$/i,
  /^\(Japan, USA\)$/i,
  /^\(USA, Japan\)$/i,
  /^\(Japan\)$/i,
  /^\(.*\)$/,
];

function normKey(s) {
  return (
    s
      .toLowerCase()
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u2018\u2019\u02bc\u02bb]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      // libretro-thumbnails substitutes "_" for "&" (FAT-safe). "+" appears in NES compilation
      // names ("Super Mario Bros. + Duck Hunt"). Treat all three as the same join token.
      .replace(/\s*[&_+]\s*/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

const STUDIO_PREFIXES = [
  /^Disney's\s+/i,
  /^Disney\s+/i,
  /^Walt Disney's\s+/i,
  /^Bram Stoker's\s+/i,
  /^Tom Clancy's\s+/i,
  /^Sid Meier's\s+/i,
  /^Jim Henson's\s+/i,
  /^Garry Kitchen's\s+/i,
];

function titleVariants(title) {
  const base = title
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019\u02bc\u02bb]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  const variants = new Set([base]);
  const enqueue = (v) => {
    if (v && !variants.has(v)) variants.add(v);
  };
  // article inversion
  const am = base.match(/^(The|A|An)\s+(.+)$/);
  if (am) enqueue(`${am[2]}, ${am[1]}`);
  // and <-> &
  if (/ and /i.test(base)) enqueue(base.replace(/ and /gi, " & "));
  if (/ & /.test(base)) enqueue(base.replace(/ & /g, " and "));
  // colon -> " -"
  if (base.includes(":")) enqueue(base.replace(/:\s*/g, " - "));
  // studio prefix strip
  for (const re of STUDIO_PREFIXES)
    if (re.test(base)) enqueue(base.replace(re, ""));
  // recursive combos across what we just enqueued
  for (const v of [...variants]) {
    const m = v.match(/^(The|A|An)\s+(.+)$/);
    if (m) enqueue(`${m[2]}, ${m[1]}`);
    if (/ and /i.test(v)) enqueue(v.replace(/ and /gi, " & "));
    if (/ & /.test(v)) enqueue(v.replace(/ & /g, " and "));
    for (const re of STUDIO_PREFIXES)
      if (re.test(v)) enqueue(v.replace(re, ""));
  }
  return [...variants];
}

// Compact key drops all whitespace (handles "ClayFighter" <-> "Clay Fighter").
function compactKey(s) {
  return normKey(s).replace(/\s+/g, "");
}

const GH_HEADERS = {
  "User-Agent": "thumb-fuzzy-match",
  Accept: "application/vnd.github+json",
};

async function fetchTree(repo) {
  // 1) Try a recursive root tree on master/main. If not truncated, filter to Named_Boxarts.
  for (const ref of ["master", "main"]) {
    const r = await fetch(
      `https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/${ref}?recursive=1`,
      { headers: GH_HEADERS },
    );
    if (!r.ok) continue;
    const j = await r.json();
    if (!Array.isArray(j.tree)) continue;
    const files = j.tree
      .filter(
        (t) =>
          t.type === "blob" &&
          t.path.startsWith("Named_Boxarts/") &&
          t.path.endsWith(".png"),
      )
      .map((t) => t.path.slice("Named_Boxarts/".length));
    // If truncated AND we recovered zero boxarts (PSX-style overflow), fall through.
    if (j.truncated && files.length === 0) break;
    return { ref, files, truncated: !!j.truncated };
  }
  // 2) Fallback: locate Named_Boxarts dir SHA via non-recursive root tree, then fetch its tree.
  for (const ref of ["master", "main"]) {
    const r = await fetch(
      `https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/${ref}`,
      { headers: GH_HEADERS },
    );
    if (!r.ok) continue;
    const j = await r.json();
    if (!Array.isArray(j.tree)) continue;
    const dir = j.tree.find(
      (t) => t.type === "tree" && t.path === "Named_Boxarts",
    );
    if (!dir) continue;
    const r2 = await fetch(
      `https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/${dir.sha}`,
      { headers: GH_HEADERS },
    );
    if (!r2.ok) continue;
    const j2 = await r2.json();
    if (!Array.isArray(j2.tree)) continue;
    const files = j2.tree
      .filter((t) => t.type === "blob" && t.path.endsWith(".png"))
      .map((t) => t.path);
    return { ref, files, truncated: !!j2.truncated };
  }
  return null;
}

function stripTrailingParens(s) {
  // Pulls every trailing "(...)" group off the end; returns { base, parens: ["(USA)", "(En,Es)"] }.
  const parens = [];
  let cur = s;
  while (true) {
    const m = cur.match(/\s*\(([^()]+)\)\s*$/);
    if (!m) break;
    parens.unshift(`(${m[1]})`);
    cur = cur.slice(0, m.index).trimEnd();
  }
  return { base: cur, parens };
}

function buildIndex(files) {
  // exact: normKey -> entries; compact: compactKey -> entries; sortedKeys for prefix scan.
  const exact = new Map();
  const compact = new Map();
  const push = (map, key, entry) => {
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key).includes(entry)) map.get(key).push(entry);
  };
  for (const f of files) {
    const noExt = f.replace(/\.png$/i, "");
    const { base, parens } = stripTrailingParens(noExt);
    const entry = { full: f, parens, base };
    push(exact, normKey(base), entry);
    push(compact, compactKey(base), entry);
    // Studio-stripped aliases: lets catalog "Battletank" match libretro "Garry Kitchen's Battletank".
    for (const re of STUDIO_PREFIXES) {
      if (re.test(base)) {
        const stripped = base.replace(re, "");
        push(exact, normKey(stripped), entry);
        push(compact, compactKey(stripped), entry);
      }
    }
    // Article-inverted aliases: handles both
    //   "Karate Kid, The" -> "The Karate Kid"
    //   "Simpsons, The - Bart vs. the World" -> "The Simpsons - Bart vs. the World"
    // by inverting any segment that ends in ", The|A|An".
    const segs = base.split(/\s+-\s+/);
    const invertedSegs = segs.map((s) => {
      const m = s.match(/^(.+),\s*(The|A|An)$/);
      return m ? `${m[2]} ${m[1]}` : s;
    });
    if (invertedSegs.some((s, i) => s !== segs[i])) {
      const inverted = invertedSegs.join(" - ");
      push(exact, normKey(inverted), entry);
      push(compact, compactKey(inverted), entry);
    }
  }
  const sortedKeys = [...exact.keys()].sort();
  return { exact, compact, sortedKeys, size: exact.size };
}

function findPrefixMatch(sortedKeys, exact, prefix, strictWord = true) {
  // Binary search; default requires a word boundary (`prefix + " "`) so short titles
  // don't accidentally match unrelated long ones. `strictWord=false` is used for
  // catalog titles that arrived literally truncated mid-word with "...".
  const needle = strictWord ? prefix + " " : prefix;
  let lo = 0,
    hi = sortedKeys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedKeys[mid] < needle) lo = mid + 1;
    else hi = mid;
  }
  if (lo >= sortedKeys.length) return null;
  if (!sortedKeys[lo].startsWith(needle)) return null;
  return exact.get(sortedKeys[lo]) || null;
}

function pickBest(entries) {
  for (const pat of REGION_PRIORITY) {
    const hit = entries.find((e) => e.parens.some((p) => pat.test(p)));
    if (hit) return hit;
  }
  return entries[0];
}

async function main() {
  const raw = await readFile(GAMES_JSON, "utf8");
  const games = JSON.parse(raw);
  const repoRe =
    /libretro-thumbnails\/([^/@]+)@master\/Named_Boxarts\/(.+?)\.png(?:\?|$)/;
  const targets = [];
  for (const g of games) {
    if (typeof g.thumbnailUrl !== "string") continue;
    const m = g.thumbnailUrl.match(repoRe);
    if (!m) continue;
    const fname = decodeURIComponent(m[2]);
    if (/\([^)]+\)\s*$/.test(fname)) continue; // already suffixed
    targets.push({ game: g, repo: m[1], current: fname });
  }
  const primaryRepos = new Set(targets.map((t) => t.repo));
  // Pull in any fallback repos that any primary repo asks for.
  const fallbackRepos = new Set();
  for (const r of primaryRepos)
    for (const fb of REPO_FALLBACKS[r] || []) fallbackRepos.add(fb);
  const repos = [...primaryRepos, ...fallbackRepos];
  console.log(
    `Unresolved targets: ${targets.length} across ${primaryRepos.size} primary repos (+${fallbackRepos.size} fallback)`,
  );

  const indexes = new Map();
  for (const repo of repos) {
    process.stdout.write(`  fetching tree: ${repo} ... `);
    const tree = await fetchTree(repo);
    if (!tree) {
      console.log("FAILED");
      continue;
    }
    const idx = buildIndex(tree.files);
    indexes.set(repo, idx);
    console.log(`${tree.files.length} files, ${idx.size} unique titles`);
  }

  function matchInIndex(idx, variants, wasTruncated) {
    // Layer 1: exact normalized match
    for (const v of variants) {
      const e = idx.exact.get(normKey(v));
      if (e && e.length) return { hit: pickBest(e), layer: "exact" };
    }
    // Layer 2: compact-word match (whitespace collapsed)
    for (const v of variants) {
      const e = idx.compact.get(compactKey(v));
      if (e && e.length) return { hit: pickBest(e), layer: "compact" };
    }
    // Layer 3: subtitle-prefix match ("A Boy and His Blob" -> "A Boy and His Blob - Trouble on Blobolonia")
    for (const v of variants) {
      const e = findPrefixMatch(
        idx.sortedKeys,
        idx.exact,
        normKey(v),
        !wasTruncated,
      );
      if (e && e.length) return { hit: pickBest(e), layer: "prefix" };
    }
    return null;
  }

  // Cross-repo last-resort scan tries indexes in this order. We bias toward repos
  // most likely to hold the genuine cover when the catalog has the wrong platform
  // (e.g. snes/Mario Kart 64 -> N64; snes/Crash Bandicoot -> PSX).
  const CROSS_REPO_ORDER = [
    "Nintendo_-_Nintendo_64",
    "Sony_-_PlayStation",
    "Nintendo_-_Super_Nintendo_Entertainment_System",
    "Nintendo_-_Game_Boy_Advance",
    "Nintendo_-_Nintendo_Entertainment_System",
    "Sega_-_Mega_Drive_-_Genesis",
    "Nintendo_-_Game_Boy",
    "Nintendo_-_Nintendo_DS",
    "SNK_-_Neo_Geo",
    "FBNeo_-_Arcade_Games",
    "SNK_-_Neo_Geo_CD",
  ];

  let fixed = 0,
    missed = 0,
    fixedByLayer = { exact: 0, compact: 0, prefix: 0 },
    fixedByFallback = 0,
    fixedByCrossRepo = 0;
  const misses = [];
  for (const { game, repo, current } of targets) {
    // Strip trailing "..." (six catalog titles arrived truncated; prefix-match layer
    // can still resolve them once the ellipsis is gone). Truncated titles use a relaxed
    // (no-word-boundary) prefix match because they're typically chopped mid-word.
    const wasTruncated = /\.{3}\s*$/.test(current);
    const cleaned = current.replace(/\s*\.{3}\s*$/u, "").trim();
    const variants = titleVariants(cleaned);

    // Try primary repo first, then each declared fallback in order.
    const repoChain = [repo, ...(REPO_FALLBACKS[repo] || [])];
    let matchedRepo = null,
      result = null;
    for (const r of repoChain) {
      const idx = indexes.get(r);
      if (!idx) continue;
      const m = matchInIndex(idx, variants, wasTruncated);
      if (m) {
        result = m;
        matchedRepo = r;
        break;
      }
    }
    // Cross-repo last-resort: scan any other already-loaded index.
    let wasCrossRepo = false;
    if (!result) {
      const seen = new Set(repoChain);
      const order = [
        ...CROSS_REPO_ORDER.filter((r) => indexes.has(r) && !seen.has(r)),
        ...[...indexes.keys()].filter(
          (r) => !seen.has(r) && !CROSS_REPO_ORDER.includes(r),
        ),
      ];
      for (const r of order) {
        const m = matchInIndex(indexes.get(r), variants, wasTruncated);
        if (m && m.layer !== "prefix") {
          // Skip prefix matches across repos: too easy to grab the wrong subtitle.
          result = m;
          matchedRepo = r;
          wasCrossRepo = true;
          break;
        }
      }
    }

    if (!result) {
      missed++;
      misses.push(`${game.platform}/${current}`);
      continue;
    }
    game.thumbnailUrl = `https://cdn.jsdelivr.net/gh/libretro-thumbnails/${matchedRepo}@master/Named_Boxarts/${encodeURIComponent(result.hit.full)}`;
    fixed++;
    fixedByLayer[result.layer]++;
    if (matchedRepo !== repo) fixedByFallback++;
    if (wasCrossRepo) fixedByCrossRepo++;
  }

  await writeFile(GAMES_JSON, JSON.stringify(games));
  console.log(
    `\nFixed: ${fixed}  (exact=${fixedByLayer.exact}, compact=${fixedByLayer.compact}, prefix=${fixedByLayer.prefix}; via-fallback=${fixedByFallback})`,
  );
  console.log(`Missed: ${missed}`);
  if (misses.length) {
    console.log(`\nStill unresolved (sample):`);
    for (const m of misses.slice(0, 40)) console.log(`  - ${m}`);
    if (misses.length > 40) console.log(`  ... and ${misses.length - 40} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
