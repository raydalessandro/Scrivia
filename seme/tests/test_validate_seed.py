import validate_seed

def test_good_seed_no_errors(C, good_seed):
    errors, _ = validate_seed.validate(good_seed, C)
    assert errors == []

def test_missing_required_fails(C, good_seed):
    good_seed["theme"] = ""
    good_seed["spine"]["problem"] = ""
    errors, _ = validate_seed.validate(good_seed, C)
    assert any("theme" in e for e in errors)
    assert any("spine.problem" in e for e in errors)

def test_placeholder_counts_as_empty(C, good_seed):
    good_seed["pugno"] = "[...]"
    errors, _ = validate_seed.validate(good_seed, C)
    assert any("pugno" in e for e in errors)

def test_unknown_theme_warns(C, good_seed):
    good_seed["theme"] = "qualcosa_di_strano"
    errors, warnings = validate_seed.validate(good_seed, C)
    assert errors == []
    assert any("theme" in w for w in warnings)

def test_unknown_voice_axis_value_warns(C, good_seed):
    good_seed["overrides"] = {"voice": {"temperamento": "sarcastica"}}
    _, warnings = validate_seed.validate(good_seed, C)
    assert any("temperamento" in w for w in warnings)
