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
- **Layer AI isolato** (`lib/ai/`): Anthropic + DeepSeek, switch modello/reasoning,
  config per-fase, route d'aggancio `/api/ai`.
- **Selettore IA in UI** (`/impostazioni`): provider/modello/reasoning per fase.
- **Deploy** su Vercel da `main`.

## Prossimo 🟡

### M1 — Blindare i processi (test) — *branch dedicata*
- Test del **motore TS** a **parità** con la suite pytest del seme
  (`seme/tests/`): determinismo, invarianti (copertura beat, soglia, semi,
  varietà hook), enum. — ✅ **fatto** (B1: `test/engine.parity.test.ts`).
- Smoke **reference → prompt-pagina** — ✅ **fatto** (B2: `test/reference.test.ts`).
- Test del **registry comandi** (mutazioni, cache, validazione, `toMcpTools`).
- Test del **layer AI** (resolve selezione, clampReasoning, parsing SSE, shape
  richiesta per provider) con fetch mockato.
- Smoke test delle route (`/`, `/story/[id]`, `/impostazioni`, `/api/ai`).
- CI: build + test ad ogni push (SessionStart hook + workflow).

### M2 — Collegare le IA alle fasi
- **Seeding reale**: `aiStream({task:"seeding"})` con tool-use sui comandi del
  registry; `composeOpening` diventa il system-context. Via `interpret()` interim.
- **Prosa in streaming** dal brief (`SKILL_prosa`), pagina per pagina.
- **Critic** come sub-agente isolato che torna il verdetto JSON (`SKILL_critic`).
- Gestione chiavi (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`) su Vercel.

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
- Resta: sostituire Manus con **generazione diretta** (script TS, incl. eventuale
  modello locale/gpt-image-2); slot immagine → **Storage**.

### M6 — Motore TS completo
- ✅ **hook completi + prompt-pagina (manus) veri** in TS (B1+B2).
- Resta: **brief testuale**, **montaggio/impaginazione** (libro A5) e **audit** in TS;
  ritirare la dipendenza dal riferimento Python quando i test lo garantiscono.

### Trasversali
- **Espansione voci-personaggio** (matrice archetipo × stress × ritmo) nel brief prosa (arriva con B3).
- Pacchetti-genere (es. `ninnananna`) lato TS.
- Editor del libro / export PDF rifinito.
- Accessibilità e i18n.

---

## Branch in arrivo (ordine di dipendenza)
1. **B1 `engine-parity`** — ✅ mergiato in `main`.
2. **B2 `reference-phase`** — Passo 0 + prompt-pagina veri (dipende da B1).
3. **B3 `seeding-game`** — UI del gioco di seeding + mapping sul `Seed` + espansione voci (dipende da B1).
