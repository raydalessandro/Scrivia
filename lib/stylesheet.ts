// stylesheet.ts — costanti immagine condivise (SINGLE SOURCE).
// Lo STYLESHEET e le costanti di scena le leggono SIA i prompt-reference (F0.2)
// SIA i prompt-pagina (F1.2): un solo posto, niente drift, e il prefisso identico
// in testa a ogni prompt dà coerenza + cache. Portate 1:1 da Isola (to_manus_prompts.py).

export const WORLD_STYLE: Record<string, string> = {
  animali_del_bosco: "Anthropomorphic woodland animals in the British picture-book tradition (Beatrix Potter, Brian Wildsmith), contemporary warmth; naturalistic animal anatomy, gently stylized, never cartoon-flat.",
  casa: "Naturalistic children and everyday lived-in settings, gently stylized for warmth, never cartoon-flat.",
  citta: "Naturalistic children in a warm everyday town, gently stylized, never cartoon-flat.",
  spazio: "A gentle near-future space setting, soft and wondrous, naturalistic figures, never glossy sci-fi.",
  sottomarino: "A soft underwater world, light filtering through water, naturalistic sea creatures, never cartoonish.",
  fiabesco: "A quiet grounded fairy-tale world, warm and real, never kitsch fantasy.",
};
export const DEFAULT_WORLD_STYLE = "A warm, naturalistic picture-book world, gently stylized, never cartoon-flat.";

export const SEASON_PALETTE_EN: Record<string, string> = {
  inverno: "Earthy restrained palette with cool whites and soft blues, low clear winter light.",
  primavera: "Earthy restrained palette with tender greens and pale yellows, new mobile spring light.",
  estate: "Earthy restrained palette with warm ochres and full shadows, high summer light.",
  autunno: "Earthy restrained palette with reds, browns and soft grays, low oblique autumn light.",
};

// scala relativa (altezza) per SCALA nei prompt-pagina (F1.2); protagonista = 1.0
export const KIND_SCALE: Record<string, number> = {
  uccello: 0.2, ghiandaia: 0.2, passero: 0.15, gufo: 0.3, corvo: 0.25,
  gatto: 0.3, coniglio: 0.3, riccio: 0.2, scoiattolo: 0.2, volpe: 0.4,
  cane: 0.45, tasso: 0.4, cerbiatto: 0.6, pesce: 0.25,
  adulto: 1.25, bambino: 0.9, bambina: 0.9,
};

export interface StylesheetOpts { world?: string; season?: string; ageHint?: number | null; }

export function buildStylesheet(opts: StylesheetOpts): string {
  const world = WORLD_STYLE[opts.world ?? ""] ?? DEFAULT_WORLD_STYLE;
  const palette = SEASON_PALETTE_EN[opts.season ?? ""] ?? "Earthy restrained palette.";
  const ages = typeof opts.ageHint === "number" && opts.ageHint <= 7 ? "ages 4-8" : "ages 5-10";
  return (
    "ART STYLE — fixed for this book:\n" +
    `${world}\n` +
    "Watercolor over fine, slightly textured ink linework; gentle washes, soft " +
    `gradients, visible paper grain. ${palette} Saturation always restrained — ` +
    "never neon, never glossy, never plastic.\n" +
    "Lighting: soft natural light, warm and diffuse, gentle watercolor shadows, " +
    "no harsh contrast, no dramatic chiaroscuro. A serene, lived-in feeling.\n" +
    "PAGE COMPOSITION: keep the upper ~28% of the frame quiet and low-detail " +
    "(open sky, mist, soft wash, plain wall) — this band hosts the page text. " +
    "Faces and key action live in the lower two thirds.\n" +
    "NEGATIVE: NO 3D render, NO photorealistic detail, NO oil-painting heaviness, " +
    "NO anime, NO manga, NO chibi, NO disney/pixar cartoon, NO flat vector, " +
    "NO comic-book style, NO airbrush gloss, NO neon, NO dark gothic, NO horror. " +
    "NO text, NO lettering, NO signs or written words anywhere in the image " +
    "(added later by the book compositor). " +
    `A high-quality contemporary European picture book for ${ages}.`
  );
}
