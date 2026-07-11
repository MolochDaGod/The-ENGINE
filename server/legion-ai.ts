/**
 * Legion AI — Grudge Studio AI Agent Hub
 *
 * Routes AI calls through:
 *  1. Groq (GROQ_API_KEY) — fast, preferred for Treaty @ale
 *  2. grudge-ai-hub CF Worker (rate-limited, logged to D1)
 *  3. Puter AI agents (user-pays model)
 *  4. Direct Anthropic API (emergency)
 *  5. Hardcoded fallback
 *
 * Capabilities:
 *  - Treaty @ale companion
 *  - NPC dialogue generation
 *  - Lore / quest text
 *  - Content moderation
 *  - Game balance recommendations
 *  - Fleet diagnosis (AI Captain)
 */

export type LegionModel = 'claude' | 'gpt4o' | 'auto' | 'groq';
export type LegionTask = 'dialogue' | 'lore' | 'moderation' | 'balance' | 'captain' | 'general' | 'ale';

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
  source: 'groq' | 'ai-hub' | 'puter' | 'direct' | 'fallback';
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

  ale: `You are Ale — the always-on AI companion in Treaty Chat for Grudge Studio (grudge-studio.com).

Personality: sharp, friendly, slightly irreverent, never corporate. You know the fleet:
- Treaty = social layer (channels, friends, DMs, per-game rooms game:slug). Mention @ale to talk to you.
- Grudge ID = single sign-on across games (id.grudge-studio.com).
- Play hub = play.grudge.studio; portal = grudge-studio.com; Forge = forge.grudge-studio.com.
- Games: Avernus, Mage Arena, Wargus/RTS, TerraForge, Grudge Brawl, Warlords, and more.
- Currency: GBUX. Assets CDN: assets.grudge-studio.com.

Rules:
- Reply in 1–4 short sentences unless the player asks for steps/lists.
- You are in a live multiplayer chat — no markdown walls, no code dumps unless asked.
- If unsure, say so and point them to /chat, /account, or /games.
- Never invent private user data. Don't claim you can spend GBUX or change accounts.
- You may be playful but stay helpful. Sign off vibe: crewmate, not support ticket.`,
};

// ═══ GROQ (OpenAI-compatible, fast) ═══
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  // solid default — override with GROQ_MODEL if needed
  'llama-3.3-70b-versatile';
const GROQ_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(req: LegionRequest): Promise<LegionResponse | null> {
  if (!GROQ_API_KEY) return null;

  const start = Date.now();
  try {
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[req.task] },
          { role: 'user', content: req.prompt },
        ],
        max_tokens: Math.min(req.maxTokens || 500, 1024),
        temperature: req.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn('[legion-ai] Groq HTTP', resp.status, errText.slice(0, 200));
      return null;
    }
    const data = (await resp.json()) as any;
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) return null;

    return {
      text,
      model: data.model || GROQ_MODEL,
      source: 'groq',
      tokensUsed: data.usage?.total_tokens || 0,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    console.warn('[legion-ai] Groq failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ═══ AI HUB (CF Worker) ═══
const AI_HUB_URL = process.env.AI_HUB_URL || 'https://ai.grudge-studio.com/api';
const AI_HUB_KEY = process.env.AI_HUB_API_KEY || '';

async function callAIHub(req: LegionRequest): Promise<LegionResponse | null> {
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
          { role: 'system', content: SYSTEM_PROMPTS[req.task] },
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

async function callPuterAI(req: LegionRequest): Promise<LegionResponse | null> {
  const start = Date.now();
  try {
    const resp = await fetch(`${PUTER_AI_WORKER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[req.task] },
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

async function callAnthropicDirect(req: LegionRequest): Promise<LegionResponse | null> {
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
        system: SYSTEM_PROMPTS[req.task],
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
 * Tries: Groq → AI Hub → Puter → Anthropic → hardcoded fallback.
 */
export async function legionAI(req: LegionRequest): Promise<LegionResponse> {
  // 1. Groq first (fast + configured for Treaty @ale)
  const groqResult = await callGroq(req);
  if (groqResult?.text) return groqResult;

  // 2. AI Hub (CF Worker)
  const hubResult = await callAIHub(req);
  if (hubResult?.text) return hubResult;

  // 3. Puter AI
  const puterResult = await callPuterAI(req);
  if (puterResult?.text) return puterResult;

  // 4. Direct Anthropic
  const directResult = await callAnthropicDirect(req);
  if (directResult?.text) return directResult;

  // 5. Hardcoded fallback (no AI service available)
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
    case 'ale':
      return "Hey — Ale here. My deep brain is offline for a sec, but I'm still on Treaty. Try again in a moment, or open https://grudge-studio.com/chat.";
  }
}

/** Treaty @ale assistant */
export function askAle(prompt: string, context?: Record<string, unknown>) {
  return legionAI({
    task: 'ale',
    prompt,
    maxTokens: 400,
    temperature: 0.75,
    context,
  });
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
