"use client";

// Il registro append-only (generations.jsonl reso visibile): la cronologia di
// chi ha lavorato, quando, e per quanto. Surfacing dei tempi richiesto.

import type { LedgerEvent } from "@/lib/types";
import { ActorDot, fmtMs, fmtTime } from "./ui";

export function Ledger({ events }: { events: LedgerEvent[] }) {
  if (!events.length)
    return <p className="text-sm text-ink-soft">Ancora niente. Pianta il seme per cominciare.</p>;
  return (
    <ul className="space-y-1.5">
      {[...events].reverse().map((e, i) => (
        <li key={i} className="flex items-center gap-2.5 text-sm">
          <ActorDot actor={e.actor} />
          <span className="text-ink">{e.event}</span>
          {e.detail && <span className="truncate text-ink-soft">· {e.detail}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-ink-soft">
            {e.durationMs != null && (
              <span className="tabular-nums" style={{ color: e.actor === "claude" ? "var(--color-claude)" : undefined }}>
                {fmtMs(e.durationMs)}
              </span>
            )}
            <span className="tabular-nums opacity-70">{fmtTime(e.ts)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
