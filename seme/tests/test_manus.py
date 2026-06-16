import to_manus_prompts


def test_fixed_blocks_present(node, hooks):
    text = to_manus_prompts.build_prompts(node, hooks)
    assert "BLOCCO STYLESHEET" in text and "ART STYLE" in text
    assert "CHARACTER CONSISTENCY" in text
    assert "NO text" in text  # divieto di testo nell'immagine


def test_every_page_has_blocks(node, hooks):
    text = to_manus_prompts.build_prompts(node, hooks)
    for h in hooks:
        assert f"### p{h['page']:02d}" in text
    # ogni pagina ha STORY MOMENT + POV + PLACE
    assert text.count("STORY MOMENT:") == len(hooks)
    assert text.count("POV (il lettore guarda):") == len(hooks)
    assert text.count("PLACE:") == len(hooks)


def test_scale_block_when_multichar(node, hooks):
    text = to_manus_prompts.build_prompts(node, hooks)
    if len(node.get("companions", [])) >= 1:
        assert "SCALA" in text
        assert "size anchor" in text
