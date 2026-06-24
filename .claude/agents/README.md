# Agenti della repo — la squadra di Scrivia

Pattern: **un agente per area**, ognuno con regole proprie, così "ogni volta
lavora chi deve lavorare" senza perdere allineamento tra front e back.

## Come funziona (orchestrazione)
- La **sessione principale** è l'**orchestratrice**: legge il *router* in
  `CLAUDE.md`, capisce quale area tocchi e **delega al subagente giusto** (tool
  `Agent`, `subagent_type: <nome>`).
- Ogni subagente è definito qui in `.claude/agents/<nome>.md` (**formato Claude Code**:
  frontmatter `name` + `description`, opzionali `tools`/`model`) con le **regole operative**,
  che **rimandano** al doc-compagno in `docs/` (non lo duplicano).
- Vantaggio: il confine front/back resta netto, le funzioni non si perdono nei
  redesign, e chiunque (umano o IA) sa dove guardare.

## La squadra
| Agente | Stato | Area | Documenti |
|---|---|---|---|
| **frontend** | ✅ | `app/` · `components/` · `globals.css` · `public/fonts/` | `frontend.md` + `docs/FRONTEND.md` |
| **testing** | ✅ | `test/` · vitest · CI | `testing.md` + `docs/TEST_SPEC.md` |
| **backend** | ✅ | `lib/` harness deterministico (motore, comandi, tipi, brief/audit/reference/…) **tranne** `store.ts`/`supabase/*` e `ai/*`/`images/*` | `backend.md` + `docs/BACKEND.md` |
| **ai** | ✅ agente · frontiera in evoluzione | `lib/ai/*` · `lib/images/*` (modelli, generazione foto/video/audio, costi/limiti, MCP) | `ai.md` + `docs/AI_LAYER.md` |
| **supabase** | ✅ M3 in PR · schema+RLS+bucket applicati, adapter su Supabase | `lib/store.ts` · `lib/supabase/*` · migrazioni · bucket · auth | `supabase.md` + `docs/SUPABASE_SPEC.md` |

L'**orchestratrice** ora ha un file — `orchestratrice.md` + `docs/ORCHESTRAZIONE.md` — ma resta
una **categoria diversa** dai cinque qui sopra: è la **sessione principale** (il *delegante*),
caricata via `--agent orchestratrice`, **non un delegato spawnabile**. Non le si delega; non si
spawna. Governa instradamento, delega cache-native, ratifica, e le modifiche costituzionali (i
file in `.claude/agents/*` e il router) — che restano lavoro dell'orchestratrice, non di una corsia.

> **Fonte canonica delle aree: il router in `CLAUDE.md`.** Questa tabella lo
> **rispecchia** (stesso confine di corsia): se cambi un'area, aggiorna **entrambi**.

## Convenzione — dove vivono agente e doc
Standard **Claude Code**, così un agente è lanciabile direttamente (Claude Code e oltre:
API, automazioni, MCP, skill):
- **L'agente**: `.claude/agents/<nome>.md` — frontmatter YAML `name` + `description`
  (obbligatori; `tools`/`model` opzionali), poi le regole operative.
- **Il doc-compagno** (lo spec/manuale dell'agente): in **`docs/`**, con un **nome parlante**
  — non deve per forza essere `<NOME>.md` (es. `docs/FRONTEND.md`, `docs/TEST_SPEC.md`,
  `docs/SUPABASE_SPEC.md`). Uno **principale** per agente; **runbook/ausiliari** ammessi
  (es. `docs/TEST_MAP.md` per testing). L'agente vi **rimanda**, non duplica.
- **La root** resta per i doc "porta d'ingresso": `CLAUDE.md`, `README.md`, `ROADMAP.md`.

**Regola in una riga:** un agente = `.claude/agents/<nome>.md` + un doc-compagno in `docs/`
(nome parlante; ausiliari opzionali).

## Aggiungere un agente
1. Crea `.claude/agents/<nome>.md` (frontmatter Claude Code + regole operative).
2. Crea il doc-compagno in `docs/` (nome parlante; lo spec/manuale, l'agente vi rimanda, non duplica).
3. Aggiungi la riga nel **router** di `CLAUDE.md` (la **fonte canonica** delle aree).
4. **Rispecchia** la stessa area nella tabella "La squadra" qui sopra.

## Regole comuni a tutti gli agenti
- **Branch + PR sempre, mai merge diretto su `main`** (regola madre in `CLAUDE.md`):
  feature branch → `npm run check` verde → PR → si mergia a CI verde, con l'ok dell'utente.
- **Build/test verdi prima di committare**: `npm run build`, e `npm test` se tocchi
  codice coperto. Un cambiamento = un commit chiaro (in italiano).
- Resta **nella tua corsia**: non sconfinare nell'area di un altro agente; se serve,
  segnala all'orchestratrice perché deleghi a chi di dovere.
- **Il confine è il cancello (convenzione, non meccanismo).** Gli agenti **clonano la repo**
  in ambienti arbitrari: non ci affidiamo a hook/permessi locali per bloccare gli sconfinamenti
  (non sarebbero garantiti). Il cancello è la **regola scritta** in ogni agente. Ogni agente
  dichiara **cosa tocca**, **cosa non tocca mai**, e **cosa fa quando arriva al confine** (le tre
  clausole qui sotto). Così, nel dubbio, non improvvisa mai in zona-danni: ha già la mossa pronta.

### Confini che dialogano (cosa fare *al* confine)
Un confine sano non è un muro: è un **testimone che si passa bene**. Tre clausole, universali.

1. **Passaggio del testimone — chi consegna.** Fai la **tua parte intera** (al 100% nella tua
   corsia). Poi, al confine, il **default è: segnala all'orchestratrice e fermati**. Una **bozza
   oltre confine è l'eccezione**, ammessa *solo se de-rischia davvero il passaggio* — dimostra che
   il tuo lavoro regge, o sblocca concretamente chi riceve.
   - **Quando NON bozzare:** se basta segnalare, **non bozzare**. *Il segnale non è un lasciapassare.*
   - **Se bozzi:** minima, **reversibile**, visibilmente provvisoria; **commit isolato**; offri il
     **revert già pronto**. E **in quarantena**: nulla — nel tuo lavoro o altrove — deve dipendere
     da quella bozza finché non è ratificata (una bozza diventata portante non è più annullabile).
   - **Ampiezza:** il minimo che sblocca e dimostra. Se **blindi per bene** il lavoro altrui, hai
     **consumato la decisione** di chi quel lavoro lo possiede → è sconfino, non passaggio.

2. **Ricezione del testimone — chi riceve.** La **blindatura definitiva è tua**: **riprendi in
   carico** la bozza — riscrivila o accettala **esplicitamente**. *Una bozza ricevuta e mai ripresa
   in carico è **debito**, non lavoro fatto.* (Senza questo gancio l'handoff è monco e le bozze
   marciscono.)

3. **Consegna contraddittoria.** Se le istruzioni **non possono essere vere insieme** (es. "rendi
   verdi questi todo" + "non scriverne il corpo", quando i todo non hanno corpo), il **primo dovere
   è nominare la contraddizione**, non indovinare. Poi **proponi la risoluzione minima** e fai la
   parte **non-ambigua**: dai materiale per decidere, non solo un alt.

**La catena di ratifica (autorità umana, P1).** L'attraversamento è un **artefatto con stato
esplicito** — *debito* finché non *ratificato* (è "la verità è nel grafo" applicata ai confini):

> chi consegna → **bozza (= debito)** · orchestratrice → **instrada e mostra** (non accetta codice
> fuori-corsia da sola) · chi possiede l'area → **riprende in carico** (riscrive o accetta) · umano
> → **ratifica al merge**.

Il debito **si chiude** solo quando il proprietario lo prende in carico **e** l'umano mergia.
Finché non è ratificato, conta come **debito**, non come fatto (combacia con *"`main` si aggiorna
solo via PR, con l'ok dell'utente"*). Ogni agente **rimanda** a queste clausole, non le duplica.
