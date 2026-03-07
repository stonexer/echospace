import type { EchoMessage, EchoPart, EchoSettings } from "../echo/types";
import type { ProviderAdapter, ProviderConfig } from "./types";

/**
 * Convert EchoMessage to Anthropic content blocks.
 */
function toAnthropicContent(
  msg: EchoMessage,
): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];

  for (const part of msg.parts) {
    switch (part.type) {
      case "text":
        blocks.push({ type: "text", text: part.text });
        break;
      case "thinking":
        blocks.push({ type: "thinking", thinking: part.text });
        break;
      case "tool_call":
        blocks.push({
          type: "tool_use",
          id: part.id,
          name: part.name,
          input: part.input,
        });
        break;
      case "tool_result":
        blocks.push({
          type: "tool_result",
          tool_use_id: part.id,
          content: typeof part.output === "string"
            ? part.output
            : JSON.stringify(part.output),
          is_error: part.is_error,
        });
        break;
      case "image":
        if (part.base64) {
          blocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: part.media_type ?? "image/png",
              data: part.base64,
            },
          });
        }
        break;
    }
  }

  return blocks.length > 0 ? blocks : [{ type: "text", text: "" }];
}

export const anthropicAdapter: ProviderAdapter = {
  type: "anthropic",

  buildRequest(
    messages: EchoMessage[],
    settings: EchoSettings,
    config: ProviderConfig,
  ) {
    const baseUrl =
      config.base_url ?? "https://api.anthropic.com";
    const url = `${baseUrl.replace(/\/$/, "")}/v1/messages`;

    // Separate system message from the rest
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const system = systemMessages
      .flatMap((m) => m.parts.filter((p) => p.type === "text"))
      .map((p) => p.text)
      .join("\n\n");

    const body: Record<string, unknown> = {
      model: settings.model ?? config.models[0],
      messages: nonSystemMessages.map((msg) => ({
        role: msg.role === "tool" ? "user" : msg.role,
        content: toAnthropicContent(msg),
      })),
      max_tokens: settings.max_tokens ?? 4096,
      stream: true,
    };

    if (system) body.system = system;
    if (settings.temperature != null) body.temperature = settings.temperature;
    if (settings.top_p != null) body.top_p = settings.top_p;

    if (settings.tools && settings.tools.length > 0) {
      body.tools = settings.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    if (config.api_key) {
      headers["x-api-key"] = config.api_key;
    }

    return { url, headers, body };
  },

  parseChunk(chunk: string): EchoPart[] {
    try {
      const event = JSON.parse(chunk);
      const parts: EchoPart[] = [];

      switch (event.type) {
        case "content_block_delta": {
          const delta = event.delta;
          if (delta?.type === "text_delta" && delta.text) {
            parts.push({ type: "text", text: delta.text });
          }
          if (delta?.type === "thinking_delta" && delta.thinking) {
            parts.push({ type: "thinking", text: delta.thinking });
          }
          if (delta?.type === "input_json_delta" && delta.partial_json) {
            // Tool call input streaming — accumulate as text for now
            parts.push({
              type: "tool_call",
              id: "",
              name: "",
              input: delta.partial_json,
            });
          }
          break;
        }
        case "content_block_start": {
          const block = event.content_block;
          if (block?.type === "tool_use") {
            parts.push({
              type: "tool_call",
              id: block.id ?? "",
              name: block.name ?? "",
              input: "",
            });
          }
          break;
        }
      }

      return parts;
    } catch {
      return [];
    }
  },

  isDone(chunk: string): boolean {
    try {
      const event = JSON.parse(chunk);
      return event.type === "message_stop";
    } catch {
      return false;
    }
  },
};
