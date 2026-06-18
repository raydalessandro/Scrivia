// app/api/images/route.ts — aggancio generazione immagini (speculare a /api/ai).
// GET → stato provider. POST → genera (o stato "manual" se non collegato).
import { generateImage, imageProviderStatus } from "@/lib/images";
import type { ImageRequest } from "@/lib/images";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ providers: imageProviderStatus() });
}

export async function POST(req: Request) {
  let body: ImageRequest;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  try {
    const result = await generateImage(body);
    if (result.status === "manual") {
      return Response.json({
        status: "manual",
        message: "Generazione automatica non collegata: genera in Manus e incolla l'immagine. Prompt e reference sono pronti.",
      });
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
