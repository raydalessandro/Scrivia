# SKILL — Seeding conversazionale (chat) · PROCESSO

Prima fase: umano e IA parlano, e l'IA ne tira fuori un `story_seed.yaml` pronto
per il motore. E' il punto piu' fragile della pipeline (la traduzione
conversazione -> seed): qui si "perde/dimentica/sbaglia". Per questo NON e' una
chiacchierata libera ma un **processo a passi con due cancelli** (conferma +
validazione). Filosofia: chiedere poco, dedurre, **confermare**, poi "cliccare".

## I passi (in ordine, non saltare)

**0. Scarico cognitivo (Turno 0).** Invita la persona a buttar fuori cos'ha in
mente — "raccontami a chi e' la storia e cosa succede". Ascolta, non interrogare.

**1. Raccogli il minimo.** Da cio' che dice, estrai (deducendo il resto):
   - protagonista: nome + eta';
   - mondo: una parola (animali del bosco, spazio, sottomarino, citta', casa...);
   - cuore (pugno): cosa succede / cosa sente — spesso lo dicono gia' loro;
   - opzionale: un dettaglio vero del bambino da intessere;
   - opzionale: lunghezza (default 12);
   - opzionale (voce): se la persona ha un gusto ("voglio che faccia ridere",
     "dolce e lento"), traducilo in 2-3 assi in `overrides.voice` (temperamento/
     ritmo/distanza/lente/umorismo); il resto lo campiona il motore. Due tap, mai
     obbligatorio.
   Se la persona dice tutto in una frase, NON fare altre domande: deduci.

**2. Mappa il tema -> attributo** (resta interno, non si nomina):
   paura/scoperta/curiosita/differenza -> distinguere ·
   amicizia/aiuto/gentilezza/appartenenza -> connettere ·
   perdita/crescere/cambiamento/passaggio -> cambiare.
   Se il tema non rientra, scegline uno vicino o lascia decidere al motore.

**3. Riempi il template.** Copia `skill/seed.template.yaml` e compilalo. La forma
fissa garantisce che nulla venga dimenticato: cio' che manca resta vuoto e il
cancello lo becca. Scrivi la **spina narrativa** (la sola parte "contenuto"):
   - `premise`: cosa mette in moto (scena d'avvio);
   - `problem`: la difficolta', con dentro la tensione ("voglia + paura");
   - `threshold_moment`: l'attraversamento — una **decisione o un gesto**, non una
     presa di coscienza raccontata;
   - `resolution_mode`: come si **muove** (mai "si risolve" o lieto-fine spiegato).
   Se ti vengono, aggiungi 1-2 `seed_contents` concreti e un `recurring_motif`.

**4. CANCELLO 1 — Ricapitola e fatti confermare.** Prima di costruire, di' alla
persona cosa hai capito, in chiaro e breve:
   > "Allora: <nome>, <eta'>, nel <mondo>. Il cuore: <pugno>. E in due righe la
   > storia: <premessa> ... fino a <come si muove>. Va bene cosi' o cambio qualcosa?"
   Aspetta la conferma o la correzione. Questo cancello prende i fraintendimenti
   della traduzione umano->IA, che nessuno script puo' vedere.

**5. CANCELLO 2 — Valida (deterministico).**
   ```
   python3 scripts/validate_seed.py story_seed.yaml
   ```
   - ERRORI -> seed incompleto: torna al passo giusto, completa, rivalida.
   - AVVISI -> degradano la qualita' (es. tema non mappato): valuta se sistemare.
   Non si costruisce finche' il validatore non passa (build_node lo rifa comunque).

**6. Costruisci ("il click").**
   ```
   python3 scripts/build_node.py story_seed.yaml --out node.json
   python3 scripts/extract_hooks.py node.json --out hooks.json
   python3 scripts/build_brief.py node.json hooks.json --out writing_brief.md
   ```
   Oppure `make chain STORY=<dir>`. Stesso `nonce` -> stessa storia; vuoto -> diversa.

## Output: story_seed.yaml

E' il template riempito. Niente in esso nomina lo scheletro EAR: quello lo decide
il motore e resta invisibile in tutta la storia.

## Perche' questo processo regge

- **Template** -> non si dimenticano campi (cio' che manca e' visibile).
- **Cancello 1 (conferma)** -> non si sbaglia la traduzione del desiderio.
- **Cancello 2 (validazione)** -> non si costruisce su un seed rotto.
- **Log** (`generations.jsonl`) -> ogni storia resta ricostruibile e tracciata.
