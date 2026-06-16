#!/usr/bin/env python3
"""
hooks.py — Punti d'iniezione (Decisione 4 del paper): estendere la pipeline
SENZA toccare il core. Costo di contesto zero: sono funzioni Python pure.

Quattro eventi, mappati su assemble/execute:
  - post_node   (assemble) — modella il nodo: tutto a valle ne deriva
  - post_brief  (assemble) — cosa vede il prosatore
  - post_manus  (assemble) — cosa vede il modello immagini
  - post_audit  (execute)  — se/come l'output e' accettato

Un PACCHETTO e' una cartella `packs/<nome>/pack.py` che espone funzioni
`on_<evento>(payload, ctx) -> payload`. I pacchetti attivi viaggiano col nodo
(`node["packs"]`), cosi' ogni stadio sa quali caricare senza ri-passarli.

Determinismo: gli hook girano in ordine (ordine dei pacchetti, poi definizione)
e devono essere funzioni pure del payload. Idempotenza: e' responsabilita' del
pacchetto (gli hook d'esempio lo sono).
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

EVENTS = ("post_node", "post_brief", "post_manus", "post_audit")
_counter = 0


def packs_dir_default() -> Path:
    import seme_canon
    return seme_canon.find_config().parent / "packs"


def load_packs(names, packs_dir: Path | None = None) -> dict:
    """Carica i pacchetti elencati. FAIL-LOUD se un pacchetto non esiste."""
    global _counter
    packs_dir = Path(packs_dir) if packs_dir else packs_dir_default()
    registry = {e: [] for e in EVENTS}
    for name in names or []:
        pk = packs_dir / name / "pack.py"
        if not pk.exists():
            raise SystemExit(f"ERRORE: pacchetto '{name}' non trovato ({pk})")
        _counter += 1
        spec = importlib.util.spec_from_file_location(f"_pack_{name}_{_counter}", pk)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for e in EVENTS:
            fn = getattr(mod, f"on_{e}", None)
            if callable(fn):
                registry[e].append((name, fn))
    return registry


def registry_for(node: dict, packs_dir: Path | None = None) -> dict | None:
    names = (node or {}).get("packs") or []
    return load_packs(names, packs_dir) if names else None


def run(registry: dict | None, event: str, payload, ctx: dict):
    """Esegue in ordine gli hook dell'evento; ognuno trasforma il payload."""
    if not registry:
        return payload
    if event not in EVENTS:
        raise ValueError(f"evento sconosciuto: {event}")
    for name, fn in registry.get(event, []):
        payload = fn(payload, {**ctx, "pack": name, "event": event})
    return payload


def active_names(registry: dict | None) -> list[str]:
    if not registry:
        return []
    seen = []
    for e in EVENTS:
        for name, _ in registry.get(e, []):
            if name not in seen:
                seen.append(name)
    return seen


if __name__ == "__main__":
    import sys
    pd = packs_dir_default()
    print(f"packs dir: {pd}")
    if pd.exists():
        for d in sorted(p for p in pd.iterdir() if (p / "pack.py").exists()):
            reg = load_packs([d.name], pd)
            evs = [e for e in EVENTS if reg[e]]
            print(f"  · {d.name}: hook su {evs}")
    else:
        print("  (nessun pacchetto)")
