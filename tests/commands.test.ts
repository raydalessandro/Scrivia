import { describe, it, expect } from "vitest";
import { executeCommand, validateSeed, toMcpTools, COMMANDS } from "@/lib/commands";
import type { Story, Seed } from "@/lib/types";

function emptySeed(): Seed {
  return {
    language: "it", title: "",
    protagonist: { name: "", age: null, kind: "" },
    companions: [], world_flavor: "", setting: { primary: "", notes: "" },
    theme: "", pugno: "", personal_detail: "", length_pages: 12, packs: [],
    spine: { premise: "", problem: "", threshold_moment: "", resolution_mode: "", closure: "" },
    voice: {}, nonce: null,
  };
}
function story(): Story {
  return { id: "t1", createdAt: "now", title: "x", stage: "seed", seed: emptySeed(), ledger: [] };
}

describe("validateSeed", () => {
  it("becca i campi mancanti", () => {
    const v = validateSeed(emptySeed());
    expect(v.errors.length).toBeGreaterThan(0);
  });
  it("seed completo → nessun errore", () => {
    const s = emptySeed();
    s.protagonist = { name: "Pino", age: 6, kind: "riccio" };
    s.world_flavor = "animali_del_bosco"; s.theme = "amicizia"; s.pugno = "...";
    s.spine.premise = "p"; s.spine.threshold_moment = "t";
    expect(validateSeed(s).errors).toHaveLength(0);
  });
  it("tema non mappato → avviso, non errore", () => {
    const s = emptySeed();
    s.protagonist = { name: "Pino", age: 6, kind: "" };
    s.world_flavor = "casa"; s.theme = "qualcosa_di_strano"; s.pugno = "...";
    s.spine.premise = "p"; s.spine.threshold_moment = "t";
    const v = validateSeed(s);
    expect(v.errors).toHaveLength(0);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
});

describe("executeCommand — unica fonte di verità", () => {
  it("muta lo stato e registra nel commandLog", () => {
    const r = executeCommand(story(), "set_protagonist", { name: "Lia", age: 5 });
    expect(r.story.seed.protagonist.name).toBe("Lia");
    expect(r.story.seed.protagonist.age).toBe(5);
    expect(r.story.commandLog?.at(-1)?.name).toBe("set_protagonist");
    expect(r.story.updatedAt).toBeTruthy();
  });
  it("set_theme deduce l'attributo via ontologia", () => {
    const r = executeCommand(story(), "set_theme", { theme: "perdita" });
    expect((r.data as any).attribute).toBe("cambiare");
  });
  it("comando puro: secondo giro dalla cache", () => {
    const s = executeCommand(story(), "set_pugno", { pugno: "x" }).story;
    const first = executeCommand(s, "validate_seed", {});
    const second = executeCommand(s, "validate_seed", {});
    expect(second.run.cached).toBe(true);
    expect(first.run.cached ?? false).toBe(false);
  });
  it("comando sconosciuto: non rompe, non muta", () => {
    const s = story();
    const r = executeCommand(s, "nope", {});
    expect(r.story).toBe(s);
  });
  it("build_node porta a stage manus con grafo + piano + prompt", () => {
    let s = story();
    s = executeCommand(s, "set_protagonist", { name: "Pino", age: 6 }).story;
    s = executeCommand(s, "set_world", { world_flavor: "animali_del_bosco" }).story;
    s = executeCommand(s, "set_theme", { theme: "amicizia" }).story;
    s = executeCommand(s, "set_pugno", { pugno: "..." }).story;
    s = executeCommand(s, "set_spine", { field: "premise", value: "p" }).story;
    s = executeCommand(s, "set_spine", { field: "threshold_moment", value: "t" }).story;
    const r = executeCommand(s, "build_node", { nonce: 70125 });
    expect(r.story.node).toBeTruthy();
    expect(r.story.pagePlan).toHaveLength(r.story.node!.pages);
    expect(r.story.manus?.length).toBe(r.story.node!.pages);
    expect(r.story.stage).toBe("manus");
  });
});

describe("toMcpTools — base della futura MCP", () => {
  it("ogni comando → tool con name/description/inputSchema", () => {
    const tools = toMcpTools();
    expect(tools.length).toBe(COMMANDS.length);
    for (const t of tools) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.inputSchema.type).toBe("object");
    }
  });
});
