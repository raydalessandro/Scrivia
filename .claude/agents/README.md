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
| **backend** | ✅ | `lib/` (motore, comandi, ai, tipi) **tranne** `store.ts`/`supabase/*` | `backend.md` + `docs/BACKEND.md` |
| **supabase** | ✅ agente pronto · M3 da eseguire | `lib/store.ts` · `lib/supabase/*` · migrazioni · bucket · auth | `supabase.md` + `docs/SUPABASE_SPEC.md` |

L'**orchestratrice** non è un file: è la sessione principale guidata dal router di
`CLAUDE.md`. Se servirà un agente-router esplicito, si aggiunge qui come gli altri.

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
