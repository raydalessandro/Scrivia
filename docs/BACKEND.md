# BACKEND — il manuale del motore e dei contratti

> Doc-compagno dell'**agente backend** (`.claude/agents/backend.md`). Qui c'è la
> mappa dei moduli, la **disciplina di parità** col riferimento Python, gli
> **invarianti**, e **come si estende ogni pezzo** senza rompere ciò che il front
> legge e i test proteggono. I runbook per-area (`*_INTEGRATION.md`) restano gli
> ausiliari: questo doc vi **rimanda**, non li duplica.

## Cos'è il back di Scrivia
`lib/` è la **single source of truth** del prodotto: *"la verità è nel grafo."* È
l'**harness deterministico** (porting in TS del riferimento `seme/`) attorno a cui il
front si fa bello. Tesi di fondo (la stessa di `seme/ARCHITETTURA.md`): *è l'harness a
fare la differenza, non il modello*. Il giudizio editoriale sta a monte, fissato come
dati nel grafo; l'LLM **rende**, non **decide** la struttura. Due soli passi usano un
LLM (seeding, prosa); tutto il resto è deterministico, riproducibile, a costo di token
zero.

## La corsia (cosa è tuo, cosa no)
**Tuo:** l'**harness deterministico** in `lib/` — tutto **tranne** `store.ts`/`supabase/*`
(persistenza) e `ai/*`/`images/*` (intelligenza e generazione).

| Non tuo | Di chi | Perché |
|---|---|---|
| `lib/ai/*`, `lib/images/*` (chiamate ai modelli + generazione foto/video/audio) | **ai** | la frontiera che evolve (modelli, costi, MCP) |
| `lib/store.ts`, `lib/supabase/*`, migrazioni, bucket, auth | **supabase** | persistenza/storage (M3) |
| `app/`, `components/`, `globals.css`, `public/fonts/` | **frontend** | estetica e UI |
| `test/`, `vitest.config`, CI | **testing** | la rete che protegge i tuoi contratti |

Tu **produci** i contratti (e l'assembly: brief, verdetto, prompt-pagina, tool); il front li
**legge** e ti **passa** azioni; l'agente **ai** consuma ciò che assembli e ti restituisce
l'inferenza; il testing **blinda**. Se per fare il back serve l'area di un altro, **fermati e
segnala**. Il seam con l'ai è in fondo (e in `docs/AI_LAYER.md`).

## Mappa dei moduli (`lib/`, esclusi store/supabase e ai/images)

### Cuore deterministico
- **`engine.ts`** — il motore: `buildNode(seed)` (campiona la grammatica dalla `nonce`),
  `extractHooks`/`buildPagePlan`, `resolveVoice` (voce frattale: narratore → personaggi →
  luoghi), `checkNode`/`checkHooks` (invarianti), `entitiesInScene`. Port di
  `build_node.py` + `extract_hooks.py` + `build_voice.py` + `invariants.py`.
- **`engineTypes.ts`** — tipi **additivi** che estendono `Seed`/`StoryNode`/`PagePlan`
  (es. `Hook`, `StoryNodeExt`). **Qui** si aggiungono i campi nuovi: `types.ts` non si rompe.
- **`canon.json`** — i dati del canone, importati **come modulo** (finiscono nel bundle:
  niente `fs` a runtime, gira nel browser). Fonte dati unica condivisa col motore.
- **`enums.ts`** — canone EAR + grammatica come **etichette leggibili** per la UI.
  **Specchio** di `seme/seme_config.yaml` (che resta la fonte di verità del motore).
- **`stages.ts`** — l'ordine canonico delle 7 tappe ("stelo") + le 4 fasi; il flag `gate`
  marca i due cancelli voluti.
- **`cache.ts`** — cache minimale per i comandi **puri** (read/derive): stesso input →
  stesso output, niente lavoro due volte.

### Passi deterministici (port 1:1 del Python, zero LLM)
- **`brief.ts`** — assembla il **WRITING BRIEF** da node + hooks + seed (port di
  `build_brief.py`). È ciò che il prosatore legge: ricetta strutturale, spina, vincoli di
  voce, tabella pagina-per-pagina con eventi-seme e soglia. **Brief-first** (P4).
- **`reference.ts`** — **FASE 0** (reference visiva): `deriveEntities(node)` → per ogni
  entità l'umano scrive il descrittore, genera il foglio col prompt blindato, conferma.
  Da lì le pagine si appoggiano a entità **canoniche**.
- **`pagePrompts.ts`** — i prompt-pagina veri (metodo Isola): `SUBJECT → STORY MOMENT →
  POV → PLACE → SCALA`. SUBJECT/PLACE **non** si inventano: si leggono dal record
  d'entità confermato. Le reference confermate vanno in `references[]`.
- **`stylesheet.ts`** — costanti immagine **single-source** (lo STYLESHEET lo leggono SIA
  i prompt-reference SIA i prompt-pagina: un solo posto, niente drift, cache).
- **`audit.ts`** — cancello qualità a **strati con guasti indipendenti** (P6): (1) regex
  (cliché letterali da `PATTERN_DA_BANDIRE`/quote), (2) strutturale (copertura pagine,
  semi piantati→pagati, soglia), (3) il semantico vive in `ai/tasks/critic.ts`. Verdetto
  = **FAIL** se un check **duro** fallisce. Port di `audit_story.py`.
- **`book.ts`** — monta il **libro** A5 stampabile (port di `build_book.py`): accoppia
  prosa↔immagine (o placeholder), rende HTML `@page 148×210mm`. Immagine mancante →
  placeholder, si cala dopo senza ritoccare nulla.
- **`seedFromGame.ts`** — mappa l'output del seeding-gioco (`GameState`) sul `Seed`
  (`spine.threshold→threshold_moment`, `move→overrides.attribute_dominant`, assi voce con
  remap `lente`→`lente_sensoriale`, + l'**espansione voci-personaggio**).
- **`example.ts`** — la storia d'esempio (artefatti reali del seme): mostra la UI a pieno
  carico, end-to-end, senza dipendere da servizi. Verrà rimpiazzata dalle storie vere.

### Comandi (la "Fase 1 come agente")
- **`commands.ts`** — il **registry** tipizzato: catalogo di azioni sullo `Story`. Fonte
  unica usata sia dalla UI (l'umano tocca un campo) sia dall'IA (esegue un comando). Con
  `toMcpTools()` la **stessa** lista diventa la MCP della prima fase. I comandi `pure`/read
  passano dalla cache.

### Intelligenza e generazione → **agente ai** (fuori corsia)
`lib/ai/*` (chiamate ai modelli) e `lib/images/*` (generazione foto/video/audio) **non** sono
tuoi: sono dell'**agente ai** (la frontiera che evolve — modelli, costi, MCP). Manuale in
**`docs/AI_LAYER.md`**. Da te dipendono via il **seam** (vedi sotto): tu **assembli** il brief
e produci i tool, lui **rende** (prosa, critic, immagini). Quando estendi un comando o il
motore in modo che a una fase AI serva un dato nuovo, lo **produci tu** e l'agente ai lo legge —
non scrivi tu la chiamata al modello.

## La disciplina di parità (il cuore del mandato)
`engine.ts` e i passi deterministici sono **port** di `seme/scripts/*.py`. La regola:

- **Parità di contratto, non byte.** Contano nodo/hook/voce/invarianti, non la
  formattazione o l'ordine dei campi. Il riferimento è `seme/scripts/<x>.py` + i suoi
  `seme/tests/`.
- **Quando estendi**, mantieni la parità: se aggiungi un comportamento, dev'essere
  riflesso (o esplicitamente non-applicabile) rispetto al riferimento. Se un **fix
  legittimo** corregge un bug presente in entrambi, **allinea Python e TS** (o segnala
  perché lo faccia chi tiene `seme/`) e **annotalo qui**.
- **Il guardiano è il test.** `test/engine.parity.test.ts` fa fuzz + invarianti +
  determinismo: è lui a dire se la parità regge. (È dell'agente **testing**: tu lo fai
  girare, non lo riscrivi.)

## Invarianti non negoziabili
Esito atteso del test di parità (M1), da tenere verde:
```
✓ checkNode: 0/2500      ✓ checkHooks: 0/2500
✓ determinismo: 200/200 identici
✓ attribute_dominant = theme_to_attribute (12/12 temi)
✓ threshold_page = unica pagina-soglia in range (300/300)
✓ register con varianza
```
In parole:
1. **Determinismo** — stessa `nonce` ⇒ stesso nodo. Nessuna sorgente di entropia non
   derivata dalla `nonce`.
2. **`checkNode`/`checkHooks` = 0** su fuzz ≥2000.
3. **`threshold_page` unica** — l'unica pagina con `markers.is_threshold`; coincide con
   l'inizio del beat *cambiare* (triadico) o `round(pages·0.70)` (mono). **Non** `0.75`.
4. **`attribute_dominant`** segue `theme_to_attribute[theme]` (override → tabella →
   campionamento). Non collassa senza voce.
5. **`register`** ha varianza (banda d'età + neighbor-shift + override), non è un valore fisso.

## Il contratto a monte (cosa NON puoi rompere)
Il front importa larga parte di `lib/`. La **tua** parte: `types`, `enums`, `stages`,
`commands`, `book`, `audit`, `example`, `reference`, `pagePrompts`, `seedFromGame`… (gli import
`ai/*` e `images` che il front usa sono il contratto dell'**agente ai**, non tuo). Quindi:
- **Export stabili.** Non rinominare/rimuovere ciò che è usato a monte (`buildNode`,
  `buildPagePlan`, `extractHooks`, `newNonce`, `executeCommand`, `COMMANDS`, `toMcpTools`,
  `deriveStages`, `PHASES`, `deriveEntities`, `buildBrief`, `buildPagePrompts`…).
- **Shape additivo.** I campi nuovi su `Seed`/`StoryNode`/`PagePlan` sono **opzionali**
  (in `engineTypes.ts`): i consumatori di `PagePlan` continuano a funzionare.
- **Le mutazioni dai comandi.** UI e IA **non** scrivono lo `Story` a mano: chiamano
  `executeCommand`. Così restano coerenti log + cache + (domani) MCP.
- **L'inferenza all'agente ai.** Tu non chiami i provider e non orchestri il tool-use: il
  layer `lib/ai/`/`lib/images/` è dell'agente ai. Tu gli passi l'**assembly** (brief, tool) e
  consumi la sua resa (verdetto critic). Il seam è qui sotto.

### Il seam con l'agente ai
| Confine | Tu (backend, struttura) | Agente ai (inferenza) |
|---|---|---|
| Prosa | assembli il **brief** (`brief.ts`) | il task prosa lo *consuma* |
| Audit | combini il **verdetto** + strati regex/strutturali (`audit.ts`) | il task critic (semantico) ti *alimenta* |
| MCP | produci i **tool** (`toMcpTools()`) | li *passa* al modello, orchestra il tool-use |
| Immagini | i **prompt-pagina** (`pagePrompts.ts`) + `stylesheet.ts` | la **generazione** (`lib/images/`) li *usa* |

Se una fase AI ha bisogno di un **dato strutturato nuovo**, lo **produci tu** (comando/campo) e
l'agente ai lo legge. Non sconfini nel layer; lui non sconfina nell'assembly.

## Come si estende (ricette)
- **Un comando** → una voce in `COMMANDS` (`lib/commands.ts`): `name`,`title`,
  `description`,`category`,`params`,`run`. Se è puro/read marcalo `pure:true` (entra in
  cache). Diventa tool MCP via `toMcpTools()`. (La UI lo espone; se è "nuova funzione",
  avvisa che il front la deve mostrare → orchestratrice → agente frontend.)
- **Un provider/modello AI, o un provider immagini/video/audio** → **non è tuo**: è
  dell'**agente ai** (`docs/AI_LAYER.md`). Se per servirlo serve un dato strutturato nuovo, tu
  produci il dato (comando/campo) e lo segnali.
- **Un campo del motore** → tipo **opzionale** in `engineTypes.ts`; popolalo in
  `buildNode`/`extractHooks`; verifica che il fuzz resti 0; se serve, estendi il
  riferimento Python in parità.
- **Un gate d'audit** → gli strati **regex/strutturale** e il **verdetto** sono tuoi
  (`audit.ts`), **a guasto indipendente**: non fonderli. Lo strato **semantico** (il critic) è
  dell'agente ai: se ti serve un nuovo segnale semantico, **coordina** con lui. Marca i tuoi
  check **duro** (→ FAIL) o **soft** (→ nota).
- **Un pacchetto-genere** → modello `seme/packs/` (hook a punti d'iniezione, drop-in che
  non tocca il core, P8).

## Gate (prima di consegnare)
```bash
npm run check   # vitest + typecheck:test + tsc --noEmit + next build (= la CI)
```
- Tutti e 4 i gate verdi. La CI (`.github/workflows/ci.yml`) rigira gli stessi sulla PR.
- Parità/invarianti verdi (fuzz 0, determinismo).
- I consumatori a monte compilano **senza modifiche**.
- Hai toccato un contratto coperto da test? **Non** aggiusti il test: **segnali**
  all'agente testing perché lo aggiorni insieme al cambio.

## Workflow
**Branch + PR, mai merge diretto su `main`** (regola madre `CLAUDE.md`): feature branch →
`npm run check` verde → PR → si mergia a CI verde, con l'ok dell'utente. Un cambiamento =
un commit chiaro in italiano. Consegna col protocollo del progetto (zip + `COME_APPLICARE.md`).

## Runbook & riferimenti
- Per-area: `docs/ENGINE_INTEGRATION.md`, `docs/BRIEF_INTEGRATION.md`,
  `docs/CRITIC_INTEGRATION.md`, `docs/AIPROSA_INTEGRATION.md`,
  `docs/AISEEDING_INTEGRATION.md`, `docs/IMAGEGEN_INTEGRATION.md`,
  `docs/ROADMAP_INTEGRAZIONE.md` (mapping tipi B1–B3).
- Principi e valori: `CLAUDE.md` + `seme/ARCHITETTURA.md` (P1–P12).
- Riferimento Python: `seme/scripts/*.py` + `seme/tests/` (il contratto da rispettare).

## In dubbio
Se una scelta cambia un contratto a monte, rompe la parità o un invariante, o tocca
l'area di un altro agente: **chiedi**. Un passo alla volta.
