import { describe, it, expect } from "vitest";
import { PROVIDERS, getModel, clampReasoning } from "@/lib/ai/registry";
import { DEFAULT_SELECTION, getSelection } from "@/lib/ai/config";
import type { AITask } from "@/lib/ai/types";

describe("registry — capacità reasoning per modello", () => {
  it("ogni modello dichiara almeno un livello di reasoning", () => {
    for (const p of PROVIDERS) for (const m of p.models) {
      expect(m.reasoning.length).toBeGreaterThan(0);
    }
  });
});

describe("clampReasoning — riallinea al modello", () => {
  it("opus accetta high", () => {
    expect(clampReasoning("anthropic", "claude-opus-4-8", "high")).toBe("high");
  });
  it("haiku non ha effort → high ricade su off", () => {
    expect(clampReasoning("anthropic", "claude-haiku-4-5", "high")).toBe("off");
  });
  it("deepseek-chat → solo off", () => {
    expect(clampReasoning("deepseek", "deepseek-chat", "high")).toBe("off");
  });
  it("fable non ha off → off ricade su un livello attivo", () => {
    expect(clampReasoning("anthropic", "claude-fable-5", "off")).not.toBe("off");
  });
});

describe("config — defaults per fase coerenti col registry", () => {
  const tasks = Object.keys(DEFAULT_SELECTION) as AITask[];
  it("ogni default punta a un modello esistente con reasoning supportato", () => {
    for (const t of tasks) {
      const sel = DEFAULT_SELECTION[t];
      const m = getModel(sel.provider, sel.model);
      expect(m, `${t}: modello ${sel.model} inesistente`).toBeTruthy();
      expect(m!.reasoning).toContain(clampReasoning(sel.provider, sel.model, sel.reasoning));
    }
  });
  it("getSelection (in node, senza window) torna i default riallineati", () => {
    const sel = getSelection("prosa");
    expect(sel.provider).toBe(DEFAULT_SELECTION.prosa.provider);
    expect(sel.model).toBe(DEFAULT_SELECTION.prosa.model);
  });
});
