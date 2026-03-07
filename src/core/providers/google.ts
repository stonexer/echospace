import type { EchoMessage, EchoPart, EchoSettings } from "../echo/types";
import type { ProviderAdapter, ProviderConfig } from "./types";

/**
 * Convert EchoMessage to Gemini content format.
 */
function toGeminiContent(msg: EchoMessage): Record<string, unknown> {
  const parts: Array<Record<string, unknown>> = [];

  for (const part of msg.parts) {
    switch (part.type) {
      case "text":
      case "thinking":
        parts.push({ text: part.text });
        break;
      case "tool_call":
        parts.push({
          functionCall: {
            name: part.name,
            args: typeof part.input === "string"
              ? JSON.parse(part.input)
              : part.input,
          },
        });
        break;
      case "tool_result":
        parts.push({
          functionResponse: {
            name: part.id,
            response: { result: part.output },
          },
        });
        break;
      case "image":
        if (part.base64) {
          parts.push({
            inlineData: {
              mimeType: part.media_type ?? "image/png",
              data: part.base64,
            },
          });
        }
        break;
    }
  }

  // Map roles: system → user (handled separately), tool → user
  const role = msg.role === "assistant" ? "model" : "user";

  return { role, parts };
}

export const googleAdapter: ProviderAdapter = {
  type: "google",

  buildRequest(
    messages: EchoMessage[],
    settings: EchoSettings,
    config: ProviderConfig,
  ) {
    const model = settings.model ?? config.models[0];
    const baseUrl =
      config.base_url ??
      "https://generativelanguage.googleapis.com/v1beta";
    const url = `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${config.api_key ?? ""}`;

    // Extract system instruction
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const systemInstruction = systemMessages.length > 0
      ? {
          parts: systemMessages.flatMap((m) =>
            m.parts
              .filter((p) => p.type === "text")
              .map((p) => ({ text: p.text })),
          ),
        }
      : undefined;

    const body: Record<string, unknown> = {
      contents: nonSystemMessages.map(toGeminiContent),
      generationConfig: {
        ...(settings.temperature != null && {
          temperature: settings.temperature,
        }),
        ...(settings.max_tokens != null && {
          maxOutputTokens: settings.max_tokens,
        }),
        ...(settings.top_p != null && { topP: settings.top_p }),
      },
    };

    if (systemInstruction) body.systemInstruction = systemInstruction;

    if (settings.tools && settings.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: settings.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    return { url, headers, body };
  },

  parseChunk(chunk: string): EchoPart[] {
    try {
      const data = JSON.parse(chunk);
      const candidate = data?.candidates?.[0];
      if (!candidate?.content?.parts) return [];

      const parts: EchoPart[] = [];

      for (const part of candidate.content.parts) {
        if (part.text) {
          parts.push({ type: "text", text: part.text });
        }
        if (part.functionCall) {
          parts.push({
            type: "tool_call",
            id: part.functionCall.name ?? "",
            name: part.functionCall.name ?? "",
            input: part.functionCall.args ?? {},
          });
        }
      }

      return parts;
    } catch {
      return [];
    }
  },

  isDone(chunk: string): boolean {
    try {
      const data = JSON.parse(chunk);
      const candidate = data?.candidates?.[0];
      return candidate?.finishReason === "STOP";
    } catch {
      return false;
    }
  },
};
