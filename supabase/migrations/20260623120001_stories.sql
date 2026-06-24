-- Persistenza Scrivia — tabella `stories` (SUPABASE_SPEC.md, congelato).
-- Forma: una riga = una Story INTERA in `doc` (jsonb). title/stage/updated_at
-- sono colonne-specchio (denormalizzate dal doc) per liste e ordinamento veloci.
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

-- RLS: l'utente interattivo vede/scrive SOLO le proprie storie.
alter table public.stories enable row level security;

create policy "stories: owner all"
  on public.stories for all
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());
