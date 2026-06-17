// seedFromGame.ts — mappa l'output del seeding "gioco" (GameState) sul Seed di Scrivia.
//
// Il gioco produce un GameState; qui diventa il Seed che lo studio/`build_node` consuma.
// Mapping chiave: spine.threshold→threshold_moment, spine.resolution→resolution_mode,
// move→overrides.attribute_dominant (EAR, invisibile), arc→time_span_arc, entry/closure/register
// come override, gli assi voce con remap `lente`→`lente_sensoriale`. In più l'ESPANSIONE voci:
// le voci-personaggio (archetipo/stress/ritmo/parole/never) viaggiano nel Seed e alimentano il
// brief della prosa; la ricetta del narratore (modalità "per riferimenti") va in narratorBrief.

import type { Seed, VoiceOverrides, CharacterVoice } from "./types";
import type { SeedExt } from "./engineTypes";
import type { GameState, CharSlot } from "@/components/phases/SeedingGame";

const MOVE_ATTR: Record<string, string> = {
  accorgersi: "distinguere",
  avvicinarsi: "connettere",
  attraversare: "cambiare",
};

// assi del gioco → assi del canone (il gioco usa `lente`, il canone `lente_sensoriale`)
const AXIS_MAP: Record<string, keyof VoiceOverrides> = {
  temperamento: "temperamento",
  ritmo: "ritmo",
  distanza: "distanza",
  lente: "lente_sensoriale",
  lente_sensoriale: "lente_sensoriale",
  umorismo: "umorismo",
};

function remapAxes(v: Record<string, string> | undefined): VoiceOverrides {
  const out: VoiceOverrides = {};
  for (const [k, val] of Object.entries(v || {})) {
    const key = AXIS_MAP[k];
    if (key && val) out[key] = val;
  }
  return out;
}

function registerFor(age: number): string {
  return age <= 5 ? "basso" : age <= 8 ? "medio" : "alto";
}

function toCharacterVoice(c: CharSlot): CharacterVoice {
  const cv: CharacterVoice = { name: c.name.trim(), role: c.role };
  if (c.dom) cv.archetype = c.dom;
  if (c.stress) cv.underStress = c.stress;
  if (c.ritmo) cv.ritmo = c.ritmo;
  if (c.words.trim()) cv.words = c.words.trim();
  if (c.never.trim()) cv.never = c.never.trim();
  return cv;
}

// Ricetta narratore: in modalità "ref" autori/faccette + segno; in "ear" sintesi degli assi.
function narratorBrief(g: GameState): string {
  if (g.voiceMode === "ref") {
    const parts = Object.keys(g.refs).flatMap((a) => (g.refs[a] || []).map((f) => `${a}/${f}`));
    if (g.refUnique.trim()) parts.push("segno: " + g.refUnique.trim());
    return parts.join(" · ");
  }
  const axes = remapAxes(g.voice);
  const got = (Object.keys(axes) as (keyof VoiceOverrides)[]).map((k) => axes[k]).filter(Boolean) as string[];
  return got.map((x) => x.replace(/_/g, " ")).join(" · ");
}

export function seedFromGame(g: GameState): Seed {
  const overrides: NonNullable<SeedExt["overrides"]> = {};
  if (g.move && MOVE_ATTR[g.move]) overrides.attribute_dominant = MOVE_ATTR[g.move];
  if (g.entry) overrides.entry_point_type = g.entry;
  if (g.closure_type != null) overrides.closure_type = g.closure_type;
  if (g.arc) overrides.time_span_arc = g.arc;
  overrides.register = registerFor(g.age);

  const cast = g.cast || [];
  const companions = cast
    .filter((c) => c.role !== "protagonista" && c.name.trim())
    .map((c) => ({ name: c.name.trim(), kind: "" })); // l'aspetto/specie si definisce nel Passo 0
  const characterVoices = cast.filter((c) => c.name.trim()).map(toCharacterVoice);

  const seed: SeedExt = {
    language: "it",
    title: "",
    protagonist: { name: g.name.trim() || "[protagonista]", age: g.age, kind: g.kind.trim() },
    companions,
    world_flavor: g.world,
    setting: { primary: g.setting.trim() || "[luogo]", notes: g.brain.trim() }, // lo "scarico" → note
    theme: g.themeFree.trim() || g.theme,
    pugno: g.pugno.trim(),
    personal_detail: g.detail.trim(),
    length_pages: 12,
    packs: [],
    spine: {
      premise: g.spine.premise.trim(),
      problem: g.spine.problem.trim(),
      threshold_moment: g.spine.threshold.trim(),
      resolution_mode: g.spine.resolution.trim(),
      closure: g.spine.closure.trim(),
    },
    voice: remapAxes(g.voice),
    nonce: null,
    // --- estensioni additive ---
    overrides,
    has_sage_figure: g.hasSage,
    characterVoices,
    narratorBrief: narratorBrief(g),
  };
  return seed;
}
