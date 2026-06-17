// pagePrompts.ts — Prompt-pagina VERI (sostituiscono i segnaposto in commands.ts).
//
// Per ogni pagina compone i campi variabili nell'ordine di Isola:
//   SUBJECT(personaggi in scena) → STORY MOMENT → POV → PLACE → SCALA
// I SUBJECT e il PLACE NON sono inventati: si leggono dal record d'entità confermato
// (Passo 0). Le immagini di reference confermate vanno in `references[]` (allegate al
// prompt); le entità non ancora confermate finiscono in `missing[]` (difesa rispetto al
// cancello del Passo 0). I blocchi FISSI (STYLESHEET, CHARACTER CONSISTENCY) si mostrano
// una volta sola (li espone bookStylesheet/CONSISTENCY_BLOCK), non per pagina.

import type { StoryNode, ManusPrompt, EntityRefRecord } from "./types";
import type { Hook } from "./engineTypes";
import { buildStylesheet, KIND_SCALE } from "./stylesheet";
import { entityIdOfCharacter, locationEntityId } from "./engine";
import { findEntity, isConfirmed } from "./reference";

const TYPE_POV: Record<string, string> = {
  panorama: "a wide establishing shot, from a distance",
  azione: "a medium shot at the characters' eye level",
  introspettivo: "a close shot on the protagonist's face and hands",
  atmosferico: "a wide atmospheric shot of the place",
  transizione: "a medium tracking shot following the movement",
  interno: "a medium shot inside the space",
  dettaglio: "a macro close-up on the key detail",
};
const ZONE_SPATIAL: Record<string, string> = {
  sky_space: "subject low in the frame, wide quiet sky/space above (text band)",
  ground_space: "subject high in the frame, open ground/space below",
  side_space: "subject to one side, quiet open space on the other",
  vignette: "small centered vignette, generous quiet margin around",
  corner_lower_left: "subject in a corner, quiet space lower-left",
  corner_lower_right: "subject in a corner, quiet space lower-right",
};
const BEAT_MOMENT: Record<string, string> = {
  apertura: "the scene opens, calm and establishing",
  distinguere: "noticing something, curious and a little wary",
  connettere: "reaching toward someone or something, tentative and warm",
  cambiare: "a decisive small action, the moment things shift",
  chiusura: "the scene settles, quiet",
};

// --- blocchi FISSI del libro (mostrati una volta) ---
export function bookStylesheet(node: StoryNode): string {
  return buildStylesheet({
    world: (node as { world_flavor?: string }).world_flavor,
    season: node.season,
    ageHint: node.protagonist?.age ?? null,
  });
}
export const CONSISTENCY_BLOCK =
  "CHARACTER CONSISTENCY — the attached reference images are BINDING, not inspiration. " +
  "Match them exactly for every named character: face/muzzle shape and proportions, fur or hair " +
  "color, eye color, build, clothing and any signature item — never swapped, never missing. All " +
  "characters stand on the same ground line. Keep every character identical to its reference across all pages.";

// mappa entityId → specie/kind (dal nodo), per la SCALA
function kindMap(node: StoryNode): Record<string, string> {
  const m: Record<string, string> = {};
  const prot = node.protagonist;
  m[entityIdOfCharacter(prot)] = (prot.kind || "").toLowerCase();
  for (const c of node.companions || []) m[entityIdOfCharacter(c)] = (c.kind || "").toLowerCase();
  return m;
}

function storyMomentOf(h: Hook): string {
  const beat = BEAT_MOMENT[h.beat] || "the scene continues";
  const present = (h.characters_present || []).map((c) => c.name);
  const who = present[0] || "[protagonist]";
  const others = present.length > 1 ? " with " + present.slice(1).join(", ") : "";
  const spatial = ZONE_SPATIAL[h.composition_zone] || "balanced composition";
  let moment = `${who}${others}: ${beat}. Composition: ${spatial}.`;
  const fa = h.focal_action || "";
  const extras = fa.split("(").slice(1).filter((s) => /introduce|ritorna|SOGLIA|motivo|apre|chiude/.test(s));
  if (extras.length) moment += " " + extras.map((s) => s.replace(")", "").trim()).join(" ");
  return moment;
}

function placeLine(entities: EntityRefRecord[] | undefined, locId: string, node: StoryNode): string {
  if (isConfirmed(entities, locId)) {
    const subj = findEntity(entities, locId)!.descriptor || node.setting_primary;
    return `${subj}. Keep this place identical across all pages.`;
  }
  return `${node.setting_primary || "the setting"}. Keep it identical across all pages.`;
}

function scalaLine(present: Hook["characters_present"], km: Record<string, string>): string | null {
  if (!present || present.length <= 1) return null;
  const protName = present[0].name;
  const parts = present.map((c, i) => {
    if (i === 0) return `${c.name} 1.0 (size anchor)`;
    const rel = KIND_SCALE[km[c.entityId] || ""] ?? 0.4;
    return `${c.name} ~${rel.toFixed(2)}x ${protName}'s height`;
  });
  return `relative heights: ${parts.join("; ")}. All characters stand on the same ground line.`;
}

// Costruisce i prompt-pagina (ManusPrompt) leggendo descrittori e immagini dal record d'entità.
// hooks = l'output di buildPagePlan/extractHooks (Hook ⊇ PagePlan): a runtime sono Hook.
export function buildPagePrompts(node: StoryNode, hooks: Hook[], entities: EntityRefRecord[]): ManusPrompt[] {
  const locId = locationEntityId(node);
  const place = placeLine(entities, locId, node);
  const km = kindMap(node);

  return hooks.map((h) => {
    const present = h.characters_present || [];
    const missing: string[] = [];
    const subjects: string[] = [];
    const refs: string[] = [];

    for (const c of present) {
      if (isConfirmed(entities, c.entityId)) {
        subjects.push(findEntity(entities, c.entityId)!.descriptor || c.name);
        const img = findEntity(entities, c.entityId)!.imageUrl;
        if (img) refs.push(img);
      } else {
        subjects.push(c.name);
        missing.push(c.entityId);
      }
    }
    if (isConfirmed(entities, locId)) {
      const img = findEntity(entities, locId)!.imageUrl;
      if (img) refs.push(img);
    } else {
      missing.push(locId);
    }

    const scala = scalaLine(present, km);
    let characters = subjects.join("; ") || node.protagonist?.name || "[protagonist]";
    if (scala) characters += `  ·  SCALA: ${scala}`;

    return {
      page: h.page,
      hook: h.hook,
      beat: h.beat,
      storyMoment: storyMomentOf(h),
      pov: `the reader looks from ${TYPE_POV[h.type] || "a balanced medium shot"}`,
      place,
      characters,
      references: refs,
      missing: [...new Set(missing)],
    };
  });
}

// pronto per la generazione: nessuna pagina ha entità non confermate.
export function allReferencesReady(prompts: ManusPrompt[]): boolean {
  return prompts.every((p) => (p.missing?.length ?? 0) === 0);
}
