"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStories, newStory, saveStory } from "@/lib/store";
import { deriveStages } from "@/lib/stages";
import { Reperto, repertoStage, STAGE_META } from "@/components/visual";
import type { Story } from "@/lib/types";
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
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-5" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
      <div className="flex justify-end">
        <Link
          href="/impostazioni"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-3 py-2 text-xs font-medium text-ink-soft shadow-xs transition hover:bg-paper-3 hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M19.4 13a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1A1.7 1.7 0 005 17.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H.8a2 2 0 110-4h.1A1.7 1.7 0 002.3 5l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H7a1.7 1.7 0 001-1.5V.8a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V7a1.7 1.7 0 001.5 1h.2a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" stroke="currentColor" strokeWidth="1.2" transform="translate(1.6 1.6) scale(0.92)" />
          </svg>
          Modelli IA
        </Link>
      </div>

      <header className="reveal mt-6 text-center">
        <Seedling />
        <p className="eyebrow mt-4">Scrivia</p>
        <h1 className="display mx-auto mt-1.5 max-w-md text-[2.6rem] leading-[1.05]">Far crescere una storia</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
          Tu pianti il seme e organizzi la storia. Da lì in poi lavorano le IA —
          il processo resta chiaro, con i tempi, fase per fase.
        </p>
      </header>

      <div className="mt-10 flex items-center justify-between gap-3">
        <h2 className="eyebrow">Le mie storie</h2>
        <button onClick={plant} className="btn-ink text-sm">
          <span className="text-base leading-none">＋</span> Pianta un seme
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {stories.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-ink-faint">
        seme — un seme di sistema. Tu la visione, l’IA il lavoro.
      </p>
    </main>
  );
}

function StoryCard({ story }: { story: Story }) {
  const stages = deriveStages(story);
  const done = stages.filter((s) => s.state === "done").length;
  const st = repertoStage(story);
  const sm = STAGE_META[st];
  return (
    <Link
      href={`/story/${story.id}`}
      className="card group flex gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* il reperto vivo: cresce con la storia (alimentato da repertoStage) */}
      <Reperto stage={st} size={52} className="-mt-1 shrink-0 self-start" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="serif text-lg font-semibold leading-tight">{story.title}</h3>
          {story.id === "esempio" && (
            <span className="eyebrow shrink-0 rounded-full bg-github-bg px-2 py-0.5 text-[10px] text-github">
              esempio
            </span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {story.seed.pugno || "Seme ancora da piantare."}
        </p>

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full">
              {stages.map((s) => (
                <span
                  key={s.id}
                  className="flex-1 transition-colors"
                  style={{ background: s.state === "done" ? "var(--color-ink-soft)" : "var(--color-line)" }}
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-ink-faint">{done}/{stages.length}</span>
          </div>
          {/* didascalia da reperto: stadio · parola, col colore della mano */}
          <div className="mt-2.5 flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sm.colorVar }} aria-hidden />
            <span className="tracking-wide text-ink-soft">
              <span className="tabular-nums font-medium">{sm.rom}</span>
              {" · "}
              <span className="serif italic text-ink">{sm.word}</span>
            </span>
            <span className="ml-auto text-ink-faint">{st === 4 ? "fiorito" : "in coltura"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Un germoglio che è già cresciuto un po': due foglie e un gambo, sul seme.
function Seedling() {
  return (
    <svg width="60" height="60" viewBox="0 0 64 64" className="mx-auto" aria-hidden>
      <path d="M32 58 V28" stroke="#8a8270" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M32 40 C20 38 15 29 15 22 C25 22 32 29 32 40 Z" fill="#7a9a5e" />
      <path d="M32 35 C44 33 49 24 49 17 C39 17 32 24 32 35 Z" fill="#9bb877" />
      <path d="M32 40 C20 38 15 29 15 22 C25 22 32 29 32 40 Z" fill="#000" opacity="0.04" />
      <circle cx="32" cy="60" r="3.2" fill="#b07d2e" />
    </svg>
  );
}
