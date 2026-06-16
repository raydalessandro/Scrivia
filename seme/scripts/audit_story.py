#!/usr/bin/env python3
"""
audit_story.py — Cancello qualita' a STRATI con report unico.

Tre strati con modi di guasto INDIPENDENTI (vedi ARCHITETTURA.md):
  1. regex        — quote lessicali / famiglia 'piano'      (cliche letterali)
  2. strutturale  — pagine attese, ritorno semi, soglia     (buchi di forma)
  3. critic       — verdetto semantico dal SKILL_critic.md   (il senso)

Gli strati 1-2 sono deterministici (qui). Lo strato 3 e' un verdetto JSON
prodotto in chat (skill/SKILL_critic.md) e passato con --critic: l'audit lo
fonde nel report. Verdetto finale = FAIL se UN qualsiasi strato ha una
violazione dura.

Uso:
    python3 audit_story.py <story.md> [--node node.json] [--critic critic_verdict.json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seme_canon  # noqa: E402

HOOK_RE = re.compile(r"<!--\s*@hook\s+p(\d{2})\s*\|\s*@page\s+(\d+)\s*-->")


def layer_regex(text: str, C):
    """Strato 1 — quote lessicali. hard = quota 0 sforata."""
    hard, soft = [], []
    for q in C.lexicon_quotas:
        n = len(q.re.findall(text))
        if n > q.max_per_story:
            msg = f"/{q.pattern}/ → {n}x (max {q.max_per_story})"
            (hard if q.max_per_story == 0 else soft).append(msg)
    fam = sum(len(rx.findall(text)) for rx in C.piano_family_res)
    if fam > C.piano_family_story_max:
        soft.append(f"famiglia 'piano' → {fam}x (max {C.piano_family_story_max})")
    return hard, soft


def layer_struct(pages, node):
    """Strato 2 — forma. hard = pagine sbagliate o seme non ripreso."""
    hard, soft = [], []
    if not node:
        return hard, ["nodo non passato: copertura pagine e semi non verificati"]
    expected = list(range(1, node["pages"] + 1))
    if pages != expected:
        hard.append(f"pagine: trovate {pages}, attese {expected}")
    for s in node.get("seeds", []):
        if s["payoff_page"] not in pages:
            hard.append(f"seme {s['id']}: manca la pagina di ritorno p{s['payoff_page']}")
    d = node.get("debt")
    if d and d.get("closed_page") not in pages:
        soft.append(f"debito: manca la pagina di chiusura p{d['closed_page']}")
    return hard, soft


def layer_critic(critic):
    """Strato 3 — senso. hard = check dura fallita o page_flag severity=hard."""
    if critic is None:
        return None, None, "non eseguito (vedi skill/SKILL_critic.md)"
    hard, soft = [], []
    for name, r in (critic.get("checks") or {}).items():
        if not r.get("pass", True):
            (hard if name in ("scheletro_invisibile", "niente_moralina") else soft).append(
                f"{name}: {r.get('note', '').strip() or 'fallita'}")
    for f in critic.get("page_flags") or []:
        line = f"p{f.get('page')}: {f.get('issue', '').strip()}"
        (hard if f.get("severity") == "hard" else soft).append(line)
    return hard, soft, None


def _print_layer(title, hard, soft, status_note=None):
    print(f"\n[{title}]")
    if status_note:
        print(f"  · {status_note}")
        return
    if not hard and not soft:
        print("  OK")
    for x in hard:
        print(f"  ✗ {x}")
    for x in soft:
        print(f"  · {x}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("story")
    ap.add_argument("--node", default=None)
    ap.add_argument("--critic", default=None)
    ap.add_argument("--log", default=None, help="path del generations.jsonl")
    ap.add_argument("--no-log", action="store_true")
    args = ap.parse_args()

    C = seme_canon.load()
    md = Path(args.story).read_text(encoding="utf-8")
    text = "\n".join(l for l in md.splitlines() if not l.strip().startswith("<!--"))
    pages = [int(m.group(2)) for m in HOOK_RE.finditer(md)]
    node = json.loads(Path(args.node).read_text(encoding="utf-8")) if args.node else None
    critic = json.loads(Path(args.critic).read_text(encoding="utf-8")) if args.critic else None

    r_hard, r_soft = layer_regex(text, C)
    s_hard, s_soft = layer_struct(pages, node)
    c_hard, c_soft, c_note = layer_critic(critic)

    # strato 4 (execute): un pacchetto puo' aggiungere controlli di genere
    import hooks as hooks_mod
    reg = hooks_mod.registry_for(node) if node else None
    p_hard, p_soft = [], []
    if reg:
        report = hooks_mod.run(reg, "post_audit",
                               {"text": text, "pages": pages, "node": node, "hard": [], "soft": []},
                               {"config": C})
        p_hard, p_soft = list(report.get("hard", [])), list(report.get("soft", []))

    words = len(re.findall(r"\w+", text))
    print(f"AUDIT — {Path(args.story).name}: {len(pages)} pagine, ~{words} parole")
    _print_layer("1 · regex (cliche letterali)", r_hard, r_soft)
    _print_layer("2 · strutturale (forma)", s_hard, s_soft)
    _print_layer("3 · critic (senso)", c_hard or [], c_soft or [], c_note)
    if reg:
        _print_layer("4 · pacchetti (" + ", ".join(hooks_mod.active_names(reg)) + ")", p_hard, p_soft)

    all_hard = r_hard + s_hard + (c_hard or []) + p_hard
    verdict = "FAIL" if all_hard else "PASS"

    if not args.no_log:
        import genlog
        genlog.append({
            "event": "audit",
            "story": (node or {}).get("id", Path(args.story).stem),
            "verdict": verdict, "hard": len(all_hard),
            "layers": {
                "regex": "fail" if r_hard else "ok",
                "struct": "fail" if s_hard else "ok",
                "critic": "pending" if critic is None else ("fail" if c_hard else "pass"),
                "packs": ("fail" if p_hard else "ok") if reg else "none",
            },
        }, args.log)

    print("\n" + "─" * 48)
    if all_hard:
        print(f"VERDETTO: FAIL ({len(all_hard)} violazioni dure)")
        raise SystemExit(1)
    pending = " (strato 3 da eseguire)" if critic is None else ""
    print(f"VERDETTO: PASS{pending}")


if __name__ == "__main__":
    main()
