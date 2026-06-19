"use client";

import Link from "next/link";
import { MenuMark, GearMark, LeafMark } from "./marks";

/**
 * Header globale dell'app — uguale su ogni pagina.
 * Tre zone: [menu] · Spirale Editrice · [impostazioni].
 * La safe-area del notch è gestita qui (paddingTop), così il guscio è full-bleed.
 */
export function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <header
      className="shrink-0 bg-paper-2"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-[52px] items-center px-1.5">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Apri il menu"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-lg text-ink"
        >
          <MenuMark />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-ink">
          <LeafMark />
          <span className="serif whitespace-nowrap text-[14px] font-medium uppercase tracking-[0.2em]">
            Spirale Editrice
          </span>
        </div>

        <Link
          href="/impostazioni"
          aria-label="Impostazioni e modelli IA"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-lg text-ink"
        >
          <GearMark />
        </Link>
      </div>

      {/* doppia riga "stampata" sotto l'header — il registro della scheda */}
      <div className="h-px bg-ink" />
      <div className="mt-px h-px bg-line" />
    </header>
  );
}
