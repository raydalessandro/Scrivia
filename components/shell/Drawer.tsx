"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LeafMark } from "./marks";

/**
 * Drawer del menu — lo slot di navigazione globale.
 * Per ora poche voci reali; è il punto dove crescerà il menu.
 * Scrim + slide, chiusura con Esc, safe-area gestita.
 */
const ITEMS: { label: string; href: string; italic?: boolean }[] = [
  { label: "Le mie storie", href: "/" },
  { label: "Modelli IA", href: "/impostazioni" },
];

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* scrim */}
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 z-20 transition-opacity duration-200"
        style={{
          background: "rgba(30,25,12,0.28)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* pannello */}
      <nav
        aria-label="Menu"
        aria-hidden={!open}
        className="absolute bottom-0 left-0 top-0 z-30 flex w-[270px] max-w-[82%] flex-col border-r border-line bg-paper-2 transition-transform duration-200 ease-out"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: open ? "translateX(0)" : "translateX(-101%)",
          boxShadow: open ? "8px 0 24px -8px rgba(30,25,12,0.25)" : "none",
        }}
      >
        <div className="flex h-[52px] items-center gap-2 pl-4 pr-2 text-ink">
          <LeafMark />
          <span className="serif flex-1 text-[13.5px] font-medium uppercase tracking-[0.18em]">
            Spirale Editrice
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi il menu"
            className="flex h-[38px] w-[38px] items-center justify-center text-lg text-ink-soft"
          >
            ✕
          </button>
        </div>
        <div className="h-px bg-ink" />
        <div className="mt-px h-px bg-line" />

        <ul className="flex-1 overflow-y-auto py-2">
          {ITEMS.map((it) => {
            const active = it.href === pathname;
            return (
              <li key={it.label}>
                <Link
                  href={it.href}
                  onClick={onClose}
                  className="flex items-center gap-3 py-3.5 pl-4 pr-4 text-ink"
                  style={{
                    background: active ? "var(--color-paper-3)" : "transparent",
                    borderLeft: `3px solid ${active ? "var(--color-erba)" : "transparent"}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] rotate-45"
                    style={{
                      border: `1px solid ${active ? "var(--color-erba)" : "var(--color-ink-faint)"}`,
                      background: active ? "var(--color-erba)" : "transparent",
                    }}
                  />
                  <span className={`text-[15px] ${active ? "font-semibold" : "font-medium"}`}>
                    {it.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-line px-4 py-3.5">
          <span className="serif text-[11.5px] italic text-ink-faint">
            studio del libro · herbarium
          </span>
        </div>
      </nav>
    </>
  );
}
