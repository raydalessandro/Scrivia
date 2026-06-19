# CLAUDE.md — regole per sviluppare e manutenere Scrivia

Questo file è per chi (IA o umano) lavora sulla repo. Leggilo prima di toccare
qualcosa. Scopo: muoversi veloci senza rompere i principi del sistema.

## Cos'è Scrivia (in una riga)
La UI/prodotto attorno al **seme** (`seme/`): produce una storia illustrata in
4 fasi, dove l'umano pianta e organizza e le IA lavorano. *"La verità è nel grafo."*

## Router — chi lavora su cosa (orchestrazione)
La repo è organizzata ad **agenti specializzati** in `.claude/agents/`. La sessione
principale fa da **orchestratrice**: legge questo router e **delega al subagente
giusto** (via il tool Agent) prima di toccare quell'area. Ogni agente parte dai
suoi documenti e sa come comportarsi.

| Tocchi… | Agente | Regole / doc |
|---|---|---|
| `app/` · `components/` · `app/globals.css` · `public/fonts/` (estetica, UI, layout) | **frontend** | `.claude/agents/frontend.md` + `docs/FRONTEND.md` |
| `test/` · `vitest.config` · CI | **testing** | `.claude/agents/testing.md` + `docs/TEST_SPEC.md` |
| `lib/` (motore, comandi, layer AI, tipi) | **backend** *(prossimo)* | parità Python `seme/` + invarianti |
| Supabase · persistenza · storage · auth (M3) | **supabase** | `.claude/agents/supabase.md` + `docs/SUPABASE_SPEC.md` |

**Confine front/back (regola d'oro).** `lib/` è la *single source of truth*: non si
tocca per l'estetica. Il front **legge** dal back e gli **passa** azioni via gli stessi
contratti (export di `lib/`, comandi, tipi). Così cambiare il look non perde funzioni
e cambiare il back non rompe la UI. Dettaglio in `docs/FRONTEND.md`.
Mappa completa degli agenti, **la convenzione (dove vivono agente e doc-compagno)** e
come aggiungerne: `.claude/agents/README.md`.

## Principi da non violare (vengono dal seme)
1. **Autorità umana.** L'umano dà il seme e sceglie (immagini, merge, pubblicazione).
   Niente azioni autonome irreversibili.
2. **Verità nel grafo.** Lo stato vive in artefatti ricostruibili; i passi
   deterministici danno lo stesso output dallo stesso input (stesso `nonce` =
   stessa storia).
3. **Complessità senza costo.** La ricchezza nasce dalla combinatoria di enum
   discreti, non dall'inferenza. L'LLM fa poche cose costose (seeding, prosa).
4. **Scheletro invisibile.** L'ontologia EAR (distinguere/connettere/cambiare)
   dà l'arco ma **non si nomina mai** nell'output.
5. **Due cancelli voluti.** Prosa (creativa) e immagini (Manus) restano passi
   umani/esterni: non automatizzarli "di nascosto".

## Mappa della repo
```
app/            route Next (home, story/[id], impostazioni, api/ai)
components/      UI. Fasi in components/phases/, picker IA in components/ai/
lib/types.ts    dominio (Story, Seed, StoryNode, comandi, ledger…)
lib/engine.ts   motore deterministico (port TS di seme/scripts) — NONCE→storia
lib/commands.ts registry dei comandi (unica fonte di verità) + toMcpTools()
lib/cache.ts    cache dei comandi puri
lib/stages.ts   le 7 tappe dello stelo + le 4 fasi
lib/store.ts    persistenza client (localStorage) — interfaccia sottile → Supabase
lib/ai/         layer AI universale (types, registry, config, providers, client)
lib/enums.ts    canone EAR/grammatica (etichette UI), specchio di seme_config.yaml
seme/           IL MOTORE DI RIFERIMENTO (Python) + canone + esempio + pytest
```

## Workflow Git — REGOLA MADRE: branch + PR (mai merge diretto)
**Ogni cambiamento passa da una feature branch e poi da una Pull Request. MAI un
merge/push diretto su `main`** — vale per **qualsiasi agente**, sempre, anche per
modifiche piccole (doc, config). È così che si tiene il vantaggio di git con gli
agenti: ogni modifica è rivedibile, la CI gira sulla PR, `main` resta protetto.

- **Sviluppa su una feature branch**; un cambiamento = un commit chiaro (in italiano).
- **Apri una PR** verso `main` (MCP GitHub / `gh`). La **CI gira sulla PR** (push +
  pull_request): si mergia **solo a verde**.
- **`main` si aggiorna SOLO via PR mergiata** — quando l'utente dà l'ok. Niente
  `git push origin HEAD:main`, niente fast-forward a mano sul `main`.
- `main` deploya in produzione (Vercel) ad ogni aggiornamento → ragione in più per
  passare sempre dalla PR.
- **Prima di aprire la PR**: `npm run check` verde in locale (i 4 gate, = la CI).
- Resta **nella tua corsia** (vedi router): non sconfinare nell'area di un altro agente.

## Prima di committare (obbligatorio)
```bash
npm run build      # deve passare: tipi + lint + build
```
Non committare se il build è rosso. Quando ci sarà la suite test: `npm test` deve
passare. Verifica i flussi che hai toccato (build verde è il minimo, non il massimo).

## Convenzioni di codice
- **Scrivi come il codice intorno**: stessa densità di commenti, naming, idiomi.
  Il dominio è in **italiano** (premise/problem/soglia, beat, semi…). Mantienilo.
- **Tutte le mutazioni di stato passano dai comandi** (`lib/commands.ts`). La UI
  e l'IA non scrivono lo `Story` a mano: chiamano `executeCommand`. Così restano
  log + cache + (domani) MCP coerenti.
- **Tutte le chiamate LLM passano dal layer** (`lib/ai`). Mai chiamare un provider
  direttamente da un componente o da una fase.
- **Nessun segreto nel repo.** Chiavi solo nelle env (vedi `.env.example`).
- Mantieni la palette/estetica "carta" (vars in `app/globals.css`).
- Mobile-first; rispetta safe-area e tap target.

## Come si aggiunge…
- **Un comando** → una voce in `COMMANDS` (`lib/commands.ts`): `name`, `title`,
  `description`, `category`, `params`, `run`. Se è puro/read, marcalo `pure: true`
  (entra in cache). Diventa automaticamente un tool MCP via `toMcpTools()`.
- **Un provider AI** → un adapter in `lib/ai/providers/` che implementa
  `ProviderAdapter`, più una voce nel `registry.ts` (modelli + reasoning + caps).
  La facciata e le fasi non cambiano.
- **Una fase** → un componente in `components/phases/` con la stessa firma
  (`PhaseProps`), e l'aggancio in `Workspace.tsx` + `lib/stages.ts`.
- **Un pacchetto-genere** → segue il modello `seme/packs/` (hook a punti d'iniezione).

## Motore & parità
`lib/engine.ts` è un **port** di `seme/scripts/*.py`. Quando lo estendi, tieni la
**parità** con il riferimento Python e i suoi `seme/tests/`. La riproducibilità
(stesso `nonce` → stesso nodo) è un invariante: non romperla.

## Deploy
- `main` → produzione Vercel (auto). `vercel.json` forza `framework: nextjs`.
- Branch → preview automatico. Se 403, è la Deployment Protection del team.
- Non promuovere a `main` per "vedere il deploy": usa il preview del branch.

## In dubbio
Se una scelta cambia struttura/architettura, o tocca un principio qui sopra,
**chiedi all'utente** invece di decidere da solo. Un passo alla volta.
