import { describe, expect, it } from "vitest";
import {
  createConversation,
  parseEcho,
  serializeEcho,
} from "~/core/echo";
import { smartParse } from "~/core/smart-paste";
import { createProviderRegistry } from "~/core/providers";

describe("echo core", () => {
  it("round-trips createConversation → serializeEcho → parseEcho", () => {
    const conv = createConversation("test-1", "My Test");
    const serialized = serializeEcho(conv);
    const parsed = parseEcho(serialized);

    expect(parsed.meta.id).toBe("test-1");
    expect(parsed.meta.title).toBe("My Test");
    expect(parsed.messages).toEqual([]);
  });
});

describe("smart-paste", () => {
  it("parses raw text as a single user message", () => {
    const messages = smartParse("Hello world");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].parts[0].type).toBe("text");
  });

  it("parses OpenAI JSON array", () => {
    const input = JSON.stringify([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
    const messages = smartParse(input);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });
});

describe("provider registry", () => {
  it("has openai, anthropic, and google adapters", () => {
    const registry = createProviderRegistry();
    expect(registry.get("openai")).toBeDefined();
    expect(registry.get("anthropic")).toBeDefined();
    expect(registry.get("google")).toBeDefined();
  });
});
