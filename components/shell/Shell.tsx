"use client";

import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Drawer } from "./Drawer";

/**
 * Guscio dell'app — il pattern riusabile per OGNI pagina.
 *
 *   <Shell>{contenuto della pagina}</Shell>
 *
 * Regole serie, identiche su ogni dispositivo:
 * · full-bleed via `fixed inset-0` (copre il viewport ignorando il padding del body
 *   → niente fascia ai bordi, e non tocca le altre pagine).
 * · header FISSO in cima (gestisce la safe-area del notch).
 * · UN SOLO scroll nell'area sotto; overscroll contenuto, niente doppio scroll.
 * · contenuto centrato a una larghezza leggibile sugli schermi grandi, sempre
 *   full-bleed di superficie.
 */
export function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-paper">
      <Header onMenu={() => setMenuOpen(true)} />

      <main
        className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </main>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
