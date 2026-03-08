import type { EchoMessage, EchoPart, EchoSettings } from "../echo/types";
import type { ProviderAdapter, ProviderConfig } from "./types";

/**
 * Convert EchoMessage parts to OpenAI message content.
 */
function toOpenAIMessage(msg: EchoMessage): Record<string, unknown> {
  const result: Record<string, unknown> = { role: msg.role };

  const textParts = msg.parts.filter((p) => p.type === "text");
  const toolCalls = msg.parts.filter((p) => p.type === "tool_call");
  const toolResults = msg.parts.filter((p) => p.type === "tool_result");
  const thinkingParts = msg.parts.filter((p) => p.type === "thinking");

  if (msg.role === "tool" && toolResults.length > 0) {
    const tr = toolResults[0]!;
    result.content =
      typeof tr.output === "string"
        ? tr.output
        : JSON.stringify(tr.output);
    result.tool_call_id = tr.tool_call_id;
    return result;
  }

  if (msg.role === "assistant") {
    result.content = textParts.map((p) => p.text).join("") || null;

    if (thinkingParts.length > 0) {
      result.reasoning_content = thinkingParts.map((p) => p.text).join("");
    }

    if (toolCalls.length > 0) {
      result.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments:
            typeof tc.input === "string"
              ? tc.input
              : JSON.stringify(tc.input),
        },
      }));
    }
    return result;
  }

  // system / user
  result.content = textParts.map((p) => p.text).join("");
  return result;
}

export const openaiAdapter: ProviderAdapter = {
  type: "openai",

  buildRequest(
    messages: EchoMessage[],
    settings: EchoSettings,
    config: ProviderConfig,
  ) {
    const baseUrl = config.base_url ?? "https://api.openai.com/v1";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const body: Record<string, unknown> = {
      model: settings.model ?? config.models[0],
      messages: messages.map(toOpenAIMessage),
      stream: true,
    };

    if (settings.temperature != null) body.temperature = settings.temperature;
    if (settings.max_tokens != null) body.max_tokens = settings.max_tokens;
    if (settings.top_p != null) body.top_p = settings.top_p;
    if (settings.response_format && settings.response_format !== "text") {
      if (settings.response_format === "json_schema" && settings.json_schema) {
        body.response_format = {
          type: "json_schema",
          json_schema: settings.json_schema,
        };
      } else {
        body.response_format = { type: settings.response_format };
      }
    }

    if (settings.tools && settings.tools.length > 0) {
      body.tools = settings.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          ...(t.strict != null && { strict: t.strict }),
        },
      }));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.api_key) {
      headers["Authorization"] = `Bearer ${config.api_key}`;
    }

    return { url, headers, body };
  },

  parseChunk(chunk: string): EchoPart[] {
    if (chunk === "[DONE]") return [];

    try {
      const data = JSON.parse(chunk);
      const delta = data?.choices?.[0]?.delta;
      if (!delta) return [];

      const parts: EchoPart[] = [];

      if (delta.content) {
        parts.push({ type: "text", text: delta.content });
      }

      if (delta.reasoning_content) {
        parts.push({ type: "thinking", text: delta.reasoning_content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function) {
            parts.push({
              type: "tool_call",
              id: tc.id ?? "",
              name: tc.function.name ?? "",
              input: tc.function.arguments ?? "",
            });
          }
        }
      }

      return parts;
    } catch {
      return [];
    }
  },

  isDone(chunk: string): boolean {
    return chunk === "[DONE]";
  },
};
