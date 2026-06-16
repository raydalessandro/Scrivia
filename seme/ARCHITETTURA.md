# ARCHITETTURA — seme come piccolo cervello

seme non è una pipeline lineare: è un piccolo sistema-agente. Il suo *loop* è
sottile; l'intelligenza vive nell'**harness** deterministico intorno al loop —
il canone, la grammatica a scelte discrete, i cancelli di qualità.

Questo documento traccia, come fa *Dive into Claude Code* (arXiv 2604.14228) per
Claude Code, la catena **valori → principi → implementazione**: ogni scelta di
design risale a un valore, e si concretizza in un file preciso. Lo scopo è
rendere il "cervello" leggibile e farlo evolvere senza romperlo.

> Tesi di fondo (la stessa del paper, nel nostro dominio): man mano che i modelli
> convergono, è l'**harness** a fare la differenza, non il modello. Il giudizio
> editoriale sta a monte, fissato come dati nel grafo; il modello *rende*, non
> *decide* la struttura. "La verità è nel grafo".

---

## Il loop sottile

```
seed ─► nodo ─► hook ─► brief ─► prosa ─► audit ─► montaggio
(chat)  (det.)  (det.)  (det.)   (chat)   (det.)   (det.)
```

Due soli stadi usano un LLM, e solo per il **contenuto**: il *seeding* (raccoglie
il minimo, scrive la spina narrativa) e la *prosa* (scrive le pagine dal brief).
Tutto il resto è deterministico: nessuna inferenza, nessun token, riproducibile.

---

## Valori (perché seme è fatto così)

- **V1 — Autorità autoriale dell'umano.** È la persona a dare il seme e a
  scegliere (immagini, merge, pubblicazione). Il sistema non compie azioni
  autonome irreversibili.
- **V2 — Verità nel grafo.** Tutto lo stato vive in artefatti versionabili e
  ricostruibili; gli stadi deterministici danno lo stesso output dallo stesso
  input.
- **V3 — Complessità senza costo.** La ricchezza nasce dalla **combinatoria** di
  enum discreti, non dall'inferenza. L'LLM fa una sola cosa costosa: rendere un
  brief già completo.
- **V4 — Voce viva, non-template.** Un harness anti-cliché (quote lessicali,
  varianza di registro, niente moralina) tiene la prosa lontana dal "generato".
- **V5 — Scheletro invisibile.** L'ontologia EAR (distinguere/connettere/cambiare)
  dà l'arco vero ma **non si nomina mai** nell'output.

---

## Principi (le scelte che derivano dai valori)

| # | Principio | Valori | Dove vive | Stato |
|---|---|---|---|---|
| P1 | Il giudizio editoriale sta a monte, nel grafo; il modello rende, non decide la struttura | V2,V3 | `build_node.py`, `skill/SKILL_prosa.md` | ✅ |
| P2 | La varietà nasce dal campionamento deterministico di enum discreti (nonce → riproducibile) | V3 | `build_node.py` | ✅ |
| P3 | L'evoluzione vive *dentro* la storia (semi piantati→pagati), non tra storie | V3,V4 | `node.seeds`, `extract_hooks.py` | ✅ |
| P4 | Brief-first: il modello scrive da un brief completo, mai dagli esempi prima | V4 | `build_brief.py`, `skill/SKILL_prosa.md` | ✅ |
| P5 | Lo scheletro EAR non compare mai nel testo | V5 | `seme_config.yaml`, `canone/` | ✅ |
| P6 | Cancelli a strati con **guasti indipendenti** (regex + strutturale + critic semantico) | V2,V4 | `audit_story.py` + `skill/SKILL_critic.md` | ✅ |
| P7 | Artefatti append-only, ricostruibili (seed/nodo/hook/brief/prosa + log) | V2 | artefatti + `scripts/genlog.py` → `generations.jsonl` | ✅ |
| P8 | Estensioni a **punti d'iniezione** (post_node/brief/manus/audit = assemble/execute), a costo di contesto zero; **pacchetti** drop-in che non toccano il core | V1 | `scripts/hooks.py`, `packs/<nome>/pack.py` | ✅ |
| P9 | Prompt visivi **deterministici e strutturati** (metodo Isola): blocchi fissi, SUBJECT/SCALA/POV/STORY MOMENT, divieti ripetuti → coerenza + cache, e **Manus esegue e basta** (orchestrazione) | V3 | `to_manus_prompts.py`, `canone/PROMPT_TEMPLATE.md` | ✅ |
| P10 | L'umano apre e sceglie; nessun merge/pubblicazione autonomi | V1 | flusso (seeding → scelta immagini → montaggio) | ✅ |
| P11 | La prima fase (umano↔IA) è un **processo a cancelli** (template + conferma + validazione), non una chat libera | V1,V2 | `skill/SKILL_seeding.md`, `scripts/validate_seed.py`, `skill/seed.template.yaml` | ✅ |
| P12 | La **voce** è un bundle di assi discreti con **guardrail anti-tic dentro ogni asse**; la stessa macchina scende **frattale** su personaggi (idioletto) e luoghi (texture) | V4 | `scripts/build_voice.py`, `seme_config.yaml §voice` | ✅ |

Legenda stato: ✅ fatto · 🟡 prossimo (lettera = punto del piano).

---

## Le due metà: contenuto vs struttura

- **Contenuto** (LLM, in chat): *seeding* e *prosa*. Sono le sole parti dove serve
  giudizio creativo. Protocolli in `skill/`.
- **Struttura** (deterministica, nessun LLM): nodo, hook, brief, prompt-immagine,
  audit, montaggio. È l'harness — la parte che dà affidabilità.

Il rapporto è voluto, non casuale (eco del 1,6%/98,4% del paper): più logica
sposti nell'harness deterministico, più il sistema è prevedibile e meno paga in
token e in incoerenze.

---

## Cancelli a strati (il cuore dell'affidabilità — punto A)

Un solo cancello condivide un solo modo di guasto. seme usa strati con guasti
**indipendenti**, così un buco in uno è coperto dagli altri:

1. **Regex (superficie)** — quote lessicali e famiglia 'piano'. Vede i cliché
   letterali. *Cieco* a moralina parafrasata e a EAR nominato di traverso.
2. **Strutturale (forma)** — pagine attese, ritorno dei semi, presenza della
   soglia. Vede i buchi di struttura. *Cieco* alla qualità della voce.
3. **Critic semantico (senso)** — un sub-agente isolato che legge la prosa e
   ritorna **solo un verdetto**: scheletro invisibile? niente moralina? chiusura
   non esplicativa? semi pagati *davvero*? Vede ciò che il regex non vede.

I tre danno un report unico. È la formalizzazione del *doppio turno di guardia*
di Isola, con la cornice del paper (subagenti isolati che restituiscono un
sommario; difesa in profondità con modi di guasto indipendenti).

---

## Mappatura a *Dive into Claude Code*

| Decisione del paper | Risposta di seme |
|---|---|
| 1. Dove vive il ragionamento? | Harness deterministico; modello solo per seeding+prosa (P1) |
| 2. Postura di sicurezza/qualità | Cancelli a strati con guasti indipendenti (P6) |
| 3. Gestione del contesto | Canone (guida) separato dal brief (lavoro); seed = compattazione della chat |
| 4. Estensibilità | Punti d'iniezione assemble/execute; pacchetti voce/genere a basso costo (P8) |
| 5. Subagenti | Critic isolato che ritorna solo il verdetto (P6) |
| 6. Persistenza | Artefatti append-only + `generations.jsonl`; nessuno stato implicito in chat (P7) |

---

## Stato e prossimi passi

- **A** — Critic-subagent (`skill/SKILL_critic.md`) + audit a strati con report
  unico e verdetto finale ✅ *(fatto: tre strati a guasti indipendenti; una
  violazione dura in un qualsiasi strato → FAIL).*
- **B** — `generations.jsonl` append-only via `scripts/genlog.py`: ogni `node_built`
  (grammatica + nonce → ricostruibile) e ogni `audit` (verdetto + stato dei tre
  strati) lasciano una riga ✅.
- **Prima fase blindata** — la chat umano↔IA è ora un processo a cancelli ✅:
  `seed.template.yaml` (forma fissa, niente campi dimenticati) + Cancello 1
  (ricapitola e fatti confermare: prende i fraintendimenti) + Cancello 2
  (`validate_seed.py` fail-loud: non si costruisce su un seed rotto; `build_node`
  lo rifà comunque). "Non perde, non dimentica, non sbaglia".
- **Voce frattale** — `build_voice.py` risolve la voce come bundle di assi
  discreti con carte (fai/evita-tic/lessico), e scende frattale su personaggi
  (idioletto: tic distinti, costanti) e luoghi (texture sensoriale, anche nei
  prompt Manus) ✅. Crocette umane opzionali (2-3 assi) nel seeding; il critic
  vigila su voce/idioletti/texture e sul rischio "sa di spec". Prototipo qui,
  portabile su Isola e sui brief lunghi tale e quale.
- **Prompt visivo (metodo Isola)** — `to_manus_prompts.py` genera prompt a
  **struttura blindata** ✅: STYLESHEET fisso in testa, SUBJECT coi soli
  descrittori autorizzati, SCALA esplicita, STORY MOMENT (azione+emozione+spazio),
  POV per pagina, divieti ripetuti, CHARACTER CONSISTENCY in coda. Blocchi
  identici = coerenza **e** cache. Il template canonico è `canone/PROMPT_TEMPLATE.md`.
  Conferma del paper: **Manus è solo orchestrazione** — con lavoro strutturato
  esegue, lite o pro uguale; l'intelligenza sta nell'harness deterministico.
- **C — Punti d'iniezione (fatto)** — `hooks.py`: quattro eventi
  (`post_node`/`post_brief`/`post_manus` = assemble, `post_audit` = execute). Un
  **pacchetto** è una cartella `packs/<nome>/pack.py` con funzioni `on_<evento>`,
  drop-in, che non tocca il core; i pacchetti attivi viaggiano col nodo
  (`node["packs"]`). Esempio: `packs/ninnananna` (storia della buonanotte) culla il
  nodo, aggiunge una sezione al brief e un controllo serale all'audit. Hook puri e
  idempotenti, ordinati. È l'estensibilità a costo di contesto più basso del paper.

## Solidità (fatta)

La spina dorsale è completa e irrobustita:
- **Riproducibilità** ✅ — `SEME_BUILD_TS` rende i build byte-identici.
- **Invarianti** ✅ — `scripts/invariants.py` (copertura beat, soglia, semi, varietà
  hook, idioletti, enum), agganciati a `build_node` come auto-check fail-loud
  post-build e riusati dai test.
- **Test** ✅ — `tests/` (pytest, ~49): contratto, determinismo + **fuzz** sugli
  invarianti, voce, hook/brief, manus (blocchi fissi su ogni pagina), audit (3+1
  strati), pacchetti, validazione, e2e, driver. `make test`. Hanno già scovato e
  chiuso due bug reali (varietà hook nelle storie corte, override del registro).
- **Automazione** ✅ — `seme.py`: driver che attraversa i segmenti deterministici
  (`new`/`build`/`assemble`/`check`/`all`/`status`) e si ferma in chiaro ai due
  gate non automatizzabili per scelta: **prosa** (LLM in chat) e **immagini** (Manus).

## Resta

- **Messa in esercizio** — "deve andare": confezionare il prodotto attorno a questa
  spina (l'app/chat di seeding, l'aggancio reale a Manus, la consegna del libro).
- Eventuali pacchetti-genere aggiuntivi (l'estensibilità c'è già: `packs/`).
