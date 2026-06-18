"use client";

// Chip che mostra quale IA lavora in questa fase (provider/modello/reasoning)
// e porta alle impostazioni. Legge la stessa config delle fasi reali.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AITask, ResolvedSelection } from "@/lib/ai/types";
import type { PhaseId } from "@/lib/types";
import { getSelection } from "@/lib/ai/config";
import { selectionLabel } from "./ModelPicker";

// Mappa fase visibile → task del layer AI.
const PHASE_TASK: Partial<Record<PhaseId, AITask>> = {
  seeding: "seeding",
  prosa: "prosa",
  immagini: "image_prompt",
};

export function PhaseModelChip({ phase, compact }: { phase: PhaseId; compact?: boolean }) {
  const task = PHASE_TASK[phase];
  const [sel, setSel] = useState<ResolvedSelection | null>(null);

  useEffect(() => {
    if (task) setSel(getSelection(task));
  }, [task]);

  if (!task) return null;

  // versione compatta per la barra in alto: solo il chip, è esso stesso il link.
  if (compact) {
    return (
      <Link
        href="/impostazioni"
        title="Cambia il modello IA di questa fase"
        className="inline-flex items-center gap-1.5 rounded-full bg-claude-bg px-2.5 py-1.5 text-[11px] font-medium text-claude transition hover:brightness-95"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-claude" />
        {sel ? selectionLabel(sel) : "…"}
      </Link>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-claude-bg px-2.5 py-1 text-claude">
        <span className="h-2 w-2 rounded-full bg-claude" />
        IA: {sel ? selectionLabel(sel) : "…"}
      </span>
      <Link href="/impostazioni" className="underline hover:text-ink">cambia</Link>
    </div>
  );
}
