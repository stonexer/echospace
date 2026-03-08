import { nanoid } from "nanoid";
import type {
  EchoConversation,
  EchoMessage,
  EchoMeta,
  EchoRecord,
} from "./types";

/**
 * Parse an .echo NDJSON string into an EchoConversation.
 */
export function parseEcho(raw: string): EchoConversation {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("Empty .echo file");
  }

  const records = lines.map((line, i) => {
    try {
      return JSON.parse(line) as EchoRecord;
    } catch {
      throw new Error(`Invalid JSON on line ${i + 1}`);
    }
  });

  const metaRecord = records[0];
  if (!metaRecord || metaRecord.kind !== "meta") {
    throw new Error("First line must be a meta record");
  }

  const messages = records
    .filter((r): r is EchoMessage => r.kind === "message")
    .map(normalizeMessage);

  return {
    meta: metaRecord,
    messages,
  };
}

/**
 * Normalize a message to canonical echo format.
 *
 * Handles common deviations from external sources:
 * - Missing `id` → generate one
 * - `ts` / `timestamp` → `created_at`
 * - tool_result `id` / `tool_use_id` → `tool_call_id`
 */
function normalizeMessage(message: EchoMessage): EchoMessage {
  const raw = message as unknown as Record<string, unknown>;
  let msg = message;

  // Ensure message-level id
  if (!msg.id) {
    msg = { ...msg, id: nanoid(8) };
  }

  // Map ts / timestamp → created_at
  if (!msg.created_at && (raw.ts || raw.timestamp)) {
    msg = { ...msg, created_at: (raw.ts ?? raw.timestamp) as string };
  }

  // Normalize tool_result parts: migrate legacy `id` or `tool_use_id` → `tool_call_id`
  const needsPartNormalization = msg.parts.some((p) => {
    if (p.type !== "tool_result") return false;
    const r = p as unknown as Record<string, unknown>;
    return !r.tool_call_id && (r.id || r.tool_use_id);
  });

  if (needsPartNormalization) {
    msg = {
      ...msg,
      parts: msg.parts.map((p) => {
        if (p.type !== "tool_result") return p;
        const r = p as unknown as Record<string, unknown>;
        if (!r.tool_call_id && (r.id || r.tool_use_id)) {
          const { id, tool_use_id, ...rest } = r;
          return { ...rest, tool_call_id: (id ?? tool_use_id) as string } as typeof p;
        }
        return p;
      }),
    };
  }

  return msg;
}

/**
 * Serialize an EchoConversation to NDJSON string.
 */
export function serializeEcho(conversation: EchoConversation): string {
  const records: EchoRecord[] = [conversation.meta, ...conversation.messages];
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

/**
 * Create a new empty conversation.
 */
export function createConversation(
  id: string,
  title?: string,
): EchoConversation {
  return {
    meta: {
      kind: "meta",
      v: 1,
      id,
      title,
      created_at: new Date().toISOString(),
    },
    messages: [],
  };
}

/**
 * Get the text content of a message (concatenated text parts).
 */
export function getMessageText(message: EchoMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Update meta fields immutably.
 */
export function withUpdatedMeta(
  conversation: EchoConversation,
  updates: Partial<Omit<EchoMeta, "kind" | "v">>,
): EchoConversation {
  return {
    ...conversation,
    meta: { ...conversation.meta, ...updates },
  };
}

/**
 * Append messages immutably.
 */
export function withAppendedMessages(
  conversation: EchoConversation,
  messages: EchoMessage[],
): EchoConversation {
  return {
    ...conversation,
    messages: [...conversation.messages, ...messages],
  };
}

/**
 * Update a message by ID immutably.
 */
export function withUpdatedMessage(
  conversation: EchoConversation,
  messageId: string,
  updates: Partial<Omit<EchoMessage, "kind" | "id">>,
): EchoConversation {
  return {
    ...conversation,
    messages: conversation.messages.map((m) =>
      m.id === messageId ? { ...m, ...updates } : m,
    ),
  };
}

/**
 * Remove a message by ID immutably.
 */
export function withRemovedMessage(
  conversation: EchoConversation,
  messageId: string,
): EchoConversation {
  return {
    ...conversation,
    messages: conversation.messages.filter((m) => m.id !== messageId),
  };
}
