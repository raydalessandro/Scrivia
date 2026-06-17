// Punto d'ingresso del layer AI.
//
// SICURO LATO CLIENT (solo dati/tipi): types, registry, config — per i selettori
// di provider/modello/reasoning in UI.
// SOLO SERVER (usa chiavi + fetch): client.ts (aiComplete/aiStream) e gli adapter.
//   Importali direttamente da "@/lib/ai/client" dentro route handler / server code,
//   per non trascinare la logica server nel bundle client.

export * from "./types";
export * from "./registry";
export * from "./config";
