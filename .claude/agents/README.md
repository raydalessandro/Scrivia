# Agenti della repo — la squadra di Scrivia

Pattern: **un agente per area**, ognuno con regole proprie, così "ogni volta
lavora chi deve lavorare" senza perdere allineamento tra front e back.

## Come funziona (orchestrazione)
- La **sessione principale** è l'**orchestratrice**: legge il *router* in
  `CLAUDE.md`, capisce quale area tocchi e **delega al subagente giusto** (tool
  `Agent`, `subagent_type: <nome>`).
- Ogni subagente è definito qui in `.claude/agents/<nome>.md` con: `name`,
  `description` (quando usarlo) e le **regole operative** (parte dai suoi documenti).
- Vantaggio: il confine front/back resta netto, le funzioni non si perdono nei
  redesign, e chiunque (umano o IA) sa dove guardare.

## La squadra
| Agente | Stato | Area | Documenti |
|---|---|---|---|
| **frontend** | ✅ | `app/` · `components/` · `globals.css` · `public/fonts/` | `frontend.md` + `FRONTEND.md` |
| **testing** | ✅ | `test/` · vitest · CI | `testing.md` + `docs/TEST_SPEC.md` |
| **backend** | ⬜ prossimo | `lib/` (motore, comandi, ai, tipi) | da creare: parità `seme/` + invarianti |
| **supabase** | ⬜ futuro (M3) | persistenza · storage · auth | da creare |

L'**orchestratrice** non è un file: è la sessione principale guidata dal router di
`CLAUDE.md`. Se servirà un agente-router esplicito, si aggiunge qui come gli altri.

## Aggiungere un agente
1. Crea `.claude/agents/<nome>.md` con frontmatter `name` + `description` (quando
   usarlo) e le regole operative (rimanda ai doc esistenti, non duplicare).
2. Aggiungi la riga nel **router** di `CLAUDE.md`.
3. Aggiorna questa tabella.

## Regole comuni a tutti gli agenti
- **Branch + PR sempre, mai merge diretto su `main`** (regola madre in `CLAUDE.md`):
  feature branch → `npm run check` verde → PR → si mergia a CI verde, con l'ok dell'utente.
- **Build/test verdi prima di committare**: `npm run build`, e `npm test` se tocchi
  codice coperto. Un cambiamento = un commit chiaro (in italiano).
- Resta **nella tua corsia**: non sconfinare nell'area di un altro agente; se serve,
  segnala all'orchestratrice perché deleghi a chi di dovere.
