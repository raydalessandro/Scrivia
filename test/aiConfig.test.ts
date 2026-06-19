// @vitest-environment jsdom
//
// aiConfig.test.ts — il CONTRATTO della selezione per-task (lib/ai/config).
// Obiettivo dichiarato: `config` non deve mai bloccare la pipeline per un errore
// stupido. Quindi qui si blinda il *comportamento* (mai throw, sempre una
// selezione sensata), NON l'implementazione: questi test devono sopravvivere a
// una riscrittura più intelligente del file.
//
// I tre contratti di HARDENING ancora non garantiti sono lasciati come `it.todo`
// (la spec nel test). Oggi `getSelection` rivalida solo il `reasoning` (via
// clampReasoning), ma si fida ciecamente di `provider`+`model`: un modello
// rimosso dal registry, un override parziale o un task sconosciuto a runtime
// passano una selezione INVALIDA in silenzio. Fix lato backend (~3 righe):
// rivalidare la coppia provider/model contro il registry e, se assente,
// ricadere sul default del task. Quando il backend indurisce, i `todo` → verdi.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_SELECTION,
  getSelection,
  setSelection,
  resetSelection,
  withModel,
  withReasoning,
} from "@/lib/ai/config";

const KEY = "scrivia.ai.selection.v1";
beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("config — contratto di selezione (mai invalida, mai throw)", () => {
  it("senza override: torna i default di ogni task", () => {
    expect(getSelection("prosa")).toEqual({ provider: "anthropic", model: "claude-opus-4-8", reasoning: "high" });
    expect(getSelection("seeding")).toEqual({ provider: "anthropic", model: "claude-sonnet-4-6", reasoning: "medium" });
    expect(getSelection("title")).toEqual({ provider: "anthropic", model: "claude-haiku-4-5", reasoning: "off" });
  });

  it("storage corrotto (JSON malformato) → default, senza lanciare", () => {
    localStorage.setItem(KEY, "{non-è-json");
    expect(() => getSelection("prosa")).not.toThrow();
    expect(getSelection("prosa")).toEqual(DEFAULT_SELECTION.prosa);
  });

  it("override valido completo: rispettato e con reasoning clampato al modello", () => {
    // haiku espone solo "off": chiedere "high" deve collassare a "off"
    setSelection("prosa", { provider: "anthropic", model: "claude-haiku-4-5", reasoning: "high" });
    const sel = getSelection("prosa");
    expect(sel.provider).toBe("anthropic");
    expect(sel.model).toBe("claude-haiku-4-5");
    expect(sel.reasoning).toBe("off");
  });

  it("setSelection persiste e sopravvive a una 'ricarica' (rilettura dello storage)", () => {
    setSelection("seeding", { provider: "deepseek", model: "deepseek-reasoner", reasoning: "high" });
    // simula un nuovo avvio: lo stato vive solo in localStorage
    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(persisted.seeding).toMatchObject({ provider: "deepseek", model: "deepseek-reasoner" });
    expect(getSelection("seeding")).toMatchObject({ provider: "deepseek", model: "deepseek-reasoner" });
  });

  it("resetSelection(task) torna al default; resetSelection() pulisce tutto", () => {
    setSelection("prosa", { provider: "anthropic", model: "claude-haiku-4-5", reasoning: "off" });
    resetSelection("prosa");
    expect(getSelection("prosa")).toEqual(DEFAULT_SELECTION.prosa);

    setSelection("critic", { provider: "anthropic", model: "claude-sonnet-4-6", reasoning: "high" });
    resetSelection();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getSelection("critic")).toEqual(DEFAULT_SELECTION.critic);
  });

  it("withModel/withReasoning clampano sempre al modello scelto", () => {
    const base = DEFAULT_SELECTION.prosa; // opus/high
    const toHaiku = withModel(base, "anthropic", "claude-haiku-4-5");
    expect(toHaiku).toEqual({ provider: "anthropic", model: "claude-haiku-4-5", reasoning: "off" });
    // chiedere "high" su haiku → "off"
    expect(withReasoning(toHaiku, "high").reasoning).toBe("off");
    // su opus "low" resta "low"
    expect(withReasoning(base, "low").reasoning).toBe("low");
  });

  it("ORTOGONALITÀ per-task: sovrascrivere un task NON tocca gli altri", () => {
    const criticBefore = getSelection("critic");
    setSelection("prosa", { provider: "deepseek", model: "deepseek-chat", reasoning: "high" });
    expect(getSelection("critic")).toEqual(criticBefore);
    expect(getSelection("critic")).toEqual(DEFAULT_SELECTION.critic);
  });

  it("override parziale VALIDO (solo modello): eredita provider e reasoning dal default", () => {
    // strato relativo a livello di campo: { ...default, ...override } → clamp
    localStorage.setItem(KEY, JSON.stringify({ prosa: { model: "claude-sonnet-4-6" } }));
    expect(getSelection("prosa")).toEqual({ provider: "anthropic", model: "claude-sonnet-4-6", reasoning: "high" });
  });

  it("percorso server (window assente): getSelection=default; set/reset sono no-op senza lanciare", () => {
    setSelection("prosa", { provider: "deepseek", model: "deepseek-chat", reasoning: "off" });
    vi.stubGlobal("window", undefined);
    expect(getSelection("prosa")).toEqual(DEFAULT_SELECTION.prosa); // override non letti lato server
    expect(() => setSelection("prosa", DEFAULT_SELECTION.title)).not.toThrow();
    expect(() => resetSelection("prosa")).not.toThrow();
    expect(() => resetSelection()).not.toThrow();
  });

  // --- HARDENING (contratto-bersaglio per il backend; oggi NON garantito) -----
  // Quando il backend rivalida provider+model contro il registry, togliere
  // `.todo` e questi devono passare senza altre modifiche al test.
  it.todo("getSelection: un modello rimosso dal registry ricade sul default del task (oggi resta il modello morto)");
  it.todo("getSelection: un override parziale (solo provider) non produce una coppia provider/model incoerente (oggi sì)");
  it.todo("getSelection: un task sconosciuto a runtime non restituisce provider/model undefined (oggi sì)");
});
