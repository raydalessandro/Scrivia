import { buildNode, buildPagePlan } from "../lib/engine";
import { deriveEntities, buildReferenceSheetPrompt, referenceGate, isConfirmed } from "../lib/reference";
import { buildPagePrompts, bookStylesheet, CONSISTENCY_BLOCK, allReferencesReady } from "../lib/pagePrompts";
import type { Seed, EntityRefRecord } from "../lib/types";
import type { Hook } from "../lib/engineTypes";

import { describe, it, expect } from "vitest";

declare const process: { exit(code?: number): never };

// Avvolto in describe/it (Vitest). Logica e assert IDENTICI allo script originale;
// l'uscita finale è sostituita da expect(bad).toBe(0).
describe("reference — flusso Passo 0 → prompt-pagina (B2)", () => {
it("derive entità · gate · reference-sheet · page prompts", () => {
let bad = 0;
const ok = (m: string) => console.log("  ✓ " + m);
const ko = (m: string) => { console.error("  ✗ " + m); bad++; };

const seed: Seed = {
  language: "it", title: "La radura",
  protagonist: { name: "Gabriel", age: 5, kind: "volpe" },
  companions: [{ name: "Noah", kind: "riccio" }],
  world_flavor: "animali_del_bosco",
  setting: { primary: "la radura sotto la quercia", notes: "" },
  theme: "scoperta", pugno: "una foglia che resta", personal_detail: "una sciarpa rossa",
  length_pages: 12, packs: [],
  spine: { premise: "Gabriel nel bosco", problem: "qualcosa cambia", threshold_moment: "allunga la mano", resolution_mode: "un gesto", closure: "resta un'immagine" },
  voice: { temperamento: "tenera" }, nonce: 4242,
};

const node = buildNode(seed);
const hooks = buildPagePlan(node) as Hook[];
ok(`nodo + ${hooks.length} hook`);

// 1) entità derivate
let entities = deriveEntities(node);
const ids = entities.map((e) => e.id);
const kinds = entities.map((e) => e.kind);
if (entities.length === 3 && kinds.filter((k) => k === "character").length === 2 && kinds.includes("location")) ok(`entità: ${entities.map((e) => `${e.name}(${e.kind})`).join(", ")}`);
else ko(`entità inattese: ${JSON.stringify(entities.map((e) => [e.name, e.kind]))}`);

// gli id delle entità combaciano con characters_present negli hook?
const presentIds = new Set<string>();
for (const h of hooks) for (const c of h.characters_present || []) presentIds.add(c.entityId);
const allMatch = [...presentIds].every((pid) => ids.includes(pid));
allMatch ? ok("id entità ↔ characters_present combaciano") : ko(`id non combaciano: present=${[...presentIds]} vs ${ids}`);

// 2) prompt-pagina SENZA conferme → tutto missing, references vuote
let manus = buildPagePrompts(node, hooks, entities);
const allMissing = manus.every((m) => (m.missing?.length ?? 0) > 0 && (m.references?.length ?? 0) === 0);
allMissing ? ok("pre-conferma: ogni pagina ha missing, references vuote") : ko("pre-conferma: stato references inatteso");
allReferencesReady(manus) === false ? ok("allReferencesReady = false (corretto)") : ko("allReferencesReady dovrebbe essere false");

// i campi sono veri (non placeholder)?
const m1 = manus[0];
const realFields = m1.storyMoment.length > 10 && m1.pov.includes("looks from") && m1.place.includes("identical") && m1.characters.length > 0;
realFields ? ok(`campi veri · p1 POV="${m1.pov.slice(0, 38)}…"`) : ko(`campi non valorizzati: ${JSON.stringify(m1)}`);

// 3) prompt del foglio di reference (Passo 0)
const rp = buildReferenceSheetPrompt(entities[0], node);
(rp.includes("SUBJECT —") && rp.includes("REFERENCE SHEET") && rp.includes("FORMAT")) ? ok("prompt reference-sheet blindato (SUBJECT/SHEET/FORMAT)") : ko("prompt reference-sheet malformato");

// 4) conferma tutte le entità → gate ready
entities = entities.map((e): EntityRefRecord => ({ ...e, imageUrl: `img/${e.id}.png`, status: "confermata" }));
const gate = referenceGate(entities);
gate.ready ? ok("gate Passo 0: ready dopo conferma") : ko(`gate non ready: mancano ${gate.missing.map((e) => e.id)}`);

// 5) ricostruisci prompt → references popolate, missing vuote
manus = buildPagePrompts(node, hooks, entities);
const allReady = manus.every((m) => (m.missing?.length ?? 0) === 0 && (m.references?.length ?? 0) > 0);
allReady ? ok("post-conferma: ogni pagina ha references, missing vuote") : ko("post-conferma: references non popolate ovunque");
allReferencesReady(manus) === true ? ok("allReferencesReady = true (corretto)") : ko("allReferencesReady dovrebbe essere true");

// 6) blocchi fissi presenti
(bookStylesheet(node).includes("ART STYLE") && CONSISTENCY_BLOCK.includes("BINDING")) ? ok("blocchi fissi (STYLESHEET + CONSISTENCY) ok") : ko("blocchi fissi mancanti");

console.log("");
expect(bad, "B2 smoke: controlli falliti (vedi log sopra)").toBe(0);
console.log("✓ B2 smoke: flusso reference → prompt verificato");

});
});
