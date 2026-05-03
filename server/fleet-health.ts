/**
 * Fleet Health Monitor — Grudge Studio
 *
 * Pings all known services and returns unified status for the Admin Harbor.
 * Each service has an endpoint, expected response, and timeout.
 */

export type ServiceStatus = 'live' | 'warn' | 'down' | 'unknown';

export interface ServiceHealth {
  id: string;
  name: string;
  region: string;
  status: ServiceStatus;
  latencyMs: number | null;
  lastChecked: string;
  statusCode: number | null;
  error: string | null;
}

export interface FleetHealth {
  timestamp: string;
  services: ServiceHealth[];
  summary: { live: number; warn: number; down: number; unknown: number; total: number };
}

interface ServiceDef {
  id: string;
  name: string;
  region: string;
  url: string;
  timeoutMs: number;
  warnThresholdMs: number; // latency above this = 'warn'
}

// ═══ SERVICE REGISTRY — all Grudge Studio endpoints ═══
const SERVICES: ServiceDef[] = [
  // Cloudflare Workers
  { id: 'cf-grudge-studio-site', name: 'grudge-studio-site', region: 'cloudflare', url: 'https://grudge-studio.com/', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'cf-auth-gateway', name: 'grudge-auth-gateway', region: 'cloudflare', url: 'https://auth.grudge-studio.com/health', timeoutMs: 5000, warnThresholdMs: 1000 },
  { id: 'cf-identity-api', name: 'grudge-identity-api', region: 'cloudflare', url: 'https://id.grudge-studio.com/api/health', timeoutMs: 5000, warnThresholdMs: 1000 },
  { id: 'cf-ai-hub', name: 'grudge-ai-hub', region: 'cloudflare', url: 'https://ai.grudge-studio.com/api/health', timeoutMs: 5000, warnThresholdMs: 1500 },
  { id: 'cf-objectstore', name: 'grudge-objectstore-api', region: 'cloudflare', url: 'https://objects.grudge-studio.com/health', timeoutMs: 5000, warnThresholdMs: 1000 },
  { id: 'cf-asset-cdn', name: 'grudge-asset-cdn', region: 'cloudflare', url: 'https://assets.grudge-studio.com/toon-shooter/manifest.json', timeoutMs: 5000, warnThresholdMs: 500 },
  { id: 'cf-dashboard', name: 'grudge-dashboard', region: 'cloudflare', url: 'https://dash.grudge-studio.com/', timeoutMs: 5000, warnThresholdMs: 2000 },
  { id: 'cf-vercel-proxy', name: 'grudge-vercel-proxy', region: 'cloudflare', url: 'https://grudge-studio.com/avernus-3d', timeoutMs: 8000, warnThresholdMs: 3000 },

  // Linux VPS Docker services
  { id: 'vps-linux', name: 'Linux VPS (Coolify)', region: 'vps-linux', url: 'http://74.208.155.229:8000/', timeoutMs: 10000, warnThresholdMs: 3000 },
  { id: 'svc-grudge-id', name: 'grudge-id', region: 'vps-linux', url: 'http://74.208.155.229:3001/health', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'svc-game-api', name: 'game-api', region: 'vps-linux', url: 'http://74.208.155.229:3003/health', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'svc-account-api', name: 'account-api', region: 'vps-linux', url: 'http://74.208.155.229:3005/health', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'svc-launcher-api', name: 'launcher-api', region: 'vps-linux', url: 'http://74.208.155.229:3006/health', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'svc-ws', name: 'ws-service', region: 'vps-linux', url: 'http://74.208.155.229:3007/health', timeoutMs: 8000, warnThresholdMs: 2000 },

  // Windows VPS (Colyseus)
  { id: 'colyseus', name: 'Colyseus', region: 'vps-windows', url: 'http://74.208.174.62:2568/api', timeoutMs: 10000, warnThresholdMs: 3000 },

  // Vercel frontends
  { id: 'vc-grudgeplatform', name: 'GrudgePlatform', region: 'vercel', url: 'https://grudgeplatform.io/', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'vc-grudgewarlords', name: 'Grudge Warlords', region: 'vercel', url: 'https://grudgewarlords.com/', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'vc-dungeon', name: 'Dungeon Crawler', region: 'vercel', url: 'https://dungeon-crawler-quest.vercel.app/', timeoutMs: 8000, warnThresholdMs: 2000 },

  // Puter workers
  { id: 'puter-platform', name: 'Puter', region: 'puter', url: 'https://puter.com/', timeoutMs: 8000, warnThresholdMs: 2000 },
  { id: 'puter-grudgestudio', name: 'grudgestudio.puter.site', region: 'puter', url: 'https://grudgestudio.puter.site/', timeoutMs: 8000, warnThresholdMs: 3000 },

  // External
  { id: 'ext-solana', name: 'Solana RPC', region: 'external', url: 'https://api.devnet.solana.com/', timeoutMs: 5000, warnThresholdMs: 1000 },
  { id: 'ext-discord', name: 'Discord API', region: 'external', url: 'https://discord.com/api/v10/gateway', timeoutMs: 5000, warnThresholdMs: 1500 },
];

async function checkService(svc: ServiceDef): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), svc.timeoutMs);

    const resp = await fetch(svc.url, {
      method: 'HEAD', // HEAD first, fallback to GET
      signal: controller.signal,
      redirect: 'follow',
    }).catch(() =>
      fetch(svc.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      })
    );

    clearTimeout(timeout);
    const latency = Date.now() - start;

    let status: ServiceStatus = 'live';
    if (resp.status >= 500) status = 'down';
    else if (resp.status >= 400) status = 'warn';
    else if (latency > svc.warnThresholdMs) status = 'warn';

    return {
      id: svc.id, name: svc.name, region: svc.region,
      status, latencyMs: latency, lastChecked: new Date().toISOString(),
      statusCode: resp.status, error: null,
    };
  } catch (err: any) {
    const latency = Date.now() - start;
    const isTimeout = err.name === 'AbortError' || latency >= svc.timeoutMs;
    return {
      id: svc.id, name: svc.name, region: svc.region,
      status: 'down', latencyMs: isTimeout ? null : latency,
      lastChecked: new Date().toISOString(),
      statusCode: null, error: isTimeout ? 'TIMEOUT' : (err.message || 'ECONNREFUSED'),
    };
  }
}

// Cache: don't hammer all services on every request
let _cachedHealth: FleetHealth | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30 second cache

export async function getFleetHealth(forceRefresh = false): Promise<FleetHealth> {
  if (!forceRefresh && _cachedHealth && Date.now() - _cacheTime < CACHE_TTL_MS) {
    return _cachedHealth;
  }

  // Check all services in parallel (with concurrency limit)
  const results: ServiceHealth[] = [];
  const batchSize = 8;
  for (let i = 0; i < SERVICES.length; i += batchSize) {
    const batch = SERVICES.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(checkService));
    results.push(...batchResults);
  }

  const summary = { live: 0, warn: 0, down: 0, unknown: 0, total: results.length };
  for (const r of results) {
    summary[r.status]++;
  }

  _cachedHealth = { timestamp: new Date().toISOString(), services: results, summary };
  _cacheTime = Date.now();
  return _cachedHealth;
}

/** Check a single service by ID (no cache). */
export async function checkSingleService(serviceId: string): Promise<ServiceHealth | null> {
  const svc = SERVICES.find(s => s.id === serviceId);
  if (!svc) return null;
  return checkService(svc);
}

/** Get the service registry (for admin harbor to know what exists). */
export function getServiceRegistry() {
  return SERVICES.map(s => ({ id: s.id, name: s.name, region: s.region, url: s.url }));
}
