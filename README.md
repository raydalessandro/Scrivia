# Scrivia

Interfaccia per **far crescere una storia illustrata** col sistema `seme`
(il motore, in `seme/`). Tu pianti il seme e organizzi; da lì lavorano le IA.
Il processo resta chiaro, con i tempi, fase per fase.

> Tesi del seme: *"la verità è nel grafo"*. Il giudizio editoriale sta a monte,
> fissato come dati; il modello **rende**, non **decide** la struttura. Scrivia è
> il prodotto attorno a quella spina.

## Le 4 fasi

| # | Fase | Chi lavora | Cosa esce |
|---|------|-----------|-----------|
| 1 | **Progetta la storia** | Tu (modo guidato *o* intake) → IA (chat), poi catena deterministica | grafo, brief, prompt immagini |
| 2 | **Scrivi la prosa** ✋ | IA scrive in streaming dal brief + critic a strati | pagine già verificate |
| 3 | **Le illustrazioni** ✋ | Tu confermi le reference → **Genera** (script TS) *o* Manus manuale | reference canoniche + un'immagine per pagina |
| 4 | **Monta il libro** | deterministico | PDF A5 |

Due **cancelli umani** sono voluti: la prosa (creativa) e le immagini.
Lo **stelo** mostra sempre dove sei e *chi lavora* (tu / Claude / Manus / sistema);
il **registro** rende visibili i tempi.

### Fase 1 in dettaglio — lo "studio di seeding"
Non un wizard usa-e-getta ma uno spazio di lunga durata (può durare settimane):
- **Modo guidato** ("✨ pianta il seme passo-passo"): un *gioco* deterministico che
  raccoglie protagonista, mondo, movimento, spina e **voci** (anche dei personaggi)
  e li mappa sul `Seed` — consigliato la prima volta. In alternativa, l'**intake** libero:
- **"Inizia con l'IA"**: il primo messaggio nasce dalla bozza — ricapitola e
  chiede solo i buchi, non "ciao, che storia hai in mente?".
- **Memoria + focus**: chat e comandi persistono; selezioni un'entità
  (personaggio, campo della spina, il grafo) e l'IA *sa* di cosa parli.
- Ogni azione (umano o IA) passa dal **registry dei comandi** → log + cache.

### Fase 2 in dettaglio — prosa e critic
- **Prosa in streaming**: l'IA scrive **pagina per pagina** dal `story.brief`
  (writing brief deterministico, prodotto al `build_node`), tenendo la continuità;
  il brief è **visibile in sola lettura** sopra la fase.
- **Critic a strati**: un passaggio **deterministico** (regex + strutturale, `lib/audit.ts`)
  gira **sempre**; lo strato **semantico** (via `/api/ai`) si aggiunge se c'è la chiave,
  altrimenti resta *in attesa* — niente blocca il flusso.

### Fase 3 in dettaglio — il "Passo 0" (reference visiva)
Prima delle pagine, ogni personaggio/luogo ha una **reference canonica**:
- **Passo 0**: definisci l'aspetto (descrittore), copi il prompt del *foglio di
  reference* (blindato) in Manus, rimetti l'immagine e **confermi**. Da quel
  momento è canone duro. Un **gate** chiede tutte le reference confermate.
- **Le pagine**: i prompt sono **veri** (STORY MOMENT/POV/PLACE/SUBJECT dal
  nodo+canone) e **allegano** le reference confermate → coerenza personaggi/luoghi.
- **Generazione**: il tasto **Genera** chiama la route `/api/images` (provider
  `openai`); senza chiave si resta in **modalità manuale** (Manus). La chiave è server-side.

## Architettura

- **Next.js (App Router) + TypeScript + Tailwind v4**, deploy su **Vercel**. PWA.
- **`lib/engine.ts`** + **`lib/engineTypes.ts`** + **`lib/canon.json`** — motore
  deterministico (port TS di `seme/scripts/*.py`) **a parità di contratto** col
  Python: `buildNode` → `extractHooks` (hook ricchi) → voce frattale + invarianti
  (`checkNode`/`checkHooks`). Stesso `nonce` → stessa storia. La suite **pytest**
  in `seme/tests/` e `test/engine.parity.test.ts` sono il riferimento di parità.
- **`lib/reference.ts`** + **`lib/pagePrompts.ts`** + **`lib/stylesheet.ts`** —
  Passo 0 (record d'entità, foglio di reference, gate) e i prompt-pagina veri
  che allegano le reference confermate.
- **`components/phases/SeedingGame.tsx`** + **`lib/seedFromGame.ts`** — la Fase 1
  come **gioco** (modo guidato) e il mapping `GameState → Seed` (movimento EAR
  invisibile, override di grammatica, voci-personaggio + `narratorBrief`).
- **`lib/brief.ts`** — il *writing brief* deterministico (ricetta strutturale, voce,
  semi/eco, tabella pagina-per-pagina) prodotto al `build_node` su `story.brief`: è ciò
  da cui l'IA scrive la prosa, a **zero token**.
- **`lib/commands.ts`** — registry dei comandi: catalogo tipizzato di azioni
  eseguibili. **Una sola fonte di verità**: UI e IA passano di lì (log + cache).
  `toMcpTools()` lo esporta in stile MCP-tool (base della futura MCP).
- **`lib/ai/`** — layer AI universale e isolato (Anthropic + DeepSeek), con
  switch di modello e reasoning, e scelta per-fase (vedi `/impostazioni`). I **task M2**
  vivono in `lib/ai/tasks/` (seeding tool-use, prosa in streaming, critic semantico);
  ogni chiamata passa dalla route server-side `/api/ai` (la chiave non lascia il server).
- **`lib/audit.ts`** — il **critic deterministico** (regex + strutturale), strato
  sempre-attivo del cancello qualità della Fase 2.
- **`lib/images/`** + **`/api/images`** — composizione prompt + provider (`openai`,
  `manual`) per la **generazione diretta** delle illustrazioni; senza chiave, modalità manuale.
- **`lib/store.ts`** — stato client (localStorage) dietro un'interfaccia sottile,
  sostituibile con **Supabase** (Postgres + Storage) per immagini/video futuri.

```
app/                  route (home, story/[id], impostazioni, api/ai, api/images)
components/            UI: stelo, fasi, studio di seeding, picker IA
lib/                  types, engine(+Types,+canon), commands, cache, stages,
                      reference, pagePrompts, stylesheet, brief, audit, store,
                      images/, ai/ (+ai/tasks: seeding, prosa, critic)
test/                 suite Vitest: parità motore, comandi, reference, stages/store,
                      layer AI + task M2, brief, immagini, e2e, smoke UI
seme/                 il motore di riferimento (Python) + canone + esempio
```

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # verifica tipi + lint + build
npm test         # suite Vitest
npm run check    # i 4 gate (test + typecheck test + tsc + build) = la CI
```

> **Workflow git**: ogni cambiamento passa da una **feature branch + Pull Request**,
> mai un merge diretto su `main` (regola in `CLAUDE.md`). La **CI** gira sulla PR.

### Variabili d'ambiente (solo quando si collegano le IA)
Vedi `.env.example`. Le chiavi vivono nelle env di Vercel, mai nel repo, e si leggono
**a runtime** sul server (mai in build/test).
```
ANTHROPIC_API_KEY=      # layer AI (prosa, seeding, critic semantico)
DEEPSEEK_API_KEY=       # layer AI (provider alternativo)
OPENAI_API_KEY=         # immagini (tasto "Genera" in Fase 3)
```

## Deploy

Integrazione GitHub→Vercel: ogni push su **`main`** fa un deploy di produzione.
Il progetto Vercel usa `vercel.json` (`framework: nextjs`). Se il sito risponde
403, è la **Deployment Protection** del team (login richiesto) — si disattiva
dalle impostazioni del progetto su Vercel.

## Stato e piano

Vedi **`ROADMAP.md`**. Regole per sviluppare e manutenere la repo: **`CLAUDE.md`**.

### Agenti della repo
La repo è organizzata ad **agenti specializzati** (front, test, e in arrivo
backend/supabase). La sessione principale fa da **orchestratrice**: legge il
*router* in **`CLAUDE.md`** e delega all'agente giusto in base all'area toccata.
Definizioni e mappa: **`.claude/agents/`** (regole front in **`FRONTEND.md`**,
test in **`docs/TEST_SPEC.md`**). Qualunque agente o sessione parte da lì.
