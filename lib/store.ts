"use client";

// Store su Supabase (Postgres). Una riga = una Story INTERA in `doc` (jsonb);
// title/stage/updated_at sono colonne-specchio (denormalizzate dal doc) per
// liste e ordinamento veloci. Dietro la STESSA interfaccia sottile di prima
// (load/save/delete/new/emptySeed): chi sta a monte (UI, fasi, comandi) non
// cambia contratto — solo l'attesa, perché l'IO ora è asincrono.
//
// Confine invariato: l'adapter PERSISTE lo Story, non lo muta. Le mutazioni di
// stato passano sempre dai comandi (lib/commands.ts). Senza sessione (SSR /
// utente non loggato / env non configurate) ritorna [EXAMPLE_STORY] — la demo,
// che non viene mai persistita — esattamente come prima con window===undefined.

import type { Story, Seed } from "./types";
import { EXAMPLE_STORY } from "./example";
import { getSupabase } from "./supabase/client";

export function emptySeed(): Seed {
  return {
    language: "it",
    title: "",
    protagonist: { name: "", age: null, kind: "" },
    companions: [],
    world_flavor: "",
    setting: { primary: "", notes: "" },
    theme: "",
    pugno: "",
    personal_detail: "",
    length_pages: 12,
    packs: [],
    spine: { premise: "", problem: "", threshold_moment: "", resolution_mode: "", closure: "" },
    voice: {},
    nonce: null,
  };
}

export function newStory(): Story {
  // ID = uuid (lo schema lo congela come uuid). Fallback per ambienti senza
  // crypto.randomUUID (vecchi runtime): improbabile, ma non rompiamo.
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "s" + Math.random().toString(36).slice(2, 10);
  return {
    id,
    createdAt: new Date().toISOString(),
    title: "Storia senza nome",
    stage: "seed",
    seed: emptySeed(),
    ledger: [],
  };
}

export async function loadStories(): Promise<Story[]> {
  const sb = getSupabase();
  if (!sb) return [EXAMPLE_STORY];
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [EXAMPLE_STORY];
  const { data, error } = await sb
    .from("stories")
    .select("doc")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error || !data) return [EXAMPLE_STORY];
  // EXAMPLE_STORY resta in testa come demo (non persistita).
  return [EXAMPLE_STORY, ...data.map((r) => r.doc as Story)];
}

export async function loadStory(id: string): Promise<Story | undefined> {
  if (id === EXAMPLE_STORY.id) return EXAMPLE_STORY;
  const sb = getSupabase();
  if (!sb) return undefined;
  const { data, error } = await sb.from("stories").select("doc").eq("id", id).maybeSingle();
  if (error || !data) return undefined;
  return data.doc as Story;
}

export async function saveStory(story: Story): Promise<void> {
  if (story.id === EXAMPLE_STORY.id) return; // la demo non si persiste
  const sb = getSupabase();
  if (!sb) return;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;
  // upsert su id: riempi le colonne-specchio dal doc, doc = la Story intera.
  await sb.from("stories").upsert({
    id: story.id,
    user_id: user.id,
    title: story.title,
    stage: story.stage,
    updated_at: new Date().toISOString(),
    doc: story,
  });
}

export async function deleteStory(id: string): Promise<void> {
  if (id === EXAMPLE_STORY.id) return;
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("stories").delete().eq("id", id);
}
