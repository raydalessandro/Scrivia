#!/usr/bin/env python3
"""
build_brief.py — Assembla il WRITING BRIEF (zero-token) da node + hooks.

Meccanico: nessun LLM. Il brief e' cio' che il prosatore (Claude in chat) legge
per scrivere la prosa pagina-per-pagina, BRIEF-FIRST. Contiene la ricetta
strutturale, la spina narrativa, i vincoli di voce, l'esecuzione di apertura e
chiusura, e la tabella pagina-per-pagina con eventi-seme e soglia.

Uso:
    python3 build_brief.py <node.json> <hooks.json> [--out writing_brief.md]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seme_canon  # noqa: E402


def build_brief(node: dict, hooks: list, C: "seme_canon.Canon") -> str:
    entry = node["entry_point_type"]
    closure = node["closure_type"]
    L = []
    A = L.append

    A(f"# WRITING BRIEF — {node['title']}")
    A("")
    A("> Brief-first: scrivi la prosa SOLO da questo brief, pagina per pagina. "
      "Le storie di riferimento si guardano dopo, per calibrare la voce — mai prima.")
    A("> Lo scheletro (accorgersi/avvicinarsi/cambiare) NON si nomina nel testo. "
      "Niente moralina. Vedi `canone/VOCE.md` e `canone/PATTERN_DA_BANDIRE.md`.")
    A("")
    A("## Ricetta strutturale")
    A("")
    A(f"| campo | valore |")
    A(f"|---|---|")
    A(f"| Pagine | {node['pages']} (~{node['estimated_words']} parole) |")
    A(f"| Arco (interno, non nominare) | {node['attribute_dominant']} · {node['deployment_level']} · {' → '.join(node['ear_arc'])} |")
    A(f"| Apertura (entry) | **{entry}** — {C.entry_point_type[entry]} |")
    A(f"| Chiusura (closure) | **{closure}** — {C.closure_type[closure]} |")
    A(f"| Registro | **{node['register']}** {node['register_range']} |")
    A(f"| Arco temporale | {node['time_span_arc']} |")
    A(f"| Stagione / palette | {node['season']} — {node['palette_emotiva']} |")
    A(f"| Pause descrittive (target) | {node['descriptive_pauses_target']} |")
    A("")
    A("## Spina narrativa")
    A("")
    A(f"- **Premessa:** {node['premise']}")
    A(f"- **Problema:** {node['problem']}")
    A(f"- **Soglia (p{node['threshold_page']}):** {node['threshold_moment']}")
    A(f"- **Risoluzione (modo):** {node['resolution_mode']}")
    A(f"- **Chiusura (direzione):** {node['closure_text']}")
    if node.get("pugno"):
        A(f"- **Pugno emotivo:** {node['pugno']}")
    if node.get("personal_detail"):
        A(f"- **Da intessere (dettaglio personale):** {node['personal_detail']}")
    A("")
    A("## Cast")
    A("")
    for p in node["presence"]:
        A(f"- {p['who']} — *{p['state']}*")
    A(f"- Mondo: {node['world_flavor']} · Luogo: {node['setting_primary']}")
    A("")

    # semi / debito / motivo
    A("## Eco interne (l'evoluzione dentro la storia)")
    A("")
    A("Semi — introduci dove indicato, fai tornare con **peso diverso** "
      "senza che nessuno lo faccia notare:")
    for s in node.get("seeds", []):
        A(f"- `{s['id']}` ({s['kind']}): **{s['what']}** — pianta a p{s['planted_page']}, "
          f"ritorna a p{s['payoff_page']}.")
    if node.get("debt"):
        d = node["debt"]
        A(f"- Debito ({d['kind']}): **{d['what']}** — apre a p{d['opened_page']}, "
          f"chiude a p{d['closed_page']}.")
    if node.get("recurring_image"):
        r = node["recurring_image"]
        A(f"- Motivo ricorrente: **{r['motif']}** — pagine {r['pages']} (mai spiegarlo).")
    A("")

    # esecuzione apertura/chiusura
    A("## Come aprire e come chiudere")
    A("")
    A(f"- **Apertura {entry}** — {C.entry_point_type[entry]}. La prima pagina parte cosi'.")
    A(f"- **Chiusura {closure}** — {C.closure_type[closure]}. L'ultima pagina sigilla cosi', "
      "senza tirare morale.")
    A("")

    # voce frattale
    v = node.get("voice")
    if v:
        A("## Voce")
        A("")
        A("Carte di voce: **plasmano, non dettano**. Gli assi non elencati sono neutri.")
        A("")
        A("**Narratore** — assi attivi:")
        for ax in v["narrator"]["active_axes"]:
            c = v["narrator"]["cards"][ax]
            A(f"- *{ax} = {c['value']}*")
            if c.get("fai"):
                A(f"  - fai: {c['fai']}")
            if c.get("evita"):
                A(f"  - evita-tic: {c['evita']}")
            if c.get("lessico"):
                A(f"  - lessico: {c['lessico']}")
        A("")
        A("**Personaggi** — idioletto = firma costante (non profilo), tic distinti:")
        for name, c in v["characters"].items():
            A(f"- **{name}**: {c['tic_verbale']['hint']} · {c['tempo']['hint']} · {c['rivolgersi']['hint']}")
        A("")
        A("**Luoghi** — texture = firma sensoriale su tutte le pagine:")
        for loc, t in v["places"].items():
            A(f"- **{loc}**: {t['senso_dominante']['hint']}; {t['qualita_luce']['hint']}; "
              f"{t['dettaglio']['what']}")
        A("")

    # tabella pagina-per-pagina
    A("## Pagina per pagina")
    A("")
    A("| pag | beat | tipo hook | zona | nota di pagina |")
    A("|---|---|---|---|---|")
    for h in hooks:
        note = h["focal_action"]
        flags = []
        if h["markers"]["is_entry"]:
            flags.append(f"APERTURA {entry}")
        if h["markers"]["is_threshold"]:
            flags.append("SOGLIA")
        if h["markers"]["is_closure"]:
            flags.append(f"CHIUSURA {closure}")
        if flags:
            note = f"**[{' · '.join(flags)}]** {note}"
        A(f"| {h['page']} | {h['beat']} | {h['type']} | {h['composition_zone']} | {note} |")
    A("")
    A("## Promemoria di voce")
    A("")
    A(f"- Registro **{node['register']}**; ~{node['descriptive_pauses_target']} pausa/e descrittiva/e.")
    A("- Almeno un dettaglio non-funzionale, un pensiero laterale, un momento \"vuoto\".")
    A("- Quote anti-cliche: rispetta `lexicon` nel config. Niente frasi-da-mille-storie.")
    A("- Lo scheletro resta invisibile. Il senso sta nelle immagini, non in una frase che lo spiega.")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("node")
    ap.add_argument("hooks")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    C = seme_canon.load()
    node = json.loads(Path(args.node).read_text(encoding="utf-8"))
    page_hooks = json.loads(Path(args.hooks).read_text(encoding="utf-8"))
    brief = build_brief(node, page_hooks, C)

    import hooks as hooks_mod  # punti d'iniezione (assemble: cosa vede il prosatore)
    reg = hooks_mod.registry_for(node)
    brief = hooks_mod.run(reg, "post_brief", brief, {"config": C, "node": node})

    out = Path(args.out) if args.out else Path(args.node).with_name("writing_brief.md")
    out.write_text(brief, encoding="utf-8")
    print(f"brief OK -> {out}  ({len(brief)} char)"
          + (f"  [+{', '.join(hooks_mod.active_names(reg))}]" if reg else ""))


if __name__ == "__main__":
    main()
