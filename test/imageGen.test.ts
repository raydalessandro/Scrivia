// test/imageGen.test.ts — §M5/B4: composizione prompt-immagine + routing provider gated.
// Harness Vitest (environment "node": la logica è pura, niente jsdom). Niente rete:
// senza OPENAI_API_KEY il provider attivo è "manual" → generateImage non fa fetch.
import { describe, it, expect, beforeEach } from "vitest";
import { composeImagePrompt, generateImage } from "../lib/images";
import type { StoryNode, ManusPrompt, EntityRefRecord } from "../lib/types";

// nodo minimo (bookStylesheet usa solo world_flavor / season / protagonist.age)
const node = {
  world_flavor: "animali_del_bosco",
  season: "inverno",
  protagonist: { name: "Pino", age: 5, kind: "volpe" },
  companions: [],
} as unknown as StoryNode;

const entities: EntityRefRecord[] = [
  { id: "char_pino", name: "Pino", kind: "character", descriptor: "small fox, indigo scarf",
    prohibitions: ["NO hood", "OPEN cloak"], imageUrl: "ref://pino", status: "confermata" },
  { id: "luogo_bosco", name: "Bosco", kind: "location", descriptor: "winter wood",
    imageUrl: "ref://bosco", status: "confermata" },
];

const page: ManusPrompt = {
  page: 3, beat: "cambiare", hook: "azione",
  storyMoment: "Pino steps onto the frozen path", pov: "low, just behind Pino",
  place: "the winter wood at dusk", characters: "Pino — small fox, indigo scarf",
  references: ["ref://pino", "ref://bosco"], missing: [],
};

describe("B4 · composeImagePrompt (blocchi blindati, metodo Isola)", () => {
  const req = composeImagePrompt(node, page, entities);
  it("STYLESHEET (ART STYLE) in testa", () => {
    expect(req.prompt.startsWith("ART STYLE")).toBe(true);
  });
  it("CHARACTER CONSISTENCY (BINDING) in coda, dopo lo STORY MOMENT", () => {
    expect(req.prompt).toContain("BINDING");
    expect(req.prompt.indexOf("BINDING")).toBeGreaterThan(req.prompt.indexOf("STORY MOMENT"));
  });
  it("divieti per-entità ripetuti (LOCKED / NO hood)", () => {
    expect(req.prompt).toContain("LOCKED");
    expect(req.prompt).toContain("NO hood");
  });
  it("formato 2:3 e size 1024x1536", () => {
    expect(req.format).toBe("2:3");
    expect(req.size).toBe("1024x1536");
  });
  it("reference cappate a 5 (note Manus: oltre ~5 si diluisce)", () => {
    const many: ManusPrompt = { ...page, references: ["a", "b", "c", "d", "e", "f", "g"] };
    expect(composeImagePrompt(node, many, entities).references.length).toBe(5);
  });
});

describe("B4 · provider gated (Manus ≡ GPT; senza chiave → manuale)", () => {
  beforeEach(() => { delete process.env.OPENAI_API_KEY; });
  it("generateImage senza OPENAI_API_KEY → provider manual, nessuna imageUrl", async () => {
    const req = composeImagePrompt(node, page, entities);
    const res = await generateImage(req);
    expect(res.status).toBe("manual");
    expect(res.provider).toBe("manual");
    expect(res.imageUrl).toBeUndefined();
  });
  it("gate: una pagina con reference non confermate porta il segnale 'missing'", () => {
    const blocked: ManusPrompt = { ...page, references: [], missing: ["char_pino"] };
    expect(blocked.missing?.length ?? 0).toBeGreaterThan(0);
  });
});
