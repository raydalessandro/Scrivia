import random
import build_node, extract_hooks, invariants


def test_determinism_byte(C, good_seed):
    a = build_node.build_node(good_seed, C, nonce=70125)
    b = build_node.build_node(good_seed, C, nonce=70125)
    assert a == b  # SEME_BUILD_TS fisso -> identici


def test_different_nonce_varies(C, good_seed):
    sigs = set()
    for nonce in range(1, 25):
        n = build_node.build_node(good_seed, C, nonce=nonce)
        sigs.add((n["entry_point_type"], n["closure_type"], n["register"],
                  n["deployment_level"], n["time_span_arc"]))
    assert len(sigs) > 5  # varieta' reale


def test_theme_maps_attribute(C, good_seed):
    good_seed["theme"] = "perdita"
    assert build_node.build_node(good_seed, C, nonce=3)["attribute_dominant"] == "cambiare"
    good_seed["theme"] = "amicizia"
    assert build_node.build_node(good_seed, C, nonce=3)["attribute_dominant"] == "connettere"


def test_pages_clamped(C, good_seed):
    good_seed["length_pages"] = 999
    assert build_node.build_node(good_seed, C, nonce=1)["pages"] == C.pages_max
    good_seed["length_pages"] = 1
    assert build_node.build_node(good_seed, C, nonce=1)["pages"] == C.pages_min


def test_overrides_respected(C, good_seed):
    good_seed["overrides"] = {"entry_point_type": "E", "closure_type": 2,
                              "register": "alto", "deployment_level": "mono"}
    n = build_node.build_node(good_seed, C, nonce=7)
    assert n["entry_point_type"] == "E" and n["closure_type"] == 2
    assert n["register"] == "alto" and n["deployment_level"] == "mono"


def test_fuzz_invariants(C):
    rng = random.Random(123)
    themes = list(C.theme_to_attribute) + ["", "ignoto"]
    worlds = ["animali_del_bosco", "casa", "spazio", "sottomarino"]
    kinds = ["gatto", "ghiandaia", "volpe", "gufo", None]
    for _ in range(300):
        pages = rng.randint(C.pages_min, C.pages_max)
        seed = {"language": "it", "protagonist": {"name": "T", "age": rng.randint(3, 12)},
                "companions": [{"name": f"C{j}", "kind": rng.choice(kinds)}
                               for j in range(rng.choice([0, 0, 1, 2, 3]))],
                "world_flavor": rng.choice(worlds), "theme": rng.choice(themes),
                "pugno": "p", "length_pages": pages,
                "spine": {k: "a b c d" for k in
                          ("premise", "problem", "threshold_moment", "resolution_mode")}}
        node = build_node.build_node(seed, C, nonce=rng.randint(1, 10**9))
        hk = extract_hooks.extract_hooks(node, C)
        assert invariants.check_node(node, C) == []
        assert invariants.check_hooks(hk, node, C) == []
