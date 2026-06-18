// lib/ai/tasks/prosa.ts — M2: la prosa in streaming, pagina per pagina, dal brief.
// Porta SKILL_prosa adattato al contesto in-app. Regola d'ingresso: BRIEF-FIRST — il
// writing brief (story.brief, prodotto da B5) porta la tabella per-pagina, la voce, i
// semi e i marcatori (APERTURA/SOGLIA/CHIUSURA). Lo scheletro resta INVISIBILE.
//
// La chiave è server-side: il componente fa POST /api/ai (stream) con questa richiesta.

import type { Story } from "@/lib/types";
import type { CompletionRequest, StreamEvent } from "../types";

export const PROSA_SYSTEM = `Scrivi la prosa di un albo illustrato per bambini, UNA PAGINA ALLA VOLTA, a partire dal WRITING BRIEF qui sotto. Regola d'ingresso: brief-first — segui la tabella del brief, non altre storie.

Come scrivere ogni pagina:
- Poche frasi, nel registro indicato dal brief, circa 70 parole. Una pagina = un beat.
- Sulla prima pagina esegui l'apertura del tipo indicato; sull'ultima la chiusura del tipo indicato. Non tirare MAI una morale.
- Pianta e paga i semi dove il brief lo dice: il ritorno di un seme ha peso diverso e nessuno lo fa notare.
- Alla soglia (la pagina indicata) fai accadere l'attraversamento come una DECISIONE o un GESTO concreto, non una frase che spiega un cambiamento interno.
- Intessi il dettaglio personale con naturalezza, mai esibito.
- Budget di banalità: almeno un dettaglio non-funzionale, un pensiero laterale, un momento "vuoto". Il mondo continua oltre la cornice.

La voce (plasma, non detta): onora le carte del narratore (fai / evita-tic / lessico) degli assi attivi; ogni personaggio ha un idioletto = firma costante e distinta (uno non suona come l'altro); la texture del luogo ritorna sottile su ogni pagina. Se per rispettare una carta la frase si irrigidisce, molla la carta e tieni la frase viva: la voce si deve sentire, non vedere.

Lo scheletro resta invisibile: non scrivere MAI i tre movimenti (accorgersi / avvicinarsi / cambiare) né frasi come "capì che", "da quel giorno", "qualcosa cambiò dentro di lui". Si mostra, non si spiega.

Output: SOLO il testo narrativo della pagina richiesta. Nessun titolo, numero di pagina, marcatore o virgolette di cornice.`;

/** Ultima frase (per la continuità tra pagine), troncata. */
function lastSentence(text: string): string {
  const parts = text.trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : text.trim();
  return last.length > 160 ? "…" + last.slice(-160) : last;
}

/** Richiesta per scrivere UNA pagina (puro: niente rete, testabile). */
export function buildProsaRequest(story: Story, page: number): CompletionRequest {
  const brief = story.brief?.trim() || "(writing brief non disponibile — rendi comunque il beat della pagina con il contesto che hai.)";
  const pp = (story.pagePlan ?? []).find((p) => p.page === page);
  const beat = pp?.beat ?? "";
  const prev = (story.prose ?? []).find((p) => p.page === page - 1);
  const prevTail = prev?.text ? `La pagina precedente finiva con: «${lastSentence(prev.text)}». Prosegui con naturalezza, senza ripeterti.` : "";
  const user = [
    `Scrivi la prosa della PAGINA ${page}${beat ? ` (beat: ${beat})` : ""}.`,
    `Segui la riga della pagina ${page} nella tabella del brief: cosa accade, eventuali semi da piantare o pagare, e se è la pagina di APERTURA, SOGLIA o CHIUSURA.`,
    prevTail,
    `Scrivi SOLO il testo narrativo di questa pagina (~70 parole), senza titoli, numeri o marcatori.`,
  ].filter(Boolean).join(" ");

  return {
    system: `${PROSA_SYSTEM}\n\n## WRITING BRIEF\n${brief}`,
    messages: [{ role: "user", content: user }],
    task: "prosa",
  };
}

/** Accumula il testo dai delta dello stream (ignora eventuali tool-call). */
export function accumulateProseText(events: StreamEvent[]): string {
  let text = "";
  for (const ev of events) if (ev.type === "text") text += ev.delta;
  return text;
}

/** Scrive/sostituisce la pagina nella prosa della storia. */
export function applyProsaPage(story: Story, page: number, beat: string, text: string): Story {
  const clean = text.trim();
  const prose = (story.prose ?? []).filter((p) => p.page !== page);
  prose.push({ page, beat, text: clean });
  prose.sort((a, b) => a.page - b.page);
  return { ...story, prose };
}
