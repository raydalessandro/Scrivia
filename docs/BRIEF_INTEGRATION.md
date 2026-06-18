# INTEGRATION — B5 `brief-ts` (M6: writing brief in TS)

## Cosa fa
Porta `seme/scripts/build_brief.py` → **`lib/brief.ts`**: da nodo + hook + seed assembla il **writing
brief** (markdown, zero-token, nessun LLM) che il prosatore leggerà in M2 per scrivere la prosa
**brief-first**. `lib/commands.ts` (comando `build_node`) ora popola `story.brief` insieme a node/pagePlan/
manus. Sblocca la prosa (B7).

## File
**NUOVO**
- `lib/brief.ts` — `buildBrief(node: StoryNode, hooks: Hook[], seed: Seed): string`. Sezioni: ricetta
  strutturale (pagine, arco *interno non-nominato*, apertura/chiusura con legenda da `canon.json`,
  registro, arco temporale, stagione/palette) · spina narrativa · cast · eco interne (semi) · come
  aprire/chiudere · voce (narratore/personaggi/luoghi da `node.voice`) · voci-personaggio d'autore
  (B3) · tabella pagina-per-pagina (con marcatori APERTURA/SOGLIA/CHIUSURA) · promemoria di voce.
- `test/brief.test.ts` — Vitest (vedi sotto).

**MODIFICATO (additivo)**
- `lib/commands.ts` — import `buildBrief`; in `build_node`, dopo i page-prompt: `n.brief = buildBrief(node,
  pagePlan as Hook[], seed);`. Una riga, nient'altro cambia.

## Adattamenti dal Python (importante)
Lo `StoryNode` di Scrivia **non** ha alcuni campi dello schema seme, quindi:
- **Cast**: il Python iterava `node.presence`; qui si costruisce da `node.protagonist` + `node.companions`.
- **Chiusura (direzione)**: il Python usava `node.closure_text` (assente); qui si usa `seed.spine.closure`
  + la legenda `closure_type` di `canon.json`.
- **Voce**: il Python leggeva `node.voice` (lo schema seme lo conteneva); in Scrivia `buildNode` attacca
  comunque `node.voice` via `resolveVoice` (tipo `StoryNodeExt`), quindi si legge quello. In più si
  rendono le **voci-personaggio d'autore** (`seed.characterVoices`: archetipo/stress/ritmo/parole/«non
  direbbe MAI») e `seed.narratorBrief` se presenti (B3) — è lì che servono, per i dialoghi.
- **Tolti** (non presenti sul nodo Scrivia): `debt`, `recurring_image`, il target numerico di pause
  descrittive. I promemoria di voce restano qualitativi.

## Dipendenze
- **B1** (engine: `buildNode`/`buildPagePlan`/`resolveVoice`, tipi `Hook`/`StoryNodeExt`/`NodeVoice`,
  `canon.json` con le legende `entry_point_type`/`closure_type`). **B3** opzionale (le voci-personaggio si
  rendono solo se il seed le porta). Costruito sulla baseline corrente (post front-redesign + test M1).
- Nessuna nuova dipendenza npm.

## Come verificare (eseguito qui, verde — Vitest del repo)
- `npm test` → **130/130 verdi** con B5 sovrapposto. `test/brief.test.ts` (8) e `test/commands.test.ts`
  (30, nessuna regressione dall'edit) passano; suite intera verde.
- `npm run typecheck:test` e `npx tsc --noEmit` → **0 errori**.
- Il test copre: intestazione + brief-first; **acronimo EAR mai presente** (`/\bEAR\b/` assente) e
  scheletro dichiarato invisibile; spina completa (premise/soglia/chiusura/dettaglio personale); cast da
  protagonist+companions; tabella con una riga per pagina + SOGLIA marcata; semi con pianta→ritorna; voce
  narratore (assi attivi); voci-personaggio d'autore («non direbbe MAI») + narratorBrief.

## Contratto
Deterministico (stesso node/seed → stesso brief). Il brief contiene tutto ciò che serve alla prosa
brief-first. Lo scheletro EAR non compare come acronimo ed è esplicitamente marcato come "non si nomina
nel testo". Nessun output a video (è una stringa salvata su `story.brief`).

## Stato roadmap
- **M6**: brief = questo branch. Hook/prompt = B1+B2 ✅. Restano: audit (B8), montaggio (B9).
- **Sblocca** B7 (`ai-prosa`): la prosa in streaming legge `story.brief`. Vedi `docs/PIANO_FASI_v1.md`.
