"use client";

// FASE 2 — Scrivi la prosa (✋ cancello creativo). Qui si vede "il tempo quando
// lavora l'IA": le pagine appaiono una a una mentre Claude scrive, col cronometro
// che gira. Poi il critic, secondo passaggio, come checklist a strati.

import { useEffect, useRef, useState } from "react";
import type { ProsePage, CriticVerdict } from "@/lib/types";
import { Panel } from "../Workspace";
import { ActorChip, Stopwatch, Pill } from "../ui";
import type { PhaseProps } from "./types";
import { EXAMPLE_STORY } from "@/lib/example";

export function Phase2Prosa({ story, update, log, goPhase }: PhaseProps) {
  const [pages, setPages] = useState<ProsePage[]>(story.prose ?? []);
  const [writing, setWriting] = useState(false);
  const [writeMs, setWriteMs] = useState<number>();
  const [auditing, setAuditing] = useState(false);
  const [critic, setCritic] = useState<CriticVerdict | undefined>(story.critic);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [pages]);

  const plan = story.pagePlan ?? [];

  async function generate() {
    setWriting(true);
    setPages([]);
    setCritic(undefined);
    const t0 = Date.now();
    // In produzione: stream dall'API di Claude (skill/SKILL_prosa.md). Qui mostriamo
    // il flusso, riusando la prosa d'esempio dove c'è, o uno stub onesto altrimenti.
    const out: ProsePage[] = [];
    for (const pp of plan) {
      await tick(420);
      const ex = EXAMPLE_STORY.prose?.find((p) => p.page === pp.page);
      const text =
        story.id === "esempio" && ex
          ? ex.text
          : `«[pagina ${pp.page} · ${pp.beat}]» — qui Claude rende il beat dal brief, ~70 parole, registro dato. ${pp.note}`;
      out.push({ page: pp.page, beat: pp.beat, text });
      setPages([...out]);
    }
    const ms = Date.now() - t0;
    setWriteMs(ms);
    setWriting(false);
    update((s) => ({ ...s, prose: out }));
    log({ actor: "claude", event: "prosa generata", detail: `${out.length} pagine`, durationMs: ms });
  }

  async function runCritic() {
    setAuditing(true);
    const t0 = Date.now();
    await tick(1600);
    const v: CriticVerdict =
      story.id === "esempio" && EXAMPLE_STORY.critic
        ? EXAMPLE_STORY.critic
        : DEFAULT_CRITIC;
    setCritic(v);
    setAuditing(false);
    const ms = Date.now() - t0;
    update((s) => ({ ...s, critic: v }));
    log({ actor: "claude", event: "audit (critic)", detail: `${v.verdict} · ${v.checks.filter((c) => c.pass).length}/${v.checks.length}`, durationMs: ms });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Panel
        title="Prosa"
        right={
          <span className="flex items-center gap-2">
            {writing && <span className="flex items-center gap-1.5 text-xs text-claude"><span className="ai-pulse inline-block h-2 w-2 rounded-full bg-claude" />scrive… <Stopwatch running /></span>}
            {!writing && writeMs != null && <Pill tone="ok"><Stopwatch running={false} finalMs={writeMs} /></Pill>}
            <ActorChip actor="claude" />
          </span>
        }
      >
        {pages.length === 0 && !writing ? (
          <div className="py-10 text-center">
            <p className="text-ink-soft">L’IA scrive le pagine dal brief, una a una.</p>
            <button onClick={generate} className="mt-4 rounded-xl bg-claude px-5 py-2.5 text-sm font-semibold text-white">
              Genera la prosa
            </button>
          </div>
        ) : (
          <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
            {pages.map((p) => (
              <article key={p.page} className="reveal">
                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-soft">
                  <span className="tabular-nums">pagina {p.page}</span>
                  <span className="rounded bg-line/60 px-1.5">{p.beat}</span>
                </div>
                <p className="serif leading-relaxed text-ink">{p.text}</p>
              </article>
            ))}
            {writing && (
              <div className="flex items-center gap-2 text-sm text-claude">
                <span className="ai-pulse inline-block h-2.5 w-2.5 rounded-full bg-claude" />
                sta scrivendo pagina {pages.length + 1} di {plan.length}…
              </div>
            )}
            <div ref={endRef} />
            {!writing && pages.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <button onClick={generate} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-paper">Rigenera</button>
                {critic?.verdict === "PASS" && (
                  <button onClick={() => goPhase?.("immagini")} className="ml-auto rounded-lg bg-ink px-4 py-1.5 text-sm font-semibold text-paper">
                    Vai alle illustrazioni →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Critic */}
      <div className="space-y-5">
        <Panel title="Critic — audit a strati" right={<ActorChip actor="claude" />}>
          {!critic && !auditing && (
            <div className="text-sm text-ink-soft">
              <p>Un secondo passaggio, isolato: controlla che la prosa non scivoli nei cliché o nella morale spiegata.</p>
              <button
                onClick={runCritic}
                disabled={pages.length === 0 || writing}
                className="mt-3 w-full rounded-xl bg-claude py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Lancia il critic
              </button>
            </div>
          )}
          {auditing && (
            <div className="flex items-center gap-2 text-sm text-claude">
              <span className="ai-pulse inline-block h-2.5 w-2.5 rounded-full bg-claude" /> legge la prosa… <Stopwatch running />
            </div>
          )}
          {critic && <CriticChecklist v={critic} />}
        </Panel>
      </div>
    </div>
  );
}

function CriticChecklist({ v }: { v: CriticVerdict }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.verdict === "PASS" ? "bg-manus-bg text-manus" : "bg-gate-bg text-gate"}`}>
          {v.verdict}
        </span>
        <span className="text-xs text-ink-soft">{v.checks.filter((c) => c.pass).length}/{v.checks.length} controlli</span>
      </div>
      <ul className="space-y-1.5">
        {v.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            <span className={c.pass ? "text-manus" : "text-gate"}>{c.pass ? "✓" : "✗"}</span>
            <span>
              <span className="text-ink">{c.label}</span>
              <span className="block text-xs text-ink-soft">{c.note}</span>
            </span>
          </li>
        ))}
      </ul>
      {v.page_flags.length > 0 && (
        <div className="rounded-lg bg-github-bg/60 p-2 text-xs text-github">
          {v.page_flags.map((f, i) => (
            <p key={i}>⚠ p{f.page} ({f.severity}): {f.issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_CRITIC: CriticVerdict = {
  verdict: "PASS",
  checks: [
    { key: "scheletro_invisibile", label: "Scheletro invisibile", pass: true, note: "i tre movimenti non sono nominati" },
    { key: "niente_moralina", label: "Niente moralina", pass: true, note: "nessuno spiega il senso" },
    { key: "chiusura_non_esplicativa", label: "Chiusura non esplicativa", pass: true, note: "la chiusura sigilla, non spiega" },
    { key: "soglia_come_gesto", label: "Soglia come gesto", pass: true, note: "alla soglia accade un gesto concreto" },
    { key: "semi_pagati", label: "Semi pagati", pass: true, note: "i semi tornano con peso diverso" },
  ],
  page_flags: [],
};

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
