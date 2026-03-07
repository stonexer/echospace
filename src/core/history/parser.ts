import type { EchoHistory, EchoHistoryEvent } from "./types";

/**
 * Parse an .echo-history NDJSON string into an EchoHistory.
 */
export function parseHistory(raw: string): EchoHistory {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);

  const events = lines.map((line, i) => {
    try {
      return JSON.parse(line) as EchoHistoryEvent;
    } catch {
      throw new Error(`Invalid JSON in history on line ${i + 1}`);
    }
  });

  return {
    events,
    eventMap: new Map(events.map((e) => [e.id, e])),
  };
}

/**
 * Serialize history events to NDJSON string.
 */
export function serializeHistory(history: EchoHistory): string {
  return history.events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

/**
 * Append a single event to NDJSON (for append-only writes).
 */
export function serializeEvent(event: EchoHistoryEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Walk the event chain from a given event back to the root.
 * Returns events in chronological order (oldest first).
 */
export function getEventChain(
  history: EchoHistory,
  fromEventId: string,
): EchoHistoryEvent[] {
  const chain: EchoHistoryEvent[] = [];
  let cursor = history.eventMap.get(fromEventId);

  while (cursor) {
    chain.push(cursor);
    cursor = cursor.parent
      ? history.eventMap.get(cursor.parent)
      : undefined;
  }

  return chain.reverse();
}

/**
 * Get the latest event (the one with no children pointing to it as parent).
 * In practice, this is the last event in the array since we append-only.
 */
export function getLatestEvent(
  history: EchoHistory,
): EchoHistoryEvent | undefined {
  return history.events[history.events.length - 1];
}
