// lib/images/providers/manual.ts — provider "manuale": nessuna chiamata di rete.
// È il flusso attuale: l'umano genera in Manus col prompt+reference già pronti e incolla.
import type { ImageProviderAdapter, ImageRequest, ImageResult } from "../types";

export const manualProvider: ImageProviderAdapter = {
  id: "manual",
  ready: () => true,
  async generate(_req: ImageRequest): Promise<ImageResult> {
    return { status: "manual", provider: "manual" };
  },
};
