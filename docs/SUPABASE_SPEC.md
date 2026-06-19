# SUPABASE_SPEC.md — il contratto di persistenza (CONGELATO)

> Questo documento è la **fonte di verità** per persistenza, storage e auth di Scrivia.
> Si tratta come il grafo: **deciso una volta, congelato**. Cambiarlo costa (migrazioni,
> dati già scritti), quindi le modifiche allo schema/RLS **richiedono l'ok esplicito**
> dell'utente. Le aggiunte seguono la regola del seme: *aggiungi dove manca, non sottrarre*.

## Principio di forma — perché così
La `Story` è già **un solo blob JSON** dietro un'interfaccia sottile (`lib/store.ts`:
`loadStories`/`loadStory`/`saveStory`/`deleteStory`). Supabase ne è la traduzione
letterale: **una riga = una Story intera in `jsonb`**. Questo:
- rispetta *"la verità è nel grafo"* (il `jsonb` *è* il grafo versionato);
- evoluzione a costo zero: aggiungere campi alla Story **non richiede migrazioni** (schemaless);
- non perde nulla: qualsiasi struttura normalizzata futura (analitiche, entità condivise,
  righe per-pagina) si **proietta** dal `jsonb` quando una funzione la richiede davvero.
  Il `jsonb` è un **superset**, non un imbuto.

Le **immagini non stanno nel JSON**: vanno nel bucket Storage (URL nei campi
`manus[].imageUrl` / `entities[].imageUrl`). È questo che le rende **fetchabili dal
server** — lo sblocco per la generazione immagini server-side.

## Schema — tabella `stories`
```sql
create table public.stories (
  id          uuid primary key,                 -- = Story.id (ID stabile, non rigenerare)
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default '',
  stage       text not null default 'seed',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  doc         jsonb not null                    -- la Story INTERA (grafo + prosa + manus + entità + ledger…)
);
create index stories_user_idx    on public.stories (user_id);
create index stories_updated_idx on public.stories (user_id, updated_at desc);
```
`title`/`stage`/`updated_at` sono **colonne-specchio** (denormalizzate dal `doc`) per
liste e ordinamento veloci: la verità resta nel `doc`, queste si riempiono al salvataggio.
`auth.users` lo dà Supabase Auth: niente da creare.

## RLS — `stories`
```sql
alter table public.stories enable row level security;

-- L'utente interattivo vede/scrive SOLO le proprie storie.
create policy "stories: owner all"
  on public.stories for all
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());
```
**Gancio futuro MCP (riservato, NON attivo ora).** Per un chiamante *non-interattivo*
(un sistema esterno che manda un brief → riceve un libricino) si aggiungerà **una policy
separata per il ruolo `service`** — non si tocca quella sopra. Lo prevediamo soltanto nel
disegno; l'attivazione è M4. Lo schema non va cambiato per ammetterla.

## Storage — bucket `assets`
- **Un bucket `assets`**, **public-read** (lettura pubblica), **scrittura protetta da RLS**.
- Path **per storia** (la storia è l'unità durevole, non l'utente): `{story_id}/{kind}/{file}`
  con `kind ∈ {reference, page}` (es. `…/reference/protagonista.png`, `…/page/p03.png`).
- `manus[].imageUrl` / `entities[].imageUrl` contengono l'**URL pubblico** (diretto,
  stabile, senza scadenza) → entra in `<img src>` senza modifiche al render **ed è
  fetchabile dal server** per la gen immagini.

```sql
-- scrittura/aggiornamento/cancellazione solo sotto una storia di cui sei proprietario;
-- il primo segmento del path è lo story_id.
create policy "assets: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (select id::text from public.stories where user_id = auth.uid())
  );
create policy "assets: owner modify"
  on storage.objects for update using ( bucket_id = 'assets'
    and (storage.foldername(name))[1] in (select id::text from public.stories where user_id = auth.uid()) );
create policy "assets: owner delete"
  on storage.objects for delete using ( bucket_id = 'assets'
    and (storage.foldername(name))[1] in (select id::text from public.stories where user_id = auth.uid()) );
-- lettura: pubblica (bucket public). Path lunghi/non indovinabili.
```
**Scelta read pubblica — tradeoff esplicito.** Vantaggio: `imageUrl` è un URL diretto
(nessuna modifica al layer di render, corsia frontend intatta) e il server fetcha senza
firmare. Costo: chi ha l'URL vede l'immagine (path non indovinabili). Per l'MVP va bene.
**Hardening futuro, non vincolante**: passare a bucket **privato + signed URL** è un
cambio del solo render (si risolve il path a una URL firmata a display-time); non tocca
schema né RLS, si fa quando i contenuti diventeranno sensibili.

## Contratto dell'adapter — `lib/store.ts`
L'adapter **mantiene la stessa interfaccia** (nessun chiamante a monte cambia):
`loadStories()` · `loadStory(id)` · `saveStory(story)` · `deleteStory(id)` ·
`newStory()` · `emptySeed()`. Backing su Supabase:
- `saveStory`: upsert su `stories` (`id`, `user_id = auth.uid()`, riempi le colonne-specchio
  `title`/`stage`/`updated_at` dal `doc`, `doc = story`).
- `loadStories`: `select` delle proprie, ordinate per `updated_at desc`; `EXAMPLE_STORY` resta
  in testa come demo (non persistita).
- SSR / utente non loggato: ritorna `[EXAMPLE_STORY]` (come oggi con `window === undefined`).
- **Mutazioni sempre via comandi** (`lib/commands.ts`): l'adapter **persiste** lo `Story`, non
  lo muta. Confine invariato.

## Auth
Supabase Auth, minimale (es. magic link email). Serve solo a dare un `user_id` reale alle RLS.
La home/store si apre sull'utente loggato.

## Segreti
- **Mai nel repo.** `.env.example` elenca le **chiavi** senza valori:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client),
  `SUPABASE_SERVICE_ROLE_KEY` (**solo server**, mai esposta al client né nei log).
- Client → `anon key` + RLS. Route server che servono privilegi → `service_role` da env.

## Invarianti congelati (non cambiare a cuor leggero)
1. **Story intera in `jsonb`** (non frammentata). Le immagini nel bucket come URL.
2. **ID stabili preservati**: `Story.id`, `EntityRefRecord.id`, gli `id` dei semi
   (`SeedEcho`). Promuovere domani le entità a tabella condivisa = riferimento per ID, non
   chirurgia sui dati.
3. **Path immagini per `story_id`** (unità durevole), non per utente.
4. **Policy `service` riservata** per l'MCP esterno: prevista, non attiva.

## Fuori scope (deciso DOPO, di proposito)
- Vista/tabella **analitiche** sulle storie: si disegna dopo il primo lotto, quando si sa
  che domande si fanno (niente normalizzazione alla cieca).
- Promozione **entità a tabella condivisa** tra storie.
- Attivazione del **percorso service-role / MCP** (M4).
