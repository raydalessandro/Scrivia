// engine.unit.test.ts — Unit del motore deterministico (lib/engine.ts).
// Copre le righe ⬜ di docs/TEST_SPEC.md §1: 1.6, 1.7, 1.8, 1.9, 1.12, 1.13, 1.14.
// Complementare a engine.parity.test.ts (fuzz 1.1–1.5): qui si isolano i singoli
// contratti (override, voce, bordi pagine, ear_arc, riparazione hook, id entità).
// NON tocca il sorgente: se un'asserzione fallisse, è la spia di un bug da segnalare.

import { describe, it, expect } from "vitest";
import canon from "@/lib/canon.json";
import {
  buildNode,
  extractHooks,
  checkNode,
  checkHooks,
  entityIdOfCharacter,
  locationEntityId,
  entitiesInScene,
} from "@/lib/engine";
import type { SeedExt, StoryNodeExt } from "@/lib/engineTypes";
import type { BeatPlan, SeedEcho } from "@/lib/types";

// ---- factory: un Seed completo e valido, personalizzabile via patch ----
function baseSeed(patch: Partial<SeedExt> = {}): SeedExt {
  const s: SeedExt = {
    language: "it",
    title: "Prova",
    protagonist: { name: "Mira", age: 7, kind: "bambina" },
    companions: [{ name: "Tobia", kind: "cane" }],
    world_flavor: "bosco quieto",
    setting: { primary: "la radura sotto la quercia", notes: "" },
    theme: "amicizia",
    pugno: "",
    personal_detail: "",
    length_pages: 12,
    packs: [],
    spine: { premise: "", problem: "", threshold_moment: "", resolution_mode: "", closure: "" },
    voice: {},
    nonce: 12345,
  };
  return { ...s, ...patch };
}

// ---- helper: beat_plan contiguo da 1 a `pages`, senza buchi né sovrapposizioni ----
function assertContiguous(plan: BeatPlan[], pages: number) {
  const sorted = [...plan].sort((a, b) => a.pages[0] - b.pages[0]);
  expect(sorted.length).toBeGreaterThan(0);
  expect(sorted[0].pages[0]).toBe(1);
  let cur = 1;
  for (const b of sorted) {
    expect(b.pages[0]).toBe(cur); // nessun buco / overlap
    expect(b.pages[1]).toBeGreaterThanOrEqual(b.pages[0]); // non invertito
    cur = b.pages[1] + 1;
  }
  expect(cur - 1).toBe(pages); // l'ultimo beat chiude esattamente su `pages`
}

// ---- factory: nodo SINTETICO valido per storie corte (8–9 pp), che buildNode
// non produce (clampa a ≥10). Serve a regredire la riparazione varietà-hook (§1.12). ----
function shortNode(pages: 8 | 9, nonce: number): StoryNodeExt {
  let beat_plan: BeatPlan[];
  let threshold_page: number;
  let seeds: SeedEcho[];
  if (pages === 8) {
    beat_plan = [
      { beat: "apertura", pages: [1, 1] },
      { beat: "distinguere", pages: [2, 3] },
      { beat: "connettere", pages: [4, 5] },
      { beat: "cambiare", pages: [6, 7] },
      { beat: "chiusura", pages: [8, 8] },
    ];
    threshold_page = 6;
    seeds = [
      { id: "seed_01", kind: "oggetto", what: "[oggetto]", planted_page: 2, payoff_page: 6 },
      { id: "seed_02", kind: "gesto", what: "[gesto]", planted_page: 3, payoff_page: 7 },
    ];
  } else {
    beat_plan = [
      { beat: "apertura", pages: [1, 1] },
      { beat: "distinguere", pages: [2, 4] },
      { beat: "connettere", pages: [5, 6] },
      { beat: "cambiare", pages: [7, 8] },
      { beat: "chiusura", pages: [9, 9] },
    ];
    threshold_page = 7;
    seeds = [
      { id: "seed_01", kind: "oggetto", what: "[oggetto]", planted_page: 2, payoff_page: 7 },
      { id: "seed_02", kind: "gesto", what: "[gesto]", planted_page: 3, payoff_page: 8 },
    ];
  }
  return {
    id: "short",
    title: "Corta",
    attribute_dominant: "connettere",
    deployment_level: "triadico",
    ear_arc: ["distinguere", "connettere", "cambiare"],
    premise: "",
    problem: "",
    threshold_moment: "",
    resolution_mode: "",
    entry_point_type: "A",
    closure_type: 2,
    register: "medio",
    register_range: [0.4, 0.6],
    time_span_arc: "un_giorno",
    threshold_page,
    pages,
    estimated_words: pages * 70,
    world_flavor: "",
    setting_primary: "il bosco",
    season: "estate",
    palette_emotiva: "ori caldi e ombre piene, luce alta — pugno medio",
    protagonist: { name: "Mira", age: 7, kind: "bambina" },
    companions: [{ name: "Tobia", kind: "cane" }],
    beat_plan,
    seeds,
    pugno: "",
    personal_detail: "",
    seed_nonce: nonce >>> 0,
    setting_entity_id: null,
    debt: null,
    recurring_image: null,
  };
}

// ======================================================================
// §1.6 — Override onorati
// ======================================================================
describe("§1.6 — gli override del seed compaiono nel nodo", () => {
  const overrides = {
    attribute_dominant: "connettere",
    deployment_level: "triadico",
    entry_point_type: "D",
    closure_type: 3,
    register: "alto",
    time_span_arc: "una_stagione",
  };

  it("ogni override è rispettato, per qualunque nonce", () => {
    for (const nonce of [1, 2, 7, 42, 1000, 999999]) {
      const node = buildNode(baseSeed({ nonce, overrides }));
      expect(node.attribute_dominant).toBe("connettere");
      expect(node.deployment_level).toBe("triadico");
      expect(node.entry_point_type).toBe("D");
      expect(node.closure_type).toBe(3);
      expect(node.register).toBe("alto");
      expect(node.time_span_arc).toBe("una_stagione");
      // conseguenze coerenti col canone
      expect(node.register_range).toEqual(canon.register.alto);
      expect(node.ear_arc).toEqual(["distinguere", "connettere", "cambiare"]);
      // il nodo resta valido
      expect(checkNode(node)).toEqual([]);
    }
  });
});

// ======================================================================
// §1.7 — Voce override
// ======================================================================
describe("§1.7 — gli assi-voce forzati sono usati dal narratore", () => {
  it("un asse forzato compare col suo valore; assi attivi nel range del canone", () => {
    const [lo, hi] = canon.voice.narrator_active_axes;
    for (const nonce of [1, 5, 13, 77, 250, 9999]) {
      const node = buildNode(baseSeed({ nonce, voice: { ritmo: "onda_lunga" } }));
      const narr = node.voice!.narrator;
      expect(narr.active_axes).toContain("ritmo");
      expect(narr.cards.ritmo.value).toBe("onda_lunga");
      expect(narr.active_axes.length).toBeGreaterThanOrEqual(lo);
      expect(narr.active_axes.length).toBeLessThanOrEqual(hi);
      expect(checkNode(node)).toEqual([]);
    }
  });

  it("due assi forzati compaiono entrambi col loro valore", () => {
    const node = buildNode(
      baseSeed({ nonce: 3, voice: { ritmo: "corte_secche", lente_sensoriale: "luce" } })
    );
    const narr = node.voice!.narrator;
    expect(narr.cards.ritmo.value).toBe("corte_secche");
    expect(narr.cards.lente_sensoriale.value).toBe("luce");
    expect(narr.active_axes).toEqual(expect.arrayContaining(["ritmo", "lente_sensoriale"]));
    expect(checkNode(node)).toEqual([]);
  });
});

// ======================================================================
// §1.8 — Bordi pagine (clamp [10,20]) + beat_plan contiguo
// ======================================================================
describe("§1.8 — length_pages è clampato a [10,20] e beat_plan resta contiguo", () => {
  it("sotto il minimo → 10", () => {
    for (const lp of [1, 5, 9]) {
      const node = buildNode(baseSeed({ nonce: 11, length_pages: lp }));
      expect(node.pages).toBe(10);
      assertContiguous(node.beat_plan, node.pages);
      expect(checkNode(node)).toEqual([]);
    }
  });

  it("sopra il massimo → 20", () => {
    for (const lp of [21, 50, 99, 1000]) {
      const node = buildNode(baseSeed({ nonce: 22, length_pages: lp }));
      expect(node.pages).toBe(20);
      assertContiguous(node.beat_plan, node.pages);
      expect(checkNode(node)).toEqual([]);
    }
  });

  it("dentro il range resta invariato, da 10 a 20", () => {
    for (let lp = 10; lp <= 20; lp++) {
      const node = buildNode(baseSeed({ nonce: 100 + lp, length_pages: lp }));
      expect(node.pages).toBe(lp);
      assertContiguous(node.beat_plan, node.pages);
      expect(checkNode(node)).toEqual([]);
    }
  });
});

// ======================================================================
// §1.9 — Mono vs triadico: ear_arc coerente con deployment_level
// ======================================================================
describe("§1.9 — ear_arc coerente con deployment_level", () => {
  it("mono → ear_arc = [attributo]", () => {
    for (const attr of ["distinguere", "connettere", "cambiare"]) {
      const node = buildNode(
        baseSeed({ nonce: 8, overrides: { deployment_level: "mono", attribute_dominant: attr } })
      );
      expect(node.deployment_level).toBe("mono");
      expect(node.ear_arc).toEqual([attr]);
      expect(checkNode(node)).toEqual([]);
    }
  });

  it("triadico → ear_arc = triade, indipendente dall'attributo dominante", () => {
    for (const attr of ["distinguere", "connettere", "cambiare"]) {
      const node = buildNode(
        baseSeed({ nonce: 9, overrides: { deployment_level: "triadico", attribute_dominant: attr } })
      );
      expect(node.deployment_level).toBe("triadico");
      expect(node.ear_arc).toEqual(["distinguere", "connettere", "cambiare"]);
      expect(checkNode(node)).toEqual([]);
    }
  });
});

// ======================================================================
// §1.12 — Riparazione varietà-hook su storie corte (8–9 pp)
// (regressione del bug noto: niente sotto min_distinct_types, niente eccesso di consecutivi)
// ======================================================================
describe("§1.12 — extractHooks ripara la varietà sulle storie corte", () => {
  const minDistinct = canon.hooks.min_distinct_types;
  const maxConsec = canon.hooks.max_consecutive_same_type;

  for (const pages of [8, 9] as const) {
    it(`${pages} pagine: ≥ ${minDistinct} tipi distinti e ≤ ${maxConsec} consecutivi (×400 nonce)`, () => {
      for (let nonce = 1; nonce <= 400; nonce++) {
        const node = shortNode(pages, nonce);
        const hooks = extractHooks(node);
        expect(hooks.length).toBe(pages);

        const distinct = new Set(hooks.map((h) => h.type));
        expect(distinct.size).toBeGreaterThanOrEqual(minDistinct);

        let run = 1;
        for (let i = 1; i < hooks.length; i++) {
          run = hooks[i].type === hooks[i - 1].type ? run + 1 : 1;
          expect(run).toBeLessThanOrEqual(maxConsec);
        }

        // tutte le invarianti hook valgono anche sulla storia corta
        expect(checkHooks(hooks, node)).toEqual([]);
      }
    });
  }
});

// ======================================================================
// §1.13 — entityIdOfCharacter / locationEntityId: stabili e slug-safe
// ======================================================================
describe("§1.13 — id d'entità stabili e slug-safe", () => {
  const SAFE = /^[a-z0-9_]+$/;

  it("entityIdOfCharacter: l'entityId esplicito vince sul nome", () => {
    expect(entityIdOfCharacter({ name: "Anna", entityId: "char_custom" })).toBe("char_custom");
  });

  it("entityIdOfCharacter: slug del nome con accenti e spazi", () => {
    expect(entityIdOfCharacter({ name: "Niccolò Aragosta" })).toBe("char_niccolo_aragosta");
    expect(entityIdOfCharacter({ name: "  Èlena   B!  " })).toBe("char_elena_b");
  });

  it("entityIdOfCharacter: senza nome → char_anon; output sempre slug-safe", () => {
    expect(entityIdOfCharacter(undefined)).toBe("char_anon");
    expect(entityIdOfCharacter({})).toBe("char_anon");
    for (const name of ["Ðániel", "MARÍA José", "x___y", "Ülrich von Stäin", "François"]) {
      const id = entityIdOfCharacter({ name });
      expect(id.startsWith("char_")).toBe(true);
      expect(SAFE.test(id)).toBe(true);
    }
  });

  it("locationEntityId: id esplicito vince, altrimenti slug di setting_primary", () => {
    expect(locationEntityId({ setting_entity_id: "luogo_x" })).toBe("luogo_x");
    expect(locationEntityId({ setting: { entityId: "luogo_y" } })).toBe("luogo_y");
    expect(locationEntityId({ setting_primary: "La Radura Sotto la Quercia" })).toBe(
      "luogo_la_radura_sotto_la_quercia"
    );
    expect(locationEntityId({})).toBe("luogo_luogo");
  });

  it("entrambe pure: stesso input → stesso output", () => {
    const c = { name: "Tobia il Cane" };
    expect(entityIdOfCharacter(c)).toBe(entityIdOfCharacter(c));
    const n = { setting_primary: "Riva Lontana" };
    expect(locationEntityId(n)).toBe(locationEntityId(n));
  });
});

// ======================================================================
// §1.14 — entitiesInScene = personaggi presenti ∪ luogo, senza duplicati
// ======================================================================
describe("§1.14 — entitiesInScene unisce personaggi e luogo senza duplicati", () => {
  it("insieme = unione degli entityId negli hook + l'id luogo", () => {
    for (const nonce of [1, 4, 16, 64, 256, 1024]) {
      const node = buildNode(baseSeed({ nonce }));
      const hooks = extractHooks(node);
      const scene = entitiesInScene(hooks, node);

      // nessun duplicato
      expect(scene.length).toBe(new Set(scene).size);
      // protagonista e luogo sempre presenti
      expect(scene).toContain(entityIdOfCharacter(node.protagonist));
      expect(scene).toContain(locationEntityId(node));

      // uguaglianza insiemistica con l'unione ricavata dagli hook
      const expected = new Set<string>();
      for (const h of hooks) for (const c of h.characters_present) expected.add(c.entityId);
      expected.add(locationEntityId(node));
      expect(new Set(scene)).toEqual(expected);
    }
  });

  it("il compagno è in scena se e solo se compare negli hook", () => {
    const node = buildNode(baseSeed({ nonce: 4 }));
    const hooks = extractHooks(node);
    const compId = entityIdOfCharacter(node.companions[0]);
    const compInHooks = hooks.some((h) => h.characters_present.some((c) => c.entityId === compId));
    const scene = entitiesInScene(hooks, node);
    expect(scene.includes(compId)).toBe(compInHooks);
  });
});
