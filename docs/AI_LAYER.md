# AI_LAYER — il manuale del layer di intelligenza e generazione

> Doc-compagno dell'**agente ai** (`.claude/agents/ai.md`). È il manuale del layer che
> **chiama i modelli** (`lib/ai/`) e **genera** (`lib/images/`, domani video/audio). Qui c'è
> il **contratto della facciata** (ciò che non si rompe mai), il pattern *adapter → registry →
> config*, le **modalità**, la disciplina per **stare aggiornati**, **costi/limiti**, l'innesto
> **MCP**, e il **seam col backend**. Scritto per **scalare**: questo layer diventerà un
> software a parte; tienilo solido fin da ora.

## Cos'è (e perché è diverso dagli altri)
È l'unica parte di Scrivia che vive sulla **frontiera**: modelli e provider nuovi, patch,
deprecazioni quasi ogni settimana; testo, immagine, audio, video; locale e cloud; token,
costi, limiti. Il resto della repo codifica pattern *stabili*; qui il pattern stabile è
**l'architettura**, mentre i *contenuti* (quali modelli) cambiano di continuo. Due obiettivi
inseparabili:
- **Facciata solida** → aggiungere il decimo modello costa come il secondo. È ciò che evita lo
  "spaghetti dove usi sempre i soliti due modelli".
- **Registry fresco** → l'inventario dei modelli riflette il mondo reale (verifica, non memoria).

## La corsia (cosa è tuo, cosa no) — e il seam col backend
**Tuo:** `lib/ai/*` e `lib/images/*` (domani `lib/video/*`, `lib/audio/*`, modulo costi/limiti);
la superficie **MCP** lato chiamata.

**Non tuo:** l'**harness deterministico** (backend), la persistenza (supabase), l'estetica
(frontend), i test (testing).

**Il seam col backend** (sola lettura, due direzioni):

| Confine | Backend (struttura) | AI (inferenza) |
|---|---|---|
| Prosa | assembla il **brief** (`brief.ts`, zero-token) | il task **prosa** lo *consuma* e scrive |
| Audit | combina il **verdetto** a strati (`audit.ts`) | il task **critic** (strato 3 semantico) lo *alimenta* |
| MCP | produce i tool (`toMcpTools()` dal command registry) | li *passa* alle chiamate, orchestra il tool-use |
| Immagini | i **prompt-pagina** deterministici (`pagePrompts.ts`) + costanti (`stylesheet.ts`) | la **generazione** (`lib/images/`) li *usa* |

Regola: **la struttura è del backend, l'inferenza è tua.** Se ti serve cambiare l'assembly del
brief, un tipo del dominio, o la logica del verdetto: **segnala al backend**, non sconfinare.

## L'architettura stabile (il contratto che non si rompe)
Tutto ruota attorno a tre pezzi e a una facciata. *Questi* non cambiano quando aggiungi un
modello o un provider — è il punto.

1. **Tipi neutri** (`lib/ai/types.ts`) — indipendenti dal provider: `CompletionRequest`/
   `CompletionResult`, `StreamEvent`, `AIMessage`, `AITool`/`AIToolCall`, `Usage`,
   `ReasoningLevel`, `AITask`, e l'interfaccia **`ProviderAdapter`** (`complete` + `stream`).
2. **Registry** (`lib/ai/registry.ts`) — il **catalogo** `provider → modelli`, dati puri
   (nessun segreto, sicuro lato client). Per ogni modello: `id`, `contextTokens`,
   `maxOutputTokens`, `reasoning[]`, `caps` (`effort`, `thinkingAlwaysOn`, `canDisableThinking`,
   `tools`). **La verità sulle capacità sta qui**; gli adapter la leggono. Helper:
   `getModel`, `clampReasoning`.
3. **Config per-fase** (`lib/ai/config.ts`) — `DEFAULT_SELECTION` per ogni `AITask`
   (provider+modello+reasoning); l'utente sovrascrive "al click" (`setSelection`, persistito);
   `getSelection` risolve override→default e **clampa** il reasoning al supportato.

**La facciata** (`lib/ai/index.ts`): lato client esporta **solo** `types`/`registry`/`config`
(per i selettori UI); **solo server** (chiavi + `fetch`): `client.ts` (`aiComplete`/`aiStream`)
e gli adapter (`providers/`). Le **fasi** (`tasks/`) chiamano il client passando un `AITask`;
la selezione la risolve la config. **Aggiungere un provider/modello non tocca la facciata né le
fasi.**

## Le modalità (testo, immagine, e domani video/audio) — stesso shape
La generazione immagini (`lib/images/`) è la **prima modalità non-testo** e fissa il modello da
replicare:
- **tipi neutri** request/result (`ImageRequest`/`ImageResult`, con `costUsd`),
- un'interfaccia **adapter** (`ImageProviderAdapter`: `id` + `ready()` + `generate()`),
- una **facciata-selettore** (`activeImageProvider()` → `openai` se la chiave c'è, altrimenti
  `manual`), `generateImage()`, `imageProviderStatus()`.

**Video e audio seguono lo stesso shape**: `lib/video/` e `lib/audio/` con tipi neutri +
adapter + facciata-selettore. Niente di speciale per modalità: cambia il payload, non il
pattern. *(Il testo ha in più la config per-fase e lo streaming SSE; le modalità di generazione
hanno in più costi/format/dimensioni.)*

## Stare aggiornati (la disciplina della frontiera)
- **Una sola fonte per "cosa esiste": il registry.** Modello nuovo → una voce. Modello
  aggiornato (limiti, caps, prezzo) → si modifica la voce. Modello deprecato → si marca/rimuove
  e la config fa fallback. **Mai** id o limiti sparsi negli adapter o nelle fasi.
- **Verifica prima di scrivere.** Id, context, output, reasoning, caps, prezzi, rate-limit
  cambiano spesso: **leggi la doc ufficiale del provider** e cita la fonte nel PR. Non scrivere
  un model id "a memoria".
- **Cadenza piccola e frequente.** Un modello / un provider per PR: facile da rivedere, facile
  da revertare. Meglio dieci PR pulite di un big-bang.
- **Degrado, non rottura.** `clampReasoning` riallinea il reasoning; un modello sparito non deve
  rompere una fase (fallback via config). Le `caps` guidano la costruzione della richiesta.

## Costi, token, limiti (prima classe)
- Ogni chiamata **riporta l'uso**: `Usage` (input/output/reasoning token) per il testo,
  `costUsd` per le immagini. **Consolidali** (oggi sono frammenti; il modulo costi li unifica).
- Il layer **contabilizza** il costo per task/sessione e **rispetta i limiti** (rate-limit,
  budget): nessuna chiamata "cieca". Quando il modulo costi/limiti cresce, **vive qui** (tipi
  neutri, leggibili dalla UI per mostrare spesa e quota).
- **Locale vs cloud**: un modello locale è solo un altro provider (adapter + registry, `apiKeyEnv`
  assente o endpoint locale). Stesso contratto; cambia solo il `baseUrl`/auth.

## MCP (co-evolve col layer)
- I **tool** arrivano nella forma di `AITool` — **la stessa** di `commands.toMcpTools()`, che la
  **produce il backend** dal command registry. Tu li **passi** nelle `CompletionRequest.tools` e
  **orchestri** il loop: il modello chiede un `AIToolCall` → si esegue il comando → si rientra.
- **Confine netto:** la *forma* e l'*esecuzione* del tool (il comando) sono del **backend**; il
  *consumo* (passare i tool al modello) e l'*orchestrazione* del tool-use sono **tuoi**.
- Layer AI e MCP **vanno insieme**: man mano che l'MCP cresce (server esterni, più tool), è qui
  che si gestisce il provider tool-use ↔ MCP. Tienili coerenti.

## Come si estende (ricette)
- **Un modello** → una voce nel `registry.ts` sotto il provider giusto (`id`, `contextTokens`,
  `maxOutputTokens`, `reasoning[]`, `caps`, `note`). **Verifica i valori sulla doc ufficiale.**
  Se diventa il default sensato per un task, aggiorna `DEFAULT_SELECTION` in `config.ts`.
- **Un provider (testo)** → un adapter in `lib/ai/providers/<x>.ts` che implementa
  `ProviderAdapter` (`complete` + `stream`, mappando i tipi neutri sul protocollo del provider e
  onorando le `caps`), + una voce `ProviderSpec` nel registry (`apiKeyEnv`, `baseUrl`, `models`).
  Facciata e fasi **non** cambiano.
- **Una modalità (video/audio)** → `lib/<modalità>/` con tipi neutri request/result, interfaccia
  adapter, facciata-selettore — **sul modello di `lib/images/`**. La UI legge lo status come per
  le immagini.
- **Un task** → una voce in `AITask` (in `lib/ai/types.ts`) + un default in `config.ts`; la
  logica della fase in `lib/ai/tasks/<task>.ts` (brief-first per la prosa; giudizio-non-riscrittura
  per il critic). Se il task ha bisogno di nuovi dati strutturati → li produce il **backend**.
- **Modulo costi/limiti** → tipi neutri (`UsageLedger`, budget per task) + aggancio nel `client.ts`
  perché ogni chiamata vi confluisca; leggibile lato client per la UI.

## Gate (prima di consegnare)
```bash
npm run check   # vitest + typecheck:test + tsc --noEmit + next build (= la CI)
```
- I 4 gate verdi. Il layer AI si testa **con `fetch` mockato** (mai API vere): shape della
  richiesta + parsing della risposta (è l'agente **testing** a tenere quei test; tu non li
  riscrivi, se un tuo cambio di contratto li rompe **segnali**).
- **Facciata invariata**: i chiamanti compilano senza modifiche.
- **Registry verificato** sulla doc ufficiale (fonte nel PR).

## Workflow
**Branch + PR, mai merge diretto su `main`** (regola madre `CLAUDE.md`). PR **piccole e
frequenti** (un modello/provider per PR). Consegna col protocollo (zip + `COME_APPLICARE.md`).

## Riferimenti
- Per-area: `docs/AIPROSA_INTEGRATION.md`, `docs/AISEEDING_INTEGRATION.md`,
  `docs/CRITIC_INTEGRATION.md`, `docs/IMAGEGEN_INTEGRATION.md`.
- Il seam col backend: `docs/BACKEND.md` (assembly del brief, verdetto audit, `toMcpTools()`).
- Principi e cancelli: `CLAUDE.md` + `seme/ARCHITETTURA.md` (P5 scheletro invisibile, P6 strati
  a guasto indipendente, P10 cancelli umani).

## In dubbio
Se una scelta tocca la facciata in modo non-additivo, l'area del backend, un cancello umano o un
principio del seme: **chiedi**. Un passo alla volta.
