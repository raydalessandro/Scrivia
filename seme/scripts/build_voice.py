#!/usr/bin/env python3
"""
build_voice.py — Risolve la VOCE FRATTALE e la attacca al nodo.

La voce e' la COMBINAZIONE di pochi assi discreti, ognuno con una CARTA
(fai/evita-tic/lessico). La stessa macchina, leggera, scende su personaggi
(idioletto = firma) e luoghi (texture = firma sensoriale). Tutto deterministico
(rng salato dal nonce): nessun LLM, solo campi che il brief srotola.

Disciplina anti-rigidita': 2-4 assi narratore attivi (gli altri neutri), carte
che plasmano non dettano, frattale = firma non profilo.

Uso (libreria):  voice = build_voice.resolve(node, seed, C)
Uso (CLI):       python3 build_voice.py <node.json>   # attacca node["voice"]
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seme_canon  # noqa: E402

VOICE_SALT = 0x76_4F_43_45  # "vOCE"


def _card(axis_def: dict, value: str) -> dict:
    c = axis_def.get(value, {}) or {}
    out = {"value": value}
    for k in ("fai", "evita", "lessico"):
        if c.get(k):
            out[k] = c[k]
    return out


def resolve(node: dict, seed: dict, C: "seme_canon.Canon") -> dict:
    V = C.voice
    rng = random.Random(int(node["seed_nonce"]) ^ VOICE_SALT)
    ov = ((seed.get("overrides") or {}).get("voice")) or {}

    # --- NARRATORE: 2-4 assi attivi, gli altri neutri ----------------------
    axes = V["axes"]
    lo, hi = V.get("narrator_active_axes", [2, 4])
    forced = [a for a in ov if a in axes]
    target = max(len(forced), rng.randint(lo, hi))
    rest = [a for a in axes if a not in forced]
    rng.shuffle(rest)
    active = forced + rest[: max(0, target - len(forced))]
    # ordine stabile (come nel config) per leggibilita'
    active = [a for a in axes if a in active]

    bias = V.get("temperamento_lente_bias", {})
    chosen = {}
    cards = {}
    for ax in active:
        vals = list(axes[ax].keys())
        if ax in ov and ov[ax] in axes[ax]:
            val = ov[ax]
        elif ax == "lente_sensoriale" and chosen.get("temperamento") in bias and rng.random() < 0.6:
            val = bias[chosen["temperamento"]]            # nudge di coerenza
        else:
            val = rng.choice(vals)
        chosen[ax] = val
        cards[ax] = _card(axes[ax], val)

    narrator = {"active_axes": active, "cards": cards}

    # --- PERSONAGGI: idioletto = firma, tic DISTINTI -----------------------
    ch = V["character"]
    tics = list(ch["tic_verbale"].keys())
    rng.shuffle(tics)
    names = [(node.get("protagonist") or {}).get("name", "[protagonista]")]
    names += [c.get("name") for c in node.get("companions", []) if c.get("name")]
    characters = {}
    for i, name in enumerate(names):
        tic = tics[i % len(tics)]                          # distinti finche' bastano
        characters[name] = {
            "tic_verbale": {"value": tic, "hint": ch["tic_verbale"][tic]},
            "tempo": _pick(rng, ch["tempo"]),
            "rivolgersi": _pick(rng, ch["rivolgersi"]),
        }

    # --- LUOGHI: texture = firma sensoriale costante -----------------------
    pl = V["place"]
    primary = node.get("setting_primary", "[luogo]")
    dkind = rng.choice(pl["dettaglio_kind"])
    places = {
        primary: {
            "senso_dominante": _pick(rng, pl["senso_dominante"]),
            "qualita_luce": _pick(rng, pl["qualita_luce"]),
            "dettaglio": {"kind": dkind,
                          "what": seed.get("place_detail") or f"[{dkind.replace('_', ' ')} ricorrente del luogo]"},
        }
    }

    return {"narrator": narrator, "characters": characters, "places": places}


def _pick(rng, mapping: dict) -> dict:
    k = rng.choice(list(mapping.keys()))
    return {"value": k, "hint": mapping[k]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("node")
    ap.add_argument("--seed", default=None, help="seed.yaml (per overrides.voice e place_detail)")
    args = ap.parse_args()

    import yaml
    C = seme_canon.load()
    node = json.loads(Path(args.node).read_text(encoding="utf-8"))
    seed = yaml.safe_load(Path(args.seed).read_text(encoding="utf-8")) if args.seed else {}
    node["voice"] = resolve(node, seed, C)
    Path(args.node).write_text(json.dumps(node, ensure_ascii=False, indent=2), encoding="utf-8")
    v = node["voice"]
    print(f"voce -> {args.node}")
    print(f"  narratore [{len(v['narrator']['active_axes'])} assi]: "
          + ", ".join(f"{a}={v['narrator']['cards'][a]['value']}" for a in v['narrator']['active_axes']))
    for name, c in v["characters"].items():
        print(f"  {name}: tic={c['tic_verbale']['value']} · {c['tempo']['value']} · {c['rivolgersi']['value']}")
    for loc, t in v["places"].items():
        print(f"  luogo «{loc}»: {t['senso_dominante']['value']} · {t['qualita_luce']['value']}")


if __name__ == "__main__":
    main()
