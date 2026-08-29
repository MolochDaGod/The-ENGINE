import { useEffect, useState } from "react";
import {
  SUPER_ENGINE_STACK,
  probeStackHost,
  type ProbeStatus,
  type StackHost,
} from "@/lib/stackDeployments";

const LANE: Record<string, string> = {
  editor: "EDITOR",
  play: "PLAY",
  physics: "RAPIER / CDN",
  node: "NODE",
  data: "D1",
};

function Dot({ status }: { status: ProbeStatus }) {
  const cls =
    status === "live"
      ? "bg-[hsl(120,60%,48%)]"
      : status === "down"
        ? "bg-red-500"
        : "bg-[hsl(43,85%,55%)] animate-pulse";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

export function SuperEngineStack() {
  const [rows, setRows] = useState<
    Record<string, { status: ProbeStatus; ms: number }>
  >({});

  useEffect(() => {
    let cancelled = false;
    SUPER_ENGINE_STACK.forEach((h) => {
      probeStackHost(h).then((r) => {
        if (cancelled) return;
        setRows((prev) => ({ ...prev, [r.id]: { status: r.status, ms: r.ms } }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = SUPER_ENGINE_STACK.reduce<Record<string, StackHost[]>>((acc, h) => {
    (acc[h.lane] ||= []).push(h);
    return acc;
  }, {});

  return (
    <div className="shrink-0 border-b border-[hsl(43,60%,30%)]/25 bg-black/40 px-3 py-2">
      <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(43,85%,55%)]">
        Live stack · ThreeFlow · Rapier · Node · D1
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(grouped).map(([lane, hosts]) => (
          <div key={lane} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[8px] text-[hsl(45,15%,42%)]">{LANE[lane] || lane}</span>
            {hosts.map((h) => {
              const st = rows[h.id] ?? { status: "pending" as const, ms: 0 };
              const href = h.launch || h.url;
              return (
                <a
                  key={h.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-[hsl(45,20%,78%)] hover:text-[hsl(43,85%,65%)]"
                  title={`${h.name} ${st.status}${st.ms ? ` ${st.ms}ms` : ""}`}
                >
                  <Dot status={st.status} />
                  {h.name}
                  {st.ms > 0 ? (
                    <span className="text-[hsl(45,15%,42%)]">{st.ms}ms</span>
                  ) : null}
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
