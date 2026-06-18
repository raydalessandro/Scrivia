"use client";

import { ACTOR_META } from "@/lib/enums";
import type { Actor } from "@/lib/types";
import { useEffect, useState } from "react";

/** Pallino-attore: il colore dice chi lavora. */
export function ActorDot({ actor, pulse }: { actor: Actor; pulse?: boolean }) {
  const m = ACTOR_META[actor];
  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 rounded-full ${pulse ? "ai-pulse" : ""}`}
      style={{ background: m.color }}
      title={m.label}
    />
  );
}

export function ActorChip({ actor }: { actor: Actor }) {
  const m = ACTOR_META[actor];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ background: m.bg, color: m.color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  const tones = {
    neutral: "bg-paper-2 text-ink-soft border-line",
    ok: "bg-manus-bg text-manus border-manus/30",
    warn: "bg-gate-bg text-gate border-gate/30",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Cronometro live: mostra quanto sta lavorando l'IA, in chiaro. */
export function Stopwatch({ running, finalMs }: { running: boolean; finalMs?: number }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => setMs(Date.now() - t0), 100);
    return () => clearInterval(id);
  }, [running]);
  const shown = running ? ms : finalMs ?? 0;
  return <span className="tabular-nums">{fmtMs(shown)}</span>;
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
