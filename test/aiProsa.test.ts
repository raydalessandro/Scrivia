// test/aiProsa.test.ts — §M2/B7: la prosa pagina-per-pagina dal brief.
// Logica pura: niente rete. Lo streaming (fetch + sseJson) è già coperto da §4.
import { describe, it, expect } from "vitest";
import type { Story, Seed, PagePlan, ProsePage } from "../lib/types";
import type { StreamEvent } from "../lib/ai/types";
import { buildProsaRequest, accumulateProseText, applyProsaPage, PROSA_SYSTEM } from "../lib/ai/tasks/prosa";

const BRIEF = [
  "# Writing brief — La radura",
  "Registro: caldo, semplice. ~70 parole a pagina.",
  "| pagina | beat | cosa accade |",
  "| 1 | apertura | Bruno esce nella radura | APERTURA",
  "| 3 | soglia | Bruno decide di attraversare il ruscello | SOGLIA",
].join("\n");

function story(over: Partial<Story> = {}): Story {
  const seed: Seed = {
    language: "it", title: "La radura", protagonist: { name: "Bruno", age: 6, kind: "tasso" },
    companions: [], world_flavor: "animali_del_bosco", setting: { primary: "la radura", notes: "" },
    theme: "scoperta", pugno: "x", personal_detail: "y", length_pages: 12, packs: [],
    spine: { premise: "p", problem: "q", threshold_moment: "t", resolution_mode: "r", closure: "c" },
    voice: {}, nonce: 7,
  };
  const pagePlan: PagePlan[] = [
    { page: 1, beat: "apertura", hook: "", zone: "", note: "" },
    { page: 2, beat: "sviluppo", hook: "", zone: "", note: "" },
    { page: 3, beat: "soglia", hook: "", zone: "", note: "" },
  ];
  return { id: "x", createdAt: new Date().toISOString(), title: "La radura", stage: "prosa", seed, brief: BRIEF, pagePlan, ledger: [], ...over } as unknown as Story;
}

describe("B7 · buildProsaRequest", () => {
  it("brief-first: il system porta PROSA_SYSTEM + il writing brief", () => {
    const req = buildProsaRequest(story(), 3);
    expect(req.system).toContain(PROSA_SYSTEM.slice(0, 40));
    expect(req.system).toContain("WRITING BRIEF");
    expect(req.system).toContain("La radura");          // contenuto del brief
    expect(req.task).toBe("prosa");
  });

  it("il messaggio chiede la pagina giusta col suo beat, e solo il testo della pagina", () => {
    const req = buildProsaRequest(story(), 3);
    const user = req.messages[req.messages.length - 1].content;
    expect(user).toContain("PAGINA 3");
    expect(user).toContain("soglia");                   // beat della pagina 3
    expect(user).toContain("SOLO il testo");
  });

  it("continuità: se la pagina precedente è scritta, il messaggio la richiama", () => {
    const prose: ProsePage[] = [{ page: 2, beat: "sviluppo", text: "Bruno annusò l'aria. Il muschio era umido." }];
    const req = buildProsaRequest(story({ prose }), 3);
    const user = req.messages[req.messages.length - 1].content;
    expect(user).toContain("pagina precedente finiva");
    expect(user).toContain("muschio era umido");
  });

  it("lo scheletro resta invisibile: niente acronimo EAR nel system", () => {
    expect(buildProsaRequest(story(), 1).system).not.toMatch(/\bEAR\b/);
  });

  it("brief assente → fallback onesto nel system (nessun crash)", () => {
    const req = buildProsaRequest(story({ brief: undefined }), 1);
    expect(req.system).toContain("non disponibile");
  });
});

describe("B7 · accumulateProseText", () => {
  it("unisce i delta di testo, ignorando i tool-call", () => {
    const events: StreamEvent[] = [
      { type: "text", delta: "Bruno " },
      { type: "text", delta: "uscì nella radura." },
      { type: "done", result: {} as any },
    ];
    expect(accumulateProseText(events)).toBe("Bruno uscì nella radura.");
  });
});

describe("B7 · applyProsaPage", () => {
  it("scrive la pagina e tiene la prosa ordinata", () => {
    let s = story({ prose: [{ page: 1, beat: "apertura", text: "uno" }] });
    s = applyProsaPage(s, 3, "soglia", "  tre  ");
    s = applyProsaPage(s, 2, "sviluppo", "due");
    expect(s.prose?.map((p) => p.page)).toEqual([1, 2, 3]);
    expect(s.prose?.find((p) => p.page === 3)?.text).toBe("tre"); // trim
  });

  it("riscrive la stessa pagina senza duplicarla", () => {
    let s = applyProsaPage(story({ prose: [] }), 1, "apertura", "v1");
    s = applyProsaPage(s, 1, "apertura", "v2");
    expect(s.prose?.filter((p) => p.page === 1).length).toBe(1);
    expect(s.prose?.[0].text).toBe("v2");
  });
});
