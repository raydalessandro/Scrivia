// Catalogo provider → modelli → reasoning. Dati puri (nessun segreto): sicuro
// anche lato client, così la UI può popolare i selettori di provider/modello/
// reasoning. La verità sulle capacità sta qui; gli adapter la leggono.

import type { ProviderSpec, ProviderId, ModelSpec, ReasoningLevel } from "./types";

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    docsUrl: "https://platform.claude.com/docs",
    models: [
      {
        id: "claude-opus-4-8", label: "Claude Opus 4.8",
        contextTokens: 1_000_000, maxOutputTokens: 128_000,
        reasoning: ["off", "low", "medium", "high"],
        caps: { effort: true, canDisableThinking: true, tools: true },
        note: "Il più capace Opus — qualità per prosa/critic.",
      },
      {
        id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6",
        contextTokens: 1_000_000, maxOutputTokens: 64_000,
        reasoning: ["off", "low", "medium", "high"],
        caps: { effort: true, canDisableThinking: true, tools: true },
        note: "Equilibrio velocità/intelligenza — buono per il seeding.",
      },
      {
        id: "claude-haiku-4-5", label: "Claude Haiku 4.5",
        contextTokens: 200_000, maxOutputTokens: 64_000,
        reasoning: ["off"], // l'effort non è supportato su Haiku
        caps: { effort: false, canDisableThinking: true, tools: true },
        note: "Rapido ed economico per compiti semplici (titoli, etichette).",
      },
      {
        id: "claude-fable-5", label: "Claude Fable 5",
        contextTokens: 1_000_000, maxOutputTokens: 128_000,
        reasoning: ["low", "medium", "high"], // thinking sempre on: niente "off"
        caps: { effort: true, thinkingAlwaysOn: true, tools: true },
        note: "Massima capacità; thinking sempre attivo, costo più alto.",
      },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    docsUrl: "https://api-docs.deepseek.com",
    models: [
      {
        id: "deepseek-chat", label: "DeepSeek V3 (chat)",
        contextTokens: 64_000, maxOutputTokens: 8_000,
        reasoning: ["off"],
        caps: { tools: true },
        note: "Veloce, non-reasoning. Per il reasoning passa a deepseek-reasoner.",
      },
      {
        id: "deepseek-reasoner", label: "DeepSeek R1 (reasoner)",
        contextTokens: 64_000, maxOutputTokens: 8_000,
        reasoning: ["high"], // il reasoning è il modello stesso (CoT, reasoning_content)
        caps: { tools: true },
        note: "Modello di ragionamento; restituisce anche la catena di pensiero.",
      },
    ],
  },
];

export const PROVIDER_BY_ID: Record<ProviderId, ProviderSpec> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p])
) as Record<ProviderId, ProviderSpec>;

export function getModel(provider: ProviderId, modelId: string): ModelSpec | undefined {
  return PROVIDER_BY_ID[provider]?.models.find((m) => m.id === modelId);
}

/** Riallinea un livello di reasoning a ciò che il modello supporta davvero. */
export function clampReasoning(provider: ProviderId, modelId: string, level: ReasoningLevel): ReasoningLevel {
  const m = getModel(provider, modelId);
  if (!m) return level;
  if (m.reasoning.includes(level)) return level;
  // scegli il più vicino disponibile
  const order: ReasoningLevel[] = ["off", "low", "medium", "high"];
  const want = order.indexOf(level);
  let best = m.reasoning[0];
  let bestDist = Infinity;
  for (const r of m.reasoning) {
    const d = Math.abs(order.indexOf(r) - want);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best;
}
