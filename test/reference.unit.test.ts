// reference.unit.test.ts — §2 Reference (Passo 0): righe ⬜ e rinforzo delle parziali.
//
// Complementare a test/reference.test.ts (lo smoke B2, che copre 2.1/2.2/2.5/2.7/2.8/2.12):
//   - 2.3  deriveEntities(prev): le conferme sopravvivono alla ricostruzione del grafo
//   - 2.4  deriveEntities: dedup per id (un personaggio non si ripete)
//   - 2.6  buildReferenceSheetPrompt: SHEET FRAMING diverso PER KIND + LOCKED condizionale
//   - 2.9  buildPagePrompts: ogni campo esplicito (storyMoment, pov da TIPO hook, place da descrittore)
//   - 2.10 SCALA: con ≥2 personaggi in scena → altezze relative da KIND_SCALE
//   - 2.11 buildStylesheet: mappa world/season → testo, fallback ai default, NEGATIVE + "NO text"
//
// Nessun accesso a lib/ o components/ in scrittura: solo import del sistema sotto test.

import { describe, it, expect } from "vitest";
import { buildNode } from "../lib/engine";
import { deriveEntities, buildReferenceSheetPrompt } from "../lib/reference";
import { buildPagePrompts } from "../lib/pagePrompts";
import { buildStylesheet, KIND_SCALE } from "../lib/stylesheet";
import type { Seed, StoryNode, EntityRefRecord } from "../lib/types";
import type { Hook } from "../lib/engineTypes";

// --- factory di supporto ---------------------------------------------------

// Costruisce un nodo reale via buildNode (id entità e setting_primary coerenti col motore).
function mkNode(opts: {
  prot: { name: string; age: number; kind: string };
  comps?: { name: string; kind: string }[];
  setting?: string;
  world?: string;
}): StoryNode {
  const seed: Seed = {
    language: "it",
    title: "T",
    protagonist: opts.prot,
    companions: opts.comps ?? [],
    world_flavor: opts.world ?? "animali_del_bosco",
    setting: { primary: opts.setting ?? "la radura", notes: "" },
    theme: "scoperta",
    pugno: "x",
    personal_detail: "y",
    length_pages: 12,
    packs: [],
    spine: { premise: "p", problem: "q", threshold_moment: "t", resolution_mode: "r", closure: "c" },
    voice: { temperamento: "tenera" },
    nonce: 7,
  };
  return buildNode(seed);
}

// Hook sintetico completo: riempie i campi obbligatori, lascia sovrascrivere ciò che serve.
function mkHook(patch: Partial<Hook> = {}): Hook {
  return {
    page: 1,
    beat: "apertura",
    hook: "h",
    zone: "z",
    note: "",
    hook_id: "hk_1",
    type: "azione",
    characters_present: [],
    focal_action: "",
    atmosphere: "",
    palette: "",
    location: "la radura",
    location_entity_id: "luogo_la_radura",
    composition_zone: "vignette",
    markers: { is_entry: false, is_closure: false, is_threshold: false, seeds_planted: [], seeds_payoff: [] },
    ...patch,
  };
}

// ===========================================================================
// 2.3 — Preserva conferme su ricostruzione (prev)
// ===========================================================================
describe("§2.3 deriveEntities(prev): le conferme sopravvivono alla ricostruzione", () => {
  it("descrittore/prompt/immagine/stato confermati non si perdono per gli id già presenti", () => {
    const node = mkNode({ prot: { name: "Bruno", age: 6, kind: "tasso" }, comps: [{ name: "Lea", kind: "uccello" }] });
    const first = deriveEntities(node);

    // l'umano conferma char_bruno nel Passo 0
    const confirmed: EntityRefRecord[] = first.map((e) =>
      e.id === "char_bruno"
        ? { ...e, descriptor: "un tasso con la sciarpa rossa", referencePrompt: "PROMPT-X", imageUrl: "img/bruno.png", status: "confermata" }
        : e,
    );

    // si ricostruisce il grafo passando lo stato precedente
    const rebuilt = deriveEntities(node, confirmed);
    const b = rebuilt.find((e) => e.id === "char_bruno")!;
    expect(b.descriptor).toBe("un tasso con la sciarpa rossa");
    expect(b.referencePrompt).toBe("PROMPT-X");
    expect(b.imageUrl).toBe("img/bruno.png");
    expect(b.status).toBe("confermata");

    // un id NON presente in prev riparte dai default freschi (nessuna conferma fantasma)
    const lea = rebuilt.find((e) => e.id === "char_lea")!;
    expect(lea.status).toBe("da_generare");
    expect(lea.imageUrl).toBeUndefined();
  });

  it("descrittore vuoto nel prev → vince il seedDescriptor fresco, ma stato/immagine del prev restano", () => {
    const node = mkNode({ prot: { name: "Bruno", age: 6, kind: "tasso" } });
    const first = deriveEntities(node);
    const prevEmpty: EntityRefRecord[] = first.map((e) =>
      e.id === "char_bruno" ? { ...e, descriptor: "", status: "confermata", imageUrl: "img/b.png" } : e,
    );
    const reb = deriveEntities(node, prevEmpty);
    const b = reb.find((e) => e.id === "char_bruno")!;
    // ramo `old.descriptor || rec.descriptor`: vuoto → ricade sul descrittore di specie
    expect(b.descriptor).toBe("Bruno, a tasso");
    // gli altri campi confermati restano comunque preservati
    expect(b.status).toBe("confermata");
    expect(b.imageUrl).toBe("img/b.png");
  });
});

// ===========================================================================
// 2.4 — Dedup per id
// ===========================================================================
describe("§2.4 deriveEntities: dedup per id (un personaggio non si ripete)", () => {
  it("protagonista e compagno con stesso slug-nome → una sola entità character, e tiene la prima (il protagonista)", () => {
    // 'Lapo' protagonista (volpe) e 'Lapo' compagno (riccio) → entrambi id 'char_lapo'
    const node = mkNode({ prot: { name: "Lapo", age: 6, kind: "volpe" }, comps: [{ name: "Lapo", kind: "riccio" }] });
    const entities = deriveEntities(node);

    const ids = entities.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length); // nessun id duplicato
    expect(entities).toHaveLength(2); // char_lapo (una volta) + luogo

    const chars = entities.filter((e) => e.kind === "character");
    expect(chars).toHaveLength(1);
    // la dedup mantiene la PRIMA occorrenza = il protagonista (specie 'volpe', non 'riccio')
    expect(chars[0].id).toBe("char_lapo");
    expect(chars[0].species).toBe("volpe");
  });
});

// ===========================================================================
// 2.6 — buildReferenceSheetPrompt: SHEET FRAMING per KIND + LOCKED condizionale
// ===========================================================================
describe("§2.6 buildReferenceSheetPrompt: blocchi fissi e SHEET FRAMING differenziato per kind", () => {
  const node = mkNode({ prot: { name: "Gabriel", age: 5, kind: "volpe" } });

  function rec(kind: EntityRefRecord["kind"], patch: Partial<EntityRefRecord> = {}): EntityRefRecord {
    return { id: "x", name: "Soggetto", kind, descriptor: "descrizione canonica", status: "da_generare", ...patch };
  }

  it("character: CHARACTER REFERENCE SHEET (tre viste, BINDING) e non gli altri tipi", () => {
    const p = buildReferenceSheetPrompt(rec("character", { name: "Volpe", descriptor: "una volpina con la sciarpa blu" }), node);
    expect(p).toContain("CHARACTER REFERENCE SHEET");
    expect(p).toContain("three views");
    expect(p).toContain("BINDING");
    expect(p).not.toContain("LOCATION REFERENCE SHEET");
    expect(p).not.toContain("OBJECT REFERENCE SHEET");
    // blocchi fissi sempre presenti
    expect(p).toContain("ART STYLE"); // STYLESHEET
    expect(p).toContain("SUBJECT — Volpe: una volpina con la sciarpa blu");
    expect(p).toContain("FORMAT:");
    expect(p).toContain("NO text");
  });

  it("location: LOCATION REFERENCE SHEET (nessun personaggio) e non gli altri tipi", () => {
    const p = buildReferenceSheetPrompt(rec("location", { name: "Radura" }), node);
    expect(p).toContain("LOCATION REFERENCE SHEET");
    expect(p).toContain("NO characters present");
    expect(p).not.toContain("CHARACTER REFERENCE SHEET");
    expect(p).not.toContain("OBJECT REFERENCE SHEET");
  });

  it("object: OBJECT REFERENCE SHEET (isolato, fondo neutro) e non gli altri tipi", () => {
    const p = buildReferenceSheetPrompt(rec("object", { name: "Lanterna" }), node);
    expect(p).toContain("OBJECT REFERENCE SHEET");
    expect(p).toContain("ISOLATED on a plain flat neutral background");
    expect(p).not.toContain("CHARACTER REFERENCE SHEET");
    expect(p).not.toContain("LOCATION REFERENCE SHEET");
  });

  it("LOCKED compare SOLO se ci sono prohibitions", () => {
    const withProh = buildReferenceSheetPrompt(rec("character", { prohibitions: ["mai un cappello", "tieni la cicatrice"] }), node);
    expect(withProh).toContain("LOCKED — repeat every time: mai un cappello; tieni la cicatrice.");

    const noProh = buildReferenceSheetPrompt(rec("character"), node);
    expect(noProh).not.toContain("LOCKED");
  });
});

// ===========================================================================
// 2.9 — buildPagePrompts: ogni campo esplicito
// ===========================================================================
describe("§2.9 buildPagePrompts: campi veri (storyMoment, pov dal tipo hook, place dal descrittore)", () => {
  const node = mkNode({ prot: { name: "Bruno", age: 6, kind: "tasso" }, comps: [{ name: "Lea", kind: "uccello" }] });

  it("storyMoment = beat + composizione + chi è in scena + eventi-pagina dal focal_action", () => {
    const hook = mkHook({
      beat: "distinguere",
      composition_zone: "sky_space",
      characters_present: [
        { name: "Bruno", entityId: "char_bruno" },
        { name: "Lea", entityId: "char_lea" },
      ],
      focal_action: "qualcosa accade (SOGLIA: il cancello si apre)",
    });
    const [m] = buildPagePrompts(node, [hook], deriveEntities(node));
    expect(m.storyMoment).toContain("noticing something, curious and a little wary"); // BEAT_MOMENT[distinguere]
    expect(m.storyMoment).toContain("Bruno with Lea"); // chi è in scena
    expect(m.storyMoment).toContain("subject low in the frame, wide quiet sky/space above"); // ZONE_SPATIAL[sky_space]
    expect(m.storyMoment).toContain("SOGLIA: il cancello si apre"); // evento estratto dalle parentesi del focal_action
  });

  it("pov è guidato dal TIPO dell'hook, non dal beat", () => {
    const intro = buildPagePrompts(node, [mkHook({ type: "introspettivo", beat: "apertura" })], deriveEntities(node))[0];
    expect(intro.pov).toBe("the reader looks from a close shot on the protagonist's face and hands");

    const pano = buildPagePrompts(node, [mkHook({ type: "panorama", beat: "chiusura" })], deriveEntities(node))[0];
    expect(pano.pov).toBe("the reader looks from a wide establishing shot, from a distance");

    const unknown = buildPagePrompts(node, [mkHook({ type: "zzz" })], deriveEntities(node))[0];
    expect(unknown.pov).toContain("a balanced medium shot"); // fallback per tipo sconosciuto
  });

  it("place: non confermato usa setting_primary ('Keep it identical'); confermato usa il descrittore ('Keep this place identical')", () => {
    const hook = mkHook({ characters_present: [{ name: "Bruno", entityId: "char_bruno" }] });

    // luogo NON confermato
    const pre = buildPagePrompts(node, [hook], deriveEntities(node))[0];
    expect(pre.place).toBe("la radura. Keep it identical across all pages.");

    // luogo confermato con descrittore canonico
    const confirmed: EntityRefRecord[] = deriveEntities(node).map((e) =>
      e.id === "luogo_la_radura"
        ? { ...e, descriptor: "una radura muschiosa sotto la grande quercia", imageUrl: "img/loc.png", status: "confermata" }
        : e,
    );
    const post = buildPagePrompts(node, [hook], confirmed)[0];
    expect(post.place).toBe("una radura muschiosa sotto la grande quercia. Keep this place identical across all pages.");
  });
});

// ===========================================================================
// 2.10 — SCALA con ≥2 personaggi in scena (altezze relative da KIND_SCALE)
// ===========================================================================
describe("§2.10 buildPagePrompts: riga SCALA solo con ≥2 personaggi in scena", () => {
  const node = mkNode({
    prot: { name: "Bruno", age: 6, kind: "tasso" },
    comps: [
      { name: "Lea", kind: "uccello" }, // in KIND_SCALE
      { name: "Ghigo", kind: "drago" }, // NON in KIND_SCALE → default 0.40
    ],
  });

  it("≥2 in scena: ancora a 1.0 e altezze relative dal KIND_SCALE (con default 0.40 per specie ignota)", () => {
    const hook = mkHook({
      characters_present: [
        { name: "Bruno", entityId: "char_bruno" },
        { name: "Lea", entityId: "char_lea" },
        { name: "Ghigo", entityId: "char_ghigo" },
      ],
    });
    const [m] = buildPagePrompts(node, [hook], deriveEntities(node));
    expect(m.characters).toContain("SCALA:");
    expect(m.characters).toContain("Bruno 1.0 (size anchor)");
    // fattore preso davvero da KIND_SCALE (uccello = 0.2 → "0.20")
    expect(m.characters).toContain(`Lea ~${KIND_SCALE["uccello"].toFixed(2)}x Bruno's height`);
    // specie non mappata → fallback 0.40 (ramo `?? 0.4`)
    expect(m.characters).toContain("Ghigo ~0.40x Bruno's height");
    expect(m.characters).toContain("All characters stand on the same ground line");
  });

  it("1 solo personaggio in scena: nessuna riga SCALA", () => {
    const hook = mkHook({ characters_present: [{ name: "Bruno", entityId: "char_bruno" }] });
    const [m] = buildPagePrompts(node, [hook], deriveEntities(node));
    expect(m.characters).not.toContain("SCALA:");
  });
});

// ===========================================================================
// 2.11 — buildStylesheet: world/season → testo, fallback, NEGATIVE + "NO text"
// ===========================================================================
describe("§2.11 buildStylesheet: mappe world/season, fallback ai default, blocchi NEGATIVE/NO-text", () => {
  it("world noto → testo dedicato; world ignoto o assente → DEFAULT_WORLD_STYLE", () => {
    expect(buildStylesheet({ world: "animali_del_bosco" })).toContain("Anthropomorphic woodland animals");
    expect(buildStylesheet({ world: "spazio" })).toContain("near-future space setting");
    // fallback
    expect(buildStylesheet({ world: "non_esiste" })).toContain("A warm, naturalistic picture-book world");
    expect(buildStylesheet({})).toContain("A warm, naturalistic picture-book world");
  });

  it("season nota → palette dedicata; season ignota → palette di default neutra", () => {
    expect(buildStylesheet({ season: "estate" })).toContain("warm ochres and full shadows");
    expect(buildStylesheet({ season: "inverno" })).toContain("cool whites and soft blues");
    const fb = buildStylesheet({ season: "non_esiste" });
    expect(fb).toContain("Earthy restrained palette."); // default esatto (col punto)
    expect(fb).not.toContain("warm ochres"); // non la palette estiva
  });

  it("blocchi sempre presenti: NEGATIVE e divieto di testo nell'immagine", () => {
    const s = buildStylesheet({ world: "casa", season: "autunno" });
    expect(s).toContain("NEGATIVE:");
    expect(s).toContain("NO text, NO lettering");
    expect(s).toContain("ART STYLE");
  });

  it("fascia d'età dall'ageHint: ≤7 → 'ages 4-8'; altrimenti (incluso null/assente) → 'ages 5-10'", () => {
    expect(buildStylesheet({ ageHint: 6 })).toContain("ages 4-8");
    expect(buildStylesheet({ ageHint: 9 })).toContain("ages 5-10");
    expect(buildStylesheet({ ageHint: null })).toContain("ages 5-10");
    expect(buildStylesheet({})).toContain("ages 5-10");
  });
});
