// Motore deterministico — port TypeScript (in corso) di seme/scripts/build_node.py
// & extract_hooks.py & build_brief.py. La suite pytest in seme/tests/ resta il
// riferimento di parità. "La verità è nel grafo": nessun token, riproducibile.
//
// NB: questo è il primo strato del port. Campiona la grammatica dal nonce in modo
// deterministico (stessa nonce ⇒ stesso nodo). Le invarianti complete di Isola
// (copertura beat, varietà hook anti-monotonia) sono semplificate qui e vanno
// allineate al motore Python prima del passaggio in produzione.

import type { Seed, StoryNode, PagePlan, SeedEcho, BeatPlan } from "./types";
import { THEME_TO_ATTRIBUTE } from "./enums";

/** PRNG deterministico (mulberry32) seminato dal nonce. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];
function weighted<T>(r: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    if ((x -= w) <= 0) return v;
  }
  return items[items.length - 1][0];
}

export function newNonce(): number {
  return Math.floor(Math.random() * 100000);
}

export function buildNode(seed: Seed): StoryNode {
  const nonce = seed.nonce ?? newNonce();
  const r = rng(nonce);

  const age = seed.protagonist.age ?? 6;
  const attribute_dominant =
    seed.voice && THEME_TO_ATTRIBUTE[seed.theme]
      ? THEME_TO_ATTRIBUTE[seed.theme]
      : pick(r, ["distinguere", "connettere", "cambiare"]);

  const deployment_level = weighted(r, [
    ["triadico", 3],
    ["mono", 2],
  ]);
  const ear_arc =
    deployment_level === "triadico"
      ? ["distinguere", "connettere", "cambiare"]
      : [attribute_dominant];

  const entry_point_type = pick(r, ["A", "B", "C", "D", "E", "F"]);
  const closure_type = weighted(r, [
    [1, 1], [2, 3], [3, 3], [4, 2], [5, 2], [6, 1], [7, 4],
  ]);
  const register =
    age <= 5 ? "basso" : age <= 8 ? "medio" : "alto";
  const register_range: [number, number] =
    register === "basso" ? [0.2, 0.4] : register === "medio" ? [0.4, 0.6] : [0.6, 0.8];
  const time_span_arc = pick(
    r,
    attribute_dominant === "cambiare"
      ? ["un_pomeriggio", "un_giorno", "piu_giorni", "una_stagione"]
      : ["un_pomeriggio", "un_giorno", "piu_giorni"]
  );

  const pages = seed.length_pages || 12;
  const threshold_page = Math.max(2, Math.round(pages * 0.75));
  const estimated_words = Math.round(pages * 73);

  // Piano beat: apertura · arco EAR distribuito · chiusura.
  const beat_plan: BeatPlan[] = [];
  beat_plan.push({ beat: "apertura", pages: [1, 1] });
  const mid = ear_arc.length === 3 ? ear_arc : ["distinguere", attribute_dominant, "cambiare"];
  const span = pages - 2; // tra apertura e chiusura
  let cur = 2;
  mid.forEach((b, i) => {
    const len = Math.max(1, Math.round(span / mid.length) + (i === 1 ? 1 : 0));
    const end = Math.min(pages - 1, cur + len - 1);
    beat_plan.push({ beat: b, pages: [cur, end] });
    cur = end + 1;
  });
  beat_plan.push({ beat: "chiusura", pages: [pages, pages] });

  const seeds: SeedEcho[] = [
    { id: "seed_01", kind: "dettaglio_del_mondo", what: seed.personal_detail || "[un dettaglio del mondo]", planted_page: 4, payoff_page: pages - 1 },
    { id: "seed_02", kind: "gesto", what: "[un gesto che torna trasformato]", planted_page: 2, payoff_page: threshold_page },
  ];

  return {
    id: "s01",
    title: seed.title || `${seed.protagonist.name} — storia`,
    attribute_dominant,
    deployment_level,
    ear_arc,
    premise: seed.spine.premise,
    problem: seed.spine.problem,
    threshold_moment: seed.spine.threshold_moment,
    threshold_page,
    resolution_mode: seed.spine.resolution_mode,
    entry_point_type,
    closure_type,
    register,
    register_range,
    time_span_arc,
    pages,
    estimated_words,
    world_flavor: seed.world_flavor,
    setting_primary: seed.setting.primary || "[il luogo]",
    season: pick(r, ["primavera", "estate", "autunno", "inverno"]),
    palette_emotiva: `pugno ${register}`,
    protagonist: { ...seed.protagonist, age, kind: seed.protagonist.kind || "bambino" },
    companions: seed.companions.filter((c) => c.name),
    beat_plan,
    seeds,
    pugno: seed.pugno,
    personal_detail: seed.personal_detail,
    seed_nonce: nonce,
  };
}

const HOOK_CYCLE = ["panorama", "azione", "dettaglio", "interno", "transizione"];
export function buildPagePlan(node: StoryNode): PagePlan[] {
  const plan: PagePlan[] = [];
  for (let p = 1; p <= node.pages; p++) {
    const bp = node.beat_plan.find((b) => p >= b.pages[0] && p <= b.pages[1]);
    plan.push({
      page: p,
      beat: bp?.beat ?? "—",
      hook: HOOK_CYCLE[(p - 1) % HOOK_CYCLE.length],
      zone: "—",
      note:
        p === 1
          ? `[APERTURA ${node.entry_point_type}]`
          : p === node.threshold_page
          ? "[SOGLIA]"
          : p === node.pages
          ? `[CHIUSURA ${node.closure_type}]`
          : "",
    });
  }
  return plan;
}
