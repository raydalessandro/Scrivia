# SKILL — Critic semantico (chat)

Terzo strato del cancello qualità (vedi `ARCHITETTURA.md` §cancelli a strati).
Gira **in chat**, come la prosa — ma con un **modo di guasto diverso** dal
prosatore: il prosatore ottimizza il flusso, il critic ottimizza le **regole
invisibili**. Per questo i due si prendono errori diversi.

## Regola d'ingresso

Il critic **non riscrive**: solo giudica. Legge `node.json`, `writing_brief.md`
e `story.md`, e produce `critic_verdict.json`. Gira "a freddo": non gli arriva
il ragionamento di chi ha scritto, solo il testo finale.

## Cosa controlla (ciò che il regex NON vede)

Strati 1-2 (in `audit_story.py`) prendono cliché letterali e buchi di struttura.
Il critic prende il **senso**:

1. **scheletro_invisibile** *(duro)* — nessuna riga nomina o parafrasa i tre
   movimenti in astratto ("capì la differenza", "si sentì legato a lei",
   "qualcosa dentro di lui cambiò"). Il senso si mostra, non si dichiara.
2. **niente_moralina** *(duro)* — nessun personaggio e nessun narratore spiega il
   significato o tira la lezione ("così imparò che gli amici...").
3. **chiusura_non_esplicativa** — l'ultima pagina sigilla col tipo di chiusura
   dato (immagine/gesto/domanda/suono/colpo di coda), senza spiegare.
4. **soglia_come_gesto** — alla pagina-soglia l'attraversamento è una decisione o
   un gesto concreto, non una presa di coscienza raccontata.
5. **semi_pagati** — per ogni seme: introdotto verso la pagina-pianta E ritorna
   con **peso diverso** verso la pagina-pagamento (semanticamente, non basta che
   ricompaia la parola). Idem debito e motivo ricorrente.
6. **registro** — la prosa sta nella banda di registro data (basso/medio/alto).
7. **banalita** — c'è almeno un dettaglio non-funzionale, un pensiero laterale,
   un momento "vuoto" (il mondo continua oltre la cornice).
8. **dettaglio_personale** — intessuto con naturalezza, non esibito.
9. **frasi_da_mille_storie** — righe che potrebbero stare in qualsiasi storia
   (il regex prende quelle in lista; il critic prende le generiche non listate).
10. **voce_narratore** — le carte degli assi attivi sono onorate e i loro
    evita-tic rispettati (es. se temperamento=terrosa, niente parole-sentimento
    astratte)?
11. **idioletti_distinti** — ogni personaggio ha la sua firma (tic/tempo/modo),
    costante in tutta la storia e diversa dagli altri?
12. **texture_luogo** — la firma sensoriale del luogo ritorna coerente sulle pagine?
13. **sa_di_spec** *(rischio chiave)* — la prosa suona rigida, "da compito",
    perche' iper-specificata? Se la voce si vede invece di sentirsi → flag.

Una sola check "dura" che fallisce (1 o 2) → verdetto **FAIL**.

## Output: critic_verdict.json

```json
{
  "verdict": "PASS",
  "checks": {
    "scheletro_invisibile":   {"pass": true,  "note": ""},
    "niente_moralina":        {"pass": true,  "note": ""},
    "chiusura_non_esplicativa":{"pass": true, "note": ""},
    "soglia_come_gesto":      {"pass": true,  "note": ""},
    "semi_pagati":            {"pass": true,  "note": ""},
    "registro":               {"pass": true,  "note": ""},
    "banalita":               {"pass": true,  "note": ""},
    "dettaglio_personale":    {"pass": true,  "note": ""},
    "frasi_da_mille_storie":  {"pass": true,  "note": ""},
    "voce_narratore":         {"pass": true,  "note": ""},
    "idioletti_distinti":     {"pass": true,  "note": ""},
    "texture_luogo":          {"pass": true,  "note": ""},
    "sa_di_spec":             {"pass": true,  "note": ""}
  },
  "page_flags": [
    {"page": 0, "severity": "soft|hard", "issue": "..."}
  ]
}
```

`severity: hard` su una riga di una check dura ribalta il verdetto a FAIL.
`severity: soft` = nota, non blocca (es. una frase concreta al limite).

## Esempi di FAIL (per tarare l'occhio)

- "E da quel giorno Pino ebbe un amico." → moralina + chiusura esplicativa.
- "Capì che a volte basta dire il proprio nome." → moralina + scheletro nominato.
- Seme 'sasso' introdotto a p4 e mai più ripreso → semi_pagati FAIL.
- Soglia resa come "sentì che era pronto a fidarsi" → soglia raccontata, non gesto.

## Poi (lo strato deterministico chiude il cerchio)

```
# salva critic_verdict.json accanto a story.md, poi:
python3 scripts/audit_story.py story.md --node node.json --critic critic_verdict.json
```

`audit_story.py` fonde i tre strati in **un report unico** con verdetto finale.
