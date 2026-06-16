"""
pacchetto: ninnananna — storia della buonanotte.

Mostra come un pacchetto estende la pipeline ai punti d'iniezione SENZA toccare
il core: modella il nodo (assemble), aggiunge una nota al brief (assemble), e
aggiunge un controllo serale all'audit (execute). Tutti gli hook sono funzioni
pure e idempotenti.
"""
import re

MANIFEST = {
    "name": "ninnananna",
    "desc": "Storia della buonanotte: ritmo che culla, registro basso, voce "
            "cantilenante, niente spaventi, chiusura che addormenta.",
}

_SCARY = re.compile(r"(?i)\b(mostro|mostri|buio pesto|terrore|urlo|urla|sangue|incubo)\b")


def on_post_node(node, ctx):
    """assemble — culla il nodo: registro basso, voce cantilenante (idempotente)."""
    C = ctx["config"]
    node["register"] = "basso"
    node["register_range"] = C.register["basso"]
    # voce: forza temperamento=cantilenante tra gli assi attivi del narratore
    axes = C.voice["axes"]["temperamento"]
    narr = node.setdefault("voice", {}).setdefault("narrator", {"active_axes": [], "cards": {}})
    if "temperamento" not in narr["active_axes"]:
        narr["active_axes"] = ["temperamento"] + narr["active_axes"]
    card = {"value": "cantilenante"}
    for k in ("fai", "evita", "lessico"):
        if axes["cantilenante"].get(k):
            card[k] = axes["cantilenante"][k]
    narr["cards"]["temperamento"] = card
    notes = node.setdefault("pack_notes", [])
    note = "ninnananna: ritmo che culla, frasi che si abbassano, chiusura che addormenta (non apre)"
    if note not in notes:
        notes.append(note)
    return node


def on_post_brief(brief, ctx):
    """assemble — aggiunge la sezione del pacchetto in coda al brief."""
    block = (
        "\n## Pacchetto · ninnananna\n\n"
        "- **Ritmo che culla**: frasi che si abbassano verso la fine, ritorni di suono, "
        "niente scatti improvvisi.\n"
        "- **Niente spaventi**: nessun mostro, buio minaccioso, urla. Il mondo è sicuro.\n"
        "- **Chiusura che addormenta**: l'ultima pagina rallenta e chiude gli occhi della "
        "storia — non apre una domanda che tiene svegli.\n"
    )
    return brief if "Pacchetto · ninnananna" in brief else brief + block


def on_post_audit(report, ctx):
    """execute — controllo serale: parole poco adatte alla buonanotte (soft)."""
    found = sorted(set(m.group(0).lower() for m in _SCARY.finditer(report.get("text", ""))))
    if found:
        report.setdefault("soft", []).append(
            f"ninnananna: parole poco serali — {', '.join(found)} (valuta se ammorbidire)")
    return report
