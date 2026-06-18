"use client";

// FASE 4 — Monta il libro. Deterministico: prosa + immagini → pagine A5. Anteprima
// sfogliabile; esporta in PDF (Stampa del browser). Specchio di build_book.py.

import { useState } from "react";
import { Panel } from "../Workspace";
import { ActorChip, Pill } from "../ui";
import type { PhaseProps } from "./types";

export function Phase4Libro({ story, update, log }: PhaseProps) {
  const [assembled, setAssembled] = useState(story.stage === "book");
  const [i, setI] = useState(0);
  const pages = story.prose ?? [];
  const imgFor = (p: number) => story.manus?.find((m) => m.page === p)?.imageUrl;

  function assemble() {
    setAssembled(true);
    update((s) => ({ ...s, stage: "book" }));
    log({ actor: "det", event: "libro montato", detail: "libro.html → PDF A5", durationMs: 210 });
  }

  if (!assembled)
    return (
      <Panel title="Monta il libro" right={<ActorChip actor="det" />}>
        <div className="py-10 text-center">
          <p className="text-ink-soft">Un comando e il libro è impaginato: pagina e immagine insieme, formato A5.</p>
          <button onClick={assemble} className="btn-ink mt-4 text-sm">
            Monta il libro
          </button>
        </div>
      </Panel>
    );

  const cur = pages[i];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Pill tone="ok">✓ montato · {pages.length} pagine</Pill>
        <button onClick={() => window.print()} className="btn-ink text-sm">
          Stampa / PDF A5
        </button>
      </div>

      {/* Anteprima pagina A5 */}
      <div className="mx-auto w-full max-w-sm">
        <div className="aspect-[148/210] overflow-hidden rounded-lg border border-line bg-[#f0f5ec] shadow-lg">
          <div className="flex h-[58%] items-center justify-center bg-[#e7eee1] p-3">
            {cur && imgFor(cur.page) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgFor(cur.page)} alt="" className="max-h-full max-w-full rounded shadow" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-line-2 text-center text-xs text-ink-soft">
                illustrazione p{cur?.page} — da Manus
              </div>
            )}
          </div>
          <div className="serif flex h-[42%] items-center px-6 text-[15px] leading-relaxed text-ink">
            {cur?.text}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="Pagina precedente" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-paper-2 text-lg shadow-sm transition active:scale-95 disabled:opacity-30">‹</button>
          <span className="text-sm tabular-nums text-ink-soft">{i + 1} / {pages.length}</span>
          <button onClick={() => setI((x) => Math.min(pages.length - 1, x + 1))} disabled={i === pages.length - 1} aria-label="Pagina successiva" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-paper-2 text-lg shadow-sm transition active:scale-95 disabled:opacity-30">›</button>
        </div>
      </div>

      <p className="text-center text-xs text-ink-soft">La storia è diventata un libro.</p>
    </div>
  );
}
