import type { Story, PhaseId, LedgerEvent } from "@/lib/types";

export interface PhaseProps {
  story: Story;
  update: (mut: (s: Story) => Story) => void;
  log: (e: Omit<LedgerEvent, "ts">) => void;
  goPhase?: (p: PhaseId) => void;
}
