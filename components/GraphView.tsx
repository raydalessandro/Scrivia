"use client";

// Visualizzazione del grafo: la spina narrativa su una linea di pagine, con i
// beat EAR, la soglia, e i semi (piantati → pagati) che arcano sopra le pagine.
// "La verità è nel grafo", resa leggibile.

import type { StoryNode } from "@/lib/types";

const BEAT_COLOR: Record<string, string> = {
  apertura: "#b9b2a4",
  distinguere: "#c98a3f",
  connettere: "#3a8a80",
  cambiare: "#7a5e93",
  chiusura: "#a64a3f",
};

export function GraphView({ node }: { node: StoryNode }) {
  const N = node.pages;
  const W = 100; // percent-based
  const x = (p: number) => ((p - 0.5) / N) * W;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="font-semibold">{node.pugno}</span>
      </div>

      <div className="relative h-28 w-full">
        {/* archi dei semi */}
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-12 w-full overflow-visible">
          {node.seeds.map((s, i) => {
            const x1 = x(s.planted_page);
            const x2 = x(s.payoff_page);
            const mid = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} 28 Q ${mid} ${4 + i * 6} ${x2} 28`}
                fill="none"
                stroke={i === 0 ? "#b07d2e" : "#3a8a80"}
                strokeWidth="0.6"
                strokeDasharray="1.5 1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* barra dei beat */}
        <div className="absolute inset-x-0 top-12 flex h-6 overflow-hidden rounded-md">
          {node.beat_plan.map((b, i) => {
            const w = ((b.pages[1] - b.pages[0] + 1) / N) * 100;
            return (
              <div
                key={i}
                className="flex items-center justify-center text-[10px] font-semibold text-white/95"
                style={{ width: `${w}%`, background: BEAT_COLOR[b.beat] ?? "#999" }}
                title={`${b.beat} · pp. ${b.pages[0]}–${b.pages[1]}`}
              >
                {w > 12 ? b.beat : ""}
              </div>
            );
          })}
        </div>

        {/* tacche pagine + soglia */}
        <div className="absolute inset-x-0 top-[4.7rem] h-6">
          {Array.from({ length: N }, (_, i) => i + 1).map((p) => (
            <div key={p} className="absolute -translate-x-1/2 text-center" style={{ left: `${x(p)}%` }}>
              <div className={`mx-auto h-2 w-px ${p === node.threshold_page ? "bg-gate" : "bg-line-2"}`} />
              <div className={`text-[9px] ${p === node.threshold_page ? "font-bold text-gate" : "text-ink-soft"}`}>{p}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
        {node.seeds.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: i === 0 ? "#b07d2e" : "#3a8a80" }} />
            seme: {s.what} <span className="opacity-70">(p{s.planted_page}→p{s.payoff_page})</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gate" /> soglia p{node.threshold_page}
        </span>
      </div>
    </div>
  );
}
