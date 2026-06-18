# INTEGRATION — B4 `image-gen` (M5: generazione immagini, percorso GPT, API non attaccata)

## Cosa fa
Implementa la **generazione automatica delle illustrazioni come percorso GPT completo**, già
definitivo, **senza ancora attaccare l'API**. Manus e GPT-Image sono intercambiabili a questo livello
(stesso prompt strutturato + stesse `references[]` confermate): finché non c'è la chiave si resta in
**modalità manuale** (l'umano genera in Manus e incolla), e al collegamento di `OPENAI_API_KEY` **gli
stessi script generano** verso GPT-Image, senza cambi al percorso di chiamata.

Costruisce sui prompt-pagina di B2 (`ManusPrompt` con `storyMoment/pov/place/characters/references/
missing`): compone il prompt finale coi blocchi blindati (STYLESHEET in testa → SUBJECT → STORY MOMENT
→ POV → PLACE → LOCKED divieti → CHARACTER CONSISTENCY in coda → FORMAT) e allega le reference
canoniche confermate (cap 5). Rispetta le note empiriche Manus (ancora canonica, ≤5 reference,
divieti ripetuti, 2:3).

## File
**NUOVI**
- `lib/images/types.ts` — `ImageRequest`, `ImageResult`, `ImageProviderId`, `ImageProviderAdapter`.
- `lib/images/composePrompt.ts` — `composeImagePrompt(node, manusPrompt, entities) → ImageRequest` (puro;
  riusa `bookStylesheet`/`CONSISTENCY_BLOCK` di B2, cap reference a 5).
- `lib/images/providers/manual.ts` — provider manuale (nessuna rete; è il flusso umano Manus).
- `lib/images/providers/openai.ts` — adapter GPT-Image; **la fetch è dietro `ready()`**: senza
  `OPENAI_API_KEY` non parte. Forma da `openai_image_gen.py` (Isola) + note Manus.
- `lib/images/index.ts` — `generateImage`, `activeImageProvider` (openai se pronto, altrimenti manual),
  `imageProviderStatus`, re-export `composeImagePrompt` + tipi.
- `app/api/images/route.ts` — GET stato provider · POST genera (o stato `manual` se non collegato).
  Speculare a `/api/ai`. `runtime = "nodejs"` (la chiave resta server-side).
- `test/imageGen.test.ts` — smoke (vedi sotto).

**SOSTITUITI (modifiche solo additive)**
- `lib/types.ts` — a `ManusPrompt` due campi opzionali: `imagePrompt?: string` (il prompt finale
  composto, da copiare in Manus / loggare) e `imageProvider?: "openai" | "manual"`.
- `components/phases/Phase3Immagini.tsx` — nel Passo 1 (griglia pagine): bottone **"Genera"** per pagina
  (disabilitato se mancano reference). Compone il prompt e fa **POST a `/api/images`**; se la risposta è
  `generated` riempie `imageUrl` (provider `openai`); altrimenti mostra l'avviso "modalità manuale:
  copia il prompt e incolla l'immagine". L'upload manuale resta identico (provider `manual`).

## Dipendenze
- Richiede **B2** (reference-phase): `lib/pagePrompts.ts` (`bookStylesheet`, `CONSISTENCY_BLOCK`),
  `lib/reference.ts`, i tipi `EntityRefRecord`/`ManusPrompt`. Già mergiato.
- Nessuna nuova dipendenza npm. La generazione reale, a chiave attaccata, userà `OPENAI_API_KEY` lato
  server (Vercel env). Le reference devono essere raggiungibili dal server per la generazione automatica
  con allegati → arriva con lo **Storage** (M3); fino ad allora la strada operativa è Manus (manuale).

## Come verificare (eseguito qui, verde — harness Vitest del repo)
- `npm test` (vitest run) → **129/129 verdi** con B4 sovrapposto alla baseline mergiata (M1 test + UX):
  in particolare il test UI esistente `test/Phase3Immagini.test.tsx` (§6.3) **passa con il Phase3 di B4**
  (le modifiche sono additive) e il nuovo `test/imageGen.test.ts` (7 test) passa.
- `npm run typecheck:test` e `npx tsc --noEmit` → **0 errori**. (Gli stessi gate della CI:
  `npm test` · `typecheck:test` · `tsc --noEmit` · `build`.)
- Il test `test/imageGen.test.ts` è in **formato Vitest** (`describe/it/expect`, environment "node"):
  STYLESHEET in testa, CONSISTENCY (BINDING) in coda, divieti per-entità (`LOCKED`/`NO hood`), formato
  2:3 / size 1024x1536, **reference cappate a 5**, e `generateImage` **senza chiave → provider "manual"**
  (nessuna fetch), gate `missing` trasportato.

## Mapping tipi
- `ManusPrompt` (B2) → `composeImagePrompt` → `ImageRequest { prompt, references[≤5], format:"2:3",
  size:"1024x1536", quality }`.
- `generateImage(req)` → `ImageResult { status:"generated"|"manual", imageUrl?, provider }`.
- Senza chiave: `status:"manual"`, nessuna `imageUrl` → la UI tiene il flusso di upload manuale.

## Contratto
Manus≡GPT all'interfaccia. Senza chiave: zero chiamate di rete, comportamento attuale invariato. Con
chiave: la stessa pipeline genera. Nessuna immagine se le reference della scena non sono confermate
(gate `missing`, applicato in Fase 3). EAR mai nominato nei prompt.

## Rischi / note
- La **fetch reale** verso OpenAI non è esercitata qui (manca la chiave): verificata la *forma* della
  richiesta e il *routing* del provider. La forma multipart definitiva (reference come `image[]`) va
  confermata al collegamento della chiave; è marcata con una NOTA nel file `providers/openai.ts`.
- Le reference oggi sono `blob:` URL locali (upload): per la generazione automatica con allegati servono
  URL raggiungibili dal server → **M3 Storage**. Intanto le prime prove le fa Ray con Manus (manuale),
  ed è proprio lo scenario per cui questo branch è pensato.
- L'upscale a 1536×2304 per la stampa resta **layer esterno** (deciso), fuori da questo branch.

## Stato roadmap
- **M5** generazione: questo branch. Reference + prompt = B2 ✅. Storage immagini → M3.
- Vedi `docs/PIANO_FASI_v1.md` per il dettaglio di tutte le fasi rimanenti (B5 brief, B6/B7/B8 le IA,
  B9 libro, B10 test+CI) — è il piano anti-drift.
