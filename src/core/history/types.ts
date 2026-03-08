import type { EchoSettings } from "../echo/types";

/**
 * History event — stored in .echo-history sidecar files.
 *
 * Each event is a snapshot of the conversation state at a point in time.
 * Events form a linked list via the `parent` field.
 */
export interface EchoHistoryEvent {
  kind: "event";
  id: string;
  type: "revision" | "run";
  created_at: string;
  snapshot: {
    /** Ordered message IDs referencing messages in the .echo file */
    message_ids: string[];
    /** Settings at this point (if changed) */
    settings?: EchoSettings;
  };
  /** Previous event ID (linked list) */
  parent?: string;
  /** Human-readable summary, e.g. "edited system prompt", "ran gpt-4o" */
  summary?: string;
  /** User-highlighted milestone */
  highlighted?: boolean;
}

/**
 * Parsed history (in-memory representation).
 */
export interface EchoHistory {
  events: EchoHistoryEvent[];
  /** Map for O(1) lookup by event ID */
  eventMap: Map<string, EchoHistoryEvent>;
}
