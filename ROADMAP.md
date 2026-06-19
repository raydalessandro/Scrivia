# ROADMAP — Scrivia

Direzione: confezionare il prodotto attorno alla spina del seme, **svincolando da
Claude Code** (i punti LLM diventano chiamate API nostre) e tenendo i principi del
seme (verità nel grafo, determinismo, autorità umana, due cancelli voluti).

Legenda: ✅ fatto · 🟡 in corso/prossimo · ⬜ pianificato.

> **Verifica.** Ogni branch del motore/fasi viene applicata su una branch dedicata e
> verificata (`tsc --noEmit` strict · suite di parità/smoke · `npm run build` · integrazione
> reale `build_node`) **prima** del merge in `main`. Nessuna modifica entra rossa.

## Fatto ✅

- **UI delle 4 fasi** navigabile, con lo **stelo** del processo e il **filo dei
  tempi** (chi lavora e per quanto).
- **PWA + mobile**: manifest, service worker offline, installabile, safe-area.
- **Studio di seeding (Fase 1)**: memoria persistente, tutto editabile, entità
  selezionabili (focus), **intake** prima della chat (l'IA parte dalla bozza).
- **Registry dei comandi** (`lib/commands.ts`): unica fonte di verità, cache,
  `toMcpTools()`. Ontologia EAR esposta.
- **Motore a parità di contratto col Python** (B1 `engine-parity`): fix dei 3 bug
  (attribute↔theme, soglia, register), hook completi (`characters_present`, focal action,
  atmosfera), voce frattale, invarianti, `entitiesInScene`. Suite di parità (= M1, parte motore).
- **Passo 0 — Reference visiva** (B2 `reference-phase`): record d'entità ricavati dal nodo,
  prompt del foglio di reference blindato, conferma immagine, **gate**; e **prompt-pagina veri**
  (STORY MOMENT/POV/PLACE/SUBJECT dal nodo+canone) che allegano le reference confermate —
  al posto dei segnaposto in `commands.ts`.
- **Seeding "gioco" — modo guidato** (B3 `seeding-game`): la Fase 1 passo-passo ("pianta il
  seme") che mappa il suo output sul `Seed` (move→attributo EAR invisibile, override di
  grammatica, voce remappata) + **espansione voci-personaggio** (archetipo/stress/ritmo/
  «non direbbe mai») e `narratorBrief` — alimenteranno il brief della prosa in M2.
- **Layer AI isolato** (`lib/ai/`): Anthropic + DeepSeek, switch modello/reasoning,
  config per-fase, route d'aggancio `/api/ai`.
- **Selettore IA in UI** (`/impostazioni`): provider/modello/reasoning per fase.
- **Brief di scrittura** (B5 `brief-ts`): `lib/brief.ts` produce il *writing brief*
  deterministico al `build_node` (ricetta strutturale, voce, semi/eco, tabella
  pagina-per-pagina) su `story.brief` — **zero token**. Visibile in Fase 2 (sola lettura).
- **Generazione immagini diretta** (B4 `image-gen`): `lib/images/` (composePrompt +
  provider `openai`/`manual`) e route **`/api/images`**; col tasto **Genera** in Fase 3,
  o **modalità manuale** (Manus) se non c'è chiave. La chiave resta server-side.
- **IA collegate alle fasi (M2)**:
  - **Seeding reale** (B6 `ai-seeding`): `aiStream({task:"seeding"})` con **tool-use**
    sui comandi del registry; fallback **interim** senza chiave.
  - **Prosa in streaming** (B7 `ai-prosa`): pagina per pagina dal brief, con continuità;
    consuma `characterVoices`/`narratorBrief` del seeding gioco (B3).
  - **Critic a strati** (B8 `critic`): `lib/audit.ts` deterministico (regex+strutturale,
    **sempre**) + strato **semantico** via `/api/ai` se c'è chiave (altrimenti *pending*).
- **Blindatura dei processi (M1)**: suite **Vitest** completa (motore/parità, comandi,
  reference, stages/store, layer AI, task M2, brief, immagini, e2e, smoke UI) +
  **CI** (`.github/workflows/ci.yml`, Node 22, su push e PR) + **`npm run check`** (i 4 gate)
  + runbook **`docs/TEST_MAP.md`**.
- **Deploy** su Vercel da `main` (via PR). **Workflow git**: branch + PR, mai merge diretto.

## Prossimo 🟡

### Gestione chiavi & rifinitura M2
- Chiavi (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`) sulle env di Vercel.
- Rifinire le UX di degradazione (501 senza chiave) e i prompt dei task IA sul campo.

## Pianificato ⬜

### M3 — Persistenza & media (Supabase)
- Storie, artefatti, ledger e commandLog su Postgres (memoria cross-device).
- **Storage** per immagini (reference + pagine); predisposizione **video**.
- Auth e multi-utente.

### M4 — MCP della Fase 1
- Esporre il registry comandi come **MCP** reale: l'IA come agente con strumenti
  (più ontologia), non compilatrice passiva.

### M5 — Illustrazioni native
- **Passo 0 — Reference visiva** (tappa esplicita, *tra* seeding/prosa e generazione):
  record d'entità → foglio di reference confermato → gate. — ✅ **fatto** (B2).
- I prompt-pagina ora **allegano** le reference confermate (✅ B2).
- ✅ **Generazione diretta** via provider `openai` + route `/api/images`, con fallback
  manuale Manus (B4 `image-gen`).
- Resta: slot immagine → **Storage** (Supabase, M3); predisposizione **video**.

### M6 — Motore TS completo
- ✅ **hook completi + prompt-pagina (manus) veri** in TS (B1+B2).
- ✅ **brief testuale** (B5 `brief.ts`) e ✅ **audit/critic** deterministico in TS
  (B8 `audit.ts`).
- Resta: **montaggio/impaginazione** (libro A5) in TS; ritirare la dipendenza dal
  riferimento Python quando i test lo garantiscono.

### Trasversali
- **Espansione voci-personaggio** (matrice archetipo × stress × ritmo): catturata nel
  seeding (B3), ✅ consumata dal brief prosa (B5/B7).
- Pacchetti-genere (es. `ninnananna`) lato TS.
- Editor del libro / export PDF rifinito.
- Accessibilità e i18n.

---

## Branch integrate (ordine di dipendenza)
Tutte mergiate in `main` via PR a CI verde.
1. **B1 `engine-parity`** — motore a parità col Python (M1 motore).
2. **B2 `reference-phase`** — Passo 0 reference + prompt-pagina veri.
3. **B3 `seeding-game`** — modo guidato + `seedFromGame` + espansione voci (dip. B1).
4. **B4 `image-gen`** — generazione immagini diretta + `/api/images` (M5).
5. **B5 `brief-ts`** — writing brief deterministico su `story.brief` (M6).
6. **B6 `ai-seeding`** — seeding reale con tool-use (M2).
7. **B7 `ai-prosa`** — prosa in streaming pagina-per-pagina (M2).
8. **B8 `critic`** — critic a strati (deterministico + semantico) (M2).
9. **Test harness + CI** — suite Vitest, `npm run check`, `TEST_MAP.md` (M1).
10. **Front audit M2/M5/M6** — brief visibile in Fase 2 + `docs/FRONTEND.md` allineato.
