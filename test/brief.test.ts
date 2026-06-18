// test/brief.test.ts — §M6/B5: il WRITING BRIEF (zero-token) da node + hooks + seed.
// reference: build_brief.py. Harness Vitest, environment "node".
import { describe, it, expect } from "vitest";
import type { Seed } from "../lib/types";
import type { Hook } from "../lib/engineTypes";
import { buildNode, buildPagePlan } from "../lib/engine";
import { buildBrief } from "../lib/brief";

const SEED: Seed = {
  language: "it", title: "La radura",
  protagonist: { name: "Bruno", age: 6, kind: "tasso" },
  companions: [{ name: "Lea", kind: "uccello" }],
  world_flavor: "animali_del_bosco",
  setting: { primary: "la radura", notes: "" },
  theme: "scoperta", pugno: "il coraggio di guardare", personal_detail: "una piuma blu",
  length_pages: 12, packs: [],
  spine: {
    premise: "Bruno teme il buio della tana",
    problem: "deve attraversarla al tramonto",
    threshold_moment: "fa il primo passo dentro",
    resolution_mode: "trova la piuma e respira",
    closure: "la luce torna piano",
  },
  voice: {},
  characterVoices: [
    { name: "Bruno", role: "protagonista", archetype: "timido", underStress: "si chiude",
      ritmo: "frasi corte", words: "«forse»", never: "non userebbe mai parolacce" },
  ],
  narratorBrief: "Voce calda, vicina, mai saputella.",
  nonce: 7,
};

const node = buildNode(SEED);
const hooks = buildPagePlan(node) as Hook[];
const brief = buildBrief(node, hooks, SEED);

describe("B5 · buildBrief (writing brief zero-token)", () => {
  it("intestazione + brief-first", () => {
    expect(brief).toContain("# WRITING BRIEF — La radura");
    expect(brief).toContain("Brief-first");
  });

  it("lo scheletro NON si nomina (niente acronimo EAR) ed è dichiarato invisibile", () => {
    expect(brief).not.toMatch(/\bEAR\b/);
    expect(brief).toContain("NON si nomina nel testo");
  });

  it("spina narrativa completa (premise/threshold/closure/personal_detail)", () => {
    expect(brief).toContain("Bruno teme il buio della tana");
    expect(brief).toContain("fa il primo passo dentro");
    expect(brief).toContain("la luce torna piano"); // closure dal seed
    expect(brief).toContain("una piuma blu");        // dettaglio personale intessuto
  });

  it("cast costruito da protagonist + companions", () => {
    expect(brief).toContain("Bruno");
    expect(brief).toContain("Lea");
    expect(brief).toContain("la radura");
  });

  it("tabella pagina-per-pagina: una riga per ogni pagina + SOGLIA marcata", () => {
    for (const h of hooks) expect(brief).toContain(`| ${h.page} |`);
    expect(brief).toContain("SOGLIA");
    expect(brief).toContain(`p${node.threshold_page}`);
  });

  it("semi: ogni id con pianta→ritorna", () => {
    for (const s of node.seeds) expect(brief).toContain(s.id);
    if (node.seeds.length) {
      expect(brief).toContain("pianta a p");
      expect(brief).toContain("ritorna a p");
    }
  });

  it("voce narratore (assi attivi) presente", () => {
    expect(brief).toContain("**Narratore**");
    expect(brief).toContain("assi attivi");
  });

  it("voci-personaggio d'autore (B3): il «non direbbe MAI» e il narratorBrief sono riportati", () => {
    expect(brief).toContain("non direbbe MAI");
    expect(brief).toContain("non userebbe mai parolacce");
    expect(brief).toContain("Voce calda, vicina");
  });
});
