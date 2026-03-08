import type { EchoRendererPlugin, RendererOutput } from "./types";
import type { EchoMessage } from "../echo/types";

// Matches ```html ... ``` code blocks (greedy — captures the largest block)
const CODE_BLOCK_RE = /```html\s*\n([\s\S]*?)```/i;

// Fallback: detect raw HTML without code block wrapper
const RAW_HTML_PATTERN =
  /<(!DOCTYPE|html|head|body)\b/i;

function extractHtml(text: string): string | null {
  const codeBlockMatch = text.match(CODE_BLOCK_RE);
  if (codeBlockMatch) return codeBlockMatch[1]!.trim();

  // JSON wrapper: { "html": "<!DOCTYPE..." } or similar
  // Must check BEFORE raw HTML pattern, because the JSON value itself
  // contains HTML tags that would match the raw pattern.
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const html = parsed.html ?? parsed.HTML ?? parsed.content;
      if (typeof html === "string" && RAW_HTML_PATTERN.test(html)) {
        return html;
      }
    } catch {
      // Not valid JSON
    }
  }

  if (RAW_HTML_PATTERN.test(text)) return text;

  return null;
}

export const htmlRendererPlugin: EchoRendererPlugin = {
  name: "HTML Renderer",
  version: "1.0.0",

  match(message: EchoMessage): boolean {
    const text = message.parts.find((p) => p.type === "text")?.text ?? "";
    return extractHtml(text) !== null;
  },

  render(message: EchoMessage): RendererOutput {
    const text = message.parts.find((p) => p.type === "text")?.text ?? "";
    const html = extractHtml(text);
    if (!html) return { type: "passthrough" };
    return { type: "html", html };
  },
};
