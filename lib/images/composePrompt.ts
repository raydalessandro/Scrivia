// lib/images/composePrompt.ts — compone il prompt-immagine finale dai blocchi di B2.
// Ordine blindato (metodo Isola, da to_manus_prompts.py): STYLESHEET (testa) → SUBJECT →
// STORY MOMENT → POV → PLACE → [LOCKED divieti] → CHARACTER CONSISTENCY (coda) → FORMAT.
// Le reference confermate sono già in ManusPrompt.references; qui si cappano a 5.

import type { StoryNode, ManusPrompt, EntityRefRecord } from "../types";
import { bookStylesheet, CONSISTENCY_BLOCK } from "../pagePrompts";
import type { ImageRequest } from "./types";

const MAX_REFERENCES = 5; // note Manus: oltre ~5 l'influenza si diluisce

export function composeImagePrompt(node: StoryNode, mp: ManusPrompt, entities: EntityRefRecord[]): ImageRequest {
  // divieti espliciti per le entità in scena (anti-deriva, ripetuti ogni volta)
  const refSet = new Set(mp.references ?? []);
  const locked: string[] = [];
  for (const e of entities) {
    if (e.imageUrl && refSet.has(e.imageUrl) && e.prohibitions?.length) {
      locked.push(`${e.name}: ${e.prohibitions.join("; ")}`);
    }
  }
  const blocks = [
    bookStylesheet(node),
    `SUBJECT — ${mp.characters}`,
    `STORY MOMENT — ${mp.storyMoment}`,
    `POV — ${mp.pov}.`,
    `PLACE — ${mp.place}`,
    ...(locked.length ? [`LOCKED — repeat every time: ${locked.join("  ·  ")}.`] : []),
    CONSISTENCY_BLOCK,
    "FORMAT: vertical 2:3, one image per page, NO text in the image.",
  ];
  return {
    prompt: blocks.join("\n\n"),
    references: (mp.references ?? []).slice(0, MAX_REFERENCES),
    format: "2:3",
    size: "1024x1536",
    quality: "high",
  };
}
