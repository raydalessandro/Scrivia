// Layer AI universale — tipi neutri rispetto al provider.
//
// Modulo ISOLATO: ogni parte del sistema (seeding, prosa, critic…) lo chiama a
// modo suo trovando già tutto apparecchiato. Oggi: Anthropic + DeepSeek, con
// switch di modello e reasoning. Domani: scelta totale di provider/modello/
// reasoning per ogni fase, dalla UI. Aggiungere un provider = un adapter nuovo.

export type ProviderId = "anthropic" | "deepseek";

/** Livello di ragionamento, neutro. Ogni provider lo mappa al suo meccanismo. */
export type ReasoningLevel = "off" | "low" | "medium" | "high";

export interface ModelSpec {
  id: string; // id del modello presso il provider
  label: string;
  contextTokens: number;
  maxOutputTokens: number;
  /** Livelli di reasoning realmente supportati da questo modello. */
  reasoning: ReasoningLevel[];
  /** Suggerimenti di capacità per costruire la richiesta (usati dagli adapter). */
  caps?: {
    effort?: boolean; // supporta output_config.effort (Anthropic)
    thinkingAlwaysOn?: boolean; // il thinking non si può spegnere (es. Fable)
    canDisableThinking?: boolean; // accetta thinking:{type:"disabled"}
    tools?: boolean;
  };
  note?: string;
}

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  baseUrl: string;
  apiKeyEnv: string; // nome della env var con la chiave
  models: ModelSpec[];
  docsUrl?: string;
}

export type Role = "system" | "user" | "assistant";
export interface AIMessage {
  role: Role;
  content: string;
}

/** Tool neutro: stessa forma di commands.toMcpTools() → il registry si innesta qui. */
export interface AITool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Cosa ogni modulo passa al layer. La selezione è opzionale: se assente, la
 *  risolve la config per-fase. */
export interface CompletionRequest {
  system?: string;
  messages: AIMessage[];
  tools?: AITool[];
  toolChoice?: "auto" | "none" | "required";
  maxTokens?: number;
  /** Per risolvere la selezione dalla config se provider/model non sono dati. */
  task?: AITask;
  provider?: ProviderId;
  model?: string;
  reasoning?: ReasoningLevel;
  signal?: AbortSignal;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
}

export type StopReason = "end" | "tool_use" | "length" | "refusal" | "other";

export interface CompletionResult {
  text: string;
  reasoning?: string;
  toolCalls?: AIToolCall[];
  usage?: Usage;
  stop: StopReason;
  provider: ProviderId;
  model: string;
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_call"; call: AIToolCall }
  | { type: "done"; result: CompletionResult }
  | { type: "error"; error: string };

/** Selezione risolta: cosa serve davvero per chiamare. */
export interface ResolvedSelection {
  provider: ProviderId;
  model: string;
  reasoning: ReasoningLevel;
}

/** Richiesta risolta passata all'adapter (chiave inclusa). */
export interface ResolvedRequest
  extends Omit<CompletionRequest, "provider" | "model" | "reasoning">,
    ResolvedSelection {
  apiKey: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  complete(req: ResolvedRequest): Promise<CompletionResult>;
  stream(req: ResolvedRequest): AsyncIterable<StreamEvent>;
}

/** Le fasi/usi che scelgono provider+modello+reasoning in modo indipendente. */
export type AITask =
  | "seeding"
  | "prosa"
  | "critic"
  | "title"
  | "image_prompt"
  | "general";
