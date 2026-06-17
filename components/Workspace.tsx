"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadStory, saveStory } from "@/lib/store";
import { deriveStages, PHASES, STAGE_TO_PHASE } from "@/lib/stages";
import type { Story, PhaseId, LedgerEvent } from "@/lib/types";
import { Stem } from "./Stem";
import { PhaseModelChip } from "./ai/PhaseModelChip";
import { Ledger } from "./Ledger";
import { Phase1Seeding } from "./phases/Phase1Seeding";
import { Phase2Prosa } from "./phases/Phase2Prosa";
import { Phase3Immagini } from "./phases/Phase3Immagini";
import { Phase4Libro } from "./phases/Phase4Libro";

export function Workspace({ id }: { id: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [phase, setPhase] = useState<PhaseId>("seeding");
  const [notFound, setNotFound] = useState(false);

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

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">← Le mie storie</Link>
        <h1 className="serif truncate text-lg font-semibold">{story.title}</h1>
        <span className="w-24" />
      </div>

      {/* Tab delle 4 fasi */}
      <nav className="mt-4 flex gap-1.5 overflow-x-auto">
        {PHASES.map((p) => {
          const active = p.id === phase;
          const reached = phaseReached(story, p.id);
          return (
            <button
              key={p.id}
              onClick={() => reached && setPhase(p.id)}
              disabled={!reached}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                active
                  ? "border-ink bg-ink text-paper"
                  : reached
                  ? "border-line bg-paper-2 hover:bg-paper"
                  : "border-line bg-paper-2 opacity-45"
              }`}
            >
              <span className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold ${active ? "bg-paper/20" : "bg-line"}`}>
                {p.n}
              </span>
              {p.label}
            </button>
          );
        })}
      </nav>

      <PhaseModelChip phase={phase} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Rail sinistra: stelo + registro */}
        <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
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
        </aside>

        {/* Pannello fase attiva */}
        <section className="min-w-0">
          {phase === "seeding" && <Phase1Seeding story={story} update={update} log={log} goPhase={setPhase} />}
          {phase === "prosa" && <Phase2Prosa story={story} update={update} log={log} goPhase={setPhase} />}
          {phase === "immagini" && <Phase3Immagini story={story} update={update} log={log} goPhase={setPhase} />}
          {phase === "libro" && <Phase4Libro story={story} update={update} log={log} />}
        </section>
      </div>
    </main>
  );
}

function phaseReached(story: Story, phase: PhaseId): boolean {
  if (phase === "seeding") return true;
  if (phase === "prosa") return !!story.pagePlan;
  if (phase === "immagini") return !!story.prose;
  if (phase === "libro") return !!story.prose;
  return false;
}

export function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center"><div className="text-center">{children}</div></main>;
}
