"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadStories, newStory, saveStory } from "@/lib/store";
import { currentUserId, signInWithEmail, signOut, onAuthChange } from "@/lib/supabase/auth";
import { deriveStages } from "@/lib/stages";
import { Reperto, repertoStage, STAGE_META } from "@/components/visual";
import type { Story } from "@/lib/types";
import { Shell, Sheet } from "@/components/shell";

// Panoramica statica delle 4 fasi (onboarding) — non un tracker live.
const PHASES = [
  { n: "1", label: "Progetta la storia", gate: false },
  { n: "2", label: "Scrivi la prosa", gate: true },
  { n: "3", label: "Le illustrazioni", gate: true },
  { n: "4", label: "Monta il libro", gate: false },
];

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const refresh = () => loadStories().then((s) => alive && setStories(s));
    refresh();
    currentUserId().then((id) => alive && setUserId(id));
    // login/logout (anche il ritorno dal magic link) → ricarica le storie.
    const off = onAuthChange((id) => {
      setUserId(id);
      refresh();
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  async function plant() {
    if (!userId) return; // serve la sessione per persistere
    const s = newStory();
    await saveStory(s);
    router.push(`/story/${s.id}`);
  }

  return (
    <Shell>
      <Sheet>
        {/* masthead prodotto */}
        <div className="text-center">
          <div className="inline-block">
            <Reperto stage={4} size={50} />
          </div>
          <p className="eyebrow mt-2">Scrivia</p>
          <h1 className="display mx-auto mt-1.5 max-w-xs text-[2rem] leading-[1.05]">
            Far crescere una storia
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
            Tu pianti il seme e organizzi. Da lì lavorano le IA — il processo
            resta chiaro, fase per fase.
          </p>
        </div>

        {/* asse del lavoro: panoramica delle 4 fasi */}
        <section className="mt-7">
          <p className="eyebrow">Come cresce una storia</p>
          <div className="relative mt-3.5 pt-1">
            <div className="absolute left-1.5 right-1.5 top-2.5 h-px bg-line" />
            <ol className="relative flex justify-between">
              {PHASES.map((p) => (
                <li key={p.n} className="w-[23%] text-center">
                  <span className="mx-auto block h-2.5 w-px bg-ink" />
                  <span className="mt-1.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-paper-2 text-xs font-bold text-ink-faint">
                    {p.n}
                  </span>
                  <span className="mt-1.5 block text-[9.5px] leading-tight text-ink-soft">
                    {p.label}
                  </span>
                  {p.gate ? (
                    <span className="serif mt-1 inline-block text-[8px] italic tracking-wide text-erba">
                      mano
                    </span>
                  ) : (
                    <span className="mt-1 block text-[8px] tracking-[0.12em] text-det">
                      · · ·
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* accesso (magic link) — serve a dare un'identità alle storie salvate */}
        <AuthBar userId={userId} />

        {/* collezione */}
        <div className="mt-7 flex items-baseline justify-between border-b border-line pb-2">
          <h2 className="eyebrow">
            Le mie storie{stories.length ? ` · ${stories.length}` : ""}
          </h2>
          {userId && (
            <button type="button" onClick={plant} className="serif text-[13px] italic text-erba">
              ＋ pianta un seme
            </button>
          )}
        </div>

        {stories.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-ink-soft">Nessuna storia, ancora.</p>
            {userId && (
              <button type="button" onClick={plant} className="btn-ink mt-4 text-sm">
                <span className="text-base leading-none">＋</span> Pianta il primo seme
              </button>
            )}
          </div>
        ) : (
          <ul className="mt-1">
            {stories.map((s, i) => (
              <StoryRow
                key={s.id}
                story={s}
                code={String(i + 1).padStart(3, "0")}
                last={i === stories.length - 1}
              />
            ))}
          </ul>
        )}
      </Sheet>
    </Shell>
  );
}

function StoryRow({
  story,
  code,
  last,
}: {
  story: Story;
  code: string;
  last: boolean;
}) {
  const stages = deriveStages(story);
  const done = stages.filter((s) => s.state === "done").length;
  const st = repertoStage(story);
  const sm = STAGE_META[st];
  return (
    <li className={last ? "" : "border-b border-line"}>
      <Link href={`/story/${story.id}`} className="flex gap-3.5 px-0.5 py-4">
        <Reperto stage={st} size={40} className="-mt-0.5 shrink-0 self-start" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="serif text-[17px] font-medium leading-tight">{story.title}</h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {story.id === "esempio" && (
                <span className="eyebrow rounded-full bg-github-bg px-1.5 py-0.5 text-[9px] text-github">
                  esempio
                </span>
              )}
              <span className="whitespace-nowrap text-[10px] tabular-nums text-ink-faint">
                N° {code}
              </span>
            </div>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">
            {story.seed.pugno || "Seme ancora da piantare."}
          </p>
          <div className="mt-2.5 flex items-center gap-2 text-xs">
            <span className="serif italic text-ink">{sm.rom}</span>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-soft">{sm.word}</span>
            <span className="ml-1 text-ink-faint">{st === 4 ? "fiorito" : "in coltura"}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="flex gap-0.5">
                {stages.map((stg) => (
                  <span
                    key={stg.id}
                    aria-hidden
                    className="h-1.5 w-1.5 rotate-45"
                    style={{
                      border: `1px solid ${stg.state === "done" ? "var(--color-erba)" : "var(--color-line)"}`,
                      background: stg.state === "done" ? "var(--color-erba)" : "transparent",
                    }}
                  />
                ))}
              </span>
              <span className="text-[10px] tabular-nums text-ink-faint">
                {done}/{stages.length}
              </span>
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

// Accesso minimale via magic link: l'email riceve un link, ci clicchi e torni
// loggato. Serve solo a dare un'identità (user_id) alle storie salvate.
function AuthBar({ userId }: { userId: string | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (userId) {
    return (
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-paper-2 px-4 py-2.5">
        <span className="text-[12px] text-ink-soft">Sei dentro · le tue storie sono salvate</span>
        <button type="button" onClick={() => signOut()} className="serif text-[12px] italic text-ink-soft underline">
          esci
        </button>
      </div>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await signInWithEmail(email.trim());
    if (error) setErr(error);
    else setSent(true);
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-paper-2 px-4 py-3.5">
      {sent ? (
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          Ti ho mandato un link a <span className="serif italic text-ink">{email}</span>. Aprilo per
          entrare e salvare le tue storie.
        </p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2">
          <label className="eyebrow">Accedi per salvare le tue storie</label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="la-tua@email.it"
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-ink-soft"
            />
            <button type="submit" className="btn-ink shrink-0 text-sm">
              Invia link
            </button>
          </div>
          {err && <p className="text-[11.5px] text-github">{err}</p>}
        </form>
      )}
    </div>
  );
}
