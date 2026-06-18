// lib/images/providers/openai.ts — adapter GPT-Image. La fetch reale è DIETRO ready():
// senza OPENAI_API_KEY non parte (si resta manuali). Forma da openai_image_gen.py (Isola)
// + note Manus: prompt + reference visive, 2:3, quality high.
import type { ImageProviderAdapter, ImageRequest, ImageResult } from "../types";

declare const process: { env: Record<string, string | undefined> };

const ENDPOINT = "https://api.openai.com/v1/images/edits"; // multi-reference: image[] + prompt
const MODEL = "gpt-image-1";

export const openaiImageProvider: ImageProviderAdapter = {
  id: "openai",
  ready: () => !!process.env?.OPENAI_API_KEY,
  async generate(req: ImageRequest): Promise<ImageResult> {
    const key = process.env?.OPENAI_API_KEY;
    if (!key) return { status: "manual", provider: "manual" }; // non collegato → manuale
    // NOTA: forma definitiva (multipart, le reference come image[]) da confermare all'attacco
    // della chiave; la struttura segue le note Manus.
    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", req.prompt);
    form.append("size", req.size);
    form.append("quality", req.quality ?? "high");
    for (const ref of req.references) {
      const blob = await (await fetch(ref)).blob();
      form.append("image[]", blob);
    }
    const res = await fetch(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!res.ok) throw new Error(`OpenAI image ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const first = data?.data?.[0] ?? {};
    const imageUrl = first.b64_json ? `data:image/png;base64,${first.b64_json}` : first.url;
    return { status: "generated", provider: "openai", imageUrl, revisedPrompt: first.revised_prompt };
  },
};
