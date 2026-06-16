# Scrivia — la UI del seme

Interfaccia per **far crescere una storia illustrata** con il sistema `seme`
(motore in `seme/`). Tu pianti il seme e organizzi; da lì lavorano le IA. Il
processo resta chiaro, con i tempi, fase per fase.

## Le 4 fasi (cosa fa l'utente, cosa fa l'IA)

1. **Progetta la storia** — chat di seeding (tu ↔ IA, processo a due cancelli),
   poi la catena deterministica (nodo → hook → brief → prompt) sfreccia istantanea.
2. **Scrivi la prosa** ✋ — l'IA scrive pagina per pagina (col cronometro visibile),
   poi il *critic* controlla a strati.
3. **Le illustrazioni** ✋ — i prompt sono pronti e blindati; le immagini le fa Manus.
4. **Monta il libro** — prosa + immagini → A5 → PDF.

Lo **stelo** a sinistra mostra sempre dove sei e *chi lavora* (tu / Claude / Manus
/ sistema). Il **registro** rende visibili i tempi (il `generations.jsonl` del seme).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind v4**, deploy su **Vercel**.
- Motore deterministico in TypeScript (`lib/engine.ts`) — port in corso di
  `seme/scripts/*.py`; la suite **pytest** in `seme/tests/` resta il riferimento di parità.
- Stato client (`lib/store.ts`, localStorage) dietro un'interfaccia sottile →
  sostituibile con **Supabase** (Postgres + Storage) per immagini e video futuri.
- LLM via **API di Claude** lato server (`app/api/claude/route.ts`, oggi stub).

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Stato

Primo giro: tutte e 4 le fasi navigabili, con dati d'esempio reali (la storia di
Pino dal seme) e flussi IA simulati. Prossimi agganci: API di Claude (seeding/
prosa/critic), motore TS a parità col Python, Supabase per la persistenza e i media.
