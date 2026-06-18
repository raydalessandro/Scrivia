# FRONTEND — Scrivia

Guida del **front** (estetica e interfaccia), pensata per iterare il design — anche
per esigenze commerciali — **senza mai toccare il back**, e senza perdere funzioni
nel passaggio back ↔ front. Le regole di sviluppo generali restano in `CLAUDE.md`;
la direzione di prodotto in `ROADMAP.md`.

---

## 1. Il confine front / back

| | Cartella | Cosa contiene | Si tocca per l'estetica? |
|---|---|---|---|
| **BACK** (verità + logica) | `lib/` | motore, comandi, stages, store, reference, prompt-pagina, seedFromGame, canon, layer AI, **tipi** | ❌ **mai** |
| **FRONT** (presentazione) | `app/` · `components/` · `app/globals.css` · `public/fonts/` | React/JSX, design system, layout, font | ✅ qui |

**Regola d'oro.** L'estetica vive nel front. Il `lib/` è la *single source of truth*:
non si modifica per ragioni visive. Il front **legge** dal back e gli **passa** azioni,
sempre attraverso gli stessi contratti (vedi §4). Così il back non sa nulla del look,
e il look può cambiare quante volte serve senza rischiare le funzioni.

Cosa **non** fare mai dal front:
- rinominare/spostare export di `lib/` (`PHASES`, `deriveStages`, `executeCommand`, …);
- cambiare i **nomi dei comandi** o lo shape dei tipi in `lib/types.ts`;
- spostare logica dentro i componenti “per comodità” (resta nel registry comandi).

---

## 2. Il design system (dove cambiare il look)

Tutto parte da **`app/globals.css`** (Tailwind v4, blocco `@theme`). È il pannello
di controllo dell'estetica.

- **Colori** — `--color-*`. La palette “carta” + **un colore per ogni attore**
  (`you`, `claude`, `manus`, `det`, `gate`, `github`). ⚠️ I colori-attore sono
  **semantici** (dicono *chi lavora*): puoi ritoccarne la tinta, non il significato.
- **Font** — self-hosted in `public/fonts/` via `@font-face`, esposti come
  `--font-serif` (**Fraunces**, titoli/prosa) e `--font-sans` (**Hanken Grotesk**, UI).
  Niente fetch a runtime (build offline, PWA-friendly). Per cambiare font: sostituisci
  i `.woff2` e i due `@font-face`.
- **Profondità/forma** — `--shadow-*` (ombre calde) e `--radius-*` (raggi morbidi).
- **Movimento** — keyframes `ai-pulse`, `det-tic`, `rise`/`.reveal`, `shimmer`
  (rispettano `prefers-reduced-motion`).
- **Classi componente** (in `@layer components`) — riusale invece di reinventare:
  `.btn-ink` (primario), `.btn-claude` (azione IA), `.btn-soft`, `.card`, `.field`,
  `.eyebrow` (etichette maiuscolette), `.display`/`.serif`.

> **Cambia il look in un punto, si propaga ovunque.** Ritoccare un token o una classe
> qui aggiorna tutta l'app senza toccare i singoli schermi.

### Direzione estetica (riferimento)
**Craft** (premium, caldo, editoriale) + tattilità di **Things 3**; tocco *friendly*
alla **Headspace** solo nel “gioco”. Firma di Scrivia da mantenere: **carta** +
**colore-per-attore** + **Fraunces**. Tenere questa rotta per restare coerenti.

---

## 3. Mappa degli schermi (front)

| Schermo | Entry (`app/`) | Componente front | Note |
|---|---|---|---|
| Home / le storie | `app/page.tsx` | — | hero, schede storia, CTA |
| Storia (workspace) | `app/story/[id]/page.tsx` | `components/Workspace.tsx` | header fisso, **stepper 4 fasi**, processo/registro |
| Impostazioni IA | `app/impostazioni/page.tsx` | `components/ai/AISettings.tsx` | provider/modello/reasoning per fase |

Dentro il workspace, le **4 fasi** + il **gioco**:

| # | Fase | Componente | Cosa è collegato al back |
|---|---|---|---|
| 1 | Progetta | `components/phases/Phase1Seeding.tsx` | **gioco** (`SeedingGame.tsx`) · intake · studio: chat con **IA reale** (`/api/ai`, fallback interim a 501) + schede |
| 2 | Prosa | `components/phases/Phase2Prosa.tsx` | prosa **IA in streaming** pagina-per-pagina · **brief** (sola lettura) · **critic a strati** (regex+strutturale sempre, semantico se c'è chiave) |
| 3 | Illustrazioni | `components/phases/Phase3Immagini.tsx` | **Passo 0 reference** + pagine: bottone **Genera** (`/api/images`) o Manus **manuale** se non c'è chiave |
| 4 | Libro | `components/phases/Phase4Libro.tsx` | anteprima A5 / stampa (deterministico) |

Supporto front: `Stem.tsx` (lo stelo), `Ledger.tsx` (i tempi), `GraphView.tsx`,
`ui.tsx` (`Pill`, `ActorChip`), `ai/ModelPicker.tsx`, `ai/PhaseModelChip.tsx`, `PWA.tsx`.

---

## 4. Il contratto front ↔ back (così non si perde nulla)

**Ogni fase riceve sempre la stessa props** (`components/phases/types.ts`):

```ts
type PhaseProps = {
  story: Story;                       // lo stato (dal back)
  update: (mut: (s: Story) => Story) => void;  // muta + persiste
  log: (e: Omit<LedgerEvent,"ts">) => void;    // scrive nel registro tempi
  goPhase?: (p: PhaseId) => void;     // naviga tra le fasi
};
```

Le fasi **non** contengono logica di dominio: chiamano il back e mostrano il
risultato. Le funzioni del back usate dal front (da **non** rinominare):

- **stages** (`lib/stages.ts`): `PHASES`, `deriveStages`, `STAGE_TO_PHASE`,
  `currentPhase` → guidano stepper e stelo.
- **store** (`lib/store.ts`): `loadStory(ies)`, `saveStory`, `newStory`.
- **comandi** (`lib/commands.ts`): `executeCommand`, `validateSeed`, `COMMANDS`
  → ogni azione (umano/IA) passa di qui (log + cache).
- **reference / pagine** (`lib/reference.ts`, `lib/pagePrompts.ts`): `deriveEntities`,
  `referenceGate`, `buildReferenceSheetPrompt`, `buildPagePrompts`, `bookStylesheet`.
- **gioco → seme** (`lib/seedFromGame.ts`): `seedFromGame(GameState) → Seed`.
- **ontologia/enum** (`lib/enums.ts`): `ACTOR_META` (colori/etichette attori), assi voce, ecc.
- **AI — config** (`lib/ai/`): `getSelection`, `selectionLabel`, helper SSE `sseJson` (`lib/ai/sse`).
- **AI — task M2** (`lib/ai/tasks/`): seeding `buildSeedingRequest`/`applySeedingTurn`;
  prosa `buildProsaRequest`/`accumulateProseText`; critic `buildCriticRequest`/
  `parseCriticResponse`/`mergeCriticVerdict`/`withSemanticPending`.
- **critic deterministico** (`lib/audit.ts`): `auditDeterministic`.
- **immagini** (`lib/images/`): `composeImagePrompt`; stato/forma via route.
- **brief** (`lib/brief.ts`): prodotto al `build_node`, vive su **`story.brief`** (sola lettura nel front).
- **route server-side** (la chiave resta sul server): `POST /api/ai` (stream e no-stream),
  `POST/GET /api/images`. Il client **non** chiama mai `aiStream`/`generateImage` diretti:
  passa per le route e legge l'SSE con `sseJson`.

> **Regola di degradazione (importante per la UX).** Ogni punto-IA deve reggere il
> **501 senza chiave**: seeding→interim+hint, prosa→esempio/stub+nota, critic→verdetto
> deterministico+nota, immagini→modalità manuale. Non rimuovere questi fallback.

**Checklist “non perdo funzioni” quando ritocco una fase:** mantieni le stesse
chiamate al back (sopra) e la stessa props `PhaseProps`; cambia solo markup/stile.

---

## 5. Ricette rapide (voglio cambiare… → tocco…)

- **Tinte/tema** → `app/globals.css` `@theme` (`--color-*`). *(I colori-attore: tinta sì, semantica no.)*
- **Font** → `public/fonts/*.woff2` + i `@font-face` in `globals.css`.
- **Stile di tutti i bottoni/schede/campi** → classi in `@layer components` di `globals.css`.
- **Look di una fase** → il suo `components/phases/PhaseN*.tsx` (solo JSX/classi).
- **Look del “gioco”** → `components/phases/SeedingGame.tsx`. ⚠️ ha una **palette locale**
  (oggetto `C`) e una `SERIF` propri: se cambi i token, alline anche questi (candidato a
  un futuro refactor per leggere i token come il resto).
- **Header/stepper/processo** → `components/Workspace.tsx`.
- **Home / landing commerciale** → `app/page.tsx`.

---

## 6. Verifica prima del merge

```bash
npm install            # nessuna dipendenza nuova; font già in public/fonts
npx tsc --noEmit       # tipi a posto (il contratto col back regge)
npm run build          # build offline, deve passare
```

Se `tsc` passa, il contratto front↔back è intatto: il back non è stato toccato e
nessuna funzione è andata persa. Da qui, iterare l'estetica è sicuro.

---

## 7. Audit front↔back — stato al merge M2/M5/M6 (giu 2026)

> Check fatto dall'**agente front** dopo i branch B4 (immagini) · B5 (brief) · B6
> (seeding IA) · B7 (prosa IA) · B8 (critic). **Baseline blindata**: `npm run build`
> verde, **`npm test` 168/168 verde**, `tsc --noEmit` 0 errori. Niente funzione persa
> nei merge (i contratti front↔back hanno tenuto).

### 7.1 Copertura — ogni funzione del back ha un punto sul front?

| Capacità (back) | Modulo | Punto sul front | Stato |
|---|---|---|---|
| Seeding conversazionale IA (B6) | `lib/ai/tasks/seeding.ts` + `/api/ai` | Fase 1 · chat (`send()` async, stato `sending`) | ✅ collegato |
| Prosa IA in streaming (B7) | `lib/ai/tasks/prosa.ts` + `/api/ai` | Fase 2 · `generate()` live, pagina per pagina | ✅ collegato |
| Critic a strati (B8) | `lib/audit.ts` + `lib/ai/tasks/critic.ts` | Fase 2 · `runCritic()` (det + semantico) | ✅ collegato |
| Generazione immagini (B4) | `lib/images/*` + `/api/images` | Fase 3 · bottone **Genera** per pagina (manuale se no chiave) | ✅ collegato |
| **Writing brief** (B5) | `lib/brief.ts` → `story.brief` | Fase 2 · **pannello “Il brief — guida la scrittura”** (sola lettura) | ✅ **aggiunto in questo pass** |
| Stato provider/chiave (per fase) | `/api/ai`, `/api/images` | `/impostazioni` (chip “chiave presente / manca”) | 🟡 solo in impostazioni |

### 7.2 Quando il back cambia → cosa tocca il front (lookup anti-impazzimento)

- **Nuovo comando** in `lib/commands.ts` → se è azione dell'autore, dagli un punto
  in Fase 1 (campo/bottone). Se lo usa solo l'IA via tool, **niente UI**: già passa
  da `toMcpTools()`/`applySeedingTurn`.
- **Nuovo campo su `Story`/artefatto** (come è stato `brief`) → decidi se va **mostrato**.
  Pattern: pannello collassabile sola-lettura accanto alla fase che lo usa.
- **Nuovo `task` AI** (`lib/ai/tasks/<x>.ts`) → la fase che lo usa fa `POST /api/ai`
  con `build<X>Request`, applica con la sua funzione pura, e **tiene il fallback 501**.
- **Nuova fase** (es. il “Libro” montato B9, o una FASE 0 separata) → aggiungi il
  ramo in `Workspace.tsx`, una voce in `PHASES` la porta il back; aggiorna §3 qui e i
  test §6 (`test/Workspace.test.tsx`).
- **Cambi di navigazione** (tab→stepper ecc.) → aggiorna `test/Workspace.test.tsx`
  **insieme** (o segnala all'agente testing). Nessun `data-testid` oggi: i test UI
  poggiano su **testo/comportamento** (“Inizia con l'IA”, conferma reference…): non
  cambiarli alla leggera.

### 7.3 Occasioni UX aperte (per la sessione dedicata)

In ordine di valore/sforzo. Tutte **additive**, nessuna tocca il back.

1. **Consapevolezza del modo (IA vs manuale)** 🟡 *medio valore, basso sforzo.*
   Oggi scopri di essere senza chiave **solo dopo** un 501 (hint nel log). Mettere un
   chip onesto e proattivo — “IA collegata” / “modalità manuale · collega una chiave”
   — vicino ai bottoni che generano (Fase 1 chat, Fase 2 prosa, Fase 3 *Genera*),
   con link a `/impostazioni`. Stato già disponibile da `/api/ai` e `/api/images`.
2. **Stato provider immagini in Fase 3** 🟡. Prima dei bottoni *Genera*, dire se si va
   su GPT-Image (collegato) o Manus (manuale), così “Genera” non sorprende.
3. **Brief anche in Fase 1** ⬜ (dopo il *build*): un “ecco cosa scriverà l'IA” dà
   subito controllo. Riusa il `BriefPanel` di Fase 2.
4. **Campi ricchi del nodo/hook** (focal_action, atmosfera, palette, characters_present
   da B1) e **`references[]`/`missing[]`** dei prompt-pagina: oggi parzialmente mostrati;
   si possono rendere più leggibili in Fase 3 (anteprima reference allegate per pagina).
5. **Streaming più “vivo”** in Fase 2: cursore di scrittura, conteggio parole/pagina,
   indicatore di continuità. È già token-per-token: serve solo vestizione.
6. **Voci-personaggio d'autore** (`characterVoices`/`narratorBrief`, B3): catturate nel
   gioco, finiscono nel brief; potrebbero avere un riepilogo leggibile.
7. **Modernizzazione commerciale** (rotta Craft/Things 3, vedi §2): home come landing,
   onboarding del primo seme, micro-interazioni. Sessione a sé.

### 7.4 Modifica di questo pass
- **Aggiunto** `BriefPanel`/`BriefBody` in `components/phases/Phase2Prosa.tsx`
  (sola lettura, collassabile): rende **visibile** il writing brief (`story.brief`),
  unica funzione del back che prima non aveva alcun punto sul front. Additivo, nessun
  contratto toccato, `npm test` 168/168 verde.
