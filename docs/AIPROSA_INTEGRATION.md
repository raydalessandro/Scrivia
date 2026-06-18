# INTEGRATION — B7 `ai-prosa` (M2: la prosa in streaming, pagina per pagina)

## Cosa fa
La **Fase 2** ora scrive la prosa **davvero**, con l'IA, **una pagina alla volta in streaming**, a partire
dal **writing brief** (`story.brief`, prodotto da B5). Porta `SKILL_prosa` adattato al contesto in-app.
Regola d'ingresso: **brief-first** — il brief porta la tabella per-pagina, la voce, i semi e i marcatori
(APERTURA/SOGLIA/CHIUSURA). Senza chiave (501) ricade sull'interim (prosa d'esempio dove c'è, o uno stub
onesto) + una nota nel log. Lo scheletro EAR resta invisibile (il system vieta di nominare i tre movimenti
e le frasi-spia "capì che", "da quel giorno", "qualcosa cambiò dentro").

## Architettura
- **Chiave server-side**: il componente fa `POST /api/ai` con `stream:true` e legge l'SSE con `sseJson`
  (come B4/B6). Le pagine appaiono **token per token** mentre l'IA scrive.
- **Pagina per pagina**: ogni pagina è una richiesta separata; la **continuità** passa l'ultima frase della
  pagina precedente (`story.prose` accumulato in `out`). Non serve tool-use: la prosa è solo testo.

## File
**NUOVO**
- `lib/ai/tasks/prosa.ts` — `PROSA_SYSTEM` (il protocollo: ~70 parole/pagina, apertura/chiusura, semi,
  soglia=gesto non spiegato, dettaglio personale intessuto, budget di banalità, voce che plasma-non-detta
  "se la frase si irrigidisce molla la carta", scheletro invisibile) · `buildProsaRequest(story, page):
  CompletionRequest` (system = `PROSA_SYSTEM` + `## WRITING BRIEF` + `story.brief`; messaggio utente =
  "scrivi la PAGINA N (beat …), segui la riga N del brief, [continuità], SOLO il testo ~70 parole";
  `task:"prosa"`; **puro/testabile**) · `accumulateProseText(events)` (unisce i delta) · `applyProsaPage(
  story, page, beat, text)` (scrive/sostituisce la pagina, prosa ordinata).
- `test/aiProsa.test.ts` — Vitest (vedi sotto).

**MODIFICATO (additivo)**
- `components/phases/Phase2Prosa.tsx` — `generate()` ora cicla le pagine e per ciascuna fa `POST /api/ai`
  (stream) con `buildProsaRequest({ ...story, prose: out }, pp.page)`, aggiornando la pagina **dal vivo**
  con `accumulateProseText`. Su 501/errore passa all'**interim** (esempio/stub) per le pagine restanti e
  lo segnala nel log. Il critic, i bottoni e il resto della fase restano invariati.

## Dipendenze
- **Layer AI** (`/api/ai`, `sseJson`, tipi `CompletionRequest`/`StreamEvent`).
- **B5 a runtime**: legge `story.brief`. Il **campo** `brief?: string` è **già** nel tipo `Story`
  (lib/types.ts), quindi B7 **compila su main** anche senza B5; con B5 mergiato il brief è pieno e la prosa
  è alla sua qualità. Senza brief, `buildProsaRequest` usa un fallback onesto (nessun crash).
- **Indipendente da B4/B6 a livello di file**: B4=images/Phase3, B6=Phase1/`seeding.ts`, B7=Phase2/
  `prosa.ts`. La cartella `lib/ai/tasks/` è condivisa con B6 ma con **file diversi** (`seeding.ts` vs
  `prosa.ts`) → nessun conflitto, ordine di merge libero. (Conviene avere B5 in main per il brief reale.)
- Nessuna nuova dipendenza npm.

## Come verificare (eseguito qui, verde — Vitest del repo)
- `npm test` → **137/137 verdi** con B7 sovrapposto (`test/aiProsa.test.ts` = 8). Non esiste un test UI
  della Fase 2 da rompere; `generate()` async ricade comunque sull'interim in assenza di rete.
- `npm run typecheck:test` e `npx tsc --noEmit` → **0 errori**.
- Il test copre: `buildProsaRequest` (brief-first: system = `PROSA_SYSTEM` + brief; il messaggio chiede la
  pagina giusta col suo beat e "SOLO il testo"; **continuità** quando la pagina precedente è scritta;
  **niente acronimo EAR**; fallback su brief assente) · `accumulateProseText` (unisce i delta, ignora i
  tool-call) · `applyProsaPage` (scrive in ordine, riscrive senza duplicare).

## Contratto
Brief-first (mai esempi prima). Una pagina alla volta, in streaming. Con chiave: l'IA scrive dal brief;
senza chiave: interim + nota. EAR mai nominato (né i tre movimenti né le frasi-spia). Lo streaming SSE è
già coperto dai test del layer (§4).

## Stato roadmap
- **M2**: prosa = questo branch. Resta **B8 `critic`** (audit a strati: `lib/audit.ts` regex+strutturale
  deterministico, port di `audit_story.py`+`PATTERN_DA_BANDIRE.md`, + `lib/ai/tasks/critic.ts` semantico via
  `task:"critic"` → `CriticVerdict`). Poi **B9 `book-ts`** (montaggio stampa A5). Vedi
  `docs/PIANO_FASI_v1.md`.
