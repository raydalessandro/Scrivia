// lib/ai/tasks/critic.ts — Strato 3 del cancello: il critic SEMANTICO.
// Modo di guasto diverso dal prosatore: il prosatore ottimizza il flusso, il critic le
// "regole invisibili" (scheletro, moralina, semi pagati col senso, voce…). NON riscrive:
// giudica e basta, restituendo un verdetto JSON. Porta SKILL_critic. Si fonde con gli
// strati deterministici (lib/audit.ts). La chiave è server-side → POST /api/ai (no stream).

import type { Story, CriticCheck, CriticVerdict } from "@/lib/types";
import type { CompletionRequest } from "../types";
import { proseText, combineVerdict, type PageFlag } from "@/lib/audit";

export const CRITIC_SYSTEM = `Sei il critic: il terzo strato del cancello qualità di un albo illustrato per bambini. NON riscrivi — solo giudichi, "a freddo", leggendo solo il testo finale (più il brief). Prendi ciò che un controllo a regex non vede: il SENSO.

Controlla (e segna pass true/false con una nota breve in italiano):
- scheletro_invisibile (DURO): nessuna riga nomina o parafrasa in astratto i tre movimenti ("capì la differenza", "si sentì legato a lei", "qualcosa dentro di lui cambiò"). Il senso si mostra, non si dichiara.
- niente_moralina (DURO): nessun personaggio e nessun narratore spiega il significato o tira la lezione ("così imparò che gli amici…").
- chiusura_non_esplicativa: l'ultima pagina sigilla col tipo di chiusura dato, senza spiegare.
- soglia_come_gesto: alla pagina-soglia l'attraversamento è una decisione o un gesto concreto, non una presa di coscienza raccontata.
- semi_pagati: ogni seme introdotto torna con PESO DIVERSO (semanticamente, non basta la parola).
- registro: la prosa sta nella banda di registro data.
- banalita: c'è almeno un dettaglio non-funzionale, un pensiero laterale, un momento "vuoto".
- dettaglio_personale: intessuto con naturalezza, non esibito.
- frasi_da_mille_storie: righe generiche che potrebbero stare in qualsiasi storia.
- voce_narratore: le carte degli assi attivi sono onorate, i loro evita-tic rispettati.
- idioletti_distinti: ogni personaggio ha una firma costante e diversa dagli altri.
- texture_luogo: la firma sensoriale del luogo ritorna coerente.
- sa_di_spec (rischio chiave): la prosa suona rigida, "da compito", iper-specificata? Se la voce si vede invece di sentirsi → flag.

Una sola check DURA che fallisce (scheletro_invisibile o niente_moralina) → verdetto FAIL.

Rispondi SOLO con un oggetto JSON valido (nessun testo prima o dopo, niente \`\`\`):
{"verdict":"PASS|FAIL","checks":{"scheletro_invisibile":{"pass":true,"note":""},"niente_moralina":{"pass":true,"note":""},"chiusura_non_esplicativa":{"pass":true,"note":""},"soglia_come_gesto":{"pass":true,"note":""},"semi_pagati":{"pass":true,"note":""},"registro":{"pass":true,"note":""},"banalita":{"pass":true,"note":""},"dettaglio_personale":{"pass":true,"note":""},"frasi_da_mille_storie":{"pass":true,"note":""},"voce_narratore":{"pass":true,"note":""},"idioletti_distinti":{"pass":true,"note":""},"texture_luogo":{"pass":true,"note":""},"sa_di_spec":{"pass":true,"note":""}},"page_flags":[{"page":0,"severity":"soft","issue":""}]}`;

const LABELS: Record<string, string> = {
  scheletro_invisibile: "Scheletro invisibile", niente_moralina: "Niente moralina",
  chiusura_non_esplicativa: "Chiusura non esplicativa", soglia_come_gesto: "Soglia come gesto",
  semi_pagati: "Semi pagati", registro: "Registro", banalita: "Banalità", dettaglio_personale: "Dettaglio personale",
  frasi_da_mille_storie: "Frasi da mille storie", voce_narratore: "Voce del narratore",
  idioletti_distinti: "Idioletti distinti", texture_luogo: "Texture del luogo", sa_di_spec: "Sa di spec",
};

/** Richiesta non-streaming per il giudizio (puro: niente rete, testabile). */
export function buildCriticRequest(story: Story): CompletionRequest {
  const text = proseText(story.prose);
  const brief = story.brief?.trim() || "(brief non disponibile)";
  const user = `Giudica questa storia (NON riscrivere). Restituisci SOLO il JSON del verdetto.\n\n## BRIEF\n${brief}\n\n## STORIA\n${text}`;
  return { system: CRITIC_SYSTEM, messages: [{ role: "user", content: user }], task: "critic" };
}

function extractJson(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

/** Verdetto JSON del modello → check + flag (forma neutra del progetto). */
export function parseCriticResponse(raw: string): { checks: CriticCheck[]; page_flags: PageFlag[] } {
  const data = extractJson(raw);
  if (!data) {
    return { checks: [], page_flags: [{ page: 0, severity: "soft", issue: "verdetto semantico non interpretabile" }] };
  }
  const checks: CriticCheck[] = [];
  const raw_checks = (data.checks ?? {}) as Record<string, { pass?: boolean; note?: string }>;
  for (const [key, r] of Object.entries(raw_checks)) {
    checks.push({ key, label: LABELS[key] ?? key, pass: r?.pass !== false, note: (r?.note ?? "").trim() });
  }
  const page_flags: PageFlag[] = Array.isArray(data.page_flags)
    ? (data.page_flags as PageFlag[])
        .filter((f) => f && typeof f.page === "number" && (f.issue ?? "").toString().trim())
        .map((f) => ({ page: f.page, severity: f.severity === "hard" ? "hard" : "soft", issue: String(f.issue).trim() }))
    : [];
  return { checks, page_flags };
}

/** Fonde gli strati deterministici col semantico e RICALCOLA il verdetto. */
export function mergeCriticVerdict(deterministic: CriticVerdict, semantic: { checks: CriticCheck[]; page_flags: PageFlag[] }): CriticVerdict {
  const checks = [...deterministic.checks, ...semantic.checks];
  const page_flags = [...deterministic.page_flags, ...semantic.page_flags];
  return { verdict: combineVerdict(checks, page_flags), checks, page_flags };
}

/** Senza chiave: aggiunge una nota e tiene il verdetto deterministico. */
export function withSemanticPending(deterministic: CriticVerdict): CriticVerdict {
  return {
    ...deterministic,
    checks: [...deterministic.checks, { key: "critic_semantico", label: "Critic semantico", pass: true, note: "non eseguito — collega una chiave per il giudizio sul senso" }],
  };
}
