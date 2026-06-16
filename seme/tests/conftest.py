import os, sys, json, subprocess
from pathlib import Path
import pytest

REPO = Path(__file__).resolve().parent.parent
SCRIPTS = REPO / "scripts"
sys.path.insert(0, str(SCRIPTS))

import seme_canon, build_node, extract_hooks, build_brief, to_manus_prompts, invariants  # noqa


@pytest.fixture(autouse=True)
def _fixed_ts(monkeypatch):
    # build byte-identici nei test (anche nei sottoprocessi)
    monkeypatch.setenv("SEME_BUILD_TS", "2026-01-01T00:00:00")


@pytest.fixture
def C():
    return seme_canon.load()


@pytest.fixture
def good_seed():
    return {
        "seed_version": 1, "language": "it", "id": "s01", "title": "Prova",
        "protagonist": {"name": "Mia", "age": 6, "kind": "riccio"},
        "companions": [{"name": "Bo", "kind": "gatto"}],
        "world_flavor": "animali_del_bosco",
        "setting": {"primary": "il prato dietro casa"},
        "theme": "amicizia", "pugno": "Mia vuole fare amicizia in un posto nuovo",
        "personal_detail": "un nastro rosso", "length_pages": 12,
        "spine": {"premise": "Mia esce per la prima volta nel prato",
                  "problem": "vorrebbe parlare ma non sa come fare",
                  "threshold_moment": "Mia dice il proprio nome ad alta voce",
                  "resolution_mode": "camminano un pezzo insieme, piano"},
    }


@pytest.fixture
def node(C, good_seed):
    return build_node.build_node(good_seed, C, nonce=70125)


@pytest.fixture
def hooks(C, node):
    return extract_hooks.extract_hooks(node, C)


def run_cli(args, **kw):
    """Esegue uno script come CLI dalla root del repo."""
    env = {**os.environ, "SEME_BUILD_TS": "2026-01-01T00:00:00"}
    return subprocess.run([sys.executable, *args], cwd=REPO, env=env,
                          capture_output=True, text=True, **kw)


@pytest.fixture
def repo():
    return REPO


@pytest.fixture
def cli():
    return run_cli
