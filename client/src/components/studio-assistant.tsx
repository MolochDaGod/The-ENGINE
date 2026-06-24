import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

/**
 * Studio Assistant — the studio-aware AI for grudge-studio.puter.site.
 *
 * Talks to the Legion AI hub via POST /api/legion/studio, which runs the
 * `studio` task: the system prompt is augmented server-side with the canonical
 * Grudge Studio context (fleet, deployments, data layer, connection matrix) and
 * the recent GitHub history digest. So this widget can answer questions about
 * the studio as a whole, the game fleet, infrastructure, and what changed
 * recently — not just Grudge Warlords game mechanics.
 */

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  source?: string;
  model?: string;
  pending?: boolean;
}

interface LegionResult {
  text: string;
  model: string;
  source: string;
  tokensUsed: number;
  latencyMs: number;
}

const SUGGESTIONS = [
  "What games are in the Grudge Studio fleet?",
  "How does a new app connect to the backend?",
  "Where is each service deployed?",
  "What changed recently across the repos?",
];

const GREETING: AssistantMessage = {
  role: "assistant",
  content:
    "Ahoy! I'm the Grudge Studio Assistant. I know the whole operation — the fleet of games, the deployment topology, the data layer, how every app wires into the backend, and the latest GitHub history. Ask me anything about the studio.",
};

export default function StudioAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async (question: string) => {
    const prompt = question.trim();
    if (!prompt || busy) return;

    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt },
      { role: "assistant", content: "", pending: true },
    ]);

    try {
      const resp = await apiRequest("POST", "/api/legion/studio", { prompt });
      const data: LegionResult = await resp.json();
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: data.text || "(no response)",
          source: data.source,
          model: data.model,
        };
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content:
            "The Studio Assistant is unavailable right now. Please try again in a moment.",
          source: "error",
        };
        return next;
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fantasy-panel flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 py-2 border-b border-[hsl(43,60%,30%)]/15 flex items-center gap-2 shrink-0">
        <Sparkles className="w-4 h-4 text-[hsl(43,85%,55%)]" />
        <h2
          className="text-sm font-heading text-[hsl(43,85%,65%)]"
          style={{ WebkitTextFillColor: "unset" }}
        >
          Studio Assistant
        </h2>
        <span className="text-xs text-[hsl(45,15%,45%)] font-body hidden sm:inline">
          fleet · deployments · data layer · GitHub history
        </span>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={`m-${i}`}
                className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
              >
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    background: isUser ? "hsl(225,25%,20%)" : "hsl(43,60%,22%)",
                    color: isUser ? "hsl(45,30%,80%)" : "hsl(43,85%,60%)",
                  }}
                >
                  {isUser ? (
                    <span className="text-xs font-bold">You</span>
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div className={`min-w-0 flex-1 ${isUser ? "text-right" : ""}`}>
                  <div
                    className={`inline-block max-w-full text-left rounded-lg px-3 py-2 ${
                      isUser
                        ? "bg-[hsl(225,25%,15%)] text-[hsl(45,30%,88%)]"
                        : "bg-[hsl(225,25%,12%)] border border-[hsl(43,60%,30%)]/20 text-[hsl(45,30%,82%)]"
                    }`}
                  >
                    {msg.pending ? (
                      <span className="text-[hsl(45,15%,50%)] font-body text-sm italic">
                        Consulting the studio ledgers…
                      </span>
                    ) : (
                      <p className="text-sm font-body whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}
                  </div>
                  {!isUser && !msg.pending && msg.source && (
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[hsl(43,60%,30%)]/30 text-[hsl(45,15%,50%)]"
                      >
                        {msg.source}
                        {msg.model ? ` · ${msg.model}` : ""}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-full border border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,70%)] hover:bg-[hsl(43,85%,55%)]/10 hover:text-[hsl(43,85%,60%)] transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-[hsl(43,60%,30%)]/15 shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
            placeholder="Ask about the studio, fleet, deployments, or recent changes..."
            className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/20 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,30%)] focus:border-[hsl(43,85%,55%)]/40"
            maxLength={1000}
            disabled={busy}
          />
          <Button
            onClick={() => ask(input)}
            disabled={!input.trim() || busy}
            className="gilded-button px-4"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
