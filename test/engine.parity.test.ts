// engine.parity.test.ts — Suite di parità/invarianti del motore (= milestone M1).
// Esegui:  npx tsx test/engine.parity.test.ts
// Verifica: invarianti=0 su fuzz ampio, determinismo (stessa nonce → stesso nodo),
// e i 3 fix dei bug (attribute da theme, threshold alla soglia, register con varianza).
//
// È uno script self-contained (assert + exit code), adattabile al runner di Scrivia
// (vitest/jest) avvolgendo i blocchi in describe/it.

import { buildNode, extractHooks, checkNode, checkHooks } from "../lib/engine";
import type { Seed } from "../lib/types";
import canon from "../lib/canon.json";

import { describe, it, expect } from "vitest";

// Avvolto in describe/it per girare sotto `npm test` (Vitest). La logica e gli
// assert qui sotto sono IDENTICI allo script originale: solo l'esito finale
// (process.exit) è sostituito da expect(failures).toBe(0).
describe("engine — parità & invarianti (M1)", () => {
it("fuzz invarianti · determinismo · 3 fix (attribute/threshold/register)", () => {

let failures = 0;
const fail = (msg: string) => { console.error("  ✗ " + msg); failures++; };
const ok = (msg: string) => console.log("  ✓ " + msg);

// ---- generatore di Seed nella FORMA di Scrivia ----
const NAMES = ["Gabriel", "Elias", "Noah", "Mira", "Tobia", "Lena", "Cosmo", "Ada"];
const KINDS = ["bambino", "bambina", "volpe", "riccio", "gufo", "lupo", "tasso", "rana"];
const WORLDS = ["animali_del_bosco", "spazio", "sottomarino", "citta", "casa", "fiabesco"];
const SETTINGS = ["la radura", "il faro", "la tana sotto la quercia", "il molo", "la soffitta", "il fiume"];
const THEMES = Object.keys((canon as any).theme_to_attribute || {});
const TEMP = ["terrosa", "sospesa", "ironica", "tenera", "cantilenante"];

function makeSeed(i: number): Seed {
  const ages: (number | null)[] = [null, 3, 4, 5, 6];
  const hasComp = i % 4 !== 0;
  return {
    language: "it",
    title: `Storia ${i}`,
    protagonist: { name: NAMES[i % NAMES.length], age: ages[i % ages.length], kind: KINDS[i % KINDS.length] },
    companions: hasComp ? [{ name: NAMES[(i + 3) % NAMES.length], kind: KINDS[(i + 2) % KINDS.length] }] : [],
    world_flavor: WORLDS[i % WORLDS.length],
    setting: { primary: SETTINGS[i % SETTINGS.length], notes: "" },
    theme: THEMES[i % THEMES.length],
    pugno: "un'immagine che resta",
    personal_detail: "un dettaglio vero del mondo",
    length_pages: 8 + (i % 13), // 8..20, stressa min/max e la varietà hook
    packs: [],
    spine: {
      premise: "un protagonista nel suo posto",
      problem: "qualcosa rompe la quiete",
      threshold_moment: "il punto in cui sceglie",
      resolution_mode: "un gesto, non una spiegazione",
      closure: "resta un'immagine",
    },
    voice: i % 4 === 0 ? {} : { temperamento: TEMP[i % TEMP.length] },
    nonce: 100000 + i,
  };
}

// ---- 1) FUZZ invarianti ----
console.log("[1] Fuzz invarianti (buildNode → checkNode/checkHooks == 0)");
const N = 2500;
let nodeErr = 0, hookErr = 0, firstNode = "", firstHook = "";
for (let i = 0; i < N; i++) {
  const seed = makeSeed(i);
  const node = buildNode(seed);
  const en = checkNode(node);
  if (en.length) { nodeErr++; if (!firstNode) firstNode = `seed#${i}: ${en.join("; ")}`; }
  const hooks = extractHooks(node);
  const eh = checkHooks(hooks, node);
  if (eh.length) { hookErr++; if (!firstHook) firstHook = `seed#${i}: ${eh.join("; ")}`; }
}
if (nodeErr) fail(`checkNode: ${nodeErr}/${N} nodi con violazioni — ${firstNode}`); else ok(`checkNode: 0/${N}`);
if (hookErr) fail(`checkHooks: ${hookErr}/${N} hook con violazioni — ${firstHook}`); else ok(`checkHooks: 0/${N}`);

// ---- 2) Determinismo: stessa nonce → nodo identico ----
console.log("[2] Determinismo (stessa nonce → stesso nodo, voce compresa)");
let detErr = 0;
for (let i = 0; i < 200; i++) {
  const s = makeSeed(i * 7 + 1);
  const a = JSON.stringify(buildNode(s));
  const b = JSON.stringify(buildNode(s));
  if (a !== b) { detErr++; if (detErr === 1) console.error("    primo mismatch seed#" + (i * 7 + 1)); }
}
if (detErr) fail(`determinismo: ${detErr} nodi non riproducibili`); else ok("determinismo: 200/200 identici");

// ---- 3) FIX #1: attribute_dominant deriva dal theme (senza override) ----
console.log("[3] Fix attribute_dominant (segue theme, non più legato alla voce)");
{
  const t2a = (canon as any).theme_to_attribute as Record<string, string>;
  let bad = 0;
  for (const [theme, expected] of Object.entries(t2a)) {
    const s = makeSeed(1); s.theme = theme; s.voice = {}; // nessun override
    const n = buildNode(s);
    if (n.attribute_dominant !== expected) { bad++; console.error(`    theme=${theme} → ${n.attribute_dominant}, atteso ${expected}`); }
  }
  if (bad) fail(`attribute_dominant errato per ${bad} temi`); else ok(`attribute_dominant = theme_to_attribute per tutti i ${Object.keys(t2a).length} temi`);
}

// ---- 4) FIX #2: threshold_page coerente con la soglia (marker is_threshold) ----
console.log("[4] Fix threshold_page (coincide col marker di soglia degli hook)");
{
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const n = buildNode(makeSeed(i * 3 + 2));
    const hooks = extractHooks(n);
    const flagged = hooks.filter((h: any) => h.markers?.is_threshold).map((h: any) => h.page);
    const inRange = n.threshold_page >= 1 && n.threshold_page <= n.pages;
    const single = flagged.length === 1 && flagged[0] === n.threshold_page;
    if (!inRange || !single) { bad++; if (bad === 1) console.error(`    seed#${i * 3 + 2}: thr=${n.threshold_page}/${n.pages}, flagged=${JSON.stringify(flagged)}`); }
  }
  if (bad) fail(`threshold_page incoerente in ${bad} nodi`); else ok("threshold_page = unica pagina-soglia, in range (300/300)");
}

// ---- 5) FIX #3: register ha varianza (non sempre lo stesso) + sta negli enum ----
console.log("[5] Fix register (varianza tra storie, valori validi)");
{
  const seen = new Set<string>();
  const valid = new Set<string>((canon as any).register_keys || ["basso", "medio", "alto"]);
  let invalid = 0;
  for (let i = 0; i < 400; i++) {
    const n = buildNode(makeSeed(i * 5 + 3));
    seen.add(n.register);
    if (!valid.has(n.register)) invalid++;
  }
  if (invalid) fail(`register fuori enum in ${invalid} nodi`);
  else if (seen.size < 2) fail(`register senza varianza: solo {${[...seen].join(",")}}`);
  else ok(`register con varianza: {${[...seen].join(", ")}} su 400 storie`);
}

// ---- esito ----
console.log("");
expect(failures, "PARITÀ: blocchi falliti (vedi log sopra)").toBe(0);
console.log("✓ PARITÀ: tutti i blocchi superati (M1)");

});
});
