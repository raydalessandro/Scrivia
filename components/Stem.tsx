"use client";

// Lo "stelo": la spina del processo, ereditata dalla GUIDA mobile e resa
// navigazione viva. Mostra sempre dove sei, chi lavora a ogni tappa, e i due
// cancelli umani. È il "mostrare il processo chiaramente".

import type { Stage } from "@/lib/types";
import { ACTOR_META } from "@/lib/enums";

const STATE_NODE: Record<Stage["state"], string> = {
  done: "✓",
  running: "•",
  ready: "",
  gate: "✋",
  locked: "",
};

export function Stem({
  stages,
  activeId,
  onSelect,
}: {
  stages: Stage[];
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <ol className="relative ml-3">
      <span className="absolute left-[13px] top-2 bottom-2 w-0.5 rounded bg-line-2" />
      {stages.map((s) => {
        const m = ACTOR_META[s.actor];
        const active = s.id === activeId;
        const reachable = s.state !== "locked";
        return (
          <li key={s.id} className="relative mb-1.5 pl-9">
            <span
              className="absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full border-2 text-[13px] font-semibold transition"
              style={{
                background: s.state === "running" ? m.bg : "var(--color-paper)",
                borderColor: s.state === "locked" ? "var(--color-line-2)" : m.color,
                color: m.color,
              }}
            >
              {s.state === "running" ? (
                <span className="ai-pulse h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
              ) : (
                STATE_NODE[s.state]
              )}
            </span>
            <button
              disabled={!reachable || !onSelect}
              onClick={() => onSelect?.(s.id)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                active ? "bg-paper-2 shadow-sm ring-1 ring-line" : reachable ? "hover:bg-paper-2/70" : "opacity-45"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={s.state === "done" ? "text-ink" : "text-ink"}>{s.label}</span>
                {s.gate && (
                  <span className="rounded px-1 text-[10px] font-bold uppercase tracking-wider text-gate">
                    cancello
                  </span>
                )}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: m.color }}
              >
                {m.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
