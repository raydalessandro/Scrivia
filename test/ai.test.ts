// ai.test.ts — Layer AI (lib/ai/*) e route /api/ai. §4.1–4.10 di docs/TEST_SPEC.md.
// Niente rete: fetch è SEMPRE mockato (si verificano shape della richiesta e parsing
// della risposta), le env sono stubbate. Gli adapter vengono esercitati tramite
// complete() con fetch finto, così buildBody/parse (interni) restano testati dal bordo.

import { describe, it, expect, vi, afterEach } from "vitest";
import { PROVIDERS, getModel, clampReasoning } from "@/lib/ai/registry";
import { DEFAULT_SELECTION, getSelection } from "@/lib/ai/config";
import { aiComplete, configuredProviders, AIKeyMissingError } from "@/lib/ai/client";
import { sseJson } from "@/lib/ai/sse";
import { anthropicAdapter } from "@/lib/ai/providers/anthropic";
import { deepseekAdapter } from "@/lib/ai/providers/deepseek";
import { GET as aiGET, POST as aiPOST } from "@/app/api/ai/route";
import type { ResolvedRequest, ReasoningLevel, AITask, AITool } from "@/lib/ai/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ---- helper: mock di fetch che cattura la richiesta e restituisce una risposta finta ----
function stubFetchJson(responseObj: any, ok = true, status = 200): any {
  const mock = vi.fn(async (..._args: any[]) => ({
    ok,
    status,
    json: async () => responseObj,
    text: async () => (typeof responseObj === "string" ? responseObj : JSON.stringify(responseObj)),
  }));
  vi.stubGlobal("fetch", mock);
  return mock;
}
function lastBody(mock: any): any {
  const calls = mock.mock.calls;
  return JSON.parse(calls[calls.length - 1][1].body as string);
}

// ---- factory di ResolvedRequest (chiave già risolta: l'adapter non passa dal client) ----
function arr(model: string, reasoning: ReasoningLevel, extra: Partial<ResolvedRequest> = {}): ResolvedRequest {
  return { provider: "anthropic", model, reasoning, apiKey: "sk-test", messages: [{ role: "user", content: "ciao" }], ...extra };
}
function drr(model: string, reasoning: ReasoningLevel, extra: Partial<ResolvedRequest> = {}): ResolvedRequest {
  return { provider: "deepseek", model, reasoning, apiKey: "sk-test", messages: [{ role: "user", content: "ciao" }], ...extra };
}

const SAMPLE_TOOL: AITool = {
  name: "set_theme",
  description: "imposta il tema",
  inputSchema: { type: "object", properties: { theme: { type: "string" } }, required: ["theme"] },
};
const ANTHRO_OK = { content: [], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
const DS_OK = { choices: [{ message: { content: "" }, finish_reason: "stop" }], usage: {} };

// ======================================================================
// §4.1 — ogni modello dichiara ≥1 livello di reasoning
// ======================================================================
describe("§4.1 — ogni modello dichiara almeno un livello di reasoning", () => {
  it("reasoning non vuoto per ogni modello del registry", () => {
    for (const p of PROVIDERS)
      for (const m of p.models) expect(m.reasoning.length, `${p.id}/${m.id}`).toBeGreaterThanOrEqual(1);
  });
});

// ======================================================================
// §4.2 — clampReasoning riallinea al supportato
// ======================================================================
describe("§4.2 — clampReasoning", () => {
  it("opus high→high · haiku high→off · deepseek-chat *→off · fable off→livello attivo", () => {
    expect(clampReasoning("anthropic", "claude-opus-4-8", "high")).toBe("high");
    expect(clampReasoning("anthropic", "claude-haiku-4-5", "high")).toBe("off");
    expect(clampReasoning("deepseek", "deepseek-chat", "high")).toBe("off");
    expect(clampReasoning("deepseek", "deepseek-chat", "medium")).toBe("off");
    const fable = clampReasoning("anthropic", "claude-fable-5", "off");
    expect(fable).not.toBe("off");
    expect(getModel("anthropic", "claude-fable-5")!.reasoning).toContain(fable);
    expect(fable).toBe("low"); // il livello attivo più vicino a "off"
  });

  it("modello inesistente → livello invariato", () => {
    expect(clampReasoning("anthropic", "non-esiste", "high")).toBe("high");
  });
});

// ======================================================================
// §4.3 — i default per-fase puntano a modelli validi
// ======================================================================
describe("§4.3 — config dei default per-fase", () => {
  it("ogni default esiste e supporta il reasoning; in node getSelection = default", () => {
    for (const [task, sel] of Object.entries(DEFAULT_SELECTION)) {
      const m = getModel(sel.provider, sel.model);
      expect(m, task).toBeDefined();
      expect(m!.reasoning, `${task} ${sel.model}`).toContain(sel.reasoning);
      // niente window in ambiente node → nessun override → default riallineato (identico)
      expect(getSelection(task as AITask)).toEqual(sel);
    }
  });
});

// ======================================================================
// §4.4 — facciata client: esplicito vince, chiave mancante → AIKeyMissingError
// ======================================================================
describe("§4.4 — resolveSelection / chiave (env mockato)", () => {
  it("senza chiave per il provider risolto → AIKeyMissingError", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    let err: unknown;
    try {
      aiComplete({ task: "prosa", messages: [{ role: "user", content: "ciao" }] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AIKeyMissingError);
    expect((err as AIKeyMissingError).provider).toBe("anthropic");
    expect((err as AIKeyMissingError).env).toBe("ANTHROPIC_API_KEY");
  });

  it("provider/model espliciti vincono sul default del task", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-anthropic"); // presente
    vi.stubEnv("DEEPSEEK_API_KEY", ""); // mancante
    let err: unknown;
    // default di "prosa" è anthropic; lo forziamo a deepseek → deve chiedere la chiave deepseek
    try {
      aiComplete({ task: "prosa", provider: "deepseek", model: "deepseek-chat", messages: [{ role: "user", content: "ciao" }] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AIKeyMissingError);
    expect((err as AIKeyMissingError).provider).toBe("deepseek");
    expect((err as AIKeyMissingError).env).toBe("DEEPSEEK_API_KEY");
  });

  it("configuredProviders riflette le env presenti", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-anthropic");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const cfg = configuredProviders();
    const a = cfg.find((c) => c.provider === "anthropic")!;
    const d = cfg.find((c) => c.provider === "deepseek")!;
    expect(a.ready).toBe(true);
    expect(a.env).toBe("ANTHROPIC_API_KEY");
    expect(d.ready).toBe(false);
  });
});

// ======================================================================
// §4.5 — sseJson
// ======================================================================
describe("§4.5 — sseJson estrae i data: e ignora righe parziali/non-JSON", () => {
  function sseResponse(chunks: string[]): Response {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const s of chunks) c.enqueue(enc.encode(s));
        c.close();
      },
    });
    return new Response(stream);
  }

  it("oggetti corretti; righe spezzate ricomposte; [DONE]/non-data/non-JSON ignorati", async () => {
    const chunks = [
      "event: message\n", // riga non-data → ignorata
      'data: {"n":1}\n\n',
      'data: {"n":2}\n',
      ": commento\n", // non-data
      "data: hello world\n", // data non-JSON → ignorata
      "\n",
      'data: {"n":', // riga spezzata: prima parte (senza newline)
      "3}\n", // seconda parte: completa la riga
      "data: [DONE]\n", // terminatore → ignorato
    ];
    const out: any[] = [];
    for await (const o of sseJson(sseResponse(chunks))) out.push(o);
    expect(out).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it("body nullo → nessun oggetto", async () => {
    const out: any[] = [];
    for await (const o of sseJson(new Response(null))) out.push(o);
    expect(out).toEqual([]);
  });
});

// ======================================================================
// §4.6 — Anthropic buildBody (via complete, fetch mockato)
// ======================================================================
describe("§4.6 — Anthropic buildBody", () => {
  it("opus off → thinking:disabled, niente effort", async () => {
    const f = stubFetchJson(ANTHRO_OK);
    await anthropicAdapter.complete(arr("claude-opus-4-8", "off"));
    const b = lastBody(f);
    expect(b.thinking).toEqual({ type: "disabled" });
    expect(b.output_config).toBeUndefined();
  });

  it("opus low/medium/high → thinking:adaptive + effort", async () => {
    for (const lvl of ["low", "medium", "high"] as const) {
      const f = stubFetchJson(ANTHRO_OK);
      await anthropicAdapter.complete(arr("claude-opus-4-8", lvl));
      const b = lastBody(f);
      expect(b.thinking).toEqual({ type: "adaptive" });
      expect(b.output_config).toEqual({ effort: lvl });
    }
  });

  it("fable → solo effort, mai off (off → effort low)", async () => {
    const f1 = stubFetchJson(ANTHRO_OK);
    await anthropicAdapter.complete(arr("claude-fable-5", "off"));
    let b = lastBody(f1);
    expect(b.output_config).toEqual({ effort: "low" });
    expect(b.thinking).toBeUndefined();

    const f2 = stubFetchJson(ANTHRO_OK);
    await anthropicAdapter.complete(arr("claude-fable-5", "high"));
    b = lastBody(f2);
    expect(b.output_config).toEqual({ effort: "high" });
    expect(b.thinking).toBeUndefined();
  });

  it("haiku → niente effort", async () => {
    const f = stubFetchJson(ANTHRO_OK);
    await anthropicAdapter.complete(arr("claude-haiku-4-5", "off"));
    expect(lastBody(f).thinking).toEqual({ type: "disabled" });
    expect(lastBody(f).output_config).toBeUndefined();

    const f2 = stubFetchJson(ANTHRO_OK);
    await anthropicAdapter.complete(arr("claude-haiku-4-5", "medium"));
    expect(lastBody(f2).output_config).toBeUndefined();
  });

  it("tool mapping {name,description,input_schema} e tool_choice", async () => {
    const cases: [("auto" | "none" | "required" | undefined), any][] = [
      ["auto", { type: "auto" }],
      ["none", { type: "none" }],
      ["required", { type: "any" }],
      [undefined, { type: "auto" }],
    ];
    for (const [choice, expected] of cases) {
      const f = stubFetchJson(ANTHRO_OK);
      await anthropicAdapter.complete(arr("claude-opus-4-8", "high", { tools: [SAMPLE_TOOL], toolChoice: choice }));
      const b = lastBody(f);
      expect(b.tools).toEqual([{ name: "set_theme", description: "imposta il tema", input_schema: SAMPLE_TOOL.inputSchema }]);
      expect(b.tool_choice).toEqual(expected);
    }
  });

  it("system → body.system e i messaggi 'system' diventano 'user'", async () => {
    const f = stubFetchJson(ANTHRO_OK);
    await anthropicAdapter.complete(
      arr("claude-opus-4-8", "high", {
        system: "sei un narratore",
        messages: [
          { role: "system", content: "regole" },
          { role: "user", content: "ciao" },
        ],
      })
    );
    const b = lastBody(f);
    expect(b.system).toBe("sei un narratore");
    expect(b.messages).toEqual([
      { role: "user", content: "regole" },
      { role: "user", content: "ciao" },
    ]);
    expect(b.model).toBe("claude-opus-4-8");
  });
});

// ======================================================================
// §4.7 — Anthropic parse (mock)
// ======================================================================
describe("§4.7 — Anthropic parse", () => {
  it("text/thinking/tool_use → CompletionResult", async () => {
    stubFetchJson({
      content: [
        { type: "text", text: "Ciao " },
        { type: "text", text: "mondo" },
        { type: "thinking", thinking: "rifletto" },
        { type: "tool_use", id: "tu_1", name: "set_theme", input: { theme: "amicizia" } },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    const r = await anthropicAdapter.complete(arr("claude-opus-4-8", "high"));
    expect(r.text).toBe("Ciao mondo");
    expect(r.reasoning).toBe("rifletto");
    expect(r.toolCalls).toEqual([{ id: "tu_1", name: "set_theme", arguments: { theme: "amicizia" } }]);
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(r.stop).toBe("tool_use");
    expect(r.provider).toBe("anthropic");
    expect(r.model).toBe("claude-opus-4-8");
  });

  it("solo testo → reasoning e toolCalls undefined", async () => {
    stubFetchJson({ content: [{ type: "text", text: "solo testo" }], stop_reason: "end_turn", usage: {} });
    const r = await anthropicAdapter.complete(arr("claude-opus-4-8", "high"));
    expect(r.text).toBe("solo testo");
    expect(r.reasoning).toBeUndefined();
    expect(r.toolCalls).toBeUndefined();
    expect(r.stop).toBe("end");
  });

  it("mappa stop_reason → StopReason (end/tool_use/length/refusal/other)", async () => {
    const table: [string, string][] = [
      ["end_turn", "end"],
      ["stop_sequence", "end"],
      ["tool_use", "tool_use"],
      ["max_tokens", "length"],
      ["refusal", "refusal"],
      ["pause_turn", "other"],
    ];
    for (const [raw, mapped] of table) {
      stubFetchJson({ content: [], stop_reason: raw, usage: {} });
      const r = await anthropicAdapter.complete(arr("claude-opus-4-8", "high"));
      expect(r.stop, raw).toBe(mapped);
    }
  });
});

// ======================================================================
// §4.8 — DeepSeek buildBody (via complete, fetch mockato)
// ======================================================================
describe("§4.8 — DeepSeek buildBody", () => {
  it("system entra nei messages; modello e stream:false", async () => {
    const f = stubFetchJson(DS_OK);
    await deepseekAdapter.complete(drr("deepseek-chat", "off", { system: "istruzioni", messages: [{ role: "user", content: "ciao" }] }));
    const b = lastBody(f);
    expect(b.messages[0]).toEqual({ role: "system", content: "istruzioni" });
    expect(b.messages[1]).toEqual({ role: "user", content: "ciao" });
    expect(b.model).toBe("deepseek-chat");
    expect(b.stream).toBe(false);
  });

  it("tool in formato OpenAI; tool_choice", async () => {
    const cases: [("auto" | "none" | "required" | undefined), string][] = [
      ["auto", "auto"],
      ["none", "none"],
      ["required", "required"],
      [undefined, "auto"],
    ];
    for (const [choice, expected] of cases) {
      const f = stubFetchJson(DS_OK);
      await deepseekAdapter.complete(drr("deepseek-chat", "off", { tools: [SAMPLE_TOOL], toolChoice: choice }));
      const b = lastBody(f);
      expect(b.tools).toEqual([
        { type: "function", function: { name: "set_theme", description: "imposta il tema", parameters: SAMPLE_TOOL.inputSchema } },
      ]);
      expect(b.tool_choice).toBe(expected);
    }
  });
});

// ======================================================================
// §4.9 — DeepSeek parse (mock)
// ======================================================================
describe("§4.9 — DeepSeek parse", () => {
  it("content/reasoning_content/tool_calls (arguments JSON) → result", async () => {
    stubFetchJson({
      choices: [
        {
          message: {
            content: "Ciao",
            reasoning_content: "penso",
            tool_calls: [{ id: "call_1", function: { name: "set_theme", arguments: '{"theme":"amicizia"}' } }],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 7 },
    });
    const r = await deepseekAdapter.complete(drr("deepseek-reasoner", "high"));
    expect(r.text).toBe("Ciao");
    expect(r.reasoning).toBe("penso");
    expect(r.toolCalls).toEqual([{ id: "call_1", name: "set_theme", arguments: { theme: "amicizia" } }]);
    expect(r.usage).toEqual({ inputTokens: 5, outputTokens: 7 });
    expect(r.stop).toBe("tool_use");
    expect(r.provider).toBe("deepseek");
    expect(r.model).toBe("deepseek-reasoner");
  });

  it("solo content → reasoning/toolCalls undefined; arguments non-JSON → {}", async () => {
    stubFetchJson({
      choices: [{ message: { content: "x", tool_calls: [{ id: "c", function: { name: "n", arguments: "non json" } }] }, finish_reason: "stop" }],
      usage: {},
    });
    const r = await deepseekAdapter.complete(drr("deepseek-chat", "off"));
    expect(r.reasoning).toBeUndefined();
    expect(r.toolCalls).toEqual([{ id: "c", name: "n", arguments: {} }]);
    expect(r.stop).toBe("end");
  });

  it("mappa finish_reason → StopReason", async () => {
    const table: [string, string][] = [
      ["stop", "end"],
      ["tool_calls", "tool_use"],
      ["length", "length"],
      ["content_filter", "refusal"],
      ["boh", "other"],
    ];
    for (const [raw, mapped] of table) {
      stubFetchJson({ choices: [{ message: { content: "" }, finish_reason: raw }], usage: {} });
      const r = await deepseekAdapter.complete(drr("deepseek-chat", "off"));
      expect(r.stop, raw).toBe(mapped);
    }
  });
});

// ======================================================================
// §4.10 — /api/ai route handler
// ======================================================================
describe("§4.10 — /api/ai", () => {
  it("GET → shape providers/defaults/configured", async () => {
    const res = await aiGET();
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(Array.isArray(j.providers)).toBe(true);
    expect(j.providers.length).toBe(PROVIDERS.length);
    const p0 = j.providers[0];
    expect(p0).toHaveProperty("id");
    expect(p0).toHaveProperty("label");
    expect(p0).toHaveProperty("apiKeyEnv");
    expect(Array.isArray(p0.models)).toBe(true);
    expect(p0.models[0]).toHaveProperty("reasoning");
    expect(j.defaults).toEqual(DEFAULT_SELECTION);
    expect(Array.isArray(j.configured)).toBe(true);
    expect(j.configured[0]).toHaveProperty("ready");
  });

  it("POST senza messages → 400", async () => {
    const res = await aiPOST(
      new Request("http://t/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/messages/i);
  });

  it("POST JSON non valido → 400", async () => {
    const res = await aiPOST(
      new Request("http://t/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: "non-json" })
    );
    expect(res.status).toBe(400);
  });

  it("POST senza chiavi → 501", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const res = await aiPOST(
      new Request("http://t/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "ciao" }] }),
      })
    );
    expect(res.status).toBe(501);
    const j = await res.json();
    expect(j.env).toBe("ANTHROPIC_API_KEY");
    expect(j.provider).toBe("anthropic");
  });
});
