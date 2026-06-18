// test/aiCritic.test.ts — §M2/B8: cancello qualità a strati.
//   Strati deterministici (lib/audit): regex (frasi bandite / quote) + strutturale.
//   Strato semantico (lib/ai/tasks/critic): richiesta, parsing del verdetto JSON, fusione.
import { describe, it, expect } from "vitest";
import type { Story, StoryNode, ProsePage, CriticVerdict } from "../lib/types";
import {
  auditRegex, auditStruct, auditDeterministic, combineVerdict, proseText, type PageFlag,
} from "../lib/audit";
import {
  buildCriticRequest, parseCriticResponse, mergeCriticVerdict, withSemanticPending, CRITIC_SYSTEM,
} from "../lib/ai/tasks/critic";

function node(over: Partial<StoryNode> = {}): StoryNode {
  return {
    pages: 3, threshold_page: 2,
    seeds: [{ id: "sasso", kind: "oggetto", what: "un sasso liscio", planted_page: 1, payoff_page: 3 }],
    ...over,
  } as unknown as StoryNode;
}
function story(prose: ProsePage[], n: StoryNode | undefined, brief = "brief"): Story {
  return { id: "x", createdAt: "", title: "", stage: "audit", seed: {}, prose, node: n, brief, ledger: [] } as unknown as Story;
}
const P = (page: number, text: string): ProsePage => ({ page, beat: "b", text });

// ---------------------------------------------------------------------------
describe("B8 · strato regex", () => {
  it("una frase bandita (quota 0) → check fallito (duro)", () => {
    const { check } = auditRegex("Da quel giorno tutto cambiò nella radura.");
    expect(check.key).toBe("frasi_bandite");
    expect(check.pass).toBe(false);
  });
  it("prosa pulita → check superato", () => {
    expect(auditRegex("Bruno uscì nella radura e annusò il muschio umido.").check.pass).toBe(true);
  });
  it("quota bassa sforata ('sorrise' 4×) → flag soft (non duro)", () => {
    const { check, flags } = auditRegex("Sorrise. Sorrise ancora. Sorrise. E sorrise.");
    expect(check.pass).toBe(true); // soft non ribalta il check delle bandite
    expect(flags.some((f) => f.severity === "soft" && f.issue.includes("sorrise"))).toBe(true);
  });
});

describe("B8 · strato strutturale", () => {
  it("copertura completa + semi + soglia presenti → tutti superati", () => {
    const { checks } = auditStruct([P(1, "a"), P(2, "b"), P(3, "c")], node());
    expect(checks.every((c) => c.pass)).toBe(true);
  });
  it("pagina mancante → copertura fallita", () => {
    const { checks } = auditStruct([P(1, "a"), P(2, "b")], node());
    expect(checks.find((c) => c.key === "copertura_pagine")?.pass).toBe(false);
  });
  it("seme senza pagina di ritorno → semi_ripresi fallito", () => {
    const { checks } = auditStruct([P(1, "a"), P(2, "b"), P(3, "c")], node({ seeds: [{ id: "x", kind: "k", what: "w", planted_page: 1, payoff_page: 9 }] }));
    expect(checks.find((c) => c.key === "semi_ripresi")?.pass).toBe(false);
  });
  it("soglia fuori dalle pagine → soglia_presente fallito", () => {
    const { checks } = auditStruct([P(1, "a"), P(2, "b"), P(3, "c")], node({ threshold_page: 7 }));
    expect(checks.find((c) => c.key === "soglia_presente")?.pass).toBe(false);
  });
  it("senza nodo → copertura non verificabile (fallita)", () => {
    expect(auditStruct([P(1, "a")], undefined).checks[0].pass).toBe(false);
  });
});

describe("B8 · verdetto deterministico", () => {
  it("frase bandita → FAIL; prosa pulita e completa → PASS", () => {
    const bad = auditDeterministic(story([P(1, "Da quel giorno fu felice."), P(2, "b"), P(3, "c")], node()));
    expect(bad.verdict).toBe("FAIL");
    const good = auditDeterministic(story([P(1, "Bruno corse via."), P(2, "Saltò il fosso."), P(3, "Tornò a casa col sasso liscio.")], node()));
    expect(good.verdict).toBe("PASS");
  });
  it("combineVerdict: solo flag soft → PASS; flag hard → FAIL", () => {
    const checks = [{ key: "frasi_bandite", label: "", pass: true, note: "" }];
    expect(combineVerdict(checks, [{ page: 0, severity: "soft", issue: "x" }])).toBe("PASS");
    expect(combineVerdict(checks, [{ page: 1, severity: "hard", issue: "x" }])).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
describe("B8 · strato semantico", () => {
  const s = story([P(1, "Bruno corse via."), P(2, "Saltò."), P(3, "Tornò.")], node());

  it("buildCriticRequest: system = SKILL critic; user porta la prosa; task critic; niente EAR", () => {
    const req = buildCriticRequest(s);
    expect(req.system).toBe(CRITIC_SYSTEM);
    expect(req.system).not.toMatch(/\bEAR\b/);
    expect(req.messages[0].content).toContain("Bruno corse via");
    expect(req.task).toBe("critic");
  });

  it("parseCriticResponse: estrae il JSON anche tra ``` e mappa i check", () => {
    const raw = "Ecco il verdetto:\n```json\n{\"verdict\":\"FAIL\",\"checks\":{\"scheletro_invisibile\":{\"pass\":false,\"note\":\"riga 3 dichiara il cambiamento\"}},\"page_flags\":[]}\n```";
    const { checks } = parseCriticResponse(raw);
    expect(checks.find((c) => c.key === "scheletro_invisibile")?.pass).toBe(false);
    expect(checks.find((c) => c.key === "scheletro_invisibile")?.label).toBe("Scheletro invisibile");
  });

  it("parseCriticResponse: testo non-JSON → nessun check + flag soft", () => {
    const { checks, page_flags } = parseCriticResponse("nessun json qui");
    expect(checks.length).toBe(0);
    expect(page_flags[0].severity).toBe("soft");
  });

  it("mergeCriticVerdict: PASS deterministico + check duro semantico fallito → FAIL", () => {
    const det = auditDeterministic(s); // PASS
    expect(det.verdict).toBe("PASS");
    const merged = mergeCriticVerdict(det, { checks: [{ key: "scheletro_invisibile", label: "", pass: false, note: "" }], page_flags: [] as PageFlag[] });
    expect(merged.verdict).toBe("FAIL");
    expect(merged.checks.length).toBeGreaterThan(det.checks.length);
  });

  it("withSemanticPending: tiene il verdetto e aggiunge la nota", () => {
    const det: CriticVerdict = { verdict: "PASS", checks: [], page_flags: [] };
    const v = withSemanticPending(det);
    expect(v.verdict).toBe("PASS");
    expect(v.checks.some((c) => c.key === "critic_semantico")).toBe(true);
  });
});

describe("B8 · proseText", () => {
  it("unisce il testo delle pagine", () => {
    expect(proseText([P(1, "uno"), P(2, "due")])).toContain("uno");
  });
});
