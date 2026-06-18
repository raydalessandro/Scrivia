// lib/ai/tasks/seeding.ts — M2: il seeding conversazionale reale.
// L'IA, con i comandi del registry come STRUMENTI (toMcpTools), raccoglie il seed
// parlando con la persona e poi "clicca" (build_node). Lo stato vive nel grafo: ogni
// turno l'IA riceve lo stato corrente del seed nel system-prompt, quindi non serve un
// round-trip di tool-result. Porta il protocollo di SKILL_seeding, adattato al contesto
// a-tool. Lo scheletro (i tre movimenti) resta INVISIBILE: non si nomina mai.

import type { Story } from "@/lib/types";
import type { AIMessage, CompletionRequest, StreamEvent } from "../types";
import { toMcpTools, executeCommand, validateSeed } from "@/lib/commands";

export const SEEDING_SYSTEM = `Sei l'assistente della prima fase: tu e la persona parlate, e tu ne ricavi un "seme" completo per il motore, usando gli STRUMENTI (i comandi) che hai a disposizione. Non è una chiacchierata libera: è un processo a passi con due cancelli (conferma + validazione). Filosofia: chiedi poco, deduci, conferma, poi "clicca".

Passi (in ordine):
0. Scarico. Invita la persona a buttar fuori cos'ha in mente ("a chi è la storia, e cosa succede"). Ascolta, non interrogare.
1. Raccogli il minimo e FISSALO con gli strumenti man mano: protagonista (set_protagonist: nome + età + eventuale specie/tipo), mondo in una parola (set_world), il "pugno" — cosa succede o cosa sente (set_pugno), e se emerge un dettaglio vero del bambino (set_personal_detail). La lunghezza solo se la dicono (default 12, set_length). Se la persona dice tutto in una frase, NON fare altre domande: deduci e fissa.
2. Mappa il tema con set_theme. Il tema corrisponde a un movimento INTERNO che non nomini MAI: paura/scoperta/curiosità/differenza ·· amicizia/aiuto/gentilezza/appartenenza ·· perdita/crescere/cambiamento/passaggio. Se la persona esprime un gusto di voce ("falla ridere", "dolce e lento"), traducilo in 2-3 assi con set_voice_axis.
3. Scrivi la spina con set_spine, un campo alla volta: premise (la scena d'avvio), problem (la difficoltà, con dentro voglia+paura), threshold_moment (l'attraversamento: una DECISIONE o un GESTO, non una presa di coscienza raccontata), resolution_mode (come si MUOVE, mai "si risolve" o lieto-fine spiegato).
4. CANCELLO 1 — Ricapitola in chiaro e breve cosa hai capito (nome, età, mondo, pugno, e in due righe la storia) e CHIEDI conferma prima di costruire. Aspetta l'ok o la correzione: è qui che si prendono i fraintendimenti che nessuno script vede.
5. Quando la persona conferma e il seme è completo, COSTRUISCI con build_node ("il click").

Regole. Parla italiano, caldo e breve. Usa gli strumenti per fissare i campi — non chiedere alla persona di compilare moduli. Lo scheletro narrativo (i tre movimenti) è interno: non lo nomini MAI, né nei tuoi messaggi né nella storia. Non tirare mai una morale.`;

/** Stato corrente del seme, compatto, da iniettare nel system ad ogni turno. */
export function seedStateSummary(story: Story): string {
  const s = story.seed;
  const comp = (s.companions ?? []).map((c) => c.name).filter(Boolean).join(", ");
  const sp = s.spine ?? { premise: "", problem: "", threshold_moment: "", resolution_mode: "", closure: "" };
  const lines = [
    `- protagonista: ${s.protagonist?.name || "—"}${s.protagonist?.age ? `, ${s.protagonist.age} anni` : ""}${s.protagonist?.kind ? ` (${s.protagonist.kind})` : ""}`,
    `- compagni: ${comp || "—"}`,
    `- mondo: ${s.world_flavor || "—"} · luogo: ${s.setting?.primary || "—"}`,
    `- tema: ${s.theme || "—"} · pugno: ${s.pugno || "—"}`,
    `- dettaglio personale: ${s.personal_detail || "—"}`,
    `- spina → premise: ${sp.premise || "—"} · problem: ${sp.problem || "—"} · soglia: ${sp.threshold_moment || "—"} · risoluzione: ${sp.resolution_mode || "—"}`,
    `- pagine: ${s.length_pages ?? 12}`,
  ];
  const v = validateSeed(s);
  const status = v.errors.length ? `manca: ${v.errors.join("; ")}` : "completo — si può costruire (build_node)";
  return `STATO ATTUALE DEL SEME (${status}):\n${lines.join("\n")}`;
}

/** Conversazione (seedingChat) → messaggi del layer, + il nuovo turno utente. */
export function chatToMessages(story: Story, userText: string): AIMessage[] {
  const msgs: AIMessage[] = (story.seedingChat ?? []).map((m) => ({
    role: (m.who === "you" ? "user" : "assistant") as AIMessage["role"],
    content: m.text,
  }));
  msgs.push({ role: "user", content: userText });
  return msgs;
}

/** Costruisce la richiesta al layer AI (puro: niente rete, testabile). */
export function buildSeedingRequest(story: Story, userText: string): CompletionRequest {
  return {
    system: `${SEEDING_SYSTEM}\n\n${seedStateSummary(story)}`,
    messages: chatToMessages(story, userText),
    tools: toMcpTools(),
    toolChoice: "auto",
    task: "seeding",
  };
}

/**
 * Applica gli eventi di un turno: esegue i tool-call (comandi) sulla storia e
 * accumula il testo della risposta. Niente rete qui → testabile direttamente.
 * Se l'IA non ha prodotto testo ma ha eseguito comandi, sintetizza una conferma.
 */
export function applySeedingTurn(
  story: Story,
  events: StreamEvent[]
): { story: Story; replyText: string; applied: string[]; commandNames: string[] } {
  let cur = story;
  let text = "";
  const applied: string[] = [];
  const commandNames: string[] = [];
  for (const ev of events) {
    if (ev.type === "text") text += ev.delta;
    else if (ev.type === "tool_call") {
      const r = executeCommand(cur, ev.call.name, ev.call.arguments, "claude");
      cur = r.story;
      applied.push(r.run.summary);
      commandNames.push(ev.call.name);
    }
  }
  let replyText = text.trim();
  if (!replyText) {
    replyText = applied.length
      ? `Fatto: ${applied.join(" · ")}.`
      : "Ti seguo — dimmi protagonista, mondo, e il cuore della storia.";
  }
  return { story: cur, replyText, applied, commandNames };
}
