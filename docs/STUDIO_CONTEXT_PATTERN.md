# Grudge Studio Context Pattern

The copy-paste recipe every Grudge app follows to become **studio-aware** — able to
answer questions about the studio as a whole, the game fleet, deployment topology,
the data layer, and recent GitHub history, not just one game's mechanics.

The-ENGINE (`grudge-studio.puter.site`) is the reference implementation. See
`server/legion-ai.ts` (context injection) and `client/src/components/studio-assistant.tsx`
(the chat widget).

## The shared context layer

There is **one canonical Grudge Studio context** that all agents, chatbots, workers, and
tools consume. It is published in two equivalent forms plus a live history feed:

| Source | URL | Notes |
|---|---|---|
| Backend JSON | `https://api.grudge-studio.com/ai/studio-context` (also `/api/ai/studio-context`) | Source of truth (`STUDIO_CONTEXT`) |
| CDN mirror | `https://assets.grudge-studio.com/context/studio-context.json` | Cacheable fallback (`+ studio-context.v<semver>.json`) |
| Studio assistant | `POST https://ai.grudge-studio.com/ai/chat` | Studio context injected **server-side** |
| ALE assistant | `POST https://ai.grudge-studio.com/ai/assistant` | Simplified `{message,history}` -> `{success,response,source}` |
| GitHub history | `https://github.grudge-studio.com/digest` (`/repo/:name`, `/repos`) | Recent commits / PRs / releases, KV-cached |

### `STUDIO_CONTEXT` shape (v1.0.0)

```ts
interface StudioContext {
  version: string;            // e.g. "1.0.0"
  updatedAt: string;
  studio: { name: string; creator: string; tagline: string; description: string; org: string };
  domains: { domain: string; role: string; notes?: string }[];
  games: { id: string; name: string; domain: string; type: string; status: string; summary: string; repo?: string }[];
  deployments: { topology: string; frontends: string; backend: string; edge: string; workers: string[]; launcher: string };
  dataLayer: { d1: string; r2: string; puter: string; postgres: string };
  connectionMatrix: { surface: string; url: string; consumes: string[]; provides: string[] }[];
  patterns: { connect: string; contextEndpoint: string; cdnMirror: string; assistantEndpoint: string; githubDigest: string };
}
```

> **Treat all arrays as possibly empty and guard for missing/extra fields.** The
> `version` may bump but the field shape is stable. A robust integration should never
> crash on a shape change — prefer stringify-and-inject over hard-coding field reads
> (see the resilience note below).

## Pattern A — call the hosted studio assistant (simplest)

Best for any frontend that just wants a studio-aware chatbot. The context is injected
server-side, so you only send the user's message.

```ts
async function askStudio(message: string, history: { role: string; content: string }[] = []) {
  try {
    const resp = await fetch("https://ai.grudge-studio.com/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) throw new Error(`AI ${resp.status}`);
    const data = await resp.json(); // { content, provider, model, usage }
    return data.content as string;
  } catch {
    return "The Studio Assistant is unavailable right now. Please try again shortly.";
  }
}
```

Guest-safe and Grudge-branded: no auth is required for the assistant, so it works on
public pages like `/login`.

## Pattern B — fetch the context yourself, inject into your own prompt

Best for apps with their own AI pipeline (a CF Worker, the Legion hub, a server route)
that want the studio context in a system prompt they already control. Always fetch the
backend first and fall back to the CDN mirror, and cache the result.

```ts
const CONTEXT_TTL_MS = 5 * 60 * 1000;
let cache: { text: string; ts: number } | null = null;

function stringifyContext(data: unknown): string {
  if (typeof data === "string") return data;
  try { return JSON.stringify(data, null, 2); } catch { return String(data); }
}

export async function getStudioContext(): Promise<string | null> {
  if (cache && Date.now() - cache.ts < CONTEXT_TTL_MS) return cache.text;
  const sources = [
    "https://api.grudge-studio.com/ai/studio-context",
    "https://assets.grudge-studio.com/context/studio-context.json",
  ];
  for (const url of sources) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const text = stringifyContext(await resp.json());
      cache = { text, ts: Date.now() };
      return text;
    } catch { /* try next source */ }
  }
  return cache?.text ?? null; // serve stale cache if both are down
}

// Optional: enrich with recent GitHub history.
export async function getGitHubDigest(): Promise<string | null> {
  try {
    const resp = await fetch("https://github.grudge-studio.com/digest", { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    return stringifyContext(await resp.json());
  } catch { return null; }
}

// Build the system prompt for a studio-aware chat:
export async function buildStudioSystemPrompt(base: string): Promise<string> {
  const [ctx, digest] = await Promise.all([getStudioContext(), getGitHubDigest()]);
  let prompt = base;
  if (ctx) prompt += `\n\n--- GRUDGE STUDIO CONTEXT (canonical) ---\n${ctx}`;
  if (digest) prompt += `\n\n--- RECENT GITHUB HISTORY ---\n${digest}`;
  return prompt;
}
```

## Resilience requirements (non-negotiable)

Every external call in this pattern must:

1. Use a **timeout** (`AbortSignal.timeout(...)`).
2. Be wrapped in **try/catch**.
3. Have a **graceful fallback** — cached value, CDN mirror, static default, or a clear
   "unavailable" message. Never hard-fail the UI.
4. Be **shape-agnostic** — stringify the whole payload (or read fields defensively) so a
   renamed/added field never throws. The contract is stable, but version may bump.

This mirrors the cascading-fallback design in The-ENGINE's `server/legion-ai.ts`
(AI Hub → Puter → Anthropic → static fallback) and the ALE edge worker.

## How a new app adopts this

1. **Branding:** Grudge-branded entry point (logo, gold accent). The assistant is
   guest-safe — no login required.
2. **Pick a pattern:** use Pattern A for a drop-in chatbot, or Pattern B if you own the
   prompt.
3. **Register the app:** add it to `STUDIO_CONTEXT.games` (backend `server/lib/studio-context.ts`),
   `GrudgeBuilder/client/src/lib/grudgeConfig.ts` (`GRUDGE_DOMAINS`), and
   `client/src/data/systemMap.ts` so the studio knows about you.
4. **Wire the fleet basics** per the `grudge-fleet` pattern: auth → `id.grudge-studio.com`,
   API → `api.grudge-studio.com`, assets → `assets.grudge-studio.com`, AI → `ai.grudge-studio.com`.

## Reference implementation (The-ENGINE)

- `server/legion-ai.ts` — adds the `studio` task, injects studio context + GitHub digest
  for `studio` / `general` / `captain` tasks, exposes `studioAssistant()`.
- `server/routes.ts` — `POST /api/legion/studio`.
- `client/src/components/studio-assistant.tsx` — the studio assistant chat widget.
- `client/src/pages/chat.tsx` — portal chat with a Tavern ↔ Studio AI mode toggle.
