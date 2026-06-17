// Config per-fase: ogni task sceglie provider + modello + reasoning in modo
// indipendente. Defaults sensati ora; la UI li sovrascriverà "al click" (e li
// persisterà). Lato server, senza override, valgono i defaults.

import type { AITask, ResolvedSelection, ProviderId, ReasoningLevel } from "./types";
import { clampReasoning } from "./registry";

export const DEFAULT_SELECTION: Record<AITask, ResolvedSelection> = {
  // creativo / di giudizio → il più capace
  prosa: { provider: "anthropic", model: "claude-opus-4-8", reasoning: "high" },
  critic: { provider: "anthropic", model: "claude-opus-4-8", reasoning: "high" },
  // conversazione lunga ma economica
  seeding: { provider: "anthropic", model: "claude-sonnet-4-6", reasoning: "medium" },
  // brevi / meccanici
  title: { provider: "anthropic", model: "claude-haiku-4-5", reasoning: "off" },
  image_prompt: { provider: "anthropic", model: "claude-sonnet-4-6", reasoning: "low" },
  general: { provider: "anthropic", model: "claude-opus-4-8", reasoning: "medium" },
};

const KEY = "scrivia.ai.selection.v1";

type Overrides = Partial<Record<AITask, ResolvedSelection>>;

function readOverrides(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

/** La selezione effettiva per un task (override utente sopra ai defaults). */
export function getSelection(task: AITask): ResolvedSelection {
  const sel = { ...DEFAULT_SELECTION[task], ...readOverrides()[task] };
  return { ...sel, reasoning: clampReasoning(sel.provider, sel.model, sel.reasoning) };
}

/** Imposta la selezione di un task "al click" (persistita lato client). */
export function setSelection(task: AITask, sel: ResolvedSelection) {
  if (typeof window === "undefined") return;
  const all = readOverrides();
  all[task] = { ...sel, reasoning: clampReasoning(sel.provider, sel.model, sel.reasoning) };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function resetSelection(task?: AITask) {
  if (typeof window === "undefined") return;
  if (!task) return localStorage.removeItem(KEY);
  const all = readOverrides();
  delete all[task];
  localStorage.setItem(KEY, JSON.stringify(all));
}

/** Cambia solo il provider/modello o solo il reasoning, mantenendo il resto. */
export function withModel(sel: ResolvedSelection, provider: ProviderId, model: string): ResolvedSelection {
  return { provider, model, reasoning: clampReasoning(provider, model, sel.reasoning) };
}
export function withReasoning(sel: ResolvedSelection, reasoning: ReasoningLevel): ResolvedSelection {
  return { ...sel, reasoning: clampReasoning(sel.provider, sel.model, reasoning) };
}
