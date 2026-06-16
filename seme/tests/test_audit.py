import audit_story


def test_clean_pass_cli(cli):
    r = cli(["scripts/audit_story.py", "esempio/story.md", "--node", "esempio/node.json",
             "--critic", "esempio/critic_verdict.json", "--no-log"])
    assert r.returncode == 0 and "VERDETTO: PASS" in r.stdout


def test_regex_hard_flags_banned_phrase(C):
    hard, _ = audit_story.layer_regex("Da quel giorno tutto cambio.", C)
    assert hard


def test_struct_flags_missing_payoff(C, node):
    pages = list(range(1, node["pages"] + 1))
    pages.remove(node["seeds"][0]["payoff_page"])
    hard, _ = audit_story.layer_struct(pages, node)
    assert any("ritorno" in h for h in hard)


def test_critic_hard_flips_verdict_cli(cli, tmp_path):
    cj = tmp_path / "critic.json"
    cj.write_text('{"verdict":"FAIL","checks":{"niente_moralina":{"pass":false,"note":"p12 spiega"}},'
                  '"page_flags":[{"page":12,"severity":"hard","issue":"chiusura esplicita"}]}',
                  encoding="utf-8")
    r = cli(["scripts/audit_story.py", "esempio/story.md", "--node", "esempio/node.json",
             "--critic", str(cj), "--no-log"])
    assert r.returncode == 1 and "VERDETTO: FAIL" in r.stdout


def test_critic_pending_without_file(C):
    hard, soft, note = audit_story.layer_critic(None)
    assert note and hard is None
