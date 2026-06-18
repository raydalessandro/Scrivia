// e2e.test.ts — §7 Contratto di fase, end-to-end deterministico.
// Percorre l'intera pipeline pura (niente UI, niente rete):
//   seed → buildNode → buildPagePlan → deriveEntities → buildPagePrompts
// e ne verifica il contratto e la RIPRODUCIBILITÀ (stesso seed+nonce → stesso
// output, immagini escluse), come da CLAUDE.md (stesso nonce ⇒ stessa storia).

import { describe, it, expect } from "vitest";
import { buildNode, buildPagePlan } from "../lib/engine";
import { deriveEntities } from "../lib/reference";
import { buildPagePrompts, allReferencesReady } from "../lib/pagePrompts";
import type { Seed, EntityRefRecord } from "../lib/types";
import type { Hook } from "../lib/engineTypes";

function completeSeed(nonce: number): Seed {
  return {
    language: "it", title: "La radura",
    protagonist: { name: "Bruno", age: 6, kind: "tasso" },
    companions: [{ name: "Lea", kind: "uccello" }],
    world_flavor: "animali_del_bosco",
    setting: { primary: "la radura", notes: "sotto la grande quercia" },
    theme: "scoperta", pugno: "una foglia che resta", personal_detail: "una sciarpa rossa",
    length_pages: 12, packs: [],
    spine: {
      premise: "Bruno nel bosco", problem: "qualcosa cambia",
      threshold_moment: "allunga la zampa", resolution_mode: "un piccolo gesto",
      closure: "resta un'immagine",
    },
    voice: { temperamento: "tenera" }, nonce,
  };
}

// Esegue la pipeline completa per un seed e restituisce i quattro artefatti.
function pipeline(seed: Seed) {
  const node = buildNode(seed);
  const hooks = buildPagePlan(node) as Hook[];
  const entities = deriveEntities(node);
  const manus = buildPagePrompts(node, hooks, entities);
  return { node, hooks, entities, manus };
}

describe("§7 e2e deterministico (contratto di fase)", () => {
  it("§7.1 seed completo → build_node → entità 'da_generare' e page prompt con 'missing'", () => {
    const { entities, manus } = pipeline(completeSeed(4242));

    // entità derivate: protagonista + compagno + luogo, tutte da generare
    expect(entities.length).toBe(3);
    expect(entities.filter((e) => e.kind === "character")).toHaveLength(2);
    expect(entities.filter((e) => e.kind === "location")).toHaveLength(1);
    for (const e of entities) expect(e.status).toBe("da_generare");

    // pre-conferma: ogni pagina ha entità mancanti e nessuna reference allegata
    expect(manus.length).toBeGreaterThan(0);
    for (const m of manus) {
      expect((m.missing?.length ?? 0)).toBeGreaterThan(0);
      expect((m.references?.length ?? 0)).toBe(0);
    }
    expect(allReferencesReady(manus)).toBe(false);
  });

  it("§7.2 confermate tutte le reference → allReferencesReady=true e ogni pagina ha 'references'", () => {
    const { node, hooks, entities } = pipeline(completeSeed(4242));

    // conferma canonica: ogni entità con immagine e stato 'confermata'
    const confirmed: EntityRefRecord[] = entities.map((e) => ({ ...e, imageUrl: `img/${e.id}.png`, status: "confermata" }));
    const manus = buildPagePrompts(node, hooks, confirmed);

    for (const m of manus) {
      expect((m.missing?.length ?? 0)).toBe(0);
      expect((m.references?.length ?? 0)).toBeGreaterThan(0);
    }
    expect(allReferencesReady(manus)).toBe(true);
  });

  it("§7.3 riproducibilità: stesso seed+nonce → stesso node, stessi entities.id, stessi page prompt", () => {
    const a = pipeline(completeSeed(4242));
    const b = pipeline(completeSeed(4242));

    // nodo identico (campionamento guidato dal nonce, deterministico)
    expect(a.node).toEqual(b.node);
    // stesse entità (id, ordine, descrittori, kind)
    expect(a.entities).toEqual(b.entities);
    expect(a.entities.map((e) => e.id)).toEqual(b.entities.map((e) => e.id));
    // stessi page prompt (a meno delle immagini: qui non ce ne sono ancora)
    expect(a.manus).toEqual(b.manus);

    // e il nonce conta davvero: un nonce diverso cambia il nodo
    const c = pipeline(completeSeed(99));
    expect(c.node).not.toEqual(a.node);
  });
});
