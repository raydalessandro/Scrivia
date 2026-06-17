// engineTypes.ts — Tipi del motore (ADDITIVI rispetto a lib/types.ts).
// Estendono Seed/StoryNode/PagePlan con campi opzionali letti dal motore, senza
// modificare i tipi di Scrivia: la UI continua a usare Seed/StoryNode/PagePlan;
// il motore (e la FASE 0) usano le forme estese. Niente rotture.

import type { Seed, StoryNode, PagePlan } from "./types";

// Override di grammatica (dal seeding game, opzionali): se assenti, il motore campiona.
export interface SeedOverrides {
  attribute_dominant?: string;
  deployment_level?: string;
  entry_point_type?: string;
  closure_type?: number;
  register?: string;
  time_span_arc?: string;
}

// Seed esteso: campi opzionali che il motore legge (entityId per la FASE 0, override, ecc.).
export type SeedExt = Omit<Seed, "protagonist" | "companions" | "setting"> & {
  protagonist: Seed["protagonist"] & { entityId?: string };
  companions: (Seed["companions"][number] & { entityId?: string })[];
  setting: Seed["setting"] & { entityId?: string };
  season?: string;
  has_sage_figure?: boolean;
  overrides?: SeedOverrides;
  seed_contents?: string[];
  recurring_motif?: string;
  debt_content?: string;
};

export interface Debt { kind: string; what: string; opened_page: number; closed_page: number; }
export interface RecurringImage { motif: string; pages: number[]; }

export interface VoiceCard { value: string; fai?: string; evita?: string; lessico?: string; }
export interface VoiceKV { value: string; hint: string; }
export interface NodeVoice {
  narrator: { active_axes: string[]; cards: Record<string, VoiceCard> };
  characters: Record<string, { tic_verbale: VoiceKV; tempo: VoiceKV; rivolgersi: VoiceKV }>;
  places: Record<string, { senso_dominante: VoiceKV; qualita_luce: VoiceKV; dettaglio: { kind: string; what: string } }>;
}

// Nodo esteso: i campi che il motore aggiunge (voce, debito, immagine ricorrente, id luogo).
export type StoryNodeExt = StoryNode & {
  protagonist: StoryNode["protagonist"] & { entityId?: string };
  companions: (StoryNode["companions"][number] & { entityId?: string })[];
  setting_entity_id?: string | null;
  debt?: Debt | null;
  recurring_image?: RecurringImage | null;
  voice?: NodeVoice;
};

export interface CharRef { name: string; entityId: string; }
export interface HookMarkers {
  is_entry: boolean;
  is_closure: boolean;
  is_threshold: boolean;
  seeds_planted: string[];
  seeds_payoff: string[];
  entry_point_type?: string;
  closure_type?: number;
}

// Hook = PagePlan ARRICCHITO (retro-compatibile: hook/zone/note restano presenti).
export interface Hook extends PagePlan {
  hook_id: string;
  type: string;
  characters_present: CharRef[];
  focal_action: string;
  atmosphere: string;
  palette: string;
  location: string;
  location_entity_id: string;
  composition_zone: string;
  markers: HookMarkers;
}
