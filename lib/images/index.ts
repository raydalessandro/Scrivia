// lib/images/index.ts — facciata generazione immagini. Sceglie il provider: openai se la
// chiave c'è, altrimenti manual. Stesso punto d'ingresso per entrambe le strade.
import type { ImageProviderAdapter, ImageRequest, ImageResult, ImageProviderId } from "./types";
import { openaiImageProvider } from "./providers/openai";
import { manualProvider } from "./providers/manual";

const PROVIDERS: ImageProviderAdapter[] = [openaiImageProvider, manualProvider];

export function activeImageProvider(): ImageProviderAdapter {
  return PROVIDERS.find((p) => p.id === "openai" && p.ready()) ?? manualProvider;
}
export async function generateImage(req: ImageRequest): Promise<ImageResult> {
  return activeImageProvider().generate(req);
}
export function imageProviderStatus(): { id: ImageProviderId; ready: boolean }[] {
  return PROVIDERS.map((p) => ({ id: p.id, ready: p.ready() }));
}
export { composeImagePrompt } from "./composePrompt";
export type { ImageRequest, ImageResult, ImageProviderId, ImageProviderAdapter } from "./types";
