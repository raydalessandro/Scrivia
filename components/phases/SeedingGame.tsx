"use client";

import { useState, useMemo } from "react";

/* =============================================================================
   PIANTA IL SEME — Fase 1 come "gioco" (modo guidato).
   Deterministico, zero token. Il telaio (movimento EAR, Σ) resta invisibile.
   · VOCE NARRATORE per riferimenti scomposti (faccette × autori) + "a orecchio" (A/B).
   · VOCI PERSONAGGIO: archetipo dominante/sotto-stress + ritmo + "non direbbe mai".
   Produce un GameState; il mapping sul Seed di Scrivia vive in lib/seedFromGame.ts.
   ============================================================================= */

// ---- tipi del gioco ----
export interface CharSlot {
  id: string;
  role: "protagonista" | "comprimario";
  name: string;
  dom: string;
  stress: string;
  ritmo: string;
  words: string;
  never: string;
}
export interface GameSpine { premise: string; problem: string; threshold: string; resolution: string; closure: string }
export type VoicePickValue = "a" | "b" | null;
export interface GameState {
  brain: string;
  name: string; age: number; kind: string;
  world: string; setting: string;
  move: string; theme: string; themeFree: string;
  pugno: string; detail: string;
  hasSage: boolean;
  spine: GameSpine;
  entry: string; closure_type: number | null; arc: string;
  voiceMode: "ref" | "ear";
  refs: Record<string, string[]>;
  refUnique: string;
  voicePicks: VoicePickValue[];
  voice: Record<string, string>;
  cast: CharSlot[] | null;
}
export interface SeedingGameProps {
  onComplete: (game: GameState) => void;
  onCancel?: () => void;
  initial?: Partial<GameState>;
}

const C = {
  paper: "#f7f3e9", paper2: "#fffdf8", ink: "#2c281f", inkSoft: "#6c6354",
  line: "#e4ddcc", line2: "#d6cdb8",
  claude: "#7a5e93", claudeBg: "#efe8f2",
  you: "#3f6ea6", youBg: "#e2ebf4",
  det: "#8a8270", detBg: "#ece7d8",
  gate: "#a64a3f", gateBg: "#f6e6df",
  amber: "#b07d2e", amberBg: "#f4ecd9", manus: "#3a8a80", manusBg: "#e2f0ed",
};
const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';

const STEPS = [
  { id: "scarico", label: "Scarico" },
  { id: "chi", label: "Chi" },
  { id: "dove", label: "Dove" },
  { id: "tema", label: "Di cosa" },
  { id: "cuore", label: "Il cuore" },
  { id: "dettaglio", label: "Il dettaglio" },
  { id: "spina", label: "La spina" },
  { id: "voce", label: "La voce" },
  { id: "personaggi", label: "Le voci" },
  { id: "riepilogo", label: "Il seme" },
] as const;

interface Move { label: string; color: string; attr: string; words: string[] }
const MOVES: Record<string, Move> = {
  accorgersi: { label: "Accorgersi", color: C.you, attr: "distinguere", words: ["paura", "scoperta", "differenza", "curiosita"] },
  avvicinarsi: { label: "Avvicinarsi", color: C.manus, attr: "connettere", words: ["amicizia", "aiuto", "gentilezza", "appartenenza"] },
  attraversare: { label: "Attraversare", color: C.claude, attr: "cambiare", words: ["perdita", "crescere", "cambiamento", "passaggio"] },
};
const CHANGE_WORDS = MOVES.attraversare.words;
const WORLDS = [
  { k: "animali_del_bosco", label: "Animali del bosco" }, { k: "spazio", label: "Spazio" },
  { k: "sottomarino", label: "Sottomarino" }, { k: "citta", label: "Città" },
  { k: "casa", label: "Casa" }, { k: "fiabesco", label: "Fiabesco" },
];
const KINDS = ["bambina", "bambino", "riccio", "volpe", "lepre", "tasso", "uccellino", "robot"];

const ENTRIES: Record<string, { label: string; ex: string }> = {
  A: { label: "Dialogo", ex: "«Non ci vado», disse. E incrociò le braccia." },
  B: { label: "Immagine ferma", ex: "La porta era socchiusa. Dentro, il buio." },
  C: { label: "Voce che irrompe", ex: "«Sei stato tu a combinare questo disastro?»" },
  D: { label: "Pensiero", ex: "Forse, pensò, oggi non era la giornata giusta." },
  E: { label: "Suono", ex: "Tac. Tac. Qualcosa batteva contro il vetro." },
  F: { label: "Gesto isolato", ex: "Allungò una mano. Poi la ritirò." },
};
const CLOSURES: Record<number, { label: string; needsSage?: boolean; ex: string }> = {
  1: { label: "Frase di una figura saggia", needsSage: true, ex: "«Anche il fiume sbaglia strada, a volte», disse la vecchia rana." },
  2: { label: "Immagine ferma", ex: "Rimasero lì, tutti e due, a guardare la stessa nuvola." },
  3: { label: "Gesto silenzioso", ex: "Senza dire niente, gli lasciò il posto sul ramo più alto." },
  4: { label: "Domanda sospesa", ex: "E se domani il vento fosse cambiato di nuovo?" },
  5: { label: "Suono o sensazione", ex: "Sentì il caldo del sole sulla schiena. Bastava." },
  6: { label: "Battuta laterale", ex: "«Bello», disse. «Ma ho ancora un po' fame.»" },
  7: { label: "Colpo di coda", ex: "Andò a dormire. In tasca, però, teneva ancora il sasso." },
};
const ARCS = [
  { k: "un_pomeriggio", label: "Un pomeriggio" }, { k: "un_giorno", label: "Un giorno" },
  { k: "piu_giorni", label: "Più giorni" }, { k: "una_stagione", label: "Una stagione", needsChange: true },
];

const FACETS = [
  { k: "struttura", label: "Struttura", hint: "come è costruito: incastri, cornici, ordine" },
  { k: "lingua", label: "Lingua", hint: "lessico, musica della frase, oralità" },
  { k: "atmosfera", label: "Atmosfera", hint: "il clima sensoriale ed emotivo" },
  { k: "sguardo", label: "Sguardo", hint: "da che parte sta, calore, ironia" },
  { k: "ritmo", label: "Ritmo", hint: "il passo, il respiro, la lunghezza" },
];
const AUTHORS = ["Calvino", "Collodi", "Rodari", "Andersen", "Dickens", "Saint-Exupéry", "Roald Dahl", "Beatrix Potter"];
interface VoiceOption { text: string; axes: Record<string, string> }
interface VoicePair { q: string; a: VoiceOption; b: VoiceOption }
const VOICE_PAIRS: VoicePair[] = [
  { q: "Quale ritmo ti somiglia di più?",
    a: { text: "Pioveva. Il riccio non usciva. Aspettava.", axes: { ritmo: "corte_secche", temperamento: "terrosa" } },
    b: { text: "Pioveva da ore, e il riccio guardava l'acqua scendere lungo il vetro, contando i secondi.", axes: { ritmo: "onda_lunga", temperamento: "sospesa" } } },
  { q: "Da dove guardi la scena?",
    a: { text: "Aveva paura, ma non lo disse a nessuno.", axes: { distanza: "dentro_la_testa" } },
    b: { text: "Da fuori, sembrava solo un riccio fermo in mezzo al prato.", axes: { distanza: "sguardo_da_lontano" } } },
  { q: "Cosa noti per primo?",
    a: { text: "L'aria sapeva di terra bagnata e di foglie.", axes: { lente: "odore_sapore", umorismo: "niente" } },
    b: { text: "Il vento provò a portarsi via il cappello. Non ci riuscì. Riprovò.", axes: { lente: "tatto", umorismo: "battute_laterali" } } },
];

const ARCHETYPES = ["il curioso", "il prudente", "la saggia", "il guascone", "il timido", "il custode", "il ribelle", "il sognatore"];
const CHAR_RHYTHMS = ["corto e secco", "cantilenante", "preciso", "sgangherato", "lento"];
const SOGLIA_TILES = ["lascia qualcosa di suo", "allunga la mano", "apre una porta", "fa il primo passo", "dice una cosa vera ad alta voce"];

const regFor = (age: number) => (age <= 5 ? "basso" : age <= 8 ? "medio" : "alto");
const REG_LABEL: Record<string, string> = { basso: "Basso — frasi cortissime", medio: "Medio — alternanza", alto: "Alto — più lirico" };
const THINK_RE = /capisc|pens|realizz|si rende conto|decide che|comprende|si accorge che/i;
const w = (s: string) => (s || "").trim().split(/\s+/).filter(Boolean).length;
const rid = () => Math.random().toString(36).slice(2, 8);

const blank: GameState = {
  brain: "",
  name: "", age: 4, kind: "",
  world: "", setting: "",
  move: "", theme: "", themeFree: "",
  pugno: "", detail: "",
  hasSage: false,
  spine: { premise: "", problem: "", threshold: "", resolution: "", closure: "" },
  entry: "", closure_type: null, arc: "",
  voiceMode: "ref", refs: {}, refUnique: "", voicePicks: [null, null, null], voice: {},
  cast: null,
};

export function SeedingGame({ onComplete, onCancel, initial }: SeedingGameProps) {
  const [i, setI] = useState(0);
  const [s, setS] = useState<GameState>({ ...blank, ...initial });
  const set = (patch: Partial<GameState>) => setS((x) => ({ ...x, ...patch }));
  const setSpine = (k: keyof GameSpine, v: string) => setS((x) => ({ ...x, spine: { ...x.spine, [k]: v } }));
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const attr = s.move ? MOVES[s.move].attr : "";
  const register = regFor(s.age);
  const arcLocked = !CHANGE_WORDS.includes(s.theme);

  const voice = useMemo(() => {
    const v: Record<string, string> = { ...s.voice };
    s.voicePicks.forEach((p, idx) => { if (p) Object.assign(v, VOICE_PAIRS[idx][p].axes); });
    return v;
  }, [s.voicePicks, s.voice]);

  const cast = useMemo<CharSlot[]>(() => s.cast ?? seedCast(s.name), [s.cast, s.name]);
  const openPoints = useMemo(() => buildOpenPoints(s, attr, voice, cast), [s, attr, voice, cast]);
  const canNext = gate(step.id, s);

  return (
    <div style={{ background: C.paper, color: C.ink }} className="rounded-2xl">
      <div className="mx-auto flex max-w-md flex-col">
        <Header i={i} setI={setI} onCancel={onCancel} />
        <main className="flex-1 px-4 pb-4">
          {step.id === "scarico" && <Scarico s={s} set={set} />}
          {step.id === "chi" && <Chi s={s} set={set} register={register} />}
          {step.id === "dove" && <Dove s={s} set={set} />}
          {step.id === "tema" && <Tema s={s} set={set} />}
          {step.id === "cuore" && <Cuore s={s} set={set} />}
          {step.id === "dettaglio" && <Dettaglio s={s} set={set} />}
          {step.id === "spina" && <Spina s={s} set={set} setSpine={setSpine} arcLocked={arcLocked} register={register} />}
          {step.id === "voce" && <Voce s={s} set={set} voice={voice} />}
          {step.id === "personaggi" && <Personaggi s={s} set={set} cast={cast} />}
          {step.id === "riepilogo" && <Riepilogo s={s} register={register} voice={voice} cast={cast} openPoints={openPoints} onComplete={() => onComplete({ ...s, cast, voice })} />}
        </main>
        {!last && (
          <Footer onBack={() => setI((x) => Math.max(0, x - 1))} onNext={() => setI((x) => Math.min(STEPS.length - 1, x + 1))}
            backDisabled={i === 0} nextDisabled={!canNext} nextLabel={STEPS[i + 1].label} hint={hintFor(step.id, s)} />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Header/Footer */
function Header({ i, setI, onCancel }: { i: number; setI: (n: number) => void; onCancel?: () => void }) {
  return (
    <header className="px-4 pt-5 pb-3">
      <div className="flex items-baseline justify-between">
        <h1 style={{ fontFamily: SERIF }} className="text-lg font-semibold">Pianta il seme</h1>
        <span style={{ color: C.inkSoft }} className="text-xs tabular-nums">
          {i + 1} / {STEPS.length} · {STEPS[i].label}
          {onCancel && <button onClick={onCancel} className="ml-3 underline">studio</button>}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1">
        {STEPS.map((st, k) => (
          <button key={st.id} onClick={() => setI(k)} aria-label={st.label} className="h-1.5 flex-1 rounded-full transition-all"
            style={{ background: k === i ? C.claude : k < i ? C.line2 : C.line }} />
        ))}
      </div>
    </header>
  );
}
function Footer({ onBack, onNext, backDisabled, nextDisabled, nextLabel, hint }: {
  onBack: () => void; onNext: () => void; backDisabled: boolean; nextDisabled: boolean; nextLabel: string; hint: string | null;
}) {
  return (
    <footer style={{ borderTop: `1px solid ${C.line}`, background: "rgba(247,243,233,0.96)" }} className="sticky bottom-0 px-4 py-3 backdrop-blur">
      {hint && <p style={{ color: C.inkSoft }} className="mb-2 text-center text-xs">{hint}</p>}
      <div className="flex gap-2">
        <button onClick={onBack} disabled={backDisabled} style={{ border: `1px solid ${C.line2}`, color: backDisabled ? C.line2 : C.ink }}
          className="min-h-11 rounded-xl px-4 text-sm font-medium disabled:opacity-50">←</button>
        <button onClick={onNext} disabled={nextDisabled} style={{ background: nextDisabled ? C.line : C.ink, color: nextDisabled ? C.inkSoft : C.paper }}
          className="min-h-11 flex-1 rounded-xl text-sm font-semibold transition-colors">
          {nextDisabled ? "Completa per continuare" : `Avanti · ${nextLabel} →`}
        </button>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------ primitive UI */
function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return <div style={{ background: C.paper2, border: `1px solid ${accent || C.line}` }} className="rounded-2xl p-4">{children}</div>;
}
function Title({ kicker, children }: { kicker?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 mt-2">
      {kicker && <p style={{ color: C.claude }} className="text-[11px] font-semibold uppercase tracking-wider">{kicker}</p>}
      <h2 style={{ fontFamily: SERIF }} className="mt-0.5 text-2xl font-semibold leading-tight">{children}</h2>
    </div>
  );
}
function Sub({ children }: { children: React.ReactNode }) { return <p style={{ color: C.inkSoft }} className="-mt-2 mb-4 text-sm leading-relaxed">{children}</p>; }
function Lbl({ children }: { children: React.ReactNode }) { return <label style={{ color: C.inkSoft }} className="mb-1 block text-[11px] font-semibold uppercase tracking-wider">{children}</label>; }
function Chip({ on, onClick, children, disabled, color = C.claude }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; color?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: on ? color : C.paper2, color: on ? "#fff" : disabled ? C.line2 : C.ink, border: `1px solid ${on ? color : C.line2}` }}
      className="min-h-11 rounded-full px-3.5 text-sm transition-colors disabled:opacity-60">{children}</button>
  );
}
function TextInput({ value, onChange, placeholder, big }: { value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    style={{ background: C.paper2, border: `1px solid ${C.line2}`, color: C.ink }}
    className={`w-full rounded-xl px-3.5 ${big ? "py-3 text-base" : "py-2.5 text-sm"} outline-none focus:border-[#7a5e93]`} />;
}
function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ background: C.paper2, border: `1px solid ${C.line2}`, color: C.ink }}
    className="w-full resize-y rounded-xl px-3.5 py-3 text-base leading-relaxed outline-none focus:border-[#7a5e93]" />;
}
function DetNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: C.det }} className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed">
      <span style={{ background: C.detBg, color: C.det }} className="mt-px shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide">det · 0 token</span>
      <span>{children}</span>
    </p>
  );
}

type StepProps = { s: GameState; set: (patch: Partial<GameState>) => void };

/* ----------------------------------------------- steps 0–5 */
function Scarico({ s, set }: StepProps) {
  return (<>
    <Title kicker="Turno 0 — facoltativo">Buttalo fuori, come viene</Title>
    <Sub>Una storia che hai in testa, anche a pezzi. Da qui in poi non ti chiederò mai di inventare a freddo: ti farò scegliere e reagire.</Sub>
    <Card>
      <TextArea value={s.brain} onChange={(v) => set({ brain: v })} rows={5} placeholder="«C'è un riccio che si è appena trasferito nel bosco e non sa come si fa un amico…»" />
      <DetNote>Resta come appunto che l'IA leggerà alla fine. Il gioco va avanti anche se lo lasci vuoto.</DetNote>
    </Card>
    <p style={{ color: C.inkSoft }} className="mt-4 text-center text-sm">Puoi saltare e andare avanti →</p>
  </>);
}
function Chi({ s, set, register }: StepProps & { register: string }) {
  return (<>
    <Title kicker="Chi">Chi è il protagonista?</Title>
    <Card>
      <Lbl>Nome</Lbl>
      <TextInput value={s.name} onChange={(v) => set({ name: v })} placeholder="Nina, Bruno, Pip…" big />
      <div className="mt-4" />
      <Lbl>Età · <span style={{ color: C.ink }}>{s.age} anni</span></Lbl>
      <input type="range" min={2} max={10} value={s.age} onChange={(e) => set({ age: +e.target.value })} className="w-full" style={{ accentColor: C.claude }} />
      <div style={{ background: C.claudeBg, color: C.claude }} className="mt-2 inline-block rounded-lg px-2.5 py-1 text-xs">Registro che ne segue: <b>{REG_LABEL[register]}</b></div>
      <div className="mt-4" />
      <Lbl>Tipo / specie</Lbl>
      <div className="flex flex-wrap gap-2">{KINDS.map((k) => <Chip key={k} on={s.kind === k} onClick={() => set({ kind: s.kind === k ? "" : k })}>{k}</Chip>)}</div>
      <div className="mt-2"><TextInput value={KINDS.includes(s.kind) ? "" : s.kind} onChange={(v) => set({ kind: v })} placeholder="…oppure scrivine un altro" /></div>
      <DetNote>L'età muove il <b>registro</b>; il tipo rende preciso il SUBJECT delle immagini.</DetNote>
    </Card>
  </>);
}
function Dove({ s, set }: StepProps) {
  return (<>
    <Title kicker="Dove">In che mondo siamo?</Title>
    <Card>
      <div className="grid grid-cols-2 gap-2">
        {WORLDS.map((wd) => (
          <button key={wd.k} onClick={() => set({ world: wd.k })}
            style={{ background: s.world === wd.k ? C.claude : C.paper2, color: s.world === wd.k ? "#fff" : C.ink, border: `1px solid ${s.world === wd.k ? C.claude : C.line2}` }}
            className="min-h-14 rounded-xl px-3 text-left text-sm font-medium transition-colors">{wd.label}</button>
        ))}
      </div>
      <div className="mt-4" /><Lbl>Luogo principale</Lbl>
      <TextInput value={s.setting} onChange={(v) => set({ setting: v })} placeholder="il bosco dietro la casa nuova" />
      <DetNote>Mondo = enum (sei tessere); luogo = riga libera. Bastano per il PLACE.</DetNote>
    </Card>
  </>);
}
function Tema({ s, set }: StepProps) {
  const pick = (move: string, word: string) => set({ move, theme: word, themeFree: "" });
  return (<>
    <Title kicker="Di cosa parla, sotto sotto">Il tema</Title>
    <Sub>Una parola. Tocca quella più vicina: il motore terrà conto di un movimento di fondo, senza mai nominarlo nel testo.</Sub>
    <div className="space-y-3">
      {Object.entries(MOVES).map(([key, m]) => (
        <div key={key} style={{ background: C.paper2, border: `1px solid ${s.move === key ? m.color : C.line}`, borderLeft: `4px solid ${m.color}` }} className="rounded-2xl p-3">
          <p style={{ color: m.color }} className="mb-2 text-[11px] font-semibold uppercase tracking-wider">{m.label}</p>
          <div className="flex flex-wrap gap-2">{m.words.map((word) => <Chip key={word} on={s.theme === word} color={m.color} onClick={() => pick(key, word)}>{word}</Chip>)}</div>
        </div>
      ))}
    </div>
    <div className="mt-3">
      <TextInput value={s.themeFree} onChange={(v) => set({ themeFree: v, theme: "", move: "" })} placeholder="…oppure un tema tuo (resterà un punto aperto)" />
      {s.themeFree && <div style={{ background: C.amberBg, color: C.amber }} className="mt-2 rounded-lg px-3 py-2 text-xs">Tema libero: nessun movimento mappato. Finirà tra i <b>punti aperti</b>.</div>}
    </div>
    <DetNote>Dalle tessere il movimento è <b>sempre</b> deciso qui — buco logico chiuso a monte.</DetNote>
  </>);
}
const PUGNO_SEEDS = ["si è appena trasferito e non sa come si fa un amico", "ha perso una cosa a cui teneva e non lo dice a nessuno", "vuole fare una cosa grande ma ha paura di provarci"];
function Cuore({ s, set }: StepProps) {
  return (<>
    <Title kicker="L'unica frase che scrivi tu">Il cuore</Title>
    <Sub>In una frase: cosa succede, o cosa sente. È la parte che nessuno script può inventare al posto tuo — ma posso darti un trampolino.</Sub>
    <Card>
      <TextArea value={s.pugno} onChange={(v) => set({ pugno: v })} rows={3} placeholder="cosa succede / cosa sente…" />
      <p style={{ color: C.inkSoft }} className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider">Trampolini — tocca, poi cambia</p>
      <div className="space-y-1.5">{PUGNO_SEEDS.map((p) => (
        <button key={p} onClick={() => set({ pugno: p })} style={{ background: C.claudeBg, color: C.ink, border: `1px solid ${C.line}` }} className="w-full rounded-xl px-3 py-2 text-left text-sm">«{p}»</button>
      ))}</div>
    </Card>
  </>);
}
function Dettaglio({ s, set }: StepProps) {
  return (<>
    <Title kicker="Quello che fa la differenza">Un dettaglio vero</Title>
    <Sub>Un oggetto, un'abitudine, un posto reali del bambino. È il filo che torna nella storia — spesso il campo che si dimentica.</Sub>
    <Card>
      <TextArea value={s.detail} onChange={(v) => set({ detail: v })} rows={3} placeholder="dorme con un calzino spaiato · conta i gradini · ha un sasso in tasca" />
      <DetNote>Diventa il <b>motivo ricorrente</b> e il <b>dettaglio personale</b>: alimenta brief e prompt immagine.</DetNote>
    </Card>
  </>);
}

/* --------------------------------------------------------------- 6. Spina */
function Spina({ s, set, setSpine, arcLocked, register }: StepProps & { setSpine: (k: keyof GameSpine, v: string) => void; arcLocked: boolean; register: string }) {
  const th = s.spine.threshold;
  const thoughtWarn = th && (THINK_RE.test(th) || w(th) < 4);
  return (<>
    <Title kicker="Contenuto a sinistra, grammatica a destra">La spina</Title>
    <Sub>Le frasi le scrivi tu (con un esempio accanto), o parti da una tessera. Le scelte di forma mostrano la conseguenza prima che scegli.</Sub>
    <div className="space-y-4">
      <Beat label="Premessa" hint="cosa mette in moto" ex="Bruno arriva nel bosco con uno scatolone più grande di lui." value={s.spine.premise} onChange={(v) => setSpine("premise", v)}>
        <p style={{ color: C.inkSoft }} className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider">Come si apre? (anteprima viva)</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(ENTRIES).map(([k, e]) => {
            const on = s.entry === k;
            return (
              <button key={k} onClick={() => set({ entry: on ? "" : k })} style={{ background: on ? C.claudeBg : C.paper2, border: `1px solid ${on ? C.claude : C.line2}` }} className="rounded-lg px-2.5 py-2 text-left">
                <span style={{ color: on ? C.claude : C.ink }} className="block text-xs font-semibold">{k} · {e.label}</span>
                <span style={{ color: C.inkSoft }} className="mt-0.5 block text-[11px] italic leading-snug">{e.ex}</span>
              </button>
            );
          })}
        </div>
      </Beat>

      <Beat label="Problema" hint="la voglia + la paura, insieme" ex="Vorrebbe avvicinarsi, ma ogni volta che ci prova si nasconde." value={s.spine.problem} onChange={(v) => setSpine("problem", v)} />

      <Beat label="Soglia" hint="una DECISIONE o un GESTO — non un pensiero" ex="Lascia lo scatolone aperto sul sentiero, con dentro le sue cose, e si allontana di un passo." value={s.spine.threshold} onChange={(v) => setSpine("threshold", v)}>
        <p style={{ color: C.inkSoft }} className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider">Parti da un gesto (poi personalizza) — oppure scrivi sopra</p>
        <div className="flex flex-wrap gap-2">{SOGLIA_TILES.map((t) => <Chip key={t} on={th === t} onClick={() => setSpine("threshold", th === t ? "" : t)}>{t}</Chip>)}</div>
        {thoughtWarn && (
          <div style={{ background: C.gateBg, color: C.gate }} className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed">
            <b>Sembra un pensiero o è troppo corta.</b> La soglia regge se è un gesto che si <i>vede</i>. — Va bene anche così: l'IA proporrà 2–3 gesti concreti.
          </div>
        )}
      </Beat>

      <Beat label="Risoluzione" hint="come si MUOVE (non «si risolve»)" ex="Un altro cucciolo si ferma, guarda dentro lo scatolone, e ci mette accanto una sua cosa." value={s.spine.resolution} onChange={(v) => setSpine("resolution", v)} />

      <div style={{ background: C.paper2, border: `1px solid ${C.line}` }} className="rounded-2xl p-3">
        <p style={{ color: C.ink }} className="text-sm font-semibold">Chiusura <span style={{ color: C.inkSoft }} className="font-normal">— l'immagine che sigilla</span></p>
        <label style={{ background: s.hasSage ? C.detBg : "transparent", border: `1px solid ${C.line2}` }} className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2">
          <input type="checkbox" checked={s.hasSage} onChange={(e) => set({ hasSage: e.target.checked, closure_type: !e.target.checked && s.closure_type === 1 ? null : s.closure_type })} style={{ accentColor: C.det }} />
          <span className="text-sm">C'è una figura saggia nel cast (rana vecchia, gufo, nonna…)</span>
        </label>
        <div className="mt-3 grid grid-cols-1 gap-1.5">
          {Object.entries(CLOSURES).map(([num, c]) => {
            const n = +num, on = s.closure_type === n, dis = !!c.needsSage && !s.hasSage;
            return (
              <button key={n} onClick={() => !dis && set({ closure_type: on ? null : n })} disabled={dis} style={{ background: on ? C.claudeBg : C.paper2, border: `1px solid ${on ? C.claude : C.line2}`, opacity: dis ? 0.5 : 1 }} className="rounded-lg px-2.5 py-2 text-left">
                <span style={{ color: on ? C.claude : C.ink }} className="block text-xs font-semibold">{n} · {c.label}{dis && " — serve una figura saggia"}</span>
                <span style={{ color: C.inkSoft }} className="mt-0.5 block text-[11px] italic leading-snug">{c.ex}</span>
              </button>
            );
          })}
        </div>
        <TextInput value={s.spine.closure} onChange={(v) => setSpine("closure", v)} placeholder="…o una direzione tua (facoltativo)" />
      </div>

      <div style={{ background: C.paper2, border: `1px solid ${C.line}` }} className="rounded-2xl p-3">
        <p style={{ color: C.ink }} className="mb-2 text-sm font-semibold">Quanto dura?</p>
        <div className="flex flex-wrap gap-2">{ARCS.map((a) => {
          const dis = !!a.needsChange && arcLocked;
          return <Chip key={a.k} on={s.arc === a.k} disabled={dis} onClick={() => set({ arc: s.arc === a.k ? "" : a.k })}>{a.label}{dis && " · solo cambiamento"}</Chip>;
        })}</div>
        <DetNote>Apertura, chiusura, registro (<b>{REG_LABEL[register].split(" —")[0]}</b>) e arco danno l'arco invisibile. Quattro tessere = combinatoria.</DetNote>
      </div>
    </div>
  </>);
}
function Beat({ label, hint, ex, value, onChange, children }: { label: string; hint: string; ex: string; value: string; onChange: (v: string) => void; children?: React.ReactNode }) {
  return (
    <div style={{ background: C.paper2, border: `1px solid ${C.line}` }} className="rounded-2xl p-3">
      <p style={{ color: C.ink }} className="text-sm font-semibold">{label} <span style={{ color: C.inkSoft }} className="font-normal">— {hint}</span></p>
      <p style={{ color: C.inkSoft }} className="mb-2 mt-1 text-[12px] italic leading-snug">es. {ex}</p>
      <TextArea value={value} onChange={onChange} rows={2} placeholder="scrivi la tua…" />
      {children}
    </div>
  );
}

/* ------------------------------------------------- 7. VOCE (narratore) */
function Voce({ s, set, voice }: StepProps & { voice: Record<string, string> }) {
  return (<>
    <Title kicker="La voce del racconto">Da chi prende, la voce?</Title>
    <Sub>Due strade, scegli come ti viene comodo. La prima compone una voce nuova da riferimenti scomposti; la seconda la ricava a orecchio.</Sub>
    <div className="mb-4 flex gap-1.5 rounded-xl p-1" style={{ background: C.detBg }}>
      {([["ref", "Per riferimenti"], ["ear", "A orecchio"]] as const).map(([k, lab]) => (
        <button key={k} onClick={() => set({ voiceMode: k })} style={{ background: s.voiceMode === k ? C.paper2 : "transparent", color: s.voiceMode === k ? C.ink : C.inkSoft, boxShadow: s.voiceMode === k ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }} className="flex-1 rounded-lg py-2 text-sm font-medium">{lab}</button>
      ))}
    </div>
    {s.voiceMode === "ref" ? <VoceRiferimenti s={s} set={set} /> : <VoceOrecchio s={s} set={set} voice={voice} />}
  </>);
}

function VoceRiferimenti({ s, set }: StepProps) {
  const chosen = Object.keys(s.refs);
  const toggleAuthor = (a: string) => set({ refs: chosen.includes(a) ? omit(s.refs, a) : { ...s.refs, [a]: [] } });
  const toggleFacet = (a: string, f: string) => {
    const cur = s.refs[a] || [];
    set({ refs: { ...s.refs, [a]: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] } });
  };
  const facetOwners: Record<string, string[]> = {};
  chosen.forEach((a) => (s.refs[a] || []).forEach((f) => { (facetOwners[f] ||= []).push(a); }));
  const conflicts = Object.entries(facetOwners).filter(([, owners]) => owners.length > 1);
  const recipe = chosen.flatMap((a) => (s.refs[a] || []).map((f) => ({ a, f })));

  return (<>
    <Card>
      <Lbl>1 · Scegli 2–3 riferimenti</Lbl>
      <div className="flex flex-wrap gap-2">{AUTHORS.map((a) => <Chip key={a} on={chosen.includes(a)} onClick={() => toggleAuthor(a)}>{a}</Chip>)}</div>
    </Card>

    {chosen.length > 0 && (
      <div className="mt-3 space-y-2">
        <Lbl>2 · Di ognuno, cosa prendi? (la mossa che evita il template)</Lbl>
        {chosen.map((a) => (
          <div key={a} style={{ background: C.paper2, border: `1px solid ${C.line}` }} className="rounded-2xl p-3">
            <p style={{ color: C.ink }} className="mb-2 text-sm font-semibold">{a}</p>
            <div className="flex flex-wrap gap-1.5">
              {FACETS.map((f) => {
                const on = (s.refs[a] || []).includes(f.k);
                const takenElsewhere = facetOwners[f.k]?.some((o) => o !== a);
                return <Chip key={f.k} on={on} onClick={() => toggleFacet(a, f.k)} color={takenElsewhere && !on ? C.amber : C.claude}>{f.label}</Chip>;
              })}
            </div>
          </div>
        ))}
        {conflicts.length > 0 && (
          <div style={{ background: C.amberBg, color: C.amber }} className="rounded-lg px-3 py-2 text-xs leading-relaxed">
            Stessa faccetta presa da più autori: {conflicts.map(([f, o]) => `${FACETS.find((x) => x.k === f)?.label} (${o.join(" + ")})`).join(" · ")}. Due faccette diverse si pestano — scegline una dominante.
          </div>
        )}
      </div>
    )}

    <div className="mt-3"><Card>
      <Lbl>3 · Un segno solo tuo</Lbl>
      <TextInput value={s.refUnique} onChange={(v) => set({ refUnique: v })} placeholder="es. ogni capitolo finisce con una domanda · i colori sempre nominati" />
    </Card></div>

    {(recipe.length > 0 || s.refUnique) && (
      <div style={{ background: C.claudeBg, border: `1px solid ${C.claude}` }} className="mt-3 rounded-2xl p-4">
        <p style={{ color: C.claude }} className="text-[11px] font-semibold uppercase tracking-wider">La voce composta</p>
        <ul className="mt-2 space-y-1">
          {FACETS.map((f) => {
            const owner = recipe.find((r) => r.f === f.k);
            if (!owner) return null;
            return <li key={f.k} className="text-sm"><span style={{ color: C.inkSoft }}>{f.label}:</span> <b>{owner.a}</b></li>;
          })}
          {s.refUnique && <li className="text-sm"><span style={{ color: C.inkSoft }}>Il tuo segno:</span> <b>{s.refUnique}</b></li>}
        </ul>
        <DetNote>Faccette ortogonali da autori diversi = una voce che non è nessuno di loro. L'IA scriverà <b>dentro questa ricetta</b>, non imiterà un autore.</DetNote>
      </div>
    )}
  </>);
}

function VoceOrecchio({ s, set, voice }: StepProps & { voice: Record<string, string> }) {
  const answered = s.voicePicks.filter(Boolean).length;
  const pick = (idx: number, which: VoicePickValue) => set({ voicePicks: s.voicePicks.map((p, k) => (k === idx ? which : p)) });
  const AX: [string, string][] = [["temperamento", "Temperamento"], ["ritmo", "Ritmo"], ["distanza", "Distanza"], ["lente", "Lente"], ["umorismo", "Umorismo"]];
  return (<>
    <div className="space-y-3">
      {VOICE_PAIRS.map((p, idx) => (
        <Card key={idx}>
          <p style={{ color: C.inkSoft }} className="mb-2 text-[11px] font-semibold uppercase tracking-wider">{p.q}</p>
          {(["a", "b"] as const).map((which) => {
            const on = s.voicePicks[idx] === which;
            return (
              <button key={which} onClick={() => pick(idx, which)} style={{ background: on ? C.claudeBg : C.paper2, border: `1px solid ${on ? C.claude : C.line2}` }} className="mb-2 block w-full rounded-xl px-3 py-2.5 text-left last:mb-0">
                <span style={{ color: C.ink }} className="text-sm italic leading-snug">«{p[which].text}»</span>
              </button>
            );
          })}
        </Card>
      ))}
    </div>
    {answered > 0 && (
      <div style={{ background: C.claudeBg, border: `1px solid ${C.claude}` }} className="mt-4 rounded-2xl p-4">
        <p style={{ color: C.claude }} className="text-[11px] font-semibold uppercase tracking-wider">La tua carta della voce {answered < 3 && `· ${answered}/3`}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{AX.map(([k, lab]) => (
          <span key={k} style={{ background: C.paper2, border: `1px solid ${C.line2}`, color: voice[k] ? C.ink : C.inkSoft }} className="rounded-full px-2.5 py-1 text-xs">{lab}: <b>{voice[k] ? voice[k].replace(/_/g, " ") : "—"}</b></span>
        ))}</div>
      </div>
    )}
  </>);
}

/* --------------------------------------------- 8. PERSONAGGI (voci) */
function Personaggi({ s, set, cast }: StepProps & { cast: CharSlot[] }) {
  const upd = (id: string, patch: Partial<CharSlot>) => set({ cast: cast.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const add = () => set({ cast: [...cast, newChar()] });
  const rem = (id: string) => set({ cast: cast.filter((c) => c.id !== id) });

  const clashes: [string, string][] = [];
  for (let a = 0; a < cast.length; a++) for (let b = a + 1; b < cast.length; b++) {
    const x = cast[a], y = cast[b];
    if (x.dom && x.dom === y.dom && x.ritmo && x.ritmo === y.ritmo) clashes.push([x.name || "?", y.name || "?"]);
  }
  return (<>
    <Title kicker="Se no parlano tutti uguale">Le voci dei personaggi</Title>
    <Sub>La stessa cura del protagonista, quasi al suo livello, su ciascuno. Non un archetipo puro: una miscela. E il campo che li distingue di più è ciò che <b>non</b> direbbero mai.</Sub>

    <div className="space-y-3">
      {cast.map((c) => <CharCard key={c.id} c={c} upd={(p) => upd(c.id, p)} rem={c.role === "protagonista" ? null : () => rem(c.id)} />)}
    </div>

    <button onClick={add} style={{ border: `1px dashed ${C.line2}`, color: C.inkSoft }} className="mt-3 min-h-11 w-full rounded-xl text-sm">+ aggiungi un personaggio</button>

    {cast.length > 1 && (
      <div style={{ background: C.detBg, border: `1px solid ${C.line2}` }} className="mt-4 rounded-2xl p-4">
        <p style={{ color: C.det }} className="text-[11px] font-semibold uppercase tracking-wider">Le voci a confronto</p>
        <div className="mt-2 space-y-1.5">
          {cast.map((c) => (
            <div key={c.id} className="text-sm">
              <b>{c.name || "—"}</b> <span style={{ color: C.inkSoft }}>· {c.dom || "archetipo?"} · {c.ritmo || "ritmo?"}</span>
              {c.never && <span style={{ color: C.inkSoft }} className="block text-[12px]">non direbbe mai: «{c.never}»</span>}
            </div>
          ))}
        </div>
        {clashes.length > 0 && (
          <div style={{ background: C.gateBg, color: C.gate }} className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed">
            Rischiano di parlare uguale: {clashes.map(([a, b]) => `${a} e ${b}`).join(" · ")}. Cambia il dominante o il ritmo di uno dei due.
          </div>
        )}
      </div>
    )}
    <DetNote>Miscela archetipica = innesto della <b>matrice-72 (EAR-PERSONAGGI)</b>: qui i dosaggi e i trigger; il telaio Σ resta invisibile, come il movimento.</DetNote>
  </>);
}
function CharCard({ c, upd, rem }: { c: CharSlot; upd: (p: Partial<CharSlot>) => void; rem: (() => void) | null }) {
  const thin = c.dom && !c.never;
  return (
    <div style={{ background: C.paper2, border: `1px solid ${C.line}` }} className="rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <input value={c.name} onChange={(e) => upd({ name: e.target.value })} placeholder="nome"
          style={{ background: "transparent", border: "none", color: C.ink }} className="flex-1 text-base font-semibold outline-none" />
        <span style={{ background: c.role === "protagonista" ? C.claudeBg : C.detBg, color: c.role === "protagonista" ? C.claude : C.det }} className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{c.role}</span>
        {rem && <button onClick={rem} style={{ color: C.inkSoft }} className="px-1 text-sm">✕</button>}
      </div>

      <p style={{ color: C.inkSoft }} className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider">Chi è (dominante)</p>
      <div className="flex flex-wrap gap-1.5">{ARCHETYPES.map((a) => <Chip key={a} on={c.dom === a} onClick={() => upd({ dom: c.dom === a ? "" : a })}>{a}</Chip>)}</div>

      {c.dom && (<>
        <p style={{ color: C.inkSoft }} className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider">Sotto stress diventa <span className="normal-case opacity-70">(facoltativo — la miscela)</span></p>
        <div className="flex flex-wrap gap-1.5">{ARCHETYPES.filter((a) => a !== c.dom).map((a) => <Chip key={a} on={c.stress === a} color={C.gate} onClick={() => upd({ stress: c.stress === a ? "" : a })}>{a}</Chip>)}</div>
      </>)}

      <p style={{ color: C.inkSoft }} className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider">Ritmo</p>
      <div className="flex flex-wrap gap-1.5">{CHAR_RHYTHMS.map((r) => <Chip key={r} on={c.ritmo === r} onClick={() => upd({ ritmo: c.ritmo === r ? "" : r })}>{r}</Chip>)}</div>

      <div className="mt-3"><Lbl>Parole sue</Lbl><TextInput value={c.words} onChange={(v) => upd({ words: v })} placeholder="dice sempre «praticamente»" /></div>

      <div className="mt-2"><Lbl>Non direbbe MAI</Lbl>
        <div style={{ border: `1px solid ${thin ? C.amber : C.line2}`, borderRadius: 12 }}>
          <TextInput value={c.never} onChange={(v) => upd({ never: v })} placeholder="una bugia · una parolaccia · «non lo so»" />
        </div>
        {thin && <p style={{ color: C.amber }} className="mt-1 text-[11px]">È il campo che li distingue di più: vale la pena riempirlo.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 9. Riepilogo */
function Riepilogo({ s, register, voice, cast, openPoints, onComplete }: {
  s: GameState; register: string; voice: Record<string, string>; cast: CharSlot[]; openPoints: OpenPoint[]; onComplete: () => void;
}) {
  const recap = composeRecap(s);
  const voiceLine = describeVoice(s, voice);
  const grammar = [
    { k: "Apertura", v: s.entry ? `${s.entry} · ${ENTRIES[s.entry].label}` : "il motore sceglie", picked: !!s.entry },
    { k: "Chiusura", v: s.closure_type ? `${s.closure_type} · ${CLOSURES[s.closure_type].label}` : "il motore sceglie", picked: !!s.closure_type },
    { k: "Registro", v: REG_LABEL[register].split(" —")[0], picked: true },
    { k: "Arco", v: s.arc ? ARCS.find((a) => a.k === s.arc)!.label : "il motore sceglie", picked: !!s.arc },
    { k: "Voce", v: voiceLine || "da definire", picked: !!voiceLine },
    { k: "Personaggi con voce", v: `${cast.filter((c) => c.dom).length}/${cast.length}`, picked: cast.every((c) => c.dom) },
  ];
  return (<>
    <Title kicker="Cancello 1 — guarda e conferma">Il seme</Title>
    <div style={{ background: C.paper2, border: `1px solid ${C.line}` }} className="rounded-2xl p-4">
      <p style={{ fontFamily: SERIF, color: C.ink }} className="text-[15px] leading-relaxed">{recap}</p>
    </div>

    <div className="mt-4 grid gap-3">
      <div style={{ background: C.detBg, border: `1px solid ${C.line2}` }} className="rounded-2xl p-4">
        <p style={{ color: C.det }} className="text-[11px] font-semibold uppercase tracking-wider">Deciso qui — zero token, deterministico</p>
        <ul className="mt-2 space-y-1.5">{grammar.map((g) => (
          <li key={g.k} className="flex items-baseline justify-between gap-3 text-sm">
            <span style={{ color: C.inkSoft }} className="shrink-0">{g.k}</span>
            <span style={{ color: g.picked ? C.ink : C.inkSoft }} className="text-right">{g.v}{g.picked && <b style={{ color: C.det }}> ·</b>}</span>
          </li>
        ))}</ul>
      </div>

      <div style={{ background: C.claudeBg, border: `1px solid ${C.claude}` }} className="rounded-2xl p-4">
        <p style={{ color: C.claude }} className="text-[11px] font-semibold uppercase tracking-wider">L'IA rifinirà — non inventa, risolve</p>
        <ul className="mt-2 space-y-2">
          {openPoints.map((p, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span style={{ background: VERB_COLOR[p.type].bg, color: VERB_COLOR[p.type].fg }} className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">{p.type}</span>
              <span style={{ color: C.ink }} className="text-sm leading-snug">{p.text}</span>
            </li>
          ))}
          <li className="flex items-start gap-2">
            <span style={{ background: VERB_COLOR.rendi.bg, color: VERB_COLOR.rendi.fg }} className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">rendi</span>
            <span style={{ color: C.ink }} className="text-sm leading-snug">Scrivere la prosa dal brief, pagina per pagina, dentro la voce e le voci scelte.</span>
          </li>
        </ul>
      </div>
    </div>

    <button onClick={onComplete} style={{ background: C.ink, color: C.paper }} className="mt-4 min-h-12 w-full rounded-xl text-sm font-semibold">Pianta il seme →</button>
    <p style={{ color: C.inkSoft }} className="mt-3 text-center text-xs leading-relaxed">Il seme passa allo studio: l'IA parte già da tutto questo, non da zero.</p>
  </>);
}

const VERB_COLOR: Record<string, { bg: string; fg: string }> = {
  varianti: { bg: C.claudeBg, fg: C.claude },
  disambigua: { bg: C.amberBg, fg: C.amber },
  arricchisci: { bg: C.manusBg, fg: C.manus },
  rendi: { bg: C.youBg, fg: C.you },
};

/* ----------------------------------------------------------------- logica */
function seedCast(name: string): CharSlot[] { return [{ id: "prot", role: "protagonista", name: name || "Protagonista", dom: "", stress: "", ritmo: "", words: "", never: "" }]; }
function newChar(): CharSlot { return { id: rid(), role: "comprimario", name: "", dom: "", stress: "", ritmo: "", words: "", never: "" }; }
function omit<T extends Record<string, unknown>>(obj: T, key: string): T { const o = { ...obj }; delete o[key]; return o; }

type StepId = (typeof STEPS)[number]["id"];
function gate(id: StepId, s: GameState): boolean {
  switch (id) {
    case "chi": return !!s.name.trim();
    case "dove": return !!s.world;
    case "tema": return !!s.theme || !!s.themeFree.trim();
    case "cuore": return !!s.pugno.trim();
    case "spina": return (["premise", "problem", "threshold", "resolution"] as const).every((k) => s.spine[k].trim());
    default: return true;
  }
}
function hintFor(id: StepId, s: GameState): string | null {
  if (id === "chi" && !s.name.trim()) return "Serve almeno un nome";
  if (id === "dove" && !s.world) return "Tocca un mondo";
  if (id === "tema" && !s.theme && !s.themeFree.trim()) return "Tocca una parola, o scrivine una tua";
  if (id === "cuore" && !s.pugno.trim()) return "Il cuore è l'unica cosa che scrivi tu";
  if (id === "spina") { const m = (["premise", "problem", "threshold", "resolution"] as const).filter((k) => !s.spine[k].trim()).length; if (m) return `${m} pezzi della spina ancora vuoti`; }
  return null;
}
export function describeVoice(s: GameState, voice: Record<string, string>): string {
  if (s.voiceMode === "ref") {
    const parts = Object.keys(s.refs).flatMap((a) => (s.refs[a] || []).map((f) => `${a}/${f}`));
    if (s.refUnique) parts.push("segno: " + s.refUnique);
    return parts.length ? parts.join(" · ") : "";
  }
  const got = ["temperamento", "ritmo", "distanza", "lente", "umorismo"].map((k) => voice[k]).filter(Boolean);
  return got.length ? got.map((x) => x.replace(/_/g, " ")).join(" · ") : "";
}
interface OpenPoint { type: "varianti" | "disambigua" | "arricchisci"; text: string }
function buildOpenPoints(s: GameState, attr: string, voice: Record<string, string>, cast: CharSlot[]): OpenPoint[] {
  const out: OpenPoint[] = [];
  if (s.themeFree.trim() && !attr) out.push({ type: "disambigua", text: "Tema libero: scegliere il movimento di fondo (o confermare quello dell'autore)." });
  const th = s.spine.threshold;
  if (th && (THINK_RE.test(th) || w(th) < 4)) out.push({ type: "varianti", text: "La soglia è ancora un pensiero o è generica: proporre 2–3 gesti concreti." });
  if (!s.detail.trim()) out.push({ type: "arricchisci", text: "Manca il dettaglio vero: suggerirne uno coerente col bambino." });
  if (!s.spine.closure.trim() && !s.closure_type) out.push({ type: "varianti", text: "Chiusura non scelta: proporre un'immagine che sigilla, coerente con l'arco." });
  if (!describeVoice(s, voice)) out.push({ type: "varianti", text: "Voce non definita: proporre 2–3 ricette di voce tra cui scegliere." });
  const thinChars = cast.filter((c) => !c.dom || !c.never).map((c) => c.name).filter(Boolean);
  if (thinChars.length) out.push({ type: "arricchisci", text: `Voci ancora poco distinte (${thinChars.join(", ")}): differenziarle — ritmo e «cosa non direbbe mai».` });
  return out;
}
function composeRecap(s: GameState): string {
  const who = `${s.name || "il protagonista"}${s.age ? `, ${s.age} anni` : ""}${s.kind ? ` (${s.kind})` : ""}`;
  const world = s.world ? `, nel mondo «${WORLDS.find((wd) => wd.k === s.world)?.label.toLowerCase()}»` : "";
  const cuore = s.pugno ? ` Il cuore: «${s.pugno}».` : "";
  const sp = s.spine;
  const due = sp.premise && sp.resolution ? ` In due righe: ${trimDot(sp.premise)} … fino a ${lower(trimDot(sp.resolution))}.` : "";
  const det = s.detail ? ` Torna sempre: ${lower(trimDot(s.detail))}.` : "";
  return `Allora: ${who}${world}.${cuore}${due}${det} Va bene così, o cambi qualcosa?`;
}
const trimDot = (t: string) => t.trim().replace(/[.…]+$/, "");
const lower = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
