"use client";

// Auth minimale (magic link). Serve solo a dare un `user_id` reale alle RLS:
// niente password, niente UI pesante. L'utente inserisce l'email, riceve un
// link, ci clicca, torna sull'origine → la sessione viene rilevata dal client
// (detectSessionInUrl) e `onAuthChange` notifica la UI di ricaricare le storie.

import { getSupabase } from "./client";

/** L'id dell'utente loggato, o null (SSR / non configurato / non loggato). */
export async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/** Invia il magic link all'email. Ritorna l'errore se qualcosa va storto. */
export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase non configurato." };
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

/** Notifica login/logout. Ritorna la funzione per disiscriversi. */
export function onAuthChange(cb: (userId: string | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) =>
    cb(session?.user?.id ?? null),
  );
  return () => data.subscription.unsubscribe();
}
