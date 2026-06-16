def test_loads(C):
    assert C.config_version >= 1
    assert C.tool_id == "seme"

def test_enums_nonempty(C):
    assert C.attribute_dominant and C.entry_point_type and C.closure_type
    assert C.register and C.time_span_arc and C.hooks.types

def test_theme_maps_to_valid_attribute(C):
    for theme, attr in C.theme_to_attribute.items():
        assert attr in C.attribute_dominant, f"{theme}->{attr} non valido"

def test_closure_weights_keys_valid(C):
    for k in C.closure_weights:
        assert k in C.closure_type

def test_age_register_values_valid(C):
    for band, reg in C.age_to_register.items():
        assert reg in C.register

def test_voice_axes_wellformed(C):
    axes = C.voice["axes"]
    for ax, vals in axes.items():
        assert vals, f"asse {ax} vuoto"
        for name, card in vals.items():
            assert isinstance(card, dict)
    for temp, lente in C.voice["temperamento_lente_bias"].items():
        assert temp in axes["temperamento"]
        assert lente in axes["lente_sensoriale"]

def test_lexicon_regex_compiled(C):
    for q in C.lexicon_quotas:
        assert q.re.pattern == q.pattern
