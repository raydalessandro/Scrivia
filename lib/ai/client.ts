// La FACCIATA del layer AI. È il punto unico che ogni modulo del sistema chiama
// "a suo modo": passa i messaggi e (opzionale) la selezione; il layer risolve
// provider/modello/reasoning, prende la chiave dall'ambiente, sceglie l'adapter,
// e ritorna un risultato neutro. Uso lato SERVER (legge process.env).
//
// Non ancora collegato alle fasi: è apparecchiato. Quando si collega, il client
// invia la selezione scelta in UI; qui si esegue.

import type {
  CompletionRequest, CompletionResult, StreamEvent, ProviderAdapter, ResolvedRequest, ResolvedSelection, ProviderId,
} from "./types";
import { PROVIDER_BY_ID, clampReasoning } from "./registry";
import { DEFAULT_SELECTION } from "./config";
import { anthropicAdapter } from "./providers/anthropic";
import { deepseekAdapter } from "./providers/deepseek";

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  deepseek: deepseekAdapter,
};

function resolveSelection(req: CompletionRequest): ResolvedSelection {
  if (req.provider && req.model) {
    return { provider: req.provider, model: req.model, reasoning: clampReasoning(req.provider, req.model, req.reasoning ?? "medium") };
  }
  const base = DEFAULT_SELECTION[req.task ?? "general"];
  return {
    provider: req.provider ?? base.provider,
    model: req.model ?? base.model,
    reasoning: clampReasoning(req.provider ?? base.provider, req.model ?? base.model, req.reasoning ?? base.reasoning),
  };
}

function keyFor(provider: ProviderId): string {
  const env = PROVIDER_BY_ID[provider].apiKeyEnv;
  const key = process.env[env];
  if (!key) throw new AIKeyMissingError(provider, env);
  return key;
}

function resolve(req: CompletionRequest): { adapter: ProviderAdapter; resolved: ResolvedRequest } {
  const sel = resolveSelection(req);
  const adapter = ADAPTERS[sel.provider];
  return { adapter, resolved: { ...req, ...sel, apiKey: keyFor(sel.provider) } };
}

/** Una risposta completa (non streaming). */
export function aiComplete(req: CompletionRequest): Promise<CompletionResult> {
  const { adapter, resolved } = resolve(req);
  return adapter.complete(resolved);
}

/** Streaming neutro: text / reasoning / tool_call / done / error. */
export function aiStream(req: CompletionRequest): AsyncIterable<StreamEvent> {
  const { adapter, resolved } = resolve(req);
  return adapter.stream(resolved);
}

/** Quali provider hanno la chiave configurata (per diagnostica/UI lato server). */
export function configuredProviders(): { provider: ProviderId; ready: boolean; env: string }[] {
  return (Object.keys(ADAPTERS) as ProviderId[]).map((p) => {
    const env = PROVIDER_BY_ID[p].apiKeyEnv;
    return { provider: p, ready: !!process.env[env], env };
  });
}

export class AIKeyMissingError extends Error {
  constructor(public provider: ProviderId, public env: string) {
    super(`Manca la chiave per ${provider}: imposta ${env} nelle env.`);
    this.name = "AIKeyMissingError";
  }
}
