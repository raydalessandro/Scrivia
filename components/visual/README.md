# components/visual — libreria visiva di Scrivia

Linguaggio **"Patient Emergence"**: elementi riconoscibili che rendono il front
inconfondibile (non un template). Si importano da `@/components/visual`, mai
ridisegnati a mano nei singoli schermi.

## Tre regole

1. **Niente hardcoding.** Un elemento "vivo" riceve lo **stato reale** della storia e
   cambia forma. Lo stato si deriva dai segnali del back (`lib/stages.ts`,
   `lib/types.ts`) — non da costanti sparse. Es. `repertoStage(story)` usa gli stessi
   campi di `currentPhase`.
2. **Deterministico.** Stesso input → stesso disegno. Ogni casualità (es. stipple) è
   seminata una volta e non re-randomizza tra render (niente flicker).
3. **Token, non colori.** Solo variabili CSS esistenti (`--color-ink`, `--color-line`,
   `--color-you/claude/manus/det`). Nessun esadecimale nei componenti.

## Membri

| Componente | Cosa | Vivo? | Alimentato da |
|---|---|---|---|
| `Reperto` | esemplare botanico che cresce (seme→fiore) | 🌱 sì | `repertoStage(story)` 0..4 |

In arrivo (stessi principi): `AssePercorso` (lo stepper come asse misurato),
`EmptyState` (tavola vuota), etichette/cartiglio clinici.

## Uso

```tsx
import { Reperto, repertoStage } from "@/components/visual";

<Reperto stage={repertoStage(story)} size={54} />
```

`stage` 0..4 mappa: 0 seme·piantato · I seme(Progetta) · II voce(Prosa) ·
III figura(Immagini) · IV forma(Libro). `STAGE_META[stage]` dà numero romano, parola e
colore-attore per le didascalie.

## Dove è chiamato (call-site)

- **Card storia** (`app/page.tsx`) — ogni storia è un esemplare al suo stadio.
- *(prossimi)* header del workspace ("sei qui"), e l'`AssePercorso` al posto/accanto
  allo stepper.

## Aggiungere un membro

Crea `components/visual/<Nome>.tsx` (presentazionale, deterministico, token-only),
esportalo da `index.ts`, aggiungilo alla tabella sopra e a `FRONTEND.md` §3/§8.
