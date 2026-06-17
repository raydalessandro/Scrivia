// Adapter DeepSeek — API compatibile OpenAI: POST /chat/completions, Bearer auth.
//
// Reasoning = scelta del modello: `deepseek-reasoner` (R1) ragiona e restituisce
// `reasoning_content`; `deepseek-chat` (V3) no. Nessuna granularità di effort.
// Tool: formato function-calling OpenAI.

import type { ProviderAdapter, ResolvedRequest, CompletionResult, StreamEvent, AIToolCall, StopReason } from "../types";
import { getModel } from "../registry";
import { sseJson } from "../sse";

function buildBody(req: ResolvedRequest, stream: boolean) {
  const m = getModel("deepseek", req.model);
  const messages: { role: string; content: string }[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  for (const x of req.messages) messages.push({ role: x.role, content: x.content });

  const body: Record<string, unknown> = {
    model: req.model,
    messages,
    max_tokens: req.maxTokens ?? m?.maxOutputTokens ?? 4096,
    stream,
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
    body.tool_choice = req.toolChoice === "none" ? "none" : req.toolChoice === "required" ? "required" : "auto";
  }
  return body;
}

function headers(apiKey: string) {
  return { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
}

function mapStop(r: string | null | undefined): StopReason {
  switch (r) {
    case "stop": return "end";
    case "tool_calls": return "tool_use";
    case "length": return "length";
    case "content_filter": return "refusal";
    default: return "other";
  }
}

export const deepseekAdapter: ProviderAdapter = {
  id: "deepseek",

  async complete(req) {
    const res = await fetch(`https://api.deepseek.com/chat/completions`, {
      method: "POST", headers: headers(req.apiKey), body: JSON.stringify(buildBody(req, false)), signal: req.signal,
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message ?? {};
    const toolCalls: AIToolCall[] = (msg.tool_calls ?? []).map((tc: any) => {
      let args: Record<string, unknown> = {};
      try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch {}
      return { id: tc.id, name: tc.function?.name, arguments: args };
    });
    return {
      text: msg.content ?? "",
      reasoning: msg.reasoning_content || undefined,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
      stop: mapStop(choice?.finish_reason), provider: "deepseek", model: req.model,
    };
  },

  async *stream(req): AsyncIterable<StreamEvent> {
    const res = await fetch(`https://api.deepseek.com/chat/completions`, {
      method: "POST", headers: headers(req.apiKey), body: JSON.stringify(buildBody(req, true)), signal: req.signal,
    });
    if (!res.ok) { yield { type: "error", error: `DeepSeek ${res.status}: ${await res.text()}` }; return; }

    let text = "", reasoning = "", stop: StopReason = "other";
    const partial: Record<number, { id?: string; name?: string; args: string }> = {};

    for await (const ev of sseJson(res)) {
      const choice = ev.choices?.[0];
      if (!choice) continue;
      const d = choice.delta ?? {};
      if (d.content) { text += d.content; yield { type: "text", delta: d.content }; }
      if (d.reasoning_content) { reasoning += d.reasoning_content; yield { type: "reasoning", delta: d.reasoning_content }; }
      for (const tc of d.tool_calls ?? []) {
        const slot = (partial[tc.index] ??= { args: "" });
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name = tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
      if (choice.finish_reason) stop = mapStop(choice.finish_reason);
    }

    const toolCalls: AIToolCall[] = Object.values(partial).map((p) => {
      let args: Record<string, unknown> = {};
      try { args = p.args ? JSON.parse(p.args) : {}; } catch {}
      return { id: p.id ?? "", name: p.name ?? "", arguments: args };
    });
    for (const call of toolCalls) yield { type: "tool_call", call };
    yield { type: "done", result: { text, reasoning: reasoning || undefined, toolCalls: toolCalls.length ? toolCalls : undefined, stop, provider: "deepseek", model: req.model } };
  },
};
