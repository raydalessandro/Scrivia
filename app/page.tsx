"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStories, newStory, saveStory } from "@/lib/store";
import { deriveStages, PHASES, currentPhase } from "@/lib/stages";
import type { Story } from "@/lib/types";
import { ActorChip } from "@/components/ui";
import { useRouter } from "next/navigation";

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const router = useRouter();

  useEffect(() => setStories(loadStories()), []);

  function plant() {
    const s = newStory();
    saveStory(s);
    router.push(`/story/${s.id}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
      <header className="text-center">
        <Seedling />
        <p className="mt-3 text-xs uppercase tracking-[0.32em] text-ink-soft">Scrivia</p>
        <h1 className="serif mt-1 text-3xl font-semibold">Far crescere una storia</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Tu pianti il seme e organizzi la storia. Da lì in poi lavorano le IA.
          Il processo resta chiaro, con i tempi, fase per fase.
        </p>
      </header>

      <div className="mt-9 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">Le mie storie</h2>
        <button
          onClick={plant}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:opacity-90"
        >
          + Pianta un seme
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {stories.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-ink-soft">
        seme — un seme di sistema. Tu la visione, l’IA il lavoro.
      </p>
    </main>
  );
}

function StoryCard({ story }: { story: Story }) {
  const stages = deriveStages(story);
  const done = stages.filter((s) => s.state === "done").length;
  const phase = PHASES.find((p) => p.id === currentPhase(story));
  return (
    <Link
      href={`/story/${story.id}`}
      className="group rounded-2xl border border-line bg-paper-2 p-4 transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="serif text-lg font-semibold leading-tight">{story.title}</h3>
        {story.id === "esempio" && (
          <span className="shrink-0 rounded-full bg-github-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-github">
            esempio
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
        {story.seed.pugno || "Seme ancora da piantare."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full">
          {stages.map((s) => (
            <span
              key={s.id}
              className="flex-1"
              style={{ background: s.state === "done" ? "var(--color-ink-soft)" : "var(--color-line)" }}
            />
          ))}
        </div>
        <span className="text-xs text-ink-soft">{done}/{stages.length}</span>
      </div>
      <div className="mt-3 text-xs text-ink-soft">
        Fase {phase?.n}: <span className="text-ink">{phase?.label}</span>
      </div>
    </Link>
  );
}

function Seedling() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" className="mx-auto" aria-hidden>
      <path d="M32 56 V30" stroke="#8a8270" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M32 38 C22 36 18 28 18 22 C26 22 32 28 32 38 Z" fill="#7a9a5e" />
      <path d="M32 34 C42 32 46 24 46 18 C38 18 32 24 32 34 Z" fill="#9bb877" />
      <circle cx="32" cy="58" r="3" fill="#b07d2e" />
    </svg>
  );
}
