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
import { buildProsaRequest, accumulateProseText } from "@/lib/ai/tasks/prosa";
import { sseJson } from "@/lib/ai/sse";
import type { StreamEvent } from "@/lib/ai/types";
import { auditDeterministic } from "@/lib/audit";
import { buildCriticRequest, parseCriticResponse, mergeCriticVerdict, withSemanticPending } from "@/lib/ai/tasks/critic";

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
    // Prosa reale: stream dall'API (SKILL_prosa + brief), pagina per pagina. La chiave è
    // server-side → POST /api/ai. Senza chiave (501) ricade sull'interim (esempio/stub).
    const out: ProsePage[] = [];
    let noKey = false;
    for (const pp of plan) {
      let text = "";
      if (!noKey) {
        const req = buildProsaRequest({ ...story, prose: out }, pp.page); // prose: out → continuità
        let res: Response | null = null;
        try {
          res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...req, stream: true }),
          });
        } catch { res = null; }
        if (res && res.ok) {
          const events: StreamEvent[] = [];
          try {
            for await (const ev of sseJson(res)) {
              events.push(ev as StreamEvent);
              setPages([...out, { page: pp.page, beat: pp.beat, text: accumulateProseText(events) }]); // live
            }
          } catch { /* fine stream */ }
          text = accumulateProseText(events).trim();
        } else {
          noKey = true; // niente chiave o errore → passa all'interim per tutte le pagine
        }
      }
      if (!text) {
        await tick(180);
        const ex = EXAMPLE_STORY.prose?.find((p) => p.page === pp.page);
        text = story.id === "esempio" && ex
          ? ex.text
          : `«[pagina ${pp.page} · ${pp.beat}]» — qui Claude rende il beat dal brief, ~70 parole, registro dato. ${pp.note}`;
      }
      out.push({ page: pp.page, beat: pp.beat, text });
      setPages([...out]);
    }
    const ms = Date.now() - t0;
    setWriteMs(ms);
    setWriting(false);
    update((s) => ({ ...s, prose: out }));
    log({
      actor: "claude",
      event: noKey ? "prosa (interim — collega una chiave per la scrittura reale)" : "prosa generata",
      detail: `${out.length} pagine`,
      durationMs: ms,
    });
  }

  async function runCritic() {
    setAuditing(true);
    const t0 = Date.now();
    let verdict: CriticVerdict;
    if (story.id === "esempio" && EXAMPLE_STORY.critic) {
      await tick(900); // demo: verdetto curato (la storia d'esempio)
      verdict = EXAMPLE_STORY.critic;
    } else {
      // Strati deterministici (sempre, senza chiave): regex + strutturale.
      verdict = auditDeterministic(story);
      // Strato semantico (se c'è una chiave): POST /api/ai (no stream) → JSON verdict.
      try {
        const req = buildCriticRequest(story);
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...req, stream: false }),
        });
        if (res.ok) {
          const data = await res.json();
          verdict = mergeCriticVerdict(verdict, parseCriticResponse(data?.text ?? ""));
        } else {
          verdict = withSemanticPending(verdict); // 501/errore: tieni il deterministico + nota
        }
      } catch {
        verdict = withSemanticPending(verdict);
      }
    }
    setCritic(verdict);
    const ms = Date.now() - t0;
    update((s) => ({ ...s, critic: verdict }));
    setAuditing(false);
    log({ actor: "det", event: "critic (strati)", detail: `${verdict.verdict} · ${verdict.checks.filter((c) => c.pass).length}/${verdict.checks.length}`, durationMs: ms });
  }

  return (
    <div className="space-y-5">
      {/* Il brief che guida la scrittura (B5): artefatto del back, ora visibile e leggibile */}
      <BriefPanel brief={story.brief} />
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
            <button onClick={generate} className="btn-claude mt-4 text-sm">
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
                <button onClick={generate} className="btn-soft text-sm">Rigenera</button>
                {critic?.verdict === "PASS" && (
                  <button onClick={() => goPhase?.("immagini")} className="btn-ink ml-auto text-sm">
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
                className="btn-claude mt-3 w-full text-sm"
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

// Il "writing brief" (lib/brief.ts, deterministico) è ciò da cui l'IA scrive la
// prosa. Era invisibile sul front: qui diventa leggibile (sola lettura, collassabile).
function BriefPanel({ brief }: { brief?: string }) {
  const [open, setOpen] = useState(false);
  if (!brief?.trim()) return null;
  return (
    <Panel
      title="Il brief — guida la scrittura"
      right={<ActorChip actor="det" />}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-ink-soft">
          Cosa l’IA legge per scrivere: ricetta strutturale, voce, semi (eco interne) e
          la tabella pagina-per-pagina. Deterministico, zero token.
        </p>
        <button onClick={() => setOpen((v) => !v)} className="btn-soft shrink-0 text-xs">
          {open ? "Nascondi" : "Mostra"}
        </button>
      </div>
      {open && <BriefBody md={brief} />}
    </Panel>
  );
}

function BriefBody({ md }: { md: string }) {
  return (
    <div className="mt-3 max-h-[460px] overflow-y-auto rounded-xl border border-line bg-paper p-3.5">
      {md.split("\n").map((line, i) => {
        if (line.startsWith("### ")) return <p key={i} className="eyebrow mt-3">{line.slice(4)}</p>;
        if (line.startsWith("## ")) return <h4 key={i} className="display mt-4 text-base">{line.slice(3)}</h4>;
        if (line.startsWith("# ")) return <h3 key={i} className="display mt-3 text-lg">{line.slice(2)}</h3>;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        // righe di contenuto (incluse le tabelle markdown): mono per leggere l'allineamento
        return <p key={i} className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-soft">{line}</p>;
      })}
    </div>
  );
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
