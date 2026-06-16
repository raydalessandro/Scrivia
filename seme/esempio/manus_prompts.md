# PROMPT IMMAGINI (Manus) — Pino e la voce sotto le foglie

## Regole di sessione (perché le immagini restano coerenti)
- Manus è orchestrazione: con lavoro strutturato esegue e basta. La coerenza la mette la struttura qui sotto.
- I blocchi FISSI (STYLESHEET, CHARACTER CONSISTENCY) si incollano **identici** in ogni prompt: testo identico = coerenza + cache.
- Il modello **non ha memoria** tra le generazioni: ogni prompt è autosufficiente, con tutti i blocchi, anche se «ovvio».
- **Sessione fresca** per la storia, **ri-allega** sempre le reference. Una chat per batch, mai sessioni sature.
- **Passo 0**: genera prima le reference dei personaggi (STYLESHEET + SUBJECT). Quelle diventano le reference BINDING per le scene.
- Formato: **verticale 2:3**, una immagine per pagina, niente testo nell'immagine.

## BLOCCO STYLESHEET — fisso, in TESTA a ogni prompt
```
ART STYLE — fixed for this book:
Anthropomorphic woodland animals in the British picture-book tradition (Beatrix Potter, Brian Wildsmith), contemporary warmth; naturalistic animal anatomy, gently stylized, never cartoon-flat.
Watercolor over fine, slightly textured ink linework; gentle washes, soft gradients, visible paper grain. Earthy restrained palette with tender greens and pale yellows, new mobile spring light. Saturation always restrained — never neon, never glossy, never plastic.
Lighting: soft natural light, warm and diffuse, gentle watercolor shadows, no harsh contrast, no dramatic chiaroscuro. A serene, lived-in feeling.
PAGE COMPOSITION: keep the upper ~28% of the frame quiet and low-detail (open sky, mist, soft wash, plain wall) — this band hosts the page text. Faces and key action live in the lower two thirds.
NEGATIVE: NO 3D render, NO photorealistic detail, NO oil-painting heaviness, NO anime, NO manga, NO chibi, NO disney/pixar cartoon, NO flat vector, NO comic-book style, NO airbrush gloss, NO neon, NO dark gothic, NO horror. NO text, NO lettering, NO signs or written words anywhere in the image (added later by the book compositor). A high-quality contemporary European picture book for ages 4-8.
```

## CHARACTER CONSISTENCY — fisso, CHIUDE ogni prompt
```
CHARACTER CONSISTENCY — the attached reference images are BINDING, not inspiration. Match them exactly for every named character (Pino, Ghita): face/muzzle shape and proportions, fur or hair color, eye color, build, clothing and any signature item — never swapped, never missing. Relative heights: Pino 1.0 (size anchor, the size reference for everyone); Ghita ~0.20x Pino's height. All characters stand on the same ground line. Keep every character identical to its reference across all pages.
```

## SCALA — in ogni pagina con più personaggi
- **Pino**: 1.0 (size anchor, the size reference for everyone)
- **Ghita**: ~0.20x Pino's height
Tutti sulla stessa linea di terra.

## Passo 0 — reference dei personaggi (genera PRIMA delle scene)
Per ogni personaggio: STYLESHEET + il suo SUBJECT qui sotto, 3 viste (fronte, 3/4, profilo). Usa queste reference su tutte le pagine.

### SUBJECT — Pino  (canone, riusare identico)
```
SUBJECT — Pino: a young riccio, narrative age 6. lively, quick light posture. Appearance is fixed by the reference sheet (Passo 0) — reuse it exactly.
```

### SUBJECT — Ghita  (canone, riusare identico)
```
SUBJECT — Ghita: a ghiandaia. calm, still posture. Appearance fixed by the reference sheet — reuse it exactly.
```

## Prompt per pagina
Ricetta, in quest'ordine: **STYLESHEET → SUBJECT(personaggi in scena) → STORY MOMENT → POV → PLACE → CHARACTER CONSISTENCY**.

### p01 · panorama · apertura
- **Personaggi in scena:** Pino (incolla i loro SUBJECT)
- **STORY MOMENT:** Pino: the scene opens, calm and establishing. Composition: subject low in the frame, wide quiet sky/space above (text band). apre: [promessa fatta presto, mantenuta vicino alla fine]
- **POV (il lettore guarda):** a wide establishing shot, from a distance
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino + il luogo
- **Salva come:** `immagini/p01.png`

### p02 · azione · distinguere
- **Personaggi in scena:** Pino (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino: noticing something, curious and a little wary. Composition: subject to one side, quiet open space on the other. introduce: un fischio a due note che Ghita fa tra le foglie
- **POV (il lettore guarda):** a medium shot at the characters' eye level
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino + il luogo
- **Salva come:** `immagini/p02.png`

### p03 · dettaglio · distinguere
- **Personaggi in scena:** Pino (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino: noticing something, curious and a little wary. Composition: small centered vignette, generous quiet margin around.
- **POV (il lettore guarda):** a macro close-up on the key detail
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino + il luogo
- **Salva come:** `immagini/p03.png`

### p04 · interno · connettere
- **Personaggi in scena:** Pino (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino: reaching toward someone or something, tentative and warm. Composition: small centered vignette, generous quiet margin around. introduce: il sasso liscio della casa vecchia
- **POV (il lettore guarda):** a medium shot inside the space
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino + il luogo
- **Salva come:** `immagini/p04.png`

### p05 · azione · connettere
- **Personaggi in scena:** Pino, Ghita (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino with Ghita: reaching toward someone or something, tentative and warm. Composition: subject to one side, quiet open space on the other.
- **POV (il lettore guarda):** a medium shot at the characters' eye level
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino, Ghita + il luogo
- **Salva come:** `immagini/p05.png`

### p06 · transizione · connettere
- **Personaggi in scena:** Pino, Ghita (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino with Ghita: reaching toward someone or something, tentative and warm. Composition: subject high in the frame, open ground/space below.
- **POV (il lettore guarda):** a medium tracking shot following the movement
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino, Ghita + il luogo
- **Salva come:** `immagini/p06.png`

### p07 · azione · connettere
- **Personaggi in scena:** Pino, Ghita (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino with Ghita: reaching toward someone or something, tentative and warm. Composition: subject to one side, quiet open space on the other.
- **POV (il lettore guarda):** a medium shot at the characters' eye level
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino, Ghita + il luogo
- **Salva come:** `immagini/p07.png`

### p08 · interno · connettere
- **Personaggi in scena:** Pino (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino: reaching toward someone or something, tentative and warm. Composition: subject to one side, quiet open space on the other.
- **POV (il lettore guarda):** a medium shot inside the space
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino + il luogo
- **Salva come:** `immagini/p08.png`

### p09 · panorama · cambiare
- **Personaggi in scena:** Pino, Ghita (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino with Ghita: a decisive small action, the moment things shift. Composition: subject high in the frame, open ground/space below. ritorna, con peso diverso: un fischio a due note che Ghita fa tra le foglie SOGLIA: il punto in cui qualcosa cambia davvero
- **POV (il lettore guarda):** a wide establishing shot, from a distance
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino, Ghita + il luogo
- **Salva come:** `immagini/p09.png`

### p10 · azione · cambiare
- **Personaggi in scena:** Pino, Ghita (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino with Ghita: a decisive small action, the moment things shift. Composition: subject to one side, quiet open space on the other. chiude: [promessa fatta presto, mantenuta vicino alla fine]
- **POV (il lettore guarda):** a medium shot at the characters' eye level
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino, Ghita + il luogo
- **Salva come:** `immagini/p10.png`

### p11 · azione · cambiare
- **Personaggi in scena:** Pino, Ghita (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino with Ghita: a decisive small action, the moment things shift. Composition: subject high in the frame, open ground/space below. ritorna, con peso diverso: il sasso liscio della casa vecchia
- **POV (il lettore guarda):** a medium shot at the characters' eye level
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino, Ghita + il luogo
- **Salva come:** `immagini/p11.png`

### p12 · dettaglio · chiusura
- **Personaggi in scena:** Pino (incolla i loro SUBJECT) (stesso luogo della pagina precedente — riusa la reference del luogo)
- **STORY MOMENT:** Pino: the scene settles, quiet. Composition: small centered vignette, generous quiet margin around.
- **POV (il lettore guarda):** a macro close-up on the key detail
- **PLACE:** PLACE — il bosco dietro la casa nuova: luce piena; recognizable da una consistenza; [un odore ricorrente del luogo]. Keep this place identical across all pages.
- **Reference da allegare:** Pino + il luogo
- **Salva come:** `immagini/p12.png`

## Dopo la generazione
- Selezione umana. Quando un'immagine è approvata, salva il prompt completo che ha funzionato in `prompt_approvati.md`: se una scena simile torna, riparti da lì.
