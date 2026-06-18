import type { Story } from "@/lib/types";

/**
 * Stadio di crescita del "reperto" (0..4), derivato dallo stato REALE della storia.
 * Nessun valore hardcoded: si legge dai campi che il back popola (gli stessi segnali
 * usati da `currentPhase` in lib/stages.ts).
 *
 *   0  seme · piantato        (nessun grafo ancora)
 *   I  seme · Progetta fatto  (story.node)
 *  II  voce · Prosa           (story.prose)
 * III  figura · Immagini      (almeno un'immagine generata)
 *  IV  forma · Libro          (story.stage === "book")
 */
export type RepertoStage = 0 | 1 | 2 | 3 | 4;

export function repertoStage(story: Story): RepertoStage {
  if (story.stage === "book") return 4;
  if (story.manus?.some((m) => m.imageUrl)) return 3;
  if (story.prose) return 2;
  if (story.node) return 1;
  return 0;
}

/** Vocabolario per stadio: numero romano, parola, e il colore-attore della "mano". */
export const STAGE_META: { rom: string; word: string; colorVar: string }[] = [
  { rom: "0", word: "seme", colorVar: "var(--color-line)" },
  { rom: "I", word: "seme", colorVar: "var(--color-you)" },
  { rom: "II", word: "voce", colorVar: "var(--color-claude)" },
  { rom: "III", word: "figura", colorVar: "var(--color-manus)" },
  { rom: "IV", word: "forma", colorVar: "var(--color-det)" },
];
