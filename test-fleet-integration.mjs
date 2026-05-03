#!/usr/bin/env node
/**
 * Integration test for Grudge Studio fleet services
 * Tests: fleet-health pings, Legion AI cascade, GrudaChain status
 * Runs standalone — no Express server or database needed.
 */

const CDN_BASE = 'https://assets.grudge-studio.com/toon-shooter';

// ═══ TEST 1: Fleet Health — Direct service pings ═══
console.log('\n═══ TEST 1: FLEET HEALTH — Service Pings ═══\n');

const SERVICES = [
  { id: 'cf-studio', name: 'grudge-studio.com', url: 'https://grudge-studio.com/' },
  { id: 'cf-asset-cdn', name: 'Asset CDN (R2)', url: `${CDN_BASE}/manifest.json` },
  { id: 'vc-warlords', name: 'Grudge Warlords', url: 'https://grudgewarlords.com/' },
  { id: 'vc-dungeon', name: 'Dungeon Crawler', url: 'https://dungeon-crawler-quest.vercel.app/' },
  { id: 'puter', name: 'Puter Platform', url: 'https://puter.com/' },
  { id: 'ext-solana', name: 'Solana RPC', url: 'https://api.devnet.solana.com/' },
  { id: 'ext-discord', name: 'Discord API', url: 'https://discord.com/api/v10/gateway' },
  { id: 'cf-auth', name: 'Auth Gateway', url: 'https://auth.grudge-studio.com/health' },
  { id: 'cf-ai-hub', name: 'AI Hub', url: 'https://ai.grudge-studio.com/api/health' },
  { id: 'cf-objectstore', name: 'Object Store', url: 'https://objects.grudge-studio.com/health' },
  { id: 'vps-coolify', name: 'VPS Coolify', url: 'http://74.208.155.229:8000/' },
  { id: 'svc-grudge-id', name: 'grudge-id', url: 'http://74.208.155.229:3001/health' },
  { id: 'svc-game-api', name: 'game-api', url: 'http://74.208.155.229:3003/health' },
  { id: 'colyseus', name: 'Colyseus', url: 'http://74.208.174.62:2568/api' },
];

let live = 0, warn = 0, down = 0;

for (const svc of SERVICES) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(svc.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    }).catch(() =>
      fetch(svc.url, { method: 'GET', signal: controller.signal, redirect: 'follow' })
    );
    clearTimeout(timeout);
    const ms = Date.now() - start;

    if (resp.status >= 500) {
      console.log(`  ✗ ${svc.name.padEnd(20)} DOWN  (${resp.status}) ${ms}ms`);
      down++;
    } else if (resp.status >= 400 || ms > 3000) {
      console.log(`  ⚠ ${svc.name.padEnd(20)} WARN  (${resp.status}) ${ms}ms`);
      warn++;
    } else {
      console.log(`  ✓ ${svc.name.padEnd(20)} LIVE  (${resp.status}) ${ms}ms`);
      live++;
    }
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`  ✗ ${svc.name.padEnd(20)} DOWN  (${err.name === 'AbortError' ? 'TIMEOUT' : err.code || err.message}) ${ms}ms`);
    down++;
  }
}

console.log(`\n  Summary: ${live} live, ${warn} warn, ${down} down (${SERVICES.length} total)`);

// ═══ TEST 2: R2 CDN — Toon Shooter Assets ═══
console.log('\n═══ TEST 2: R2 CDN — Toon Shooter Assets ═══\n');

const ASSET_TESTS = [
  'manifest.json',
  'characters/Character_Soldier.glb',
  'characters/Character_Enemy.glb',
  'characters/Character_Hazmat.glb',
  'guns/AK.glb',
  'guns/Sniper.glb',
  'guns/Knife_1.glb',
  'guns/RocketLauncher.glb',
  'guns/Shovel.glb',
  'environment/Crate.glb',
  'environment/ExplodingBarrel.glb',
  'environment/Structure_1.glb',
  'environment/Health.glb',
  'environment/BearTrap_Open.glb',
  'environment/Tree_1.glb',
  'textures/Fence.png',
];

let assetOk = 0, assetFail = 0;
for (const path of ASSET_TESTS) {
  try {
    const resp = await fetch(`${CDN_BASE}/${path}`, { method: 'HEAD' });
    if (resp.ok) {
      assetOk++;
      console.log(`  ✓ ${path}`);
    } else {
      assetFail++;
      console.log(`  ✗ ${path} (${resp.status})`);
    }
  } catch (err) {
    assetFail++;
    console.log(`  ✗ ${path} (${err.message})`);
  }
}
console.log(`\n  Assets: ${assetOk}/${ASSET_TESTS.length} verified on CDN`);

// ═══ TEST 3: Legion AI — Cascade test ═══
console.log('\n═══ TEST 3: LEGION AI — Cascade Test ═══\n');

// Test AI Hub (may not be configured without API key)
const AI_HUB_URL = 'https://ai.grudge-studio.com/api/health';
try {
  const resp = await fetch(AI_HUB_URL, { signal: AbortSignal.timeout(5000) });
  console.log(`  AI Hub reachable: ${resp.ok ? '✓' : '✗'} (${resp.status})`);
} catch (err) {
  console.log(`  AI Hub reachable: ✗ (${err.message})`);
}

// Test Puter AI Worker
const PUTER_AI_URL = 'https://ai-agent-service.puter.site/';
try {
  const resp = await fetch(PUTER_AI_URL, { signal: AbortSignal.timeout(5000) });
  console.log(`  Puter AI Worker: ${resp.ok ? '✓' : '✗'} (${resp.status})`);
} catch (err) {
  console.log(`  Puter AI Worker: ✗ (${err.message})`);
}

// Test Anthropic API reachability (just a HEAD to see if the API gateway responds)
try {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: '{}', // Will get 401 but proves reachability
    signal: AbortSignal.timeout(5000),
  });
  console.log(`  Anthropic API: ${resp.status === 401 ? '✓ reachable (needs key)' : resp.status}`);
} catch (err) {
  console.log(`  Anthropic API: ✗ (${err.message})`);
}

// ═══ TEST 4: GrudaChain — Component checks ═══
console.log('\n═══ TEST 4: GRUDACHAIN — Component Checks ═══\n');

// Grench Worker
const GRENCH_URL = 'https://the-grench-worker.puter.site/';
try {
  const resp = await fetch(GRENCH_URL, { signal: AbortSignal.timeout(8000) });
  console.log(`  Grench Worker: ${resp.ok ? '✓' : '⚠'} (${resp.status})`);
} catch (err) {
  console.log(`  Grench Worker: ✗ (${err.message})`);
}

// Puter KV (just check platform is reachable — actual KV needs deployer token)
try {
  const resp = await fetch('https://puter.com/', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
  console.log(`  Puter Platform: ${resp.ok ? '✓' : '✗'} (${resp.status})`);
} catch (err) {
  console.log(`  Puter Platform: ✗ (${err.message})`);
}

// Solana RPC
try {
  const resp = await fetch('https://api.devnet.solana.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await resp.json();
  console.log(`  Solana Devnet: ${data.result === 'ok' ? '✓ healthy' : '⚠ ' + JSON.stringify(data.result)}`);
} catch (err) {
  console.log(`  Solana Devnet: ✗ (${err.message})`);
}

// ═══ TEST 5: DNS + Route Verification ═══
console.log('\n═══ TEST 5: DNS + ROUTE VERIFICATION ═══\n');

const ROUTES = [
  { name: 'grudge-studio.com', url: 'https://grudge-studio.com/' },
  { name: 'grudge-studio.com/avernus-3d', url: 'https://grudge-studio.com/avernus-3d' },
  { name: 'grudgewarlords.com', url: 'https://grudgewarlords.com/' },
  { name: 'grudgeplatform.io', url: 'https://grudgeplatform.io/' },
  { name: 'assets.grudge-studio.com', url: 'https://assets.grudge-studio.com/toon-shooter/manifest.json' },
  { name: 'grudgestudio.puter.site', url: 'https://grudgestudio.puter.site/' },
];

for (const route of ROUTES) {
  try {
    const resp = await fetch(route.url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    console.log(`  ${resp.ok ? '✓' : '✗'} ${route.name.padEnd(35)} ${resp.status}`);
  } catch (err) {
    console.log(`  ✗ ${route.name.padEnd(35)} ${err.message}`);
  }
}

// ═══ SUMMARY ═══
console.log('\n═══ INTEGRATION TEST COMPLETE ═══\n');
console.log(`  Fleet Services: ${live}/${SERVICES.length} live`);
console.log(`  R2 CDN Assets:  ${assetOk}/${ASSET_TESTS.length} verified`);
console.log(`  Routes verified: ${ROUTES.length}`);
console.log(`  AI + GrudaChain: cascade components checked`);
console.log('');
