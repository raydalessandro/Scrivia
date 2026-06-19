# TEST_MAP — Manutenzione dei test (runbook)

> A cosa serve questo file: quando lavori sul **codice dell'app** e un test diventa
> rosso, qui trovi **quale** test guarda cosa e **se** va sistemato il codice o il
> test. Niente panico: un test rosso è un *segnale preciso*, non rumore.
>
> Si affianca a:
> - **`docs/TEST_SPEC.md`** — *cosa* è testato, area per area (la matrice ✅/⬜).
> - **`.claude/agents/testing.md`** — le *regole d'oro* dell'agente test (chi può
>   toccare cosa). Questo file è la parte operativa: la **mappa** e il **triage**.

---

## 1. Il rito "siamo verdi?" — i 4 gate

In ordine, dal più veloce al più lento:

| # | Comando | Cosa intercetta |
|---|---|---|
| 1 | `npm test` | logica/contratti rotti (Vitest, 20 file) |
| 2 | `npm run typecheck:test` | i **test** non compilano più col sorgente (firme cambiate) |
| 3 | `npx tsc --noEmit` | il **progetto** non compila (tipi) |
| 4 | `npm run build` | la build Next si rompe (import, runtime di build) |

Tutti e quattro in un colpo solo: **`npm run check`**. È esattamente ciò che gira
in **CI** (`.github/workflows/ci.yml`, Node 22) su push e PR. CI rossa ⇒ riproduci
in locale con `npm run check`.

Segnale più rapido durante lo sviluppo: `npm test` (≈2s di esecuzione vera). Per
guardare un solo file: `npx vitest run test/<file>.test.ts`. Watch: `npm run test:watch`.

---

## 2. Mappa codice → test (chi guarda cosa)

Tocchi un modulo a sinistra ⇒ aspettati che reagiscano i test a destra.

| Sorgente | Test che lo blindano |
|---|---|
| `lib/engine.ts` (buildNode, buildPagePlan, clamp pagine 10–20, id `char_*`/`luogo_*`) | `engine.unit`, `engine.parity`, `e2e` |
| `lib/commands.ts` (executeCommand, validateSeed, COMMANDS) | `commands` (+ `Phase1Seeding` via `set_world`) |
| `lib/reference.ts` (deriveEntities, buildReferenceSheetPrompt, referenceGate) | `reference.unit`, `reference`, `e2e`, `Phase3Immagini` |
| `lib/pagePrompts.ts` (buildPagePrompts, allReferencesReady, POV/momento/scala) | `reference.unit`, `e2e`, `Phase3Immagini` |
| `lib/stylesheet.ts` (buildStylesheet: world/season/age) | `reference.unit` (+ via pagePrompts in `e2e`) |
| `lib/stages.ts` (deriveStages, currentPhase, ORDER, hasArtifact) | `stages.store`, `Workspace` |
| `lib/store.ts` (loadStory/saveStory, EXAMPLE_STORY) | `stages.store` (+ `Workspace` con loadStory mockato) |
| `lib/seedFromGame.ts` | `seedFromGame` |
| `lib/ai/registry.ts` (PROVIDERS, clampReasoning) | `ai`, `ModelPicker` |
| `lib/ai/config.ts` (DEFAULT_SELECTION, getSelection/setSelection) | `ai`, `ModelPicker`, **`aiConfig`** (contratto: mai invalida/throw) |
| `lib/ai/client.ts` · `sse.ts` · `providers/*` | `ai` (fetch **mockato**) |
| `lib/ai/tasks/seeding.ts` | `aiSeeding` |
| `lib/ai/tasks/prosa.ts` | `aiProsa` |
| `lib/ai/tasks/critic.ts` + `lib/audit.ts` | `aiCritic` |
| `lib/brief.ts` | `brief` |
| `lib/book.ts` (assembleBook, renderBookHtml) | `book` |
| `lib/images/*` (composeImagePrompt, generateImage, provider openai/manual) | `imageGen` (fetch **mockato**) |
| `lib/enums.ts` (ACTOR_META, WORLD_FLAVORS, KIND_SCALE…) | trasversale: `engine.unit`, `reference.unit`, `commands` |
| `lib/types.ts` · `engineTypes.ts` | trasversale (tipi) → gate **2/3** |
| `components/Workspace.tsx` (phaseReached, gating tab) | `Workspace` |
| `components/phases/Phase1Seeding.tsx` | `Phase1Seeding` |
| `components/phases/Phase3Immagini.tsx` | `Phase3Immagini` |
| `components/ai/ModelPicker.tsx` | `ModelPicker` |

> Componenti **non** coperti da smoke diretto (Phase2Prosa, Phase4Libro, SeedingGame,
> Stem, Ledger, GraphView, ui): cambiandoli i gate 2/3/4 li proteggono comunque dai
> rotture di tipi/build; se diventano "nodali" si aggiunge uno smoke (vedi §6).

---

## 3. Test rosso → cosa faccio (triage in 2 domande)

**Domanda 1 — il cambiamento in quel punto era *voluto*?**

- **NO** → il test ha **beccato una regressione**. Il contratto è la verità (lo
  fissa `TEST_SPEC.md`): non rilassare il test, **sistema il codice** (o annulla la
  modifica non intenzionale). Il test ti ha appena risparmiato un bug silenzioso.
- **SÌ** (hai cambiato il contratto di proposito) → il test sta ancora descrivendo
  il **vecchio** comportamento. **Aggiorna il test** al nuovo contratto, mantenendone
  l'*intento*. (Non modificare il sorgente per accontentare un test vecchio: aggiorna
  il test.) Se preferisci, delega all'**agente testing** — è il suo mestiere.

**Domanda 2 — è un test UI dopo un redesign?**

Se il front è cambiato apposta (es. tab → stepper) e uno smoke §6 è solo *stale*:
aggiorna **il test** alla nuova UI, stesso intento (non il back). È l'unica eccezione
in cui l'agente testing tocca un test "perché il front è cambiato".

**Caso speciale — sembra "rete/flaky":** i test **non** chiamano mai la rete vera. Se
qualcosa tenta una `fetch` reale è un **mock mancante**, non un fallimento del codice
(vedi convenzioni in §5).

Regola dell'agente testing (da `testing.md`): se un test rivela un **bug nel
sorgente** e tu sei in modalità "solo test", **fermati e segnala** invece di
aggiustare `lib/`. Se invece stai lavorando al codice dell'app, quel rosso *è* il tuo
bug da correggere.

---

## 4. "Se tocchi X, aspettati Y" — pattern ricorrenti di questo repo

| Modifica tipica | Diventa rosso | Come sistemare (se voluto) |
|---|---|---|
| Cambi il **modello/reasoning di default** in `ai/config` (DEFAULT_SELECTION) | `ModelPicker`, `ai` | aggiorna i valori attesi (provider/modello/reasoning) |
| Aggiungi/rinomini un **provider o modello** in `ai/registry` | `ai`, `ModelPicker` | aggiorna gli elenchi/clamp attesi |
| Rinomini o cambi i **parametri di un comando** | `commands` (+ `Phase1Seeding`) | aggiorna nome/param nel test del comando |
| Cambi una **stringa di prompt** (stylesheet, frasi POV/momento, framing foglio) | `reference.unit`, `e2e`, `Phase3Immagini` | aggiorna le sottostringhe attese |
| Cambi gli **id entità** o le **clamp** del motore (slug, 10–20 pagine) | `engine.unit`, `e2e` | aggiorna gli id/limiti attesi |
| Cambi il **gating fasi** (phaseReached/deriveStages/ORDER) | `Workspace`, `stages.store` | aggiorna i vettori di stato / abilitazioni tab |
| Cambi lo **shape di un tipo** (`types.ts`) | gate **2/3** prima ancora dei test | adegua i test che costruiscono quell'oggetto |
| Cambi la **chiave di storage** o `EXAMPLE_STORY` | `stages.store` | aggiorna chiave/atteso |
| Cambi il formato **richiesta/parse** di un task AI (seeding/prosa/critic) | `aiSeeding`/`aiProsa`/`aiCritic` | aggiorna request builder / parser attesi |
| Cambi il **prompt immagini** o il contratto del provider | `imageGen` | aggiorna prompt/mocked response |

---

## 5. Invarianti che non devono MAI rompersi

- **Determinismo**: stesso `seed`+`nonce` ⇒ stesso `node`, stessi `entities.id`,
  stessi page prompt (a meno delle immagini). Lo fissano `e2e` §7.3 e `engine.unit`
  §1.12 (400 nonce). Se diventa "flaky" hai introdotto **non-determinismo** nel
  percorso del motore (`Math.random`/`Date.now`/ordine di Set/Map): è un **bug**, non
  un test da rilassare.
- **Niente rete nei test**: il layer AI e le immagini si testano con `fetch`
  **mockato** (`vi.stubGlobal`) o con funzioni pure (request-builder/parser); mai API
  vere, env stubbate. Le chiavi si leggono a **runtime**, non in build/test.
- **I test non toccano** `lib/` · `components/` · `app/`. (Il confine è nei file
  agente.) I bug del sorgente si *segnalano*, non si nascondono cambiando un assert.
- **jsdom è opt-in per-file** col docblock `// @vitest-environment jsdom` (solo gli
  smoke §6). Tutto il resto gira in `node`, veloce.
- **Niente ontologia EAR nell'output** (vedi `CLAUDE.md`): se un prompt iniziasse a
  contenere termini interni, è una regressione di contenuto.

---

## 6. Aggiungere test per codice nuovo (la ricetta)

1. **Nuovo modulo `lib/`** → nuovo `test/<feature>.test.ts`, ambiente `node`.
   Copia la forma di un fratello già esistente: logica pura → come `brief.test.ts`;
   task AI in streaming → come `aiProsa.test.ts`/`aiSeeding.test.ts`; chiamata di rete
   → come `imageGen.test.ts`/`ai.test.ts` (mocka `fetch`).
2. **Nuovo schermo "nodale"** → smoke jsdom sullo stampo di `Workspace.test.tsx` o
   `Phase3Immagini.test.tsx` (docblock jsdom; mocka i figli pesanti e la rete).
3. **Marca la riga** in `docs/TEST_SPEC.md` (✅ + nome file). Un commit per area,
   messaggio chiaro in italiano.
4. Chiudi con i **4 gate** (`npm run check`).

Nota d'ambiente già nota: jsdom non implementa `scrollIntoView` (lo usa la chat di
seeding) → shim no-op **nel solo test** (vedi `Phase1Seeding.test.tsx`), mai nel sorgente.

---

## 7. Stato attuale (snapshot)

Allineato all'ultimo `main`: **20 file di test, 190 test, 0 `todo`, tutti verdi**;
`tsc` e `typecheck:test` 0 errori; `next build` OK.

| File | Area | #test |
|---|---|---|
| `engine.parity` · `engine.unit` | motore §1 | 1 · 17 |
| `commands` | comandi §3 | 30 |
| `reference` · `reference.unit` | reference/prompt §2 | 1 · 16 |
| `stages.store` | stages/store §5 | 14 |
| `ai` · `aiConfig` | layer AI base + contratto config §4 | 27 · 12 |
| `aiSeeding` · `aiProsa` · `aiCritic` | task AI (M2) | 7 · 8 · 16 |
| `brief` · `book` | writing brief + montaggio libro (M6) | 8 · 10 |
| `imageGen` | immagini (M5) | 7 |
| `e2e` | contratto end-to-end §7 | 3 |
| `Workspace` · `Phase1Seeding` · `Phase3Immagini` · `ModelPicker` | smoke UI §6 (jsdom) | 5 · 2 · 2 · 3 |
| `seedFromGame` | parità gioco→seme | 1 |

Quando aggiungi un'area, aggiorna questa tabella e la matrice in `TEST_SPEC.md`.
