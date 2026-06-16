"use client";

// FASE 3 — Le illustrazioni (✋ in Manus). I prompt sono già pronti, blindati
// (blocchi fissi STYLESHEET / CHARACTER CONSISTENCY). Qui l'utente li copia in
// Manus e rimette le immagini, una per pagina. Upload locale ora; in futuro
// Supabase Storage (e, più avanti, generazione diretta + video).

import { useState } from "react";
import { Panel } from "../Workspace";
import { ActorChip, Pill } from "../ui";
import type { PhaseProps } from "./types";

export function Phase3Immagini({ story, update, log, goPhase }: PhaseProps) {
  const manus = story.manus ?? [];
  const [open, setOpen] = useState<number | null>(0);
  const done = manus.filter((m) => m.imageUrl).length;

  function setImage(page: number, url: string) {
    update((s) => ({
      ...s,
      manus: s.manus?.map((m) => (m.page === page ? { ...m, imageUrl: url } : m)),
    }));
    if (done + 1 === manus.length) log({ actor: "manus", event: "illustrazioni", detail: `${manus.length}/${manus.length} pagine` });
  }

  function onFile(page: number, file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImage(page, url);
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Illustrazioni — i prompt sono pronti"
        right={
          <span className="flex items-center gap-2">
            <Pill tone={done === manus.length ? "ok" : "neutral"}>{done}/{manus.length} illustrate</Pill>
            <ActorChip actor="manus" />
          </span>
        }
      >
        <p className="text-sm text-ink-soft">
          Apri <b>Manus</b>, collegalo alla stessa storia. Incolla prima i blocchi fissi (li trovi qui sotto),
          poi pagina per pagina copia il prompt e rimetti l’immagine nello slot.
        </p>
        <details className="mt-3 rounded-xl border border-line bg-paper p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Blocchi fissi (incolla identici in ogni prompt)</summary>
          <p className="mt-2 text-xs text-ink-soft">
            <b>STYLESHEET</b> + <b>CHARACTER CONSISTENCY</b>: testo identico = coerenza + cache. Formato verticale 2:3, niente testo nell’immagine.
            Genera prima le reference dei personaggi (Passo 0), poi le scene.
          </p>
        </details>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {manus.map((m) => (
          <div key={m.page} className="overflow-hidden rounded-2xl border border-line bg-paper-2">
            <div className="relative aspect-[2/3] bg-paper">
              {m.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.imageUrl} alt={`pagina ${m.page}`} className="h-full w-full object-cover" />
              ) : (
                <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-line-2 text-center text-xs text-ink-soft">
                  <span className="text-2xl">＋</span>
                  carica l’immagine
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(m.page, e.target.files?.[0])} />
                </label>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                p{m.page}
              </span>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-soft">
                <span className="rounded bg-line/60 px-1.5">{m.beat}</span>
                <span>{m.hook}</span>
              </div>
              <button onClick={() => setOpen(open === m.page ? null : m.page)} className="mt-2 text-xs text-manus underline">
                {open === m.page ? "nascondi prompt" : "mostra prompt"}
              </button>
              {open === m.page && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-2 text-[11px] leading-relaxed text-ink">
{`STORY MOMENT: ${m.storyMoment}
POV: ${m.pov}
PLACE: ${m.place}
SUBJECT(s): ${m.characters}
→ salva come immagini/p${String(m.page).padStart(2, "0")}.png`}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => goPhase?.("libro")}
        className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper"
      >
        {done === manus.length ? "Monta il libro →" : "Vai al libro (anche con immagini mancanti) →"}
      </button>
    </div>
  );
}
