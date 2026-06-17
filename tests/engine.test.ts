import { describe, it, expect } from "vitest";
import { buildNode, buildPagePlan } from "@/lib/engine";
import type { Seed } from "@/lib/types";

function seed(nonce: number | null = 70125): Seed {
  return {
    language: "it", title: "",
    protagonist: { name: "Pino", age: 6, kind: "riccio" },
    companions: [{ name: "Ghita", kind: "ghiandaia" }],
    world_flavor: "animali_del_bosco",
    setting: { primary: "il bosco", notes: "" },
    theme: "amicizia",
    pugno: "Pino non sa come si fa un amico in un posto nuovo",
    personal_detail: "un sasso liscio",
    length_pages: 12, packs: [],
    spine: { premise: "p", problem: "q", threshold_moment: "t", resolution_mode: "r", closure: "" },
    voice: {}, nonce,
  };
}

describe("buildNode — determinismo (la verità è nel grafo)", () => {
  it("stesso nonce → stesso nodo", () => {
    expect(buildNode(seed(70125))).toEqual(buildNode(seed(70125)));
  });
  it("nonce diverso → di norma nodo diverso", () => {
    const a = buildNode(seed(1));
    const b = buildNode(seed(999999));
    // almeno un asse della grammatica cambia
    const differs =
      a.entry_point_type !== b.entry_point_type ||
      a.closure_type !== b.closure_type ||
      a.attribute_dominant !== b.attribute_dominant ||
      a.time_span_arc !== b.time_span_arc;
    expect(differs).toBe(true);
  });
  it("ontologia: tema amicizia → connettere", () => {
    expect(buildNode(seed()).attribute_dominant).toBe("connettere");
  });
});

describe("buildNode — invarianti strutturali", () => {
  const node = buildNode(seed());
  it("pagine e parole coerenti", () => {
    expect(node.pages).toBe(12);
    expect(node.estimated_words).toBeGreaterThan(0);
  });
  it("soglia dentro la storia", () => {
    expect(node.threshold_page).toBeGreaterThanOrEqual(2);
    expect(node.threshold_page).toBeLessThanOrEqual(node.pages);
  });
  it("beat plan: apre a p1, chiude a pPagine, contiguo", () => {
    const bp = node.beat_plan;
    expect(bp[0].pages[0]).toBe(1);
    expect(bp[bp.length - 1].pages[1]).toBe(node.pages);
    for (let i = 1; i < bp.length; i++) {
      expect(bp[i].pages[0]).toBe(bp[i - 1].pages[1] + 1);
    }
  });
  it("semi: piantati prima, pagati dopo", () => {
    for (const s of node.seeds) {
      expect(s.planted_page).toBeLessThan(s.payoff_page);
      expect(s.payoff_page).toBeLessThanOrEqual(node.pages);
    }
  });
});

describe("buildPagePlan", () => {
  const node = buildNode(seed());
  const plan = buildPagePlan(node);
  it("una riga per pagina", () => {
    expect(plan).toHaveLength(node.pages);
    expect(plan.map((p) => p.page)).toEqual(Array.from({ length: node.pages }, (_, i) => i + 1));
  });
  it("apertura/soglia/chiusura segnate", () => {
    expect(plan[0].note).toContain("APERTURA");
    expect(plan[node.pages - 1].note).toContain("CHIUSURA");
    expect(plan.find((p) => p.page === node.threshold_page)!.note).toContain("SOGLIA");
  });
});
