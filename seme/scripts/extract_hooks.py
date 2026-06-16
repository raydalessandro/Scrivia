#!/usr/bin/env python3
"""
extract_hooks.py — Dal NODO genera gli HOOK: uno per pagina (il piano-pagine).

Meccanico dal nodo: nessun LLM. Ogni hook porta i campi strutturali (tipo,
zona di composizione, cast, atmosfera, palette) + uno SCAFFOLD di focal_action
che e' insieme brief-immagine e peg per il prosatore. I marker (seme piantato/
pagato, soglia, entry, chiusura) collegano l'hook al grafo.

Uso:
    python3 extract_hooks.py <node.json> [--out hooks.json]
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seme_canon  # noqa: E402

ZONE_BIAS = {
    "panorama": ["sky_space", "ground_space"],
    "atmosferico": ["sky_space", "side_space"],
    "azione": ["ground_space", "side_space"],
    "introspettivo": ["vignette", "corner_lower_left"],
    "transizione": ["side_space", "ground_space"],
    "interno": ["vignette", "side_space"],
    "dettaglio": ["vignette", "corner_lower_right"],
}
BEAT_VERB = {
    "apertura": "si apre la scena",
    "distinguere": "si accorge / osserva",
    "connettere": "si avvicina / chiede / tende verso",
    "cambiare": "qualcosa si muove / attraversa",
    "chiusura": "si chiude la scena",
}


def _beat_of(page: int, beat_plan: list) -> str:
    for b in beat_plan:
        lo, hi = b["pages"]
        if lo <= page <= hi:
            return b["beat"]
    return "connettere"


def _pick_type(rng, candidates, recent: list, C) -> str:
    """Tipo dal bias del beat, evitando troppe ripetizioni consecutive."""
    pool = list(candidates)
    rng.shuffle(pool)
    for t in pool:
        run = 0
        for r in reversed(recent):
            if r == t:
                run += 1
            else:
                break
        if run < C.hooks.max_consecutive_same_type:
            return t
    return pool[0]


def extract_hooks(node: dict, C: "seme_canon.Canon") -> list:
    pages = node["pages"]
    rng = random.Random(node["seed_nonce"] ^ 0x5EED)
    beat_plan = node["beat_plan"]
    prot = (node.get("protagonist") or {}).get("name", "[protagonista]")
    companions = [c.get("name") for c in node.get("companions", [])]
    setting = node.get("setting_primary", "[luogo]")
    palette = node.get("palette_emotiva", "")
    threshold_page = node.get("threshold_page")

    # indicizza eventi-seme per pagina
    plant_on, payoff_on = {}, {}
    for s in node.get("seeds", []):
        plant_on.setdefault(s["planted_page"], []).append(s)
        payoff_on.setdefault(s["payoff_page"], []).append(s)
    debt = node.get("debt")
    rec = node.get("recurring_image")
    rec_pages = set(rec["pages"]) if rec else set()

    hooks, recent_types = [], []
    distinct = set()
    for page in range(1, pages + 1):
        beat = _beat_of(page, beat_plan)
        candidates = C.hooks.beat_type_bias.get(beat, list(C.hooks.types))
        htype = _pick_type(rng, candidates, recent_types, C)
        recent_types.append(htype)
        distinct.add(htype)
        zone = rng.choice(ZONE_BIAS.get(htype, list(C.hooks.composition_zones)))

        # cast: protagonista sempre; il compagno entra da 'connettere' in poi
        present = [prot]
        if companions and beat in ("connettere", "cambiare", "chiusura") and rng.random() < 0.8:
            present.append(companions[0])

        # focal_action: scaffold = verbo-beat + eventi di pagina
        parts = [f"{prot}: {BEAT_VERB[beat]}"]
        for s in plant_on.get(page, []):
            parts.append(f"(introduce: {s['what']})")
        for s in payoff_on.get(page, []):
            parts.append(f"(ritorna, con peso diverso: {s['what']})")
        if debt and page == debt.get("opened_page"):
            parts.append(f"(apre: {debt['what']})")
        if debt and page == debt.get("closed_page"):
            parts.append(f"(chiude: {debt['what']})")
        if page in rec_pages:
            parts.append(f"(motivo ricorrente: {rec['motif']})")
        if page == threshold_page:
            parts.append("(SOGLIA: il punto in cui qualcosa cambia davvero)")
        focal = " ".join(parts)

        atmosphere = f"{beat} · {palette}"
        markers = {
            "is_entry": page == 1,
            "is_closure": page == pages,
            "is_threshold": page == threshold_page,
            "seeds_planted": [s["id"] for s in plant_on.get(page, [])],
            "seeds_payoff": [s["id"] for s in payoff_on.get(page, [])],
        }
        if page == 1:
            markers["entry_point_type"] = node["entry_point_type"]
        if page == pages:
            markers["closure_type"] = node["closure_type"]

        hooks.append({
            "hook_id": f"p{page:02d}",
            "page": page,
            "type": htype,
            "beat": beat,
            "characters_present": present,
            "location": setting,
            "focal_action": focal,
            "atmosphere": atmosphere,
            "palette": palette,
            "composition_zone": zone,
            "markers": markers,
        })

    # garanzia varieta' minima: ripara deterministicamente invece di fallire
    distinct = set(h["type"] for h in hooks)
    if len(distinct) < C.hooks.min_distinct_types:
        unused = [t for t in C.hooks.types if t not in distinct]
        for h in hooks:
            if len(distinct) >= C.hooks.min_distinct_types or not unused:
                break
            idx = h["page"] - 1
            left = hooks[idx - 1]["type"] if idx - 1 >= 0 else None
            right = hooks[idx + 1]["type"] if idx + 1 < len(hooks) else None
            cand = next((t for t in unused if t not in (left, right)), None)
            if cand:
                h["type"] = cand
                h["composition_zone"] = rng.choice(ZONE_BIAS.get(cand, list(C.hooks.composition_zones)))
                distinct.add(cand)
                unused.remove(cand)
    return hooks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("node")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    C = seme_canon.load()
    node = json.loads(Path(args.node).read_text(encoding="utf-8"))
    hooks = extract_hooks(node, C)
    out = Path(args.out) if args.out else Path(args.node).with_name("hooks.json")
    out.write_text(json.dumps(hooks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"hook OK -> {out}  ({len(hooks)} pagine)")
    seq = " ".join(h["type"][:4] for h in hooks)
    print(f"  sequenza tipi: {seq}")


if __name__ == "__main__":
    main()
