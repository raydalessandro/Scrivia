import { seedFromGame } from "../lib/seedFromGame";
import { buildNode, buildPagePlan, checkNode, checkHooks } from "../lib/engine";
import type { GameState } from "../components/phases/SeedingGame";
import type { Hook, SeedExt } from "../lib/engineTypes";

import { describe, it, expect } from "vitest";

declare const process: { exit(code?: number): never };

// Avvolto in describe/it (Vitest). Logica e assert IDENTICI allo script originale;
// l'uscita finale è sostituita da expect(bad).toBe(0).
describe("seedFromGame — mapping gioco → Seed (B3)", () => {
it("voce a-orecchio · cast · override riflessi · ref-mode", () => {
let bad = 0;
const ok = (m: string) => console.log("  ✓ " + m);
const ko = (m: string) => { console.error("  ✗ " + m); bad++; };

// GameState rappresentativo: voce "a orecchio" (assi risolti, con chiave di gioco `lente`),
// cast = protagonista + comprimario con archetipo/stress/ritmo/never.
const game: GameState = {
  brain: "un riccio appena trasferito che non sa farsi un amico",
  name: "Bruno", age: 4, kind: "riccio",
  world: "animali_del_bosco", setting: "il bosco dietro la casa nuova",
  move: "avvicinarsi", theme: "amicizia", themeFree: "",
  pugno: "vorrebbe un amico ma si nasconde", detail: "ha un sasso in tasca",
  hasSage: true,
  spine: { premise: "Bruno arriva nel bosco con uno scatolone", problem: "vuole avvicinarsi ma si nasconde", threshold: "lascia lo scatolone aperto sul sentiero e si allontana di un passo", resolution: "un altro cucciolo ci mette accanto una sua cosa", closure: "" },
  entry: "B", closure_type: 2, arc: "un_giorno",
  voiceMode: "ear", refs: {}, refUnique: "", voicePicks: ["a", "b", "a"],
  voice: { temperamento: "terrosa", ritmo: "corte_secche", distanza: "sguardo_da_lontano", lente: "odore_sapore" },
  cast: [
    { id: "prot", role: "protagonista", name: "Bruno", dom: "il timido", stress: "il ribelle", ritmo: "corto e secco", words: "", never: "una bugia" },
    { id: "c1", role: "comprimario", name: "Lea", dom: "la saggia", stress: "", ritmo: "lento", words: "dice «vedrai»", never: "una parolaccia" },
  ],
};

const seed = seedFromGame(game) as SeedExt;

// 1) mappatura spina
(seed.spine.threshold_moment.includes("scatolone") && seed.spine.resolution_mode.includes("cucciolo")) ? ok("spina: threshold→threshold_moment, resolution→resolution_mode") : ko("spina non mappata");

// 2) overrides
seed.overrides?.attribute_dominant === "connettere" ? ok("move 'avvicinarsi' → overrides.attribute_dominant = connettere") : ko(`attribute_dominant inatteso: ${seed.overrides?.attribute_dominant}`);
(seed.overrides?.entry_point_type === "B" && seed.overrides?.closure_type === 2 && seed.overrides?.time_span_arc === "un_giorno" && seed.overrides?.register === "basso") ? ok("overrides entry/closure/arc/register") : ko(`overrides inattesi: ${JSON.stringify(seed.overrides)}`);
seed.has_sage_figure === true ? ok("has_sage_figure = true") : ko("has_sage_figure non propagato");

// 3) voce: remap lente→lente_sensoriale, niente chiave `lente`
const vk = Object.keys(seed.voice);
(seed.voice.lente_sensoriale === "odore_sapore" && !("lente" in seed.voice) && vk.every((k) => ["temperamento", "ritmo", "distanza", "lente_sensoriale", "umorismo"].includes(k)))
  ? ok(`voce remappata: ${vk.join(", ")}`) : ko(`voce non remappata: ${JSON.stringify(seed.voice)}`);

// 4) companions kind="" + characterVoices (incl. protagonista)
(seed.companions.length === 1 && seed.companions[0].name === "Lea" && seed.companions[0].kind === "") ? ok("companions: Lea, kind=\"\" (aspetto al Passo 0)") : ko(`companions inattesi: ${JSON.stringify(seed.companions)}`);
const cv = seed.characterVoices || [];
(cv.length === 2 && cv.find((c) => c.role === "protagonista")?.never === "una bugia" && cv.find((c) => c.name === "Lea")?.archetype === "la saggia")
  ? ok(`characterVoices: ${cv.map((c) => `${c.name}(${c.archetype})`).join(", ")}`) : ko(`characterVoices inattese: ${JSON.stringify(cv)}`);

// 5) narratorBrief non vuoto
(seed.narratorBrief && seed.narratorBrief.length > 0) ? ok(`narratorBrief: "${seed.narratorBrief}"`) : ko("narratorBrief vuoto");

// 6) il Seed prodotto è VALIDO per il motore
const node = buildNode(seed);
const hooks = buildPagePlan(node) as Hook[];
const en = checkNode(node), eh = checkHooks(hooks, node);
(en.length === 0 && eh.length === 0) ? ok(`Seed valido: buildNode + checkNode(${en.length}) + checkHooks(${eh.length}) = 0`) : ko(`motore: node[${en.join("; ")}] hooks[${eh.join("; ")}]`);
// gli override si riflettono nel nodo?
(node.attribute_dominant === "connettere" && node.time_span_arc === "un_giorno" && node.entry_point_type === "B" && node.closure_type === 2)
  ? ok("override riflessi nel nodo (attribute/arc/entry/closure)") : ko(`nodo non riflette override: attr=${node.attribute_dominant} arc=${node.time_span_arc} entry=${node.entry_point_type} closure=${node.closure_type}`);

// 7) modalità "ref": narratorBrief = ricetta autori/faccette
const refGame: GameState = { ...game, voiceMode: "ref", voice: {}, refs: { Calvino: ["struttura"], Collodi: ["lingua"] }, refUnique: "ogni capitolo finisce con una domanda" };
const refSeed = seedFromGame(refGame);
(refSeed.narratorBrief?.includes("Calvino/struttura") && refSeed.narratorBrief?.includes("segno:") && Object.keys(refSeed.voice).length === 0)
  ? ok(`ref-mode: narratorBrief="${refSeed.narratorBrief}", voice vuota (motore campiona)`) : ko(`ref-mode inatteso: brief=${refSeed.narratorBrief} voice=${JSON.stringify(refSeed.voice)}`);

console.log("");
expect(bad, "B3 smoke: controlli falliti (vedi log sopra)").toBe(0);
console.log("✓ B3 smoke: seedFromGame mappa correttamente e produce un Seed valido per il motore");

});
});
