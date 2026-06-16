// SEAM — qui si aggancia l'API di Claude (svincolo da Claude Code).
//
// I tre punti LLM del seme passano da qui, lato server:
//   • seeding  → tool-use per riempire lo schema seed.template.yaml
//   • prosa    → streaming pagina per pagina dal writing_brief (SKILL_prosa.md)
//   • critic   → sub-agente isolato che torna SOLO il verdetto JSON (SKILL_critic.md)
//
// Per ora è uno stub: la UI gira con dati d'esempio e flussi simulati, così il
// deploy su Vercel non richiede segreti. Quando colleghiamo davvero:
//   1. npm i @anthropic-ai/sdk
//   2. ANTHROPIC_API_KEY nelle env di Vercel
//   3. modello di default: claude-opus-4-8 (prosa/critic), più economico per il seeding
//
// import Anthropic from "@anthropic-ai/sdk";
// const client = new Anthropic();

export async function POST(req: Request) {
  const { task } = await req.json().catch(() => ({ task: "unknown" }));
  return Response.json(
    {
      ok: false,
      task,
      note:
        "Stub: collega @anthropic-ai/sdk e ANTHROPIC_API_KEY. Vedi i commenti in app/api/claude/route.ts.",
    },
    { status: 501 }
  );
}
