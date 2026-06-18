# INTEGRATION — B6 `ai-seeding` (M2: seeding conversazionale reale)

## Cosa fa
Collega la **Fase 1** alle IA: la chat di seeding ora parla davvero con un modello che ha i **comandi
del registry come strumenti** (`toMcpTools()`), raccoglie il seed conversando e poi "clicca"
(`build_node`). Porta il protocollo di `SKILL_seeding` adattato al contesto a-tool. Senza chiave (501) la
chat **ricade sull'interim deterministico** (`interpret`) + un suggerimento; il **Modo guidato** (B3)
resta utilizzabile a zero-token. Lo scheletro EAR resta invisibile (il system dice di non nominarlo mai).

## Architettura
- **Chiave server-side**: il client (Fase 1, `"use client"`) **non** chiama `aiStream` direttamente, ma
  fa `POST /api/ai` con `stream:true` e legge l'SSE con `sseJson` (come per B4 con le immagini).
- **Stato nel grafo**: ad ogni turno lo **stato corrente del seme** è iniettato nel system-prompt, quindi
  **non serve un round-trip di tool-result** — l'IA "vede" sempre cos'è già fissato. I tool-call vengono
  eseguiti lato client con `executeCommand(..., "claude")` e aggiornano la Story.

## File
**NUOVO**
- `lib/ai/tasks/seeding.ts` — `SEEDING_SYSTEM` (il protocollo: scarico → minimo → tema↔movimento interno →
  spina → CANCELLO conferma → build_node) · `seedStateSummary(story)` (stato compatto + validazione) ·
  `buildSeedingRequest(story, userText): CompletionRequest` (system+messages+`tools:toMcpTools()`+
  `toolChoice:"auto"`+`task:"seeding"`, **puro/testabile**) · `applySeedingTurn(story, events)` (applica i
  tool-call via `executeCommand`, accumula il testo; se l'IA non scrive testo ma esegue comandi,
  sintetizza una conferma).
- `test/aiSeeding.test.ts` — Vitest (vedi sotto).

**MODIFICATO (additivo)**
- `components/phases/Phase1Seeding.tsx` — `send()` ora è **async**: costruisce la richiesta, fa POST a
  `/api/ai` (stream), raccoglie gli eventi con `sseJson` e applica il turno con `applySeedingTurn`. Su 501/
  errore ricade sull'`interpret()` esistente (tenuto come fallback) + hint. Aggiunto lo stato `sending`
  (disabilita l'input mentre l'IA risponde). Il **Modo guidato** e i campi manuali restano invariati.

## Dipendenze
- Il **layer AI** (`lib/ai`: `/api/ai` route, `sseJson`, tipi `AIMessage`/`CompletionRequest`/`StreamEvent`)
  e il **registry comandi** (`toMcpTools`/`executeCommand`/`validateSeed`). Costruito sulla baseline
  corrente (post front-redesign + test M1), quindi il `Phase1Seeding` di partenza è **già** quello
  ridisegnato (nessun problema di ri-base come per B4).
- **Indipendente da B4/B5**: nessun file in comune (B4 = images/Phase3; B5 = brief/commands; B6 = Fase 1 +
  `lib/ai/tasks`). Ordine di merge libero.
- Nessuna nuova dipendenza npm.

## Come verificare (eseguito qui, verde — Vitest del repo)
- `npm test` → **129/129 verdi** con B6 sovrapposto. `test/aiSeeding.test.ts` (7) e il test UI esistente
  `test/Phase1Seeding.test.tsx` (2, **non rotto**: §6.2 non chiama `send()`, testa `startChat`+select) passano.
- `npm run typecheck:test` e `npx tsc --noEmit` → **0 errori**.
- Il test copre: `buildSeedingRequest` (system = protocollo + stato seme; `task:"seeding"`; tools dal
  registry con `set_protagonist`/`build_node`; **niente acronimo EAR** + istruzione di non nominarlo;
  ultimo messaggio = turno utente) e `applySeedingTurn` (un tool-call applica il comando giusto; più
  tool-call in sequenza; testo che si accumula; risposta sintetizzata non vuota senza EAR).

## Contratto
Con chiave: l'IA raccoglie il seed conversando, esegue i comandi e costruisce. Senza chiave: 501 → fallback
interim + hint ("collega una chiave o usa il Modo guidato"); il Modo guidato resta a zero-token. EAR mai
nominato. Streaming SSE già coperto dai test del layer (§4).

## Stato roadmap
- **M2**: seeding = questo branch. Restano **B7 `ai-prosa`** (la prosa in streaming dal `story.brief` di
  B5) e **B8 `critic`**. Vedi `docs/PIANO_FASI_v1.md`.
