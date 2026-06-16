# seme — storie brevi illustrate (il seme del sistema Isola)

Estrazione **sintetica** della pipeline di *L'Isola dei Tre Venti*: produce
**una** storia illustrata di 10–20 pagine, personalizzata, veloce ed economica.
Tiene la cosa che conta — la **complessità del grafo** che rende le storie
non-template e che le fa *evolvere* davvero — ma butta la macchina pesante della
saga (semi su 12 storie, debiti cross-nodo, cicli, distribuzione presenze).

> Tesi: il **costo/peso** di Isola vive nella dimensione *temporale di saga*. La
> *non-templatezza* vive nella **grammatica strutturale a scelte discrete**. Il
> seme butta la prima, tiene la seconda, e collassa l'evoluzione da *tra le
> storie* a *dentro una storia*.

> Per il *perché* di ogni scelta (valori → principi → implementazione, sul modello
> di *Dive into Claude Code*, arXiv 2604.14228): vedi **`ARCHITETTURA.md`**.
> In breve: seme è un piccolo cervello, non una pipeline — il loop è sottile,
> l'intelligenza vive nell'harness deterministico intorno.

## Perché è economico e non-template

1. **Varietà = combinatoria degli enum**, campionata in modo deterministico.
   6 aperture × 7 chiusure × 3 registri × stagione × forma-d'arco × pattern-semi:
   spazio enorme, nessun token speso. Stesso `nonce` = stessa storia; `nonce`
   diverso = storia diversa.
2. **Evoluzione = arco EAR (soglia: attraversamento discreto) + semi intra-storia**
   (un dettaglio a p2 che torna trasformato a p11). Tutto nel grafo, meccanico.
3. **L'LLM fa una sola cosa costosa**: rendere un brief già completamente
   specificato in prosa. Un passaggio. Il resto è deterministico.

## La spina EAR (definita qui, era `TODO Fase 2` nel template)

Tre movimenti universali, **mai nominati nel testo**:
`distinguere` (accorgersi) · `connettere` (avvicinarsi) · `cambiare` (attraversare).
Una storia può essere **mono** (un movimento domina) o **triadica** (l'arco passa
i tre). È questo a dare l'arco vero in 12 pagine, non un template.

## Le due metà

- **Contenuto** (lo fa Claude *in chat*, le sole parti che servono un LLM):
  il *seeding* (raccoglie il minimo, scrive la spina narrativa) e la *prosa*
  (scrive le pagine dal brief). Protocolli in `skill/`.
- **Struttura** (deterministica, *nessun LLM*): tutto il resto.
  `seed → nodo → hook → brief → prompt-Manus → montaggio`.

## Flusso completo (come lo immaginavi)

```
1. CHAT (Claude)   seeding + nodo + hook + brief + PROSA   ──► story.md
                   (skill/SKILL_seeding.md, skill/SKILL_prosa.md)
2. MANUS           legge manus_prompts.md, genera le immagini ──► immagini/pNN.png
3. CHAT (script)   build_book.py monta prosa + immagini      ──► libro.html ──► PDF A5
```

## Runbook

Driver (consigliato) — attraversa i segmenti deterministici e si ferma ai due gate:

```bash
python3 seme.py new miastoria          # scaffold dal template
# ... compila miastoria/story_seed.yaml (chat di seeding) ...
python3 seme.py build miastoria        # valida -> nodo -> hook -> brief -> prompt  (-> GATE PROSA)
# ✋ GATE PROSA: scrivi la prosa in chat dal brief -> miastoria/story.md
# ✋ GATE IMMAGINI: manus_prompts.md -> Manus -> miastoria/immagini/pNN.png
python3 seme.py assemble miastoria     # monta il libro
python3 seme.py check miastoria        # audit a strati
python3 seme.py status miastoria       # cosa c'e' e qual e' il passo successivo
```

In alternativa, via Makefile: `make chain STORY=esempio` / `make book` / `make audit`.
Test: `make test` (o `python3 -m pytest tests/ -q`). Build riproducibili byte-identici
con `SEME_BUILD_TS` fissato.

## Struttura

```
seme/
  seme.py                   driver CLI (new/build/assemble/check/all/status)
  GUIDA.html                guida mobile offline (le fasi + gli strumenti, da tenere sul telefono)
  seme_config.yaml          CANONE: enum EAR definiti, grammatica, quote lessicali
  ARCHITETTURA.md           valori -> principi -> implementazione (il "cervello")
  scripts/
    seme_canon.py           loader fail-loud del canone
    validate_seed.py        cancello fail-loud del seed (prima fase)
    invariants.py           invarianti strutturali (auto-check build_node + test)
    build_node.py           seed -> nodo (campionamento deterministico + regole)
    build_voice.py          voce frattale: narratore + idioletti + texture luoghi
    extract_hooks.py        nodo -> hook (uno per pagina, anti-monotonia)
    build_brief.py          nodo+hook -> writing brief (zero-token)
    to_manus_prompts.py     hook -> prompt immagine per Manus (controllo costi)
    build_book.py           prosa + immagini -> libro HTML A5 stampabile
    audit_story.py          cancello qualita' a strati (regex+strutturale+critic+pacchetti)
    genlog.py               log append-only -> generations.jsonl
    hooks.py                punti d'iniezione (post_node/brief/manus/audit)
  packs/
    ninnananna/pack.py      pacchetto d'esempio: storia della buonanotte
  tests/                    suite pytest (canon, build_node+fuzz, voce, manus, audit, packs, e2e, driver)
  canone/
    VOCE.md                 carta voce compatta (niente moralina, registri, ...)
    PATTERN_DA_BANDIRE.md   anti-cliché AI
    PROMPT_TEMPLATE.md      template blindato immagini (metodo Isola, lo legge Manus)
  skill/
    seed.template.yaml      forma fissa del seed (l'IA la riempie)
    SKILL_seeding.md        runtime chat: processo a cancelli (raccolta+conferma+valida)
    SKILL_prosa.md          runtime chat: scrittura brief-first
    SKILL_critic.md         runtime chat: critic semantico (3o strato dell'audit)
  esempio/                  demo end-to-end completa (Pino e la voce sotto le foglie)
  generations.jsonl         ledger append-only delle generazioni (si crea all'uso)
  Makefile
```

## Schema del nodo (il "mini-52")

Tiene lo spine narrativo di Isola + gli enum strutturali + i meccanismi di eco:
`attribute_dominant`, `deployment_level`, `ear_arc`, `premise/problem/
threshold_moment/resolution_mode/closure_text`, `entry_point_type` (A–F),
`closure_type` (1–7), `register`, `time_span_arc`, `beat_plan`, `seeds`
(piantati→pagati *dentro* la storia), `debt`, `recurring_image`, budget di voce.
Butta: semi/debiti/callback cross-storia, ciclo EAR su saga, distribuzione
presenze su 12, mondo canonico fisso.

## Cosa serve

Python 3 + `pyyaml`. Nessuna dipendenza da SDK di LLM nel codice: gli unici punti
LLM sono in chat (seeding, prosa) e via Manus (immagini). "La verità è nel grafo".
