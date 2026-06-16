import shutil
from pathlib import Path
import yaml


def test_new_scaffolds(cli, tmp_path):
    d = tmp_path / "s"
    r = cli(["seme.py", "new", str(d)])
    assert r.returncode == 0 and (d / "story_seed.yaml").exists()
    assert (d / "immagini").is_dir()


def test_build_runs_and_gates(cli, tmp_path, good_seed):
    d = tmp_path / "s"
    cli(["seme.py", "new", str(d)])
    (d / "story_seed.yaml").write_text(yaml.safe_dump(good_seed, allow_unicode=True), encoding="utf-8")
    r = cli(["seme.py", "build", str(d), "--nonce", "70125"])
    assert r.returncode == 0
    for f in ("node.json", "hooks.json", "writing_brief.md", "manus_prompts.md"):
        assert (d / f).exists()
    assert "GATE PROSA" in r.stdout


def test_status_reports_next(cli, tmp_path, good_seed):
    d = tmp_path / "s"
    cli(["seme.py", "new", str(d)])
    (d / "story_seed.yaml").write_text(yaml.safe_dump(good_seed, allow_unicode=True), encoding="utf-8")
    r = cli(["seme.py", "status", str(d)])
    assert "story_seed.yaml" in r.stdout and "prossimo" in r.stdout


def test_all_assembles_when_story_present(cli, tmp_path, good_seed, repo):
    d = tmp_path / "s"
    cli(["seme.py", "new", str(d)])
    (d / "story_seed.yaml").write_text(yaml.safe_dump(good_seed, allow_unicode=True), encoding="utf-8")
    shutil.copy(repo / "esempio" / "story.md", d / "story.md")
    r = cli(["seme.py", "all", str(d), "--nonce", "70125"])
    assert r.returncode == 0 and (d / "libro.html").exists()
