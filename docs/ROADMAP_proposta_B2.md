# ROADMAP — Scrivia

Direzione: confezionare il prodotto attorno alla spina del seme, **svincolando da
Claude Code** (i punti LLM diventano chiamate API nostre) e tenendo i principi del
seme (verità nel grafo, determinismo, autorità umana, due cancelli voluti).

Legenda: ✅ fatto · 🟡 in corso/prossimo · ⬜ pianificato.

## Fatto ✅

- **UI delle 4 fasi** navigabile, con lo **stelo** del processo e il **filo dei
  tempi** (chi lavora e per quanto).
- **PWA + mobile**: manifest, service worker offline, installabile, safe-area.
- **Studio di seeding (Fase 1)**: memoria persistente, tutto editabile, entità
  selezionabili (focus), **intake** prima della chat (l'IA parte dalla bozza).
- **Registry dei comandi** (`lib/commands.ts`): unica fonte di verità, cache,
  `toMcpTools()`. Ontologia EAR esposta.
- **Motore deterministico in TS** (`lib/engine.ts`): primo strato (campionamento
  dal nonce, beat plan, semi).
- **Motore a parità di contratto col Python** (branch `engine-parity`): fix dei 3 bug
  (attribute↔theme, soglia, register), hook completi (`characters_present`, focal action,
  atmosfera), voce frattale, invarianti, `entitiesInScene`. Suite di parità (= M1, parte motore).
- **Passo 0 — Reference visiva** (branch `reference-phase`): record d'entità ricavati dal nodo,
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
  varietà hook), enum. — ✅ **fatto** (branch `engine-parity`: `test/engine.parity.test.ts`).
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
- **Storage** per immagini; predisposizione **video**.
- Auth e multi-utente.

### M4 — MCP della Fase 1
- Esporre il registry comandi come **MCP** reale: l'IA come agente con strumenti
  (più ontologia), non compilatrice passiva.

### M5 — Illustrazioni native
- **Passo 0 — Reference visiva** (tappa esplicita, *tra* seeding/prosa e generazione):
  record d'entità → foglio di reference confermato → gate. — ✅ **fatto** (branch `reference-phase`).
- Sostituire Manus con **script TS** (generazione diretta) — integrazione
  del lavoro motore in corso (incl. eventuale modello locale/gpt-image-2).
- Slot immagine → Storage; coerenza personaggi/luoghi dai prompt blindati. — i prompt-pagina
  ora **allegano** le reference confermate (✅ B2); resta la generazione automatica + Storage.

### M6 — Motore TS completo
- Portare in TS tutto il resto deterministico (hook/brief/manus/montaggio/audit)
  a parità col Python; ritirare la dipendenza dal riferimento Python quando i
  test lo garantiscono. — ✅ **hook completi + prompt-pagina (manus) veri** in TS (B1+B2);
  restano **brief testuale**, **montaggio** e **audit** in TS.

### Trasversali
- Pacchetti-genere (es. `ninnananna`) lato TS.
- Editor del libro / export PDF rifinito.
- Accessibilità e i18n.
