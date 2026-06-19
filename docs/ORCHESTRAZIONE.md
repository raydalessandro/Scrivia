# ORCHESTRAZIONE — il manuale della sessione principale

> Doc-compagno dell'**agente orchestratrice** (`.claude/agents/orchestratrice.md`). È il manuale
> di chi **instrada, delega, ratifica e tiene magro il contesto**. Qui c'è la disciplina di
> **gestione del contesto** e di **spawn cache-native**, fondata sulla fisica di
> `docs/CACHE_COME_ARCHITETTURA.md` (P1–P8). L'orchestratrice non è un agente di corsia: è il
> **delegante**, la sessione principale (via `--agent orchestratrice`), non un delegato.

## Cos'è l'orchestratrice
La sessione principale. Non scrive codice di corsia: lo **delega** ai cinque agenti
(frontend, testing, backend, ai, supabase). Il suo valore non è *fare*, è **coordinare bene**
— e "bene" qui ha una definizione precisa e misurabile: **tenere alto il cache hit rate** del
sistema (la misura economica dell'ordine, §3.2 del doc cache) e **basso il costo di
navigazione** (P6). Tre mestieri: **instradare**, **delegare** (con contesto gestito),
**ratificare**.

## Due modalità d'esercizio (nessuna esclusiva, non vincolante)
L'orchestrazione si esercita in due modi **complementari** — la disciplina (instrada, delega,
ratifica, tieni magro) e la **catena di ratifica** (l'umano al merge) valgono in **entrambi**:
- **Spawn degli agenti (cache-native).** L'orchestratrice apre gli agenti di corsia col tool
  `Agent`, con contesto preparato e a cadenza (§4). È la modalità nativa dentro Claude Code, e
  quella per cui è scritta la disciplina di §4.
- **Integrazione di bundle (partner-mode).** L'umano lavora in una **chat qualsiasi**, produce un
  *bundle* (file + `COME_APPLICARE.md` / patch) e lo porta da integrare. L'orchestratrice lo
  applica su un branch, **diff-verifica** (niente regressioni, riferimenti che risolvono, confine
  rispettato), fa girare i **4 gate**, apre la PR e mergia all'ok. Comodo e frequente, ma **un
  riferimento, non l'unico flusso**.

Le due convivono: si può lavorare tutto a spawn, tutto a bundle, o misto. Cambia *chi prepara il
lavoro di corsia*; **non** cambiano i confini, i gate, né la ratifica umana.

## 1. Instradare
Il **router di `CLAUDE.md` è la fonte canonica** di chi tocca cosa. L'orchestratrice lo legge e
manda ogni richiesta alla corsia giusta. La decisione di *quale* corsia è sua (è il suo
dominio); il *lavoro* della corsia non lo è. Se una richiesta è cross-corsia, la **scompone** in
deleghe per-corsia coerenti; non la schiaccia in un'unica delega confusa.

## 2. Delegare tenendo magro il contesto
Il principio operativo (confermato dalla pratica dei sistemi a sub-agenti): **la sessione
principale delega, raccoglie i risultati, e li usa senza portarsi dietro l'intera storia di
lavoro di ogni sotto-task**. Quindi:
- **Delega tutto ciò che gonfierebbe il contesto principale**: esplorazione, lettura estesa,
  lavoro di corsia. L'agente brucia il *suo* contesto isolato; tu assorbi solo la **sintesi/
  l'artefatto**.
- **Assorbi sintesi, non grezzo.** Una delega ben fatta torna con un esito compatto (un path, un
  verdetto, un diff), non con il diario di tutto ciò che ha letto.
- **Conteggio deliberato (anti-sprawl).** Ogni agente in più moltiplica memoria, contesto e
  costo: apri il **minimo** che serve. Non aprire un agente che non guadagna il suo posto.

## 3. Ratificare (la catena dei confini)
Dalla costituzione "Confini che dialogano" (`.claude/agents/README.md` → "Regole comuni"),
l'orchestratrice è **l'anello di mezzo**:

> chi consegna → **bozza (= debito)** · **orchestratrice → instrada e mostra** · chi possiede
> l'area → **riprende in carico** · umano → **ratifica al merge**.

Regola dura: l'orchestratrice **non accetta codice fuori-corsia da sola**. Instrada la bozza al
proprietario, la **mostra**, e lascia la ratifica all'umano (al merge). Una bozza non ratificata
è **debito**, non lavoro fatto. (E la costituzione la scrive l'orchestratrice stessa, non una
corsia: modificare i file di definizione degli agenti *è* il suo dominio diretto.)

## 4. Spawn cache-native (la disciplina di contesto degli agenti)
Il problema che la motiva: **uno spawn con contesto "fresco" sembra dover rileggere tutto da
capo**. Ma *fresco ≠ cache miss*: uno spawn obbedisce alla stessa fisica di un turno (doc cache,
cap. 2–3). L'obiettivo è che ogni spawn paghi **l'invariante a 0,1×** e solo la **variante**
(+ output) a prezzo pieno.

### 4.1 Fattorizza lo spawn (P1 + P2)
Il contesto di ogni agente aperto è, in ordine canonico (`tools → system → messages`):
```
INVARIANTE (prefisso, byte-identico)         VARIANTE (coda)
[ definizioni tool ]                          [ il task specifico ]
[ definizione agente (.md) ]                  [ lo stato/posizione del momento ]
[ doc-compagno + doc instradati ]             [ l'eventuale delta di una ripresa ]
```
- L'invariante va **in testa** e **byte-identica** tra spawn (P2): nessun timestamp, ID di run,
  o scrollback del padre nel prefisso. Un byte diverso in posizione *k* invalida tutto da *k*.
- La variante (il task) va **in coda**, dove il suo cambiare invalida poco.
- Corollario: l'**assemblaggio del contesto di spawn dev'essere deterministico/idempotente** —
  è la precondizione della cacheability (P2). Stesso agente + stesso task → stessi byte.

### 4.2 Instrada, non far esplorare (P6)
Il costo #1 di uno spawn **non** è la ri-lettura (l'input si paga una volta): è
l'**esplorazione** — un agente che gira per orientarsi brucia decine di migliaia di token in
tool call e ragionamento prima di produrre valore. La cura è dare un contesto **autosufficiente
e instradato** (il pattern *brief*): l'agente trova ciò che serve già al suo posto e non cerca.
Il nostro sistema lo serve già: **router** (`CLAUDE.md`), **doc-compagni** per area, struttura
**machine-readable**. *Ciò che la struttura instrada, l'agente non deve cercare.*

### 4.3 Cadenza dentro il TTL (P4) — il tuo "conoscere i tempi"
Ogni hit **rinnova il TTL gratis**: un prefisso colpito più spesso del suo TTL vive
indefinitamente al costo del **primo write**. L'orchestratrice conosce la cadenza con cui apre
gli agenti → la usa:
- **Spawn in sequenza = ritmo macchina** (gap < 5') → **TTL 5'**. Trenta spawn in un'ora a uno
  ogni due minuti = un write + ventinove read.
- **Raggruppa** gli spawn dello **stesso agente** vicini nel tempo: il loro prefisso (invariante)
  resta caldo tra l'uno e l'altro. Spargerli nel tempo li raffredda e ripaga il write ogni volta.
- **Cross-agente:** agenti diversi hanno definizioni diverse → condividono solo il **prefisso
  comune in testa** (definizioni tool + eventuale preambolo condiviso *prima* del blocco
  specifico). Massimizzi la condivisione cross-agente tenendo l'invariante condivisa (tool,
  regole di casa) *davanti* al blocco specifico dell'agente.

### 4.4 Stabilità del catalogo tool (vincolo che tocca l'agente ai/MCP)
I **tool sono il primo layer del prefisso**: aggiungere/cambiare un tool a metà sessione invalida
**tutta** la cache della conversazione. Conseguenza: il **catalogo MCP dev'essere stabile a
sessione** (bloccato all'avvio). È una regola che l'orchestratrice rispetta e che l'**agente ai**
implementa sul suo lato (la superficie MCP): nuovi tool si introducono a confine di sessione, non
a metà.

### 4.5 La leva, onestamente (Claude Code vs spawner custom)
- **In Claude Code** molto è **automatico**: CC fa *warm-up* e *priming* dei system prompt dei
  subagent, riusa la tool-list del main come sottoinsieme, e tiene i subagent a **TTL 5' fissi**
  (override via env "in arrivo"). Lì l'orchestratrice non *guida* la cache: **asseconda la
  cadenza** (spawn ravvicinati dello stesso agente) e **verifica** che colpisca davvero. Nota:
  ci sono stati bug noti (caching subagent disattivato; miss su resume entro TTL) → la
  **telemetria non è opzionale**.
- **In uno spawner custom** (il **layer ai**, dove costruiremo l'orchestrazione vera) hai
  **controllo pieno**: assembli tu il contesto di ogni spawn (invariante in testa, niente
  scrollback del padre), **scegli il TTL**, **temporizzi** gli spawn. È qui che "l'orchestratrice,
  conoscendo la cadenza, tiene la cache calda" diventa pienamente realizzabile.
- **Provider-agnostico (§8 del doc cache):** P1–P3/P6 funzionano ovunque (l'unica leva su
  DeepSeek/OpenAI, automatici); **P4 richiede un provider che esponga il TTL** (Anthropic/Gemini
  espliciti). La disciplina è portabile; cambia solo quanta ne puoi *guidare*.

### 4.6 Misura (telemetria)
Per ogni spawn, una riga: `(agente, modello, ttl, in_pieno, cache_write, cache_read, out, gap,
id_task)`. Da cui: **hit rate per agente** (allarme < 80% su invariante grande), **costo per
unità di lavoro utile**, e l'**autopsia dei miss** — un ri-spawn dello stesso agente entro il TTL
con `cache_read=0` è un **difetto** (causa 1/2/3 del §3.2, o il bug di resume), non rumore.

## 5. La convergenza col seme (perché tutto questo non è un'aggiunta)
Il sistema agenti è **già cache-nativo per costruzione** (tesi §3.3 del doc cache): colpisce le
cache *perché è ordinato*, non perché qualcuno ha ottimizzato. In dettaglio:
- **Definizione agente + doc-compagno** = l'**invariante di ruolo** (P1/P2): stabile, in testa.
- **Confini che dialogano** ("se devi toccare, chiedi") = i **punti di escalation espliciti** del
  documento master (§5.2.3): *il modo sicuro di declassare il tier* — il giudizio si **perimetra**,
  non si azzera.
- **Harness deterministico** (brief, audit, validatori) = **P6** (contesto instradato) + **P7**
  (validatori a valle): la rete a costo zero che libera budget e permette modelli più piccoli sui
  ruoli vincolati.
- Quindi l'orchestratrice **non inventa**: rende **esplicita** la disciplina che il sistema già
  incarna, e aggiunge la **cadenza** (P4) al confine di spawn.

## 6. Chi fa cosa (il confine dell'orchestratrice)
- **Costituzione / orchestrazione** (`.claude/agents/*`, il router di `CLAUDE.md`, questa
  disciplina): **orchestratrice**, diretto.
- **Codice di corsia** (`app/`, `lib/`, `test/`, …): **delegato** all'agente di corsia.
- Modificare il file di un altro agente "per fare prima" è **sconfino**: la costituzione la fa
  l'orchestratrice *come orchestratrice*, non spawnando una corsia su un dominio che non è suo.

## Riferimenti
- La fisica: `docs/CACHE_COME_ARCHITETTURA.md` (P1–P8, matrice provider, KPI).
- I confini: `.claude/agents/README.md` → "Regole comuni" (catena di ratifica).
- Il router e i principi: `CLAUDE.md` + `seme/ARCHITETTURA.md`.

## In dubbio
Se una scelta tocca l'architettura del sistema agenti o un principio del seme/cache: **chiedi
all'umano**. E se stai per *fare tu* lavoro di corsia: **fermati e delega**.
