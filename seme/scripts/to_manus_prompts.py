#!/usr/bin/env python3
"""
to_manus_prompts.py — Prompt immagine per Manus, STRUTTURA BLINDATA (metodo Isola).

Manus e' solo orchestrazione: con lavoro strutturato esegue e basta (lite o pro
uguale). Quindi tutta la coerenza la mette la STRUTTURA, deterministica. Porta il
metodo validato della saga (skills/scenografo, _TEMPLATE_prompt_manus):

  - BLOCCO STYLESHEET fisso in TESTA a ogni prompt (stile + negative + "NO text"
    + fascia alta quieta per il testo). Stesso testo identico ovunque = coerenza
    + cache. [risolve: stile che scivola]
  - SUBJECT per personaggio: SOLO descrittori autorizzati; l'aspetto e' fissato
    dalla reference (Passo 0), mai inventato. [risolve: dettagli che spariscono]
  - SCALA esplicita in ogni pagina multi-personaggio (protagonista = ancora,
    stessa linea di terra). [risolve: proporzioni sballate]
  - STORY MOMENT per pagina: azione + emozione + RELAZIONI SPAZIALI, in inglese,
    mai prosa grezza. [il generatore pesa male la prosa lunga]
  - POV esplicito per pagina (il lettore guarda da...). [risolve: PdV indefinito]
  - CHARACTER CONSISTENCY fisso in CODA: reference BINDING, non ispirazione.
  - Divieti ripetuti in OGNI prompt (il modello non ha memoria tra generazioni).

Uso:
    python3 to_manus_prompts.py <node.json> <hooks.json> [--out manus_prompts.md]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

WORLD_STYLE = {
    "animali_del_bosco": "Anthropomorphic woodland animals in the British picture-book tradition (Beatrix Potter, Brian Wildsmith), contemporary warmth; naturalistic animal anatomy, gently stylized, never cartoon-flat.",
    "casa": "Naturalistic children and everyday lived-in settings, gently stylized for warmth, never cartoon-flat.",
    "citta": "Naturalistic children in a warm everyday town, gently stylized, never cartoon-flat.",
    "spazio": "A gentle near-future space setting, soft and wondrous, naturalistic figures, never glossy sci-fi.",
    "sottomarino": "A soft underwater world, light filtering through water, naturalistic sea creatures, never cartoonish.",
    "fiabesco": "A quiet grounded fairy-tale world, warm and real, never kitsch fantasy.",
}
DEFAULT_WORLD_STYLE = "A warm, naturalistic picture-book world, gently stylized, never cartoon-flat."

SEASON_PALETTE_EN = {
    "inverno": "Earthy restrained palette with cool whites and soft blues, low clear winter light.",
    "primavera": "Earthy restrained palette with tender greens and pale yellows, new mobile spring light.",
    "estate": "Earthy restrained palette with warm ochres and full shadows, high summer light.",
    "autunno": "Earthy restrained palette with reds, browns and soft grays, low oblique autumn light.",
}

KIND_SCALE = {
    "uccello": 0.2, "ghiandaia": 0.2, "passero": 0.15, "gufo": 0.3, "corvo": 0.25,
    "gatto": 0.3, "coniglio": 0.3, "riccio": 0.2, "scoiattolo": 0.2, "volpe": 0.4,
    "cane": 0.45, "tasso": 0.4, "cerbiatto": 0.6, "pesce": 0.25,
    "adulto": 1.25, "bambino": 0.9, "bambina": 0.9,
}

BEAT_MOMENT = {
    "apertura": "the scene opens, calm and establishing",
    "distinguere": "noticing something, curious and a little wary",
    "connettere": "reaching toward someone or something, tentative and warm",
    "cambiare": "a decisive small action, the moment things shift",
    "chiusura": "the scene settles, quiet",
}
TYPE_POV = {
    "panorama": "a wide establishing shot, from a distance",
    "azione": "a medium shot at the characters' eye level",
    "introspettivo": "a close shot on the protagonist's face and hands",
    "atmosferico": "a wide atmospheric shot of the place",
    "transizione": "a medium tracking shot following the movement",
    "interno": "a medium shot inside the space",
    "dettaglio": "a macro close-up on the key detail",
}
ZONE_SPATIAL = {
    "sky_space": "subject low in the frame, wide quiet sky/space above (text band)",
    "ground_space": "subject high in the frame, open ground/space below",
    "side_space": "subject to one side, quiet open space on the other",
    "vignette": "small centered vignette, generous quiet margin around",
    "corner_lower_left": "subject in a corner, quiet space lower-left",
    "corner_lower_right": "subject in a corner, quiet space lower-right",
}


def _stylesheet(node: dict) -> str:
    world = WORLD_STYLE.get(node.get("world_flavor", ""), DEFAULT_WORLD_STYLE)
    palette = SEASON_PALETTE_EN.get(node.get("season", ""), "Earthy restrained palette.")
    age = (node.get("protagonist") or {}).get("age")
    ages = "ages 4-8" if (isinstance(age, int) and age <= 7) else "ages 5-10"
    return (
        f'ART STYLE — fixed for this book:\n'
        f'{world}\n'
        f'Watercolor over fine, slightly textured ink linework; gentle washes, soft '
        f'gradients, visible paper grain. {palette} Saturation always restrained — '
        f'never neon, never glossy, never plastic.\n'
        f'Lighting: soft natural light, warm and diffuse, gentle watercolor shadows, '
        f'no harsh contrast, no dramatic chiaroscuro. A serene, lived-in feeling.\n'
        f'PAGE COMPOSITION: keep the upper ~28% of the frame quiet and low-detail '
        f'(open sky, mist, soft wash, plain wall) — this band hosts the page text. '
        f'Faces and key action live in the lower two thirds.\n'
        f'NEGATIVE: NO 3D render, NO photorealistic detail, NO oil-painting heaviness, '
        f'NO anime, NO manga, NO chibi, NO disney/pixar cartoon, NO flat vector, '
        f'NO comic-book style, NO airbrush gloss, NO neon, NO dark gothic, NO horror. '
        f'NO text, NO lettering, NO signs or written words anywhere in the image '
        f'(added later by the book compositor). '
        f'A high-quality contemporary European picture book for {ages}.'
    )


def _characters(node: dict):
    prot = (node.get("protagonist") or {})
    pname = prot.get("name", "il protagonista")
    page = prot.get("age")
    world = node.get("world_flavor", "")
    pkind = (prot.get("kind") or "").strip().lower()
    if pkind:
        prot_kind = f"a young {pkind}"
    elif world == "animali_del_bosco":
        prot_kind = "a young woodland animal (species fixed by the reference sheet)"
    else:
        prot_kind = "a child"
    voice = (node.get("voice") or {}).get("characters", {})

    def demeanor(name):
        c = voice.get(name) or {}
        t = (c.get("tempo") or {}).get("value")
        return {"svelto": "lively, quick light posture", "lento": "calm, still posture",
                "a_scatti": "a fidgety, start-and-stop posture"}.get(t, "natural posture")

    out = [{"name": pname,
            "subject": f"{prot_kind}, narrative age {page}. {demeanor(pname)}. "
                       f"Appearance is fixed by the reference sheet (Passo 0) — reuse it exactly.",
            "scale": "1.0 (size anchor, the size reference for everyone)"}]
    for comp in node.get("companions", []):
        cn = comp.get("name", "")
        kind = (comp.get("kind") or "").lower()
        rel = KIND_SCALE.get(kind, 0.4)
        out.append({"name": cn,
                    "subject": f"a {kind or 'small animal'}. {demeanor(cn)}. "
                               f"Appearance fixed by the reference sheet — reuse it exactly.",
                    "scale": f"~{rel:.2f}x {pname}'s height"})
    return out


def _consistency(chars) -> str:
    names = ", ".join(c["name"] for c in chars)
    scale = "; ".join(f"{c['name']} {c['scale']}" for c in chars)
    return (
        f'CHARACTER CONSISTENCY — the attached reference images are BINDING, not '
        f'inspiration. Match them exactly for every named character ({names}): face/'
        f'muzzle shape and proportions, fur or hair color, eye color, build, clothing '
        f'and any signature item — never swapped, never missing. Relative heights: '
        f'{scale}. All characters stand on the same ground line. '
        f'Keep every character identical to its reference across all pages.'
    )


def _place_line(node: dict) -> str:
    places = (node.get("voice") or {}).get("places") or {}
    for loc, t in places.items():
        return (f'PLACE — {loc}: {t["qualita_luce"]["hint"]}; recognizable '
                f'{t["senso_dominante"]["hint"]}; {t["dettaglio"]["what"]}. '
                f'Keep this place identical across all pages.')
    return f'PLACE — {node.get("setting_primary", "the setting")}. Keep it identical across pages.'


def _story_moment(h: dict, prot: str) -> str:
    beat = BEAT_MOMENT.get(h["beat"], "the scene continues")
    present = h.get("characters_present", [prot])
    who = present[0] if present else prot
    others = (" with " + ", ".join(present[1:])) if len(present) > 1 else ""
    spatial = ZONE_SPATIAL.get(h["composition_zone"], "balanced composition")
    moment = f"{who}{others}: {beat}. Composition: {spatial}."
    fa = h.get("focal_action", "")
    extras = [s for s in fa.split("(")[1:]
              if any(e in s for e in ("introduce", "ritorna", "SOGLIA", "motivo", "apre", "chiude"))]
    if extras:
        moment += " " + " ".join(s.replace(")", "").strip() for s in extras)
    return moment


def build_prompts(node: dict, hooks: list) -> str:
    chars = _characters(node)
    style = _stylesheet(node)
    consistency = _consistency(chars)
    place = _place_line(node)
    multi = len(chars) > 1

    L = []
    A = L.append
    A(f"# PROMPT IMMAGINI (Manus) — {node.get('title','')}")
    A("")
    A("## Regole di sessione (perché le immagini restano coerenti)")
    A("- Manus è orchestrazione: con lavoro strutturato esegue e basta. La coerenza la mette la struttura qui sotto.")
    A("- I blocchi FISSI (STYLESHEET, CHARACTER CONSISTENCY) si incollano **identici** in ogni prompt: testo identico = coerenza + cache.")
    A("- Il modello **non ha memoria** tra le generazioni: ogni prompt è autosufficiente, con tutti i blocchi, anche se «ovvio».")
    A("- **Sessione fresca** per la storia, **ri-allega** sempre le reference. Una chat per batch, mai sessioni sature.")
    A("- **Passo 0**: genera prima le reference dei personaggi (STYLESHEET + SUBJECT). Quelle diventano le reference BINDING per le scene.")
    A("- Formato: **verticale 2:3**, una immagine per pagina, niente testo nell'immagine.")
    A("")
    A("## BLOCCO STYLESHEET — fisso, in TESTA a ogni prompt")
    A("```")
    A(style)
    A("```")
    A("")
    A("## CHARACTER CONSISTENCY — fisso, CHIUDE ogni prompt")
    A("```")
    A(consistency)
    A("```")
    A("")
    if multi:
        A("## SCALA — in ogni pagina con più personaggi")
        for c in chars:
            A(f"- **{c['name']}**: {c['scale']}")
        A("Tutti sulla stessa linea di terra.")
        A("")
    A("## Passo 0 — reference dei personaggi (genera PRIMA delle scene)")
    A("Per ogni personaggio: STYLESHEET + il suo SUBJECT qui sotto, 3 viste (fronte, 3/4, profilo). Usa queste reference su tutte le pagine.")
    for c in chars:
        A("")
        A(f"### SUBJECT — {c['name']}  (canone, riusare identico)")
        A("```")
        A(f"SUBJECT — {c['name']}: {c['subject']}")
        A("```")
    A("")
    A("## Prompt per pagina")
    A("Ricetta, in quest'ordine: **STYLESHEET → SUBJECT(personaggi in scena) → STORY MOMENT → POV → PLACE → CHARACTER CONSISTENCY**.")
    last_loc = None
    for h in hooks:
        present = h.get("characters_present", [])
        pov = TYPE_POV.get(h["type"], "a balanced medium shot")
        same = " (stesso luogo della pagina precedente — riusa la reference del luogo)" if h["location"] == last_loc else ""
        last_loc = h["location"]
        A("")
        A(f"### p{h['page']:02d} · {h['type']} · {h['beat']}")
        A(f"- **Personaggi in scena:** {', '.join(present) if present else '—'} (incolla i loro SUBJECT){same}")
        A(f"- **STORY MOMENT:** {_story_moment(h, (node.get('protagonist') or {}).get('name',''))}")
        A(f"- **POV (il lettore guarda):** {pov}")
        A(f"- **PLACE:** {place}")
        A(f"- **Reference da allegare:** {', '.join(present) if present else 'il luogo'} + il luogo")
        A(f"- **Salva come:** `immagini/p{h['page']:02d}.png`")
    A("")
    A("## Dopo la generazione")
    A("- Selezione umana. Quando un'immagine è approvata, salva il prompt completo che ha funzionato in `prompt_approvati.md`: se una scena simile torna, riparti da lì.")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("node")
    ap.add_argument("hooks")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    node = json.loads(Path(args.node).read_text(encoding="utf-8"))
    page_hooks = json.loads(Path(args.hooks).read_text(encoding="utf-8"))
    text = build_prompts(node, page_hooks)

    import hooks as hooks_mod  # assemble: cosa vede il modello immagini
    reg = hooks_mod.registry_for(node)
    text = hooks_mod.run(reg, "post_manus", text, {"node": node})

    out = Path(args.out) if args.out else Path(args.node).with_name("manus_prompts.md")
    out.write_text(text, encoding="utf-8")
    print(f"prompt Manus OK -> {out}  ({len(page_hooks)} pagine, struttura blindata)"
          + (f"  [+{', '.join(hooks_mod.active_names(reg))}]" if reg else ""))


if __name__ == "__main__":
    main()
