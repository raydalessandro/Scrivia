import pytest
import hooks as hooks_mod
import build_node


def test_discovery():
    reg = hooks_mod.load_packs(["ninnananna"])
    assert reg["post_node"] and reg["post_brief"] and reg["post_audit"]


def test_missing_pack_fails():
    with pytest.raises(SystemExit):
        hooks_mod.load_packs(["non_esiste_xyz"])


def test_post_node_culls(C, good_seed):
    good_seed["packs"] = ["ninnananna"]
    node = build_node.build_node(good_seed, C, nonce=70125)
    node["packs"] = ["ninnananna"]
    reg = hooks_mod.load_packs(["ninnananna"])
    out = hooks_mod.run(reg, "post_node", node, {"config": C, "seed": good_seed})
    assert out["register"] == "basso"
    assert out["voice"]["narrator"]["cards"]["temperamento"]["value"] == "cantilenante"


def test_post_node_idempotent(C, node):
    reg = hooks_mod.load_packs(["ninnananna"])
    a = hooks_mod.run(reg, "post_node", dict(node), {"config": C, "seed": {}})
    b = hooks_mod.run(reg, "post_node", a, {"config": C, "seed": {}})
    assert a["register"] == b["register"]
    assert a.get("pack_notes") == b.get("pack_notes")


def test_post_audit_flags_scary(C):
    reg = hooks_mod.load_packs(["ninnananna"])
    rep = hooks_mod.run(reg, "post_audit",
                        {"text": "Nel bosco viveva un mostro.", "hard": [], "soft": []},
                        {"config": C})
    assert any("mostro" in s for s in rep["soft"])
