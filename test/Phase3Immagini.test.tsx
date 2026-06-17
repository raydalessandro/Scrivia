// @vitest-environment jsdom
//
// Phase3Immagini.test.tsx — §6.3 (smoke + interazione chiave).
//   (a) storia con node/pagePlan e senza entità → l'useEffect le ricava
//       (deriveEntities) e rigenera i page prompt (buildPagePrompts).
//   (b) confermando le reference (status→confermata), nei page prompt
//       compaiono le "reference da allegare" e sparisce il "manca reference".
// reference/pagePrompts/ui sono il sistema sotto test (NON mockati); si mocka
// solo Panel (da ../Workspace) per non tirarsi dietro l'intero Workspace.

import { describe, it, expect, afterEach } from "vitest";
import { vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import type { Story, Seed, EntityRefRecord } from "../lib/types";
import type { Hook } from "../lib/engineTypes";
import { buildNode, buildPagePlan } from "../lib/engine";
import { deriveEntities } from "../lib/reference";
import { buildPagePrompts } from "../lib/pagePrompts";

// Panel: stub leggero (evita di caricare il vero Workspace e i suoi figli).
vi.mock("../components/Workspace", () => ({
  Panel: ({ title, children, right }: any) => (
    <section>
      <h2>{title}</h2>
      {right}
      {children}
    </section>
  ),
}));

import { Phase3Immagini } from "../components/phases/Phase3Immagini";

afterEach(cleanup);

// --- dati: un nodo reale con protagonista + compagno + luogo ---------------
const SEED: Seed = {
  language: "it", title: "La radura",
  protagonist: { name: "Bruno", age: 6, kind: "tasso" },
  companions: [{ name: "Lea", kind: "uccello" }],
  world_flavor: "animali_del_bosco",
  setting: { primary: "la radura", notes: "" },
  theme: "scoperta", pugno: "x", personal_detail: "y",
  length_pages: 12, packs: [],
  spine: { premise: "p", problem: "q", threshold_moment: "t", resolution_mode: "r", closure: "c" },
  voice: {}, nonce: 7,
};
const NODE = buildNode(SEED);
const HOOKS = buildPagePlan(NODE) as Hook[];

// Harness: tiene lo stato Story e fornisce un update reale (come Workspace, senza save).
function Harness({ initial }: { initial: Story }) {
  const [story, setStory] = useState(initial);
  const update = (mut: (s: Story) => Story) => setStory((s) => mut(structuredClone(s)));
  return <Phase3Immagini story={story} update={update} log={() => {}} goPhase={() => {}} />;
}

function baseStory(extra: Partial<Story>): Story {
  return {
    id: "x", createdAt: new Date().toISOString(), title: "La radura",
    stage: "manus", seed: SEED, node: NODE, pagePlan: HOOKS, ledger: [],
    ...extra,
  };
}

describe("§6.3 Phase3Immagini", () => {
  it("con node/pagePlan e senza entità: l'useEffect ricava le entità e i page prompt", () => {
    const { container } = render(<Harness initial={baseStory({ entities: undefined, manus: undefined })} />);
    // entità ricavate: protagonista, compagno, luogo
    expect(container.textContent).toContain("Bruno");
    expect(container.textContent).toContain("Lea");
    expect(container.textContent).toContain("la radura");
    // nessuna reference confermata → i page prompt segnalano la mancanza
    expect(container.textContent).toContain("manca reference");
  });

  it("confermando tutte le reference: nei page prompt compaiono le 'reference da allegare'", () => {
    // entità già con immagine ma in revisione (così appare il bottone Conferma),
    // e page prompt iniziali coerenti (missing, perché non ancora confermate).
    const seeded: EntityRefRecord[] = deriveEntities(NODE).map((e) => ({
      ...e, imageUrl: `img/${e.id}.png`, status: "in_revisione",
    }));
    const manus0 = buildPagePrompts(NODE, HOOKS, seeded);
    const { container } = render(<Harness initial={baseStory({ entities: seeded, manus: manus0 })} />);

    // stato iniziale: manca reference (in revisione = non confermata)
    expect(container.textContent).toContain("manca reference");

    // clicca tutti i "Conferma reference" (ad ogni click la lista si accorcia)
    let guard = 0;
    while (guard++ < 12) {
      const btn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Conferma reference"));
      if (!btn) break;
      fireEvent.click(btn);
    }

    // ora ogni entità è confermata → i page prompt allegano le reference
    expect(container.textContent).toContain("reference da allegare:");
    expect(container.textContent).not.toContain("manca reference");
  });
});
