# Makefile — chain deterministico del motore SEME.
# La parte "contenuto" (seeding + prosa) la fa Claude in chat (vedi skill/).
# Questi target sono la parte MECCANICA: seed -> nodo -> hook -> brief -> prompt,
# poi montaggio e audit. Stesso nonce nel seed = stessa storia.
#
# Uso:  make all STORY=esempio
#       make chain STORY=miastoria     (solo grafo+brief, prima della prosa)

STORY ?= esempio
PY    := python3
S     := $(STORY)

.PHONY: all chain node hooks brief prompts book audit clean check validate genlog

check:                       ## valida il canone
	$(PY) scripts/seme_canon.py

validate:                    ## cancello fail-loud del seed (prima di costruire)
	$(PY) scripts/validate_seed.py $(S)/story_seed.yaml

node:                        ## seed.yaml -> node.json (PACKS=nome1,nome2 per i pacchetti)
	$(PY) scripts/build_node.py $(S)/story_seed.yaml --out $(S)/node.json $(if $(PACKS),--packs $(PACKS),)

hooks: node                  ## node.json -> hooks.json
	$(PY) scripts/extract_hooks.py $(S)/node.json --out $(S)/hooks.json

brief: hooks                 ## node+hooks -> writing_brief.md
	$(PY) scripts/build_brief.py $(S)/node.json $(S)/hooks.json --out $(S)/writing_brief.md

prompts: hooks               ## hooks -> manus_prompts.md
	$(PY) scripts/to_manus_prompts.py $(S)/node.json $(S)/hooks.json --out $(S)/manus_prompts.md

chain: brief prompts         ## tutto il pre-prosa (grafo + brief + prompt Manus)
	@echo "chain OK. Ora: scrivi la prosa in chat (skill/SKILL_prosa.md) -> $(S)/story.md"

book:                        ## story.md (+immagini) -> libro.html
	$(PY) scripts/build_book.py $(S)/story.md --node $(S)/node.json --out $(S)/libro.html

audit:                       ## cancello qualita' a strati (CRITIC=path per lo strato 3)
	$(PY) scripts/audit_story.py $(S)/story.md --node $(S)/node.json $(if $(CRITIC),--critic $(CRITIC),)

all: chain book audit        ## chain + montaggio + audit (richiede story.md gia' scritto)
	@echo "fatto."

clean:
	rm -f $(S)/node.json $(S)/hooks.json $(S)/writing_brief.md $(S)/manus_prompts.md $(S)/libro.html

genlog:                      ## ultime righe del ledger
	$(PY) scripts/genlog.py 10

packs:                       ## elenca i pacchetti disponibili
	$(PY) scripts/hooks.py

test:                        ## suite pytest
	$(PY) -m pytest tests/ -q
