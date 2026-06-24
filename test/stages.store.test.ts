// @vitest-environment jsdom
//
// stages.store.test.ts — §5 Stato fasi & store.
//   - 5.1 deriveStages: i vettori di stato (done/ready/gate/locked) seguono gli artefatti presenti
//   - 5.2 currentPhase: seeding→immagini→libro secondo prose/manus/stage (non passa mai da "prosa")
//   - 5.4 store: roundtrip saveStory/loadStory, EXAMPLE_STORY sempre presente, deleteStory protegge l'esempio
//
// 5.1/5.2 sono funzioni pure e girano comunque. 5.4 ora gira contro un client
// Supabase FINTO in-memory (no rete, no localStorage): il backing è cambiato,
// gli invarianti no. 5.3 (phaseReached, interno a Workspace) è osservabile solo
// dal rendering delle tab: coperto dallo smoke di Workspace in §6.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { deriveStages, currentPhase } from "../lib/stages";
import { newStory, emptySeed, saveStory, loadStory, loadStories, deleteStory } from "../lib/store";
import { EXAMPLE_STORY } from "../lib/example";
import { buildNode } from "../lib/engine";
import type { Story, Seed, StageId, StageState, PagePlan, ProsePage, ManusPrompt, CriticVerdict } from "../lib/types";

// --- client Supabase finto: una Map in memoria dietro la stessa superficie che
//     l'adapter usa (auth.getUser, from().select/eq/order/maybeSingle, upsert,
//     delete().eq). Così §5.4 prova il roundtrip dell'adapter senza rete. -----
const sb = vi.hoisted(() => {
  const db = new Map<string, Record<string, unknown>>();
  const user = { id: "u-test" };
  const query = () => {
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    const run = () => [...db.values()].filter((r) => filters.every((f) => f(r)));
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => {
        filters.push((r) => r[c] === v);
        return q;
      },
      order: () => Promise.resolve({ data: run(), error: null }),
      maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
    };
    return q;
  };
  const client = {
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: () => ({
      select: () => query(),
      upsert: (row: Record<string, unknown>) => {
        db.set(row.id as string, row);
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        eq: (c: string, v: unknown) => {
          for (const [k, r] of [...db]) if (r[c] === v) db.delete(k);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  };
  return { db, client };
});
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => sb.client }));

// --- artefatti minimi (servono solo come "presenti", veri e tipizzati) ----
const NODE_SEED: Seed = {
  language: "it", title: "T",
  protagonist: { name: "Bruno", age: 6, kind: "tasso" },
  companions: [], world_flavor: "animali_del_bosco",
  setting: { primary: "la radura", notes: "" },
  theme: "scoperta", pugno: "x", personal_detail: "y",
  length_pages: 12, packs: [],
  spine: { premise: "p", problem: "q", threshold_moment: "t", resolution_mode: "r", closure: "c" },
  voice: {}, nonce: 7,
};
const A_NODE = buildNode(NODE_SEED);
const A_PLAN: PagePlan[] = [{ page: 1, beat: "apertura", hook: "h", zone: "z", note: "" }];
const A_PROSE: ProsePage[] = [{ page: 1, beat: "apertura", text: "c'era una volta" }];
const A_CRITIC: CriticVerdict = { verdict: "PASS", checks: [], page_flags: [] };
const manusNoImg: ManusPrompt[] = [{ page: 1, hook: "h", beat: "apertura", storyMoment: "m", pov: "p", place: "pl", characters: "c" }];
const manusWithImg: ManusPrompt[] = [{ ...manusNoImg[0], imageUrl: "img/p1.png" }];

// Costruisce una Story valida (da newStory) e attiva solo gli artefatti richiesti.
function mkStory(o: {
  stage?: StageId; name?: string; node?: boolean; pagePlan?: boolean;
  brief?: string; manus?: ManusPrompt[]; prose?: boolean; critic?: boolean;
}): Story {
  const base = newStory();
  const seed: Seed = { ...base.seed, protagonist: { ...base.seed.protagonist, name: o.name ?? "" } };
  return {
    ...base,
    stage: o.stage ?? "seed",
    seed,
    node: o.node ? A_NODE : undefined,
    pagePlan: o.pagePlan ? A_PLAN : undefined,
    brief: o.brief,
    manus: o.manus,
    prose: o.prose ? A_PROSE : undefined,
    critic: o.critic ? A_CRITIC : undefined,
  };
}

const states = (s: Story): StageState[] => deriveStages(s).map((st) => st.state);

// ===========================================================================
// 5.1 — deriveStages
// ===========================================================================
describe("§5.1 deriveStages: transizioni done/ready/gate/locked coerenti con gli artefatti", () => {
  // L'ordine delle tappe: seed, node, hook, brief, manus, prosa(gate), audit, book.

  it("storia fresca: solo 'seed' è ready, tutto il resto locked", () => {
    expect(states(mkStory({}))).toEqual([
      "ready", "locked", "locked", "locked", "locked", "locked", "locked", "locked",
    ]);
  });

  it("seed compilato (nome protagonista): 'seed' done, 'node' ready", () => {
    expect(states(mkStory({ name: "Bruno" }))).toEqual([
      "done", "ready", "locked", "locked", "locked", "locked", "locked", "locked",
    ]);
  });

  it("fino a manus (stage=manus): prime 5 done, 'prosa' è il GATE, resto locked", () => {
    const s = mkStory({ stage: "manus", name: "Bruno", node: true, pagePlan: true, manus: manusNoImg });
    expect(states(s)).toEqual([
      "done", "done", "done", "done", "done", "gate", "locked", "locked",
    ]);
    // la tappa prosa è esplicitamente un cancello
    const prosa = deriveStages(s).find((x) => x.id === "prosa")!;
    expect(prosa.gate).toBe(true);
    expect(prosa.state).toBe("gate");
  });

  it("prosa+audit fatti (stage=audit): 'book' diventa ready", () => {
    const s = mkStory({ stage: "audit", name: "Bruno", node: true, pagePlan: true, manus: manusWithImg, prose: true, critic: true });
    expect(states(s)).toEqual([
      "done", "done", "done", "done", "done", "done", "done", "ready",
    ]);
  });

  it("tutto completato (stage=book): tutte le tappe done", () => {
    const s = mkStory({ stage: "book", name: "Bruno", node: true, pagePlan: true, manus: manusWithImg, prose: true, critic: true });
    expect(states(s)).toEqual(Array(8).fill("done"));
  });

  it("'brief' risulta done anche solo col pagePlan (hasArtifact: brief || pagePlan)", () => {
    const s = mkStory({ stage: "hook", name: "Bruno", node: true, pagePlan: true });
    const brief = deriveStages(s).find((x) => x.id === "brief")!;
    expect(brief.state).toBe("done");
  });
});

// ===========================================================================
// 5.2 — currentPhase
// ===========================================================================
describe("§5.2 currentPhase: seeding→immagini→libro secondo prose/manus/stage", () => {
  it("senza prosa → seeding (anche con node/pagePlan/manus presenti)", () => {
    expect(currentPhase(mkStory({}))).toBe("seeding");
    expect(currentPhase(mkStory({ name: "Bruno", node: true, pagePlan: true, manus: manusNoImg }))).toBe("seeding");
  });

  it("prosa presente ma nessuna immagine nei manus → immagini", () => {
    expect(currentPhase(mkStory({ prose: true, manus: manusNoImg }))).toBe("immagini");
    // manus del tutto assente → comunque immagini (optional chaining su .some)
    expect(currentPhase(mkStory({ prose: true }))).toBe("immagini");
  });

  it("prosa + almeno un'immagine nei manus → libro (a prescindere dallo stage)", () => {
    expect(currentPhase(mkStory({ prose: true, manus: manusWithImg, stage: "manus" }))).toBe("libro");
    expect(currentPhase(mkStory({ prose: true, manus: manusWithImg, stage: "book" }))).toBe("libro");
  });

  it("non restituisce mai la fase 'prosa' (il salto è seeding→immagini→libro)", () => {
    const samples = [
      mkStory({}),
      mkStory({ prose: true, manus: manusNoImg }),
      mkStory({ prose: true, manus: manusWithImg }),
    ];
    for (const s of samples) expect(currentPhase(s)).not.toBe("prosa");
  });
});

// ===========================================================================
// 5.4 — store (adapter su client Supabase finto in-memory)
// ===========================================================================
describe("§5.4 store: roundtrip, EXAMPLE_STORY sempre presente, deleteStory protegge l'esempio", () => {
  beforeEach(() => sb.db.clear());

  it("saveStory → loadStory: roundtrip fedele", async () => {
    const s = newStory();
    const titled: Story = { ...s, title: "La radura" };
    await saveStory(titled);
    const back = await loadStory(s.id);
    expect(back).toBeDefined();
    expect(back!.id).toBe(s.id);
    expect(back!.title).toBe("La radura");
    expect(back).toEqual(titled); // serializzazione/deserializzazione fedele
  });

  it("EXAMPLE_STORY è sempre presente (anche con storage vuoto) ed è la prima della lista", async () => {
    const list = await loadStories();
    expect(list[0].id).toBe("esempio");
    expect(list[0].id).toBe(EXAMPLE_STORY.id);

    // dopo aver salvato una storia mia, l'esempio resta e resta in testa
    await saveStory({ ...newStory(), title: "mia" });
    const list2 = await loadStories();
    expect(list2[0].id).toBe(EXAMPLE_STORY.id);
    expect(list2.some((x) => x.id === EXAMPLE_STORY.id)).toBe(true);
  });

  it("deleteStory rimuove una storia mia ma NON l'esempio (guardia id==='esempio')", async () => {
    const mine: Story = { ...newStory(), title: "da cancellare" };
    await saveStory(mine);
    expect(await loadStory(mine.id)).toBeDefined();

    await deleteStory(mine.id);
    expect(await loadStory(mine.id)).toBeUndefined();

    // l'esempio è ancora raggiungibile
    expect(await loadStory("esempio")).toBeDefined();
    // e cancellarlo è un no-op
    await deleteStory("esempio");
    expect(await loadStory("esempio")).toBeDefined();
  });

  it("emptySeed/newStory: forma iniziale attesa", () => {
    const seed = emptySeed();
    expect(seed.protagonist).toEqual({ name: "", age: null, kind: "" });
    expect(seed.length_pages).toBe(12);
    expect(seed.nonce).toBeNull();

    const st = newStory();
    expect(st.stage).toBe("seed");
    // l'id è ora un uuid (lo schema lo congela come uuid)
    expect(st.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(st.ledger).toEqual([]);
  });
});
