-- Storage Scrivia — bucket `assets` (SUPABASE_SPEC.md, congelato).
-- public-read (le immagini entrano in <img src> e sono fetchabili dal server),
-- scrittura protetta da RLS. Path per storia: {story_id}/{kind}/{file}
-- con kind ∈ {reference, page}. Il primo segmento del path è lo story_id.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Scrittura/aggiornamento/cancellazione solo sotto una storia di cui sei proprietario.
create policy "assets: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (select id::text from public.stories where user_id = auth.uid())
  );
create policy "assets: owner modify"
  on storage.objects for update using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (select id::text from public.stories where user_id = auth.uid())
  );
create policy "assets: owner delete"
  on storage.objects for delete using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (select id::text from public.stories where user_id = auth.uid())
  );
-- Lettura: pubblica (bucket public). Path lunghi/non indovinabili.
