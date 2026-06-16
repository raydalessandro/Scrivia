#!/usr/bin/env python3
"""
genlog.py — Log append-only delle generazioni (generations.jsonl).

Una riga JSON per evento. Mai sovrascrive, mai modifica: solo append. Ogni
storia diventa ricostruibile (stesso nonce + stesso seed -> stesso nodo) e ogni
run lascia traccia del verdetto. E' la "persistenza auditabile" del paper
(Decisione 6): leggibile, versionabile, ricostruibile senza strumenti speciali.

Default: scrive accanto a seme_config.yaml (un ledger per installazione).
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path


def default_path() -> Path:
    import seme_canon
    return seme_canon.find_config().parent / "generations.jsonl"


def append(record: dict, path: Path | None = None) -> Path:
    path = Path(path) if path else default_path()
    rec = {"ts": os.environ.get("SEME_BUILD_TS") or time.strftime("%Y-%m-%dT%H:%M:%S"), **record}
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return path


def tail(n: int = 10, path: Path | None = None) -> list[dict]:
    path = Path(path) if path else default_path()
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    return [json.loads(l) for l in lines[-n:] if l.strip()]


if __name__ == "__main__":
    import sys
    for r in tail(int(sys.argv[1]) if len(sys.argv) > 1 else 10):
        print(json.dumps(r, ensure_ascii=False))
