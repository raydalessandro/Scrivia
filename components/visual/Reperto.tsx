import { STAGE_META, type RepertoStage } from "./stage";

/**
 * Il "reperto": un esemplare botanico disegnato in funzione dello STADIO (0..4).
 * Componente puramente presentazionale e deterministico — stesso stadio, stesso disegno.
 * Riusa i token-colore esistenti (inchiostro + colori-attore): nessun colore hardcoded.
 *
 * Primo membro della libreria visiva `components/visual` (linguaggio "Patient Emergence").
 */

const INK = "var(--color-ink)";
const FAINT = "var(--color-line)";
const PAPER = "var(--color-paper-2, var(--color-paper))";

// ---- stipple deterministico sul seme (calcolato una volta, mai re-randomizzato) ----
function rngFactory(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
const STIPPLE: { cx: number; cy: number; r: number; o: number }[] = (() => {
  const rng = rngFactory(11);
  const out: { cx: number; cy: number; r: number; o: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const a = rng() * 6.283;
    const rr = Math.sqrt(rng());
    const x = 45 + Math.cos(a) * 15 * rr;
    const y = 104 + Math.sin(a) * 15 * rr;
    const k = (x - 45) / 15 + (y - 104) / 15;
    if (rng() > 0.5 + 0.4 * k) continue;
    out.push({ cx: +x.toFixed(1), cy: +y.toFixed(1), r: +(0.35 + rng() * 0.4).toFixed(2), o: +(0.4 + rng() * 0.4).toFixed(2) });
  }
  return out;
})();

const n = (v: number) => +v.toFixed(1);

// ---- geometria (viewBox 90×120; il seme è alla base ~ y104) ----
function leafPaths(y: number, sp: number): [string, string] {
  return [
    `M45 ${y} C${n(45 - 22 * sp)} ${y - 4} ${n(45 - 40 * sp)} ${y + 2} ${n(45 - 52 * sp)} ${y + 16} C${n(45 - 28 * sp)} ${y + 22} ${n(45 - 6 * sp)} ${y + 18} 45 ${y} Z`,
    `M44 ${y - 9} C${n(45 + 22 * sp)} ${y - 16} ${n(45 + 40 * sp)} ${y - 10} ${n(45 + 52 * sp)} ${y + 4} C${n(45 + 28 * sp)} ${y + 12} ${n(45 + 6 * sp)} ${y + 8} 44 ${y - 9} Z`,
  ];
}
const stemPath = (toY: number) => `M45 88 C42 72 48 60 45 ${toY + 12} C44 ${toY + 6} 45 ${toY + 2} 45 ${toY}`;
const budPath = (y: number) => `M45 ${y + 12} C39 ${y + 3} 39 ${y - 6} 45 ${y - 14} C51 ${y - 6} 51 ${y + 3} 45 ${y + 12} Z`;

function Seed({ crack }: { crack: boolean }) {
  return (
    <g>
      <path d="M45 104 C40 114 34 119 27 124 M45 104 C50 114 57 118 65 123 M45 106 C45 116 45 121 46 128" stroke={INK} strokeWidth={0.9} fill="none" opacity={0.8} />
      <path d="M45 88 C34 88 28 96 28 104 C28 113 36 120 45 120 C54 120 62 113 62 104 C62 96 56 88 45 88 Z" stroke={INK} strokeWidth={1.3} fill={PAPER} />
      {crack && <path d="M45 88 C44 81 46 77 45 72" stroke={INK} strokeWidth={1.1} fill="none" />}
      {STIPPLE.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={INK} opacity={d.o} />
      ))}
    </g>
  );
}
function Leaf({ y, sp }: { y: number; sp: number }) {
  const [l, r] = leafPaths(y, sp);
  return (
    <g fill="none" stroke={INK} strokeWidth={1.1}>
      <path d={l} />
      <path d={r} />
    </g>
  );
}
function Bloom({ y }: { y: number }) {
  return (
    <g>
      {[22, 33].map((r) => (
        <circle key={r} cx={45} cy={y} r={r} stroke={FAINT} fill="none" opacity={0.4} />
      ))}
      <g fill="none" stroke={INK} strokeWidth={1.2}>
        <path d={`M45 ${y + 16} C32 ${y + 2} 32 ${y - 18} 45 ${y - 32} C58 ${y - 18} 58 ${y + 2} 45 ${y + 16} Z`} />
        <path d={`M45 ${y + 16} C29 ${y + 10} 17 ${y - 8} 16 ${y - 28} C36 ${y - 22} 47 ${y - 8} 45 ${y + 16} Z`} />
        <path d={`M45 ${y + 16} C61 ${y + 10} 73 ${y - 8} 74 ${y - 28} C54 ${y - 22} 43 ${y - 8} 45 ${y + 16} Z`} />
        <circle cx={45} cy={y - 1} r={6.5} strokeWidth={1} />
      </g>
    </g>
  );
}

function parts(stage: RepertoStage) {
  const els: React.ReactNode[] = [];
  const stem = (toY: number) => <path key="stem" d={stemPath(toY)} stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" />;
  switch (stage) {
    case 0:
      els.push(<Seed key="seed" crack={false} />);
      break;
    case 1:
      els.push(<Seed key="seed" crack />, stem(66), <Leaf key="l1" y={64} sp={0.42} />);
      break;
    case 2:
      els.push(<Seed key="seed" crack />, stem(46), <Leaf key="l1" y={62} sp={0.78} />);
      break;
    case 3:
      els.push(<Seed key="seed" crack />, stem(34), <Leaf key="l1" y={66} sp={0.85} />, <Leaf key="l2" y={48} sp={0.7} />, <path key="bud" d={budPath(30)} stroke={INK} strokeWidth={1.2} fill="none" />);
      break;
    case 4:
      els.push(<Seed key="seed" crack />, stem(28), <Leaf key="l1" y={66} sp={0.85} />, <Leaf key="l2" y={48} sp={0.72} />, <Bloom key="bloom" y={22} />);
      break;
  }
  return els;
}

export function Reperto({
  stage,
  size = 54,
  className,
  title,
}: {
  stage: RepertoStage;
  size?: number;
  className?: string;
  title?: string;
}) {
  const meta = STAGE_META[stage];
  const label = title ?? `Storia allo stadio ${meta.rom} · ${meta.word}`;
  return (
    <svg
      width={size}
      height={n((size * 120) / 90)}
      viewBox="0 0 90 120"
      className={className}
      role="img"
      aria-label={label}
    >
      {parts(stage)}
    </svg>
  );
}
