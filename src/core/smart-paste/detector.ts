export type DetectedFormat =
  | "openai"
  | "anthropic"
  | "google"
  | "echo"
  | "raw"
  | "unknown";

/**
 * Detect the format of pasted conversation text.
 */
export function detectFormat(input: string): DetectedFormat {
  const trimmed = input.trim();

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(trimmed);

    // Array of messages with role + content → OpenAI format
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && parsed[0].role && "content" in parsed[0]) {
        return "openai";
      }
    }

    // Object with messages array → OpenAI ChatCompletion request
    if (parsed.messages && Array.isArray(parsed.messages)) {
      return "openai";
    }

    // Anthropic: object with content array containing type blocks
    if (parsed.content && Array.isArray(parsed.content)) {
      if (parsed.content[0]?.type === "text") {
        return "anthropic";
      }
    }

    // Anthropic: array with content blocks
    if (Array.isArray(parsed) && parsed[0]?.content?.[0]?.type === "text") {
      return "anthropic";
    }

    // Google Gemini: has contents array with parts
    if (parsed.contents && Array.isArray(parsed.contents)) {
      if (parsed.contents[0]?.parts) {
        return "google";
      }
    }

    return "unknown";
  } catch {
    // Not valid JSON — check for NDJSON or raw text
  }

  // Check for .echo NDJSON format
  const firstLine = trimmed.split("\n")[0]?.trim() ?? "";
  try {
    const first = JSON.parse(firstLine);
    if (first.kind === "meta" || first.kind === "message") {
      return "echo";
    }
  } catch {
    // Not NDJSON
  }

  // Check for raw conversation patterns
  if (
    /^(User|Human|System|Assistant):/im.test(trimmed) ||
    /^(###\s*)?(User|Human|System|Assistant)/im.test(trimmed)
  ) {
    return "raw";
  }

  return "unknown";
}
