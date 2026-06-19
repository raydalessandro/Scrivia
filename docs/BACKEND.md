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
**Tuo:** tutto `lib/` **tranne** `store.ts` e `supabase/*`.

| Non tuo | Di chi | Perché |
|---|---|---|
| `lib/store.ts`, `lib/supabase/*`, migrazioni, bucket, auth | **supabase** | persistenza/storage (M3) |
| `app/`, `components/`, `globals.css`, `public/fonts/` | **frontend** | estetica e UI |
| `test/`, `vitest.config`, CI | **testing** | la rete che protegge i tuoi contratti |

Tu **produci** i contratti; il front li **legge** e ti **passa** azioni; il testing li
**blinda**. Se per fare il back serve l'area di un altro, **fermati e segnala**.

## Mappa dei moduli (`lib/`, esclusi store/supabase)

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

### Layer AI (`lib/ai/`, universale rispetto al provider)
- **`index.ts`** — la facciata. **Lato client solo dati/tipi** (`types`,`registry`,`config`,
  per i selettori UI); **solo server** (chiavi + `fetch`): `client.ts` e gli adapter.
- **`types.ts`** — i tipi neutri: `CompletionRequest`/`Result`, `ProviderAdapter`,
  `AITask`, `ReasoningLevel`, `AITool` (stessa forma di `toMcpTools()`).
- **`registry.ts`** — i provider e i modelli (con `reasoning` + `caps`).
- **`config.ts`** — la selezione **per-fase** (quale provider/modello/reasoning per
  seeding/prosa/critic/…).
- **`client.ts`** + **`providers/{anthropic,deepseek}.ts`** — `aiComplete`/`aiStream` e gli
  adapter; **`sse.ts`** lo streaming.
- **`tasks/{seeding,prosa,critic}.ts`** — i tre usi LLM: seeding conversazionale (con i
  comandi come strumenti), prosa in streaming **brief-first**, critic **semantico** (strato
  3 del cancello: non riscrive, giudica le "regole invisibili").

### Immagini (`lib/images/`)
- **`index.ts`** — facciata: sceglie `openai` se c'è la chiave, altrimenti `manual`.
  **`composePrompt.ts`** compone il prompt; **`providers/{openai,manual}.ts`** le due
  strade; **`types.ts`** i tipi. Le immagini restano un **cancello umano** (Manus): non
  automatizzarle di nascosto.

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
Il front importa larga parte di `lib/` — `types`, `ai/types`, `enums`, `ai/config`,
`images`, `stages`, `ai/sse`, `ai/registry`, `commands`, `book`, `audit`, le `ai/tasks`…
Quindi:
- **Export stabili.** Non rinominare/rimuovere ciò che è usato a monte (`buildNode`,
  `buildPagePlan`, `extractHooks`, `newNonce`, `executeCommand`, `COMMANDS`, `toMcpTools`,
  `deriveStages`, `PHASES`, `deriveEntities`, `buildBrief`, `buildPagePrompts`…).
- **Shape additivo.** I campi nuovi su `Seed`/`StoryNode`/`PagePlan` sono **opzionali**
  (in `engineTypes.ts`): i consumatori di `PagePlan` continuano a funzionare.
- **Le mutazioni dai comandi.** UI e IA **non** scrivono lo `Story` a mano: chiamano
  `executeCommand`. Così restano coerenti log + cache + (domani) MCP.
- **Le LLM dal layer.** Mai un provider chiamato da un componente o da una fase: sempre
  via `lib/ai/`.

## Come si estende (ricette)
- **Un comando** → una voce in `COMMANDS` (`lib/commands.ts`): `name`,`title`,
  `description`,`category`,`params`,`run`. Se è puro/read marcalo `pure:true` (entra in
  cache). Diventa tool MCP via `toMcpTools()`. (La UI lo espone; se è "nuova funzione",
  avvisa che il front la deve mostrare → orchestratrice → agente frontend.)
- **Un provider AI** → un adapter in `lib/ai/providers/` che implementa `ProviderAdapter`
  + una voce nel `registry.ts` (modelli + reasoning + `caps`). Facciata e fasi **non**
  cambiano.
- **Un campo del motore** → tipo **opzionale** in `engineTypes.ts`; popolalo in
  `buildNode`/`extractHooks`; verifica che il fuzz resti 0; se serve, estendi il
  riferimento Python in parità.
- **Un gate d'audit** → aggiungilo allo strato giusto (regex/strutturale in `audit.ts`,
  semantico in `ai/tasks/critic.ts`), **a guasto indipendente**: non fonderlo con un altro
  strato. Marca se è **duro** (→ FAIL) o **soft** (→ nota).
- **Un provider immagini** → un adapter in `lib/images/providers/` + selezione nella
  facciata. Le immagini restano un cancello umano.
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
