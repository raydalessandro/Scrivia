// test/book.test.ts — §B9: montaggio del libro (port di build_book.py).
import { describe, it, expect } from "vitest";
import type { Story, StoryNode, ProsePage, ManusPrompt } from "../lib/types";
import { assembleBook, renderBookHtml } from "../lib/book";

const P = (page: number, text: string): ProsePage => ({ page, beat: "b", text });
const M = (page: number, imageUrl?: string): ManusPrompt =>
  ({ page, hook: "", beat: "", storyMoment: "", pov: "", place: "", characters: "", imageUrl } as ManusPrompt);

function story(over: Partial<Story> = {}): Story {
  const node = { title: "La radura", season: "inverno", pages: 3 } as unknown as StoryNode;
  return {
    id: "x", createdAt: "", title: "La radura", stage: "book",
    seed: { title: "La radura" }, node,
    prose: [P(1, "Bruno uscì."), P(2, "Saltò il fosso."), P(3, "Tornò a casa.")],
    manus: [M(2, "blob:img2")],
    ledger: [],
    ...over,
  } as unknown as Story;
}

describe("B9 · assembleBook", () => {
  it("accoppia ogni pagina alla sua immagine (o nessuna)", () => {
    const b = assembleBook(story());
    expect(b.pages.find((p) => p.page === 2)?.imageUrl).toBe("blob:img2");
    expect(b.pages.find((p) => p.page === 1)?.imageUrl).toBeUndefined();
  });

  it("ordina le pagine e ne conta quante la prosa", () => {
    const b = assembleBook(story({ prose: [P(3, "c"), P(1, "a"), P(2, "b")] }));
    expect(b.pages.map((p) => p.page)).toEqual([1, 2, 3]);
  });

  it("copertina: titolo dal nodo, stagione dal nodo", () => {
    const b = assembleBook(story());
    expect(b.title).toBe("La radura");
    expect(b.season).toBe("inverno");
  });

  it("titolo di ripiego se manca il nodo", () => {
    expect(assembleBook(story({ node: undefined, title: "", seed: {} as Story["seed"] })).title).toBe("Storia");
    expect(assembleBook(story({ node: undefined })).season).toBe("primavera");
  });
});

describe("B9 · renderBookHtml", () => {
  const html = renderBookHtml(story());

  it("documento A5 stampabile (@page 148×210mm)", () => {
    expect(html).toContain("@page");
    expect(html).toContain("148mm");
    expect(html).toContain("210mm");
  });

  it("copertina col titolo e una pagina per ogni pagina di prosa", () => {
    expect(html).toContain("<h1>La radura</h1>");
    expect(html).toContain("Bruno uscì.");
    expect(html).toContain("Saltò il fosso.");
  });

  it("immagine presente → <img>; assente → placeholder", () => {
    expect(html).toContain("src='blob:img2'");
    expect(html).toContain("illustrazione pagina 1"); // p1 senza immagine
  });

  it("palette per stagione (inverno → sfondo dedicato)", () => {
    expect(html).toContain("#eef3f7");
  });

  it("il testo è HTML-escaped (niente injection)", () => {
    const h = renderBookHtml(story({ prose: [P(1, "5 < 7 & \"vero\"")] }));
    expect(h).toContain("5 &lt; 7 &amp; &quot;vero&quot;");
    expect(h).not.toContain("5 < 7 & \"vero\"");
  });

  it("nessun riferimento allo scheletro (EAR) nell'output", () => {
    expect(html).not.toMatch(/\bEAR\b/);
  });
});
