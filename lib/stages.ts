import type { Story, Stage, StageId, PhaseId } from "./types";

// L'ordine canonico delle tappe (lo "stelo"). Ogni tappa ha un attore e,
// per i due cancelli voluti, il flag gate.
const STAGE_DEFS: { id: StageId; label: string; actor: Stage["actor"]; gate?: boolean; phase: PhaseId }[] = [
  { id: "seed", label: "Seme", actor: "you", phase: "seeding" },
  { id: "node", label: "Grafo", actor: "det", phase: "seeding" },
  { id: "hook", label: "Piano pagine", actor: "det", phase: "seeding" },
  { id: "brief", label: "Brief", actor: "det", phase: "seeding" },
  { id: "manus", label: "Prompt immagini", actor: "det", phase: "seeding" },
  { id: "prosa", label: "Prosa", actor: "claude", gate: true, phase: "prosa" },
  { id: "audit", label: "Audit (critic)", actor: "claude", phase: "prosa" },
  { id: "book", label: "Libro", actor: "det", phase: "libro" },
];

const ORDER: StageId[] = STAGE_DEFS.map((s) => s.id);

export const STAGE_TO_PHASE: Record<StageId, PhaseId> = Object.fromEntries(
  STAGE_DEFS.map((s) => [s.id, s.phase])
) as Record<StageId, PhaseId>;

export const PHASES: { id: PhaseId; label: string; n: number }[] = [
  { id: "seeding", label: "Progetta la storia", n: 1 },
  { id: "prosa", label: "Scrivi la prosa", n: 2 },
  { id: "immagini", label: "Le illustrazioni", n: 3 },
  { id: "libro", label: "Monta il libro", n: 4 },
];

/** Stato di completamento per ogni artefatto. */
function hasArtifact(story: Story, id: StageId): boolean {
  switch (id) {
    case "seed": return !!story.seed.protagonist.name;
    case "node": return !!story.node;
    case "hook": return !!story.pagePlan;
    case "brief": return !!story.brief || !!story.pagePlan;
    case "manus": return !!story.manus;
    case "prosa": return !!story.prose;
    case "audit": return !!story.critic;
    case "book": return story.stage === "book";
  }
}

export function deriveStages(story: Story): Stage[] {
  const doneUpTo = ORDER.indexOf(story.stage);
  return STAGE_DEFS.map((def, i) => {
    const done = hasArtifact(story, def.id) && i <= Math.max(doneUpTo, lastDoneIndex(story));
    let state: Stage["state"];
    if (done) state = "done";
    else if (def.gate) state = i === firstUndone(story) ? "gate" : "locked";
    else state = i === firstUndone(story) ? "ready" : "locked";
    return { id: def.id, label: def.label, actor: def.actor, gate: def.gate, state };
  });
}

function lastDoneIndex(story: Story): number {
  let last = -1;
  STAGE_DEFS.forEach((d, i) => {
    if (hasArtifact(story, d.id)) last = i;
  });
  return last;
}
function firstUndone(story: Story): number {
  const idx = STAGE_DEFS.findIndex((d) => !hasArtifact(story, d.id));
  return idx === -1 ? STAGE_DEFS.length : idx;
}

export function currentPhase(story: Story): PhaseId {
  if (!story.prose) return "seeding";
  if (!story.manus?.some((m) => m.imageUrl)) return "immagini";
  if (story.stage !== "book") return "libro";
  return "libro";
}
