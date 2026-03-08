import { nanoid } from "nanoid";
import type { EchoMessage, EchoPart, EchoRole } from "../echo/types";

/**
 * Parse OpenAI-format messages into EchoMessages.
 * Handles: `messages[]` array, `{ messages: [...] }`, and
 * Helicone wrapper `{ request: { messages: [...] }, response: { ... } }`.
 */
export function parseOpenAI(input: string): EchoMessage[] {
  const parsed = JSON.parse(input);

  // Unwrap Helicone { request, response } wrapper
  const source = parsed.request?.messages ? parsed.request : parsed;

  const requestMessages: Array<Record<string, unknown>> = Array.isArray(source)
    ? source
    : source.messages ?? [];

  // Collect all messages: request messages + response message(s)
  const messages = [...requestMessages];
  const respMessages = parsed.response?.messages ?? parsed.response?.choices;
  if (Array.isArray(respMessages)) {
    for (const item of respMessages) {
      // choices format: { message: { role, content } }
      // messages format: { role, content }
      messages.push(item.message ?? item);
    }
  }

  return messages.map((msg) => {
    const parts: EchoPart[] = [];
    const role = (msg.role as EchoRole) ?? "user";

    // Content
    if (typeof msg.content === "string") {
      parts.push({ type: "text", text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text") {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "image_url") {
          parts.push({ type: "image", url: block.image_url?.url });
        }
      }
    }

    // Reasoning content (DeepSeek, o1)
    if (typeof msg.reasoning_content === "string" && msg.reasoning_content) {
      parts.unshift({ type: "thinking", text: msg.reasoning_content });
    }

    // Tool calls
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        parts.push({
          type: "tool_call",
          id: tc.id ?? nanoid(8),
          name: tc.function?.name ?? "",
          input: tc.function?.arguments ?? "",
        });
      }
    }

    // Tool result
    if (role === "tool" && typeof msg.tool_call_id === "string") {
      parts.length = 0; // Clear text parts
      parts.push({
        type: "tool_result",
        id: msg.tool_call_id,
        output: msg.content ?? "",
      });
    }

    return {
      kind: "message" as const,
      id: (msg.id as string) ?? nanoid(8),
      role,
      created_at: new Date().toISOString(),
      parts,
    };
  });
}

/**
 * Parse Anthropic-format messages into EchoMessages.
 */
export function parseAnthropic(input: string): EchoMessage[] {
  const parsed = JSON.parse(input);

  // Could be a single message or array of messages
  const messages: Array<Record<string, unknown>> = Array.isArray(parsed)
    ? parsed
    : [parsed];

  // Handle the case where input has a system field + messages
  const result: EchoMessage[] = [];

  if (!Array.isArray(parsed) && parsed.system) {
    result.push({
      kind: "message",
      id: nanoid(8),
      role: "system",
      created_at: new Date().toISOString(),
      parts: [
        {
          type: "text",
          text:
            typeof parsed.system === "string"
              ? parsed.system
              : parsed.system
                  .filter((b: { type: string }) => b.type === "text")
                  .map((b: { text: string }) => b.text)
                  .join("\n"),
        },
      ],
    });
  }

  const msgList = !Array.isArray(parsed) && parsed.messages
    ? (parsed.messages as Array<Record<string, unknown>>)
    : messages;

  for (const msg of msgList) {
    const parts: EchoPart[] = [];
    const role = (msg.role as EchoRole) ?? "user";

    if (typeof msg.content === "string") {
      parts.push({ type: "text", text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content as Array<Record<string, unknown>>) {
        switch (block.type) {
          case "text":
            parts.push({ type: "text", text: block.text as string });
            break;
          case "thinking":
            parts.push({
              type: "thinking",
              text: (block.thinking as string) ?? "",
            });
            break;
          case "tool_use":
            parts.push({
              type: "tool_call",
              id: (block.id as string) ?? nanoid(8),
              name: (block.name as string) ?? "",
              input: block.input ?? {},
            });
            break;
          case "tool_result":
            parts.push({
              type: "tool_result",
              id: (block.tool_use_id as string) ?? "",
              output: block.content ?? "",
              is_error: block.is_error as boolean | undefined,
            });
            break;
          case "image":
            if (
              (block.source as Record<string, unknown>)?.type === "base64"
            ) {
              const source = block.source as Record<string, string>;
              parts.push({
                type: "image",
                base64: source.data,
                media_type: source.media_type,
              });
            }
            break;
        }
      }
    }

    result.push({
      kind: "message",
      id: (msg.id as string) ?? nanoid(8),
      role,
      created_at: new Date().toISOString(),
      parts,
    });
  }

  return result;
}

/**
 * Parse Google Gemini format into EchoMessages.
 */
export function parseGoogle(input: string): EchoMessage[] {
  const parsed = JSON.parse(input);
  const contents: Array<Record<string, unknown>> = parsed.contents ?? [];

  const result: EchoMessage[] = [];

  // System instruction
  if (parsed.systemInstruction?.parts) {
    result.push({
      kind: "message",
      id: nanoid(8),
      role: "system",
      created_at: new Date().toISOString(),
      parts: (
        parsed.systemInstruction.parts as Array<Record<string, string>>
      ).map((p) => ({
        type: "text" as const,
        text: p.text ?? "",
      })),
    });
  }

  for (const content of contents) {
    const role: EchoRole =
      content.role === "model" ? "assistant" : "user";
    const geminiParts = (content.parts as Array<Record<string, unknown>>) ?? [];
    const echoParts: EchoPart[] = [];

    for (const p of geminiParts) {
      if (p.text) {
        echoParts.push({ type: "text", text: p.text as string });
      }
      if (p.functionCall) {
        const fc = p.functionCall as Record<string, unknown>;
        echoParts.push({
          type: "tool_call",
          id: (fc.name as string) ?? nanoid(8),
          name: (fc.name as string) ?? "",
          input: fc.args ?? {},
        });
      }
      if (p.functionResponse) {
        const fr = p.functionResponse as Record<string, unknown>;
        echoParts.push({
          type: "tool_result",
          id: (fr.name as string) ?? "",
          output: fr.response ?? "",
        });
      }
    }

    result.push({
      kind: "message",
      id: nanoid(8),
      role,
      created_at: new Date().toISOString(),
      parts: echoParts,
    });
  }

  return result;
}

/**
 * Parse Vercel AI SDK format (Helicone export) into EchoMessages.
 * Structure: { request: { prompt: [...], tools: [...] }, response: { choices, model, usage } }
 *
 * Part type mapping:
 *   tool-call  → tool_call   (toolCallId → id, toolName → name)
 *   tool-result → tool_result (toolCallId → id, output may be { type, value } wrapper)
 */
export function parseVercel(input: string): EchoMessage[] {
  const parsed = JSON.parse(input);
  const prompt: Array<Record<string, unknown>> = parsed.request?.prompt ?? [];
  const response = parsed.response as Record<string, unknown> | undefined;

  const result: EchoMessage[] = [];

  for (const msg of prompt) {
    const role = (msg.role as EchoRole) ?? "user";
    const parts = convertVercelParts(msg.content);

    result.push({
      kind: "message",
      id: nanoid(8),
      role,
      created_at: new Date().toISOString(),
      parts,
    });
  }

  // Append the response as the final assistant message
  if (response?.choices && Array.isArray(response.choices)) {
    const choice = (response.choices as Array<Record<string, unknown>>)[0];
    const respMsg = choice?.message as Record<string, unknown> | undefined;
    if (respMsg) {
      const parts = convertVercelParts(respMsg.content);
      if (parts.length > 0) {
        result.push({
          kind: "message",
          id: nanoid(8),
          role: "assistant",
          created_at: new Date().toISOString(),
          parts,
          meta: {
            model: response.model as string | undefined,
            usage: response.usage
              ? {
                  input_tokens: (response.usage as Record<string, number>)
                    .promptTokens,
                  output_tokens: (response.usage as Record<string, number>)
                    .completionTokens,
                }
              : undefined,
          },
        });
      }
    }
  }

  return result;
}

function convertVercelParts(content: unknown): EchoPart[] {
  const parts: EchoPart[] = [];

  if (typeof content === "string") {
    parts.push({ type: "text", text: content });
    return parts;
  }

  if (!Array.isArray(content)) return parts;

  for (const block of content as Array<Record<string, unknown>>) {
    switch (block.type) {
      case "text":
        parts.push({ type: "text", text: block.text as string });
        break;
      case "tool-call":
        parts.push({
          type: "tool_call",
          id: (block.toolCallId as string) ?? nanoid(8),
          name: (block.toolName as string) ?? "",
          input: block.input ?? block.args ?? {},
        });
        break;
      case "tool-result": {
        // output may be wrapped: { type: "json", value: X } → unwrap to X
        let output: unknown = block.output ?? block.result ?? "";
        if (
          output &&
          typeof output === "object" &&
          (output as Record<string, unknown>).type === "json"
        ) {
          output = (output as Record<string, unknown>).value ?? output;
        }
        parts.push({
          type: "tool_result",
          id: (block.toolCallId as string) ?? "",
          output,
        });
        break;
      }
      case "image":
        parts.push({
          type: "image",
          url: block.url as string | undefined,
          base64: block.base64 as string | undefined,
          media_type: block.mediaType as string | undefined,
        });
        break;
      case "reasoning":
        parts.push({
          type: "thinking",
          text: (block.text as string) ?? "",
        });
        break;
    }
  }

  return parts;
}

/**
 * Parse raw text conversation (User: / Assistant: format).
 */
export function parseRaw(input: string): EchoMessage[] {
  const lines = input.split("\n");
  const messages: EchoMessage[] = [];
  let currentRole: EchoRole = "user";
  let currentContent = "";

  const rolePatterns: Array<[RegExp, EchoRole]> = [
    [/^(System|system)\s*:/i, "system"],
    [/^(User|Human|human|user)\s*:/i, "user"],
    [/^(Assistant|AI|Bot|assistant|ai|bot)\s*:/i, "assistant"],
  ];

  function flush() {
    const text = currentContent.trim();
    if (text) {
      messages.push({
        kind: "message",
        id: nanoid(8),
        role: currentRole,
        created_at: new Date().toISOString(),
        parts: [{ type: "text", text }],
      });
    }
    currentContent = "";
  }

  for (const line of lines) {
    let matched = false;
    for (const [pattern, role] of rolePatterns) {
      const match = line.match(pattern);
      if (match) {
        flush();
        currentRole = role;
        currentContent = line.slice(match[0].length).trim() + "\n";
        matched = true;
        break;
      }
    }
    if (!matched) {
      currentContent += line + "\n";
    }
  }
  flush();

  return messages;
}
