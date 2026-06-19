// Segni grafici dell'header — coerenti col linguaggio "Erbario".
// Puri (nessun hook): possono stare ovunque.

export function MenuMark({ size = 20 }: { size?: number }) {
  // tre filetti da righello: leggono "menu" ma restano in lingua Erbario
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="17" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </g>
    </svg>
  );
}

export function GearMark({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth={1.4} fill="none">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
      </g>
    </svg>
  );
}

export function LeafMark({ size = 16 }: { size?: number }) {
  // piantina-marchio: gambo + due foglie (la stessa famiglia del Reperto)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <g stroke="currentColor" strokeWidth={1.6} fill="none" strokeLinecap="round">
        <path d="M20 34 C20 22 20 14 20 8" />
        <path d="M20 22 C12 18 8 19 4 26 C12 28 17 26 20 22 Z" />
        <path d="M20 16 C28 12 32 13 36 20 C28 22 23 20 20 16 Z" />
      </g>
    </svg>
  );
}
