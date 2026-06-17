// Route d'esempio del layer AI — il punto d'aggancio "apparecchiato".
// Non è collegata alle fasi: serve a provare il layer e a mostrare come ogni
// modulo lo chiamerà. Senza chiavi nell'ambiente risponde 501 in chiaro.
//
// GET  → registry (provider/modelli/reasoning), defaults per-fase, stato chiavi.
// POST → esegue una completion (o uno stream con ?stream=1) via la facciata.

import { PROVIDERS } from "@/lib/ai/registry";
import { DEFAULT_SELECTION } from "@/lib/ai/config";
import { aiComplete, aiStream, configuredProviders, AIKeyMissingError } from "@/lib/ai/client";
import type { CompletionRequest } from "@/lib/ai/types";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    providers: PROVIDERS.map((p) => ({
      id: p.id, label: p.label, apiKeyEnv: p.apiKeyEnv,
      models: p.models.map((m) => ({ id: m.id, label: m.label, reasoning: m.reasoning, note: m.note })),
    })),
    defaults: DEFAULT_SELECTION,
    configured: configuredProviders(),
  });
}

export async function POST(req: Request) {
  let body: CompletionRequest & { stream?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }
  if (!body?.messages?.length) {
    return Response.json({ error: "messages mancanti" }, { status: 400 });
  }

  try {
    if (body.stream) {
      const events = aiStream(body);
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          try {
            for await (const ev of events) {
              controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
            }
          } catch (e) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", error: String(e) })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
      });
    }
    const result = await aiComplete(body);
    return Response.json(result);
  } catch (e) {
    if (e instanceof AIKeyMissingError) {
      return Response.json({ error: e.message, env: e.env, provider: e.provider }, { status: 501 });
    }
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
