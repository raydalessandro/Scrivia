#!/usr/bin/env python3
"""
invariants.py — Tutti gli invarianti strutturali in UN posto.

Verifica che un nodo (e i suoi hook) rispetti le regole che il campionatore e i
pacchetti devono mantenere. Doppio uso, costo zero:
  - `build_node` lo chiama come AUTO-CHECK fail-loud post-build (guardrail runtime,
    copre anche le modifiche dei pacchetti);
  - i test lo usano come oracolo su un fuzz di seed/nonce.

Ogni funzione ritorna una lista di stringhe-violazione (vuota = OK). Non solleva:
chi chiama decide se fermarsi.
"""
from __future__ import annotations


def check_node(node: dict, C) -> list[str]:
    v = []
    pages = node.get("pages")

    # --- enum validi ---
    enum_checks = [
        ("attribute_dominant", node.get("attribute_dominant"), C.attribute_dominant),
        ("deployment_level", node.get("deployment_level"), C.deployment_level),
        ("entry_point_type", node.get("entry_point_type"), C.entry_point_type),
        ("closure_type", node.get("closure_type"), C.closure_type),
        ("register", node.get("register"), C.register),
        ("time_span_arc", node.get("time_span_arc"), C.time_span_arc),
    ]
    for name, val, allowed in enum_checks:
        if val not in allowed:
            v.append(f"{name}={val!r} non in {sorted(allowed) if not isinstance(allowed, dict) else sorted(allowed)}")

    # --- pagine nel range ---
    if not isinstance(pages, int) or not (C.pages_min <= pages <= C.pages_max):
        v.append(f"pages={pages} fuori range [{C.pages_min},{C.pages_max}]")
        return v  # senza pages valido, il resto non ha senso

    # --- ear_arc coerente col dispiegamento ---
    dep, attr, arc = node.get("deployment_level"), node.get("attribute_dominant"), node.get("ear_arc")
    if dep == "mono" and arc != [attr]:
        v.append(f"ear_arc {arc} != [{attr!r}] per mono")
    if dep == "triadico" and arc != ["distinguere", "connettere", "cambiare"]:
        v.append(f"ear_arc {arc} != triade canonica per triadico")

    # --- beat_plan partiziona 1..pages in modo contiguo ---
    bp = node.get("beat_plan") or []
    ranges = sorted(((b["pages"][0], b["pages"][1], b["beat"]) for b in bp))
    cursor = 1
    for lo, hi, beat in ranges:
        if lo != cursor:
            v.append(f"beat_plan: buco/sovrapposizione a p{cursor} (trovato inizio p{lo} per '{beat}')")
        if hi < lo:
            v.append(f"beat_plan: range invertito {beat} [{lo},{hi}]")
        cursor = hi + 1
    if ranges and ranges[-1][1] != pages:
        v.append(f"beat_plan: ultima pagina {ranges[-1][1]} != {pages}")
    if ranges and ranges[0][0] != 1:
        v.append("beat_plan: non parte da p1")

    # --- soglia nel beat giusto ---
    tp = node.get("threshold_page")
    if "cambiare" in (arc or []):
        camb = next((b for b in bp if b["beat"] == "cambiare"), None)
        if camb and tp != camb["pages"][0]:
            v.append(f"threshold_page={tp} != inizio beat 'cambiare' (p{camb['pages'][0]})")
    else:
        if not (2 <= (tp or 0) <= pages):
            v.append(f"threshold_page={tp} fuori [2,{pages}] (mono)")

    # --- semi: pianta < paga, nelle frazioni previste, senza collisioni ---
    plant_hi = max(2, int(pages * C.seeds.plant_within_first_fraction))
    payoff_lo = min(pages - 1, int(pages * (1 - C.seeds.payoff_within_last_fraction)) + 1)
    pl, po = set(), set()
    for s in node.get("seeds", []):
        a, b = s.get("planted_page"), s.get("payoff_page")
        if not (isinstance(a, int) and isinstance(b, int) and a < b):
            v.append(f"seme {s.get('id')}: pianta {a} non < paga {b}")
            continue
        if not (2 <= a <= plant_hi):
            v.append(f"seme {s.get('id')}: pianta p{a} fuori [2,{plant_hi}]")
        if not (payoff_lo <= b <= pages):
            v.append(f"seme {s.get('id')}: paga p{b} fuori [{payoff_lo},{pages}]")
        if a in pl:
            v.append(f"seme {s.get('id')}: collisione pagina-pianta p{a}")
        if b in po:
            v.append(f"seme {s.get('id')}: collisione pagina-paga p{b}")
        pl.add(a); po.add(b)

    # --- debito (se presente): apre <= chiude, nei limiti ---
    d = node.get("debt")
    if d:
        oa, oc = d.get("opened_page"), d.get("closed_page")
        if not (isinstance(oa, int) and isinstance(oc, int) and 1 <= oa <= oc <= pages):
            v.append(f"debito: apre {oa} / chiude {oc} non coerenti in [1,{pages}]")

    # --- voce: assi attivi nel range, valori validi, idioletti distinti ---
    voice = node.get("voice")
    if voice:
        axes_def = C.voice["axes"]
        narr = voice.get("narrator", {})
        active = narr.get("active_axes", [])
        lo_a, hi_a = C.voice.get("narrator_active_axes", [2, 4])
        # un pacchetto puo' forzare un asse extra: tolleranza superiore di +1
        if not (lo_a <= len(active) <= hi_a + 1):
            v.append(f"voce: {len(active)} assi attivi fuori [{lo_a},{hi_a}(+1 pacchetti)]")
        for ax in active:
            val = narr.get("cards", {}).get(ax, {}).get("value")
            if ax not in axes_def or val not in axes_def[ax]:
                v.append(f"voce: asse/valore non valido {ax}={val!r}")
        tics = [c.get("tic_verbale", {}).get("value") for c in voice.get("characters", {}).values()]
        if len(tics) != len(set(tics)):
            v.append(f"voce: idioletti non distinti (tic ripetuti: {tics})")
        if not voice.get("places"):
            v.append("voce: manca la texture del luogo")

    return v


def check_hooks(hooks: list, node: dict, C) -> list[str]:
    v = []
    pages = node.get("pages")
    if len(hooks) != pages:
        v.append(f"hook: {len(hooks)} != {pages} pagine")

    types_seen, runs, prev = set(), 0, None
    plant = {s["planted_page"]: s["id"] for s in node.get("seeds", [])}
    payoff = {s["payoff_page"]: s["id"] for s in node.get("seeds", [])}

    for i, h in enumerate(hooks, start=1):
        if h.get("hook_id") != f"p{i:02d}":
            v.append(f"hook #{i}: id {h.get('hook_id')} != p{i:02d}")
        if h.get("type") not in C.hooks.types:
            v.append(f"hook p{i}: tipo {h.get('type')!r} non valido")
        types_seen.add(h.get("type"))
        if h.get("type") == prev:
            runs += 1
            if runs >= C.hooks.max_consecutive_same_type:
                v.append(f"hook p{i}: >{C.hooks.max_consecutive_same_type} '{h.get('type')}' consecutivi")
        else:
            runs = 0
        prev = h.get("type")

        m = h.get("markers", {})
        if i == 1 and not m.get("is_entry"):
            v.append("hook p1: manca is_entry")
        if i == 1 and m.get("entry_point_type") != node.get("entry_point_type"):
            v.append("hook p1: entry_point_type non coerente")
        if i == pages and not m.get("is_closure"):
            v.append(f"hook p{pages}: manca is_closure")
        if i == pages and m.get("closure_type") != node.get("closure_type"):
            v.append(f"hook p{pages}: closure_type non coerente")
        if (i == node.get("threshold_page")) != bool(m.get("is_threshold")):
            v.append(f"hook p{i}: marker soglia incoerente")
        # marker semi coerenti col nodo
        if i in plant and plant[i] not in m.get("seeds_planted", []):
            v.append(f"hook p{i}: manca marker pianta {plant[i]}")
        if i in payoff and payoff[i] not in m.get("seeds_payoff", []):
            v.append(f"hook p{i}: manca marker paga {payoff[i]}")

    if len(types_seen) < C.hooks.min_distinct_types:
        v.append(f"hook: {len(types_seen)} tipi distinti < {C.hooks.min_distinct_types}")
    return v
