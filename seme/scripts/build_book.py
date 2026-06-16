#!/usr/bin/env python3
"""
build_book.py — Monta il LIBRO: prosa (story.md) + immagini -> HTML A5 stampabile.

Meccanico: nessun LLM. Spezza la prosa sui marker @hook, accoppia ogni pagina
alla sua immagine in `immagini/pNN.(png|jpg|webp)`. Se l'immagine manca, mette
un placeholder (cosi' il libro si vede subito, e le immagini Manus si calano
dopo senza ritoccare nulla). L'HTML ha @page A5 -> stampa/PDF dal browser.

Uso:
    python3 build_book.py <story.md> [--node node.json] [--images DIR] [--out libro.html]
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from pathlib import Path

HOOK_RE = re.compile(r"<!--\s*@hook\s+p(\d{2})\s*\|\s*@page\s+(\d+)\s*-->")
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")

PALETTE = {  # sfondo morbido per stagione (coerente col nodo)
    "inverno": "#eef3f7", "primavera": "#f0f5ec",
    "estate": "#fbf4e6", "autunno": "#f6efe8",
}


def split_pages(md: str):
    pages, cur = [], None
    for line in md.splitlines():
        m = HOOK_RE.search(line)
        if m:
            if cur:
                pages.append(cur)
            cur = {"page": int(m.group(2)), "text": []}
        elif cur is not None and line.strip() and not line.strip().startswith("<!--"):
            cur["text"].append(line.strip())
    if cur:
        pages.append(cur)
    for p in pages:
        p["text"] = " ".join(p["text"])
    return pages


def find_image(images_dir: Path, page: int):
    for ext in IMG_EXT:
        cand = images_dir / f"p{page:02d}{ext}"
        if cand.exists():
            data = base64.b64encode(cand.read_bytes()).decode()
            mime = "image/jpeg" if ext in (".jpg", ".jpeg") else f"image/{ext[1:]}"
            return f"data:{mime};base64,{data}"
    return None


def render(pages, node, images_dir: Path) -> str:
    title = node.get("title", "Storia") if node else "Storia"
    author = (node or {}).get("author", "")
    season = (node or {}).get("season", "primavera")
    bg = PALETTE.get(season, "#f4f1ea")

    css = f"""
    @page {{ size: 148mm 210mm; margin: 0; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: 'Iowan Old Style', Georgia, 'Times New Roman', serif;
            color: #2b2b2b; background: #d9d4cb; }}
    .page {{ width: 148mm; height: 210mm; padding: 14mm 14mm 16mm; background: {bg};
             display: flex; flex-direction: column; page-break-after: always;
             position: relative; overflow: hidden; }}
    .imgwrap {{ flex: 1 1 58%; display: flex; align-items: center; justify-content: center;
                margin-bottom: 8mm; }}
    .imgwrap img {{ max-width: 100%; max-height: 100%; border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,.10); }}
    .ph {{ width: 100%; height: 100%; border: 1.5px dashed #b9b2a4; border-radius: 6px;
           display: flex; align-items: center; justify-content: center; text-align: center;
           color: #9a9384; font-size: 10pt; padding: 10mm; line-height: 1.5; }}
    .text {{ flex: 0 0 auto; font-size: 13.5pt; line-height: 1.62; }}
    .text em {{ font-style: italic; letter-spacing: .3px; }}
    .pageno {{ position: absolute; bottom: 7mm; left: 0; right: 0; text-align: center;
               font-size: 9pt; color: #a8a193; }}
    .cover {{ justify-content: center; align-items: center; text-align: center; }}
    .cover h1 {{ font-size: 26pt; line-height: 1.2; margin: 0 0 6mm; font-weight: 600; }}
    .cover .by {{ font-size: 12pt; color: #6b6457; }}
    .cover .mark {{ margin-top: 14mm; font-size: 9pt; letter-spacing: 2px; color: #b3ac9e; }}
    """

    out = [f"<!doctype html><html lang='it'><head><meta charset='utf-8'>",
           f"<title>{title}</title><style>{css}</style></head><body>"]
    # copertina
    out.append(f"<div class='page cover'><div><h1>{title}</h1>")
    if author:
        out.append(f"<div class='by'>{author}</div>")
    out.append("<div class='mark'>· seme ·</div></div></div>")

    for p in pages:
        img = find_image(images_dir, p["page"])
        out.append("<div class='page'>")
        out.append("<div class='imgwrap'>")
        if img:
            out.append(f"<img src='{img}' alt='pagina {p['page']}'>")
        else:
            out.append(f"<div class='ph'>illustrazione pagina {p['page']}<br>"
                       f"<small>(immagini/p{p['page']:02d}.png da Manus)</small></div>")
        out.append("</div>")
        out.append(f"<div class='text'>{p['text']}</div>")
        out.append(f"<div class='pageno'>{p['page']}</div>")
        out.append("</div>")
    out.append("</body></html>")
    return "".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("story")
    ap.add_argument("--node", default=None)
    ap.add_argument("--images", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    story_path = Path(args.story)
    md = story_path.read_text(encoding="utf-8")
    pages = split_pages(md)
    node = json.loads(Path(args.node).read_text(encoding="utf-8")) if args.node else {}
    images_dir = Path(args.images) if args.images else story_path.parent / "immagini"
    images_dir.mkdir(exist_ok=True)

    html = render(pages, node, images_dir)
    out = Path(args.out) if args.out else story_path.with_name("libro.html")
    out.write_text(html, encoding="utf-8")
    n_img = sum(1 for p in pages if find_image(images_dir, p["page"]))
    print(f"libro OK -> {out}  ({len(pages)} pagine, {n_img} immagini, "
          f"{len(pages)-n_img} placeholder)")
    print("  stampa/PDF: apri nel browser -> Stampa -> Salva come PDF (formato A5).")


if __name__ == "__main__":
    main()
