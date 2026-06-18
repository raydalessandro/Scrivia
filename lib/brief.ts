// lib/brief.ts — assembla il WRITING BRIEF (zero-token) da node + hooks + seed.
// Port di seme/scripts/build_brief.py. Meccanico: nessun LLM. È ciò che il prosatore
// (l'IA, in M2) legge per scrivere la prosa pagina-per-pagina, BRIEF-FIRST. Contiene la
// ricetta strutturale, la spina narrativa, i vincoli di voce, l'esecuzione di apertura e
// chiusura, e la tabella pagina-per-pagina con eventi-seme e soglia.
//
// Lo scheletro (accorgersi/avvicinarsi/cambiare) NON si nomina nel testo prodotto.

import type { StoryNode, Seed } from "./types";
import type { Hook, StoryNodeExt } from "./engineTypes";
import canon from "./canon.json";

const ENTRY_LEGEND = (canon as { entry_point_type: Record<string, string> }).entry_point_type;
const CLOSURE_LEGEND = (canon as { closure_type: Record<string, string> }).closure_type;

export function buildBrief(node: StoryNode, hooks: Hook[], seed: Seed): string {
  const entry = node.entry_point_type;
  const closure = node.closure_type;
  const L: string[] = [];
  const A = (s = "") => { L.push(s); };

  A(`# WRITING BRIEF — ${node.title}`);
  A("");
  A("> Brief-first: scrivi la prosa SOLO da questo brief, pagina per pagina. Le storie di "
    + "riferimento si guardano dopo, per calibrare la voce — mai prima.");
  A("> Lo scheletro (accorgersi/avvicinarsi/cambiare) NON si nomina nel testo. Niente moralina. "
    + "Vedi le carte di voce e i pattern da bandire.");
  A("");

  A("## Ricetta strutturale");
  A("");
  A("| campo | valore |");
  A("|---|---|");
  A(`| Pagine | ${node.pages} (~${node.estimated_words} parole) |`);
  A(`| Arco (interno, non nominare) | ${node.attribute_dominant} · ${node.deployment_level} · ${node.ear_arc.join(" → ")} |`);
  A(`| Apertura (entry) | **${entry}** — ${ENTRY_LEGEND[entry] ?? ""} |`);
  A(`| Chiusura (closure) | **${closure}** — ${CLOSURE_LEGEND[String(closure)] ?? ""} |`);
  A(`| Registro | **${node.register}** [${node.register_range[0]}–${node.register_range[1]}] |`);
  A(`| Arco temporale | ${node.time_span_arc} |`);
  A(`| Stagione / palette | ${node.season} — ${node.palette_emotiva} |`);
  A("");

  A("## Spina narrativa");
  A("");
  A(`- **Premessa:** ${node.premise}`);
  A(`- **Problema:** ${node.problem}`);
  A(`- **Soglia (p${node.threshold_page}):** ${node.threshold_moment}`);
  A(`- **Risoluzione (modo):** ${node.resolution_mode}`);
  if (seed.spine?.closure) A(`- **Chiusura (direzione):** ${seed.spine.closure}`);
  if (node.pugno) A(`- **Pugno emotivo:** ${node.pugno}`);
  if (node.personal_detail) A(`- **Da intessere (dettaglio personale):** ${node.personal_detail}`);
  A("");

  A("## Cast");
  A("");
  A(`- ${node.protagonist.name} (${node.protagonist.kind}, ${node.protagonist.age} anni) — *protagonista, attivo*`);
  for (const c of node.companions ?? []) A(`- ${c.name} (${c.kind}) — *comprimario*`);
  A(`- Mondo: ${node.world_flavor} · Luogo: ${node.setting_primary}`);
  A("");

  // semi (l'evoluzione dentro la storia)
  A("## Eco interne (l'evoluzione dentro la storia)");
  A("");
  A("Semi — introduci dove indicato, fai tornare con **peso diverso** senza che nessuno lo faccia notare:");
  for (const s of node.seeds ?? []) {
    A(`- \`${s.id}\` (${s.kind}): **${s.what}** — pianta a p${s.planted_page}, ritorna a p${s.payoff_page}.`);
  }
  A("");

  // esecuzione apertura/chiusura
  A("## Come aprire e come chiudere");
  A("");
  A(`- **Apertura ${entry}** — ${ENTRY_LEGEND[entry] ?? ""}. La prima pagina parte così.`);
  A(`- **Chiusura ${closure}** — ${CLOSURE_LEGEND[String(closure)] ?? ""}. L'ultima pagina sigilla così, senza tirare morale.`);
  A("");

  // voce frattale (da node.voice, calcolata da resolveVoice in buildNode)
  const v = (node as StoryNodeExt).voice;
  if (v) {
    A("## Voce");
    A("");
    A("Carte di voce: **plasmano, non dettano**. Gli assi non elencati sono neutri.");
    A("");
    A("**Narratore** — assi attivi:");
    for (const ax of v.narrator.active_axes) {
      const c = v.narrator.cards[ax];
      A(`- *${ax} = ${c.value}*`);
      if (c.fai) A(`  - fai: ${c.fai}`);
      if (c.evita) A(`  - evita-tic: ${c.evita}`);
      if (c.lessico) A(`  - lessico: ${c.lessico}`);
    }
    A("");
    A("**Personaggi** — idioletto = firma costante (non profilo), tic distinti:");
    for (const [name, c] of Object.entries(v.characters)) {
      A(`- **${name}**: ${c.tic_verbale.hint} · ${c.tempo.hint} · ${c.rivolgersi.hint}`);
    }
    A("");
    A("**Luoghi** — texture = firma sensoriale su tutte le pagine:");
    for (const [loc, t] of Object.entries(v.places)) {
      A(`- **${loc}**: ${t.senso_dominante.hint}; ${t.qualita_luce.hint}; ${t.dettaglio.what}`);
    }
    A("");
  }

  // voci-personaggio dell'autore (B3, più ricche): alimentano i dialoghi
  const cv = seed.characterVoices ?? [];
  if (cv.length) {
    A("## Voci-personaggio (indicazioni d'autore)");
    A("");
    A("Nei dialoghi rispetta queste firme. Il **«non direbbe MAI»** è il vincolo più forte.");
    for (const c of cv) {
      const bits: string[] = [];
      if (c.archetype) bits.push(`archetipo: ${c.archetype}`);
      if (c.underStress) bits.push(`sotto stress: ${c.underStress}`);
      if (c.ritmo) bits.push(`ritmo: ${c.ritmo}`);
      if (c.words) bits.push(`parole sue: ${c.words}`);
      A(`- **${c.name}** (${c.role})${bits.length ? " — " + bits.join("; ") : ""}.`);
      if (c.never) A(`  - non direbbe MAI: ${c.never}`);
    }
    A("");
  }
  if (seed.narratorBrief) {
    A("## Nota sul narratore (d'autore)");
    A("");
    A(seed.narratorBrief);
    A("");
  }

  // tabella pagina-per-pagina
  A("## Pagina per pagina");
  A("");
  A("| pag | beat | tipo hook | zona | nota di pagina |");
  A("|---|---|---|---|---|");
  for (const h of hooks) {
    let note = h.focal_action;
    const flags: string[] = [];
    if (h.markers.is_entry) flags.push(`APERTURA ${entry}`);
    if (h.markers.is_threshold) flags.push("SOGLIA");
    if (h.markers.is_closure) flags.push(`CHIUSURA ${closure}`);
    if (flags.length) note = `**[${flags.join(" · ")}]** ${note}`;
    A(`| ${h.page} | ${h.beat} | ${h.type} | ${h.composition_zone} | ${note} |`);
  }
  A("");

  A("## Promemoria di voce");
  A("");
  A(`- Registro **${node.register}**.`);
  A("- Almeno un dettaglio non-funzionale, un pensiero laterale, un momento \"vuoto\" per pagina chiave.");
  A("- Quote anti-cliché: niente frasi-da-mille-storie.");
  A("- Lo scheletro resta invisibile. Il senso sta nelle immagini, non in una frase che lo spiega.");
  return L.join("\n") + "\n";
}
