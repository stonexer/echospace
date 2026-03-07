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

  const messages = records.filter(
    (r): r is EchoMessage => r.kind === "message",
  );

  return {
    meta: metaRecord,
    messages,
  };
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
