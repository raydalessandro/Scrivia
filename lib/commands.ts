// REGISTRY DEI COMANDI — il cuore della "Fase 1 come agente".
//
// È un catalogo tipizzato di azioni eseguibili sulla storia. Una sola fonte di
// verità: la usano sia la UI (l'umano tocca un campo) sia l'IA (esegue un comando
// dal contesto). Questa stessa lista, con `toMcpTools()`, diventa la MCP della
// prima fase — così l'IA ha davvero gli strumenti per seguire e supportare
// l'umano (più l'ontologia EAR), non è una compilatrice passiva.
//
// I comandi `pure` (read/derive) passano dalla cache (lib/cache.ts).

import type { Story, Seed, CommandRun } from "./types";
import { THEME_TO_ATTRIBUTE, ATTRIBUTE_LABEL, WORLD_FLAVORS, VOICE_AXES, ENTRY_POINTS, CLOSURES } from "./enums";
import { buildNode, buildPagePlan, newNonce } from "./engine";
import { cacheKey, memo, invalidate } from "./cache";

export type ParamType = "string" | "number" | "enum";
export interface ParamSpec {
  name: string;
  type: ParamType;
  required?: boolean;
  enumValues?: string[];
  description: string;
}
export interface CommandResult {
  story?: Story; // nuova storia (mutazione); assente per i comandi puri
  summary: string;
  data?: unknown;
}
export type CommandCategory = "seed" | "cast" | "spine" | "voice" | "build" | "query";
export interface CommandDef {
  name: string;
  title: string;
  description: string;
  category: CommandCategory;
  params: ParamSpec[];
  pure?: boolean;
  run: (story: Story, p: Record<string, any>) => CommandResult;
}

const clone = (s: Story): Story => structuredClone(s);
const touch = (s: Story): Story => ({ ...s, updatedAt: new Date().toISOString() });

const SPINE_FIELDS = ["premise", "problem", "threshold_moment", "resolution_mode", "closure"] as const;

export const COMMANDS: CommandDef[] = [
  // --- SEME ---------------------------------------------------------------
  {
    name: "set_title", title: "Titolo", description: "Imposta il titolo (provvisorio) della storia.",
    category: "seed", params: [{ name: "title", type: "string", required: true, description: "il titolo" }],
    run: (s, p) => { const n = touch(clone(s)); n.seed.title = p.title; n.title = p.title || n.title; return { story: n, summary: `Titolo → «${p.title}»` }; },
  },
  {
    name: "set_protagonist", title: "Protagonista",
    description: "Imposta nome, età e tipo (specie) del protagonista. L'età guida registro e apertura.",
    category: "seed", params: [
      { name: "name", type: "string", description: "nome" },
      { name: "age", type: "number", description: "età" },
      { name: "kind", type: "string", description: "specie/tipo (riccio, bambina, robot…)" },
    ],
    run: (s, p) => {
      const n = touch(clone(s));
      if (p.name != null) n.seed.protagonist.name = p.name;
      if (p.age != null) n.seed.protagonist.age = Number(p.age);
      if (p.kind != null) n.seed.protagonist.kind = p.kind;
      return { story: n, summary: `Protagonista → ${n.seed.protagonist.name || "?"}${n.seed.protagonist.age ? `, ${n.seed.protagonist.age}` : ""}` };
    },
  },
  {
    name: "add_companion", title: "Aggiungi personaggio",
    description: "Aggiunge un comprimario al cast.",
    category: "cast", params: [
      { name: "name", type: "string", required: true, description: "nome" },
      { name: "kind", type: "string", description: "specie/tipo" },
    ],
    run: (s, p) => { const n = touch(clone(s)); n.seed.companions.push({ name: p.name, kind: p.kind || "" }); return { story: n, summary: `Cast +${p.name}` }; },
  },
  {
    name: "update_companion", title: "Modifica personaggio",
    description: "Rinomina o cambia il tipo di un comprimario esistente.",
    category: "cast", params: [
      { name: "name", type: "string", required: true, description: "nome attuale" },
      { name: "newName", type: "string", description: "nuovo nome" },
      { name: "kind", type: "string", description: "nuovo tipo" },
    ],
    run: (s, p) => {
      const n = touch(clone(s));
      const c = n.seed.companions.find((x) => x.name === p.name);
      if (!c) return { summary: `Nessun personaggio «${p.name}»` };
      if (p.newName) c.name = p.newName;
      if (p.kind != null) c.kind = p.kind;
      return { story: n, summary: `Personaggio «${p.name}» aggiornato` };
    },
  },
  {
    name: "remove_companion", title: "Rimuovi personaggio", description: "Toglie un comprimario dal cast.",
    category: "cast", params: [{ name: "name", type: "string", required: true, description: "nome" }],
    run: (s, p) => { const n = touch(clone(s)); n.seed.companions = n.seed.companions.filter((x) => x.name !== p.name); return { story: n, summary: `Cast −${p.name}` }; },
  },
  {
    name: "set_world", title: "Mondo", description: "Imposta il mondo della storia (una parola).",
    category: "seed", params: [{ name: "world_flavor", type: "enum", required: true, enumValues: WORLD_FLAVORS, description: "il mondo" }],
    run: (s, p) => { const n = touch(clone(s)); n.seed.world_flavor = String(p.world_flavor).toLowerCase().replace(/\s+/g, "_"); return { story: n, summary: `Mondo → ${n.seed.world_flavor}` }; },
  },
  {
    name: "set_setting", title: "Ambientazione", description: "Luogo principale e note di contesto.",
    category: "seed", params: [
      { name: "primary", type: "string", description: "luogo principale" },
      { name: "notes", type: "string", description: "contesto (es. famiglia appena trasferita)" },
    ],
    run: (s, p) => { const n = touch(clone(s)); if (p.primary != null) n.seed.setting.primary = p.primary; if (p.notes != null) n.seed.setting.notes = p.notes; return { story: n, summary: `Ambientazione aggiornata` }; },
  },
  {
    name: "set_theme", title: "Tema",
    description: "Imposta il tema. Mappato (ontologia EAR) a un attributo dominante interno, mai nominato nel testo.",
    category: "seed", params: [{ name: "theme", type: "string", required: true, description: "paura, amicizia, perdita, scoperta…" }],
    run: (s, p) => {
      const n = touch(clone(s)); n.seed.theme = String(p.theme).toLowerCase().trim();
      const attr = THEME_TO_ATTRIBUTE[n.seed.theme];
      return { story: n, summary: `Tema → ${n.seed.theme}${attr ? ` (→ ${attr})` : " (non mappato: deciderà il motore)"}`, data: { attribute: attr } };
    },
  },
  {
    name: "set_pugno", title: "Pugno", description: "Il cuore della storia in una frase.",
    category: "seed", params: [{ name: "pugno", type: "string", required: true, description: "cosa succede/cosa sente" }],
    run: (s, p) => { const n = touch(clone(s)); n.seed.pugno = p.pugno; return { story: n, summary: `Pugno aggiornato` }; },
  },
  {
    name: "set_personal_detail", title: "Dettaglio personale", description: "Un dettaglio vero del bambino da intessere (un oggetto, un'abitudine).",
    category: "seed", params: [{ name: "detail", type: "string", required: true, description: "il dettaglio" }],
    run: (s, p) => { const n = touch(clone(s)); n.seed.personal_detail = p.detail; return { story: n, summary: `Dettaglio personale aggiornato` }; },
  },
  {
    name: "set_length", title: "Lunghezza", description: "Numero di pagine (10–20).",
    category: "seed", params: [{ name: "pages", type: "number", required: true, description: "pagine" }],
    run: (s, p) => { const n = touch(clone(s)); n.seed.length_pages = Math.max(10, Math.min(20, Number(p.pages) || 12)); return { story: n, summary: `Lunghezza → ${n.seed.length_pages} pagine` }; },
  },

  // --- SPINA --------------------------------------------------------------
  {
    name: "set_spine", title: "Spina narrativa",
    description: "Imposta un campo della spina. threshold_moment = una DECISIONE o un GESTO; resolution_mode = come si MUOVE (non «si risolve»).",
    category: "spine", params: [
      { name: "field", type: "enum", required: true, enumValues: [...SPINE_FIELDS], description: "campo" },
      { name: "value", type: "string", required: true, description: "testo" },
    ],
    run: (s, p) => {
      const n = touch(clone(s));
      if (!(SPINE_FIELDS as readonly string[]).includes(p.field)) return { summary: `Campo spina sconosciuto: ${p.field}` };
      (n.seed.spine as any)[p.field] = p.value;
      return { story: n, summary: `Spina · ${p.field} aggiornato` };
    },
  },

  // --- VOCE ---------------------------------------------------------------
  {
    name: "set_voice_axis", title: "Voce",
    description: "Spunta un asse di voce (crocetta opzionale). Gli assi non spuntati li campiona il motore.",
    category: "voice", params: [
      { name: "axis", type: "enum", required: true, enumValues: VOICE_AXES.map((a) => a.key), description: "asse" },
      { name: "value", type: "string", required: true, description: "valore dell'asse" },
    ],
    run: (s, p) => { const n = touch(clone(s)); (n.seed.voice as any)[p.axis] = p.value; return { story: n, summary: `Voce · ${p.axis} → ${p.value}` }; },
  },

  // --- BUILD --------------------------------------------------------------
  {
    name: "build_node", title: "Costruisci il grafo",
    description: "«Il click»: campiona il nodo dal seed (deterministico, nonce→stessa storia), genera piano pagine e prompt immagini.",
    category: "build", params: [{ name: "nonce", type: "number", description: "fissa per riproducibilità; vuoto = diverso" }],
    run: (s, p) => {
      const n = touch(clone(s));
      const seed: Seed = { ...n.seed, nonce: p.nonce != null ? Number(p.nonce) : n.seed.nonce ?? newNonce() };
      const node = buildNode(seed);
      const pagePlan = buildPagePlan(node);
      n.seed = seed; n.node = node; n.pagePlan = pagePlan; n.title = node.title; n.stage = "manus";
      n.manus = pagePlan.map((pp) => ({
        page: pp.page, hook: pp.hook, beat: pp.beat, storyMoment: pp.note || `${node.protagonist.name}: ${pp.beat}`,
        pov: pp.page === 1 ? "a wide establishing shot" : "a medium shot at eye level",
        place: `${node.setting_primary} — ${node.season}`,
        characters: node.protagonist.name + (node.companions[0] ? ` + ${node.companions[0].name}` : ""),
      }));
      return { story: n, summary: `Grafo costruito · nonce ${node.seed_nonce} · ${node.attribute_dominant}/${node.deployment_level}` };
    },
  },

  // --- QUERY (puri, in cache) --------------------------------------------
  {
    name: "validate_seed", title: "Valida il seme", description: "Controlla che il seed sia completo (cancello deterministico).",
    category: "query", pure: true, params: [],
    run: (s) => { const v = validateSeed(s.seed); return { summary: v.errors.length ? `${v.errors.length} errori` : "seed completo", data: v }; },
  },
  {
    name: "suggest_attribute", title: "Ontologia: tema→attributo", description: "Mappa un tema all'attributo EAR (distinguere/connettere/cambiare).",
    category: "query", pure: true, params: [{ name: "theme", type: "string", required: true, description: "il tema" }],
    run: (_s, p) => { const a = THEME_TO_ATTRIBUTE[String(p.theme).toLowerCase()]; return { summary: a ? `${p.theme} → ${a}` : `${p.theme}: non mappato`, data: { attribute: a, label: a ? ATTRIBUTE_LABEL[a] : null } }; },
  },
  {
    name: "summarize_story", title: "Riassunto di lavoro", description: "Riassunto strutturato dello stato della storia (memoria della Fase 1).",
    category: "query", pure: true, params: [],
    run: (s) => ({ summary: "riassunto pronto", data: summarize(s) }),
  },
  {
    name: "suggest_next", title: "Prossimo passo", description: "Cosa manca e qual è la mossa migliore adesso.",
    category: "query", pure: true, params: [],
    run: (s) => { const v = validateSeed(s.seed); const next = v.errors[0] ?? (s.node ? "pronto per la prosa" : "tutto pronto: costruisci il grafo"); return { summary: next, data: v }; },
  },
];

export const COMMAND_BY_NAME: Record<string, CommandDef> = Object.fromEntries(COMMANDS.map((c) => [c.name, c]));

/** Esegue un comando. Applica la mutazione, registra nel log, usa la cache per i puri. */
export function executeCommand(
  story: Story,
  name: string,
  params: Record<string, any> = {},
  by: "you" | "claude" = "you"
): { story: Story; run: CommandRun; data?: unknown } {
  const def = COMMAND_BY_NAME[name];
  const ts = new Date().toISOString();
  if (!def) {
    return { story, run: { ts, name, by, summary: `comando sconosciuto: ${name}` } };
  }
  const t0 = Date.now();
  let result: CommandResult;
  let cached = false;
  if (def.pure) {
    const [r, hit] = memo<CommandResult>(cacheKey([name, params, story.updatedAt ?? story.id]), () => def.run(story, params));
    result = r; cached = hit;
  } else {
    result = def.run(story, params);
  }
  const durationMs = Date.now() - t0;
  const run: CommandRun = { ts, name, params, by, summary: result.summary, cached, durationMs };
  let next = result.story ?? story;
  if (result.story) {
    invalidate(story.id);
    next = { ...next, commandLog: [...(next.commandLog ?? []), run] };
  }
  return { story: next, run, data: result.data };
}

// --- helpers --------------------------------------------------------------

export function validateSeed(seed: Seed): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!seed.protagonist.name) errors.push("manca il nome del protagonista");
  if (seed.protagonist.age == null) errors.push("manca l'età");
  if (!seed.world_flavor) errors.push("manca il mondo");
  if (!seed.theme) errors.push("manca il tema");
  if (!seed.pugno) errors.push("manca il pugno");
  if (!seed.spine.premise || !seed.spine.threshold_moment) errors.push("spina narrativa incompleta (premessa + soglia)");
  if (seed.theme && !THEME_TO_ATTRIBUTE[seed.theme]) warnings.push(`tema «${seed.theme}» non mappato: il motore sceglierà l'attributo`);
  return { errors, warnings };
}

export interface StorySummary {
  sections: { title: string; lines: string[]; complete: boolean }[];
  completeness: number; // 0..1
}
function summarize(s: Story): StorySummary {
  const seed = s.seed;
  const attr = THEME_TO_ATTRIBUTE[seed.theme];
  const sections = [
    { title: "Protagonista", lines: [[seed.protagonist.name, seed.protagonist.age ? `${seed.protagonist.age} anni` : "", seed.protagonist.kind].filter(Boolean).join(" · ")], complete: !!seed.protagonist.name && seed.protagonist.age != null },
    { title: "Mondo & tema", lines: [seed.world_flavor.replace(/_/g, " "), seed.theme ? `${seed.theme}${attr ? ` → ${attr}` : ""}` : ""].filter(Boolean), complete: !!seed.world_flavor && !!seed.theme },
    { title: "Cuore", lines: [seed.pugno], complete: !!seed.pugno },
    { title: "Cast", lines: seed.companions.map((c) => `${c.name}${c.kind ? ` (${c.kind})` : ""}`), complete: true },
    { title: "Spina", lines: [seed.spine.premise && `Premessa: ${seed.spine.premise}`, seed.spine.problem && `Problema: ${seed.spine.problem}`, seed.spine.threshold_moment && `Soglia: ${seed.spine.threshold_moment}`, seed.spine.resolution_mode && `Risoluzione: ${seed.spine.resolution_mode}`].filter(Boolean) as string[], complete: !!seed.spine.premise && !!seed.spine.threshold_moment },
  ];
  const complete = sections.filter((x) => x.complete).length;
  return { sections, completeness: complete / sections.length };
}

/** Esporta il registry come definizioni in stile MCP-tool (la base della futura MCP). */
export function toMcpTools() {
  return COMMANDS.map((c) => ({
    name: c.name,
    description: `${c.title} — ${c.description}`,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(
        c.params.map((p) => [p.name, { type: p.type === "number" ? "number" : "string", description: p.description, ...(p.enumValues ? { enum: p.enumValues } : {}) }])
      ),
      required: c.params.filter((p) => p.required).map((p) => p.name),
    },
  }));
}

// riferimenti utili per la UI delle entità selezionabili
export const ENTRY_LABELS = ENTRY_POINTS;
export const CLOSURE_LABELS = CLOSURES;
