# ROADMAP — Integrazione motore + FASE 0 in Scrivia (branch-ready)

> **Modo di lavoro.** Qui in chat prepariamo **zip branch-ready**; Ray le porta su Claude Code;
> l'integratore verifica (test), applica ai percorsi di Scrivia, fa il merge a mano. Un branch
> per scopo. Questo file è anche **anti-drift**: se la chat si compatta, qui ci sono scope, file,
> mapping dei tipi e contratti per produrre ogni zip senza perdere niente. Viaggia in `docs/` di
> ogni zip.

## Formato di ogni zip
```
branch-<nome>/
  INTEGRATION.md     ← per l'integratore: cosa fa · file aggiunti/sostituiti · dipendenze ·
                       come verificare (comandi test) · note di mapping tipi · rischi
  lib/… app/… components/…   ← file ai PERCORSI di Scrivia, pronti da applicare
  test/…             ← test del branch
  lib/canon.json     ← se aggiornato
  docs/ROADMAP_INTEGRAZIONE.md   ← questo file
```

## Stato già pronto (in chat, dir `app_ts/`)
- Motore TS corretto a **parità di contratto** col Python (nodo, hook, voce, invarianti); fuzz 5000→0; pytest 49 verdi.
- **FASE 0 Reference**: record d'entità, prompt-reference→descrittore, check coerenza, orchestrazione + gate.
- **FASE 1**: hook completi (F1.1), prompt-pagina (F1.2).
- 76 test. Bug della riparazione varietà-hook trovato e corretto (in TS e nel Python). Vedi `REPORT_bug_hook_repair.md`.

## Tipi di Scrivia (la forma a cui adattarsi)
- `Seed` { language, title, protagonist{name,age,kind}, companions[{name,kind}], world_flavor, setting{primary,notes}, theme, pugno, personal_detail, length_pages, packs[], spine{premise,problem,**threshold_moment**,**resolution_mode**,closure}, voice{5 assi}, nonce }
- `StoryNode` { grammatica EAR + premise/problem/threshold_moment/resolution_mode + pugno/personal_detail + beat_plan + seeds + protagonist/companions + season/palette + seed_nonce }
- `PagePlan` { page, beat, hook, zone, note } ← oggi semplice, va arricchito
- `ManusPrompt` { page, hook, beat, storyMoment, pov, place, characters, imageUrl? }
- `VoiceOverrides` = 5 assi (temperamento, ritmo, distanza, lente_sensoriale, umorismo) — **già identici al nostro `canon.json`** (valori compresi: temperamento ironica/tenera, ritmo spezzato_paratattico, ecc.).

---

## BRANCH (in ordine di dipendenza)

### B1 — `engine-parity` · **SOSTITUISCE `lib/engine.ts`** · FONDAZIONE
**Scopo.** Rimpiazzare il motore in ritardo con quello corretto a parità piena. Fixa i 3 bug presenti *verbatim* in `lib/engine.ts`:
1. `attribute_dominant` slegato da `seed.voice &&` → usa `THEME_TO_ATTRIBUTE[theme]` o campiona.
2. `threshold_page` = inizio del beat **cambiare** (triadico) / `round(pages·0.70)` (mono) — **non** `0.75` fisso.
3. `register` con varianza (banda d'età + neighbor-shift) + override.

Più: `extractHooks` completo (focal_action, atmosphere, palette, **characters_present strutturato `{name, entityId}`**, riparazione varietà robusta), voce frattale (`resolveVoice`), invarianti (`checkNode`/`checkHooks`), `entitiesInScene`. E la **suite di parità** (fuzz + invarianti) = il loro **M1**.

**File (percorsi Scrivia).**
- `lib/engine.ts` ← **sostituito** (buildNode + extractHooks + resolveVoice + invarianti + entitiesInScene), tipizzato su `Seed`/`StoryNode`. Rimpiazza anche `buildPagePlan` (→ `extractHooks`).
- `lib/canon.json` ← **nuovo** file dati (il motore lo legge; fonte unica condivisa).
- `lib/types.ts` ← **estendere (non rompere)**: a `StoryNode` aggiungere opzionali `debt?`, `recurring_image?`, `setting_entity_id?`; arricchire `PagePlan` (o nuovo tipo `Hook`) con `type`, `characters_present`, `focal_action`, `atmosphere`, `palette`, `markers`.
- `test/engine.parity.test.ts` ← fuzz (≥2000) + invarianti + determinismo.

**Mapping tipi (preciso).**
- seed→buildNode: copiare `seed.spine.{premise,problem,threshold_moment,resolution_mode}` nel nodo; `theme` via `THEME_TO_ATTRIBUTE`; `voice` (5 assi) come override; `companions` filtrati per nome.
- nodo: produrre TUTTI i campi di `StoryNode` + i 3 opzionali nuovi.
- hook: `type`→`hook`, `composition_zone`→`zone`, `note` derivato dai markers (APERTURA/SOGLIA/CHIUSURA), + i campi ricchi.

**Contratto.** Stessa nonce ⇒ stesso nodo. `checkNode`/`checkHooks` = 0 su fuzz ≥2000. (Parità di contratto col Python, non byte.)
**Verifica.** `npx tsx test/engine.parity.test.ts` (o `npm test`).
**Rischi.** Unico branch che *sostituisce* codice. Verificare i consumatori di `PagePlan` nella UI: i campi nuovi sono **additivi**, i vecchi (`hook`,`zone`,`note`) restano.

### B2 — `reference-phase` · NUOVI FILE (+ adatta `ManusPrompt`) · dipende da B1
**Scopo.** La FASE 0 che a Scrivia manca + i prompt-pagina (loro **M6** "manus") che leggono il canone confermato.
**File.**
- `lib/entity.ts` (F0.1), `lib/reference.ts` (F0.2), `lib/coherence.ts` + `lib/referencePhase.ts` (F0.4), `lib/stylesheet.ts` (costanti immagine single-source), `lib/pagePrompts.ts` (F1.2).
- `lib/types.ts` ← aggiungere i tipi entità (`EntityRecord`, `EntityVersion`, `EntityKind`, …); adattare `ManusPrompt` → `{ page, hook, beat, storyMoment, pov, place, characters, references[], missing[], imageUrl? }`.
- `test/referencePhase.test.ts`, `test/pagePrompts.test.ts`.
**Mapping.** `buildPagePrompts` produce i campi di `ManusPrompt` (storyMoment/pov/place/characters) + `references[]` (immagini canoniche da allegare) + `missing[]` (entità non confermate).
**Contratto.** Cascata read-through; gate "entità in scena confermate"; check coerenza segnala nel punto preciso; scenario e2e (sciarpa rossa→blu). Richiede `entityId` sulle entità → vedi B3.

### B3 — `seeding-game` · UI + mapping seed + **espansione voci** · dipende da B1
**Scopo.** Integrare `seeding_game_v2.jsx` nello studio di seeding + mappare l'output sul `Seed` + l'espansione voci.
**File.**
- `components/SeedingGame.tsx` ← il jsx portato a `.tsx` tipizzato, agganciato allo studio esistente.
- `lib/seedFromGame.ts` ← **mapping**: `spine.threshold→threshold_moment`, `spine.resolution→resolution_mode`, `move`→attribute (via `MOVES`), `themeFree`→theme, `detail`→personal_detail, `hasSage`, assi voce (già combaciano), + **iniezione `entityId`** per protagonista/compagni/luogo (servono alla FASE 0).
- `lib/types.ts` ← **espansione voci-personaggio**: aggiungere `CharacterVoice` `{ archetipo/dom, stress, ritmo, parole, never }` (modello del gioco, più ricco dell'idioletto deterministico) → confluisce nel **brief della prosa**.

**Riconciliazione voci.**
- **Narratore:** assi GIÀ identici (`canon.json` == `enums`). Le due modalità del gioco (riferimenti scomposti per faccette · "a orecchio" A/B) producono override sui 5 assi → `resolveVoice` li consuma diretti. **Nessun lavoro sul canone.**
- **Personaggi:** il gioco è più ricco (archetipo dominante + sotto-stress + ritmo + "parole sue" + "non direbbe MAI" + matrice-72). Il nostro `resolveVoice` produce idioletto `{tic_verbale, tempo, rivolgersi}`. **Riconciliazione:** la voce-personaggio dell'autore viaggia nel seed come override e alimenta il **brief prosa** (è lì che serve, quando l'IA scrive i dialoghi); l'idioletto deterministico resta il default quando l'autore non specifica.
**Contratto.** L'output del gioco produce un `Seed` valido che `buildNode` accetta; gli assi voce passano gli invarianti.

---

## DA AGGIUNGERE alla `ROADMAP.md` di Scrivia

Sulla numerazione M esistente + nuovi item:

- **M1 (parità engine)** → **coperto da B1** (suite fuzz + invarianti). ✅ spuntabile a merge avvenuto.
- **M6 (motore TS completo)** → buildNode/extractHooks/voce/invarianti in **B1**; manus (page-prompts) in **B2**. Resta: brief testuale completo, montaggio/impaginazione, audit.
- **M5 (illustrazioni native)** → la **FASE 0 Reference** (B2) è il **prerequisito** (niente immagini senza canone visivo confermato). F0.3 (gpt-image-2) e upscale stampa restano pianificati.

**Nuovi item:**
- **FASE 0 — Reference (umano nel loop)** [NUOVA FASE, B2]: record d'entità → conferma reference → check coerenza → gate. Sta **tra** seeding e prosa. Manuale al lancio (l'umano genera in Manus/gpt2 e riporta immagine+prompt); F0.3 = automatico dopo.
- **F1.3 — Impaginazione del libro** (A5 print-ready): da costruire (testabile con prosa+immagini segnaposto).
- **Rifiniture FASE 0**: cascata piena a tutti i doc · pointer-edit (gpt2) · critica semantica LLM (estrae i vincoli dalla narrativa congelata di Isola).
- **Espansione voci-personaggio**: matrice-72 (archetipo × stress × ritmo) nel brief prosa.
- **Packs in TS** (es. `ninnananna`) [loro Trasversali].
- **Editor libro / export PDF** [loro Trasversali].

## Decisioni chiuse
- Linguaggio app: **TypeScript** (Python resta per Isola-locale).
- Repo: **Scrivia**.
- Immagini al lancio: **manuali**.

## Decisioni aperte
- Provider al lancio (Anthropic + DeepSeek già in `lib/ai/`; aggiungere un economico per il seeding?).
- Upscale stampa (layer esterno deterministico).

---

## Ordine di consegna
1. **B1** `engine-parity` (fondazione, sblocca M1). ← prossimo
2. **B2** `reference-phase` (FASE 0 + page-prompts).
3. **B3** `seeding-game` (UI + mapping + voci).
4. Poi i rimanenti (F1.3 libro, F0.3 immagini, rifiniture) come da sezione sopra.

---

## Workstream agenti & cache degli spawn (separato dal motore)
Stato: il **sistema agenti** è completo (5 corsie + orchestratrice) ed è **cache-nativo per
costruzione**. Prossimo deliverable, **NON ora** (si fa quando si costruisce, non prima):

- **Spawner custom** sul **layer ai** — un runtime che assembla il contesto di ogni agente
  (invariante in testa, breakpoint condiviso) e chiama l'API diretta, per il **risparmio
  cross-agente** (blocco universale condiviso da tutti gli spawn). Irrealizzabile in Claude Code
  (ogni subagent ha cache separata, prefisso non riordinabile); realizzabile solo nello spawner.
- **SPEC master dello spawner** — §5.2 di `docs/CACHE_COME_ARCHITETTURA.md`: compiti atomici,
  **test come criteri d'accettazione** (prefisso byte-stabile, breakpoint giusti, universale
  condiviso cross-agente, TTL/cadenza, allarme `cache_read=0`), escalation point. Write col
  modello top, sul flat. La **fisica** è già in `CACHE_COME_ARCHITETTURA.md`.
- **Riferimento d'implementazione:** il briefer/montatore-prompt di Scrivia (`brief.ts`,
  `pagePrompts.ts`, `stylesheet.ts`) — stessa architettura di cache a livello di prompt.
- **Razionale:** rende l'**orchestrazione autonoma** sostenibile (−55–75% sull'input degli
  spawn) e diventa decisivo quando i servizi SDK/agenti escono dal flat (§5.3). L'orchestratrice
  come **contenitrice costi** — funzione assente nei tool generici, portabile in qualsiasi repo
  (il pattern; l'implementazione resta per-repo).
