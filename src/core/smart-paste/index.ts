import { parseEcho } from "../echo";
import type { EchoMessage } from "../echo/types";
import { detectFormat, type DetectedFormat } from "./detector";
import {
  parseAnthropic,
  parseGoogle,
  parseOpenAI,
  parseRaw,
  parseVercel,
} from "./parsers";

export { detectFormat, type DetectedFormat };

/**
 * Smart-parse any pasted conversation text into EchoMessages.
 * Auto-detects the format and converts accordingly.
 */
export function smartParse(input: string): EchoMessage[] {
  const format = detectFormat(input);

  switch (format) {
    case "openai":
      return parseOpenAI(input);
    case "anthropic":
      return parseAnthropic(input);
    case "google":
      return parseGoogle(input);
    case "vercel":
      return parseVercel(input);
    case "echo": {
      const conversation = parseEcho(input);
      return conversation.messages;
    }
    case "raw":
      return parseRaw(input);
    case "unknown":
      // Treat as a single user message
      return [
        {
          kind: "message",
          id: crypto.randomUUID().slice(0, 8),
          role: "user",
          created_at: new Date().toISOString(),
          parts: [{ type: "text", text: input.trim() }],
        },
      ];
  }
}
