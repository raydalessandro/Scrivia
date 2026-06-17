// @vitest-environment jsdom
//
// ModelPicker.test.tsx — §6.4 (smoke + interazione chiave).
// Render senza crash; cambiando provider/modello i livelli di reasoning
// disponibili si riallineano (clampReasoning) e la scelta persiste via
// setSelection. registry/config sono il sistema sotto test: NON mockati.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ModelPicker } from "../components/ai/ModelPicker";
import { getSelection } from "@/lib/ai/config";
import type { ResolvedSelection } from "@/lib/ai/types";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

// I tre <select> in ordine di DOM: Provider, Modello, Reasoning.
function selects(root: HTMLElement): HTMLSelectElement[] {
  return Array.from(root.querySelectorAll("select"));
}

describe("§6.4 ModelPicker", () => {
  it("monta sul default del task e mostra provider/modello/reasoning", () => {
    const { container } = render(<ModelPicker task="general" />);
    const [provider, model, reasoning] = selects(container);
    // default per 'general': anthropic / opus / medium (opus supporta 4 livelli)
    expect(provider.value).toBe("anthropic");
    expect(model.value).toBe("claude-opus-4-8");
    expect(reasoning.value).toBe("medium");
    expect(reasoning.disabled).toBe(false); // opus: off/low/medium/high → abilitato
  });

  it("cambiare provider → primo modello del provider e reasoning riallineato; persiste", () => {
    const changes: ResolvedSelection[] = [];
    const { container } = render(<ModelPicker task="general" onChange={(s) => changes.push(s)} />);
    const [provider] = selects(container);

    fireEvent.change(provider, { target: { value: "deepseek" } });

    const [p2, m2, r2] = selects(container);
    expect(p2.value).toBe("deepseek");
    expect(m2.value).toBe("deepseek-chat"); // primo modello del provider
    // deepseek-chat espone solo "off": il reasoning collassa e il select si disabilita
    expect(r2.value).toBe("off");
    expect(r2.disabled).toBe(true);

    // onChange notificato con la nuova selezione
    expect(changes.at(-1)).toEqual({ provider: "deepseek", model: "deepseek-chat", reasoning: "off" });
    // e la scelta è persistita (rileggibile da getSelection)
    expect(getSelection("general")).toEqual({ provider: "deepseek", model: "deepseek-chat", reasoning: "off" });
  });

  it("cambiare modello (stesso provider) aggiorna i reasoning disponibili", () => {
    const { container } = render(<ModelPicker task="general" />);
    const [, model] = selects(container);

    // opus (4 livelli) → haiku (solo "off")
    fireEvent.change(model, { target: { value: "claude-haiku-4-5" } });

    const [, m2, r2] = selects(container);
    expect(m2.value).toBe("claude-haiku-4-5");
    expect(r2.value).toBe("off");
    expect(r2.disabled).toBe(true);
    expect(getSelection("general")).toEqual({ provider: "anthropic", model: "claude-haiku-4-5", reasoning: "off" });
  });
});
