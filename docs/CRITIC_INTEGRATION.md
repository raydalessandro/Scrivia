# INTEGRATION — B8 `critic` (M2: cancello qualità a strati)

## Cosa fa
Il **secondo passaggio** della Fase 2 ora è un **cancello a strati a guasto indipendente** (port di
`audit_story.py`), non più uno stub:
1. **regex** — frasi bandite a quota 0 e quote lessicali (da `PATTERN_DA_BANDIRE.md` / `seme_config.yaml`):
   "da quel giorno", "in quel momento capì", "non sarebbe mai più lo stesso" (DURE); "imparò/capì che",
   "il suo cuore", "un brivido", famiglia 'sorrise' (soft).
2. **strutturale** — forma: copertura pagine (1..N), ogni seme piantato **e** ripreso, pagina-soglia
   presente.
3. **semantico (LLM)** — il SENSO che il regex non vede (`SKILL_critic`): scheletro invisibile *(duro)*,
   niente moralina *(duro)*, chiusura non esplicativa, soglia come gesto, semi pagati col peso, registro,
   banalità, dettaglio personale, frasi-da-mille-storie, voce/idioletti/texture, "sa di spec".

**Verdetto = FAIL se UN check DURO fallisce** (o un `page_flag` `severity:"hard"`); altrimenti PASS. I tre
strati hanno modi di guasto diversi → si prendono errori diversi.

## Architettura
- **Strati deterministici**: puri e immediati, **senza chiave**. Girano sempre.
- **Strato semantico**: la chiave è server-side → `POST /api/ai` **non-stream** → `CompletionResult.text`
  (un JSON) → parse → **fusione** con gli strati deterministici e **ricalcolo** del verdetto. Senza chiave
  (501) si tiene il verdetto deterministico + una nota "collega una chiave".
- Lo scheletro EAR resta invisibile: il critic **controlla** che non sia nominato, ma non lo nomina.

## File
**NUOVO**
- `lib/audit.ts` — strati 1-2 + combinatore: `auditRegex` (frasi bandite → check duro; quote basse →
  `page_flags` soft) · `auditStruct` (copertura/semi/soglia) · `combineVerdict` (FAIL su check duro) ·
  `auditDeterministic(story): CriticVerdict` · `HARD_KEYS` · `proseText`. **Puro/testabile.**
- `lib/ai/tasks/critic.ts` — strato 3: `CRITIC_SYSTEM` (i 13 check + output JSON) · `buildCriticRequest(
  story)` (system + prosa + brief, `task:"critic"`) · `parseCriticResponse(raw)` (estrae il JSON anche tra
  \`\`\`, mappa i check; testo non-JSON → flag soft) · `mergeCriticVerdict(det, sem)` (fonde e ricalcola) ·
  `withSemanticPending(det)` (no-chiave). **Puro/testabile.**
- `test/aiCritic.test.ts` — Vitest (16, vedi sotto).

**MODIFICATO (additivo)**
- `components/phases/Phase2Prosa.tsx` — `runCritic()` ora esegue gli strati reali: deterministici sempre,
  semantico via `/api/ai` (no-stream) se c'è la chiave, `withSemanticPending` su 501; per la storia
  d'esempio resta il verdetto curato. Rimosso il `DEFAULT_CRITIC` (morto). Il resto della fase invariato.

## ⚠️ Ordine di merge — B8 dopo B7
`Phase2Prosa.tsx` è toccato da **B7** (`generate`) e da **B8** (`runCritic`). Il `Phase2Prosa` di questo
branch è costruito **sopra quello di B7** (contiene `generate` di B7 + `runCritic` di B8), quindi:
- **merge B7 prima, poi B8** → l'unica differenza che B8 introduce su `Phase2Prosa` è `runCritic` (+import,
  -DEFAULT_CRITIC): merge pulito.
- L'agente d'integrazione può anche fare il 3-way (base = pre-B7, ours = main+B7, theirs = B8): stesso esito.

## Dipendenze
- **B7 a livello di file** (`Phase2Prosa` importa `lib/ai/tasks/prosa.ts`): B7 dev'essere in main.
- **Layer AI** (`/api/ai` no-stream → `CompletionResult.text`). La cartella `lib/ai/tasks/` è condivisa con
  B6/B7 ma con **file diversi** (`seeding.ts`/`prosa.ts`/`critic.ts`) → nessun conflitto.
- I tipi `CriticVerdict`/`CriticCheck` sono già in main. Nessuna nuova dipendenza npm.

## Come verificare (eseguito qui, verde — Vitest del repo)
- Sovrapposti **B6+B7+B8** su main (B4+B5) → `npm test` = **168/168 verdi** (`test/aiCritic.test.ts` = 16).
- `npm run typecheck:test` e `npx tsc --noEmit` → **0 errori**.
- Il test copre: regex (frase bandita → check duro fallito; pulita → ok; 'sorrise' 4× → flag soft) ·
  strutturale (copertura completa ok; pagina mancante → copertura FAIL; seme senza ritorno → semi FAIL;
  soglia fuori → soglia FAIL; senza nodo → non verificabile) · verdetto (bandita → FAIL; pulita+completa →
  PASS; soft→PASS / hard→FAIL) · semantico (`buildCriticRequest` porta la prosa, `task:"critic"`, niente
  EAR; `parseCriticResponse` estrae il JSON tra \`\`\` e mappa i check; non-JSON → flag soft; `merge` con
  check duro semantico fallito → FAIL; `withSemanticPending` tiene il verdetto + nota).

## Contratto
Il verdetto combina gli strati: una violazione regex dura è un PASS=false netto; lo strutturale becca i
buchi di forma; il semantico aggiunge il senso. Senza chiave: verdetto deterministico + nota. EAR mai
nominato.

## Stato roadmap
- **M2 completo** (seeding B6 + prosa B7 + critic B8). Prossimo: **B9 `book-ts`** (montaggio stampa: port di
  `build_book.py`, A5 300 DPI bleed 3.175mm, testo+immagini accoppiati dai marker). Vedi
  `docs/PIANO_FASI_v1.md`.
