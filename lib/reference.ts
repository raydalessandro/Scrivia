// reference.ts — Passo 0 (Reference visiva). La FASE che mancava: prima di generare
// le pagine, ogni entità (personaggi + luogo) ha una REFERENCE canonica confermata.
//
// Flusso: deriveEntities(node) ricava la lista dalle entità del nodo → per ognuna
// l'umano scrive il descrittore (l'aspetto), genera il foglio di reference col prompt
// blindato (buildReferenceSheetPrompt), incolla l'immagine e CONFERMA. Da quel momento
// il descrittore è il canone e l'immagine è il riferimento duro che le pagine allegano.
// Lo stato vive nella Story (serializzabile): niente classi, tutto in `story.entities`.

import type { StoryNode, EntityRefRecord } from "./types";
import { buildStylesheet } from "./stylesheet";
import { entityIdOfCharacter, locationEntityId } from "./engine";

// Foglio di reference per tipo (blindato, anti-drift). Personaggi e luogo (oggetti in futuro).
const SHEET_FRAMING: Record<EntityRefRecord["kind"], string> = {
  character:
    "CHARACTER REFERENCE SHEET — three views on one sheet: front, three-quarter, and profile. " +
    "Neutral standing pose, neutral expression, full body, the subject ISOLATED on a plain flat " +
    "neutral background. No scene, no extra props beyond the character's own signature items. " +
    "These three views are the BINDING canonical reference for every later page (faces, colors, " +
    "clothing and signature items must match them from any angle).",
  location:
    "LOCATION REFERENCE SHEET — one clear establishing view of the place plus one secondary angle, " +
    "NO characters present, consistent lighting signature, plain framing. BINDING canonical " +
    "reference for the place across every page.",
  object:
    "OBJECT REFERENCE SHEET — the object ISOLATED on a plain flat neutral background, front and " +
    "three-quarter views, clear true-scale cues, no scene. BINDING canonical reference for the object.",
};

const SUBJECT_LABEL = "SUBJECT —";

// Descrittore di partenza: minimo, basato sulla specie. L'umano lo rifinisce nel Passo 0
// (è lì che si definisce l'aspetto: colori, vestiti, oggetto-firma).
function seedDescriptor(name: string, species: string, kind: EntityRefRecord["kind"]): string {
  if (kind === "location") return name;
  const sp = (species || "").trim();
  return sp ? `${name}, a ${sp}` : name;
}

// Ricava le entità dal nodo (protagonista + compagni = personaggi, luogo = location).
// Se `prev` è passato, PRESERVA descrittore/immagine/stato per gli id già presenti
// (ricostruire il grafo non butta via le conferme già fatte).
export function deriveEntities(node: StoryNode, prev?: EntityRefRecord[]): EntityRefRecord[] {
  const byId = new Map((prev ?? []).map((e) => [e.id, e]));
  const keep = (rec: EntityRefRecord): EntityRefRecord => {
    const old = byId.get(rec.id);
    return old ? { ...rec, descriptor: old.descriptor || rec.descriptor, referencePrompt: old.referencePrompt, imageUrl: old.imageUrl, status: old.status } : rec;
  };
  const out: EntityRefRecord[] = [];
  const prot = node.protagonist;
  out.push(keep({
    id: entityIdOfCharacter(prot), name: prot.name, kind: "character",
    species: (prot.kind || "").toLowerCase(),
    descriptor: seedDescriptor(prot.name, (prot.kind || "").toLowerCase(), "character"),
    status: "da_generare",
  }));
  for (const c of node.companions || []) {
    out.push(keep({
      id: entityIdOfCharacter(c), name: c.name, kind: "character",
      species: (c.kind || "").toLowerCase(),
      descriptor: seedDescriptor(c.name, (c.kind || "").toLowerCase(), "character"),
      status: "da_generare",
    }));
  }
  const locId = locationEntityId(node);
  const locName = node.setting_primary || "il luogo";
  out.push(keep({
    id: locId, name: locName, kind: "location", species: "",
    descriptor: seedDescriptor(locName, "", "location"), status: "da_generare",
  }));
  // dedup per id (un personaggio non si ripete)
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

// Prompt del FOGLIO DI REFERENCE (Passo 0): STYLESHEET → SUBJECT → LOCKED → SHEET FRAMING → FORMAT.
// Stagione neutra: la canonica è il riferimento, non una scena.
export function buildReferenceSheetPrompt(entity: EntityRefRecord, node: StoryNode): string {
  const world = (node as { world_flavor?: string }).world_flavor;
  const ageHint = entity.kind === "character" ? node.protagonist?.age ?? null : null;
  const blocks: string[] = [];
  blocks.push(buildStylesheet({ world, ageHint }));
  blocks.push(`${SUBJECT_LABEL} ${entity.name}: ${(entity.descriptor || "").trim()}`);
  const proh = (entity.prohibitions ?? []).map((p) => p.trim()).filter(Boolean);
  if (proh.length) blocks.push(`LOCKED — repeat every time: ${proh.join("; ")}.`);
  blocks.push(SHEET_FRAMING[entity.kind]);
  blocks.push("FORMAT: vertical 2:3, isolated subject, NO text, NO lettering anywhere in the image.");
  return blocks.join("\n\n");
}

// Cancello del Passo 0: pronte solo se OGNI entità è confermata e ha l'immagine.
export function referenceGate(entities: EntityRefRecord[]): { ready: boolean; missing: EntityRefRecord[] } {
  const missing = (entities ?? []).filter((e) => e.status !== "confermata" || !e.imageUrl);
  return { ready: missing.length === 0, missing };
}

// Helper di query (usato dai prompt-pagina): l'entità confermata col suo descrittore/immagine.
export function findEntity(entities: EntityRefRecord[] | undefined, id: string): EntityRefRecord | undefined {
  return (entities ?? []).find((e) => e.id === id);
}
export function isConfirmed(entities: EntityRefRecord[] | undefined, id: string): boolean {
  const e = findEntity(entities, id);
  return !!e && e.status === "confermata" && !!e.imageUrl;
}
