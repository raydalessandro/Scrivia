#!/usr/bin/env python3
"""
validate_seed.py — Cancello fail-loud del SEED (prima fase, umano↔IA).

Il punto debole della pipeline e' la traduzione conversazione -> seed: se l'IA
dimentica o sbaglia un campo, il motore mette un default in silenzio e la storia
si indebolisce senza errore. Questo validatore chiude il buco: verifica che il
seed sia COMPLETO e COERENTE prima di costruire il nodo. FAIL-LOUD sui campi
duri; WARNING su cio' che degrada la qualita' ma non rompe.

Uso (CLI):
    python3 validate_seed.py <seed.yaml>
Uso (libreria):
    errors, warnings = validate_seed.validate(seed_dict, Canon)
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seme_canon  # noqa: E402

# campi duri: se mancano o sono vuoti/placeholder -> FAIL
REQUIRED = [
    ("protagonist.name", lambda s: (s.get("protagonist") or {}).get("name")),
    ("protagonist.age", lambda s: (s.get("protagonist") or {}).get("age")),
    ("world_flavor", lambda s: s.get("world_flavor")),
    ("theme", lambda s: s.get("theme")),
    ("pugno", lambda s: s.get("pugno")),
    ("spine.premise", lambda s: (s.get("spine") or {}).get("premise")),
    ("spine.problem", lambda s: (s.get("spine") or {}).get("problem")),
    ("spine.threshold_moment", lambda s: (s.get("spine") or {}).get("threshold_moment")),
    ("spine.resolution_mode", lambda s: (s.get("spine") or {}).get("resolution_mode")),
]
PLACEHOLDER_RE = re.compile(r"^\s*(\[.*\]|\.\.\.|<.*>|TODO)\s*$", re.I)


def _empty(v) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        return not v.strip() or bool(PLACEHOLDER_RE.match(v))
    return False


def validate(seed: dict, C: "seme_canon.Canon") -> tuple[list[str], list[str]]:
    errors, warnings = [], []

    # 1. campi duri presenti e non vuoti/placeholder
    for label, getter in REQUIRED:
        if _empty(getter(seed)):
            errors.append(f"campo mancante o vuoto: {label}")

    # 2. spina: ogni parte deve avere sostanza (non una parola buttata)
    spine = seed.get("spine") or {}
    for k in ("premise", "problem", "threshold_moment", "resolution_mode"):
        v = spine.get(k)
        if isinstance(v, str) and not _empty(v) and len(v.split()) < 4:
            warnings.append(f"spine.{k}: troppo corta ({len(v.split())} parole) — serve una frase concreta")

    # 3. tema -> mappa EAR (free theme ammesso, ma avvisa: si perde il bias)
    theme = (seed.get("theme") or "").strip().lower()
    if theme and theme not in C.theme_to_attribute:
        warnings.append(f"theme '{theme}' non e' tra le chiavi note {sorted(C.theme_to_attribute)} — "
                        f"l'attributo dominante verra' scelto a caso (bias EAR perso). "
                        f"Mappalo, o imposta overrides.attribute_dominant.")

    # 4. lunghezza nel range
    lp = seed.get("length_pages")
    if lp is not None:
        try:
            lp = int(lp)
            if not (C.pages_min <= lp <= C.pages_max):
                warnings.append(f"length_pages {lp} fuori range [{C.pages_min},{C.pages_max}] — verra' clampata")
        except (TypeError, ValueError):
            errors.append(f"length_pages non numerico: {lp!r}")

    # 5. lingua
    if _empty(seed.get("language")):
        warnings.append(f"language non impostata — default '{C.language}'")

    # 6. eta' plausibile
    age = (seed.get("protagonist") or {}).get("age")
    try:
        a = int(age)
        if not (0 <= a <= 18):
            warnings.append(f"protagonist.age {a} fuori dalla fascia bambini/ragazzi")
    except (TypeError, ValueError):
        pass  # gia' coperto da REQUIRED se vuoto

    # 7. crocette di voce (se presenti): assi/valori devono essere noti
    vov = (seed.get("overrides") or {}).get("voice") or {}
    axes = (C.voice or {}).get("axes", {})
    for ax, val in vov.items():
        if val in (None, ""):
            continue
        if ax not in axes:
            warnings.append(f"overrides.voice: asse '{ax}' sconosciuto (noti: {sorted(axes)}) — ignorato")
        elif val not in axes[ax]:
            warnings.append(f"overrides.voice.{ax}: valore '{val}' sconosciuto "
                            f"(validi: {sorted(axes[ax])}) — verra' campionato")

    return errors, warnings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("seed")
    args = ap.parse_args()

    import yaml
    C = seme_canon.load()
    seed = yaml.safe_load(Path(args.seed).read_text(encoding="utf-8"))
    errors, warnings = validate(seed, C)

    print(f"VALIDA SEED — {Path(args.seed).name}")
    if warnings:
        print("avvisi (degradano la qualita', non bloccano):")
        for w in warnings:
            print(f"  · {w}")
    if errors:
        print("ERRORI (bloccano la generazione):")
        for e in errors:
            print(f"  ✗ {e}")
        print("\nSeed INCOMPLETO: torna alla chat di seeding e completa prima di costruire.")
        raise SystemExit(1)
    print("OK — seed completo. Puoi costruire il nodo.")


if __name__ == "__main__":
    main()
