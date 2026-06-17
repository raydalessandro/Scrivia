// commands.test.ts — Registry comandi (§3 della TEST_SPEC).
// Contratto: unica fonte di verità; ogni mutazione passa da executeCommand,
// produce una nuova Story e registra in commandLog; i comandi `pure` usano la
// cache; build_node è "il click" che porta a stage:"manus".
//
// environment: node (logica TS pura). Niente rete, niente store/localStorage:
// le Story sono costruite in-place per isolare il contratto del registry.

import { describe, it, expect } from "vitest";
import type { Story, Seed } from "@/lib/types";
import {
  COMMANDS,
  COMMAND_BY_NAME,
  executeCommand,
  validateSeed,
  toMcpTools,
} from "@/lib/commands";
import { THEME_TO_ATTRIBUTE } from "@/lib/enums";

// ---- factory locali (id univoco: la cache dei comandi puri è globale al modulo) ----
let uid = 0;
const nextId = () => `st-${++uid}`;

function makeSeed(over: Partial<Seed> = {}): Seed {
  return {
    language: "it",
    title: "La radura",
    protagonist: { name: "Gabriel", age: 5, kind: "volpe" },
    companions: [{ name: "Noah", kind: "riccio" }],
    world_flavor: "animali_del_bosco",
    setting: { primary: "la radura sotto la quercia", notes: "" },
    theme: "amicizia",
    pugno: "un'immagine che resta",
    personal_detail: "un sasso liscio in tasca",
    length_pages: 12,
    packs: [],
    spine: {
      premise: "un protagonista nel suo posto",
      problem: "qualcosa rompe la quiete",
      threshold_moment: "il punto in cui sceglie",
      resolution_mode: "un gesto, non una spiegazione",
      closure: "resta un'immagine",
    },
    voice: {},
    nonce: null,
    ...over,
  };
}

function makeStory(seedOver: Partial<Seed> = {}, storyOver: Partial<Story> = {}): Story {
  return {
    id: nextId(),
    createdAt: "2020-01-01T00:00:00.000Z",
    title: "La radura",
    stage: "seed",
    seed: makeSeed(seedOver),
    ledger: [],
    ...storyOver,
  };
}

const isISO = (s: unknown): boolean =>
  typeof s === "string" && !Number.isNaN(Date.parse(s));

// ======================================================================
describe("§3 commands — registry", () => {
  // ---- 3.1 validateSeed ------------------------------------------------
  describe("3.1 validateSeed", () => {
    it("seed vuoto → errori sui campi mancanti", () => {
      const empty: Seed = makeSeed({
        protagonist: { name: "", age: null, kind: "" },
        world_flavor: "",
        theme: "",
        pugno: "",
        spine: { premise: "", problem: "", threshold_moment: "", resolution_mode: "", closure: "" },
      });
      const { errors } = validateSeed(empty);
      const joined = errors.join(" | ");
      expect(errors.length).toBeGreaterThan(0);
      expect(joined).toContain("nome del protagonista");
      expect(joined).toContain("età");
      expect(joined).toContain("mondo");
      expect(joined).toContain("tema");
      expect(joined).toContain("pugno");
      expect(joined.toLowerCase()).toContain("spina");
    });

    it("seed completo → 0 errori", () => {
      expect(validateSeed(makeSeed()).errors).toEqual([]);
    });

    it("tema non mappato → warning (NON errore)", () => {
      const v = validateSeed(makeSeed({ theme: "vendetta" }));
      expect(v.errors).toEqual([]); // il tema c'è: nessun errore
      expect(v.warnings.join(" ")).toContain("vendetta");
      expect(v.warnings.join(" ").toLowerCase()).toContain("non mappato");
    });
  });

  // ---- 3.2 ogni mutazione applica il delta giusto + setta updatedAt ----
  describe("3.2 mutazioni: delta corretto + updatedAt", () => {
    // tabella per-comando: ogni voce verifica il proprio delta sulla nuova Story.
    const cases: { name: string; params: Record<string, any>; check: (s: Story) => void }[] = [
      { name: "set_title", params: { title: "Nuovo Titolo" }, check: (s) => {
          expect(s.seed.title).toBe("Nuovo Titolo");
          expect(s.title).toBe("Nuovo Titolo");
        } },
      { name: "set_protagonist", params: { name: "Mira", age: 7, kind: "gufo" }, check: (s) => {
          expect(s.seed.protagonist).toMatchObject({ name: "Mira", age: 7, kind: "gufo" });
        } },
      { name: "add_companion", params: { name: "Tobia", kind: "tasso" }, check: (s) => {
          expect(s.seed.companions.map((c) => c.name)).toContain("Tobia");
        } },
      { name: "update_companion", params: { name: "Noah", newName: "Nina", kind: "rana" }, check: (s) => {
          const c = s.seed.companions.find((x) => x.name === "Nina");
          expect(c).toBeTruthy();
          expect(c!.kind).toBe("rana");
          expect(s.seed.companions.some((x) => x.name === "Noah")).toBe(false);
        } },
      { name: "remove_companion", params: { name: "Noah" }, check: (s) => {
          expect(s.seed.companions.some((x) => x.name === "Noah")).toBe(false);
        } },
      { name: "set_world", params: { world_flavor: "Animali Del Bosco" }, check: (s) => {
          // normalizza: minuscolo + spazi→_
          expect(s.seed.world_flavor).toBe("animali_del_bosco");
        } },
      { name: "set_setting", params: { primary: "il faro", notes: "appena trasferiti" }, check: (s) => {
          expect(s.seed.setting).toMatchObject({ primary: "il faro", notes: "appena trasferiti" });
        } },
      { name: "set_theme", params: { theme: "Perdita" }, check: (s) => {
          expect(s.seed.theme).toBe("perdita"); // lowercase+trim
        } },
      { name: "set_pugno", params: { pugno: "il sasso resta sul tronco" }, check: (s) => {
          expect(s.seed.pugno).toBe("il sasso resta sul tronco");
        } },
      { name: "set_personal_detail", params: { detail: "conta sempre i gradini" }, check: (s) => {
          expect(s.seed.personal_detail).toBe("conta sempre i gradini");
        } },
      { name: "set_length", params: { pages: 99 }, check: (s) => {
          expect(s.seed.length_pages).toBe(20); // clamp a [10,20]
        } },
      { name: "set_length", params: { pages: 3 }, check: (s) => {
          expect(s.seed.length_pages).toBe(10); // clamp a [10,20]
        } },
      { name: "set_intake_notes", params: { notes: "tutto il contesto qui" }, check: (s) => {
          expect(s.intakeNotes).toBe("tutto il contesto qui");
        } },
      { name: "set_spine", params: { field: "problem", value: "il bosco non lo conosce" }, check: (s) => {
          expect(s.seed.spine.problem).toBe("il bosco non lo conosce");
        } },
      { name: "set_voice_axis", params: { axis: "temperamento", value: "terrosa" }, check: (s) => {
          expect((s.seed.voice as any).temperamento).toBe("terrosa");
        } },
    ];

    for (const c of cases) {
      it(`${c.name}(${JSON.stringify(c.params)}) applica il delta e setta updatedAt`, () => {
        const story = makeStory();
        const before = story.updatedAt; // baseline (vecchio timestamp del costruttore? no: undefined)
        const { story: next } = executeCommand(story, c.name, c.params);
        // delta:
        c.check(next);
        // updatedAt: presente, ISO, e cambiato rispetto alla baseline
        expect(isISO(next.updatedAt)).toBe(true);
        expect(next.updatedAt).not.toBe(before);
        // immutabilità: la Story originale non è stata toccata
        expect(story.updatedAt).toBe(before);
      });
    }
  });

  // ---- 3.3 commandLog: solo per le mutazioni --------------------------
  describe("3.3 commandLog", () => {
    it("una mutazione registra { name, by, summary } nel log", () => {
      const story = makeStory();
      const { story: next, run } = executeCommand(story, "set_pugno", { pugno: "x" }, "claude");
      expect(next.commandLog).toHaveLength(1);
      expect(next.commandLog![0]).toMatchObject({ name: "set_pugno", by: "claude" });
      expect(typeof next.commandLog![0].summary).toBe("string");
      expect(run.name).toBe("set_pugno");
    });

    it("un comando puro NON registra nel log (nessuna mutazione)", () => {
      const story = makeStory();
      const { story: next } = executeCommand(story, "validate_seed");
      expect(next.commandLog ?? []).toEqual([]);
    });

    it("log cumulativo su mutazioni successive", () => {
      let s = makeStory();
      s = executeCommand(s, "set_pugno", { pugno: "a" }).story;
      s = executeCommand(s, "set_title", { title: "b" }).story;
      expect(s.commandLog).toHaveLength(2);
      expect(s.commandLog!.map((r) => r.name)).toEqual(["set_pugno", "set_title"]);
    });
  });

  // ---- 3.4 set_theme deduce l'attributo (data.attribute) --------------
  it("3.4 set_theme deduce l'attributo via ontologia (data.attribute)", () => {
    const story = makeStory();
    const { story: next, data } = executeCommand(story, "set_theme", { theme: "Paura" });
    expect(next.seed.theme).toBe("paura");
    expect((data as any).attribute).toBe(THEME_TO_ATTRIBUTE["paura"]); // distinguere
    // tema non mappato → attribute undefined, ma nessun crash
    const r2 = executeCommand(makeStory(), "set_theme", { theme: "vendetta" });
    expect((r2.data as any).attribute).toBeUndefined();
  });

  // ---- 3.5 comando puro: 2ª chiamata cached:true + invalidazione ------
  it("3.5 comando puro: cache hit alla 2ª chiamata, invalidato dalla mutazione", () => {
    const story = makeStory();
    const a = executeCommand(story, "validate_seed");
    expect(a.run.cached).toBe(false); // miss
    const b = executeCommand(story, "validate_seed"); // stessa Story → stessa chiave
    expect(b.run.cached).toBe(true); // hit
    // mutazione → updatedAt cambia e invalidate(story.id): ricalcolo
    const mutated = executeCommand(story, "set_pugno", { pugno: "nuovo" }).story;
    const c = executeCommand(mutated, "validate_seed");
    expect(c.run.cached).toBe(false); // miss di nuovo
  });

  // ---- 3.6 comando sconosciuto → no-op (stessa Story, niente log) -----
  it("3.6 comando sconosciuto → no-op (stessa Story, nessun log)", () => {
    const story = makeStory();
    const { story: next, run } = executeCommand(story, "comando_inesistente", { x: 1 });
    expect(next).toBe(story); // stessa identità: nessuna mutazione
    expect(next.commandLog ?? []).toEqual([]);
    expect(run.summary.toLowerCase()).toContain("sconosciuto");
  });

  // ---- 3.7 build_node end-to-end --------------------------------------
  it("3.7 build_node: node + pagePlan + entities(3) + manus veri; stage manus; nonce → riproducibile", () => {
    const story = makeStory(); // 1 protagonista + 1 comprimario → 3 entità (con il luogo)
    const { story: built } = executeCommand(story, "build_node", { nonce: 12345 });

    expect(built.node).toBeTruthy();
    expect(built.stage).toBe("manus");
    expect(built.node!.seed_nonce).toBe(12345);
    // pagePlan: un piano per pagina
    expect(Array.isArray(built.pagePlan)).toBe(true);
    expect(built.pagePlan!.length).toBe(built.node!.pages);
    // entità: protagonista + comprimario + luogo = 3
    expect(built.entities).toHaveLength(3);
    const kinds = built.entities!.map((e) => e.kind).sort();
    expect(kinds).toEqual(["character", "character", "location"]);
    // manus: prompt-pagina veri, uno per pagina
    expect(Array.isArray(built.manus)).toBe(true);
    expect(built.manus!.length).toBe(built.node!.pages);
    expect(built.manus![0]).toHaveProperty("storyMoment");

    // riproducibilità: stesso seed+nonce → stesso node, stesse entità.id, stessi manus
    const again = executeCommand(makeStory(), "build_node", { nonce: 12345 });
    expect(JSON.stringify(again.story.node)).toBe(JSON.stringify(built.node));
    expect(again.story.entities!.map((e) => e.id)).toEqual(built.entities!.map((e) => e.id));
    expect(JSON.stringify(again.story.manus)).toBe(JSON.stringify(built.manus));

    // nonce diverso → nodo (in genere) diverso, ma sempre valido
    const other = executeCommand(makeStory(), "build_node", { nonce: 999 });
    expect(other.story.node!.seed_nonce).toBe(999);
  });

  // ---- 3.8 set_intake_notes ------------------------------------------
  it("3.8 set_intake_notes salva intakeNotes", () => {
    const story = makeStory();
    const { story: next } = executeCommand(story, "set_intake_notes", { notes: "appunti liberi dell'intake" });
    expect(next.intakeNotes).toBe("appunti liberi dell'intake");
  });

  // ---- 3.9 toMcpTools -------------------------------------------------
  describe("3.9 toMcpTools", () => {
    const tools = toMcpTools();

    it("un tool per comando, con name/description/inputSchema(type:object)", () => {
      expect(tools).toHaveLength(COMMANDS.length);
      for (const t of tools) {
        expect(typeof t.name).toBe("string");
        expect(typeof t.description).toBe("string");
        expect(t.inputSchema.type).toBe("object");
        expect(typeof t.inputSchema.properties).toBe("object");
        expect(Array.isArray(t.inputSchema.required)).toBe(true);
      }
      // i nomi dei tool combaciano con i comandi
      expect(tools.map((t) => t.name).sort()).toEqual(COMMANDS.map((c) => c.name).sort());
    });

    it("required = solo i parametri obbligatori; type number/enum mappati", () => {
      const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
      // set_title: title obbligatorio
      expect(byName["set_title"].inputSchema.required).toEqual(["title"]);
      // validate_seed: nessun parametro → required vuoto
      expect(byName["validate_seed"].inputSchema.required).toEqual([]);
      // set_length: pages è number
      expect((byName["set_length"].inputSchema.properties as any).pages.type).toBe("number");
      // set_world: world_flavor è enum → type string + lista enum
      const wf = (byName["set_world"].inputSchema.properties as any).world_flavor;
      expect(wf.type).toBe("string");
      expect(Array.isArray(wf.enum)).toBe(true);
      expect(wf.enum.length).toBeGreaterThan(0);
    });
  });

  // ---- 3.10 set_spine con field fuori enum → no-op chiaro -------------
  it("3.10 set_spine con field fuori enum → no-op con summary chiaro", () => {
    const story = makeStory();
    const { story: next, run } = executeCommand(story, "set_spine", { field: "banana", value: "x" });
    expect(next).toBe(story); // nessuna mutazione
    expect(next.commandLog ?? []).toEqual([]);
    expect(run.summary.toLowerCase()).toContain("sconosciuto");
    // il campo valido invece muta
    const okRun = executeCommand(makeStory(), "set_spine", { field: "premise", value: "nuova premessa" });
    expect(okRun.story.seed.spine.premise).toBe("nuova premessa");
  });

  // ---- sanity: il registry è coerente --------------------------------
  it("ogni comando ha name unico ed è raggiungibile via COMMAND_BY_NAME", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of COMMANDS) expect(COMMAND_BY_NAME[c.name]).toBe(c);
  });
});
