import type { ReactNode } from "react";

/**
 * Foglio d'erbario: una cornice sottile con le quattro tacche d'angolo.
 * È il contenitore-firma della direzione "Erbario". Riusabile su ogni pagina:
 *   <Sheet>…contenuto…</Sheet>
 */
export function Sheet({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative m-3.5 border border-line bg-paper-2 ${className}`}>
      {CORNERS.map(([x, y], i) => (
        <span
          key={i}
          aria-hidden
          className="absolute h-3 w-3"
          style={{
            [y ? "bottom" : "top"]: -1,
            [x ? "right" : "left"]: -1,
            borderTop: y ? "none" : "2px solid var(--color-ink)",
            borderBottom: y ? "2px solid var(--color-ink)" : "none",
            borderLeft: x ? "none" : "2px solid var(--color-ink)",
            borderRight: x ? "2px solid var(--color-ink)" : "none",
          }}
        />
      ))}
      <div className="px-5 pb-7 pt-6">{children}</div>
    </div>
  );
}

const CORNERS: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];
