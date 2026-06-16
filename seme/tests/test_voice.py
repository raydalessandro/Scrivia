import build_node, build_voice

def test_active_axes_in_range(C, node):
    n = len(node["voice"]["narrator"]["active_axes"])
    lo, hi = C.voice["narrator_active_axes"]
    assert lo <= n <= hi

def test_active_values_valid(C, node):
    axes = C.voice["axes"]
    for ax, card in node["voice"]["narrator"]["cards"].items():
        assert card["value"] in axes[ax]

def test_idiolects_distinct(node):
    tics = [c["tic_verbale"]["value"] for c in node["voice"]["characters"].values()]
    assert len(tics) == len(set(tics))

def test_place_texture_present(node):
    assert node["voice"]["places"]

def test_crocette_force_axes(C, good_seed):
    good_seed["overrides"] = {"voice": {"temperamento": "ironica", "umorismo": "battute_laterali"}}
    n = build_node.build_node(good_seed, C, nonce=70125)
    cards = n["voice"]["narrator"]["cards"]
    assert cards["temperamento"]["value"] == "ironica"
    assert cards["umorismo"]["value"] == "battute_laterali"
