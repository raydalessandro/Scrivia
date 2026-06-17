"use client";

// FASE 1 — Studio di seeding. Non un wizard usa-e-getta: uno spazio collaborativo
// di lunga durata (può durare settimane). Tiene memoria (chat + comandi), è tutto
// editabile, e ogni entità è SELEZIONABILE: la tocchi → diventa il "focus" che
// l'IA conosce. Ogni azione (umano o IA) passa dal registry dei comandi
// (lib/commands.ts) → log + cache, e domani diventa una MCP.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Story, FocusRef, ChatMsg } from "@/lib/types";
import { THEME_TO_ATTRIBUTE, ATTRIBUTE_LABEL, ENTRY_POINTS, CLOSURES, REGISTERS, TIME_SPANS, VOICE_AXES, WORLD_FLAVORS } from "@/lib/enums";
import { executeCommand, validateSeed, COMMANDS } from "@/lib/commands";
import { Panel } from "../Workspace";
import { ActorChip } from "../ui";
import { GraphView } from "../GraphView";
import type { PhaseProps } from "./types";

export function Phase1Seeding({ story, update, log, goPhase }: PhaseProps) {
  const [focus, setFocus] = useState<FocusRef | null>(null);
  const [building, setBuilding] = useState(false);

  // Esegue un comando sulla storia corrente e persiste (single source of truth).
  function run(name: string, params: Record<string, unknown>, by: "you" | "claude" = "you") {
    const r = executeCommand(story, name, params, by);
    if (r.story !== story) update(() => r.story);
    return r;
  }

  // L'assistente: interpreta il testo (con il focus) → esegue comandi → risponde.
  // Interim finché non si collega la tua IA/MCP: stessa identica superficie (i comandi).
  function send(text: string) {
    const now = new Date().toISOString();
    const userMsg: ChatMsg = { id: rid(), who: "you", text, ts: now, focus: focus ?? undefined };
    const intents = interpret(text, focus, story);
    let cur = story;
    const did: string[] = [];
    for (const it of intents) {
      const r = executeCommand(cur, it.name, it.params, "claude");
      cur = r.story;
      did.push(r.run.summary);
    }
    const v = validateSeed(cur.seed);
    const replyText = did.length
      ? `Fatto: ${did.join(" · ")}.${v.errors.length ? ` Manca ancora: ${v.errors[0]}.` : " Il seme è completo — possiamo costruire il grafo."}`
      : focus
      ? `Tengo presente che parliamo di «${focus.label}». Dimmi cosa cambio, o tocca un campo per modificarlo a mano.`
      : `Ti seguo. Puoi dirmi protagonista, mondo, tema, il pugno… o toccare una scheda qui sotto per lavorarci insieme.`;
    const botMsg: ChatMsg = { id: rid(), who: "claude", text: replyText, ts: new Date().toISOString(), commands: did.length ? intents.map((i) => i.name) : undefined };
    const next: Story = { ...cur, seedingChat: [...(cur.seedingChat ?? []), userMsg, botMsg] };
    update(() => next);
  }

  async function build() {
    setBuilding(true);
    await tick(1100); // la catena "sfreccia"; il tempo qui è scenico
    const r = run("build_node", {}, "you");
    log({ actor: "det", event: "grafo costruito", detail: r.run.summary.replace(/^Grafo costruito · /, ""), durationMs: 360 });
    log({ actor: "det", event: "hook + brief + prompt", detail: `${story.seed.length_pages} pagine`, durationMs: 280 });
    setBuilding(false);
  }

  const v = validateSeed(story.seed);
  const built = !!story.node;

  // Avvia la chat partendo dalla bozza: l'IA riceve già lo scheletro.
  const started = (story.seedingChat?.length ?? 0) > 0 || !!story.chatStarted || built;
  const [mode, setMode] = useState<"intake" | "studio">(started ? "studio" : "intake");

  function startChat() {
    const opening = composeOpening(story);
    const botMsg: ChatMsg = { id: rid(), who: "claude", text: opening, ts: new Date().toISOString() };
    update((s) => ({ ...s, chatStarted: true, seedingChat: [...(s.seedingChat ?? []), botMsg] }));
    setMode("studio");
  }

  // FASE 1a — Intake: la griglia che l'umano compila a mano (zero token).
  if (mode === "intake" && !built) {
    return (
      <Intake
        story={story}
        focus={focus}
        setFocus={setFocus}
        run={run}
        onStart={startChat}
        errors={v.errors}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,400px)]">
      {/* Colonna sinistra: le schede scorrevoli, editabili, selezionabili */}
      <div className="order-2 space-y-4 lg:order-1">
        <CompletenessBar story={story} />

        <Section title="Protagonista" focusKey={mkFocus("protagonist", "protagonist", "Protagonista")} focus={focus} setFocus={setFocus}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nome" value={story.seed.protagonist.name} onSave={(val) => run("set_protagonist", { name: val })} />
            <Field label="Età" value={story.seed.protagonist.age?.toString() ?? ""} onSave={(val) => run("set_protagonist", { age: parseInt(val) || null })} />
            <Field label="Tipo/specie" value={story.seed.protagonist.kind} onSave={(val) => run("set_protagonist", { kind: val })} className="col-span-2" />
          </div>
        </Section>

        <Section title="Cast" focus={focus} setFocus={setFocus}>
          <div className="space-y-1.5">
            {story.seed.companions.map((c) => (
              <EntityChip
                key={c.name}
                label={`${c.name}${c.kind ? ` · ${c.kind}` : ""}`}
                active={focus?.kind === "companion" && focus.ref === c.name}
                onSelect={() => setFocus(mkFocus("companion", c.name, c.name))}
                onRemove={() => run("remove_companion", { name: c.name })}
              />
            ))}
            <AddInline placeholder="aggiungi personaggio…" onAdd={(name) => run("add_companion", { name })} />
          </div>
        </Section>

        <Section title="Mondo & tema" focus={focus} setFocus={setFocus}>
          <div className="space-y-2">
            <SelectField label="Mondo" value={story.seed.world_flavor} options={WORLD_FLAVORS} onSave={(val) => run("set_world", { world_flavor: val })} />
            <Field label="Tema" value={story.seed.theme} onSave={(val) => run("set_theme", { theme: val })} />
            {story.seed.theme && (
              <p className="text-xs text-ink-soft">
                Ontologia EAR:{" "}
                {THEME_TO_ATTRIBUTE[story.seed.theme] ? (
                  <b>{ATTRIBUTE_LABEL[THEME_TO_ATTRIBUTE[story.seed.theme]]}</b>
                ) : (
                  <span className="text-github">non mappato — lo sceglie il motore</span>
                )}{" "}
                <span className="opacity-70">(mai nominato nel testo)</span>
              </p>
            )}
          </div>
        </Section>

        <Section title="Il cuore (pugno)" focusKey={mkFocus("spine", "pugno", "Pugno")} focus={focus} setFocus={setFocus}>
          <Field label="" value={story.seed.pugno} multiline onSave={(val) => run("set_pugno", { pugno: val })} placeholder="cosa succede / cosa sente, in una frase" />
          <Field label="Dettaglio personale" value={story.seed.personal_detail} multiline onSave={(val) => run("set_personal_detail", { detail: val })} placeholder="un oggetto, un'abitudine vera del bambino" className="mt-2" />
        </Section>

        <Section title="Spina narrativa" focus={focus} setFocus={setFocus}>
          <div className="space-y-2">
            {SPINE.map((f) => (
              <div key={f.key} onClick={() => setFocus(mkFocus("spine", f.key, f.label))}
                className={`rounded-lg border p-2 transition ${focus?.kind === "spine" && focus.ref === f.key ? "border-claude bg-claude-bg/40" : "border-line"}`}>
                <Field label={f.label} value={(story.seed.spine as any)[f.key]} multiline onSave={(val) => run("set_spine", { field: f.key, value: val })} placeholder={f.hint} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Voce (crocette opzionali)" focus={focus} setFocus={setFocus}>
          <div className="space-y-2">
            {VOICE_AXES.map((axis) => (
              <div key={axis.key}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{axis.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {axis.values.map((val) => {
                    const on = (story.seed.voice as any)[axis.key] === val;
                    return (
                      <button key={val} onClick={() => run("set_voice_axis", { axis: axis.key, value: on ? "" : val })}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-claude bg-claude text-white" : "border-line bg-paper hover:bg-paper-2"}`}>
                        {val.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Appunti liberi" focus={focus} setFocus={setFocus} focusKey={mkFocus("spine", "notes", "Appunti")}>
          <Field label="" value={story.intakeNotes ?? ""} multiline onSave={(val) => run("set_intake_notes", { notes: val })} placeholder="appunti che l'IA legge come contesto…" />
        </Section>

        {/* Il click / il grafo */}
        {!built ? (
          <Panel title="«Il click» — costruisci il grafo">
            {v.errors.length === 0 ? (
              building ? (
                <ChainAnimation />
              ) : (
                <button onClick={build} className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">
                  Costruisci la storia
                </button>
              )
            ) : (
              <div className="text-sm text-ink-soft">
                <p>Prima completa il seme:</p>
                <ul className="mt-1 space-y-0.5 text-gate">{v.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
              </div>
            )}
          </Panel>
        ) : (
          <BuiltGraph story={story} setFocus={setFocus} focus={focus} goPhase={goPhase} />
        )}
      </div>

      {/* Colonna destra: la chat con il focus (sticky su desktop) */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-5 lg:self-start">
        <SeedingChat story={story} focus={focus} setFocus={setFocus} onSend={send} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
function SeedingChat({ story, focus, setFocus, onSend }: { story: Story; focus: FocusRef | null; setFocus: (f: FocusRef | null) => void; onSend: (t: string) => void }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const chat = story.seedingChat ?? [];
  const v = validateSeed(story.seed);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [chat.length]);

  function submit() {
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft("");
  }

  return (
    <Panel title="Seeding — l'IA ti segue" right={<ActorChip actor="claude" />}>
      <div className="flex h-[60vh] min-h-[380px] flex-col lg:h-[600px]">
        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
          {chat.length === 0 && (
            <div className="rounded-2xl bg-claude-bg px-3 py-2 text-sm">
              Raccontami la storia come ti viene. Posso anche lavorare sulle schede qui sotto: toccane una e «la terrò in mano» mentre ne parliamo.
            </div>
          )}
          {chat.map((m) => (
            <div key={m.id} className={`flex ${m.who === "you" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.who === "you" ? "bg-you-bg" : "bg-claude-bg"}`}>
                {m.focus && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-claude">↳ {m.focus.label}</span>}
                {m.text}
                {m.commands && <span className="mt-1 block text-[10px] text-ink-soft">⚙ {m.commands.join(", ")}</span>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* suggerimenti rapidi (azioni dell'IA = comandi) */}
        {v.errors.length > 0 && (
          <p className="mt-2 text-xs text-ink-soft">Prossimo: <b>{v.errors[0]}</b></p>
        )}

        {/* chip del focus: l'IA sa di cosa parli */}
        {focus && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-claude-bg/60 px-2.5 py-1.5 text-xs">
            <span className="font-semibold text-claude">focus: {focus.label}</span>
            <button onClick={() => setFocus(null)} className="ml-auto text-ink-soft hover:text-ink">✕</button>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={focus ? `parla di ${focus.label}…` : "scrivi…"}
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-base outline-none focus:border-claude"
            enterKeyHint="send"
          />
          <button onClick={submit} className="shrink-0 rounded-xl bg-claude px-4 text-sm font-semibold text-white">Invia</button>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Schede selezionabili / editabili
// ---------------------------------------------------------------------------
function Section({ title, children, focus, setFocus, focusKey }: {
  title: string; children: React.ReactNode; focus: FocusRef | null; setFocus: (f: FocusRef | null) => void; focusKey?: FocusRef;
}) {
  const active = !!focusKey && focus?.kind === focusKey.kind && focus?.ref === focusKey.ref;
  return (
    <div className={`rounded-2xl border bg-paper-2 p-4 transition ${active ? "border-claude shadow-sm" : "border-line"}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{title}</h3>
        {focusKey && (
          <button onClick={() => setFocus(active ? null : focusKey)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${active ? "bg-claude text-white" : "bg-line/70 text-ink-soft hover:bg-line"}`}>
            {active ? "in focus" : "seleziona"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onSave, multiline, placeholder, className = "" }: {
  label: string; value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  function commit() { setEditing(false); if (draft !== value) onSave(draft); }
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</span>}
      {editing ? (
        multiline ? (
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} rows={2}
            className="w-full resize-y rounded-lg border border-claude bg-paper px-2.5 py-1.5 text-sm outline-none" />
        ) : (
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
            className="w-full rounded-lg border border-claude bg-paper px-2.5 py-1.5 text-sm outline-none" />
        )
      ) : (
        <button onClick={() => setEditing(true)}
          className={`min-h-[36px] w-full rounded-lg border border-transparent px-2.5 py-1.5 text-left text-sm hover:border-line hover:bg-paper ${value ? "text-ink" : "text-ink-soft italic"}`}>
          {value || placeholder || "tocca per scrivere"}
        </button>
      )}
    </label>
  );
}

function SelectField({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</span>
      <select value={value} onChange={(e) => onSave(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-sm outline-none focus:border-claude">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
        {value && !options.includes(value) && <option value={value}>{value}</option>}
      </select>
    </label>
  );
}

function EntityChip({ label, active, onSelect, onRemove }: { label: string; active: boolean; onSelect: () => void; onRemove: () => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${active ? "border-claude bg-claude-bg/40" : "border-line"}`}>
      <button onClick={onSelect} className="flex-1 text-left">{label}</button>
      {active && <span className="text-[10px] font-semibold uppercase text-claude">focus</span>}
      <button onClick={onRemove} className="text-ink-soft hover:text-gate">✕</button>
    </div>
  );
}

function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
        placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border border-dashed border-line-2 bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-claude" />
      {val.trim() && <button onClick={() => { onAdd(val.trim()); setVal(""); }} className="rounded-lg bg-line px-3 text-sm">+</button>}
    </div>
  );
}

function CompletenessBar({ story }: { story: Story }) {
  const v = validateSeed(story.seed);
  const total = 6;
  const done = total - v.errors.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Il seme</span>
        <span className="text-ink-soft">{v.errors.length === 0 ? "completo" : `${done}/${total}`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-claude transition-all" style={{ width: `${pct}%` }} />
      </div>
      {story.updatedAt && <p className="mt-1.5 text-[11px] text-ink-soft">memoria salvata · {new Date(story.updatedAt).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
    </div>
  );
}

function ChainAnimation() {
  const steps = ["validazione", "nodo (grafo)", "hook", "brief", "prompt immagini"];
  const [n, setN] = useState(0);
  useEffect(() => { if (n >= steps.length) return; const id = setTimeout(() => setN((x) => x + 1), 220); return () => clearTimeout(id); }, [n]);
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-ink-soft">La catena deterministica — istantanea, zero token:</p>
      {steps.map((s, i) => (
        <div key={s} className={`flex items-center gap-2 text-sm ${i < n ? "" : "opacity-30"}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${i < n ? "det-tic bg-det-bg text-det" : "bg-line"}`}>{i < n ? "✓" : ""}</span>
          {s}{i < n && <span className="ml-auto text-xs tabular-nums text-ink-soft">{[40, 280, 110, 90, 80][i]} ms</span>}
        </div>
      ))}
    </div>
  );
}

function BuiltGraph({ story, setFocus, focus, goPhase }: { story: Story; setFocus: (f: FocusRef | null) => void; focus: FocusRef | null; goPhase?: PhaseProps["goPhase"] }) {
  const node = story.node!;
  return (
    <div className="space-y-4">
      <Section title="Il grafo" focus={focus} setFocus={setFocus} focusKey={mkFocus("node", "grafo", "Il grafo")}>
        <GraphView node={node} />
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <KV k="Attributo" v={ATTRIBUTE_LABEL[node.attribute_dominant]} />
          <KV k="Dispiegamento" v={node.deployment_level} />
          <KV k="Apertura" v={`${node.entry_point_type} · ${ENTRY_POINTS[node.entry_point_type]}`} />
          <KV k="Chiusura" v={`${node.closure_type} · ${CLOSURES[node.closure_type]}`} />
          <KV k="Registro" v={REGISTERS[node.register]} />
          <KV k="Arco" v={TIME_SPANS[node.time_span_arc]} />
        </dl>
      </Section>
      <button onClick={() => goPhase?.("prosa")} className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper">Vai alla prosa →</button>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (<div className="flex flex-col"><span className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">{k}</span><span className="text-ink">{v}</span></div>);
}

// ---------------------------------------------------------------------------
// Intake: la griglia che l'umano compila PRIMA della chat (zero token).
// L'IA poi parte da questa bozza invece che da zero.
// ---------------------------------------------------------------------------
type RunFn = (name: string, params: Record<string, unknown>, by?: "you" | "claude") => unknown;

function Intake({ story, focus, setFocus, run, onStart, errors }: {
  story: Story; focus: FocusRef | null; setFocus: (f: FocusRef | null) => void; run: RunFn; onStart: () => void; errors: string[];
}) {
  const seed = story.seed;
  return (
    <div className="space-y-4 pb-28">
      <div className="rounded-2xl border border-line bg-paper-2 p-4">
        <h2 className="serif text-xl font-semibold">La bozza della storia</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Compili quello che già sai — lasci vuoto ciò che vuoi decidere insieme all'IA.
          Niente di tutto questo costa token: l'IA partirà <b>da qui</b>, non da zero.
        </p>
      </div>

      <CompletenessBar story={story} />

      <Section title="Protagonista" focus={focus} setFocus={setFocus}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nome" value={seed.protagonist.name} onSave={(v) => run("set_protagonist", { name: v })} />
          <Field label="Età" value={seed.protagonist.age?.toString() ?? ""} onSave={(v) => run("set_protagonist", { age: parseInt(v) || null })} />
          <Field label="Tipo / specie" value={seed.protagonist.kind} onSave={(v) => run("set_protagonist", { kind: v })} className="col-span-2" placeholder="riccio, bambina, robot…" />
        </div>
      </Section>

      <Section title="Mondo & ambientazione" focus={focus} setFocus={setFocus}>
        <div className="space-y-2">
          <SelectField label="Mondo" value={seed.world_flavor} options={WORLD_FLAVORS} onSave={(v) => run("set_world", { world_flavor: v })} />
          <Field label="Luogo principale" value={seed.setting.primary} onSave={(v) => run("set_setting", { primary: v })} placeholder="il bosco dietro la casa nuova" />
          <Field label="Contesto" value={seed.setting.notes} onSave={(v) => run("set_setting", { notes: v })} placeholder="es. famiglia appena trasferita" />
        </div>
      </Section>

      <Section title="Tema" focus={focus} setFocus={setFocus}>
        <Field label="" value={seed.theme} onSave={(v) => run("set_theme", { theme: v })} placeholder="paura, amicizia, perdita, scoperta…" />
        {seed.theme && (
          <p className="mt-1 text-xs text-ink-soft">
            EAR: {THEME_TO_ATTRIBUTE[seed.theme] ? <b>{ATTRIBUTE_LABEL[THEME_TO_ATTRIBUTE[seed.theme]]}</b> : <span className="text-github">non mappato — lo sceglie il motore</span>} <span className="opacity-70">(mai nel testo)</span>
          </p>
        )}
      </Section>

      <Section title="Il cuore & il dettaglio vero" focus={focus} setFocus={setFocus}>
        <Field label="Pugno" value={seed.pugno} multiline onSave={(v) => run("set_pugno", { pugno: v })} placeholder="cosa succede / cosa sente, in una frase" />
        <Field label="Dettaglio personale" value={seed.personal_detail} multiline onSave={(v) => run("set_personal_detail", { detail: v })} placeholder="un oggetto, un'abitudine vera del bambino" className="mt-2" />
      </Section>

      <Section title="Cast" focus={focus} setFocus={setFocus}>
        <div className="space-y-1.5">
          {seed.companions.map((c) => (
            <EntityChip key={c.name} label={`${c.name}${c.kind ? ` · ${c.kind}` : ""}`} active={false} onSelect={() => {}} onRemove={() => run("remove_companion", { name: c.name })} />
          ))}
          <AddInline placeholder="aggiungi personaggio…" onAdd={(name) => run("add_companion", { name })} />
        </div>
      </Section>

      <Section title="Lunghezza" focus={focus} setFocus={setFocus}>
        <div className="flex items-center gap-3">
          <input type="range" min={10} max={20} value={seed.length_pages} onChange={(e) => run("set_length", { pages: +e.target.value })} className="flex-1 accent-claude" />
          <span className="w-20 text-sm tabular-nums">{seed.length_pages} pagine</span>
        </div>
      </Section>

      <Section title="Spina narrativa — opzionale" focus={focus} setFocus={setFocus}>
        <p className="mb-2 text-xs text-ink-soft">Se la sai già, scrivila. Altrimenti lasciala vuota: la costruisci con l'IA, è la parte dove serve davvero.</p>
        <div className="space-y-2">
          {SPINE.map((f) => (
            <Field key={f.key} label={f.label} value={(seed.spine as any)[f.key]} multiline onSave={(v) => run("set_spine", { field: f.key, value: v })} placeholder={f.hint} />
          ))}
        </div>
      </Section>

      <Section title="Appunti liberi" focus={focus} setFocus={setFocus}>
        <p className="mb-2 text-xs text-ink-soft">Scarica qui qualsiasi cosa — frammenti, idee, no. L'IA li legge all'avvio.</p>
        <Field label="" value={story.intakeNotes ?? ""} multiline onSave={(v) => run("set_intake_notes", { notes: v })} placeholder="«vorrei un finale agrodolce…», «niente animali parlanti», un ricordo…" />
      </Section>

      {/* CTA sticky in basso: avvia la chat partendo dalla bozza */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="hidden flex-1 text-xs text-ink-soft sm:block">
            {errors.length === 0 ? "Bozza pronta — l'IA può rifinire e costruire." : `${errors.length} campi ancora vuoti: l'IA ti aiuterà a completarli.`}
          </p>
          <button onClick={onStart} className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-paper sm:flex-none sm:px-8">
            Inizia con l'IA →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Primo messaggio dell'IA, generato dalla bozza (deterministico, zero token).
 *  È anche, letteralmente, lo scheletro che passeremo all'API come contesto. */
function composeOpening(story: Story): string {
  const s = story.seed;
  const have: string[] = [];
  if (s.protagonist.name) have.push(`${s.protagonist.name}${s.protagonist.age ? `, ${s.protagonist.age} anni` : ""}${s.protagonist.kind ? ` (${s.protagonist.kind})` : ""}`);
  if (s.world_flavor) have.push(`mondo: ${s.world_flavor.replace(/_/g, " ")}`);
  if (s.setting.primary) have.push(s.setting.primary);
  if (s.theme) have.push(`tema: ${s.theme}`);
  if (s.companions.length) have.push(`con ${s.companions.map((c) => c.name).join(", ")}`);

  const gaps: string[] = [];
  if (!s.protagonist.name) gaps.push("come si chiama il protagonista");
  if (s.protagonist.age == null) gaps.push("che età ha");
  if (!s.world_flavor) gaps.push("in che mondo siamo");
  if (!s.theme) gaps.push("qual è il tema");
  if (!s.pugno) gaps.push("il cuore della storia in una frase");
  const spineMissing = !s.spine.premise || !s.spine.threshold_moment;

  let msg = "";
  if (have.length) msg += `Ho letto la tua bozza — ${have.join(" · ")}. `;
  else msg += "Partiamo dalla tua bozza. ";
  if (s.pugno) msg += `Il cuore: «${s.pugno}». `;
  if (story.intakeNotes?.trim()) msg += `Ho presente anche i tuoi appunti. `;

  if (gaps.length) {
    msg += `Per partire bene mi manca ${gaps.length > 1 ? "qualche cosa" : "una cosa"}: ${gaps.slice(0, 3).join("; ")}?`;
  } else if (spineMissing) {
    msg += `Abbiamo le basi. Vuoi che ti proponga io la spina — premessa, problema, la soglia (il gesto che attraversa) e come si chiude — così la limiamo insieme?`;
  } else {
    msg += `C'è già tutto, anche la spina. La rifiniamo dove vuoi, oppure costruiamo subito il grafo: dimmi tu.`;
  }
  return msg;
}

// ---------------------------------------------------------------------------
// logica
// ---------------------------------------------------------------------------
const SPINE = [
  { key: "premise", label: "Premessa", hint: "cosa mette in moto (scena d'avvio)" },
  { key: "problem", label: "Problema", hint: "la difficoltà, con dentro la tensione" },
  { key: "threshold_moment", label: "Soglia", hint: "l'attraversamento: una DECISIONE o un GESTO" },
  { key: "resolution_mode", label: "Risoluzione", hint: "come si MUOVE (non «si risolve»)" },
  { key: "closure", label: "Chiusura", hint: "direzione: un'immagine che sigilla" },
] as const;

/** Interprete interim: testo + focus → comandi. Stessa superficie della futura IA/MCP. */
function interpret(text: string, focus: FocusRef | null, story: Story): { name: string; params: Record<string, unknown> }[] {
  const t = text.trim();
  const low = t.toLowerCase();
  const out: { name: string; params: Record<string, unknown> }[] = [];

  // Con un focus attivo, il testo libero modifica direttamente quell'entità.
  if (focus) {
    if (focus.kind === "spine") {
      if (focus.ref === "pugno") out.push({ name: "set_pugno", params: { pugno: t } });
      else out.push({ name: "set_spine", params: { field: focus.ref, value: t } });
      return out;
    }
    if (focus.kind === "protagonist") {
      const age = low.match(/(\d{1,2})\s*ann/)?.[1];
      if (age) out.push({ name: "set_protagonist", params: { age: +age } });
      else out.push({ name: "set_protagonist", params: { kind: t } });
      return out;
    }
    if (focus.kind === "companion") {
      out.push({ name: "update_companion", params: { name: focus.ref, kind: t } });
      return out;
    }
  }

  // Senza focus: routing leggero per parole-chiave.
  const m = (re: RegExp) => low.match(re)?.[1]?.trim();
  const name = m(/(?:si chiama|protagonista (?:è |e )?|per)\s+([a-zà-ý]+)/);
  if (name) out.push({ name: "set_protagonist", params: { name: cap(name) } });
  const age = m(/(\d{1,2})\s*ann/);
  if (age) out.push({ name: "set_protagonist", params: { age: +age } });
  const world = WORLD_FLAVORS.find((w) => low.includes(w.replace(/_/g, " ")) || low.includes(w));
  if (world) out.push({ name: "set_world", params: { world_flavor: world } });
  const theme = Object.keys(THEME_TO_ATTRIBUTE).find((th) => low.includes(th));
  if (theme && !story.seed.theme) out.push({ name: "set_theme", params: { theme } });
  const pugno = m(/(?:pugno|il cuore (?:è |e )?|riguarda)[:\s]+(.+)/);
  if (pugno) out.push({ name: "set_pugno", params: { pugno: cap(pugno) } });

  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rid = () => Math.random().toString(36).slice(2, 9);
const mkFocus = (kind: FocusRef["kind"], ref: string, label: string): FocusRef => ({ kind, ref, label });
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

// usato altrove per elencare i comandi disponibili (debug/futura MCP)
export const SEEDING_COMMANDS = COMMANDS;
