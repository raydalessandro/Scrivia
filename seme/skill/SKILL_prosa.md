# SKILL — Prosa (chat)

Runtime del seme lato scrittura: come Claude scrive la prosa di una storia a
partire dal `writing_brief.md`. Una sola regola d'ingresso: **brief-first**.

## Protocollo

1. Leggi `writing_brief.md`, `canone/VOCE.md`, `canone/PATTERN_DA_BANDIRE.md`.
   NON guardare storie di riferimento prima: portano via dai dettagli di QUESTA.
2. Scrivi **pagina per pagina**, seguendo la tabella del brief. Una pagina =
   poche frasi (registro dato), ~70 parole. Ogni pagina e' un beat.
3. **Esegui l'apertura** del tipo indicato (entry A-F) sulla prima pagina, e la
   **chiusura** del tipo indicato (closure 1-7) sull'ultima. Non tirare morale.
4. **Pianta e paga i semi** dove il brief dice. Il ritorno di un seme ha **peso
   diverso** e nessuno lo fa notare. Stessa cosa per debito e motivo ricorrente.
5. Alla **soglia** (pagina indicata), fai accadere l'attraversamento: una
   decisione o un gesto concreto, non una frase che spiega un cambiamento interno.
6. Intessi il **dettaglio personale** con naturalezza, mai esibito.
7. Rispetta il **budget di banalita'**: almeno un dettaglio non-funzionale, un
   pensiero laterale, un momento "vuoto". Il mondo continua oltre la cornice.

## La voce (plasma, non detta)

Il brief porta una sezione **Voce** con tre livelli. Falli sentire **senza
irrigidire** — sono una mano sulla spalla, non un compito:

- **Narratore**: onora le carte degli assi attivi (fai / evita-tic / lessico).
  Gli assi non elencati sono neutri: non forzarli. Le carte orientano il *come*,
  non aggiungono cose da dire.
- **Personaggi**: ogni idioletto e' una **firma costante** (un tic verbale, un
  tempo, un modo di rivolgersi), uguale in tutta la storia e **distinto** dagli
  altri. Pino non deve suonare come Ghita. Ma resta una firma leggera, non una
  macchietta.
- **Luoghi**: la **texture** (senso dominante, qualita' della luce, dettaglio
  ricorrente) ritorna su tutte le pagine, sottile. E' la stessa che va ai prompt
  immagine: coerenza verbale e visiva insieme.

Il pericolo da evitare e' la prosa che "sa di spec": se per rispettare le carte
la frase si irrigidisce, **molla la carta e tieni la frase viva**. La voce si
deve *sentire*, non vedere.

## Lo scheletro resta invisibile

Mai scrivere in chiaro i tre movimenti (accorgersi / avvicinarsi / cambiare).
Niente "capi' che", "da quel giorno", "qualcosa cambio' dentro di lui". Si mostra.

## Output: story.md con i marker

```
<!-- @hook p01 | @page 1 -->
[prosa pagina 1]

<!-- @hook p02 | @page 2 -->
[prosa pagina 2]
...
```

I marker servono al montaggio (`build_book.py`) per accoppiare testo e immagine.

## Auto-controllo prima di consegnare

- Nessuna frase delle liste "quota 0" di `PATTERN_DA_BANDIRE.md`.
- Le quote `lexicon` del config rispettate (es. "sorrise" e varianti <= 3).
- La chiusura non spiega; la soglia e' un gesto, non un pensiero spiegato.
- Ogni seme piantato e' tornato; il debito (se c'e') e' chiuso.
- Se una frase potrebbe stare in mille storie, riscrivila per QUESTA.

## Poi (montaggio)

```
# le immagini arrivano da Manus in esempio/immagini/pNN.png
python3 scripts/build_book.py story.md --node node.json --out libro.html
```
