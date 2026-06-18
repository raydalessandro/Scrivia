// test/aiSeeding.test.ts — §M2/B6: seeding conversazionale (request + applicazione turno).
// Logica pura: niente rete. Lo streaming (fetch + sseJson) è già coperto da §4.
import { describe, it, expect } from "vitest";
import type { Story, Seed } from "../lib/types";
import type { StreamEvent, CompletionResult } from "../lib/ai/types";
import { buildSeedingRequest, applySeedingTurn, seedStateSummary } from "../lib/ai/tasks/seeding";

function story(seed: Partial<Seed> = {}): Story {
  const base: Seed = {
    language: "it", title: "", protagonist: { name: "", age: 0, kind: "" }, companions: [],
    world_flavor: "", setting: { primary: "", notes: "" }, theme: "", pugno: "", personal_detail: "",
    length_pages: 12, packs: [],
    spine: { premise: "", problem: "", threshold_moment: "", resolution_mode: "", closure: "" },
    voice: {}, nonce: 0, ...seed,
  };
  return { id: "x", createdAt: new Date().toISOString(), title: "", stage: "seed", seed: base, ledger: [] } as unknown as Story;
}

const DONE: StreamEvent = { type: "done", result: {} as CompletionResult };

describe("B6 · buildSeedingRequest", () => {
  const req = buildSeedingRequest(story({ protagonist: { name: "Mia", age: 5, kind: "" } }), "ciao");

  it("system = protocollo + stato del seme; task seeding; tools dal registry", () => {
    expect(req.system).toContain("processo a passi");        // il protocollo
    expect(req.system).toContain("STATO ATTUALE DEL SEME");  // lo stato iniettato
    expect(req.system).toContain("Mia");                     // lo stato riflette il seed
    expect(req.task).toBe("seeding");
    expect(req.toolChoice).toBe("auto");
    expect(req.tools?.length ?? 0).toBeGreaterThan(0);
    expect(req.tools?.some((t) => t.name === "set_protagonist")).toBe(true);
    expect(req.tools?.some((t) => t.name === "build_node")).toBe(true);
  });

  it("lo scheletro resta interno: niente acronimo EAR, e l'istruzione di non nominarlo", () => {
    expect(req.system).not.toMatch(/\bEAR\b/);
    expect(req.system).toContain("non lo nomini MAI");
  });

  it("l'ultimo messaggio è il turno utente", () => {
    expect(req.messages[req.messages.length - 1]).toEqual({ role: "user", content: "ciao" });
  });

  it("seedStateSummary segnala 'manca' su seme incompleto e 'completo' su seme pieno", () => {
    expect(seedStateSummary(story())).toContain("manca:");
  });
});

describe("B6 · applySeedingTurn", () => {
  it("un tool_call applica il comando giusto sulla storia; il testo si accumula", () => {
    const events: StreamEvent[] = [
      { type: "text", delta: "Ok, " },
      { type: "text", delta: "fisso il protagonista. " },
      { type: "tool_call", call: { id: "1", name: "set_protagonist", arguments: { name: "Mia", age: 5 } } },
      DONE,
    ];
    const { story: after, replyText, applied, commandNames } = applySeedingTurn(story(), events);
    expect(after.seed.protagonist.name).toBe("Mia");
    expect(after.seed.protagonist.age).toBe(5);
    expect(applied.length).toBe(1);
    expect(commandNames).toContain("set_protagonist");
    expect(replyText).toContain("fisso il protagonista");
  });

  it("più tool_call in un turno si applicano in sequenza", () => {
    const events: StreamEvent[] = [
      { type: "tool_call", call: { id: "1", name: "set_protagonist", arguments: { name: "Pino", age: 4 } } },
      { type: "tool_call", call: { id: "2", name: "set_world", arguments: { world_flavor: "animali_del_bosco" } } },
    ];
    const { story: after, commandNames } = applySeedingTurn(story(), events);
    expect(after.seed.protagonist.name).toBe("Pino");
    expect(after.seed.world_flavor).toBe("animali_del_bosco");
    expect(commandNames).toEqual(["set_protagonist", "set_world"]);
  });

  it("solo tool_call senza testo → risposta sintetizzata (non vuota), senza acronimo EAR", () => {
    const events: StreamEvent[] = [
      { type: "tool_call", call: { id: "1", name: "set_world", arguments: { world_flavor: "spazio" } } },
    ];
    const { replyText } = applySeedingTurn(story(), events);
    expect(replyText.length).toBeGreaterThan(0);
    expect(replyText).not.toMatch(/\bEAR\b/);
  });
});
