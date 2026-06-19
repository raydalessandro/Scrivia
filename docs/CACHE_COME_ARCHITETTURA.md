---
scope: documento-master interno EAR LAB
titolo: La cache come architettura
sottotitolo: Filosofia del design cache-nativo per sistemi AI a consumo
versione: 1.0 — 2026-06-11
autore: Ray (ideazione, tesi, intuizioni) + Claude Fable 5 (formalizzazione, fisica, numeri)
uso: riferimento permanente per progettare sistemi nuovi e fare retrofit di sistemi esistenti
        in vista del passaggio da abbonamento flat a consumo a token.
nota: i prezzi citati sono verificati a giugno 2026 (Anthropic) o indicati come da verificare.
        I MECCANISMI descritti cambiano lentamente; i LISTINI cambiano in fretta.
        Prima di fissare budget: ricontrollare i listini. La filosofia resta.
---

# LA CACHE COME ARCHITETTURA

> *Non si ottimizza la cache. Si ordina il sistema — e la cache ne è la conseguenza.*

---

## 0. A cosa serve questo documento

Questo documento fissa una filosofia di progettazione, non una tecnica di risparmio. La tecnica (dove mettere un campo `cache_control`, quale TTL scegliere) occupa poche righe e cambierà con i listini. La filosofia — **come si struttura un sistema perché il suo costo coincida con il suo costo reale e non con il suo spreco** — è stabile, perché poggia sulla fisica dell'inferenza e non sulle decisioni commerciali dei provider.

Va usato in due momenti:

1. **In fase di ideazione** di un sistema nuovo: i principi del capitolo 4 sono vincoli di progetto, da rispettare dal primo schema, non da applicare dopo.
2. **In fase di retrofit** di un sistema esistente: il capitolo 7 è la checklist diagnostica e l'ordine degli interventi.

Il contesto strategico: l'industria sta passando dagli abbonamenti flat al consumo a token. Per chi costruisce sistemi come i nostri — pipeline strutturate, invarianti forti, output controllato — questo passaggio non è una minaccia ma un vantaggio competitivo, *a condizione di arrivarci già progettati*. Questo documento è il progetto.

---

## 1. La transizione: dal flat al token

### 1.1 Perché il flat muore

Un abbonamento flat è una scommessa del provider: l'utente medio consumerà meno di quanto paga. Con i modelli attuali — grandi, con ragionamento esteso, usati dentro flussi agentici che macinano contesto — la scommessa è persa. Il costo marginale di servire un utente intensivo supera il prezzo dell'abbonamento di multipli interi. I provider possono reagire in due soli modi: limitare (i tetti orari che già conosciamo) o riprezzare a consumo. Stanno facendo entrambe le cose, nell'ordine.

### 1.2 Cosa cambia per chi costruisce

Il consumo a token sposta il rischio dal provider all'utente. Per la massa degli utenti questo significa pagare di più: pagheranno il proprio spreco — contesti rifatti da zero a ogni chiamata, esplorazioni ridondanti, output non controllato. Per una minoranza significa pagare di meno, o meglio: **pagare il costo vero**. La differenza tra le due popolazioni non è il volume d'uso. È l'architettura dei sistemi con cui usano i modelli.

La tesi economica di fondo di questo documento:

> **A parità di output, un sistema ben fattorizzato su un modello di fascia alta costa meno di un sistema naïve su un modello di fascia media — e produce qualità che il modello medio non raggiunge a nessun prezzo.**

I numeri che la sostengono sono nel capitolo 9. Il meccanismo che la rende possibile è la cache. La proprietà architetturale che rende possibile la cache è l'oggetto dei capitoli 3 e 4.

### 1.3 La finestra

Finché il flat esiste, il flat è il laboratorio: si lavora con i modelli migliori a costo fisso e si producono gli *invarianti di progetto* (documenti master, canoni, architetture — cap. 5) che renderanno economica l'epoca successiva. Questo stesso documento è un prodotto della finestra.

---

## 2. La fisica del costo

Per fidarsi di una strategia economica bisogna sapere se i prezzi su cui poggia sono decisioni commerciali (revocabili) o riflessi di costi reali (stabili). I prezzi della cache sono la seconda cosa.

### 2.1 Prefill e decode

Una chiamata di inferenza ha due fasi con economie radicalmente diverse:

- **Prefill** — il modello legge l'input. È parallelizzabile: tutti i token del prompt vengono processati insieme. Durante il prefill il modello costruisce, per ogni token, le rappresentazioni interne (key e value di ogni layer di attenzione) che serviranno alla generazione. Questo insieme di rappresentazioni si chiama **KV cache**.
- **Decode** — il modello genera l'output, un token alla volta, sequenzialmente. Ogni token generato richiede un passaggio completo che consulta la KV cache di tutto ciò che precede. Non è parallelizzabile sul singolo flusso.

Da qui le due asimmetrie di prezzo che governano tutto:

1. **L'output costa ~5× l'input** su tutti i tier attuali, perché il decode è sequenziale e occupa l'hardware molto più a lungo per token.
2. **Un prefisso già processato costa quasi zero da riusare**: se due richieste iniziano con gli stessi identici byte, la KV cache della prima è valida per la seconda. Il provider non ricomputa nulla — recupera dalla memoria. Il prezzo di cache read a **0,1× dell'input base** non è uno sconto promozionale: è il costo vero di storage e lookup, con margine.

### 2.2 Perché questo rende la filosofia durevole

Se il read a 0,1× fosse marketing, costruire un'intera filosofia di design sopra di esso sarebbe fragile. Ma è fisica: il provider che fa pagare il prefisso cached a prezzo pieno sta vendendo lavoro che non fa, e prima o poi un concorrente glielo fa notare nel listino. Infatti la convergenza è già avvenuta: DeepSeek serve cache automatica dal 2024 con hit a circa un decimo del prezzo input (verificato empiricamente sui nostri sistemi: Teatro Narrativo, 70–80% di hit rate senza una riga di gestione), OpenAI applica sconto automatico sul prefisso sopra una soglia minima, Anthropic ha aggiunto la modalità automatica accanto ai breakpoint espliciti. I dettagli divergono (cap. 8); la direzione è una sola.

**Conclusione del capitolo:** progettare cache-nativo significa allineare l'architettura del *proprio* sistema all'architettura del *modello*. Chi è allineato paga il costo reale dell'inferenza. Chi non lo è paga, in più, il costo della propria entropia.

### 2.3 Listino di riferimento (Anthropic, giugno 2026)

| Voce | Multiplo su input base | Haiku 4.5 | Sonnet 4.6 | Opus 4.8 |
|---|---|---|---|---|
| Input | 1× | $1,00 /M | $3,00 /M | $5,00 /M |
| Output | 5× | $5,00 /M | $15,00 /M | $25,00 /M |
| Cache write 5 min | 1,25× | $1,25 /M | $3,75 /M | $6,25 /M |
| Cache write 1 h | 2× | $2,00 /M | $6,00 /M | $10,00 /M |
| **Cache read** | **0,1×** | **$0,10 /M** | **$0,30 /M** | **$0,50 /M** |
| Batch API | 0,5× su tutto | — | — | — |

Batch e cache si cumulano. Ogni read rinfresca il TTL del blocco a costo zero. Avvertenza Opus: il tokenizer della generazione 4.7+ può produrre fino a ~35% token in più a parità di testo — pesa nei confronti tra tier.

---

## 3. La tesi: il contesto come struttura

### 3.1 Invariante e variante

Ogni interazione di un sistema con un modello si può scrivere come:

```
output = Modello( I , v )
```

dove:

- **I — l'invariante**: la parte del contesto stabile su un'intera classe di interazioni. Il canone. Lo schema. I vincoli. L'identità del ruolo. La voce. Le convenzioni del mondo. Le definizioni dei tool.
- **v — la variante**: la posizione del momento dentro la struttura. Lo stato. La pagina che stiamo scrivendo. L'entità che stiamo compilando. L'ultimo turno della conversazione.

La tesi centrale, nella formulazione che la genera:

> *L'input è strutturalmente sempre la stessa cosa, con le sue varianti e sfumature; e le varianti danno la posizione nella struttura. Le cache non si colpiscono perché si ripetono informazioni, ma perché il modo in cui l'informazione è data lo rende possibile.*

Detto in forma di principio: **un sistema ben progettato non ripete — colloca.** Ogni richiesta dice al modello *dove siamo* dentro una struttura che il modello ha già letto e che giace, già pagata, in cache. Il costo marginale di ogni interazione tende al costo della sola variante più l'output.

### 3.2 Il cache hit rate come misura dell'ordine

Da qui il rovesciamento diagnostico, che è la parte più importante della tesi:

> **Il cache hit rate è la misura economica dell'ordine architetturale di un sistema.**

Un hit rate alto non si "ottiene": si *eredita* da un sistema in cui il confine tra invariante e variante è netto, l'invariante è stabile byte per byte, e sta dove la macchina può riconoscerla (in testa). Un hit rate basso non è un problema di costi da mitigare: è un **sintomo** da diagnosticare. Le cause possibili sono finite, ed è sempre una di queste quattro:

1. **Invariante instabile** — qualcosa che dovrebbe essere fisso cambia tra le chiamate (timestamp, ID di run, contatori, generazione non deterministica del contesto).
2. **Confine sporco** — contenuto variabile mescolato dentro il blocco stabile, o contenuto stabile sparso dentro il flusso variabile.
3. **Ordine sbagliato** — l'invariante c'è ed è stabile, ma non è un *prefisso*: la cache dei modelli è una cache a prefisso, e contenuto condiviso non-in-testa vale zero.
4. **Ritmo sbagliato** — il TTL scelto non corrisponde alla cadenza reale degli accessi (principio P4).

Caso reale, misurato: i writing brief della saga Isola condividono ~66% delle righe tra storie diverse — ma quel contenuto comune è sparso in mezzo al documento. Ai fini della cache cross-storia, oggi vale zero. Diagnosi: causa 3. Cura: riordino, non riscrittura.

### 3.3 La conferma empirica che la struttura precede il codice

Teatro Narrativo girava su DeepSeek con il 70–80% di cache hit **senza che il codice gestisse alcunché**: il provider era ad attivazione automatica, e i prompt del sistema erano — per come erano stati pensati, non per come erano stati ottimizzati — già fattorizzati in ruoli stabili più stato del momento. Questo è il dato che fonda la fiducia nella tesi: i nostri sistemi colpiscono le cache *perché sono ordinati*, non perché qualcuno ha ottimizzato le cache. Il lavoro che resta da fare non è imparare una tecnica nuova: è rendere esplicito, sistematico e misurato un ordine che già pratichiamo per istinto architetturale.

---

## 4. I sette principi del design cache-nativo

Ogni principio: enunciato, ragione, pratica, errore tipico.

---

### P1 — Separare l'invariante dalla variante (fattorizzazione del contesto)

**Enunciato.** Prima di scrivere una riga di sistema, dividere il contesto di ogni ruolo in: (a) ciò che è identico per tutta la classe di interazioni — l'invariante; (b) ciò che identifica la singola interazione — la variante. Massimizzare (a), minimizzare (b), rendere il confine netto e dichiarato.

**Ragione.** È il principio generatore: tutti gli altri lo servono. La cache paga solo l'invariante; quindi ogni token spostabile dalla variante all'invariante è un token che passa da prezzo pieno a 0,1×.

**Pratica.**
- Per ogni ruolo del sistema, scrivere esplicitamente la *firma*: `ruolo(I: …, v: …) → output`. Se non si riesce a scrivere la firma, il ruolo non è ancora capito.
- Regola del break-even per i casi dubbi: un blocco che *sarebbe ripetuto* conviene nell'invariante già dal **secondo utilizzo** nella finestra di cache (costo dentro: 1,25× + n·0,1×; costo fuori: n·1×; pareggio a n ≈ 1,4). Con read a 0,1×, conviene un invariante *generoso* — anche ridondante per la singola interazione — se è riusato.
- L'invariante include le **definizioni dei tool**: fanno parte del prefisso. Tool che cambiano tra chiamate invalidano tutto ciò che segue.

**Errore tipico.** Trattare la fattorizzazione come ottimizzazione tardiva ("prima facciamo funzionare, poi sistemiamo i prompt"). Il confine invariante/variante è una decisione architetturale: dopo, costa un refactor; prima, costa zero.

---

### P2 — Il prefisso è un contratto (byte-exact, deterministico, stabile→variabile)

**Enunciato.** L'invariante va servita come **prefisso byte-identico** a ogni chiamata: stessi byte, stesso ordine, nessun elemento dinamico. Struttura canonica della richiesta: `tools → system (invariante) → messages (variante)`.

**Ragione.** La cache dei modelli è una cache a prefisso con confronto esatto: un byte diverso in posizione k invalida tutto da k in poi. Non esiste "quasi uguale".

**Pratica.**
- **Determinismo della generazione**: gli script che assemblano il contesto devono produrre output byte-stabile a parità di input. I nostri script idempotenti (brieffer, travasi) già lo garantiscono — è un vantaggio strutturale da proteggere come requisito esplicito: *l'idempotenza degli script è la precondizione della cacheability del sistema*.
- **Niente tempo nel prefisso**: date, timestamp, contatori di run, ID di sessione vanno in coda (nella variante) o eliminati.
- **Ordinamenti canonici**: liste e mappe serializzate nell'invariante vanno emesse in ordine deterministico (alfabetico, per ID) — un dict serializzato in ordine d'inserimento è una mina.
- **Versionare l'invariante**: quando il canone cambia davvero (nuova versione della Bible, dello schema), il miss è legittimo e va *fatto di proposito*, con un bump di versione tracciato. Miss legittimi e miss patologici devono essere distinguibili nei log.

**Errore tipico.** Il timestamp "innocuo" nell'intestazione del system prompt. Costo reale: il 100% dell'invariante ripagato a prezzo pieno a ogni chiamata, per sempre, in silenzio.

---

### P3 — Lo stato è append-only (mai riscrivere la storia)

**Enunciato.** Dentro una sessione, lo stato cresce solo in coda. Non si riordina, non si riassume a metà, non si modifica un messaggio passato.

**Ragione.** In una conversazione multi-turn la cache lavora in modo incrementale: ogni turno il prefisso valido si estende all'ultimo blocco cached, e si paga solo il delta. Qualsiasi riscrittura a monte — anche migliorativa — invalida tutto ciò che segue il punto modificato.

**Pratica.**
- Correzioni e ripensamenti si esprimono come *nuovi* messaggi ("la pagina 4 va riscritta così"), non come modifiche ai vecchi.
- La compattazione del contesto (riassumere una sessione lunga) è un'operazione di **confine**: si fa tra una sessione e l'altra, mai dentro — e produce un nuovo invariante versionato per la sessione successiva.
- Se il sistema ha bisogno di "stato corrente" sintetico che cambia spesso (es. lo stato del mondo a metà saga), quello è variante: va dopo l'invariante, vicino alla coda, dove il suo cambiare invalida poco.

**Errore tipico.** Il "miglioriamo il system prompt al volo" a metà sessione: ogni ritocco azzera la cache dell'intera conversazione accumulata.

---

### P4 — Il TTL segue il ritmo (il tempo è parte dell'architettura)

**Enunciato.** Il TTL non si sceglie sulla durata della sessione, ma sul **gap massimo atteso tra due accessi consecutivi** allo stesso prefisso. Ogni hit rinnova il TTL a costo zero: una cache colpita più spesso del suo TTL vive indefinitamente al costo del primo write.

**Ragione.** È l'asimmetria temporale del pricing: write 5 min = 1,25×, write 1 h = 2×, read = 0,1× con refresh gratuito. La variabile decisiva non è "quanto lavoro" ma "quanto è lungo il buco più lungo".

**Pratica — la regola dei due ritmi.**
- **Ritmo macchina** (pipeline, batch, agenti che si chiamano in sequenza, cadenza controllata < 5'): **TTL 5 min, sempre.** Trenta input in un'ora a uno ogni due minuti = un solo write a 1,25× e ventinove read. Pagare 2× qui è spreco puro.
- **Ritmo umano nel loop** (review, scrittura collaborativa, gap di riflessione imprevedibili): **TTL 1 h.** Il break-even è immediato: costo atteso con 5 min = 1,25×·(1 + M) dove M è il numero di gap >5' nella sessione; costo con 1 h = 2×. Conviene 1 h appena M > 0,6 — cioè **basta un solo gap atteso**. E nelle sessioni con review umana, un gap da otto minuti di riflessione non è l'eccezione: è il lavoro.
- **TTL misti nella stessa richiesta** (raffinamento): l'invariante di saga (riusata su più storie nella giornata) a 1 h; il blocco-storia a 5 min se i turni dentro la storia sono fitti. Il pricing gestisce i breakpoint a TTL diverso per posizione.
- **Nota sul keep-alive** (avanzato, di solito da evitare): tenere viva una cache 5 min con ping artificiali costa 0,1× del prefisso a ping; conviene rispetto al write 1 h solo sotto ~7 ping (≈ mezz'ora coperta). Complessità operativa alta, beneficio piccolo: la regola dei due ritmi copre il 95% dei casi.

**Errore tipico.** Scegliere 1 h "per sicurezza" su flussi a ritmo macchina (si paga 2× senza motivo), o 5 min "per risparmio" su flussi con review umana (si ripaga il write a ogni pausa caffè — il killer silenzioso, invisibile finché non si loggano i miss).

---

### P5 — L'output è l'unico costo incomprimibile: frazionarlo e controllarlo

**Enunciato.** L'output non si cacha mai e costa 5× l'input. È l'unica voce che nessuna architettura comprime. Quindi: l'output si controlla *by design* — frazionato, mirato, mai rigenerato per intero quando basta un delta.

**Ragione.** Quando la cache porta l'input effettivo a ~0,1×, la composizione del costo si rovescia: in un sistema cache-nativo input-heavy, l'output diventa la voce dominante del costo marginale. Ogni token generato in più pesa, in proporzione, cinquanta volte un token di invariante riusato.

**Pratica.**
- **Il pagina-per-pagina non è solo qualità: è un principio economico.** Generare a unità piccole con review intermedia evita la rigenerazione di interi blocchi quando la correzione riguarda una frase.
- **Correzioni come delta**: "riscrivi il paragrafo 3" e non "riscrivi la pagina". Il sistema deve rendere *indirizzabile* l'output (marker, ID di pagina, ancore) proprio per permettere correzioni puntuali.
- **Vietare il one-shot lungo** anche quando il modello lo consentirebbe: un output da 5.000 parole sbagliato al 10% costa una rigenerazione da 5.000 parole; dieci output da 500 sbagliati al 10% costano una rigenerazione da 500.
- Nei ruoli estrattivi, **schema d'output minimale**: ogni campo decorativo nel YAML/JSON di risposta è output pagato 5× per niente.

**Errore tipico.** Misurare il sistema solo sull'input ("abbiamo il 95% di hit!") mentre l'output cresce non controllato. Il KPI giusto è il costo per unità di output utile (cap. 10), non l'hit rate da solo.

---

### P6 — Routing diretto dell'informazione (abbattere il costo di navigazione)

**Enunciato.** Oltre al costo di *ri-lettura* (che la cache abbatte) esiste il costo di *ricerca*: i token che un sistema agentico spende per trovare l'informazione che gli serve. Un sistema cache-nativo lo minimizza alla fonte: ogni ruolo riceve un contesto **autosufficiente e instradato**, in cui l'informazione necessaria è già al suo posto.

**Ragione — il meccanismo preciso.** In una singola chiamata, il modello non "rilegge" il contesto a pagamento: l'input si paga una volta. Il costo di navigazione emerge nei sistemi **agentici**, attraverso due canali:
1. **Tool call di esplorazione**: ogni ricerca nei file, ogni fetch, ogni grep è un round-trip che genera output (la chiamata) e riaccumula input (il risultato). Un agente che esplora una repo per orientarsi brucia decine di migliaia di token prima di produrre valore.
2. **Token di ragionamento**: i modelli grandi, davanti a contesto ambiguo o incompleto, *ragionano di più* — e il ragionamento esteso è fatturato come output. Il modello grosso, se dubita, cerca; il modello piccolo inventa. La qualità superiore del grande ha questo prezzo: lo scrupolo. **Un contesto non ambiguo è il modo di avere la qualità del modello grande senza pagarne lo scrupolo.**

**Pratica.**
- **Il brief autosufficiente è l'anti-esplorazione**: l'agente prosa della saga riceve in un solo documento tutto ciò che serve (canone, cast, vincoli, hook, stato del mondo) e non esegue *mai* una ricerca. Zero tool call di orientamento, zero dubbi da risolvere, ragionamento speso solo sulla scrittura. Questo pattern — *l'estrazione deterministica a costo zero prepara il contesto perfetto per la chiamata a costo pieno* — è il cuore operativo dei nostri sistemi e va replicato per ogni ruolo.
- **Contesto chirurgico per costruzione**: mai dare a un ruolo l'accesso a "tutto il grafo" sperando che peschi bene; uno script estrae la sezione esatta. Ciò che lo script può instradare, l'agente non deve cercare.
- Quando l'esplorazione è il compito stesso (ruoli di manutenzione su codebase), il principio diventa: **strutturare la repo perché la ricerca converga in fretta** — README di orientamento, naming deterministico, mappe machine-readable. La navigabilità della repo è una voce di costo.

**Errore tipico.** Confondere "il modello ce la fa anche da solo" con "conviene che faccia da solo". Ce la fa: esplorando. L'esplorazione si paga a 5× (output delle call) più il contesto riaccumulato. Il routing fatto da uno script costa zero.

---

### P7 — Validatori deterministici a valle (la rete che libera il budget)

**Enunciato.** Ogni controllo esprimibile come regola va implementato come script, non delegato al modello. I validatori a valle hanno tre effetti economici: catturano gli errori a costo zero, permettono di testare modelli più piccoli sui ruoli vincolati (l'errore non passa: si ripaga solo il retry), e liberano budget per tenere i modelli top dove il giudizio non è sostituibile.

**Ragione.** Il modello è la risorsa costosa e fallibile; lo script è gratuito e infallibile nel suo dominio. Ogni regola spostata dal prompt allo script è: token d'invariante in meno, un controllo che non degrada, e un grado di libertà in più nel routing dei modelli.

**Pratica.**
- Pattern consolidato nei nostri sistemi: estrazione/generazione (LLM) → validazione meccanica (script, N controlli) → review umana dove il compito è autoriale. La spina dorsale a costo zero — audit, validatori, brieffer, travasi — *è* la condizione che rende sicuro ogni risparmio a monte.
- Regola di routing derivata: **un ruolo può scendere di tier solo se esiste un validatore deterministico a valle oppure una review umana già obbligatoria** (idealmente entrambi). Senza rete, il tier non si tocca.
- Misurare il tasso di retry quando si declassa: se il modello piccolo richiede più di ~1 retry su 3 run, il risparmio è falso (e la review umana si sta caricando lavoro nascosto — costo reale, non monetario).

**Errore tipico.** Mettere le regole nel prompt *e basta* ("non usare mai X, rispetta sempre Y") e fidarsi. Le regole nel prompt costano token a ogni chiamata e degradano sotto pressione di contesto; le regole nello script costano zero e non degradano mai.

---

## 5. L'ottavo principio: la cache di progetto

> *Il documento master è una cache: il write si fa col modello migliore, i read con quello che basta.*

### 5.1 La simmetria

Tutto ciò che vale per il contesto di una chiamata vale, una scala sopra, per il ciclo di vita di un progetto:

| Livello chiamata | Livello progetto |
|---|---|
| Invariante nel prefisso | Documento master / canone di progetto |
| Cache write (1,25–2×, una volta) | Sessione di ideazione col modello top |
| Cache read (0,1×, ripetibile) | Implementazioni successive col modello medio |
| Miss per prefisso instabile | Roadmap ambigua che richiede re-interpretazione |
| TTL | Validità del documento (finché il progetto non cambia versione) |

La sessione di progettazione con il modello di punta è costosa e si fa **una volta, bene**: produce un invariante di progetto così completo che il ragionamento non deve essere rifatto. Ogni sessione di implementazione successiva è un read: un modello di fascia media esegue, perché il giudizio è già stato esercitato e *scritto*.

### 5.2 Requisiti del documento master (cosa rende un write valido)

Una roadmap che richiede ancora interpretazione non è una cache: è un puntatore a un ragionamento mai scritto, e costringerà a richiamare il modello top (o peggio: lascerà il modello medio a improvvisare). Il documento master è un write valido se ha:

1. **Compiti atomici** — ogni task con input definiti, output definiti, e nessuna dipendenza implicita ("sistemare il modulo X" non è un task; "aggiungere al modulo X la funzione f con firma s, che dato a produce b, testata dai casi c1–c3" lo è).
2. **Criteri di accettazione verificabili** — idealmente meccanici (test, audit, diff attesi), così la verifica non richiede giudizio.
3. **Punti di escalation espliciti** — l'elenco dei "fermati e chiedi se…": le condizioni in cui il modello esecutore NON deve decidere da solo. È il modo sicuro di declassare il tier: il residuo di giudizio non si azzera mai, ma si può *perimetrare*. Senza questo elenco, il modello medio davanti all'imprevisto inventa — esattamente come fa col contesto ambiguo (P6).
4. **Contesto incluso, non referenziato** — il documento porta con sé (o instrada con path esatti) tutto ciò che serve; "vedi le discussioni precedenti" è un miss garantito.
5. **Decisioni motivate** — non per cerimonia: la motivazione è ciò che permette al modello esecutore di riconoscere quando una situazione nuova *ricade* o *non ricade* nella decisione presa.

### 5.3 La pratica della finestra

Strategia operativa del periodo attuale (flat ancora disponibile sui modelli top): usare le sessioni col modello di punta esclusivamente per produrre write di progetto — architetture, canoni, documenti master, questo documento. Mai sprecare il modello top in read (esecuzioni che un medio farebbe uguale, guidato da un buon master). Quando il flat finirà, il portafoglio di invarianti di progetto accumulato sarà il capitale che rende economica l'epoca a token.

---

## 6. Anatomia di due sistemi (casi reali, numeri misurati)

### 6.1 Isola dei Tre Venti — il sistema cache-nativo per costruzione

Il sistema mostra tutti i principi in azione, e un difetto correggibile che illustra la diagnosi.

**La firma del ruolo prosa:** `prosa(I: skill + brief sNN, v: conversazione pagina-per-pagina) → storia con marker`.

- Invariante: ~35.000 token (skill ~2,6k + brief medio 21,5k parole). Stabile per tutta la sessione di scrittura di una storia.
- Variante: i turni (pagina proposta, review, correzione) — ~500 token a turno, ~25 turni a storia (13,7 pagine medie + revisioni).
- Output: ~6.000 token a storia (bozze + finale), già frazionato per costruzione (P5).

**I numeri della cache (Sonnet 4.6, per storia):**

| Configurazione | Input pagato | Costo storia |
|---|---|---|
| Naïve (no cache) | ~1,04M token a prezzo pieno | ~$3,20 |
| Cache 5 min (gap di review > 5': write ripagati) | misto, instabile | ~$1,20–2,00 |
| **Cache 1 h (P4: umano nel loop)** | 1 write + read incrementali | **~$0,60** |

Su Opus 4.8: ~$1,00–1,30 a regime cached (tokenizer incluso). La differenza tra modello medio e modello top, a regime, è ~40 centesimi a storia: *la cache comprime esattamente la parte di costo dove i tier si distanziano* — ed è questo che rende sostenibile lavorare sempre col modello migliore (tesi §1.2).

**Il difetto diagnosticato (causa 3 — ordine sbagliato):** i brief condividono ~66% delle righe tra storie (vincoli universali, pattern banditi, formula del ritornello, cornici), ma il contenuto comune è sparso in mezzo al documento. Cache cross-storia: zero. **Cura:** il brieffer emette due blocchi — Blocco A (invariante di saga, byte-identico per tutte le 12 storie, in testa) + Blocco B (invariante di storia: core, narrazione, hook, cast, echi, quote tracker). Due breakpoint: A resta caldo tra storie e tra riprese nella stessa giornata di lavoro (TTL 1 h); B si scrive una volta per storia. Valore: ~$1/saga in risparmio diretto, più la robustezza a ogni ripresa di sessione — si fa perché è il design giusto, non per la cifra. **Vincolo di test:** il riordino cambia ciò che l'agente legge per primo; va verificato che la prosa non cambi (test di Ray).

**La spina dorsale (P7):** brieffer, validatore hook (16 controlli), audit 1–5, travasi — tutto deterministico, costo zero. È la rete che rende sicuro ogni esperimento di routing a monte e che produce, per ogni ruolo, il contesto instradato di P6.

### 6.2 Teatro Narrativo — la conferma involontaria

Sistema multi-agente di generazione narrativa, costruito su DeepSeek (cache automatica, nessuna gestione nel codice): **70–80% di hit rate misurato**. Nessuno ha ottimizzato nulla: i prompt erano fattorizzati per natura — ruoli stabili (l'identità di ogni attore, le regole della scena) più stato del momento (gli ultimi 8 messaggi della chat di scena, lo stato Σ). 

Lezione del caso: **l'ordine architetturale produce cache hit anche dove nessuno li cerca.** E il suo inverso: il 20–30% di miss residuo di Teatro è oggi diagnosticabile con la tabella del §3.2 — quasi certamente un misto di causa 2 (il contesto-chat ricostruito a finestra scorrevole: gli "ultimi 8 messaggi" cambiano il prefisso a ogni turno — un caso da ristrutturare append-only, P3) e causa 1. Un retrofit da mezzo intervento, quando il sistema tornerà attivo.

---

## 7. Retrofit: applicare la filosofia a un sistema esistente

Procedura in due fasi: prima diagnosi (misurare, non intuire), poi interventi in ordine di impatto.

### 7.1 Diagnosi (un pomeriggio)

1. **Logga 10 run reali** del sistema con telemetria minima: per ogni chiamata `(ruolo, modello, token_in, token_cache_read, token_cache_write, token_out, timestamp)`.
2. **Calcola per ruolo**: hit rate effettivo, rapporto in:out, costo per unità di output.
3. **Byte-diff dei prefissi**: prendi due chiamate "uguali" dello stesso ruolo e fai il diff dei prompt completi. Ogni differenza trovata è una causa-1 o causa-2 con nome e cognome (il timestamp, l'ID, il dict non ordinato).
4. **Mappa di riuso**: per ogni blocco di contesto, con che frequenza ricompare identico? (Il dato "66% condiviso ma sparso" della saga è uscito da un `sort | comm` tra due brief: dieci minuti.)
5. **Istogramma dei gap temporali** tra chiamate consecutive per ruolo: rivela subito il ritmo (macchina o umano) e quindi il TTL giusto.

### 7.2 Interventi, in ordine di impatto

1. **Attiva la cache** (se API Anthropic: il campo automatico come base, breakpoint espliciti dove serve controllo). Senza questo passo, tutto il resto è teoria.
2. **Bonifica il prefisso** (P2): elimina/sposta in coda ogni elemento dinamico; rendi deterministica la generazione del contesto; ordina le serializzazioni.
3. **Riordina** (P1+P2): invariante in testa, variante in coda, confine netto. Se l'invariante è condivisa tra più unità di lavoro (storie, entità, clienti), gerarchizza: invariante di sistema → invariante di unità → variante.
4. **Allinea il TTL al ritmo** (P4): dall'istogramma dei gap, non dall'istinto.
5. **Rendi lo stato append-only** (P3): caccia le finestre scorrevoli e le riscritture a metà sessione; la compattazione solo ai confini di sessione, versionata.
6. **Fraziona l'output** (P5): unità piccole, indirizzabili, correzioni a delta.
7. **Sposta regole dai prompt agli script** (P7) e **instrada il contesto con estrattori** (P6): ogni regola meccanizzata e ogni ricerca evitata è risparmio permanente.
8. **Ri-misura** (le stesse metriche del §7.1) e confronta. Senza il prima/dopo, il retrofit non è finito.

Anti-regola: non esiste l'implementazione universale. La diagnosi dice *quale* dei sette principi è violato in *questo* sistema; si interviene su quello. Un sistema può avere hit rate 80% e un solo difetto da causa-4 che vale metà della bolletta.

---

## 8. La matrice dei provider

I **meccanismi** (colonne 2–4) cambiano lentamente e sono la parte affidabile; i **listini** vanno riverificati prima di ogni budget. Stato a giugno 2026:

| Provider | Attivazione | Controllo TTL | Pricing cache (indicativo) | Nota operativa |
|---|---|---|---|---|
| **Anthropic** | Opt-in: automatica (1 campo, breakpoint gestiti) o esplicita (breakpoint per blocco) | Sì: 5 min (1,25×) / 1 h (2×), mix possibile | Read 0,1× | Massimo controllo. La modalità esplicita è superiore quando contenuto dinamico convive con stabile; P2 e P4 si applicano in pieno |
| **DeepSeek** | Automatica totale, zero codice | No (gestito dal provider) | Hit ~0,1× input (storico) | Verificato sui nostri sistemi (Teatro, 70–80%). Niente leve manuali: conta solo la struttura del prompt — i principi P1–P3 sono l'unica leva |
| **OpenAI** | Automatica sopra soglia minima di prefisso | No | Sconto automatico sul prefisso (storicamente ~50% — verificare) | Stesso discorso: nessun controllo, sola struttura |
| **Google (Gemini)** | Implicita (automatica) + esplicita (context caching con oggetto cache gestito) | Esplicita: sì, a tempo gestito | Variabile per modalità — verificare | La modalità esplicita è un paradigma diverso (cache come risorsa creata/distrutta via API) |

**La conseguenza strategica della matrice:** i principi P1–P6 sono *provider-agnostici* — funzionano identici ovunque, perché agiscono sulla struttura del prompt, che è l'unica leva universale. Solo P4 (TTL) richiede un provider che lo esponga. Un sistema progettato secondo questo documento è portabile tra provider senza perdere la sua economia: la filosofia sta nel sistema, non nel vendor.

---

## 9. Economia comparata: dove la tesi vale (e dove no)

La tesi §1.2 — *modello top ben fattorizzato < modello medio naïve, a qualità superiore* — non è universale: dipende dal **profilo input:output** del sistema. Onestà sui confini:

| Profilo | Esempio | in:out tipico | La cache domina? | Verdetto |
|---|---|---|---|---|
| **Input-heavy multi-turn** | Prosa su brief; review di documenti; agenti su codebase con contesto stabile | 50:1 – 200:1 | Sì, totalmente | **La tesi vale in pieno.** Il top model cached costa come (o meno di) un medio naïve |
| **Estrattivo ripetuto** | Hook, schede, classificazioni su canone condiviso | 10:1 – 30:1 | Sì (invariante grande, varianti piccole) | La tesi vale; in più qui spesso basta il tier piccolo (P7) — doppio risparmio |
| **One-shot freddo** | Chiamate singole senza riuso di contesto | qualsiasi | No (niente da riusare) | La cache non aiuta; conta solo il tier e il batch |
| **Output-heavy** | Generazione massiva di testo lungo senza loop di review | 1:5 – 1:20 | No (l'output non si cacha) | **La tesi NON vale**: il costo è dominato dal decode, il tier pesa per intero. Qui o si fraziona (P5, trasformandolo in multi-turn) o si accetta il costo |

Numeri di sintesi sul profilo che ci riguarda (input-heavy, dal caso Isola): saga completa ~$130–145 in configurazione naïve contro ~$15–25 in configurazione cache-nativa con routing — fattore 5–8×, a output identico, col modello top tenuto esattamente dove fa la differenza.

E il punto qualitativo che chiude la tesi: a regime cached, il sovrapprezzo del modello top sul medio si riduce al sovrapprezzo sull'output e sui write — nei nostri profili, **centesimi per unità di lavoro**. A quel prezzo, la domanda "posso permettermi il modello migliore?" si rovescia: *non posso permettermi i suoi errori in meno?* La qualità del modello grande — meno retry, meno review caricata sull'umano, meno inventato — è essa stessa una voce economica, solo non fatturata.

---

## 10. KPI e telemetria: cosa misurare, sempre

Senza misura la filosofia degrada a opinione. Strumentazione minima permanente (un wrapper sulle chiamate, una riga di log):

```
(ruolo, modello, ttl, token_in_pieno, token_cache_write, token_cache_read,
 token_out, timestamp, id_unità_di_lavoro)
```

Da cui, per ruolo:

1. **Hit rate effettivo** = cache_read / (cache_read + in_pieno + cache_write). Il KPI architetturale (§3.2). Soglia d'allarme: sotto l'80% su ruoli a invariante grande, aprire la diagnosi delle quattro cause.
2. **Costo per unità di output utile** (€/storia, €/scheda, €/intervento). Il KPI economico vero: l'hit rate da solo può mentire (P5, errore tipico).
3. **Rapporto in:out** per ruolo: dice in quale riga della tabella del cap. 9 vive il ruolo, e quindi quale leva usare.
4. **Autopsia dei miss**: ogni miss su prefisso che doveva essere stabile ha una causa tra le quattro del §3.2 — trovarla, nominarla nel log, correggerla. I miss *legittimi* (bump di versione dell'invariante) vanno marcati come tali: il rumore dei miss legittimi non deve coprire il segnale di quelli patologici.
5. **Tasso di retry per tier** (quando si declassa un ruolo, P7): >1 retry su 3 run = risparmio falso, tornare su.
6. **Gap temporali per ruolo** (istogramma): la verifica continua che il TTL scelto sia ancora quello giusto — i ritmi dei sistemi cambiano quando cambiano le abitudini di chi li usa.

---

## Appendice A — Formule di break-even

Notazione: B = dimensione del blocco in token; prezzi come multipli dell'input base del modello.

1. **Conviene 1 h vs 5 min?** Costo(5m) = 1,25·B·(1+M), con M = gap >5' attesi nella finestra di lavoro. Costo(1h) = 2·B (gap >1 h ≈ 0 con uso). → **1 h conviene se M > 0,6: basta un gap atteso.**
2. **Conviene spostare un blocco nell'invariante?** Dentro: 1,25·B + n·0,1·B. Fuori (ripetuto): n·B. → **Conviene da n ≥ 1,4: dal secondo riuso nella finestra.** Con read a 0,1×, l'invariante generosa quasi sempre vince.
3. **Keep-alive su 5 min vs write 1 h?** Ping = 0,1·B l'uno. 1,25·B + p·0,1·B < 2·B → **p < 7,5 ping** (≈ 30–35 minuti coperti a ping ogni 4,5'). Oltre, o con gap imprevedibili: 1 h. In pratica: quasi mai ne vale la complessità.
4. **Soglia minima di cacheabilità**: i provider non cachano blocchi sotto ~1–2k token (varia per modello). I nostri invarianti tipici (15–35k) la superano di un ordine di grandezza; rilevante solo per micro-ruoli.

## Appendice B — Glossario minimo

- **Prefill / Decode**: lettura dell'input (parallela) / generazione dell'output (sequenziale). Le due fasi con economie diverse da cui discende tutto.
- **KV cache**: le rappresentazioni interne (key/value d'attenzione) calcolate nel prefill; ciò che il provider riusa quando il prefisso coincide.
- **Cache a prefisso**: il riuso vale solo per la parte iniziale byte-identica della richiesta, nell'ordine tools → system → messages.
- **Breakpoint (`cache_control`)**: il marcatore che delimita fin dove il prefisso va cachato; fino a 4 per richiesta in modalità esplicita.
- **TTL**: vita della cache (5 min / 1 h), rinnovata gratis a ogni hit.
- **Invariante / Variante**: la fattorizzazione del contesto di un ruolo — struttura già pagata / posizione del momento (cap. 3).
- **Hit rate**: quota dell'input servita da cache; misura economica dell'ordine architetturale.
- **Cache di progetto**: il documento master come invariante di ciclo di vita — write con il modello top, read con il modello medio (cap. 5).

---

*Fine del documento. Versione 1.0 — da rivedere quando: (a) i listini cambiano in modo strutturale; (b) un provider introduce un meccanismo nuovo (cache persistenti lunghe, cache condivise cross-org); (c) la prima campagna di telemetria sui nostri sistemi produce numeri che correggono le stime dei capitoli 6 e 9.*
