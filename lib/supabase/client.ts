"use client";

// Client Supabase per il BROWSER (anon key + RLS). Singleton: una sola istanza
// per tab, con sessione persistita in localStorage e auto-rilevata dal magic
// link al ritorno (detectSessionInUrl). Niente segreti: la anon key è pubblica
// per disegno, la sicurezza vive nelle RLS lato Postgres.
//
// Ritorna `null` quando non c'è un client utilizzabile (SSR, o env non
// configurate): lo store cade con grazia su EXAMPLE_STORY, come prima faceva
// con `window === undefined`. Così il deploy senza chiavi non si rompe.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null; // SSR: nessuna sessione
  if (!url || !anonKey) return null; // env non configurate
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
