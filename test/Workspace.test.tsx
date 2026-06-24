// @vitest-environment jsdom
//
// Workspace.test.tsx — §6.1 (smoke) + §5.3 (phaseReached: gating delle tab).
// Workspace tira dentro un grafo di import pesante (le 4 fasi, lo SeedingGame,
// il layer AI): qui i figli sono STUB, così resta un test di montaggio +
// gating + cambio fase. La logica vera testata è quella di Workspace stesso
// (deriveStages/STAGE_TO_PHASE reali, phaseReached interno) e il wiring delle tab.

import { describe, it, expect, afterEach } from "vitest";
import { vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import type { Story, Seed, StageId, PagePlan, ProsePage } from "../lib/types";

// loadStory restituisce la storia preparata dal test (holder hoisted).
// Ora lo store è async (backing Supabase): il mock ritorna una Promise.
const store = vi.hoisted(() => ({ story: null as Story | null }));
vi.mock("@/lib/store", () => ({ loadStory: () => Promise.resolve(store.story), saveStory: () => Promise.resolve() }));

// next/link → semplice <a> (niente router context).
vi.mock("next/link", () => ({ default: ({ href, children }: any) => <a href={typeof href === "string" ? href : "#"}>{children}</a> }));

// Figli pesanti → stub identificabili.
vi.mock("../components/Stem", () => ({ Stem: () => <div data-testid="stem" /> }));
vi.mock("../components/ai/PhaseModelChip", () => ({ PhaseModelChip: () => <div data-testid="chip" /> }));
vi.mock("../components/Ledger", () => ({ Ledger: () => <div data-testid="ledger" /> }));
vi.mock("../components/phases/Phase1Seeding", () => ({ Phase1Seeding: () => <div data-testid="phase-seeding" /> }));
vi.mock("../components/phases/Phase2Prosa", () => ({ Phase2Prosa: () => <div data-testid="phase-prosa" /> }));
vi.mock("../components/phases/Phase3Immagini", () => ({ Phase3Immagini: () => <div data-testid="phase-immagini" /> }));
vi.mock("../components/phases/Phase4Libro", () => ({ Phase4Libro: () => <div data-testid="phase-libro" /> }));

// importato DOPO i mock (vi.mock è comunque hoisted).
import { Workspace } from "../components/Workspace";

afterEach(cleanup);

// --- builder di storie minime -----------------------------------------------
function fullSeed(name = ""): Seed {
  return {
    language: "it", title: "T",
    protagonist: { name, age: 6, kind: "tasso" },
    companions: [], world_flavor: "animali_del_bosco",
    setting: { primary: "la radura", notes: "" },
    theme: "scoperta", pugno: "x", personal_detail: "y",
    length_pages: 12, packs: [],
    spine: { premise: "p", problem: "q", threshold_moment: "t", resolution_mode: "r", closure: "c" },
    voice: {}, nonce: 7,
  };
}
const A_PLAN: PagePlan[] = [{ page: 1, beat: "apertura", hook: "h", zone: "z", note: "" }];
const A_PROSE: ProsePage[] = [{ page: 1, beat: "apertura", text: "c'era una volta" }];

function mkStory(o: { stage?: StageId; name?: string; pagePlan?: boolean; prose?: boolean }): Story {
  return {
    id: "x", createdAt: new Date().toISOString(), title: "La radura",
    stage: o.stage ?? "seed", seed: fullSeed(o.name ?? ""),
    pagePlan: o.pagePlan ? A_PLAN : undefined,
    prose: o.prose ? A_PROSE : undefined,
    ledger: [],
  };
}

// le 4 tab in ordine: seeding, prosa, immagini, libro
function tabs(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelector("nav")!.querySelectorAll("button"));
}

// loadStory è async: dopo il render attendiamo che lo stelo compaia (la storia
// è caricata) prima di asserire su tab e pannelli.
describe("§6.1 Workspace: montaggio, stelo + tab, cambio fase raggiungibile", () => {
  it("monta la storia: mostra lo stelo e le 4 tab, apre sulla fase seeding", async () => {
    store.story = mkStory({ stage: "hook", name: "Bruno", pagePlan: true });
    const { container, findByTestId, getByTestId } = render(<Workspace id="x" />);

    // stelo presente (atteso: il caricamento è async)
    expect(await findByTestId("stem")).toBeTruthy();
    // 4 passi nello stepper. Il redesign mostra i numeri (1·2·3·4); il nome della
    // fase attiva è nell'intestazione, non ripetuto su ogni tab.
    expect(tabs(container).length).toBe(4);
    expect(container.textContent).toContain("Progetta la storia");
    // senza prosa si apre su seeding
    expect(getByTestId("phase-seeding")).toBeTruthy();
  });

  it("cambio fase: cliccare una tab raggiungibile cambia il pannello attivo", async () => {
    store.story = mkStory({ stage: "hook", name: "Bruno", pagePlan: true });
    const { container, findByTestId, getByTestId, queryByTestId } = render(<Workspace id="x" />);
    expect(await findByTestId("phase-seeding")).toBeTruthy();

    // 'Scrivi la prosa' è raggiungibile (c'è il pagePlan) → click → pannello prosa
    fireEvent.click(tabs(container)[1]);
    expect(getByTestId("phase-prosa")).toBeTruthy();
    expect(queryByTestId("phase-seeding")).toBeNull();
  });
});

describe("§5.3 phaseReached: gating delle tab per artefatto", () => {
  // contratto: seeding sempre; prosa↔pagePlan; immagini↔prose; libro↔prose.

  it("storia fresca: solo 'Progetta la storia' è abilitata", async () => {
    store.story = mkStory({ stage: "seed", name: "" });
    const { container, findByTestId } = render(<Workspace id="x" />);
    await findByTestId("stem");
    const [seeding, prosa, immagini, libro] = tabs(container);
    expect(seeding.disabled).toBe(false);
    expect(prosa.disabled).toBe(true);
    expect(immagini.disabled).toBe(true);
    expect(libro.disabled).toBe(true);
  });

  it("con pagePlan: si abilita anche 'Scrivi la prosa' (non ancora illustrazioni/libro)", async () => {
    store.story = mkStory({ stage: "hook", name: "Bruno", pagePlan: true });
    const { container, findByTestId } = render(<Workspace id="x" />);
    await findByTestId("stem");
    const [seeding, prosa, immagini, libro] = tabs(container);
    expect(seeding.disabled).toBe(false);
    expect(prosa.disabled).toBe(false);
    expect(immagini.disabled).toBe(true);
    expect(libro.disabled).toBe(true);
  });

  it("con prosa: tutte e quattro le tab sono raggiungibili", async () => {
    store.story = mkStory({ stage: "prosa", name: "Bruno", pagePlan: true, prose: true });
    const { container, findByTestId } = render(<Workspace id="x" />);
    await findByTestId("stem");
    for (const b of tabs(container)) expect(b.disabled).toBe(false);
  });
});
