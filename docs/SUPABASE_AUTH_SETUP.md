# SUPABASE_AUTH_SETUP.md — configurare l'auth end-to-end (SMTP + redirect URL)

> Operativo, non congelato. Completa l'auth magic-link introdotta in M3
> (`lib/supabase/auth.ts`): finché questi due pezzi non sono impostati, il
> login funziona solo per i membri del progetto e con limiti stretti. Sono
> **impostazioni di progetto Supabase (GoTrue)**: non vivono nel repo, non si
> toccano via SQL — si applicano dal **dashboard**. Qui sotto i valori esatti.
>
> Progetto: **scrivia** · ref `fytaqijzpkjtecwxzrdu` · `https://fytaqijzpkjtecwxzrdu.supabase.co`

Il client invia il magic link con `emailRedirectTo: window.location.origin`
(vedi `lib/supabase/auth.ts`) e rileva la sessione al ritorno
(`detectSessionInUrl`). Perché funzioni servono **due cose**: gli origin
dell'app nell'allowlist dei redirect (A), e un mittente email vero (B).

---

## A — Redirect URL (gratis, fallo per primo)

**Dashboard:** Authentication → URL Configuration.

- **Site URL** (il default di produzione):
  ```
  https://scrivia-seven.vercel.app
  ```
- **Redirect URLs** (allowlist — ogni origin da cui parte/torna il magic link;
  GoTrue accetta i wildcard `*` e `**`):
  ```
  http://localhost:3000/**
  https://scrivia-seven.vercel.app/**
  https://scrivia-ear-labs-projects.vercel.app/**
  https://scrivia-git-main-ear-labs-projects.vercel.app/**
  https://scrivia-*-ear-labs-projects.vercel.app/**
  ```
  L'ultima riga copre i **preview** di Vercel (un dominio per branch/commit).
  Se domani aggiungi un dominio custom, mettilo qui (`https://tuodominio.it/**`).

> Perché serve: un `emailRedirectTo` con un origin non in lista viene rifiutato
> da GoTrue e l'utente torna senza sessione. Nessun cambio di codice: l'app usa
> già `window.location.origin`, basta che ogni origin sia in allowlist.

---

## B — SMTP custom (serve per mandare email a chiunque)

L'SMTP **integrato** di Supabase è solo per test: invia **solo ai membri del
progetto** ed è limitato a poche email/ora. Per far accedere utenti reali serve
un **SMTP proprio**.

**Provider consigliato: Resend** (integrazione nativa Supabase, free tier
generoso). Alternative equivalenti: Brevo, SendGrid, Postmark, Amazon SES.

1. Crea l'account dal provider e **verifica un dominio mittente** (record DNS
   SPF/DKIM dal provider). Senza dominio verificato le email finiscono in spam.
2. **Dashboard:** Authentication → Emails → SMTP Settings → *Enable Custom SMTP*.
   Compila:
   - **Sender email**: es. `no-reply@tuodominio.it` (sul dominio verificato)
   - **Sender name**: `Scrivia`
   - **Host**: es. `smtp.resend.com`
   - **Port**: `465` (SSL) oppure `587` (STARTTLS)
   - **Username** / **Password**: le credenziali SMTP del provider
3. **Rate limits:** Authentication → Rate Limits → alza "Emails per hour" quanto
   serve (il default integrato è basso di proposito).

> **Segreti.** La password SMTP vive **solo nel dashboard Supabase**: mai nel
> repo, mai in `.env`, mai nei log. Non è una env dell'app (la gestisce GoTrue
> lato server).

---

## C — Template email (opzionale ma consigliato)

**Dashboard:** Authentication → Emails → *Magic Link*. Personalizza il testo in
italiano; lascia intatto `{{ .ConfirmationURL }}` (è il link che porta dentro).

---

## Verifica ("fatto" quando…)

1. Da `http://localhost:3000` (o dalla prod) inserisci una **email reale** nella
   barra di accesso → "Invia link".
2. Arriva l'email dal **mittente del tuo dominio** (non da Supabase).
3. Clicchi → torni sull'app **loggato** (la sessione viene rilevata dall'hash).
4. La home mostra le **tue** storie (non più solo l'esempio) e puoi piantarne di
   nuove: vengono salvate su Postgres sotto il tuo `user_id` (RLS).

## Note

- Niente di tutto questo tocca schema/RLS/bucket (congelati in
  `SUPABASE_SPEC.md`): è solo configurazione GoTrue + un provider esterno.
- Non c'è un tool MCP per scrivere queste impostazioni: vanno fatte a mano dal
  dashboard. Questo documento è la consegna; l'esecuzione è un gesto umano
  (autorità umana — vedi `CLAUDE.md`).
