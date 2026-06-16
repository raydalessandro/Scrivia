import extract_hooks, build_brief, invariants


def test_hooks_invariants(C, node, hooks):
    assert invariants.check_hooks(hooks, node, C) == []


def test_hooks_idempotent(C, node):
    a = extract_hooks.extract_hooks(node, C)
    b = extract_hooks.extract_hooks(node, C)
    assert a == b


def test_one_hook_per_page(node, hooks):
    assert len(hooks) == node["pages"]
    assert [h["page"] for h in hooks] == list(range(1, node["pages"] + 1))


def test_brief_has_sections(C, node, hooks):
    brief = build_brief.build_brief(node, hooks, C)
    for section in ("Ricetta strutturale", "Spina narrativa", "Voce",
                    "Pagina per pagina", "Come aprire e come chiudere"):
        assert section in brief


def test_brief_idempotent(C, node, hooks):
    assert build_brief.build_brief(node, hooks, C) == build_brief.build_brief(node, hooks, C)
