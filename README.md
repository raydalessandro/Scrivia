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
| 1 | **Progetta la storia** | Tu (intake) → IA (chat), poi catena deterministica | grafo, brief, prompt immagini |
| 2 | **Scrivi la prosa** ✋ | IA scrive + critic controlla | pagine già verificate |
| 3 | **Le illustrazioni** ✋ | Tu confermi le reference → Manus (in futuro: script TS) | reference canoniche + un'immagine per pagina |
| 4 | **Monta il libro** | deterministico | PDF A5 |

Due **cancelli umani** sono voluti: la prosa (creativa) e le immagini.
Lo **stelo** mostra sempre dove sei e *chi lavora* (tu / Claude / Manus / sistema);
il **registro** rende visibili i tempi.

### Fase 1 in dettaglio — lo "studio di seeding"
Non un wizard usa-e-getta ma uno spazio di lunga durata (può durare settimane):
- **Intake**: una griglia che compili a mano (zero token). Lasci vuoto ciò che
  vuoi decidere con l'IA.
- **"Inizia con l'IA"**: il primo messaggio nasce dalla bozza — ricapitola e
  chiede solo i buchi, non "ciao, che storia hai in mente?".
- **Memoria + focus**: chat e comandi persistono; selezioni un'entità
  (personaggio, campo della spina, il grafo) e l'IA *sa* di cosa parli.
- Ogni azione (umano o IA) passa dal **registry dei comandi** → log + cache.

### Fase 3 in dettaglio — il "Passo 0" (reference visiva)
Prima delle pagine, ogni personaggio/luogo ha una **reference canonica**:
- **Passo 0**: definisci l'aspetto (descrittore), copi il prompt del *foglio di
  reference* (blindato) in Manus, rimetti l'immagine e **confermi**. Da quel
  momento è canone duro. Un **gate** chiede tutte le reference confermate.
- **Le pagine**: i prompt sono **veri** (STORY MOMENT/POV/PLACE/SUBJECT dal
  nodo+canone) e **allegano** le reference confermate → coerenza personaggi/luoghi.

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
- **`lib/commands.ts`** — registry dei comandi: catalogo tipizzato di azioni
  eseguibili. **Una sola fonte di verità**: UI e IA passano di lì (log + cache).
  `toMcpTools()` lo esporta in stile MCP-tool (base della futura MCP).
- **`lib/ai/`** — layer AI universale e isolato (Anthropic + DeepSeek), con
  switch di modello e reasoning, e scelta per-fase (vedi `/impostazioni`).
- **`lib/store.ts`** — stato client (localStorage) dietro un'interfaccia sottile,
  sostituibile con **Supabase** (Postgres + Storage) per immagini/video futuri.

```
app/                  route (home, story/[id], impostazioni, api/ai)
components/            UI: stelo, fasi, studio di seeding, picker IA
lib/                  types, engine(+Types,+canon), commands, cache, stages,
                      reference, pagePrompts, stylesheet, store, ai/
test/                 suite di parità motore + smoke reference (tsx)
seme/                 il motore di riferimento (Python) + canone + esempio
```

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # verifica tipi + lint + build
```

### Variabili d'ambiente (solo quando si collegano le IA)
Vedi `.env.example`. Le chiavi vivono nelle env di Vercel, mai nel repo.
```
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
```

## Deploy

Integrazione GitHub→Vercel: ogni push su **`main`** fa un deploy di produzione.
Il progetto Vercel usa `vercel.json` (`framework: nextjs`). Se il sito risponde
403, è la **Deployment Protection** del team (login richiesto) — si disattiva
dalle impostazioni del progetto su Vercel.

## Stato e piano

Vedi **`ROADMAP.md`**. Regole per sviluppare e manutenere la repo: **`CLAUDE.md`**.
