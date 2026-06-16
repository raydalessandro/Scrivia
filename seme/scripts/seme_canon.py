#!/usr/bin/env python3
"""
seme_canon.py — Loader del canone del motore SEME (seme_config.yaml).

Unico punto di accesso programmatico al canone: enum dell'arco, grammatica
strutturale, regole hook/semi, quote lessicali. I consumatori (build_node,
extract_hooks, build_brief, audit) importano da qui e NON duplicano costanti.

FAIL-LOUD: config assente o malformato -> CanonError. Meglio fermarsi che
costruire contro un canone sbagliato.

Dipendenze: PyYAML (stdlib + pyyaml).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

CONFIG_NAME = "seme_config.yaml"


class CanonError(RuntimeError):
    """Canone assente o malformato: i tool si fermano, non indovinano."""


def _req(d: dict, key: str, ctx: str):
    if not isinstance(d, dict) or key not in d:
        raise CanonError(f"{CONFIG_NAME}: chiave mancante {ctx}.{key}")
    return d[key]


def _compile(rx: str, ctx: str) -> re.Pattern:
    try:
        return re.compile(rx)
    except re.error as e:
        raise CanonError(f"{CONFIG_NAME}: regex invalida in {ctx}: {e}") from e


@dataclass(frozen=True)
class HooksCanon:
    id_re: re.Pattern
    focal_action_max_words: int
    max_consecutive_same_type: int
    min_distinct_types: int
    types: tuple[str, ...]
    composition_zones: tuple[str, ...]
    required_fields: tuple[str, ...]
    beat_type_bias: dict


@dataclass(frozen=True)
class SeedsCanon:
    count_short: int
    count_long: int
    kinds: tuple[str, ...]
    plant_within_first_fraction: float
    payoff_within_last_fraction: float


@dataclass(frozen=True)
class LexiconQuota:
    pattern: str
    re: re.Pattern
    max_per_story: int


@dataclass(frozen=True)
class Canon:
    config_version: int
    tool_id: str
    language: str
    pages_min: int
    pages_max: int
    pages_default: int
    words_per_page_avg: int
    attribute_dominant: tuple[str, ...]
    deployment_level: tuple[str, ...]
    theme_to_attribute: dict
    entry_point_type: dict          # {"A": "desc", ...}
    closure_type: dict              # {1: "desc", ...}
    closure_weights: dict           # {1: int, ...}
    register: dict                  # {"basso": [lo, hi], ...}
    age_to_register: dict
    time_span_arc: tuple[str, ...]
    hooks: HooksCanon
    seeds: SeedsCanon
    debt_probability: float
    debt_kinds: tuple[str, ...]
    recurring_image_probability: float
    recurring_image_occurrences: tuple[int, ...]
    descriptive_pauses_short: int
    descriptive_pauses_long: int
    banality_required: bool
    banality_min_fraction: float
    lexicon_quotas: tuple[LexiconQuota, ...]
    piano_family_res: tuple[re.Pattern, ...]
    piano_family_story_max: int
    voice: dict = field(compare=False, default_factory=dict)
    source_path: Path = field(compare=False, default=Path(CONFIG_NAME))


def find_config(start: Path | None = None) -> Path:
    base = (start or Path(__file__).resolve().parent)
    for p in (base, *base.parents):
        cand = p / CONFIG_NAME
        if cand.exists():
            return cand
    raise CanonError(
        f"{CONFIG_NAME} non trovato risalendo da {base} — copia il config nella "
        f"root del progetto-storia."
    )


def load(root: Path | None = None) -> Canon:
    try:
        import yaml
    except ImportError as e:
        raise CanonError("PyYAML assente: pip install pyyaml") from e

    path = (Path(root) / CONFIG_NAME) if root else find_config()
    if not path.exists():
        raise CanonError(f"{path} non esiste")
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise CanonError(f"{CONFIG_NAME}: YAML invalido: {e}") from e
    if not isinstance(raw, dict):
        raise CanonError(f"{CONFIG_NAME}: radice non e' un mapping")

    tool = _req(raw, "tool", "")
    story = _req(raw, "story", "")
    h = _req(raw, "hooks", "")
    s = _req(raw, "seeds", "")
    debt = _req(raw, "debt", "")
    rec = _req(raw, "recurring_image", "")
    vb = _req(raw, "voice_budget", "")
    dp = _req(vb, "descriptive_pauses", "voice_budget")
    lx = _req(raw, "lexicon", "")

    hooks = HooksCanon(
        id_re=_compile(_req(h, "id_regex", "hooks"), "hooks.id_regex"),
        focal_action_max_words=int(_req(h, "focal_action_max_words", "hooks")),
        max_consecutive_same_type=int(_req(h, "max_consecutive_same_type", "hooks")),
        min_distinct_types=int(_req(h, "min_distinct_types", "hooks")),
        types=tuple(_req(h, "types", "hooks")),
        composition_zones=tuple(_req(h, "composition_zones", "hooks")),
        required_fields=tuple(_req(h, "required_fields", "hooks")),
        beat_type_bias=dict(_req(h, "beat_type_bias", "hooks")),
    )
    seeds = SeedsCanon(
        count_short=int(_req(s, "count_short", "seeds")),
        count_long=int(_req(s, "count_long", "seeds")),
        kinds=tuple(_req(s, "kinds", "seeds")),
        plant_within_first_fraction=float(_req(s, "plant_within_first_fraction", "seeds")),
        payoff_within_last_fraction=float(_req(s, "payoff_within_last_fraction", "seeds")),
    )
    quotas = []
    for i, q in enumerate(_req(lx, "quotas", "lexicon")):
        pat = _req(q, "pattern", f"lexicon.quotas[{i}]")
        quotas.append(LexiconQuota(
            pattern=pat,
            re=_compile(pat, f"lexicon.quotas[{i}]"),
            max_per_story=int(_req(q, "max_per_story", f"lexicon.quotas[{i}]")),
        ))
    fam = _req(lx, "piano_family", "lexicon")
    fam_res = tuple(_compile(p, "lexicon.piano_family") for p in _req(fam, "patterns", "lexicon.piano_family"))

    # closure_type / closure_weights keys may be ints already (YAML int keys)
    closure_type = {int(k): v for k, v in _req(raw, "closure_type", "").items()}
    closure_weights = {int(k): int(v) for k, v in _req(raw, "closure_weights", "").items()}

    return Canon(
        config_version=int(_req(raw, "config_version", "")),
        tool_id=str(_req(tool, "id", "tool")),
        language=str(_req(tool, "language", "tool")),
        pages_min=int(_req(story, "pages_min", "story")),
        pages_max=int(_req(story, "pages_max", "story")),
        pages_default=int(_req(story, "pages_default", "story")),
        words_per_page_avg=int(_req(story, "words_per_page_avg", "story")),
        attribute_dominant=tuple(_req(raw, "attribute_dominant", "")),
        deployment_level=tuple(_req(raw, "deployment_level", "")),
        theme_to_attribute=dict(_req(raw, "theme_to_attribute", "")),
        entry_point_type=dict(_req(raw, "entry_point_type", "")),
        closure_type=closure_type,
        closure_weights=closure_weights,
        register=dict(_req(raw, "register", "")),
        age_to_register=dict(_req(raw, "age_to_register", "")),
        time_span_arc=tuple(_req(raw, "time_span_arc", "")),
        hooks=hooks,
        seeds=seeds,
        debt_probability=float(_req(debt, "probability", "debt")),
        debt_kinds=tuple(_req(debt, "kinds", "debt")),
        recurring_image_probability=float(_req(rec, "probability", "recurring_image")),
        recurring_image_occurrences=tuple(_req(rec, "occurrences", "recurring_image")),
        descriptive_pauses_short=int(_req(dp, "short", "voice_budget.descriptive_pauses")),
        descriptive_pauses_long=int(_req(dp, "long", "voice_budget.descriptive_pauses")),
        banality_required=bool(_req(vb, "banality_required", "voice_budget")),
        banality_min_fraction=float(_req(vb, "banality_min_fraction", "voice_budget")),
        lexicon_quotas=tuple(quotas),
        piano_family_res=fam_res,
        piano_family_story_max=int(_req(fam, "story_max", "lexicon.piano_family")),
        voice=dict(_req(raw, "voice", "")),
        source_path=path,
    )


if __name__ == "__main__":
    C = load()
    print(f"canone OK — tool {C.tool_id!r}, {len(C.attribute_dominant)} attributi, "
          f"{len(C.entry_point_type)} entry / {len(C.closure_type)} closure, "
          f"{len(C.hooks.types)} type hook, {len(C.lexicon_quotas)} quote lessicali.")
