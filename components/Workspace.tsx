"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadStory, saveStory } from "@/lib/store";
import { deriveStages, PHASES, STAGE_TO_PHASE } from "@/lib/stages";
import type { Story, PhaseId, LedgerEvent } from "@/lib/types";
import { ACTOR_META } from "@/lib/enums";
import { Stem } from "./Stem";
import { PhaseModelChip } from "./ai/PhaseModelChip";
import { Ledger } from "./Ledger";
import { Phase1Seeding } from "./phases/Phase1Seeding";
import { Phase2Prosa } from "./phases/Phase2Prosa";
import { Phase3Immagini } from "./phases/Phase3Immagini";
import { Phase4Libro } from "./phases/Phase4Libro";

// Ogni fase ha l'attore che la "guida": il colore lo dice anche nel passo-passo.
const PHASE_ACTOR: Record<PhaseId, keyof typeof ACTOR_META> = {
  seeding: "you",
  prosa: "claude",
  immagini: "manus",
  libro: "det",
};
const PHASE_SHORT: Record<PhaseId, string> = {
  seeding: "Progetta",
  prosa: "Prosa",
  immagini: "Immagini",
  libro: "Libro",
};

export function Workspace({ id }: { id: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [phase, setPhase] = useState<PhaseId>("seeding");
  const [notFound, setNotFound] = useState(false);
  const [processOpen, setProcessOpen] = useState(false); // mobile: il processo è secondario

  useEffect(() => {
    const s = loadStory(id);
    if (!s) return setNotFound(true);
    setStory(s);
    // Apri sulla fase più avanzata raggiunta.
    if (s.prose && !s.manus?.some((m) => m.imageUrl)) setPhase("immagini");
    else if (s.prose) setPhase("libro");
    else setPhase("seeding");
  }, [id]);

  const stages = useMemo(() => (story ? deriveStages(story) : []), [story]);

  function update(mut: (s: Story) => Story) {
    setStory((prev) => {
      if (!prev) return prev;
      const next = mut(structuredClone(prev));
      saveStory(next);
      return next;
    });
  }
  function log(e: Omit<LedgerEvent, "ts">) {
    update((s) => ({ ...s, ledger: [...s.ledger, { ...e, ts: new Date().toISOString() }] }));
  }

  if (notFound)
    return (
      <Centered>
        <p className="text-ink-soft">Storia non trovata.</p>
        <Link href="/" className="mt-3 underline">← Le mie storie</Link>
      </Centered>
    );
  if (!story) return <Centered><div className="shimmer h-6 w-40 rounded" /></Centered>;

  const active = PHASES.find((p) => p.id === phase)!;

  return (
    <>
      {/* ----- barra in alto, fissa: ritorno · titolo · fase corrente ----- */}
      <header
        className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3">
          <Link
            href="/"
            aria-label="Le mie storie"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-paper-3 hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="serif min-w-0 flex-1 truncate text-[17px] font-semibold leading-tight">{story.title}</h1>
          <span className="hidden shrink-0 sm:block"><PhaseModelChip phase={phase} compact /></span>
        </div>

        {/* ----- stepper: tutte e 4 le fasi, sempre visibili, colore = attore ----- */}
        <nav className="mx-auto max-w-6xl px-3 pb-3" aria-label="Fasi">
          <ol className="flex items-center">
            {PHASES.map((p, i) => {
              const m = ACTOR_META[PHASE_ACTOR[p.id]];
              const isActive = p.id === phase;
              const reached = phaseReached(story, p.id);
              const complete = phaseComplete(story, p.id);
              return (
                <li key={p.id} className="flex flex-1 items-center last:flex-none">
                  <button
                    onClick={() => reached && setPhase(p.id)}
                    disabled={!reached}
                    aria-current={isActive ? "step" : undefined}
                    className="group flex flex-col items-center gap-1 disabled:cursor-not-allowed"
                  >
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full border-2 text-[13px] font-bold tabular-nums transition"
                      style={{
                        background: isActive ? m.bg : complete ? m.color : "var(--color-paper-2)",
                        borderColor: reached ? m.color : "var(--color-line-2)",
                        color: complete && !isActive ? "#fff" : reached ? m.color : "var(--color-ink-faint)",
                        boxShadow: isActive ? "0 0 0 4px " + m.bg : "none",
                      }}
                    >
                      {complete && !isActive ? "✓" : p.n}
                    </span>
                    <span
                      className="text-[10px] font-semibold tracking-wide transition"
                      style={{ color: isActive ? m.color : reached ? "var(--color-ink-soft)" : "var(--color-ink-faint)" }}
                    >
                      {PHASE_SHORT[p.id]}
                    </span>
                  </button>
                  {i < PHASES.length - 1 && (
                    <span
                      className="mx-1 -mt-4 h-0.5 flex-1 rounded-full transition"
                      style={{ background: phaseComplete(story, p.id) ? m.color : "var(--color-line-2)" }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-28 pt-4 sm:px-4">
        {/* titolo della fase corrente: orientamento immediato */}
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow" style={{ color: ACTOR_META[PHASE_ACTOR[phase]].color }}>Fase {active.n}</p>
            <h2 className="display text-2xl leading-tight">{active.label}</h2>
          </div>
          <span className="sm:hidden"><PhaseModelChip phase={phase} compact /></span>
        </div>

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
          {/* ----- pannello fase attiva: PRIMA su mobile ----- */}
          <section className="order-1 min-w-0 lg:order-2">
            {phase === "seeding" && <Phase1Seeding story={story} update={update} log={log} goPhase={setPhase} />}
            {phase === "prosa" && <Phase2Prosa story={story} update={update} log={log} goPhase={setPhase} />}
            {phase === "immagini" && <Phase3Immagini story={story} update={update} log={log} goPhase={setPhase} />}
            {phase === "libro" && <Phase4Libro story={story} update={update} log={log} />}
          </section>

          {/* ----- stelo + registro: secondari su mobile (richiudibili), rail su desktop ----- */}
          <aside className="order-2 lg:order-1 lg:sticky lg:top-32 lg:self-start">
            <button
              onClick={() => setProcessOpen((v) => !v)}
              aria-expanded={processOpen}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-paper-2 px-4 py-3 text-left shadow-sm transition hover:bg-paper-3 lg:hidden"
            >
              <span className="eyebrow">Il processo · i tempi</span>
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                className="text-ink-soft transition-transform" style={{ transform: processOpen ? "rotate(180deg)" : "none" }} aria-hidden
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className={`${processOpen ? "mt-4 block" : "hidden"} space-y-4 lg:mt-0 lg:block`}>
              <Panel title="Il processo">
                <Stem
                  stages={stages}
                  activeId={stages.find((s) => STAGE_TO_PHASE[s.id] === phase)?.id}
                  onSelect={(sid) => {
                    const ph = STAGE_TO_PHASE[sid as keyof typeof STAGE_TO_PHASE];
                    if (phaseReached(story, ph)) setPhase(ph);
                  }}
                />
              </Panel>
              <Panel title="Registro · i tempi">
                <Ledger events={story.ledger} />
              </Panel>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function phaseReached(story: Story, phase: PhaseId): boolean {
  if (phase === "seeding") return true;
  if (phase === "prosa") return !!story.pagePlan;
  if (phase === "immagini") return !!story.prose;
  if (phase === "libro") return !!story.prose;
  return false;
}

// solo per la grafica dello stepper: una fase è "compiuta" quando il suo esito c'è.
function phaseComplete(story: Story, phase: PhaseId): boolean {
  if (phase === "seeding") return !!story.pagePlan;
  if (phase === "prosa") return !!story.prose;
  if (phase === "immagini") return !!story.manus && story.manus.length > 0 && story.manus.every((m) => m.imageUrl);
  if (phase === "libro") return story.stage === "book";
  return false;
}

export function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="eyebrow">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center px-6"><div className="text-center">{children}</div></main>;
}
