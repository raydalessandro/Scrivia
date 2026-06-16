"use client";

// FASE 1 — Progetta la storia (Tu ↔ IA, poi la catena deterministica).
// A sinistra la chat di seeding (processo a cancelli); a destra il "seme" che si
// compila da solo. Poi "il click": la catena det. sfreccia, istantanea.

import { useEffect, useRef, useState } from "react";
import type { Seed } from "@/lib/types";
import { THEME_TO_ATTRIBUTE, WORLD_FLAVORS, ENTRY_POINTS, CLOSURES, ATTRIBUTE_LABEL, REGISTERS, TIME_SPANS } from "@/lib/enums";
import { buildNode, buildPagePlan, newNonce } from "@/lib/engine";
import { Panel } from "../Workspace";
import { ActorChip, Pill } from "../ui";
import { GraphView } from "../GraphView";
import type { PhaseProps } from "./types";

type Msg = { who: "claude" | "you"; text: string };

const STEPS: { field: string; ask: string; hint?: string }[] = [
  { field: "dump", ask: "Raccontami a chi è la storia e cosa succede. Come ti viene, anche disordinato.", hint: "es. «per Lia, 5 anni, ha paura del buio in cameretta»" },
  { field: "name", ask: "Come si chiama il protagonista?" },
  { field: "age", ask: "Quanti anni ha? (guida il registro e l'apertura)" },
  { field: "world", ask: "In che mondo? Una parola basta.", hint: WORLD_FLAVORS.join(" · ") },
  { field: "theme", ask: "Qual è il cuore — il tema? (paura, amicizia, perdita, scoperta…)" },
  { field: "pugno", ask: "E il pugno: cosa succede o cosa sente, in una frase?" },
];

export function Phase1Seeding({ story, update, log, goPhase }: PhaseProps) {
  const built = !!story.node;
  if (built) return <SeedingDone story={story} goPhase={goPhase} />;

  const [seed, setSeed] = useState<Seed>(story.seed);
  const [step, setStep] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "claude", text: STEPS[0].ask }]);
  const [draft, setDraft] = useState("");
  const [gate1, setGate1] = useState<"pending" | "shown" | "confirmed">("pending");
  const [building, setBuilding] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, gate1]);

  function patch(p: Partial<Seed>) {
    setSeed((s) => ({ ...s, ...p }));
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setMsgs((m) => [...m, { who: "you", text }]);
    setDraft("");

    const cur = STEPS[step];
    const ns: Partial<Seed> = {};
    if (cur.field === "dump") {
      // "Deduzione" leggera (qui, in produzione, parlerà Claude via API).
      const age = text.match(/(\d{1,2})\s*ann/i)?.[1];
      const name = text.match(/per\s+([A-ZÀ-Ý][a-zà-ý]+)/)?.[1];
      if (age) ns.protagonist = { ...seed.protagonist, age: +age };
      if (name) ns.protagonist = { ...(ns.protagonist ?? seed.protagonist), name };
    } else if (cur.field === "name") {
      ns.protagonist = { ...seed.protagonist, name: text };
    } else if (cur.field === "age") {
      ns.protagonist = { ...seed.protagonist, age: parseInt(text) || 6 };
    } else if (cur.field === "world") {
      ns.world_flavor = text.toLowerCase().replace(/\s+/g, "_");
    } else if (cur.field === "theme") {
      ns.theme = text.toLowerCase().trim();
    } else if (cur.field === "pugno") {
      ns.pugno = text;
    }
    patch(ns);

    // Avanza saltando gli step già dedotti dal dump.
    let next = step + 1;
    const merged = { ...seed, ...ns };
    while (next < STEPS.length && filled(merged, STEPS[next].field)) next++;
    setStep(next);
    setTimeout(() => {
      if (next < STEPS.length) {
        setMsgs((m) => [...m, { who: "claude", text: STEPS[next].ask }]);
      } else {
        deduceSpineAndRecap(merged);
      }
    }, 280);
  }

  function deduceSpineAndRecap(s: Seed) {
    // Bozza della spina (in produzione: Claude). Qui un'impalcatura onesta.
    const spine = {
      premise: `${s.protagonist.name} si trova nel mondo di ${pretty(s.world_flavor)}, all'inizio di qualcosa.`,
      problem: s.pugno,
      threshold_moment: `${s.protagonist.name} compie un gesto, invece di tirarsi indietro.`,
      resolution_mode: "Qualcosa si muove — non si risolve di colpo, ma cambia.",
      closure: "un'immagine che sigilla, non spiega",
    };
    patch({ spine, title: s.title || `${s.protagonist.name} — storia` });
    setGate1("shown");
    setMsgs((m) => [
      ...m,
      { who: "claude", text: "Ho il quadro. Ti ricapitolo qui sotto — il Cancello 1: confermi o aggiusto?" },
    ]);
  }

  const attribute = THEME_TO_ATTRIBUTE[seed.theme];
  const validation = validateSeed(seed);

  async function runChain() {
    setBuilding(true);
    const withNonce = { ...seed, nonce: seed.nonce ?? newNonce() };
    // La catena deterministica: sfreccia, ogni passo è un "tic" sotto il secondo.
    const node = buildNode(withNonce);
    const pagePlan = buildPagePlan(node);
    const manus = pagePlan.map((pp) => ({
      page: pp.page,
      hook: pp.hook,
      beat: pp.beat,
      storyMoment: pp.note || `${node.protagonist.name}: ${pp.beat}`,
      pov: pp.page === 1 ? "a wide establishing shot" : "a medium shot at eye level",
      place: `${node.setting_primary} — ${node.season}`,
      characters: node.protagonist.name + (node.companions[0] ? ` + ${node.companions[0].name}` : ""),
    }));

    await tick(320); log({ actor: "det", event: "seed validato", durationMs: 40 });
    await tick(360); log({ actor: "det", event: "nodo costruito", detail: `nonce ${node.seed_nonce} · ${node.attribute_dominant} · ${node.deployment_level}`, durationMs: 280 });
    await tick(300); log({ actor: "det", event: "hook (piano pagine)", detail: `${node.pages} pagine`, durationMs: 110 });
    await tick(300); log({ actor: "det", event: "brief (zero-token)", durationMs: 90 });
    await tick(320); log({ actor: "det", event: "prompt immagini", detail: `${manus.length} prompt Manus`, durationMs: 80 });

    update((st) => ({ ...st, seed: withNonce, node, pagePlan, manus, title: node.title, stage: "manus" }));
    setBuilding(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Chat di seeding */}
      <Panel title="Seeding" right={<ActorChip actor="claude" />}>
        <div className="flex h-[420px] flex-col">
          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {msgs.map((m, i) => (
              <Bubble key={i} who={m.who} text={m.text} />
            ))}
            {gate1 !== "pending" && <Gate1Card seed={seed} attribute={attribute} state={gate1} onConfirm={() => { setGate1("confirmed"); setMsgs((m) => [...m, { who: "you", text: "Va bene così." }]); }} />}
            <div ref={endRef} />
          </div>

          {step < STEPS.length && gate1 === "pending" && (
            <div className="mt-3">
              {STEPS[step].hint && <p className="mb-1 text-xs text-ink-soft">{STEPS[step].hint}</p>}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="Scrivi…"
                  className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-claude"
                  autoFocus
                />
                <button onClick={submit} className="rounded-xl bg-claude px-4 text-sm font-semibold text-white">Invia</button>
              </div>
              <button onClick={() => fillExample(setSeed, setStep, setMsgs, setGate1)} className="mt-2 text-xs text-ink-soft underline">
                Compila con l'esempio (Pino)
              </button>
            </div>
          )}
        </div>
      </Panel>

      {/* Il seme che si compila da solo */}
      <div className="space-y-5">
        <Panel title="Il seme — si compila da solo" right={<ActorChip actor="you" />}>
          <SeedForm seed={seed} attribute={attribute} />
        </Panel>

        {gate1 === "confirmed" && (
          <Panel title="Cancello 2 — validazione (deterministica)">
            {validation.errors.length === 0 ? (
              <div className="space-y-3">
                <Pill tone="ok">✓ seed completo · pronto per il click</Pill>
                {!building ? (
                  <button onClick={runChain} className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-paper">
                    Costruisci la storia — «il click»
                  </button>
                ) : (
                  <ChainAnimation />
                )}
              </div>
            ) : (
              <ul className="space-y-1 text-sm text-gate">
                {validation.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
            {validation.warnings.map((w, i) => (
              <p key={i} className="mt-1 text-xs text-github">⚠ {w}</p>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}

// --- sotto-componenti ----------------------------------------------------

function Bubble({ who, text }: { who: "claude" | "you"; text: string }) {
  const mine = who === "you";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          mine ? "bg-you-bg text-ink" : "bg-claude-bg text-ink"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function Gate1Card({ seed, attribute, state, onConfirm }: { seed: Seed; attribute?: string; state: string; onConfirm: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gate/40 bg-gate-bg/40 p-3 text-sm">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gate">✋ Cancello 1 — conferma</p>
      <p>
        <b>{seed.protagonist.name}</b>, {seed.protagonist.age} anni, nel mondo di <b>{pretty(seed.world_flavor)}</b>.
        Il cuore: <i>{seed.pugno}</i>.
      </p>
      {attribute && <p className="mt-1 text-ink-soft">Arco interno (invisibile nel testo): <b>{attribute}</b>.</p>}
      {state === "shown" && (
        <div className="mt-2 flex gap-2">
          <button onClick={onConfirm} className="rounded-lg bg-gate px-3 py-1.5 text-xs font-semibold text-white">Confermo</button>
          <span className="self-center text-xs text-ink-soft">…oppure continua a scrivere per correggere.</span>
        </div>
      )}
      {state === "confirmed" && <p className="mt-2 text-xs font-semibold text-manus">✓ confermato</p>}
    </div>
  );
}

function SeedForm({ seed, attribute }: { seed: Seed; attribute?: string }) {
  const rows: [string, string][] = [
    ["Protagonista", [seed.protagonist.name, seed.protagonist.age ? `${seed.protagonist.age} anni` : "", seed.protagonist.kind].filter(Boolean).join(" · ")],
    ["Mondo", pretty(seed.world_flavor)],
    ["Tema", seed.theme + (attribute ? ` → ${attribute}` : "")],
    ["Pugno", seed.pugno],
    ["Premessa", seed.spine.premise],
    ["Problema", seed.spine.problem],
    ["Soglia", seed.spine.threshold_moment],
    ["Risoluzione", seed.spine.resolution_mode],
    ["Pagine", String(seed.length_pages)],
  ];
  return (
    <dl className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[88px_1fr] items-start gap-2 text-sm">
          <dt className="pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{k}</dt>
          <dd className={v ? "text-ink" : "h-4 w-2/3 self-center rounded shimmer"}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChainAnimation() {
  const steps = ["validazione", "nodo (grafo)", "hook", "brief", "prompt immagini"];
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= steps.length) return;
    const id = setTimeout(() => setN((x) => x + 1), 330);
    return () => clearTimeout(id);
  }, [n]);
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-ink-soft">La catena deterministica — istantanea, zero token:</p>
      {steps.map((s, i) => (
        <div key={s} className={`flex items-center gap-2 text-sm ${i < n ? "" : "opacity-30"}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${i < n ? "det-tic bg-det-bg text-det" : "bg-line"}`}>
            {i < n ? "✓" : ""}
          </span>
          {s}
          {i < n && <span className="ml-auto text-xs tabular-nums text-ink-soft">{[40, 280, 110, 90, 80][i]} ms</span>}
        </div>
      ))}
    </div>
  );
}

function SeedingDone({ story, goPhase }: { story: PhaseProps["story"]; goPhase?: PhaseProps["goPhase"] }) {
  const node = story.node!;
  return (
    <div className="space-y-5">
      <Panel title="Il grafo — la spina della storia" right={<Pill tone="ok">nonce {node.seed_nonce}</Pill>}>
        <GraphView node={node} />
      </Panel>
      <div className="grid gap-5 sm:grid-cols-2">
        <Panel title="Grammatica campionata">
          <dl className="space-y-2 text-sm">
            <KV k="Attributo" v={ATTRIBUTE_LABEL[node.attribute_dominant]} />
            <KV k="Dispiegamento" v={`${node.deployment_level} · ${node.ear_arc.join(" → ")}`} />
            <KV k="Apertura" v={`${node.entry_point_type} — ${ENTRY_POINTS[node.entry_point_type]}`} />
            <KV k="Chiusura" v={`${node.closure_type} — ${CLOSURES[node.closure_type]}`} />
            <KV k="Registro" v={REGISTERS[node.register]} />
            <KV k="Arco temp." v={TIME_SPANS[node.time_span_arc]} />
            <KV k="Soglia" v={`pagina ${node.threshold_page}`} />
          </dl>
        </Panel>
        <Panel title="Piano pagine">
          <PagePlanTable story={story} />
        </Panel>
      </div>
      <button onClick={() => goPhase?.("prosa")} className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
        Vai alla prosa →
      </button>
    </div>
  );
}

function PagePlanTable({ story }: { story: PhaseProps["story"] }) {
  return (
    <div className="max-h-72 overflow-y-auto text-sm">
      <table className="w-full">
        <tbody>
          {story.pagePlan?.map((p) => (
            <tr key={p.page} className="border-b border-line/60 last:border-0">
              <td className="py-1 pr-2 text-ink-soft tabular-nums">{p.page}</td>
              <td className="py-1 pr-2">{p.beat}</td>
              <td className="py-1 text-xs text-ink-soft">{p.note || p.hook}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}

// --- logica --------------------------------------------------------------

function filled(s: Seed, field: string): boolean {
  if (field === "name") return !!s.protagonist.name;
  if (field === "age") return s.protagonist.age != null;
  if (field === "world") return !!s.world_flavor;
  if (field === "theme") return !!s.theme;
  if (field === "pugno") return !!s.pugno;
  return false;
}

function validateSeed(s: Seed): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!s.protagonist.name) errors.push("manca il nome del protagonista");
  if (s.protagonist.age == null) errors.push("manca l'età");
  if (!s.world_flavor) errors.push("manca il mondo");
  if (!s.theme) errors.push("manca il tema");
  if (!s.pugno) errors.push("manca il pugno");
  if (!s.spine.premise || !s.spine.threshold_moment) errors.push("spina narrativa incompleta");
  if (s.theme && !THEME_TO_ATTRIBUTE[s.theme]) warnings.push(`tema «${s.theme}» non mappato a un attributo: il motore sceglierà`);
  return { errors, warnings };
}

function fillExample(
  setSeed: (s: Seed) => void,
  setStep: (n: number) => void,
  setMsgs: (m: Msg[]) => void,
  setGate1: (g: "pending" | "shown" | "confirmed") => void
) {
  const s: Seed = {
    language: "it", title: "Pino e la voce sotto le foglie",
    protagonist: { name: "Pino", age: 6, kind: "riccio" },
    companions: [{ name: "Ghita", kind: "ghiandaia" }],
    world_flavor: "animali_del_bosco",
    setting: { primary: "il bosco dietro la casa nuova", notes: "famiglia appena trasferita" },
    theme: "amicizia",
    pugno: "Pino è appena arrivato e non sa come si fa ad avere un amico in un posto nuovo",
    personal_detail: "tiene in tasca un sasso liscio della casa vecchia",
    length_pages: 12, packs: [],
    spine: {
      premise: "Pino esce per la prima volta nel bosco dietro la casa nuova, con il sasso in tasca.",
      problem: "Sente una voce tra le foglie ma non vede nessuno; ha voglia di rispondere e paura.",
      threshold_moment: "Invece di tornare indietro, posa il sasso e dice il proprio nome ad alta voce.",
      resolution_mode: "La ghiandaia esce allo scoperto; camminano un pezzo insieme.",
      closure: "un'immagine che sigilla",
    },
    voice: { temperamento: "sospesa", lente_sensoriale: "luce" },
    nonce: 70125,
  };
  setSeed(s);
  setStep(STEPS.length);
  setMsgs([{ who: "claude", text: "Compilato con l'esempio. Ti ricapitolo — Cancello 1." }]);
  setGate1("shown");
}

function pretty(w: string): string {
  return (w || "").replace(/_/g, " ");
}
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
