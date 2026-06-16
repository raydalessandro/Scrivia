import json
import yaml
import invariants
import seme_canon


def _write_seed(tmp_path, seed):
    p = tmp_path / "story_seed.yaml"
    p.write_text(yaml.safe_dump(seed, allow_unicode=True), encoding="utf-8")
    return p


def test_full_chain(cli, tmp_path, good_seed, repo):
    seed = _write_seed(tmp_path, good_seed)
    node_p = tmp_path / "node.json"
    hooks_p = tmp_path / "hooks.json"
    brief_p = tmp_path / "brief.md"
    manus_p = tmp_path / "manus.md"

    r = cli(["scripts/build_node.py", str(seed), "--out", str(node_p), "--nonce", "70125", "--no-log"])
    assert r.returncode == 0 and node_p.exists()
    r = cli(["scripts/extract_hooks.py", str(node_p), "--out", str(hooks_p)])
    assert r.returncode == 0 and hooks_p.exists()
    r = cli(["scripts/build_brief.py", str(node_p), str(hooks_p), "--out", str(brief_p)])
    assert r.returncode == 0 and "Spina narrativa" in brief_p.read_text(encoding="utf-8")
    r = cli(["scripts/to_manus_prompts.py", str(node_p), str(hooks_p), "--out", str(manus_p)])
    assert r.returncode == 0 and "BLOCCO STYLESHEET" in manus_p.read_text(encoding="utf-8")

    C = seme_canon.load()
    node = json.loads(node_p.read_text(encoding="utf-8"))
    hooks = json.loads(hooks_p.read_text(encoding="utf-8"))
    assert invariants.check_node(node, C) == []
    assert invariants.check_hooks(hooks, node, C) == []


def test_book_assembles(cli, tmp_path, repo):
    out = tmp_path / "libro.html"
    r = cli(["scripts/build_book.py", "esempio/story.md", "--node", "esempio/node.json",
             "--out", str(out)])
    assert r.returncode == 0 and out.exists()
    html = out.read_text(encoding="utf-8")
    assert "<html" in html and html.count("class='page") >= 12


def test_pack_effects_in_chain(cli, tmp_path, good_seed):
    seed = _write_seed(tmp_path, good_seed)
    node_p = tmp_path / "node.json"
    hooks_p = tmp_path / "hooks.json"
    brief_p = tmp_path / "brief.md"
    r = cli(["scripts/build_node.py", str(seed), "--out", str(node_p), "--nonce", "70125",
             "--packs", "ninnananna", "--no-log"])
    assert r.returncode == 0
    node = json.loads(node_p.read_text(encoding="utf-8"))
    assert node["packs"] == ["ninnananna"] and node["register"] == "basso"
    cli(["scripts/extract_hooks.py", str(node_p), "--out", str(hooks_p)])
    cli(["scripts/build_brief.py", str(node_p), str(hooks_p), "--out", str(brief_p)])
    assert "ninnananna" in brief_p.read_text(encoding="utf-8")


def test_broken_seed_rejected(cli, tmp_path, good_seed):
    good_seed["theme"] = ""
    good_seed["spine"]["problem"] = ""
    seed = _write_seed(tmp_path, good_seed)
    r = cli(["scripts/build_node.py", str(seed), "--out", str(tmp_path / "n.json"), "--no-log"])
    assert r.returncode == 1 and "seed incompleto" in r.stdout
