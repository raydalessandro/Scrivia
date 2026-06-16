# PROMPT_TEMPLATE — template blindato per le immagini (metodo Isola)

Documento canonico che chi genera le immagini (Manus, o altri) legge a inizio
sessione. Porta il metodo validato sulle illustrazioni della saga *L'Isola dei
Tre Venti* (skills/scenografo). Premessa di fondo, che ci avvantaggia:

> **Manus è solo orchestrazione.** Con lavoro strutturato esegue e basta — lite o
> pro danno lo stesso risultato. Quindi la coerenza la mette la STRUTTURA, non il
> modello. Questo template è la struttura.

Il file prompt della storia (`manus_prompts.md`) è **generato** in questa forma
da `scripts/to_manus_prompts.py`: non si scrive a mano, si legge e si esegue.

## I problemi che questa struttura risolve

Sono le cause reali di incoerenza (lezioni di Manus), e la contromisura di ognuna:

1. **Stile che scivola** (watercolor → digitale) → il BLOCCO STYLESHEET sta in
   **testa** a ogni prompt, con peso pari ai contenuti, identico ovunque.
2. **Dettagli che spariscono** (firme, vestiti) → SUBJECT con soli descrittori
   autorizzati + divieti ripetuti in **ogni** prompt (il modello non ha memoria
   tra le generazioni: ogni prompt è autosufficiente).
3. **Proporzioni sballate** → blocco SCALA esplicito in ogni pagina multi-
   personaggio (protagonista = ancora, stessa linea di terra).
4. **Punto di vista indefinito** → POV esplicito per pagina ("il lettore guarda
   da…"), tradotto dalla scena, mai lasciato al modello.
5. **Coerenza persa tra sessioni** → blocchi fissi nel **file**, non nella chat;
   sessione fresca e reference ri-allegate ogni volta.

## Ordine dei blocchi (fisso)

1. **STYLESHEET** (fisso, in testa) — stile + palette + fascia alta quieta per il
   testo + NEGATIVE con "NO text". Identico in ogni prompt.
2. **SUBJECT** dei personaggi in scena (canone, dai descrittori autorizzati;
   l'aspetto lo fissa la reference del Passo 0).
3. **STORY MOMENT** — 1-2 frasi in inglese: azione + emozione + **relazioni
   spaziali** (chi è dove). Mai prosa grezza.
4. **POV** — inquadratura esplicita del lettore.
5. **PLACE** — firma del luogo (costante su tutte le pagine).
6. **CHARACTER CONSISTENCY** (fisso, in coda) — le reference allegate sono
   **BINDING**, non ispirazione; altezze relative; nessuna firma scambiata o persa.

## Regole di sessione

- **Passo 0**: genera prima le reference dei personaggi (STYLESHEET + SUBJECT, 3
  viste). Diventano le reference BINDING per le scene.
- **Una chat per batch**, sessione fresca, **ri-allega** sempre le reference (il
  generatore deriva verso le proprie ultime uscite).
- I blocchi fissi si incollano **identici**: testo identico in testa = coerenza
  **e** cache (il modello riusa il prefisso stabile).
- Formato **verticale 2:3**, una immagine per pagina, **niente testo** nell'immagine.

## Memoria dei prompt che funzionano

Quando un'immagine è approvata, salva il prompt completo che ha funzionato in
`prompt_approvati.md` (accanto alla storia). Se una scena simile torna, si riparte
da lì invece che da zero — meno tentativi, meno costo.
