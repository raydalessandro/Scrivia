"use client";

// Selettore provider + modello + reasoning per un singolo task.
// Sta tutto sul layer: registry (opzioni) + config (selezione persistita).
// Cambi al click; il reasoning si riallinea al modello (clampReasoning).

import { useEffect, useState } from "react";
import type { AITask, ProviderId, ReasoningLevel, ResolvedSelection } from "@/lib/ai/types";
import { PROVIDERS, PROVIDER_BY_ID, getModel } from "@/lib/ai/registry";
import { getSelection, setSelection, withModel, withReasoning } from "@/lib/ai/config";

const REASONING_LABEL: Record<ReasoningLevel, string> = {
  off: "nessuno", low: "basso", medium: "medio", high: "alto",
};

export function ModelPicker({ task, onChange }: { task: AITask; onChange?: (s: ResolvedSelection) => void }) {
  const [sel, setSel] = useState<ResolvedSelection | null>(null);

  useEffect(() => setSel(getSelection(task)), [task]);
  if (!sel) return <div className="shimmer h-9 w-full rounded-lg" />;

  function commit(next: ResolvedSelection) {
    setSel(next);
    setSelection(task, next);
    onChange?.(next);
  }

  const provider = PROVIDER_BY_ID[sel.provider];
  const model = getModel(sel.provider, sel.model);
  const reasoningOptions = model?.reasoning ?? ["off"];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Provider</span>
          <select
            value={sel.provider}
            onChange={(e) => {
              const p = e.target.value as ProviderId;
              const firstModel = PROVIDER_BY_ID[p].models[0].id;
              commit(withModel(sel, p, firstModel));
            }}
            className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-sm outline-none focus:border-claude"
          >
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Modello</span>
          <select
            value={sel.model}
            onChange={(e) => commit(withModel(sel, sel.provider, e.target.value))}
            className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-sm outline-none focus:border-claude"
          >
            {provider.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Reasoning</span>
          <select
            value={sel.reasoning}
            onChange={(e) => commit(withReasoning(sel, e.target.value as ReasoningLevel))}
            disabled={reasoningOptions.length <= 1}
            className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-sm outline-none focus:border-claude disabled:opacity-60"
          >
            {reasoningOptions.map((r) => <option key={r} value={r}>{REASONING_LABEL[r]}</option>)}
          </select>
        </label>
      </div>
      {model?.note && <p className="text-xs text-ink-soft">{model.note}</p>}
    </div>
  );
}

/** Etichetta compatta della selezione corrente, per i chip nel workspace. */
export function selectionLabel(sel: ResolvedSelection): string {
  const m = getModel(sel.provider, sel.model);
  const r = sel.reasoning === "off" ? "" : ` · ${REASONING_LABEL[sel.reasoning]}`;
  return `${m?.label ?? sel.model}${r}`;
}
