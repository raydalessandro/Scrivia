# TEST SPEC — Scrivia (blindatura processi · M1)

Scopo: dire **esattamente cosa testare** per ogni parte del sistema, così che
scrivere i test sia meccanico. Ogni voce ha: **contratto** (cosa deve valere),
**casi** (inclusi i bordi), **stato** (✅ già coperto · ⬜ da scrivere) e **dove**.

> Principio guida del seme: *"la verità è nel grafo"* + determinismo. I test
> proteggono **contratti** e **invarianti**, non l'implementazione. Stesso `nonce`
> → stessa storia è l'invariante madre.

---

## 0. Infrastruttura di test (decisioni)

- **Runner**: **Vitest** per il TS puro di `lib/` (unit + contratto). Alias `@/`
  come `tsconfig`. `environment: "node"` per la logica; `jsdom` solo per i pochi
  test di componenti.
- **Script di parità già esistenti** (`test/*.test.ts`, stile `tsx`): restano
  eseguibili via `npx tsx` **e** vanno avvolti in `describe/it` per girare anche
  sotto Vitest (la logica e gli `assert`/`console` ci sono già). Obiettivo: un
  solo `npm test` verde che li includa.
- **Niente rete nei test**: le chiamate dei provider AI si testano con `fetch`
  **mockato** (shape della richiesta + parsing della risposta), mai contro le API vere.
- **`tsconfig`** esclude già `test/`+`tests/` dal build di Next: i test non entrano
  nel bundle.
- **CI** (M1, finale): `npm run build` + `npm test` ad ogni push (workflow +
  SessionStart hook).
- **Comandi attesi**: `npm test` (Vitest, tutto), `npm run test:engine` /
  `test:reference` (gli script tsx, per debug mirato).

Soglia di "verde": `tsc --noEmit` strict 0 errori · `npm test` 0 falliti ·
`npm run build` ok.

---

## 1. Motore — `lib/engine.ts` (+ `engineTypes`, `canon.json`)

**Contratto.** `buildNode(seed)` produce TUTTI i campi di `StoryNode`; stesso
`nonce` ⇒ nodo identico (voce compresa); gli enum sono nel canone; gli override
del seed (`overrides`, `voice`) sono onorati; `checkNode`/`checkHooks` = 0 su fuzz.

| # | Caso | Stato | Dove |
|---|---|---|---|
| 1.1 | Fuzz ≥2000 seed → `checkNode`=0 e `checkHooks`=0 | ✅ | `test/engine.parity.test.ts` |
| 1.2 | Determinismo: stesso seed → JSON identico (×200) | ✅ | idem |
| 1.3 | Fix #1: `attribute_dominant` = `theme_to_attribute[theme]` senza voce (12/12 temi) | ✅ | idem |
| 1.4 | Fix #2: `threshold_page` = inizio beat `cambiare` (triadico) / in range (mono); unica pagina con `is_threshold` | ✅ | idem |
| 1.5 | Fix #3: `register` con varianza + sempre negli enum | ✅ | idem |
| 1.6 | **Override onorati**: `overrides.{attribute,deployment,entry,closure,register,time_span}` → compaiono nel nodo | ✅ | test/engine.unit.test.ts |
| 1.7 | **Voce override**: `seed.voice.{asse}` valido → `node.voice.narrator` lo usa; assi attivi nel range del canone | ✅ | test/engine.unit.test.ts |
| 1.8 | **Bordi pagine**: `length_pages` <10 / >20 → clamp a [10,20]; beat_plan contiguo da 1 a `pages` | ✅ | test/engine.unit.test.ts |
| 1.9 | **Mono vs triadico**: `ear_arc` = `[attr]` (mono) / triade (triadico) coerente con `deployment_level` | ✅ | test/engine.unit.test.ts |
| 1.10 | **Semi**: nessuna collisione pianta/paga; pianta<paga; entro le frazioni del canone | ✅ (in 1.1) | esplicitare in unit |
| 1.11 | **`extractHooks`**: 1 hook/pagina; tipi negli enum; ≤ max consecutivi; ≥ min tipi distinti; marker entry/closure/threshold/semi coerenti | ✅ (1.1) | esplicitare |
| 1.12 | **Riparazione varietà-hook**: storie corte (8-9 pp) non scendono sotto `min_distinct_types` e non creano consecutivi | ✅ | test/engine.unit.test.ts |
| 1.13 | `entityIdOfCharacter` / `locationEntityId`: stabili e slug-safe (accenti, spazi) | ✅ | test/engine.unit.test.ts |
| 1.14 | `entitiesInScene(hooks,node)`: = personaggi presenti ∪ luogo; nessun duplicato | ✅ | test/engine.unit.test.ts |

---

## 2. Reference (Passo 0) — `lib/reference.ts` · `pagePrompts.ts` · `stylesheet.ts`

**Contratto.** Le entità si ricavano dal nodo e i loro `id` combaciano con
`characters_present` degli hook; il gate è "tutte confermate + immagine"; i
prompt-pagina sono veri e allegano SOLO reference confermate, segnalando le
`missing`.

| # | Caso | Stato | Dove |
|---|---|---|---|
| 2.1 | `deriveEntities`: protagonista+compagni = `character`, luogo = `location`; conteggio giusto | ✅ | `test/reference.test.ts` |
| 2.2 | id entità ↔ `characters_present` combaciano | ✅ | idem |
| 2.3 | **Preserva conferme** su ricostruzione (`prev`): descrittore/immagine/stato non si perdono | ✅ | `test/reference.unit.test.ts` |
| 2.4 | **Dedup** per id (un personaggio non si ripete) | ✅ | `test/reference.unit.test.ts` |
| 2.5 | `referenceGate`: ready solo se ogni entità `confermata` **e** ha `imageUrl` | ✅ | idem |
| 2.6 | `buildReferenceSheetPrompt`: contiene STYLESHEET · `SUBJECT —` · SHEET FRAMING per kind · FORMAT; LOCKED se `prohibitions` | ✅ | `reference.test.ts` + `reference.unit.test.ts` |
| 2.7 | `buildPagePrompts` pre-conferma: ogni pagina ha `missing`, `references` vuote; `allReferencesReady=false` | ✅ | idem |
| 2.8 | `buildPagePrompts` post-conferma: `references` popolate, `missing` vuote; `allReferencesReady=true` | ✅ | idem |
| 2.9 | **Campi veri**: `storyMoment` (beat+composizione+eventi pagina), `pov` da tipo hook, `place` dal descrittore confermato | ✅ | `reference.test.ts` + `reference.unit.test.ts` |
| 2.10 | **SCALA**: con ≥2 personaggi in scena → riga SCALA con altezze relative da `KIND_SCALE` | ✅ | `test/reference.unit.test.ts` |
| 2.11 | `stylesheet`: mappa `world`/`season` → testo; fallback ai default; blocco NEGATIVE e "NO text" presenti | ✅ | `test/reference.unit.test.ts` |
| 2.12 | Blocchi fissi: `bookStylesheet` contiene "ART STYLE"; `CONSISTENCY_BLOCK` contiene "BINDING" | ✅ | idem |

---

## 3. Registry comandi — `lib/commands.ts` (+ `cache.ts`)

**Contratto.** Unica fonte di verità: ogni mutazione passa da `executeCommand`,
produce una nuova `Story`, registra in `commandLog`; i comandi `pure` usano la
cache; `build_node` è il "click" che porta a `stage:"manus"` con grafo+piano+
entità+manus veri.

| # | Caso | Stato | Dove |
|---|---|---|---|
| 3.1 | `validateSeed`: errori sui campi mancanti; seed completo → 0 errori; tema non mappato → warning (non errore) | ✅ | test/commands.test.ts |
| 3.2 | Ogni comando di mutazione applica il delta giusto e setta `updatedAt` | ✅ | test/commands.test.ts |
| 3.3 | `executeCommand` registra in `commandLog` (name/by/summary) solo per le mutazioni | ✅ | test/commands.test.ts |
| 3.4 | `set_theme` deduce l'attributo via ontologia (`data.attribute`) | ✅ | test/commands.test.ts |
| 3.5 | Comando **puro** (`validate_seed`/`summarize_story`/`suggest_*`): 2ª chiamata `cached:true`; invalidazione su mutazione | ✅ | test/commands.test.ts |
| 3.6 | Comando sconosciuto → no-op (stessa `Story`, nessun log) | ✅ | test/commands.test.ts |
| 3.7 | `build_node` end-to-end: `node` + `pagePlan` + `entities` (3) + `manus` veri; `stage:"manus"`; nonce esplicito → riproducibile | ✅ | test/commands.test.ts |
| 3.8 | `set_intake_notes`: salva `intakeNotes` | ✅ | test/commands.test.ts |
| 3.9 | `toMcpTools`: 1 tool per comando; `name`/`description`/`inputSchema(type:object)`; `required` = param obbligatori | ✅ | test/commands.test.ts |
| 3.10 | `set_spine` con `field` fuori enum → no-op con summary chiaro | ✅ | test/commands.test.ts |

---

## 4. Layer AI — `lib/ai/*` (fetch mockato, niente rete)

**Contratto.** Provider-agnostic: la facciata risolve selezione→adapter→chiave;
il reasoning si riallinea al modello; gli adapter formano la richiesta giusta per
ogni provider e parsano la risposta in forma neutra.

| # | Caso | Stato | Dove |
|---|---|---|---|
| 4.1 | `registry`: ogni modello dichiara ≥1 livello reasoning | ✅ | test/ai.test.ts |
| 4.2 | `clampReasoning`: opus high→high · haiku high→off · deepseek-chat *→off · fable off→livello attivo | ✅ | test/ai.test.ts |
| 4.3 | `config`: ogni default per-fase punta a modello esistente con reasoning supportato; `getSelection` in node = default riallineato | ✅ | test/ai.test.ts |
| 4.4 | `resolveSelection` (client): esplicito vince sul default; senza chiave → `AIKeyMissingError` | ✅ | test/ai.test.ts |
| 4.5 | `sseJson`: dato un body finto multi-chunk con `data:` e `[DONE]`, produce gli oggetti giusti; ignora righe parziali/non-JSON | ✅ | test/ai.test.ts |
| 4.6 | **Anthropic `buildBody`**: off→`thinking:disabled` (dove consentito) · low/med/high→`adaptive`+`effort` · fable→solo `effort` (no off) · haiku→niente `effort` · tool mapping `{name,description,input_schema}` · `tool_choice` | ✅ | test/ai.test.ts |
| 4.7 | **Anthropic parse** (mock): text/thinking/tool_use → `CompletionResult`; `stop` mappato (end/tool_use/length/refusal) | ✅ | test/ai.test.ts |
| 4.8 | **DeepSeek `buildBody`**: system in `messages`; tool in formato OpenAI; `tool_choice` | ✅ | test/ai.test.ts |
| 4.9 | **DeepSeek parse** (mock): `content`/`reasoning_content`/`tool_calls` (arguments JSON) → result; `finish_reason` mappato | ✅ | test/ai.test.ts |
| 4.10 | `/api/ai` GET: shape (providers/defaults/configured); POST senza chiavi → 501; body senza `messages` → 400 | ✅ | test/ai.test.ts |

---

## 5. Stato fasi & store — `lib/stages.ts` · `lib/store.ts`

| # | Caso | Stato | Dove |
|---|---|---|---|
| 5.1 | `deriveStages`: transizioni done/ready/gate/locked coerenti con gli artefatti presenti | ✅ | `test/stages.store.test.ts` |
| 5.2 | `currentPhase`: seeding→immagini→libro secondo prose/manus/stage | ✅ | `test/stages.store.test.ts` |
| 5.3 | `phaseReached` (Workspace): gating delle tab per artefatto | ✅ | `test/Workspace.test.tsx` |
| 5.4 | `store`: `saveStory`/`loadStory` roundtrip (localStorage mock); `EXAMPLE_STORY` sempre presente; `deleteStory` non tocca l'esempio | ✅ | `test/stages.store.test.ts` |

---

## 6. Componenti UI (jsdom · smoke, non pixel)

Obiettivo: **render senza crash** + un'interazione chiave per componente. Heavy,
quindi prioritari solo i nodali.

| # | Caso | Stato | Dove |
|---|---|---|---|
| 6.1 | `Workspace`: monta una storia, mostra stelo + tab; cambio fase raggiungibile | ✅ | `test/Workspace.test.tsx` |
| 6.2 | `Phase1Seeding`: intake → "Inizia con l'IA" appende il messaggio d'apertura e passa a studio; un comando da campo muta la `Story` | ✅ | `test/Phase1Seeding.test.tsx` |
| 6.3 | `Phase3Immagini`: storia con node/pagePlan → `useEffect` ricava entità; conferma reference → `references` compaiono nei page prompt | ✅ | `test/Phase3Immagini.test.tsx` |
| 6.4 | `ModelPicker`: cambiare provider→modello aggiorna i reasoning disponibili; persiste via `setSelection` | ✅ | `test/ModelPicker.test.tsx` |

---

## 7. End-to-end deterministico (contratto di fase)

| # | Caso | Stato | Dove |
|---|---|---|---|
| 7.1 | Seed completo → `build_node` → entità "da_generare", page prompt con `missing` | ✅ (manuale) | formalizzare |
| 7.2 | Conferma tutte le reference → `allReferencesReady=true`; ogni page prompt ha `references` | ✅ (in 2.8) | e2e unico |
| 7.3 | Riproducibilità trasversale: stesso seed+nonce → stesso `node`, stessi `entities.id`, stessi page prompt (a meno delle immagini) | ⬜ | da scrivere |

---

## Priorità di scrittura (ordine consigliato)
1. **§3 commands** + **§1.6–1.14 motore** (cuore deterministico, già quasi tutto verde nei fuzz).
2. **§4 layer AI** (fetch mock) — prima del collegamento reale (M2).
3. **§2 reference** (completare i gap 2.3/2.4/2.10/2.11).
4. **§5 stages/store**.
5. **§6 UI smoke** (solo i 4 nodali).
6. **§7 e2e** + **CI**.

## Tracciamento
Quando un test passa, marca qui ✅ con il file. Obiettivo M1: tutte le righe ✅,
`npm test` in CI ad ogni push.
