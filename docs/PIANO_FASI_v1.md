# PIANO FASI — Scrivia, dettaglio eseguibile di tutto il rimanente (anti-drift)

> **Scopo.** Dettagliare OGNI fase rimanente della roadmap a livello eseguibile (scope · file ai
> percorsi Scrivia · interfacce · contratti · verifica · dipendenze), e **distillare qui** le fonti
> (note Manus, mappa di `seme/`, interfaccia del layer AI) così che una compattazione non costringa
> mai a recuperare informazioni. Questo file viaggia in `docs/` di ogni zip e si tiene aggiornato.
>
> **Stato a oggi:** B1 (motore), B2 (reference + prompt-pagina veri), B3 (seeding-gioco) **mergiati**.
> Restano: M5 (generazione immagini), M2 (collegare le IA: seeding/prosa/critic), M6 (brief/montaggio/
> audit in TS), il resto di M1 (test+CI). Le branch qui sotto chiudono tutto.

---

## 0. Modo di lavoro (invariato)
- Si preparano **zip branch-ready** (file ai percorsi di Scrivia + `INTEGRATION.md` + test + questo doc).
- **Un branch per scopo.** Ray mergia a mano su GitHub. Ogni branch è verificato (`tsc --noEmit` strict +
  smoke/parità) **contro il repo vero** prima della consegna. **Merge-first**: si mergia, si fa pull, si
  costruisce la successiva sulla baseline aggiornata.
- Principi tenuti ovunque: **verità nel grafo**, **EAR invisibile**, **autorità umana** (niente azioni
  irreversibili autonome), **due cancelli voluti** (reference + critic).

## 1. Decisioni chiuse (non ridiscutere senza motivo)
- **Linguaggio app = TypeScript.** Python (`seme/`, `isola/`) resta come **riferimento** da portare, non runtime.
- **Immagini = percorso GPT implementato SUBITO, API non ancora attaccata.** Manus e GPT-Image sono
  **intercambiabili** a livello d'interfaccia (stesso prompt strutturato + stesse `references[]`). Si
  implementa direttamente il percorso GPT (`lib/images/`); senza chiave il provider risponde "non
  collegato" in chiaro e si resta in **modalità manuale** (l'umano genera in Manus e incolla immagine).
  Quando la chiave è attaccata, **gli stessi script girano** verso GPT-Image. Le prime prove le fa Ray con Manus.
- **Critic = a strati con guasti indipendenti** (è il *doppio turno*): (1) regex superficie, (2) strutturale,
  (3) critic **semantico LLM**. NON solo-LLM. (È già così in `seme/`, P6.)
- **Reference (B2) è il prerequisito di M5**: nessuna immagine di pagina senza il canone visivo confermato (gate).
- **Provider testo** = anthropic + deepseek (già in `lib/ai/`). Il seeding può usare un modello economico.
- **EAR mai nominato** in output (testo, prompt, UI, footer).

---

## 2. FONTI DISTILLATE (così non si recuperano più)

### 2.1 Note tecniche Manus → spec della generazione immagini (M5)
Empiriche, da `note_tecniche_generazione_immagini*.txt` (analisi di come GPT-Image-2 si comporta davvero):
- **API**: `generate_image` con **array `references`** (NON l'endpoint `/edit`). È text-to-image con
  *conditioning visivo*: le reference orientano stile/personaggi/luoghi, non vengono "incollate".
  Variante `generate_image_variation` (con references) per editing/raffinamento, ma **tende a portarsi
  dietro i difetti** dell'immagine di partenza → quando c'è deriva, **rigenerare da zero**.
- **Reference per pagina**: SOLO i personaggi presenti nella scena + il luogo (se disponibile). **3-5
  immagini** per chiamata (3-4 ottimale); oltre, l'influenza si **diluisce**.
- **Ancora anti-deriva (fattore #1)**: riattaccare **sempre la stessa scheda canonica originale** del
  personaggio, **mai l'ultima pagina buona** (l'ultima pagina si allega solo quando si rigenera *quella*
  pagina, per tenere la composizione). Usare l'ultima pagina come reference = deriva cumulativa.
- **Peso reference**: nessun parametro numerico (`cfg_scale`/`image_weight` non esposti). Controllo
  indiretto: densità del prompt testuale (prompt lungo "compete" con le reference), numero di reference,
  scelta del tool (da-zero pesa più le reference). Sweet spot: **2-3 reference + descrizione testuale
  dettagliata e ripetuta** (colori esatti di ogni capo). Né solo-visivo né solo-testuale.
- **Anti-fallimento**: lista **divieti espliciti** ripetuti ogni volta ("NO hood", "OPEN cloak"…) — il
  modello non ha memoria tra chiamate e riempie i buchi con la soluzione statisticamente più probabile.
  SUBJECT identico ripetuto. Stile in **testa** al prompt.
- **Formato**: 2:3 verticale, output **1536×2304** (quality "high"). Le reference possono avere aspect
  ratio diverso (le canoniche sono ~832×1248 / 912×1136), ma stesso-ratio rende meglio.
- **Conseguenza di design (già applicata in B2)**: la coerenza si costruisce **nell'immagine di
  reference**, non nel testo. → Passo 0: una reference canonica per entità, riattaccata a ogni pagina.

### 2.2 Mappa di `seme/` (il Python da portare per M2/M6) — dentro `scrivia/seme/`
Loop: `seed → nodo → hook → brief → prosa → audit → montaggio`. Solo *seeding* e *prosa* usano LLM.
- `scripts/build_node.py` → **già portato** (B1 `lib/engine.ts`).
- `scripts/extract_hooks.py` → **già portato** (B1, `extractHooks`).
- `scripts/to_manus_prompts.py` → **già portato** (B2 `lib/pagePrompts.ts` + `lib/stylesheet.ts`): blocchi
  STYLESHEET (testa) · SUBJECT (descrittori reference) · SCALA · STORY MOMENT · POV · CHARACTER
  CONSISTENCY (coda) · divieti ripetuti. **Questa è la base prompt per M5.**
- `scripts/build_brief.py` (1264 righe, zero-token) → **da portare** (M6/B5): nodo+hook → writing brief
  markdown completo che la prosa consuma. Include §voce, §semi-da-piantare/pagare, §pattern da evitare.
- `scripts/audit_story.py` + `canone/PATTERN_DA_BANDIRE.md` → **da portare** (B8): audit deterministico
  (regex lessico bandito con tetti per storia + coerenza strutturale).
- `scripts/build_book.py` → **da portare** (M6/F1.3/B9): prosa + immagini → libro A5 (HTML→PDF print-grade).
- `skill/SKILL_seeding.md`, `skill/SKILL_prosa.md`, `skill/SKILL_critic.md` → diventano i **system prompt**
  delle chiamate `aiStream`/`aiComplete` (M2). `seed.template.yaml` = lo schema seed.

### 2.3 Interfaccia layer AI Scrivia (`lib/ai/`) — per M2
- `index.ts`: `aiComplete(req): Promise<CompletionResult>` · `aiStream(req): AsyncIterable<StreamEvent>` ·
  `configuredProviders()`.
- `client.ts`: facciata + `AIKeyMissingError` (senza chiave → errore in chiaro; la route risponde 501).
- `config.ts`: `DEFAULT_SELECTION: Record<AITask, ResolvedSelection>` · `getSelection(task)` · `setSelection`.
- `types.ts`: `ProviderId = "anthropic"|"deepseek"` · `AIMessage{role,content}` · `AITool` · `AIToolCall` ·
  `CompletionRequest{messages, tools?, selection, ...}` · `StreamEvent` (delta/tool/usage/stop) · `AITask`.
- `registry.ts`: `PROVIDERS`, `getModel`, `clampReasoning`. `providers/` = adapter per provider.
- `app/api/ai/route.ts`: GET (registry/defaults/stato chiavi) · POST (completion / `?stream=1`). È il
  punto d'aggancio già apparecchiato; **non** ancora collegato alle fasi (lo fa M2).
- **Nota**: lib/ai è **solo testo**. La generazione immagini (gpt-image) è un **modulo nuovo** (`lib/images/`),
  con la stessa filosofia (provider + facciata + stato chiavi), separato dai provider testo.

---

## 3. BRANCH RIMANENTI (in ordine di dipendenza)

### B4 — `image-gen` · M5 generazione immagini (percorso GPT, API non attaccata) · dipende da B2
**Scopo.** Implementare la generazione automatica come **percorso GPT completo**, intercambiabile con
Manus, senza ancora attaccare l'API. Dai prompt di B2 (`ManusPrompt` + blocchi fissi + `references[]`
confermate) si compone il prompt finale e si "genera"; senza chiave si resta manuali, ma il codice è già
quello definitivo.

**File (percorsi Scrivia).**
- `lib/images/types.ts` — `ImageRequest { prompt: string; references: string[]; format: "2:3"; size: "1536x2304" }`,
  `ImageResult { imageUrl: string; provider: ImageProviderId; revisedPrompt?: string }`,
  `ImageProviderId = "openai" | "manual"`, `ImageProviderAdapter { id; ready(): boolean; generate(req): Promise<ImageResult> }`.
- `lib/images/composePrompt.ts` — `composeImagePrompt(node, manusPrompt, entities): ImageRequest`: assembla
  **STYLESHEET (testa)** + SUBJECT(s) + STORY MOMENT + POV + PLACE + SCALA + **CHARACTER CONSISTENCY (coda)**
  + **divieti** (riusa `bookStylesheet`/`CONSISTENCY_BLOCK` di B2 + i campi di `ManusPrompt`), e mette in
  `references` le immagini canoniche confermate (cap a 5, personaggi-in-scena + luogo). **Niente nuovo
  canone**: legge B2.
- `lib/images/providers/openai.ts` — adapter GPT-Image: `ready()` = chiave presente; `generate()` =
  POST immagini con `references[]`, 2:3, 1536×2304 (forma API da `isola/_visual_pipeline/_api/openai_image_gen.py`
  + le note Manus). **La fetch reale è dietro `ready()`**: senza chiave NON parte.
- `lib/images/providers/manual.ts` — adapter "manuale": `generate()` ritorna lo stato "da incollare"
  (nessuna chiamata) → è l'attuale flusso umano (Manus). Default quando openai non `ready()`.
- `lib/images/index.ts` — `generateImage(req): Promise<ImageResult>` (sceglie provider: openai se ready,
  altrimenti manual) + `imageProviderStatus()`.
- `app/api/images/route.ts` — POST genera (o 501/stato manuale senza chiave), GET stato provider. Speculare a `/api/ai`.
- `components/phases/Phase3Immagini.tsx` — **edit chirurgico**: nel Passo 1 (griglia pagine), oltre
  all'upload manuale, un bottone "**Genera**" per pagina/tutte che chiama `generateImage` quando il
  provider è pronto; se non pronto, mostra "modalità manuale (incolla da Manus)" — i prompt e le
  `references[]` sono già quelli. `imageUrl` riempito allo stesso modo per entrambe le strade.
- `lib/types.ts` — additivo: `ManusPrompt += imagePrompt?: string` (il prompt finale composto, utile da
  copiare in Manus e da loggare) e `imageProvider?: ImageProviderId`.
- `test/imageGen.test.ts` — smoke: `composeImagePrompt` produce STYLESHEET in testa + CONSISTENCY in coda
  + divieti + `references` cap 5 (personaggi-in-scena + luogo); `generateImage` senza chiave → provider
  "manual" (nessuna fetch); gate: niente generazione se reference non confermate (`missing` non vuoto).

**Contratto.** Manus≡GPT all'interfaccia: stesso `composeImagePrompt`, stesse `references[]`. Senza chiave:
zero chiamate di rete, stato "manuale" esplicito, comportamento attuale invariato. Con chiave: la stessa
pipeline genera. Le note Manus rispettate (ancora canonica riattaccata, ≤5 ref, divieti, 2:3/1536×2304).
**Verifica.** `npx tsc --noEmit` (0 errori nei file nuovi) + `npx tsx test/imageGen.test.ts`.
**Rischi.** Nessuna chiave nei test → la fetch reale non è esercitata qui (verificata la *forma* + il
routing provider). Da provare end-to-end quando Ray attacca la chiave. `Phase3Immagini` sostituito ma
edit additivo (la strada manuale resta).

### B5 — `brief-ts` · M6 (brief in TS) · dipende da B1
**Scopo.** Portare `seme/scripts/build_brief.py` → TS: da nodo+hook (B1) produce il **writing brief**
completo che la prosa (B7) consuma. Zero-LLM, zero-token.
**File.** `lib/brief.ts` — `buildBrief(node, hooks, entities?): string` (markdown): identità storia, spina
EAR (invisibile, solo come struttura beat), per-pagina hook+beat+cosa-piantare/pagare, §voce (assi narratore
+ `characterVoices`/`narratorBrief` dal seed di B3), §registro, §densità-banalità, §pattern da evitare
(da `canone/PATTERN_DA_BANDIRE`), §istruzione operativa (scrivi una pagina alla volta). `lib/commands.ts`:
il comando `build_node` popola anche `story.brief = buildBrief(...)` (oggi `brief?` esiste ma vuoto).
`lib/types.ts`: nessun cambiamento (brief è già `string?`).
**Contratto.** Il brief contiene tutto ciò che serve alla prosa senza esempi-prima (brief-first). Deterministico.
**Verifica.** smoke: il brief cita ogni pagina, i semi piantati/pagati, gli assi voce; nessuna menzione EAR.

### B6 — `ai-seeding` · M2 (seeding reale) · dipende dal layer AI + commands
**Scopo.** Collegare la chat di seeding alle IA: `aiStream({task:"seeding"})` con **tool-use sui comandi
del registry** (`toMcpTools()`), `composeOpening` come system-context. `SKILL_seeding.md` → system prompt.
**File.** `lib/ai/tasks/seeding.ts` — costruisce la `CompletionRequest` (system = SKILL_seeding + canone
compatto + stato seed; tools = registry); gestisce gli `AIToolCall` eseguendo i comandi (`executeCommand`).
`components/phases/Phase1Seeding.tsx` — la chat usa `aiStream` invece dell'`interpret()` interim; ogni
tool-call applica un comando e logga. `app/api/ai/route.ts` già pronto.
**Contratto.** Senza chiave: 501 in chiaro (la UI mostra "collega una chiave"); il **modo guidato** (B3)
resta utilizzabile a zero-token. Con chiave: l'IA raccoglie il seed conversando ed esegue comandi.
**Verifica.** mock fetch: una risposta con tool-call applica il comando giusto; parsing SSE.

### B7 — `ai-prosa` · M2 (prosa in streaming) · dipende da B5
**Scopo.** Scrivere la prosa dal brief, pagina per pagina, in streaming. `SKILL_prosa.md` → system prompt;
`buildBrief` (B5) → contesto.
**File.** `lib/ai/tasks/prosa.ts` — `streamProse(story, page?)`: `aiStream({task:"prosa"})`, system =
SKILL_prosa + brief; ritorna i delta. `components/phases/Phase2Prosa.tsx` — consuma lo stream e riempie
`story.prose[]` pagina per pagina (già legge `story.pagePlan`/`brief`). `lib/types.ts`: `ProsePage` già esiste.
**Contratto.** Brief-first (mai esempi prima). Voce vincolata (assi + characterVoices). Una pagina alla volta.
**Verifica.** mock: lo stream riempie `prose[page]`; il system include il brief e non nomina EAR.

### B8 — `critic` · M2/M6 (audit a strati) · dipende da B7 (prosa) e B5 (brief)
**Scopo.** Il **doppio turno**: (1) regex + (2) strutturale **deterministici** (port di `audit_story.py`),
(3) critic **semantico LLM** isolato che torna un verdetto JSON (`SKILL_critic.md`). Report unico.
**File.** `lib/audit.ts` — `auditProse(story): AuditReport` deterministico: regex su lessico bandito (tetti
per storia, da `PATTERN_DA_BANDIRE`), strutturale (pagine attese, semi piantati→pagati, presenza soglia,
EAR non nominato). `lib/ai/tasks/critic.ts` — `semanticCritic(story): Promise<CriticVerdict>` via
`aiComplete({task:"critic"})`, system = SKILL_critic, ritorna **solo** `{verdict, checks[], page_flags[]}`
(il tipo `CriticVerdict` esiste già in `types.ts`). `components/phases/Phase2Prosa.tsx` (o Fase 4):
mostra il report combinato (deterministico subito, semantico se chiave presente).
**Contratto.** Guasti indipendenti: il regex vede i clic letterali, lo strutturale i buchi di forma, il
semantico la moralina/EAR-di-traverso/semi-non-pagati. Senza chiave: girano comunque (1)+(2).
**Verifica.** smoke: prosa con un cliché bandito → flag regex; pagina-soglia mancante → flag strutturale.

### B9 — `book-ts` · M6/F1.3 (montaggio print-grade) · dipende da prosa+immagini
**Scopo.** Portare `seme/scripts/build_book.py` → libro A5 **print-ready** (oggi `Phase4Libro` è un MVP
anteprima+stampa-browser). Bleed 3.175mm, 300 DPI, sicurezza margini, fascia testo alta (≈28%).
**File.** `lib/book.ts` — `buildBook(story): {html, css}` A5 con i blocchi testo sovrapposti alle immagini
(layout A: testo alto ~30%, immagine sotto). `components/phases/Phase4Libro.tsx` — usa `buildBook` per
l'anteprima e l'export; resta l'export PDF (browser print o, in M3, server). **Font** inclusi (Fraunces/
Nunito/Fredoka/Lora) o fallback. **Nota stampa**: l'upscale a 300 DPI è un layer esterno (deciso: non in-app).
**Contratto.** Output A5 con bleed/margini corretti; placeholder dove mancano immagini.
**Verifica.** smoke: render senza errori; dimensioni pagina A5+bleed; fascia testo presente.

### B10 — `tests-ci` · resto di M1 · ✅ MERGIATO
**Fatto** (branch test + UX, mergiato): suite **Vitest** completa — engine unit (§1), reference unit (§2),
registry comandi (§3), layer AI con fetch mockato (§4), stages/store (§5), componenti UI in jsdom (§6:
Workspace, Phase1Seeding, Phase3Immagini, ModelPicker), e2e contratto di fase (§7) — **129 test verdi** —
più `vitest.config.ts`, `tsconfig.test.json`, gli script npm (`npm test`, `typecheck:test`) e la **CI**
GitHub Actions (`docs/TEST_SPEC.md` è la spec). Gate CI: `npm test` · `typecheck:test` · `tsc --noEmit` · `build`.
**Conseguenza per le prossime branch:** i test dei nuovi branch si scrivono in **Vitest** (`describe/it/
expect`, environment "node"; jsdom per-file con `// @vitest-environment jsdom`), **non** come smoke tsx.

---

## 4. Mappa branch → milestone Scrivia
- **M1** (blindare i processi): fetta motore = B1 ✅ · reference→prompt smoke = B2 ✅ · resto (engine/
  reference/registry/AI unit + UI + e2e + CI) = **B10 ✅ MERGIATO** (Vitest, 129 test).
- **M2** (collegare le IA): seeding = **B6** · prosa = **B7** · critic = **B8** (consuma brief **B5**).
- **M5** (illustrazioni native): reference + prompt = B2 ✅ · **generazione = B4** · storage immagini → M3.
- **M6** (motore TS completo): hook/prompt = B1+B2 ✅ · **brief = B5** · **audit = B8** · **montaggio = B9**.
- **M3/M4** (Supabase storage+auth / MCP) e **Trasversali** (packs TS, editor PDF, i18n): dopo, invariati.

## 5. Ordine di consegna consigliato
1. **B4** `image-gen` — il percorso GPT (richiesto ora). ← si parte
2. **B5** `brief-ts` — sblocca la prosa.
3. **B6** `ai-seeding` · **B7** `ai-prosa` · **B8** `critic` — il cuore M2 (in quest'ordine).
4. **B9** `book-ts` — il libro print-grade.
5. ~~**B10** `tests-ci`~~ — **✅ già fatto** (M1 chiuso: Vitest + CI).

## 6. Stato vivo (aggiornare a ogni merge)
- ✅ B1 engine-parity · ✅ B2 reference-phase · ✅ B3 seeding-game · ✅ **B10 tests-ci (M1: Vitest + CI, 129 test)**.
- ✅ **B4 image-gen** — costruito e **verificato contro la baseline mergiata** (129/129 verdi, 2 gate typecheck ok).
- ⬜ B5 · B6 · B7 · B8 · B9.

> **Allineamento (pull dopo merge M1+UX).** I branch test/UX **non toccano** i target di B4
> (Phase3Immagini, types, pagePrompts, reference: 0 diff) → B4 si applica pulito. Verificato con la
> suite Vitest del repo: il test UI esistente di Fase 3 (§6.3) passa **con** il Phase3 di B4. Il test
> di B4 è stato portato in **formato Vitest**. Interfacce per B5+ (lib/ai `aiStream`/`aiComplete`,
> `commands.ts`, pagePrompts/reference) **intatte**.
