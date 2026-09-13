/**
 * Super-engine live stack — the hosts we actually play, not demo cards.
 * Probe from the browser (HEAD/GET, no credentials) so apex CSP still works.
 */
export type StackLane = "editor" | "play" | "physics" | "node" | "data";

export interface StackHost {
  id: string;
  name: string;
  lane: StackLane;
  url: string;
  /** Probe URL if different from launch */
  probe?: string;
  launch?: string;
}

export const SUPER_ENGINE_STACK: StackHost[] = [
  {
    id: "threeflow",
    name: "ThreeFlow",
    lane: "editor",
    url: "https://threeflow.vercel.app/editor",
    probe: "https://threeflow.vercel.app/",
    launch: "https://threeflow.vercel.app/editor",
  },
  {
    id: "forge",
    name: "Forge",
    lane: "editor",
    url: "https://forge.grudge-studio.com/",
    probe: "https://forge.grudge-studio.com/",
    launch: "https://forge.grudge-studio.com/",
  },
  {
    id: "casting",
    name: "Casting lab",
    lane: "play",
    url: "https://casting.grudge.studio/",
    probe: "https://casting-abilities-threejs.vercel.app/",
    launch: "https://casting.grudge.studio/",
  },
  {
    id: "open",
    name: "Open",
    lane: "play",
    url: "https://open.grudge-studio.com/",
    probe: "https://open.grudge-studio.com/",
    launch: "https://open.grudge-studio.com/",
  },
  {
    id: "mineloader",
    name: "Mine-Loader",
    lane: "play",
    url: "https://mineloader.grudge-studio.com/#/play",
    probe: "https://mineloader.grudge-studio.com/",
    launch: "https://mineloader.grudge-studio.com/#/play",
  },
  {
    id: "cdn-toon",
    name: "Rapier / Toon CDN",
    lane: "physics",
    url: "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/human.glb",
    probe:
      "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/human.glb",
  },
  {
    id: "node-player",
    name: "Node player API",
    lane: "node",
    url: "https://grudge-api-production-0d46.up.railway.app/api/health",
    probe: "https://grudge-api-production-0d46.up.railway.app/api/health",
  },
  {
    id: "node-engine",
    name: "The-ENGINE Node",
    lane: "node",
    url: "https://the-engine.up.railway.app/api/health",
    probe: "https://the-engine.up.railway.app/api/health",
  },
  {
    id: "d1-info",
    name: "D1 / catalogs",
    lane: "data",
    url: "https://info.grudge-studio.com/api/v1/weapons.json",
    probe: "https://info.grudge-studio.com/api/v1/weapons.json",
  },
];

export type ProbeStatus = "live" | "down" | "pending";

export async function probeStackHost(host: StackHost): Promise<{
  id: string;
  status: ProbeStatus;
  ms: number;
}> {
  const start = performance.now();
  const target = host.probe || host.url;
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(target, {
      method: "HEAD",
      mode: "cors",
      signal: ctrl.signal,
    }).catch(() =>
      fetch(target, { method: "GET", mode: "no-cors", signal: ctrl.signal }),
    );
    window.clearTimeout(t);
    const ms = Math.round(performance.now() - start);
    const opaque = res.type === "opaque";
    const ok = opaque || (res.status >= 200 && res.status < 400);
    return { id: host.id, status: ok ? "live" : "down", ms };
  } catch {
    return { id: host.id, status: "down", ms: Math.round(performance.now() - start) };
  }
}
