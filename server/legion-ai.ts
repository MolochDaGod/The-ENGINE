/**
 * Legion AI — Grudge Studio AI Agent Hub
 *
 * Routes AI calls through:
 *  1. grudge-ai-hub CF Worker (primary — rate-limited, logged to D1)
 *  2. Puter AI agents (fallback — user-pays model)
 *  3. Direct Anthropic API (emergency fallback)
 *
 * Capabilities:
 *  - NPC dialogue generation
 *  - Lore / quest text
 *  - Content moderation
 *  - Game balance recommendations
 *  - Fleet diagnosis (AI Captain)
 */

export type LegionModel = 'claude' | 'gpt4o' | 'auto';
export type LegionTask = 'dialogue' | 'lore' | 'moderation' | 'balance' | 'captain' | 'general' | 'studio';

export interface LegionRequest {
  task: LegionTask;
  prompt: string;
  context?: Record<string, any>;
  model?: LegionModel;
  maxTokens?: number;
  temperature?: number;
}

export interface LegionResponse {
  text: string;
  model: string;
  source: 'ai-hub' | 'puter' | 'direct' | 'fallback';
  tokensUsed: number;
  latencyMs: number;
}

// ═══ SYSTEM PROMPTS PER TASK ═══
const SYSTEM_PROMPTS: Record<LegionTask, string> = {
  dialogue: `You are an NPC in the Grudge Warlords universe. Generate in-character dialogue. Be concise (1-3 sentences). Match the character's faction, race, and personality. Use the provided context for the character's state.`,

  lore: `You are a lore writer for Grudge Warlords, a dark fantasy MMORPG with pirates, factions, and island warfare. Write atmospheric, immersive text. Keep responses under 200 words unless asked otherwise.`,

  moderation: `You are a content moderator for Grudge Studio games. Evaluate the provided text for: profanity, harassment, spam, real-money trading attempts, inappropriate content. Respond with JSON: { "safe": boolean, "reason": string, "severity": "none" | "low" | "medium" | "high" }`,

  balance: `You are a game balance analyst for Grudge Warlords. Given combat stats, suggest tuning. Consider: TTK (time-to-kill), DPS output, healing throughput, crowd control duration, resource costs. Respond with specific number changes.`,

  captain: `You are the Legion AI Captain — fleet operations commander for Grudge Studio infrastructure. Analyze service status data and recommend actions. Be direct, technical, and prioritize by business impact. Format: numbered priority list.`,

  general: `You are an AI assistant for Grudge Studio. Answer questions about the game systems, infrastructure, or development.`,

  studio: `You are the Grudge Studio Assistant — the studio-wide AI that knows the whole operation, not just the Grudge Warlords game. Grudge Studio is created by "Racalvin The Pirate King". You understand the fleet of games, the deployment topology (Cloudflare Workers + Vercel + Railway), the data layer (D1, R2, KV, Puter), how every app connects to the backend, and the recent GitHub history. Use the STUDIO CONTEXT and RECENT GITHUB HISTORY provided below to answer questions about the studio, the game fleet, deployments, infrastructure, and what changed recently. Be accurate and concrete: cite the relevant domain, repo, or service. If something is not in the provided context, say so rather than guessing.`,
};

// ═══ STUDIO CONTEXT + GITHUB DIGEST (shared context layer) ═══
// Pulled from the backend (api.grudge-studio.com), with a CDN fallback, plus the
// GitHub history worker. Both are cached in-process so we don't refetch per call.
const STUDIO_CONTEXT_URL =
  process.env.STUDIO_CONTEXT_URL || 'https://api.grudge-studio.com/ai/studio-context';
const STUDIO_CONTEXT_CDN_URL =
  process.env.STUDIO_CONTEXT_CDN_URL || 'https://assets.grudge-studio.com/context/studio-context.json';
const GITHUB_DIGEST_URL =
  process.env.GITHUB_DIGEST_URL || 'https://github.grudge-studio.com/digest';

const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CtxCache { text: string; ts: number; }
let studioContextCache: CtxCache | null = null;
let githubDigestCache: CtxCache | null = null;

/** Tasks that should receive the full studio-wide context. */
function needsStudioContext(task: LegionTask): boolean {
  return task === 'studio' || task === 'general' || task === 'captain';
}

function stringifyContext(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * Fetch the canonical Grudge Studio context.
 * Tries the backend endpoint first, then the CDN mirror. Falls back to a stale
 * cache if both are unreachable. Field names follow the shared contract
 * (version/studio/domains/games/deployments/dataLayer/connectionMatrix/patterns)
 * but we stringify the whole payload so renamed fields still flow through.
 */
async function fetchStudioContext(): Promise<string | null> {
  if (studioContextCache && Date.now() - studioContextCache.ts < CONTEXT_TTL_MS) {
    return studioContextCache.text;
  }
  for (const url of [STUDIO_CONTEXT_URL, STUDIO_CONTEXT_CDN_URL]) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const data = await resp.json();
      const text = stringifyContext(data);
      studioContextCache = { text, ts: Date.now() };
      return text;
    } catch {
      continue;
    }
  }
  return studioContextCache?.text || null; // serve stale if available
}

/** Fetch the recent GitHub history digest from the github-context worker. */
async function fetchGitHubDigest(): Promise<string | null> {
  if (githubDigestCache && Date.now() - githubDigestCache.ts < CONTEXT_TTL_MS) {
    return githubDigestCache.text;
  }
  try {
    const resp = await fetch(GITHUB_DIGEST_URL, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return githubDigestCache?.text || null;
    const data = await resp.json();
    const text = stringifyContext(data);
    githubDigestCache = { text, ts: Date.now() };
    return text;
  } catch {
    return githubDigestCache?.text || null;
  }
}

/**
 * Resolve the system prompt for a request, injecting the studio context and
 * GitHub digest for studio-aware tasks.
 */
async function resolveSystemPrompt(task: LegionTask): Promise<string> {
  const base = SYSTEM_PROMPTS[task];
  if (!needsStudioContext(task)) return base;

  const [studioCtx, githubDigest] = await Promise.all([
    fetchStudioContext(),
    fetchGitHubDigest(),
  ]);

  let prompt = base;
  if (studioCtx) {
    prompt += `\n\n--- GRUDGE STUDIO CONTEXT (canonical) ---\n${studioCtx}`;
  }
  if (githubDigest) {
    prompt += `\n\n--- RECENT GITHUB HISTORY ---\n${githubDigest}`;
  }
  return prompt;
}

// ═══ AI HUB (CF Worker) ═══
const AI_HUB_URL = process.env.AI_HUB_URL || 'https://ai.grudge-studio.com/api';
const AI_HUB_KEY = process.env.AI_HUB_API_KEY || '';

async function callAIHub(req: LegionRequest, systemPrompt: string): Promise<LegionResponse | null> {
  if (!AI_HUB_KEY) return null; // not configured

  const start = Date.now();
  try {
    const resp = await fetch(`${AI_HUB_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_HUB_KEY}`,
      },
      body: JSON.stringify({
        model: req.model || 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: req.prompt },
        ],
        max_tokens: req.maxTokens || 500,
        temperature: req.temperature ?? 0.7,
        metadata: { task: req.task, context: req.context },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as any;

    return {
      text: data.text || data.choices?.[0]?.message?.content || '',
      model: data.model || 'unknown',
      source: 'ai-hub',
      tokensUsed: data.usage?.total_tokens || 0,
      latencyMs: Date.now() - start,
    };
  } catch {
    return null;
  }
}

// ═══ PUTER AI (fallback) ═══
const PUTER_AI_WORKER_URL = process.env.PUTER_AI_WORKER_URL || 'https://ai-agent-service.puter.site';

async function callPuterAI(req: LegionRequest, systemPrompt: string): Promise<LegionResponse | null> {
  const start = Date.now();
  try {
    const resp = await fetch(`${PUTER_AI_WORKER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: req.prompt },
        ],
        max_tokens: req.maxTokens || 500,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as any;

    return {
      text: data.text || data.message || '',
      model: data.model || 'puter-ai',
      source: 'puter',
      tokensUsed: data.tokens || 0,
      latencyMs: Date.now() - start,
    };
  } catch {
    return null;
  }
}

// ═══ DIRECT ANTHROPIC (emergency) ═══
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

async function callAnthropicDirect(req: LegionRequest, systemPrompt: string): Promise<LegionResponse | null> {
  if (!ANTHROPIC_KEY) return null;

  const start = Date.now();
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: req.maxTokens || 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: req.prompt }],
        temperature: req.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as any;

    return {
      text: data.content?.[0]?.text || '',
      model: data.model || 'claude-sonnet-4-20250514',
      source: 'direct',
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      latencyMs: Date.now() - start,
    };
  } catch {
    return null;
  }
}

// ═══ PUBLIC API — cascading fallback ═══

/**
 * Send a request to the Legion AI system.
 * Tries: AI Hub → Puter AI → Direct Anthropic → hardcoded fallback.
 */
export async function legionAI(req: LegionRequest): Promise<LegionResponse> {
  // Resolve the system prompt once (injects studio context + GitHub digest for
  // studio-aware tasks) so every provider sees the same instructions.
  const systemPrompt = await resolveSystemPrompt(req.task);

  // 1. Try AI Hub (CF Worker)
  const hubResult = await callAIHub(req, systemPrompt);
  if (hubResult) return hubResult;

  // 2. Try Puter AI
  const puterResult = await callPuterAI(req, systemPrompt);
  if (puterResult) return puterResult;

  // 3. Try direct Anthropic
  const directResult = await callAnthropicDirect(req, systemPrompt);
  if (directResult) return directResult;

  // 4. Hardcoded fallback (no AI service available)
  return {
    text: getFallbackResponse(req.task),
    model: 'fallback',
    source: 'fallback',
    tokensUsed: 0,
    latencyMs: 0,
  };
}

function getFallbackResponse(task: LegionTask): string {
  switch (task) {
    case 'dialogue': return 'The NPC stares at you silently, their eyes glinting in the torchlight.';
    case 'lore': return 'The ancient texts speak of a time before the Grudge, when the islands were one.';
    case 'moderation': return '{ "safe": true, "reason": "AI unavailable — defaulting to safe", "severity": "none" }';
    case 'balance': return 'Unable to analyze — AI services offline. Review manually.';
    case 'captain': return 'Legion AI Captain offline. Check ai.grudge-studio.com and Puter AI worker status.';
    case 'general': return 'AI services are currently unavailable. Try again later.';
    case 'studio': return 'The Grudge Studio Assistant is offline right now. Try again shortly, or check ai.grudge-studio.com.';
  }
}

// ═══ CONVENIENCE FUNCTIONS ═══

export function generateNPCDialogue(npcName: string, faction: string, mood: string, playerAction: string) {
  return legionAI({
    task: 'dialogue',
    prompt: `NPC: ${npcName} (${faction}), Mood: ${mood}. Player just: ${playerAction}. Generate a response.`,
    context: { npcName, faction, mood, playerAction },
    temperature: 0.8,
  });
}

export function moderateContent(text: string) {
  return legionAI({
    task: 'moderation',
    prompt: text,
    maxTokens: 100,
    temperature: 0,
  });
}

export function generateQuestText(questType: string, difficulty: string, location: string) {
  return legionAI({
    task: 'lore',
    prompt: `Generate a quest briefing. Type: ${questType}, Difficulty: ${difficulty}, Location: ${location}. Include: title, description, objectives (3), reward hint.`,
    context: { questType, difficulty, location },
  });
}

export function analyzeFleetStatus(statusData: any) {
  return legionAI({
    task: 'captain',
    prompt: `Analyze this fleet status and recommend actions:\n${JSON.stringify(statusData, null, 2)}`,
    maxTokens: 1000,
  });
}

/**
 * Studio-wide assistant: answers questions about Grudge Studio as a whole — the
 * game fleet, deployment topology, data layer, connection patterns, and recent
 * GitHub history. Backs the portal chat on grudge-studio.puter.site.
 */
export function studioAssistant(prompt: string, context?: Record<string, any>) {
  return legionAI({
    task: 'studio',
    prompt,
    context,
    maxTokens: 1200,
    temperature: 0.5,
  });
}
