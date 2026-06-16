"use client";

// Store client minimale (localStorage). È volutamente dietro un'interfaccia
// sottile: sostituirlo con Supabase (Postgres + Storage) è un solo adapter,
// quando arriveranno immagini e video. Per ora: zero segreti, deploy immediato.

import type { Story, Seed } from "./types";
import { EXAMPLE_STORY } from "./example";

const KEY = "scrivia.stories.v1";

export function emptySeed(): Seed {
  return {
    language: "it",
    title: "",
    protagonist: { name: "", age: null, kind: "" },
    companions: [],
    world_flavor: "",
    setting: { primary: "", notes: "" },
    theme: "",
    pugno: "",
    personal_detail: "",
    length_pages: 12,
    packs: [],
    spine: { premise: "", problem: "", threshold_moment: "", resolution_mode: "", closure: "" },
    voice: {},
    nonce: null,
  };
}

export function newStory(): Story {
  const id = "s" + Math.random().toString(36).slice(2, 8);
  return {
    id,
    createdAt: new Date().toISOString(),
    title: "Storia senza nome",
    stage: "seed",
    seed: emptySeed(),
    ledger: [],
  };
}

export function loadStories(): Story[] {
  if (typeof window === "undefined") return [EXAMPLE_STORY];
  try {
    const raw = localStorage.getItem(KEY);
    const mine: Story[] = raw ? JSON.parse(raw) : [];
    return [EXAMPLE_STORY, ...mine];
  } catch {
    return [EXAMPLE_STORY];
  }
}

export function loadStory(id: string): Story | undefined {
  return loadStories().find((s) => s.id === id);
}

export function saveStory(story: Story) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(KEY);
  const mine: Story[] = raw ? JSON.parse(raw) : [];
  const i = mine.findIndex((s) => s.id === story.id);
  if (i === -1) mine.push(story);
  else mine[i] = story;
  localStorage.setItem(KEY, JSON.stringify(mine));
}

export function deleteStory(id: string) {
  if (typeof window === "undefined" || id === "esempio") return;
  const raw = localStorage.getItem(KEY);
  const mine: Story[] = raw ? JSON.parse(raw) : [];
  localStorage.setItem(KEY, JSON.stringify(mine.filter((s) => s.id !== id)));
}
