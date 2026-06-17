# INTEGRATION — branch `engine-parity` (B1)

**Cosa fa.** Sostituisce il motore in ritardo (`lib/engine.ts`) con quello corretto a
**parità di contratto** col Python. Fixa i 3 bug noti, arricchisce gli hook, aggiunge voce
frattale + invarianti + `entitiesInScene`, e porta la **suite di parità** = milestone **M1**.

È l'unico branch che **sostituisce** codice. È additivo nei tipi: la UI esistente continua a
funzionare senza modifiche.

---

## File

| File | Azione | Note |
|---|---|---|
| `lib/engine.ts` | **SOSTITUITO** | nuovo motore; preserva gli export usati dalla UI |
| `lib/engineTypes.ts` | **NUOVO** | tipi additivi (estendono Seed/StoryNode/PagePlan); `types.ts` NON va toccato |
| `lib/canon.json` | **NUOVO** | dati del canone, importati come modulo (bundle) |
| `test/engine.parity.test.ts` | **NUOVO** | fuzz + invarianti + determinismo + i 3 fix |

`lib/types.ts` ed `lib/enums.ts` di Scrivia **restano invariati**. Il motore non dipende più da
`enums.ts` (legge `theme_to_attribute` dal canone); la UI può continuare a usarlo com'è.

## Dipendenze / config
- **`"resolveJsonModule": true`** nel `tsconfig.json` (attivo di default in Next.js). Serve per
  `import canon from "./canon.json"`. Il canone finisce nel bundle: **niente `fs`**, gira nel browser.
- Test: lo script è self-contained (`tsx`). Per il runner di Scrivia (vitest/jest) basta avvolgere i
  blocchi in `describe/it` — la logica e gli `assert` sono già lì.

## Come verificare (già eseguito qui: tutto verde)
```bash
# typecheck strict contro i tipi reali di Scrivia → 0 errori
npx tsc --noEmit
# suite di parità (M1)
npx tsx test/engine.parity.test.ts
```
Esito atteso:
```
✓ checkNode: 0/2500      ✓ checkHooks: 0/2500
✓ determinismo: 200/200 identici
✓ attribute_dominant = theme_to_attribute (12/12 temi)
✓ threshold_page = unica pagina-soglia in range (300/300)
✓ register con varianza
✓ PARITÀ: tutti i blocchi superati (M1)
```

---

## I 3 fix (erano *verbatim* nel vecchio `engine.ts`)

1. **`attribute_dominant`** non è più legato a `seed.voice &&`. Ora: override esplicito →
   `THEME_TO_ATTRIBUTE[theme]` → campionamento. (Prima, senza voce, l'attributo collassava.)
2. **`threshold_page`** non è più `round(pages·0.75)` fisso. Ora coincide con l'inizio del beat
   **cambiare** (triadico) o `round(pages·0.70)` (mono) — ed è l'**unica** pagina con
   `markers.is_threshold` negli hook (verificato dal test).
3. **`register`** non è più un valore fisso senza varianza: banda d'età + neighbor-shift + override.

Più: `extractHooks` completo (`focal_action`, `atmosphere`, `palette`,
`characters_present` **strutturato `{name, entityId}`**, riparazione-varietà robusta — vedi
`docs/` REPORT del bug della riparazione), `resolveVoice` (voce frattale), `checkNode`/`checkHooks`
(invarianti), `entitiesInScene` (per il gate della FASE 1).

## Mapping tipi
- `buildNode(seed: Seed): StoryNodeExt` — legge `seed.spine.{premise,problem,threshold_moment,
  resolution_mode}`, `pugno`, `personal_detail`, `world_flavor` e li scrive nel nodo (`StoryNode`
  li richiede). Gli **override** opzionali (grammatica) li legge da `seed.overrides`; gli assi voce
  forzati da `seed.voice` (i 5 assi di `VoiceOverrides`, **già identici** al canone). `StoryNodeExt`
  è assegnabile a `StoryNode` (gli extra — `voice`, `debt`, `recurring_image`, `setting_entity_id`,
  `entityId` — sono opzionali).
- `extractHooks(node): Hook[]` — `Hook extends PagePlan`: oltre ai campi ricchi, ogni hook porta
  **`hook` (=type), `zone` (=composition_zone), `note`** (marcatore apertura/soglia/chiusura). Così
  **ogni consumatore di `PagePlan` continua a funzionare**.
- Export preservati per la UI: **`buildNode`**, **`buildPagePlan`** (alias di `extractHooks`),
  **`newNonce`**. Nuovi: `extractHooks`, `resolveVoice`, `checkNode`, `checkHooks`,
  `entitiesInScene`, `entityIdOfCharacter`, `locationEntityId`.

## Rischi / cose da controllare a valle
- **Consumatori di `PagePlan`** nella UI: i campi nuovi sono **additivi**, i vecchi
  (`page/beat/hook/zone/note`) restano. Nessuna rottura attesa, ma vale una passata veloce.
- `buildPagePlan` ora ritorna `Hook[]` (⊇ `PagePlan[]`): assegnabile dove serviva `PagePlan[]`.
- Se in futuro preferite **fondere** `engineTypes.ts` dentro `types.ts` (campi opzionali su
  `Seed`/`StoryNode`/`PagePlan`), è un refactor sicuro — ma **non necessario** per il merge.
- `canon.json`: deve restare un import di modulo (bundle), non una lettura a runtime.

## Dopo il merge
- Spunta **M1** (parità engine). I branch successivi (B2 reference-phase, B3 seeding-game)
  dipendono da questo. Vedi `docs/ROADMAP_INTEGRAZIONE.md`.
