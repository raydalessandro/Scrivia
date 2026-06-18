// lib/audit.ts — Cancello qualità a STRATI (parte deterministica).
// Tre strati a guasto indipendente (port di audit_story.py): 1) regex (cliché letterali
// da PATTERN_DA_BANDIRE / quote di seme_config.yaml), 2) strutturale (forma: copertura
// pagine, semi piantati/pagati, soglia), 3) semantico LLM (in lib/ai/tasks/critic.ts).
// Qui gli strati 1-2 + il combinatore del verdetto. Verdetto = FAIL se UN check duro fallisce.

import type { Story, StoryNode, ProsePage, CriticCheck, CriticVerdict } from "./types";

export type PageFlag = { page: number; severity: string; issue: string };

// I check "duri": se falliscono, il verdetto è FAIL (gli altri sono note/soft).
export const HARD_KEYS = new Set<string>([
  // deterministici
  "frasi_bandite", "copertura_pagine", "semi_ripresi", "soglia_presente",
  // semantici (SKILL_critic)
  "scheletro_invisibile", "niente_moralina",
]);

/** Assembla la prosa in un unico testo (per lo strato regex). */
export function proseText(prose: ProsePage[] | undefined): string {
  return (prose ?? []).map((p) => p.text).join("\n\n");
}

// --- Strato 1 — regex (quote lessicali) ------------------------------------
// Quota 0 → violazione DURA. Quote basse / famiglia 'sorrise' → soft (page_flags).
const QUOTA0: { re: RegExp; label: string }[] = [
  { re: /\bin quel momento (?:capì|capisce)\b/gi, label: "in quel momento capì" },
  { re: /\bda quel giorno\b/gi, label: "da quel giorno" },
  { re: /\bnon (?:sarebbe|fu) mai più lo stesso\b/gi, label: "non sarebbe mai più lo stesso" },
];
const LOW_QUOTA: { re: RegExp; max: number; label: string }[] = [
  { re: /\b(?:imparò|impara|capì) che\b/gi, max: 1, label: "imparò/capì che" },
  { re: /\bil suo cuore\b/gi, max: 1, label: "il suo cuore" },
  { re: /\bun brivido\b/gi, max: 1, label: "un brivido" },
];
const PIANO_FAMILY = [/\bsorrise\b/gi, /\bsorri(?:de|sero)\b/gi];
const PIANO_MAX = 3;

const count = (text: string, re: RegExp): number => (text.match(re) || []).length;

export function auditRegex(text: string): { check: CriticCheck; flags: PageFlag[] } {
  const flags: PageFlag[] = [];
  const banned: string[] = [];
  for (const q of QUOTA0) { const n = count(text, q.re); if (n > 0) banned.push(`«${q.label}» ${n}×`); }
  for (const q of LOW_QUOTA) { const n = count(text, q.re); if (n > q.max) flags.push({ page: 0, severity: "soft", issue: `«${q.label}» ${n}× (max ${q.max})` }); }
  const piano = PIANO_FAMILY.reduce((s, re) => s + count(text, re), 0);
  if (piano > PIANO_MAX) flags.push({ page: 0, severity: "soft", issue: `famiglia 'sorrise' ${piano}× (max ${PIANO_MAX})` });

  const check: CriticCheck = {
    key: "frasi_bandite",
    label: "Frasi bandite (cliché AI a quota 0)",
    pass: banned.length === 0,
    note: banned.length ? banned.join(" · ") : "nessuna frase bandita",
  };
  return { check, flags };
}

// --- Strato 2 — strutturale (forma) ----------------------------------------
export function auditStruct(prose: ProsePage[] | undefined, node: StoryNode | undefined): { checks: CriticCheck[]; flags: PageFlag[] } {
  const checks: CriticCheck[] = [];
  const flags: PageFlag[] = [];
  if (!node) {
    checks.push({ key: "copertura_pagine", label: "Copertura pagine", pass: false, note: "nodo non costruito: forma non verificabile" });
    return { checks, flags };
  }
  const pages = (prose ?? []).map((p) => p.page).sort((a, b) => a - b);
  const expected = Array.from({ length: node.pages }, (_, i) => i + 1);
  const coverOk = pages.length === expected.length && expected.every((p, i) => pages[i] === p);
  checks.push({
    key: "copertura_pagine", label: "Copertura pagine",
    pass: coverOk, note: coverOk ? `${node.pages} pagine, tutte presenti` : `trovate [${pages.join(", ")}], attese 1..${node.pages}`,
  });

  const missing: string[] = [];
  for (const s of node.seeds ?? []) {
    if (!pages.includes(s.planted_page)) missing.push(`${s.id}: manca pianta p${s.planted_page}`);
    if (!pages.includes(s.payoff_page)) missing.push(`${s.id}: manca ritorno p${s.payoff_page}`);
  }
  checks.push({
    key: "semi_ripresi", label: "Semi piantati e ripresi",
    pass: missing.length === 0, note: missing.length ? missing.join(" · ") : "tutti i semi hanno pianta e ritorno",
  });

  const thrOk = !node.threshold_page || pages.includes(node.threshold_page);
  checks.push({
    key: "soglia_presente", label: "Pagina-soglia presente",
    pass: thrOk, note: thrOk ? `soglia a p${node.threshold_page}` : `manca la pagina-soglia p${node.threshold_page}`,
  });
  return { checks, flags };
}

// --- Verdetto ---------------------------------------------------------------
/** FAIL se un check DURO fallisce o un page_flag è 'hard'; altrimenti PASS. */
export function combineVerdict(checks: CriticCheck[], pageFlags: PageFlag[]): "PASS" | "FAIL" {
  const hardFail =
    checks.some((c) => HARD_KEYS.has(c.key) && !c.pass) ||
    pageFlags.some((f) => f.severity === "hard");
  return hardFail ? "FAIL" : "PASS";
}

/** Strati deterministici (regex + strutturale) → verdetto parziale (senza il semantico). */
export function auditDeterministic(story: Story): CriticVerdict {
  const text = proseText(story.prose);
  const r = auditRegex(text);
  const s = auditStruct(story.prose, story.node);
  const checks: CriticCheck[] = [r.check, ...s.checks];
  const page_flags: PageFlag[] = [...r.flags, ...s.flags];
  return { verdict: combineVerdict(checks, page_flags), checks, page_flags };
}
