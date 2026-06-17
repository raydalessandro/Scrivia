"use client";

// Impostazioni IA: scelta di provider/modello/reasoning PER OGNI FASE.
// Tutto persiste in locale (config.ts). Lo stato delle chiavi arriva dal layer
// (/api/ai). Quando colleghi davvero, qui non cambia niente: le fasi leggono
// la stessa config.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AITask, ProviderId } from "@/lib/ai/types";
import { resetSelection } from "@/lib/ai/config";
import { ModelPicker } from "./ModelPicker";

const TASKS: { task: AITask; label: string; desc: string }[] = [
  { task: "seeding", label: "Seeding — chat (Fase 1)", desc: "La conversazione che fa crescere la storia: lunga, frequente." },
  { task: "prosa", label: "Prosa (Fase 2)", desc: "La scrittura delle pagine dal brief. Dove serve più qualità." },
  { task: "critic", label: "Critic — audit", desc: "Il controllo a strati: cliché, moralina, semi pagati." },
  { task: "image_prompt", label: "Prompt immagini", desc: "Ottimizzazione dei prompt per Manus." },
  { task: "title", label: "Titoli & micro-task", desc: "Etichette brevi, titoli: roba rapida ed economica." },
  { task: "general", label: "Generale", desc: "Tutto il resto, quando una fase non specifica nulla." },
];

interface ProviderStatus { provider: ProviderId; ready: boolean; env: string }

export function AISettings() {
  const [status, setStatus] = useState<ProviderStatus[] | null>(null);
  const [bump, setBump] = useState(0); // forza il refresh dei picker dopo un reset

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => setStatus(d.configured ?? []))
      .catch(() => setStatus([]));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-5 pb-24 pt-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">← Le mie storie</Link>
        <button
          onClick={() => { resetSelection(); setBump((b) => b + 1); }}
          className="text-xs text-ink-soft underline hover:text-ink"
        >
          ripristina i default
        </button>
      </div>

      <header className="mt-6">
        <p className="text-xs uppercase tracking-[0.28em] text-ink-soft">Impostazioni</p>
        <h1 className="serif mt-1 text-2xl font-semibold">Modelli IA per ogni fase</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Scegli provider, modello e reasoning per ciascuna fase, a tua discrezione.
          Le scelte sono salvate sul dispositivo e valgono per tutte le storie.
        </p>
      </header>

      {/* stato chiavi */}
      <div className="mt-5 rounded-xl border border-line bg-paper-2 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Stato provider</p>
        {!status ? (
          <div className="shimmer h-5 w-40 rounded" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {status.map((s) => (
              <span key={s.provider} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${s.ready ? "bg-manus-bg text-manus" : "bg-github-bg text-github"}`}>
                <span className={`h-2 w-2 rounded-full ${s.ready ? "bg-manus" : "bg-github"}`} />
                {s.provider}: {s.ready ? "chiave presente" : `manca ${s.env}`}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-ink-soft">
          Le scelte qui sono già pronte: appena imposti le chiavi nelle env, le fasi le useranno senza altri passaggi.
        </p>
      </div>

      <div className="mt-5 space-y-3" key={bump}>
        {TASKS.map((t) => (
          <section key={t.task} className="rounded-2xl border border-line bg-paper-2 p-4">
            <h2 className="text-sm font-semibold">{t.label}</h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-soft">{t.desc}</p>
            <ModelPicker task={t.task} />
          </section>
        ))}
      </div>
    </main>
  );
}
