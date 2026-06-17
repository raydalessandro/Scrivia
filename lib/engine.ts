// engine.ts — Motore deterministico di Scrivia (buildNode + extractHooks),
// voce frattale (resolveVoice), invarianti (checkNode/checkHooks) e hook completi (F1.1).
// Parità di CONTRATTO col Python; legge lo stesso canone (canon.json).
// Sostituisce il vecchio engine.ts: fixa i 3 bug (attribute_dominant, threshold_page, register)
// e arricchisce gli hook. Tipizzato su Seed/StoryNode di Scrivia; estensioni in engineTypes.ts.

import type { Seed, StoryNode, PagePlan } from "./types";
import type {
  SeedExt, StoryNodeExt, Hook, CharRef, NodeVoice, Debt, RecurringImage,
} from "./engineTypes";

// ---------- Canone condiviso (dati, fonte unica) ----------
// Import statico JSON: nel browser/Next.js il canone viene impacchettato nel bundle
// (richiede "resolveJsonModule": true, attivo di default in Next.js). NIENTE fs.
import canonData from "./canon.json";
const canon: any = canonData as any;
const C = {
  attribute_dominant: canon.attribute_dominant as string[],
  deployment_level: canon.deployment_level as string[],
  entry_keys: Object.keys(canon.entry_point_type),
  closure_keys: Object.keys(canon.closure_type).map(Number),
  register: canon.register as Record<string, [number, number]>,
  register_keys: Object.keys(canon.register),
  time_span_arc: canon.time_span_arc as string[],
  pages_min: canon.story.pages_min, pages_max: canon.story.pages_max,
  pages_default: canon.story.pages_default, words_per_page_avg: canon.story.words_per_page_avg,
  theme_to_attribute: canon.theme_to_attribute as Record<string, string>,
  closure_weights: canon.closure_weights as Record<string, number>,
  age_to_register: canon.age_to_register as Record<string, string>,
  seeds: canon.seeds, debt: canon.debt, recurring: canon.recurring_image,
  hooks: canon.hooks, voice: canon.voice,
};

// ---------- PRNG deterministico (mulberry32) + helper ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class RNG {
  r: () => number;
  constructor(seed: number) { this.r = mulberry32(seed >>> 0); }
  random() { return this.r(); }
  randint(a: number, b: number) { return a + Math.floor(this.r() * (b - a + 1)); }
  uniform(a: number, b: number) { return a + this.r() * (b - a); }
  choice<T>(arr: T[]): T { return arr[Math.floor(this.r() * arr.length)]; }
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  sample<T>(arr: T[], k: number): T[] { return this.shuffle(arr).slice(0, k); }
  wchoice(weights: Record<string, number>): string {
    const items = Object.entries(weights).filter(([, w]) => w > 0);
    const tot = items.reduce((s, [, w]) => s + w, 0);
    let x = this.r() * tot;
    for (const [k, w] of items) { if ((x -= w) <= 0) return k; }
    return items[items.length - 1][0];
  }
}
const range = (a: number, b: number) => { const o: number[] = []; for (let i = a; i <= b; i++) o.push(i); return o; };

// ================= build_node =================
const SEASONS = ["inverno", "primavera", "estate", "autunno"];
const SEASON_PALETTE: Record<string, string> = {
  inverno: "bianchi e azzurri freddi, luce bassa e netta",
  primavera: "verdi teneri e gialli, luce nuova e mobile",
  estate: "ori caldi e ombre piene, luce alta",
  autunno: "rossi, bruni e grigi, luce obliqua che si abbassa",
};
function ageBand(age: any): string {
  const a = Number(age);
  if (!Number.isFinite(a)) return "6-8";
  if (a <= 5) return "0-5"; if (a <= 8) return "6-8"; return "9-12";
}
function neighborRegister(rng: RNG, band: string, p = 0.30): string {
  const order = ["basso", "medio", "alto"]; let i = order.indexOf(band); if (i < 0) i = 1;
  if (rng.random() < p) i = Math.max(0, Math.min(2, i + rng.choice([-1, 1])));
  return order[i];
}
function distributePages(rng: RNG, totalMid: number, beats: string[], dominant: string): Record<string, number> {
  if (!beats.length) return {};
  const w: Record<string, number> = {}; beats.forEach((b) => (w[b] = b === dominant ? 2 : 1));
  const s = Object.values(w).reduce((a, b) => a + b, 0);
  const raw: Record<string, number> = {}; beats.forEach((b) => (raw[b] = Math.max(1, Math.round((totalMid * w[b]) / s))));
  let diff = totalMid - Object.values(raw).reduce((a, b) => a + b, 0);
  const keys = Object.keys(raw);
  while (diff !== 0 && keys.length) {
    const k = rng.choice(keys);
    if (diff > 0) { raw[k]++; diff--; } else if (raw[k] > 1) { raw[k]--; diff++; } else break;
  }
  return raw;
}

export function buildNode(seedIn: Seed): StoryNodeExt {
  const seed = seedIn as SeedExt;
  const ov = seed.overrides || {};
  let nonce: number | null | undefined = seed.nonce;
  if (nonce == null) nonce = Math.floor(Math.random() * 2 ** 31) + 1;
  const rng = new RNG(nonce >>> 0);

  let pages = Number(seed.length_pages || C.pages_default);
  pages = Math.max(C.pages_min, Math.min(C.pages_max, pages));
  const estWords = Math.floor(pages * C.words_per_page_avg * rng.uniform(0.9, 1.1));

  const theme = (seed.theme || "").trim().toLowerCase();
  const attribute = ov.attribute_dominant || C.theme_to_attribute[theme] || rng.choice(C.attribute_dominant);
  let deployment: string;
  if (ov.deployment_level) deployment = ov.deployment_level;
  else { const pMono = pages <= 12 ? 0.6 : 0.35; deployment = rng.random() < pMono ? "mono" : "triadico"; }
  const ear_arc = deployment === "triadico" ? ["distinguere", "connettere", "cambiare"] : [attribute];

  const band = ageBand((seed.protagonist || {}).age);
  const entryBias: Record<string, Record<string, number>> = {
    "0-5": { A: 3, C: 3, F: 3, B: 1, D: 1, E: 1 },
    "6-8": { A: 2, B: 2, C: 2, D: 2, E: 2, F: 2 },
    "9-12": { B: 3, D: 3, E: 3, A: 1, C: 1, F: 1 },
  };
  const entry = ov.entry_point_type || rng.wchoice(entryBias[band]);

  const cw: Record<string, number> = { ...C.closure_weights };
  if (!seed.has_sage_figure) cw["1"] = 0;
  const closure = Number(ov.closure_type ?? rng.wchoice(cw));

  let register: string;
  if (ov.register) register = ov.register;
  else register = neighborRegister(rng, C.age_to_register[band] || "medio");
  const reg_range = C.register[register];

  let time_span: string;
  if (ov.time_span_arc) time_span = ov.time_span_arc;
  else if (attribute === "cambiare" || ["crescere", "cambiamento", "passaggio", "perdita"].includes(theme))
    time_span = rng.wchoice({ un_giorno: 3, piu_giorni: 2, una_stagione: 2, un_pomeriggio: 1 });
  else time_span = rng.wchoice({ un_pomeriggio: 3, un_giorno: 3, piu_giorni: 1 });

  const season = seed.season || rng.choice(SEASONS);
  const palette = `${SEASON_PALETTE[season]} — pugno ${register}`;

  const openPages = pages <= 12 ? 1 : rng.choice([1, 2]);
  const closePages = pages <= 12 ? 1 : rng.choice([1, 2]);
  let mid = pages - openPages - closePages; mid = Math.max(ear_arc.length, mid);
  const perBeat = distributePages(rng, mid, ear_arc, attribute);
  const beat_plan: any[] = []; let cur = 1;
  beat_plan.push({ beat: "apertura", pages: [cur, cur + openPages - 1] }); cur += openPages;
  for (const b of ear_arc) { const n = perBeat[b]; beat_plan.push({ beat: b, pages: [cur, cur + n - 1] }); cur += n; }
  beat_plan.push({ beat: "chiusura", pages: [cur, cur + closePages - 1] });
  if (beat_plan[beat_plan.length - 1].pages[1] !== pages) beat_plan[beat_plan.length - 1].pages[1] = pages;

  let threshold_page: number;
  if (ear_arc.includes("cambiare")) threshold_page = beat_plan.find((b) => b.beat === "cambiare").pages[0];
  else threshold_page = Math.max(2, Math.round(pages * 0.70));

  const sd = C.seeds;
  const nSeeds = pages <= 12 ? sd.count_short : sd.count_long;
  const plantHi = Math.max(2, Math.floor(pages * sd.plant_within_first_fraction));
  const payoffLo = Math.min(pages - 1, Math.floor(pages * (1 - sd.payoff_within_last_fraction)) + 1);
  const kinds = rng.shuffle(sd.kinds);
  const seeds: any[] = []; const usedP = new Set<number>(), usedQ = new Set<number>();
  for (let i = 0; i < nSeeds; i++) {
    const kind = kinds[i % kinds.length];
    const plantPool = rng.shuffle(range(2, plantHi));
    let pp = plantPool.find((p) => !usedP.has(p)); if (pp == null) pp = Math.min(2 + i, plantHi);
    const payPool = rng.shuffle(range(payoffLo, pages));
    let po = payPool.find((p) => !usedQ.has(p) && p > (pp as number)); if (po == null) po = Math.min(payoffLo + i, pages);
    usedP.add(pp); usedQ.add(po);
    seeds.push({ id: `seed_${String(i + 1).padStart(2, "0")}`, kind, what: `[${kind}]`, planted_page: pp, payoff_page: po });
  }

  let debt: any = null;
  if (rng.random() < C.debt.probability) {
    const dk = rng.choice(C.debt.kinds);
    debt = { kind: dk, what: `[${dk}]`, opened_page: rng.randint(1, Math.max(1, plantHi)), closed_page: rng.randint(payoffLo, pages) };
  }
  let recurring: any = null;
  if (rng.random() < C.recurring.probability) {
    const occ = Number(rng.choice(C.recurring.occurrences));
    const spots = rng.sample(range(1, pages), Math.min(occ, pages)).sort((a, b) => a - b);
    recurring = { motif: "[motivo]", pages: spots };
  }

  const protagonist = seed.protagonist || { name: "[protagonista]", age: null };
  const companions = (seed.companions || []).filter((c: any) => c.name);
  const sp = seed.spine || ({} as Seed["spine"]);

  const node: StoryNodeExt = {
    id: (seed as any).id || "s01",
    title: seed.title || "[titolo]",
    seed_nonce: nonce >>> 0,
    attribute_dominant: attribute,
    deployment_level: deployment,
    ear_arc,
    // dalla spina del seed (StoryNode li richiede):
    premise: sp.premise || "",
    problem: sp.problem || "",
    threshold_moment: sp.threshold_moment || "",
    resolution_mode: sp.resolution_mode || "",
    entry_point_type: entry,
    closure_type: closure,
    register,
    register_range: reg_range,
    time_span_arc: time_span,
    threshold_page,
    pages,
    estimated_words: estWords,
    world_flavor: seed.world_flavor || "",
    setting_primary: (seed.setting && seed.setting.primary) || "[luogo]",
    season,
    palette_emotiva: palette,
    protagonist: {
      name: protagonist.name,
      age: (protagonist.age ?? 0) as number,
      kind: protagonist.kind || "bambino",
      ...((protagonist as any).entityId ? { entityId: (protagonist as any).entityId } : {}),
    },
    companions,
    beat_plan,
    seeds,
    pugno: seed.pugno || "",
    personal_detail: seed.personal_detail || "",
    // estensioni additive (StoryNodeExt):
    setting_entity_id: (seed.setting && seed.setting.entityId) || null,
    debt,
    recurring_image: recurring,
  };
  // voce frattale: deterministica dal nodo, con eventuali override dagli assi del seed.
  node.voice = resolveVoice(node, seedIn);
  return node;
}

// ================= extract_hooks =================
const ZONE_BIAS: Record<string, string[]> = {
  panorama: ["sky_space", "ground_space"], atmosferico: ["sky_space", "side_space"],
  azione: ["ground_space", "side_space"], introspettivo: ["vignette", "corner_lower_left"],
  transizione: ["side_space", "ground_space"], interno: ["vignette", "side_space"],
  dettaglio: ["vignette", "corner_lower_right"],
};
function pickType(rng: RNG, candidates: string[], recent: string[], maxConsec: number): string {
  const pool = rng.shuffle(candidates);
  for (const t of pool) {
    let run = 0;
    for (let i = recent.length - 1; i >= 0; i--) { if (recent[i] === t) run++; else break; }
    if (run < maxConsec) return t;
  }
  return pool[0];
}
// F1.1 — verbi-beat per lo scaffold di focal_action (port da Isola)
const BEAT_VERB: Record<string, string> = {
  apertura: "si apre la scena",
  distinguere: "si accorge / osserva",
  connettere: "si avvicina / chiede / tende verso",
  cambiare: "qualcosa si muove / attraversa",
  chiusura: "si chiude la scena",
};
function slug(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
// id d'entità di un personaggio del nodo: esplicito se c'è, altrimenti slug del nome.
export function entityIdOfCharacter(c: { name?: string; entityId?: string } | undefined): string {
  return c?.entityId || (c?.name ? "char_" + slug(c.name) : "char_anon");
}
export function locationEntityId(node: any): string {
  return node?.setting_entity_id || node?.setting?.entityId || ("luogo_" + slug(node?.setting_primary || "luogo"));
}

export function extractHooks(nodeIn: StoryNode): Hook[] {
  const node = nodeIn as StoryNodeExt;
  const pages = node.pages; const rng = new RNG((node.seed_nonce ^ 0x5eed) >>> 0);
  const beat_plan = node.beat_plan;
  const prot = node.protagonist || {};
  const protName = prot.name || "[protagonista]";
  const protId = entityIdOfCharacter(prot);
  const companions = node.companions || [];
  const setting = node.setting_primary || "[luogo]";
  const locId = locationEntityId(node);
  const palette = node.palette_emotiva || "";
  const threshold = node.threshold_page;
  const debt = node.debt; const rec = node.recurring_image;
  const recPages = new Set<number>(rec ? rec.pages : []);
  const beatOf = (p: number) => { for (const b of beat_plan) if (b.pages[0] <= p && p <= b.pages[1]) return b.beat; return "connettere"; };
  const plantOn: Record<number, any[]> = {}, payoffOn: Record<number, any[]> = {};
  for (const s of node.seeds || []) {
    (plantOn[s.planted_page] = plantOn[s.planted_page] || []).push(s);
    (payoffOn[s.payoff_page] = payoffOn[s.payoff_page] || []).push(s);
  }
  const maxConsec = C.hooks.max_consecutive_same_type;
  const hooks: Hook[] = []; const recent: string[] = [];
  for (let page = 1; page <= pages; page++) {
    const beat = beatOf(page);
    const candidates = C.hooks.beat_type_bias[beat] || C.hooks.types;
    const htype = pickType(rng, candidates, recent, maxConsec); recent.push(htype);
    const zone = rng.choice(ZONE_BIAS[htype] || C.hooks.composition_zones);
    // characters_present STRUTTURATO: {name, entityId}. Protagonista sempre; compagno da 'connettere' in poi.
    const present: { name: string; entityId: string }[] = [{ name: protName, entityId: protId }];
    if (companions.length && ["connettere", "cambiare", "chiusura"].includes(beat) && rng.random() < 0.8) {
      const comp = companions[0];
      present.push({ name: comp.name, entityId: entityIdOfCharacter(comp) });
    }
    // focal_action scaffold: verbo-beat + eventi di pagina (semi, debito, motivo, soglia)
    const parts: string[] = [`${protName}: ${BEAT_VERB[beat]}`];
    for (const s of plantOn[page] || []) parts.push(`(introduce: ${s.what})`);
    for (const s of payoffOn[page] || []) parts.push(`(ritorna, con peso diverso: ${s.what})`);
    if (debt && page === debt.opened_page) parts.push(`(apre: ${debt.what})`);
    if (debt && page === debt.closed_page) parts.push(`(chiude: ${debt.what})`);
    if (rec && recPages.has(page)) parts.push(`(motivo ricorrente: ${rec.motif})`);
    if (page === threshold) parts.push("(SOGLIA: il punto in cui qualcosa cambia davvero)");
    const focal = parts.join(" ");
    const atmosphere = `${beat} · ${palette}`;
    const markers: any = {
      is_entry: page === 1, is_closure: page === pages, is_threshold: page === threshold,
      seeds_planted: (plantOn[page] || []).map((s: any) => s.id), seeds_payoff: (payoffOn[page] || []).map((s: any) => s.id),
    };
    if (page === 1) markers.entry_point_type = node.entry_point_type;
    if (page === pages) markers.closure_type = node.closure_type;
    // note retro-compatibile (PagePlan): marcatore leggibile di apertura/soglia/chiusura.
    const note = page === 1 ? `[APERTURA ${node.entry_point_type}]`
      : page === threshold ? "[SOGLIA]"
      : page === pages ? `[CHIUSURA ${node.closure_type}]` : "";
    hooks.push({
      hook_id: `p${String(page).padStart(2, "0")}`, page, type: htype, beat,
      characters_present: present, location: setting, location_entity_id: locId,
      focal_action: focal, atmosphere, palette, composition_zone: zone, markers,
      // campi PagePlan (la UI esistente continua a funzionare):
      hook: htype, zone, note,
    });
  }
  const distinct = new Set(hooks.map((h) => h.type));
  if (distinct.size < C.hooks.min_distinct_types) {
    const count: Record<string, number> = {};
    hooks.forEach((h) => (count[h.type] = (count[h.type] || 0) + 1));
    let unused = C.hooks.types.filter((t: string) => !distinct.has(t));
    for (const h of hooks) {
      if (distinct.size >= C.hooks.min_distinct_types || !unused.length) break;
      if (count[h.type] <= 1) continue; // non rimuovere un tipo unico
      const idx = h.page - 1;
      const left = idx - 1 >= 0 ? hooks[idx - 1].type : null;
      const right = idx + 1 < hooks.length ? hooks[idx + 1].type : null;
      const cand = unused.find((t: string) => t !== left && t !== right);
      if (cand) {
        count[h.type]--; h.type = cand; count[cand] = (count[cand] || 0) + 1;
        h.composition_zone = rng.choice(ZONE_BIAS[cand] || C.hooks.composition_zones);
        h.hook = cand; h.zone = h.composition_zone; // specchio PagePlan
        distinct.add(cand); unused = unused.filter((t: string) => t !== cand);
      }
    }
  }
  return hooks;
}

// entità in scena per il GATE della FASE 1 (F0.4): personaggi presenti su tutte le
// pagine + il luogo. È l'elenco che la FASE 1 pretende confermato prima di partire.
export function entitiesInScene(hooks: Hook[], nodeIn: StoryNode): string[] {
  const node = nodeIn as StoryNodeExt;
  const ids = new Set<string>();
  for (const h of hooks) for (const c of h.characters_present || []) if (c.entityId) ids.add(c.entityId);
  ids.add(locationEntityId(node));
  return [...ids];
}

// ================= build_voice =================
const VOICE_SALT = 0x764f4345;
function card(axisDef: any, value: string): any {
  const c = axisDef[value] || {}; const out: any = { value };
  for (const k of ["fai", "evita", "lessico"]) if (c[k]) out[k] = c[k];
  return out;
}
function pickKV(rng: RNG, mapping: Record<string, string>): any { const k = rng.choice(Object.keys(mapping)); return { value: k, hint: mapping[k] }; }
export function resolveVoice(nodeIn: StoryNode, seedIn: Seed): NodeVoice {
  const node = nodeIn as StoryNodeExt;
  const V = C.voice; const rng = new RNG((node.seed_nonce ^ VOICE_SALT) >>> 0);
  // Override degli assi narratore: in Scrivia stanno direttamente in seed.voice (i 5 assi).
  const ov: Record<string, string> = ((seedIn.voice as Record<string, string>) || {});
  const axes = V.axes; const [lo, hi] = V.narrator_active_axes; const axisNames = Object.keys(axes);
  const forced = Object.keys(ov).filter((a) => axisNames.includes(a) && ov[a]);
  const target = Math.max(forced.length, rng.randint(lo, hi));
  const rest = rng.shuffle(axisNames.filter((a) => !forced.includes(a)));
  let active = forced.concat(rest.slice(0, Math.max(0, target - forced.length)));
  active = axisNames.filter((a) => active.includes(a));
  const bias = V.temperamento_lente_bias || {};
  const chosen: Record<string, string> = {}; const cards: Record<string, any> = {};
  for (const ax of active) {
    const vals = Object.keys(axes[ax]); let val: string;
    if (ax in ov && ov[ax] in axes[ax]) val = ov[ax];
    else if (ax === "lente_sensoriale" && chosen["temperamento"] in bias && rng.random() < 0.6) val = bias[chosen["temperamento"]];
    else val = rng.choice(vals);
    chosen[ax] = val; cards[ax] = card(axes[ax], val);
  }
  const narrator = { active_axes: active, cards };
  const ch = V.character; const tics = rng.shuffle(Object.keys(ch.tic_verbale));
  const names = [(node.protagonist || {}).name || "[protagonista]"].concat((node.companions || []).filter((c: any) => c.name).map((c: any) => c.name));
  const characters: Record<string, any> = {};
  names.forEach((name, i) => { const tic = tics[i % tics.length]; characters[name] = { tic_verbale: { value: tic, hint: ch.tic_verbale[tic] }, tempo: pickKV(rng, ch.tempo), rivolgersi: pickKV(rng, ch.rivolgersi) }; });
  const pl = V.place; const primary = node.setting_primary || "[luogo]"; const dkind = rng.choice(pl.dettaglio_kind);
  const places: Record<string, any> = { [primary]: { senso_dominante: pickKV(rng, pl.senso_dominante), qualita_luce: pickKV(rng, pl.qualita_luce), dettaglio: { kind: dkind, what: `[${dkind}]` } } };
  return { narrator, characters, places };
}

// ================= invariants =================
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
export function checkNode(nodeIn: StoryNode): string[] {
  const node = nodeIn as StoryNodeExt;
  const v: string[] = []; const pages = node.pages;
  const enums: [string, any, any[]][] = [
    ["attribute_dominant", node.attribute_dominant, C.attribute_dominant],
    ["deployment_level", node.deployment_level, C.deployment_level],
    ["entry_point_type", node.entry_point_type, C.entry_keys],
    ["closure_type", node.closure_type, C.closure_keys],
    ["register", node.register, C.register_keys],
    ["time_span_arc", node.time_span_arc, C.time_span_arc],
  ];
  for (const [name, val, allowed] of enums) if (!allowed.includes(val)) v.push(`${name}=${JSON.stringify(val)} non valido`);
  if (!Number.isInteger(pages) || pages < C.pages_min || pages > C.pages_max) { v.push(`pages=${pages} fuori range`); return v; }
  const dep = node.deployment_level, attr = node.attribute_dominant, arc = node.ear_arc;
  if (dep === "mono" && !eq(arc, [attr])) v.push(`ear_arc != [${attr}] per mono`);
  if (dep === "triadico" && !eq(arc, ["distinguere", "connettere", "cambiare"])) v.push("ear_arc != triade");
  const ranges = [...(node.beat_plan || [])].map((b) => [b.pages[0], b.pages[1], b.beat] as [number, number, string]).sort((a, b) => a[0] - b[0]);
  let cursor = 1;
  for (const [lo, hi, beat] of ranges) { if (lo !== cursor) v.push(`beat_plan buco/overlap a p${cursor} (${beat} da p${lo})`); if (hi < lo) v.push(`beat_plan invertito ${beat}`); cursor = hi + 1; }
  if (ranges.length && ranges[ranges.length - 1][1] !== pages) v.push(`beat_plan ultima ${ranges[ranges.length - 1][1]} != ${pages}`);
  if (ranges.length && ranges[0][0] !== 1) v.push("beat_plan non parte da p1");
  const tp = node.threshold_page;
  if ((arc || []).includes("cambiare")) { const camb = (node.beat_plan || []).find((b: any) => b.beat === "cambiare"); if (camb && tp !== camb.pages[0]) v.push(`threshold ${tp} != inizio cambiare p${camb.pages[0]}`); }
  else if (!(tp >= 2 && tp <= pages)) v.push(`threshold ${tp} fuori [2,${pages}]`);
  const sd = C.seeds; const plantHi = Math.max(2, Math.floor(pages * sd.plant_within_first_fraction));
  const payoffLo = Math.min(pages - 1, Math.floor(pages * (1 - sd.payoff_within_last_fraction)) + 1);
  const pl = new Set<number>(), po = new Set<number>();
  for (const s of node.seeds || []) {
    const a = s.planted_page, b = s.payoff_page;
    if (!(Number.isInteger(a) && Number.isInteger(b) && a < b)) { v.push(`seme ${s.id}: pianta ${a} non < paga ${b}`); continue; }
    if (!(a >= 2 && a <= plantHi)) v.push(`seme ${s.id}: pianta p${a} fuori [2,${plantHi}]`);
    if (!(b >= payoffLo && b <= pages)) v.push(`seme ${s.id}: paga p${b} fuori [${payoffLo},${pages}]`);
    if (pl.has(a)) v.push(`seme ${s.id}: collisione pianta p${a}`);
    if (po.has(b)) v.push(`seme ${s.id}: collisione paga p${b}`);
    pl.add(a); po.add(b);
  }
  const d = node.debt;
  if (d) { const oa = d.opened_page, oc = d.closed_page; if (!(Number.isInteger(oa) && Number.isInteger(oc) && 1 <= oa && oa <= oc && oc <= pages)) v.push(`debito ${oa}/${oc} incoerente`); }
  const voice = node.voice;
  if (voice) {
    const axesDef = C.voice.axes; const narr = voice.narrator || {}; const active = narr.active_axes || [];
    const [loA, hiA] = C.voice.narrator_active_axes;
    if (!(active.length >= loA && active.length <= hiA + 1)) v.push(`voce: ${active.length} assi fuori [${loA},${hiA}+1]`);
    for (const ax of active) { const val = ((narr.cards || {})[ax] || {}).value; if (!(ax in axesDef) || !(val in axesDef[ax])) v.push(`voce: asse/valore ${ax}=${val}`); }
    const tics = Object.values(voice.characters || {}).map((c: any) => c.tic_verbale && c.tic_verbale.value);
    if (tics.length !== new Set(tics).size) v.push(`voce: idioletti non distinti ${tics}`);
    if (!voice.places || !Object.keys(voice.places).length) v.push("voce: manca texture luogo");
  }
  return v;
}
export function checkHooks(hooks: Hook[], nodeIn: StoryNode): string[] {
  const node = nodeIn as StoryNodeExt;
  const v: string[] = []; const pages = node.pages;
  if (hooks.length !== pages) v.push(`hook: ${hooks.length} != ${pages} pagine`);
  const typesSeen = new Set<string>(); let runs = 0, prev: string | null = null;
  const plant: Record<number, string> = {}, payoff: Record<number, string> = {};
  for (const s of node.seeds || []) { plant[s.planted_page] = s.id; payoff[s.payoff_page] = s.id; }
  const maxConsec = C.hooks.max_consecutive_same_type;
  for (let i = 1; i <= hooks.length; i++) {
    const h = hooks[i - 1];
    if (h.hook_id !== `p${String(i).padStart(2, "0")}`) v.push(`hook #${i}: id ${h.hook_id}`);
    if (!C.hooks.types.includes(h.type)) v.push(`hook p${i}: tipo ${h.type}`);
    typesSeen.add(h.type);
    if (h.type === prev) { runs++; if (runs >= maxConsec) v.push(`hook p${i}: >${maxConsec} '${h.type}' consecutivi`); } else runs = 0;
    prev = h.type;
    const m = h.markers || {};
    if (i === 1 && !m.is_entry) v.push("hook p1: manca is_entry");
    if (i === 1 && m.entry_point_type !== node.entry_point_type) v.push("hook p1: entry non coerente");
    if (i === pages && !m.is_closure) v.push(`hook p${pages}: manca is_closure`);
    if (i === pages && m.closure_type !== node.closure_type) v.push(`hook p${pages}: closure non coerente`);
    if ((i === node.threshold_page) !== Boolean(m.is_threshold)) v.push(`hook p${i}: marker soglia incoerente`);
    if (i in plant && !(m.seeds_planted || []).includes(plant[i])) v.push(`hook p${i}: manca marker pianta`);
    if (i in payoff && !(m.seeds_payoff || []).includes(payoff[i])) v.push(`hook p${i}: manca marker paga`);
  }
  if (typesSeen.size < C.hooks.min_distinct_types) v.push(`hook: ${typesSeen.size} tipi distinti < ${C.hooks.min_distinct_types}`);
  return v;
}

// ---------- nonce + alias retro-compatibili ----------
// La UI esistente importa buildNode, buildPagePlan e newNonce: li preserviamo.
export function newNonce(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}
// buildPagePlan resta l'API usata dalla UI; ora produce hook arricchiti (Hook ⊇ PagePlan).
export { extractHooks as buildPagePlan };
