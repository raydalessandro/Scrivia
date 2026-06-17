"use client";

// FASE 3 — Le illustrazioni. Ora in DUE passi.
//   Passo 0 (reference): ogni personaggio/luogo ha la sua reference canonica. L'umano
//     definisce l'aspetto (descrittore), copia il prompt del FOGLIO DI REFERENCE in Manus,
//     rimette l'immagine e CONFERMA. Da quel momento è canone duro.
//   Passo 1 (pagine): i prompt di pagina sono VERI (storyMoment/pov/place/subject, dal nodo)
//     e allegano le reference confermate. L'umano genera in Manus e rimette le immagini.
// Upload locale ora; in futuro Supabase Storage (e generazione diretta + video).

import { useState, useEffect } from "react";
import { Panel } from "../Workspace";
import { ActorChip, Pill } from "../ui";
import type { PhaseProps } from "./types";
import type { EntityRefRecord } from "@/lib/types";
import type { Hook } from "@/lib/engineTypes";
import { deriveEntities, buildReferenceSheetPrompt, referenceGate } from "@/lib/reference";
import { buildPagePrompts, bookStylesheet, CONSISTENCY_BLOCK } from "@/lib/pagePrompts";

export function Phase3Immagini({ story, update, log, goPhase }: PhaseProps) {
  const manus = story.manus ?? [];
  const entities = story.entities ?? [];

  // init/repair: se mancano le entità (storia vecchia) le ricavo e rigenero i prompt.
  useEffect(() => {
    if (story.node && story.pagePlan && (!story.entities || story.entities.length === 0)) {
      update((s) => {
        if (!s.node || !s.pagePlan) return s;
        const e = deriveEntities(s.node, s.entities);
        return { ...s, entities: e, manus: buildPagePrompts(s.node, s.pagePlan as Hook[], e) };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // muta un'entità e RIGENERA i prompt-pagina (references si aggiornano da sole).
  function patchEntity(id: string, patch: Partial<EntityRefRecord>) {
    update((s) => {
      const e = (s.entities ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x));
      const recomputed = s.node && s.pagePlan ? buildPagePrompts(s.node, s.pagePlan as Hook[], e) : s.manus;
      return { ...s, entities: e, manus: recomputed };
    });
  }

  const gate = referenceGate(entities);
  const confirmed = entities.filter((e) => e.status === "confermata" && e.imageUrl).length;

  return (
    <div className="space-y-5">
      {/* ---------------- Passo 0 — reference ---------------- */}
      <Panel
        title="Passo 0 — le reference (il canone visivo)"
        right={
          <span className="flex items-center gap-2">
            <Pill tone={gate.ready ? "ok" : "neutral"}>{confirmed}/{entities.length} confermate</Pill>
            <ActorChip actor="manus" />
          </span>
        }
      >
        <p className="text-sm text-ink-soft">
          Prima delle pagine, blocca <b>com'è fatto</b> ogni personaggio e il luogo. Definisci l'aspetto,
          copia il prompt del foglio di reference in <b>Manus</b>, rimetti l'immagine e conferma.
          Le pagine allegheranno queste reference: coerenza garantita.
        </p>
        <details className="mt-3 rounded-xl border border-line bg-paper p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Blocchi fissi (uguali in OGNI prompt)</summary>
          {story.node && (
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-paper-2 p-2 text-[11px] leading-relaxed text-ink">
{bookStylesheet(story.node)}

{CONSISTENCY_BLOCK}
            </pre>
          )}
        </details>

        <div className="mt-4 space-y-3">
          {entities.map((e) => (
            <EntityCard key={e.id} entity={e} node={story.node} onPatch={(p) => patchEntity(e.id, p)} log={log} />
          ))}
        </div>

        {!gate.ready && (
          <p className="mt-4 rounded-xl border border-gate/40 bg-gate-bg p-3 text-xs text-ink">
            Conferma tutte le reference per avere le pagine col canone. Mancano:{" "}
            <b>{gate.missing.map((m) => m.name).join(", ")}</b>. (Puoi procedere comunque, ma le pagine senza reference
            non saranno coerenti.)
          </p>
        )}
      </Panel>

      {/* ---------------- Passo 1 — pagine ---------------- */}
      <Panel
        title="Le pagine — i prompt sono pronti"
        right={
          <span className="flex items-center gap-2">
            <Pill tone={manus.every((m) => m.imageUrl) && manus.length > 0 ? "ok" : "neutral"}>
              {manus.filter((m) => m.imageUrl).length}/{manus.length} illustrate
            </Pill>
            <ActorChip actor="manus" />
          </span>
        }
      >
        <p className="text-sm text-ink-soft">
          Per ogni pagina: copia il prompt (mostra le reference da allegare), genera in Manus, rimetti l'immagine nello slot.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {manus.map((m) => (
            <PageCard key={m.page} prompt={m} entities={entities} onImage={(url) => {
              update((s) => ({ ...s, manus: s.manus?.map((x) => (x.page === m.page ? { ...x, imageUrl: url } : x)) }));
            }} />
          ))}
        </div>
      </Panel>

      <button
        onClick={() => goPhase?.("libro")}
        className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-paper"
      >
        {manus.every((m) => m.imageUrl) && manus.length > 0 ? "Monta il libro →" : "Vai al libro (anche con immagini mancanti) →"}
      </button>
    </div>
  );
}

// ---------------- card di un'entità (Passo 0) ----------------
function EntityCard({
  entity, node, onPatch, log,
}: {
  entity: EntityRefRecord;
  node: PhaseProps["story"]["node"];
  onPatch: (p: Partial<EntityRefRecord>) => void;
  log: PhaseProps["log"];
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [draft, setDraft] = useState(entity.descriptor);
  const confirmed = entity.status === "confermata" && !!entity.imageUrl;
  const tone = confirmed ? "ok" : entity.status === "in_revisione" ? "warn" : "neutral";
  const label = confirmed ? "confermata" : entity.status === "in_revisione" ? "in revisione" : "da generare";

  function onFile(file?: File) {
    if (!file) return;
    onPatch({ imageUrl: URL.createObjectURL(file), status: "in_revisione" });
  }
  function confirm() {
    onPatch({ status: "confermata" });
    log({ actor: "manus", event: "reference confermata", detail: entity.name });
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-3">
      <div className="flex items-start gap-3">
        {/* slot immagine reference */}
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
          {entity.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entity.imageUrl} alt={entity.name} className="h-full w-full object-cover" />
          ) : (
            <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-line-2 text-center text-[10px] text-ink-soft">
              <span className="text-lg">＋</span>reference
              <input type="file" accept="image/*" className="hidden" onChange={(ev) => onFile(ev.target.files?.[0])} />
            </label>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{entity.name}</span>
            <span className="rounded bg-line/60 px-1.5 text-[10px] uppercase tracking-wider text-ink-soft">
              {entity.kind === "location" ? "luogo" : entity.species || "personaggio"}
            </span>
            <Pill tone={tone as "ok" | "warn" | "neutral"}>{label}</Pill>
          </div>

          {/* descrittore = l'aspetto canonico */}
          <textarea
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onBlur={() => { if (draft !== entity.descriptor) onPatch({ descriptor: draft, status: "da_generare" }); }}
            rows={2}
            placeholder="l'aspetto: colori, vestiti, oggetto-firma…"
            className="mt-2 w-full resize-none rounded-lg border border-line bg-paper p-2 text-xs leading-relaxed text-ink"
          />

          <div className="mt-2 flex items-center gap-3 text-xs">
            <button onClick={() => setShowPrompt((v) => !v)} className="text-manus underline">
              {showPrompt ? "nascondi prompt" : "prompt foglio reference"}
            </button>
            {entity.imageUrl && !confirmed && (
              <button onClick={confirm} className="rounded-lg bg-ink px-3 py-1 font-semibold text-paper">Conferma reference</button>
            )}
            {entity.imageUrl && (
              <button onClick={() => onPatch({ imageUrl: undefined, status: "da_generare" })} className="text-ink-soft underline">cambia immagine</button>
            )}
          </div>

          {showPrompt && node && (
            <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-2 text-[11px] leading-relaxed text-ink">
{buildReferenceSheetPrompt(entity, node)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- card di una pagina (Passo 1) ----------------
function PageCard({
  prompt, entities, onImage,
}: {
  prompt: import("@/lib/types").ManusPrompt;
  entities: EntityRefRecord[];
  onImage: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const refNames = (prompt.references ?? [])
    .map((url) => entities.find((e) => e.imageUrl === url)?.name)
    .filter(Boolean)
    .join(", ");
  const missingNames = (prompt.missing ?? [])
    .map((id) => entities.find((e) => e.id === id)?.name || id)
    .join(", ");

  function onFile(file?: File) {
    if (!file) return;
    onImage(URL.createObjectURL(file));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper-2">
      <div className="relative aspect-[2/3] bg-paper">
        {prompt.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={prompt.imageUrl} alt={`pagina ${prompt.page}`} className="h-full w-full object-cover" />
        ) : (
          <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-line-2 text-center text-xs text-ink-soft">
            <span className="text-2xl">＋</span>carica l'immagine
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums">p{prompt.page}</span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-soft">
          <span className="rounded bg-line/60 px-1.5">{prompt.beat}</span>
          <span>{prompt.hook}</span>
        </div>
        {(prompt.missing?.length ?? 0) > 0 ? (
          <p className="mt-1 text-[11px] text-gate">⚠ manca reference: {missingNames}</p>
        ) : refNames ? (
          <p className="mt-1 text-[11px] text-ink-soft">reference da allegare: {refNames}</p>
        ) : null}
        <button onClick={() => setOpen((v) => !v)} className="mt-2 text-xs text-manus underline">
          {open ? "nascondi prompt" : "mostra prompt"}
        </button>
        {open && (
          <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-2 text-[11px] leading-relaxed text-ink">
{`STORY MOMENT: ${prompt.storyMoment}
POV: ${prompt.pov}
PLACE: ${prompt.place}
SUBJECT(s): ${prompt.characters}
ALLEGA: ${refNames || "— (conferma prima le reference nel Passo 0)"}
→ salva come immagini/p${String(prompt.page).padStart(2, "0")}.png`}
          </pre>
        )}
      </div>
    </div>
  );
}
