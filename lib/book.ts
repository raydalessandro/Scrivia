// lib/book.ts — Monta il LIBRO (port di build_book.py). Meccanico, nessun LLM:
// accoppia ogni pagina di prosa alla sua immagine (o un placeholder), e rende un
// documento HTML A5 stampabile (@page 148×210mm → Stampa/PDF dal browser). In Scrivia
// la prosa è già strutturata (ProsePage[]) e le immagini stanno in story.manus[].imageUrl:
// niente marker da parsare. Se un'immagine manca, placeholder → il libro si vede subito e
// le immagini si calano dopo senza ritoccare nulla.

import type { Story } from "./types";

export interface BookPage {
  page: number;
  text: string;
  imageUrl?: string;
}
export interface Book {
  title: string;
  author: string;
  season: string;
  pages: BookPage[];
}

// Sfondo morbido per stagione (coerente col nodo), come in build_book.py.
const PALETTE: Record<string, string> = {
  inverno: "#eef3f7",
  primavera: "#f0f5ec",
  estate: "#fbf4e6",
  autunno: "#f6efe8",
};
const DEFAULT_BG = "#f4f1ea";

/** Accoppia prosa + immagini in una struttura-libro (puro, testabile). */
export function assembleBook(story: Story): Book {
  const title = story.node?.title || story.title || story.seed?.title || "Storia";
  const author = ""; // campo futuro (né seed né nodo lo portano oggi): copertina con solo titolo
  const season = story.node?.season || "primavera";
  const imgFor = (p: number) => story.manus?.find((m) => m.page === p)?.imageUrl;
  const pages: BookPage[] = (story.prose ?? [])
    .slice()
    .sort((a, b) => a.page - b.page)
    .map((p) => ({ page: p.page, text: p.text, imageUrl: imgFor(p.page) }));
  return { title, author, season, pages };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bookCss(bg: string): string {
  return `
    @page { size: 148mm 210mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Iowan Old Style', Georgia, 'Times New Roman', serif;
           color: #2b2b2b; background: #d9d4cb; }
    .page { width: 148mm; height: 210mm; padding: 14mm 14mm 16mm; background: ${bg};
            display: flex; flex-direction: column; page-break-after: always;
            position: relative; overflow: hidden; }
    .imgwrap { flex: 1 1 58%; display: flex; align-items: center; justify-content: center;
               margin-bottom: 8mm; }
    .imgwrap img { max-width: 100%; max-height: 100%; border-radius: 4px;
                   box-shadow: 0 2px 10px rgba(0,0,0,.10); }
    .ph { width: 100%; height: 100%; border: 1.5px dashed #b9b2a4; border-radius: 6px;
          display: flex; align-items: center; justify-content: center; text-align: center;
          color: #9a9384; font-size: 10pt; padding: 10mm; line-height: 1.5; }
    .text { flex: 0 0 auto; font-size: 13.5pt; line-height: 1.62; }
    .text em { font-style: italic; letter-spacing: .3px; }
    .pageno { position: absolute; bottom: 7mm; left: 0; right: 0; text-align: center;
              font-size: 9pt; color: #a8a193; }
    .cover { justify-content: center; align-items: center; text-align: center; }
    .cover h1 { font-size: 26pt; line-height: 1.2; margin: 0 0 6mm; font-weight: 600; }
    .cover .by { font-size: 12pt; color: #6b6457; }
    .cover .mark { margin-top: 14mm; font-size: 9pt; letter-spacing: 2px; color: #b3ac9e; }`;
}

/** Documento HTML A5 stampabile (copertina + pagine). Specchio del render Python. */
export function renderBookHtml(story: Story): string {
  const book = assembleBook(story);
  const bg = PALETTE[book.season] ?? DEFAULT_BG;

  const cover =
    `<div class='page cover'><div><h1>${esc(book.title)}</h1>` +
    (book.author ? `<div class='by'>${esc(book.author)}</div>` : "") +
    `<div class='mark'>· seme ·</div></div></div>`;

  const pages = book.pages
    .map((p) => {
      const img = p.imageUrl
        ? `<img src='${p.imageUrl}' alt='pagina ${p.page}'>`
        : `<div class='ph'>illustrazione pagina ${p.page}<br><small>(immagine pagina ${p.page} da Manus)</small></div>`;
      return (
        `<div class='page'><div class='imgwrap'>${img}</div>` +
        `<div class='text'>${esc(p.text)}</div>` +
        `<div class='pageno'>${p.page}</div></div>`
      );
    })
    .join("");

  return (
    `<!doctype html><html lang='it'><head><meta charset='utf-8'>` +
    `<title>${esc(book.title)}</title><style>${bookCss(bg)}</style></head>` +
    `<body>${cover}${pages}</body></html>`
  );
}
