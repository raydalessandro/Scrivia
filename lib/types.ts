// Dominio di Scrivia — rispecchia gli artefatti del seme ("la verità è nel grafo").
// Ogni storia è una cartella di artefatti versionabili; qui li tipizziamo.

export type Actor = "you" | "claude" | "manus" | "det";

/** Le 7 tappe del loop sottile: seed → nodo → hook → brief → prosa → audit → libro. */
export type StageId =
  | "seed"
  | "node"
  | "hook"
  | "brief"
  | "manus"
  | "prosa"
  | "audit"
  | "book";

export type StageState = "locked" | "ready" | "running" | "done" | "gate";

export interface Stage {
  id: StageId;
  label: string;
  /** Chi lavora in questa tappa. */
  actor: Actor;
  /** Un cancello umano voluto (prosa, immagini)? */
  gate?: boolean;
  state: StageState;
}

/** Le 4 fasi visibili all'utente (raggruppano le tappe). */
export type PhaseId = "seeding" | "prosa" | "immagini" | "libro";

// --- Seed (story_seed.yaml) ----------------------------------------------
export interface VoiceOverrides {
  temperamento?: string;
  ritmo?: string;
  distanza?: string;
  lente_sensoriale?: string;
  umorismo?: string;
}

export interface Seed {
  language: string;
  title: string;
  protagonist: { name: string; age: number | null; kind: string };
  companions: { name: string; kind: string }[];
  world_flavor: string;
  setting: { primary: string; notes: string };
  theme: string;
  pugno: string;
  personal_detail: string;
  length_pages: number;
  packs: string[];
  spine: {
    premise: string;
    problem: string;
    threshold_moment: string;
    resolution_mode: string;
    closure: string;
  };
  voice: VoiceOverrides;
  nonce: number | null;
}

// --- Nodo (node.json) — il grafo -----------------------------------------
export interface BeatPlan {
  beat: string;
  pages: [number, number];
}
export interface SeedEcho {
  id: string;
  kind: string;
  what: string;
  planted_page: number;
  payoff_page: number;
}
export interface StoryNode {
  id: string;
  title: string;
  attribute_dominant: string;
  deployment_level: string;
  ear_arc: string[];
  premise: string;
  problem: string;
  threshold_moment: string;
  threshold_page: number;
  resolution_mode: string;
  entry_point_type: string; // A-F
  closure_type: number; // 1-7
  register: string;
  register_range: [number, number];
  time_span_arc: string;
  pages: number;
  estimated_words: number;
  world_flavor: string;
  setting_primary: string;
  season: string;
  palette_emotiva: string;
  protagonist: { name: string; age: number; kind: string };
  companions: { name: string; kind: string }[];
  beat_plan: BeatPlan[];
  seeds: SeedEcho[];
  pugno: string;
  personal_detail: string;
  seed_nonce: number;
}

// --- Hook / piano pagine (writing_brief) ---------------------------------
export interface PagePlan {
  page: number;
  beat: string;
  hook: string;
  zone: string;
  note: string;
}

// --- Prosa (story.md) -----------------------------------------------------
export interface ProsePage {
  page: number;
  beat: string;
  text: string;
}

// --- Critic (critic_verdict.json) ----------------------------------------
export interface CriticCheck {
  key: string;
  label: string;
  pass: boolean;
  note: string;
}
export interface CriticVerdict {
  verdict: "PASS" | "FAIL" | null;
  checks: CriticCheck[];
  page_flags: { page: number; severity: string; issue: string }[];
}

// --- Manus prompts --------------------------------------------------------
export interface ManusPrompt {
  page: number;
  hook: string;
  beat: string;
  storyMoment: string;
  pov: string;
  place: string;
  characters: string;
  imageUrl?: string; // futuro: Supabase Storage
}

// --- Ledger (generations.jsonl) ------------------------------------------
export interface LedgerEvent {
  ts: string;
  actor: Actor;
  event: string;
  detail?: string;
  durationMs?: number;
}

// --- Memoria della Fase 1: chat + comandi (può durare settimane) ----------
export interface ChatMsg {
  id: string;
  who: "claude" | "you";
  text: string;
  ts: string;
  /** Entità in focus quando il messaggio è stato scritto (l'IA "sa" di cosa parli). */
  focus?: FocusRef;
  /** Comandi che questo turno ha eseguito (rende l'IA un agente, non un compilatore). */
  commands?: string[];
}

/** Riferimento a un'entità selezionabile: l'umano la tocca, diventa il contesto dell'IA. */
export interface FocusRef {
  kind: "protagonist" | "companion" | "spine" | "voice" | "node" | "page";
  /** chiave/identificatore dentro la storia (es. nome del companion, campo della spina). */
  ref: string;
  label: string;
}

/** Esecuzione di un comando del registry (la traccia che alimenterà l'audit MCP). */
export interface CommandRun {
  ts: string;
  name: string;
  params?: Record<string, unknown>;
  by: "you" | "claude";
  summary: string;
  cached?: boolean;
  durationMs?: number;
}

// --- La storia: tutti gli artefatti insieme ------------------------------
export interface Story {
  id: string;
  createdAt: string;
  updatedAt?: string;
  title: string;
  stage: StageId;
  seed: Seed;
  node?: StoryNode;
  pagePlan?: PagePlan[];
  brief?: string;
  prose?: ProsePage[];
  critic?: CriticVerdict;
  manus?: ManusPrompt[];
  ledger: LedgerEvent[];
  /** Fase 1 persistente: la conversazione di seeding e i comandi eseguiti. */
  seedingChat?: ChatMsg[];
  commandLog?: CommandRun[];
}
