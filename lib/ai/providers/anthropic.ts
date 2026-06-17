// Adapter Anthropic (Claude) — POST /v1/messages.
//
// Reasoning (dalla reference ufficiale): su Opus 4.8/4.7 e Fable il budget_tokens
// è rimosso → adaptive thinking + output_config.effort (low/medium/high).
//   off   → thinking:{type:"disabled"} dove consentito, altrimenti niente effort
//   low/medium/high → thinking:{type:"adaptive"} + effort corrispondente
//   Fable: thinking sempre on → solo effort.
// Tool: {name, description, input_schema}. Niente temperature su 4.8/4.7/Fable.

import type { ProviderAdapter, ResolvedRequest, CompletionResult, StreamEvent, AIToolCall, StopReason } from "../types";
import { getModel } from "../registry";
import { sseJson } from "../sse";

const VERSION = "2023-06-01";

function buildBody(req: ResolvedRequest, stream: boolean) {
  const m = getModel("anthropic", req.model);
  const caps = m?.caps ?? {};
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? Math.min(m?.maxOutputTokens ?? 16000, stream ? 64000 : 16000),
    messages: req.messages.map((x) => ({ role: x.role === "system" ? "user" : x.role, content: x.content })),
    stream,
  };
  if (req.system) body.system = req.system;

  // reasoning → thinking + effort
  if (caps.thinkingAlwaysOn) {
    if (caps.effort) body.output_config = { effort: req.reasoning === "off" ? "low" : req.reasoning };
  } else if (req.reasoning === "off") {
    if (caps.canDisableThinking) body.thinking = { type: "disabled" };
  } else {
    body.thinking = { type: "adaptive" };
    if (caps.effort) body.output_config = { effort: req.reasoning };
  }

  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
    body.tool_choice =
      req.toolChoice === "none" ? { type: "none" } :
      req.toolChoice === "required" ? { type: "any" } : { type: "auto" };
  }
  return body;
}

function headers(apiKey: string) {
  return { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": VERSION };
}

function mapStop(r: string | null | undefined): StopReason {
  switch (r) {
    case "end_turn": case "stop_sequence": return "end";
    case "tool_use": return "tool_use";
    case "max_tokens": return "length";
    case "refusal": return "refusal";
    default: return "other";
  }
}

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",

  async complete(req) {
    const res = await fetch(`https://api.anthropic.com/v1/messages`, {
      method: "POST", headers: headers(req.apiKey), body: JSON.stringify(buildBody(req, false)), signal: req.signal,
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    let text = "", reasoning = "";
    const toolCalls: AIToolCall[] = [];
    for (const block of data.content ?? []) {
      if (block.type === "text") text += block.text;
      else if (block.type === "thinking") reasoning += block.thinking ?? "";
      else if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
    }
    const result: CompletionResult = {
      text, reasoning: reasoning || undefined,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
      stop: mapStop(data.stop_reason), provider: "anthropic", model: req.model,
    };
    return result;
  },

  async *stream(req): AsyncIterable<StreamEvent> {
    const res = await fetch(`https://api.anthropic.com/v1/messages`, {
      method: "POST", headers: headers(req.apiKey), body: JSON.stringify(buildBody(req, true)), signal: req.signal,
    });
    if (!res.ok) { yield { type: "error", error: `Anthropic ${res.status}: ${await res.text()}` }; return; }

    let text = "", reasoning = "", stop: StopReason = "other";
    const blocks: Record<number, { type: string; id?: string; name?: string; json: string }> = {};
    const toolCalls: AIToolCall[] = [];
    const usage: { inputTokens?: number; outputTokens?: number } = {};

    for await (const ev of sseJson(res)) {
      switch (ev.type) {
        case "message_start":
          usage.inputTokens = ev.message?.usage?.input_tokens; break;
        case "content_block_start":
          blocks[ev.index] = { type: ev.content_block?.type, id: ev.content_block?.id, name: ev.content_block?.name, json: "" };
          break;
        case "content_block_delta": {
          const d = ev.delta;
          if (d?.type === "text_delta") { text += d.text; yield { type: "text", delta: d.text }; }
          else if (d?.type === "thinking_delta") { reasoning += d.thinking; yield { type: "reasoning", delta: d.thinking }; }
          else if (d?.type === "input_json_delta" && blocks[ev.index]) { blocks[ev.index].json += d.partial_json; }
          break;
        }
        case "content_block_stop": {
          const b = blocks[ev.index];
          if (b?.type === "tool_use") {
            let args: Record<string, unknown> = {};
            try { args = b.json ? JSON.parse(b.json) : {}; } catch {}
            const call: AIToolCall = { id: b.id ?? `t${ev.index}`, name: b.name ?? "", arguments: args };
            toolCalls.push(call);
            yield { type: "tool_call", call };
          }
          break;
        }
        case "message_delta":
          if (ev.delta?.stop_reason) stop = mapStop(ev.delta.stop_reason);
          if (ev.usage?.output_tokens) usage.outputTokens = ev.usage.output_tokens;
          break;
      }
    }
    yield { type: "done", result: { text, reasoning: reasoning || undefined, toolCalls: toolCalls.length ? toolCalls : undefined, usage, stop, provider: "anthropic", model: req.model } };
  },
};
