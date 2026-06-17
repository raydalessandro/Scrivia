// @vitest-environment jsdom
//
// Phase1Seeding.test.tsx — §6.2 (smoke + interazioni chiave).
//   (a) in intake, "Inizia con l'IA" appende il messaggio d'apertura
//       (un ChatMsg di claude) e passa allo studio (esce dall'intake).
//   (b) un comando da campo (il select "Mondo" → set_world) muta la Story
//       passando dal registry reale dei comandi (lib/commands).
// Si mockano i figli pesanti (Workspace/Panel, SeedingGame, GraphView); il
// registry dei comandi è il sistema sotto test e NON è mockato.

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import type { Story, Seed } from "../lib/types";

// jsdom non implementa scrollIntoView: la chat di seeding lo chiama in un effect.
// È una lacuna dell'ambiente di test, non un difetto del componente.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

vi.mock("../components/Workspace", () => ({
  Panel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>,
}));
vi.mock("../components/phases/SeedingGame", () => ({ SeedingGame: () => <div data-testid="seeding-game" /> }));
vi.mock("../components/GraphView", () => ({ GraphView: () => <div data-testid="graph-view" /> }));

import { Phase1Seeding } from "../components/phases/Phase1Seeding";

afterEach(cleanup);

function mkSeed(over: Partial<Seed> = {}): Seed {
  return {
    language: "it", title: "La radura",
    protagonist: { name: "Bruno", age: 6, kind: "tasso" },
    companions: [], world_flavor: "",
    setting: { primary: "la radura", notes: "" },
    theme: "scoperta", pugno: "x", personal_detail: "y",
    length_pages: 12, packs: [],
    spine: { premise: "p", problem: "q", threshold_moment: "t", resolution_mode: "r", closure: "c" },
    voice: {}, nonce: 7,
    ...over,
  };
}

// Harness: stato Story + update reale (come Workspace, senza persistenza),
// con cattura dell'ultimo stato per le asserzioni.
function makeHarness(initial: Story) {
  const ref: { current: Story } = { current: initial };
  function Harness() {
    const [story, setStory] = useState(initial);
    ref.current = story;
    const update = (mut: (s: Story) => Story) => setStory((s) => mut(structuredClone(s)));
    return <Phase1Seeding story={story} update={update} log={() => {}} goPhase={() => {}} />;
  }
  return { Harness, ref };
}

function baseStory(extra: Partial<Story>): Story {
  return {
    id: "x", createdAt: new Date().toISOString(), title: "La radura",
    stage: "seed", seed: mkSeed(), ledger: [],
    ...extra,
  };
}

describe("§6.2 Phase1Seeding", () => {
  it("intake → 'Inizia con l'IA' appende il messaggio d'apertura e passa allo studio", () => {
    // storia fresca (niente chat, niente nodo) → parte in intake
    const { Harness, ref } = makeHarness(baseStory({}));
    const { container } = render(<Harness />);

    // siamo in intake: c'è il bottone del modo guidato
    expect(container.textContent).toContain("Modo guidato");

    const start = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Inizia con l'IA"));
    expect(start).toBeTruthy();
    fireEvent.click(start!);

    // la Story ha ora un messaggio d'apertura di claude ed è "avviata"
    expect(ref.current.chatStarted).toBe(true);
    expect(ref.current.seedingChat?.length).toBe(1);
    expect(ref.current.seedingChat?.[0].who).toBe("claude");

    // siamo passati allo studio: l'intake (modo guidato / Inizia con l'IA) è sparito
    expect(container.textContent).not.toContain("Modo guidato");
    expect(container.textContent).not.toContain("Inizia con l'IA");
  });

  it("un comando da campo (select 'Mondo' → set_world) muta la Story via il registry", () => {
    // chatStarted=true → si entra direttamente in studio (dove c'è il select Mondo)
    const { Harness, ref } = makeHarness(baseStory({ chatStarted: true }));
    const { container } = render(<Harness />);

    expect(ref.current.seed.world_flavor).toBe(""); // partenza

    // trova il <select> del Mondo (quello che offre i WORLD_FLAVORS)
    const mondo = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.value === "animali_del_bosco"),
    );
    expect(mondo).toBeTruthy();

    fireEvent.change(mondo!, { target: { value: "animali_del_bosco" } });

    // il comando set_world è passato dal registry e ha mutato la Story
    expect(ref.current.seed.world_flavor).toBe("animali_del_bosco");
  });
});
