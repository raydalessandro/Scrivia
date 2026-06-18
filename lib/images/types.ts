// lib/images/types.ts — tipi del modulo di generazione immagini (M5).
// Manus e GPT-Image sono intercambiabili a questo livello: stesso prompt strutturato +
// stesse reference confermate. Il provider "manual" è il flusso umano (genera in Manus,
// incolla); il provider "openai" genera via GPT-Image quando la chiave è attaccata.

export type ImageProviderId = "openai" | "manual";

export interface ImageRequest {
  prompt: string;        // prompt finale composto (blocchi blindati di B2)
  references: string[];  // reference canoniche confermate da allegare (cap 5 — note Manus)
  format: "2:3";
  size: "1024x1536";     // 2:3 di GPT-Image; l'upscale a 1536×2304 per la stampa è layer esterno
  quality?: "low" | "high";
}

export interface ImageResult {
  status: "generated" | "manual"; // manual = provider non collegato → l'umano incolla da Manus
  imageUrl?: string;              // presente quando generated
  provider: ImageProviderId;
  revisedPrompt?: string;
  costUsd?: number;
}

export interface ImageProviderAdapter {
  id: ImageProviderId;
  ready(): boolean;
  generate(req: ImageRequest): Promise<ImageResult>;
}
