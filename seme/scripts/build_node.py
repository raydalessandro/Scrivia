#!/usr/bin/env python3
"""
build_node.py — Costruisce il NODO-STORIA (grafo mini) da uno story_seed.yaml.

Il seed porta la SPINA NARRATIVA (premise/problem/threshold/resolution),
scritta in chat e personalizzata: e' l'unico "contenuto" che richiede un LLM.
Tutto il resto — la GRAMMATICA STRUTTURALE che da' complessita' e varieta' —
viene CAMPIONATO qui in modo deterministico, con regole di coerenza. Nessun
LLM, nessun token: la varieta' nasce dalla combinatoria degli enum.

Deterministico rispetto al `nonce`:
  - nonce nel seed  -> stessa storia ogni volta (riproducibile)
  - nonce assente   -> generato e SCRITTO nel nodo (storia diversa, riproducibile)

Uso:
    python3 build_node.py <seed.yaml> [--out node.json] [--nonce N] [--title "..."]
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seme_canon  # noqa: E402

SCHEMA_VERSION = "seme-1.0"

# Stagioni e palette atmosferiche generiche (il visual le usa; il prosatore le sente)
SEASONS = ["inverno", "primavera", "estate", "autunno"]
SEASON_PALETTE = {
    "inverno": "bianchi e azzurri freddi, luce bassa e netta",
    "primavera": "verdi teneri e gialli, luce nuova e mobile",
    "estate": "ori caldi e ombre piene, luce alta",
    "autunno": "rossi, bruni e grigi, luce obliqua che si abbassa",
}
# Slot di contenuto: il prosatore li riempie, il grafo fissa DOVE/QUANDO
SEED_SLOT_HINT = {
    "oggetto": "[oggetto concreto da introdurre presto e riprendere dopo]",
    "gesto": "[piccolo gesto ricorrente del protagonista]",
    "frase": "[breve frase detta presto che torna con peso diverso]",
    "suono": "[suono preciso che si ripresenta]",
    "dettaglio_del_mondo": "[dettaglio del mondo che continua per conto suo]",
}
DEBT_SLOT_HINT = {
    "promessa": "[promessa fatta presto, mantenuta vicino alla fine]",
    "domanda": "[domanda lasciata aperta presto, ripresa in chiusura]",
    "preoccupazione": "[piccola preoccupazione che si scioglie senza dichiararlo]",
    "oggetto_perso": "[oggetto perso presto, ritrovato/restituito vicino alla fine]",
}


def _wchoice(rng: random.Random, weights: dict):
    """Scelta pesata da {valore: peso}."""
    items, w = zip(*[(k, v) for k, v in weights.items() if v > 0])
    return rng.choices(items, weights=w, k=1)[0]


def _age_band(age, C) -> str:
    try:
        a = int(age)
    except (TypeError, ValueError):
        return "6-8"
    if a <= 5:
        return "0-5"
    if a <= 8:
        return "6-8"
    return "9-12"


def _neighbor_register(rng, band_register: str, C, p_shift: float = 0.30) -> str:
    """Registro = banda da eta', con varianza: a volte scivola di una banda."""
    order = ["basso", "medio", "alto"]
    i = order.index(band_register) if band_register in order else 1
    if rng.random() < p_shift:
        i = max(0, min(2, i + rng.choice([-1, 1])))
    return order[i]


def _distribute_pages(rng, total_mid: int, beats: list[str], dominant: str) -> dict:
    """Distribuisce le pagine centrali tra i beat EAR; il dominante pesa di piu'."""
    if not beats:
        return {}
    weights = {b: (2.0 if b == dominant else 1.0) for b in beats}
    s = sum(weights.values())
    raw = {b: max(1, round(total_mid * weights[b] / s)) for b in beats}
    # aggiusta per far quadrare la somma
    diff = total_mid - sum(raw.values())
    keys = list(raw.keys())
    while diff != 0 and keys:
        k = rng.choice(keys)
        if diff > 0:
            raw[k] += 1; diff -= 1
        elif raw[k] > 1:
            raw[k] -= 1; diff += 1
    return raw


def build_node(seed: dict, C: "seme_canon.Canon", nonce: int | None = None,
               title: str | None = None) -> dict:
    ov = seed.get("overrides") or {}

    # --- nonce / RNG (sorgente di varieta' riproducibile) -------------------
    if nonce is None:
        nonce = seed.get("nonce")
    if nonce is None:
        nonce = random.SystemRandom().randrange(1, 2**31)
    rng = random.Random(int(nonce))

    # --- pagine -------------------------------------------------------------
    pages = int(seed.get("length_pages") or C.pages_default)
    pages = max(C.pages_min, min(C.pages_max, pages))
    est_words = int(pages * C.words_per_page_avg * rng.uniform(0.9, 1.1))

    # --- EAR: attributo dominante + dispiegamento ---------------------------
    theme = (seed.get("theme") or "").strip().lower()
    attribute = ov.get("attribute_dominant") or C.theme_to_attribute.get(theme) \
        or rng.choice(C.attribute_dominant)
    if ov.get("deployment_level"):
        deployment = ov["deployment_level"]
    else:
        p_mono = 0.6 if pages <= 12 else 0.35
        deployment = "mono" if rng.random() < p_mono else "triadico"
    ear_arc = ["distinguere", "connettere", "cambiare"] if deployment == "triadico" \
        else [attribute]

    # --- grammatica strutturale (campionata) --------------------------------
    band = _age_band((seed.get("protagonist") or {}).get("age"), C)
    # entry: bias per eta' (piccoli -> concreto; grandi -> figurato)
    entry_bias = {"0-5": {"A": 3, "C": 3, "F": 3, "B": 1, "D": 1, "E": 1},
                  "6-8": {"A": 2, "B": 2, "C": 2, "D": 2, "E": 2, "F": 2},
                  "9-12": {"B": 3, "D": 3, "E": 3, "A": 1, "C": 1, "F": 1}}[band]
    entry = ov.get("entry_point_type") or _wchoice(rng, entry_bias)

    # closure: pesata; la 1 (frase di figura saggia) si attiva solo se c'e' un saggio
    cw = dict(C.closure_weights)
    has_sage = bool(seed.get("has_sage_figure"))
    if not has_sage:
        cw[1] = 0
    closure = ov.get("closure_type") or _wchoice(rng, cw)

    # registro: override esatto, oppure banda da eta' + varianza
    if ov.get("register"):
        register = ov["register"]
    else:
        band_reg = C.age_to_register.get(band, "medio")
        register = _neighbor_register(rng, band_reg, C)
    reg_range = C.register[register]

    # arco temporale: contenuto, salvo temi di cambiamento
    if ov.get("time_span_arc"):
        time_span = ov["time_span_arc"]
    elif attribute == "cambiare" or theme in ("crescere", "cambiamento", "passaggio", "perdita"):
        time_span = _wchoice(rng, {"un_giorno": 3, "piu_giorni": 2, "una_stagione": 2, "un_pomeriggio": 1})
    else:
        time_span = _wchoice(rng, {"un_pomeriggio": 3, "un_giorno": 3, "piu_giorni": 1})

    season = seed.get("season") or rng.choice(SEASONS)
    palette = f"{SEASON_PALETTE[season]} — pugno {register}"

    # --- beat plan: apertura + beat EAR + chiusura --------------------------
    open_pages = 1 if pages <= 12 else rng.choice([1, 2])
    close_pages = 1 if pages <= 12 else rng.choice([1, 2])
    mid = pages - open_pages - close_pages
    mid = max(len(ear_arc), mid)  # almeno una pagina per beat
    per_beat = _distribute_pages(rng, mid, ear_arc, attribute)

    beat_plan = []
    cur = 1
    beat_plan.append({"beat": "apertura", "pages": [cur, cur + open_pages - 1]})
    cur += open_pages
    for b in ear_arc:
        n = per_beat[b]
        beat_plan.append({"beat": b, "pages": [cur, cur + n - 1]})
        cur += n
    beat_plan.append({"beat": "chiusura", "pages": [cur, cur + close_pages - 1]})
    last = beat_plan[-1]["pages"][1]
    if last != pages:  # safety: clamp ultima pagina
        beat_plan[-1]["pages"][1] = pages

    # momento-soglia: inizio del beat 'cambiare' (triadico) o ~70% (mono)
    if "cambiare" in ear_arc:
        threshold_page = next(b["pages"][0] for b in beat_plan if b["beat"] == "cambiare")
    else:
        threshold_page = max(2, round(pages * 0.70))

    # --- semi intra-storia (l'evoluzione, collassata da saga a storia) ------
    n_seeds = C.seeds.count_short if pages <= 12 else C.seeds.count_long
    plant_hi = max(2, int(pages * C.seeds.plant_within_first_fraction))
    payoff_lo = min(pages - 1, int(pages * (1 - C.seeds.payoff_within_last_fraction)) + 1)
    kinds = list(C.seeds.kinds)
    rng.shuffle(kinds)
    seeds = []
    pre = (seed.get("seed_contents") or [])  # pre-fill opzionale dal seeding
    used_plant, used_payoff = set(), set()
    for i in range(n_seeds):
        kind = kinds[i % len(kinds)]
        # pianta presto, paga tardi, senza collisioni di pagina
        pp = next((p for p in rng.sample(range(2, plant_hi + 1), k=min(plant_hi - 1, plant_hi))
                   if p not in used_plant), min(2 + i, plant_hi))
        po = next((p for p in rng.sample(range(payoff_lo, pages + 1), k=max(1, pages - payoff_lo + 1))
                   if p not in used_payoff and p > pp), min(payoff_lo + i, pages))
        used_plant.add(pp); used_payoff.add(po)
        what = pre[i] if i < len(pre) else SEED_SLOT_HINT[kind]
        seeds.append({"id": f"seed_{i+1:02d}", "kind": kind, "what": what,
                      "planted_page": pp, "payoff_page": po})

    # --- micro-debito (0-1) -------------------------------------------------
    debt = None
    if rng.random() < C.debt_probability:
        dk = rng.choice(C.debt_kinds)
        debt = {"kind": dk, "what": seed.get("debt_content") or DEBT_SLOT_HINT[dk],
                "opened_page": rng.randint(1, max(1, plant_hi)),
                "closed_page": rng.randint(payoff_lo, pages)}

    # --- immagine ricorrente (motivo visivo, opzionale) ---------------------
    recurring = None
    if rng.random() < C.recurring_image_probability:
        occ = rng.choice(C.recurring_image_occurrences)
        spots = sorted(rng.sample(range(1, pages + 1), k=min(occ, pages)))
        recurring = {"motif": seed.get("recurring_motif") or "[motivo visivo che torna, mai spiegato]",
                     "pages": spots}

    # --- presenza del cast --------------------------------------------------
    protagonist = seed.get("protagonist") or {"name": "[protagonista]", "age": None}
    companions = seed.get("companions") or []
    presence = [{"who": protagonist.get("name", "[protagonista]"), "state": "attivo"}]
    for c in companions:
        presence.append({"who": c.get("name", "[compagno]"),
                         "state": rng.choice(["attivo", "sfondo"])})

    spine = seed.get("spine") or {}
    desc_pauses = C.descriptive_pauses_short if pages <= 12 else C.descriptive_pauses_long

    node = {
        "id": seed.get("id") or "s01",
        "title": title or seed.get("title") or "[titolo provvisorio]",
        "language": seed.get("language") or C.language,
        "schema_version": SCHEMA_VERSION,
        "built_at": os.environ.get("SEME_BUILD_TS") or time.strftime("%Y-%m-%dT%H:%M:%S"),
        "seed_nonce": int(nonce),

        # spine EAR (invisibile nel testo!)
        "attribute_dominant": attribute,
        "deployment_level": deployment,
        "ear_arc": ear_arc,

        # nucleo narrativo (dal seed, scritto in chat)
        "premise": spine.get("premise", "[premessa]"),
        "problem": spine.get("problem", "[problema]"),
        "threshold_moment": spine.get("threshold_moment", "[momento-soglia]"),
        "threshold_page": threshold_page,
        "resolution_mode": spine.get("resolution_mode", "[modo di risoluzione]"),
        "closure_text": spine.get("closure", "[chiusura: immagine che sigilla, non spiega]"),

        # grammatica strutturale (campionata)
        "entry_point_type": entry,
        "closure_type": closure,
        "register": register,
        "register_range": reg_range,
        "time_span_arc": time_span,
        "pages": pages,
        "estimated_words": est_words,

        # ambiente
        "world_flavor": seed.get("world_flavor") or "[sapore del mondo]",
        "setting_primary": (seed.get("setting") or {}).get("primary", "[luogo principale]"),
        "season": season,
        "palette_emotiva": palette,

        # cast
        "protagonist": protagonist,
        "companions": companions,
        "presence": presence,

        # piano dei beat
        "beat_plan": beat_plan,

        # evoluzione intra-storia
        "seeds": seeds,
        "debt": debt,
        "recurring_image": recurring,

        # budget di voce (machine-checkable)
        "descriptive_pauses_target": desc_pauses,
        "banality_required": C.banality_required,
        "pugno": seed.get("pugno", ""),
        "personal_detail": seed.get("personal_detail", ""),
    }
    import build_voice
    node["voice"] = build_voice.resolve(node, seed, C)
    return node


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("seed")
    ap.add_argument("--out", default=None)
    ap.add_argument("--nonce", type=int, default=None)
    ap.add_argument("--title", default=None)
    ap.add_argument("--log", default=None, help="path del generations.jsonl")
    ap.add_argument("--no-log", action="store_true")
    ap.add_argument("--skip-validate", action="store_true", help="salta il cancello del seed (sconsigliato)")
    ap.add_argument("--packs", default=None, help="pacchetti attivi, separati da virgola (override del seed)")
    args = ap.parse_args()

    import yaml
    C = seme_canon.load()
    seed = yaml.safe_load(Path(args.seed).read_text(encoding="utf-8"))

    if not args.skip_validate:
        import validate_seed
        errors, warnings = validate_seed.validate(seed, C)
        for w in warnings:
            print(f"  avviso seed · {w}")
        if errors:
            print("ERRORE: seed incompleto, non costruisco il nodo:")
            for e in errors:
                print(f"  ✗ {e}")
            raise SystemExit(1)

    node = build_node(seed, C, nonce=args.nonce, title=args.title)

    # pacchetti: viaggiano col nodo; applica gli hook post_node (assemble)
    packs = (args.packs.split(",") if args.packs else None) or seed.get("packs") or []
    packs = [p.strip() for p in packs if p and p.strip()]
    node["packs"] = packs
    if packs:
        import hooks
        node = hooks.run(hooks.load_packs(packs), "post_node", node,
                         {"config": C, "seed": seed})
        print(f"  pacchetti: {', '.join(packs)}")

    import invariants  # auto-check fail-loud post-build (guardrail runtime)
    viol = invariants.check_node(node, C)
    if viol:
        print("ERRORE: invarianti violati post-build (sampler o pacchetto):")
        for x in viol:
            print(f"  ✗ {x}")
        raise SystemExit(2)

    out = Path(args.out) if args.out else Path(args.seed).with_name("node.json")
    out.write_text(json.dumps(node, ensure_ascii=False, indent=2), encoding="utf-8")

    if not args.no_log:
        import genlog
        p = genlog.append({
            "event": "node_built", "story": node["id"], "title": node["title"],
            "nonce": node["seed_nonce"], "schema_version": node["schema_version"],
            "grammar": {k: node[k] for k in ("attribute_dominant", "deployment_level",
                        "entry_point_type", "closure_type", "register",
                        "time_span_arc", "pages", "threshold_page")},
            "seeds": [{"id": s["id"], "p": [s["planted_page"], s["payoff_page"]]}
                      for s in node["seeds"]],
        }, args.log)
        print(f"  log -> {p}")

    print(f"nodo OK -> {out}")
    print(f"  EAR: {node['attribute_dominant']} / {node['deployment_level']} {node['ear_arc']}")
    print(f"  entry {node['entry_point_type']} · closure {node['closure_type']} · "
          f"registro {node['register']} · {node['time_span_arc']} · {node['pages']}pp")
    print(f"  semi: {[ (s['planted_page'], '->', s['payoff_page']) for s in node['seeds'] ]}"
          f"  soglia@p{node['threshold_page']}  nonce={node['seed_nonce']}")


if __name__ == "__main__":
    main()
