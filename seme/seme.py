#!/usr/bin/env python3
"""
seme.py — Driver della pipeline. CLI sottile sopra gli script deterministici.

Attraversa da solo TUTTI i segmenti deterministici (validazione → nodo → hook →
brief → prompt → montaggio → audit) e si ferma, in chiaro, ai DUE gate che NON
sono automatizzabili per scelta:
  - GATE PROSA  : la scrive un LLM in chat (skill/SKILL_prosa.md) dal brief.
  - GATE IMMAGINI: le genera Manus dal file prompt (canone/PROMPT_TEMPLATE.md).
Non finge di attraversarli: li segnala e dice il comando successivo.

Comandi:
  seme new <dir>                      scaffold di una storia nuova (dal template)
  seme build <dir> [--packs P] [--nonce N]
                                      validazione→nodo→hook→brief→prompt (→ GATE PROSA)
  seme assemble <dir>                 monta il libro (story.md + immagini → libro.html)
  seme check <dir> [--critic F]       audit a strati
  seme all <dir> [...]                build; se c'e' story.md: assemble + check
  seme status <dir>                   cosa c'e' e qual e' il passo successivo
  seme packs                          elenca i pacchetti disponibili
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent
SCRIPTS = REPO / "scripts"
TEMPLATE = REPO / "skill" / "seed.template.yaml"


def _run(script: str, *args: str) -> int:
    r = subprocess.run([sys.executable, str(SCRIPTS / script), *args])
    return r.returncode


def _need(p: Path, what: str, hint: str):
    if not p.exists():
        sys.exit(f"✗ manca {what}: {p}\n  → {hint}")


def _paths(d: Path):
    return {
        "seed": d / "story_seed.yaml", "node": d / "node.json",
        "hooks": d / "hooks.json", "brief": d / "writing_brief.md",
        "manus": d / "manus_prompts.md", "story": d / "story.md",
        "critic": d / "critic_verdict.json", "book": d / "libro.html",
        "images": d / "immagini",
    }


def cmd_new(args):
    d = Path(args.dir)
    if d.exists() and any(d.iterdir()):
        sys.exit(f"✗ {d} esiste e non e' vuota.")
    d.mkdir(parents=True, exist_ok=True)
    (d / "immagini").mkdir(exist_ok=True)
    _need(TEMPLATE, "template", "ripristina skill/seed.template.yaml")
    shutil.copy(TEMPLATE, d / "story_seed.yaml")
    print(f"✓ creata {d}/")
    print(f"  1. compila {d}/story_seed.yaml (chat di seeding: skill/SKILL_seeding.md)")
    print(f"  2. seme build {d}")


def cmd_build(args):
    d = Path(args.dir)
    P = _paths(d)
    _need(P["seed"], "story_seed.yaml", f"seme new {d}")
    extra = (["--packs", args.packs] if args.packs else []) + \
            (["--nonce", str(args.nonce)] if args.nonce is not None else [])
    print("· validazione + nodo …")
    if _run("build_node.py", str(P["seed"]), "--out", str(P["node"]), *extra) != 0:
        sys.exit(1)
    print("· hook (piano pagine) …")
    if _run("extract_hooks.py", str(P["node"]), "--out", str(P["hooks"])) != 0:
        sys.exit(1)
    print("· brief (zero-token) …")
    if _run("build_brief.py", str(P["node"]), str(P["hooks"]), "--out", str(P["brief"])) != 0:
        sys.exit(1)
    print("· prompt immagini (Manus) …")
    if _run("to_manus_prompts.py", str(P["node"]), str(P["hooks"]), "--out", str(P["manus"])) != 0:
        sys.exit(1)
    _gate_prosa(d, P)


def _gate_prosa(d: Path, P: dict):
    print("\n" + "═" * 60)
    print("✋ GATE PROSA — passo umano/LLM (non automatizzabile per scelta)")
    print(f"   Scrivi la prosa in chat seguendo skill/SKILL_prosa.md")
    print(f"   dal brief: {P['brief']}  →  salva in: {P['story']}")
    print(f"\n✋ GATE IMMAGINI — Manus")
    print(f"   {P['manus']} → Manus (canone/PROMPT_TEMPLATE.md) → {P['images']}/pNN.png")
    print(f"\n   Poi:  seme assemble {d}   e   seme check {d}")
    print("═" * 60)


def cmd_assemble(args):
    d = Path(args.dir)
    P = _paths(d)
    _need(P["story"], "story.md", "scrivi la prosa dal brief (GATE PROSA)")
    code = _run("build_book.py", str(P["story"]), "--node", str(P["node"]),
                "--out", str(P["book"]))
    if code == 0:
        print(f"  apri {P['book']} → Stampa → PDF A5.")
    sys.exit(code)


def cmd_check(args):
    d = Path(args.dir)
    P = _paths(d)
    _need(P["story"], "story.md", "scrivi la prosa dal brief (GATE PROSA)")
    extra = ["--critic", args.critic] if args.critic else \
            (["--critic", str(P["critic"])] if P["critic"].exists() else [])
    sys.exit(_run("audit_story.py", str(P["story"]), "--node", str(P["node"]), *extra))


def cmd_all(args):
    d = Path(args.dir)
    P = _paths(d)
    cmd_build(args)
    if P["story"].exists():
        print("\n· story.md presente → montaggio + audit")
        _run("build_book.py", str(P["story"]), "--node", str(P["node"]), "--out", str(P["book"]))
        extra = ["--critic", str(P["critic"])] if P["critic"].exists() else []
        _run("audit_story.py", str(P["story"]), "--node", str(P["node"]), *extra)


def cmd_status(args):
    d = Path(args.dir)
    P = _paths(d)
    order = [("seed", "story_seed.yaml"), ("node", "nodo"), ("hooks", "hook"),
             ("brief", "brief"), ("manus", "prompt immagini"), ("story", "prosa"),
             ("book", "libro")]
    print(f"stato {d}/")
    for key, label in order:
        print(f"  [{'✓' if P[key].exists() else ' '}] {label}")
    nimg = len(list(P["images"].glob("p*.png"))) if P["images"].exists() else 0
    print(f"  [{'✓' if nimg else ' '}] immagini ({nimg})")
    if not P["seed"].exists():
        nxt = f"seme new {d}"
    elif not P["brief"].exists():
        nxt = f"seme build {d}"
    elif not P["story"].exists():
        nxt = "GATE PROSA — scrivi la prosa dal brief in chat"
    elif not P["book"].exists():
        nxt = f"seme assemble {d}  (servono anche le immagini)"
    else:
        nxt = f"seme check {d}"
    print(f"  → prossimo: {nxt}")


def cmd_packs(args):
    _run("hooks.py")


def main():
    ap = argparse.ArgumentParser(prog="seme", description="driver della pipeline seme")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("new"); p.add_argument("dir"); p.set_defaults(fn=cmd_new)
    p = sub.add_parser("build"); p.add_argument("dir")
    p.add_argument("--packs", default=None); p.add_argument("--nonce", type=int, default=None)
    p.set_defaults(fn=cmd_build)
    p = sub.add_parser("assemble"); p.add_argument("dir"); p.set_defaults(fn=cmd_assemble)
    p = sub.add_parser("check"); p.add_argument("dir")
    p.add_argument("--critic", default=None); p.set_defaults(fn=cmd_check)
    p = sub.add_parser("all"); p.add_argument("dir")
    p.add_argument("--packs", default=None); p.add_argument("--nonce", type=int, default=None)
    p.set_defaults(fn=cmd_all)
    p = sub.add_parser("status"); p.add_argument("dir"); p.set_defaults(fn=cmd_status)
    p = sub.add_parser("packs"); p.set_defaults(fn=cmd_packs)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
