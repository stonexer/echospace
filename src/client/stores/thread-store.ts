import { nanoid } from "nanoid";
import { createStore } from "zustand";
import type {
  EchoConversation,
  EchoMessage,
  EchoPart,
  EchoRole,
  EchoSettings,
} from "~/core/echo/types";
import type { EchoHistoryEvent } from "~/core/history/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedState {
  messages: EchoMessage[];
  settings: EchoSettings;
}

export interface ThreadState {
  // File
  filePath: string | null;
  isDirty: boolean;

  // Conversation
  meta: EchoConversation["meta"] | null;
  messages: EchoMessage[];
  settings: EchoSettings;

  // Streaming
  isStreaming: boolean;
  streamingMessageId: string | null;

  // Timeline
  historyEvents: EchoHistoryEvent[];
  currentEventId: string | null;
  peekingEventId: string | null;
  cachedState: CachedState | null;
}

export interface ThreadActions {
  // File I/O
  loadFile(filePath: string): Promise<void>;
  saveFile(): Promise<void>;
  createNewFile(filename: string): Promise<void>;

  // Messages
  addMessage(role: EchoRole, text?: string): void;
  insertMessageBefore(beforeId: string, role: EchoRole, text?: string): void;
  updateMessage(id: string, parts: EchoPart[]): void;
  updateMessageRole(id: string, role: EchoRole): void;
  removeMessage(id: string): void;
  reorderMessages(fromIndex: number, toIndex: number): void;
  importMessages(messages: EchoMessage[]): void;
  addToolResultMessage(afterMessageId: string, toolCallId: string, toolName: string): void;
  addImageToMessage(messageId: string, base64: string, mediaType: string): void;

  // Settings
  updateSettings(updates: Partial<EchoSettings>): void;

  // Run
  runCompletion(): Promise<void>;
  stopCompletion(): void;

  // Timeline
  peekEvent(id: string): void;
  restoreFromPeek(): void;
  revertToEvent(id: string): void;
  appendHistoryEvent(type: "revision" | "run", summary?: string): void;
}

export type ThreadStore = ThreadState & ThreadActions;

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

let abortController: AbortController | null = null;

export function createThreadStore() {
  return createStore<ThreadStore>((set, get) => ({
    // Initial state
    filePath: null,
    isDirty: false,
    meta: null,
    messages: [],
    settings: {},
    isStreaming: false,
    streamingMessageId: null,
    historyEvents: [],
    currentEventId: null,
    peekingEventId: null,
    cachedState: null,

    // --- File I/O ---

    async loadFile(filePath: string) {
      const filename = filePath.split("/").pop() ?? filePath;
      const res = await fetch(`/api/files/${encodeURIComponent(filename)}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const { conversation } = data;

      // Load history
      const historyRes = await fetch(
        `/api/files/${encodeURIComponent(filename)}/history`,
      );
      const historyData = await historyRes.json();

      set({
        filePath,
        isDirty: false,
        meta: conversation.meta,
        messages: conversation.messages,
        settings: conversation.meta.settings ?? {},
        historyEvents: historyData.events ?? [],
        currentEventId: historyData.events?.length > 0
          ? historyData.events[historyData.events.length - 1].id
          : null,
        peekingEventId: null,
        cachedState: null,
      });
    },

    async saveFile() {
      const { filePath, meta, messages, settings } = get();
      if (!filePath || !meta) return;

      const filename = filePath.split("/").pop() ?? filePath;
      const conversation = {
        meta: { ...meta, settings },
        messages,
      };

      await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });

      set({ isDirty: false });
    },

    async createNewFile(filename: string) {
      const id = nanoid(8);
      const conversation = {
        meta: {
          kind: "meta" as const,
          v: 1 as const,
          id,
          title: filename.replace(/\.echo$/, ""),
          created_at: new Date().toISOString(),
          settings: get().settings,
        },
        messages: [],
      };

      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, conversation }),
      });

      set({
        filePath: filename,
        isDirty: false,
        meta: conversation.meta,
        messages: [],
      });
    },

    // --- Messages ---

    addMessage(role: EchoRole, text = "") {
      const msg: EchoMessage = {
        kind: "message",
        id: nanoid(8),
        role,
        created_at: new Date().toISOString(),
        parts: [{ type: "text", text }],
      };
      set((s) => ({
        messages: [...s.messages, msg],
        isDirty: true,
      }));
      get().appendHistoryEvent("revision", `added ${role} message`);
    },

    insertMessageBefore(beforeId: string, role: EchoRole, text = "") {
      const msg: EchoMessage = {
        kind: "message",
        id: nanoid(8),
        role,
        created_at: new Date().toISOString(),
        parts: [{ type: "text", text }],
      };
      set((s) => {
        const idx = s.messages.findIndex((m) => m.id === beforeId);
        if (idx === -1) return { messages: [...s.messages, msg], isDirty: true };
        const msgs = [...s.messages];
        msgs.splice(idx, 0, msg);
        return { messages: msgs, isDirty: true };
      });
      get().appendHistoryEvent("revision", `inserted ${role} message`);
    },

    addToolResultMessage(afterMessageId: string, toolCallId: string, toolName: string) {
      const msg: EchoMessage = {
        kind: "message",
        id: nanoid(8),
        role: "tool",
        created_at: new Date().toISOString(),
        parts: [{ type: "tool_result", id: toolCallId, output: "" }],
      };
      set((s) => {
        const idx = s.messages.findIndex((m) => m.id === afterMessageId);
        const msgs = [...s.messages];
        msgs.splice(idx + 1, 0, msg);
        return { messages: msgs, isDirty: true };
      });
      get().appendHistoryEvent("revision", `added tool result for ${toolName}`);
    },

    addImageToMessage(messageId: string, base64: string, mediaType: string) {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId
            ? { ...m, parts: [...m.parts, { type: "image" as const, base64, media_type: mediaType }] }
            : m,
        ),
        isDirty: true,
      }));
    },

    updateMessage(id: string, parts: EchoPart[]) {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, parts } : m,
        ),
        isDirty: true,
      }));
      // Debounced history append would go here
    },

    updateMessageRole(id: string, role: EchoRole) {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, role } : m,
        ),
        isDirty: true,
      }));
    },

    removeMessage(id: string) {
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== id),
        isDirty: true,
      }));
      get().appendHistoryEvent("revision", "removed message");
    },

    reorderMessages(fromIndex: number, toIndex: number) {
      set((s) => {
        const msgs = [...s.messages];
        const [moved] = msgs.splice(fromIndex, 1);
        if (moved) msgs.splice(toIndex, 0, moved);
        return { messages: msgs, isDirty: true };
      });
    },

    importMessages(messages: EchoMessage[]) {
      set((s) => ({
        messages: [...s.messages, ...messages],
        isDirty: true,
      }));
      get().appendHistoryEvent("revision", "imported messages");
    },

    // --- Settings ---

    updateSettings(updates: Partial<EchoSettings>) {
      set((s) => ({
        settings: { ...s.settings, ...updates },
        isDirty: true,
      }));
    },

    // --- Run ---

    async runCompletion() {
      const { messages, settings, peekingEventId } = get();
      if (peekingEventId) return; // Don't run while peeking

      const provider = settings.provider;
      if (!provider) {
        throw new Error("No provider selected");
      }

      // Create placeholder assistant message
      const assistantMsg: EchoMessage = {
        kind: "message",
        id: nanoid(8),
        role: "assistant",
        created_at: new Date().toISOString(),
        parts: [],
      };

      set((s) => ({
        messages: [...s.messages, assistantMsg],
        isStreaming: true,
        streamingMessageId: assistantMsg.id,
      }));

      abortController = new AbortController();
      const startTime = Date.now();
      let ttft: number | undefined;

      try {
        const res = await fetch("/api/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, settings, provider }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        const accumulatedParts: EchoPart[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.parts) {
                if (!ttft) ttft = Date.now() - startTime;

                // Merge parts
                for (const part of parsed.parts) {
                  const lastPart = accumulatedParts[accumulatedParts.length - 1];
                  if (
                    lastPart &&
                    lastPart.type === part.type &&
                    (part.type === "text" || part.type === "thinking")
                  ) {
                    // Append to existing text/thinking part
                    (lastPart as { text: string }).text += part.text;
                  } else {
                    accumulatedParts.push({ ...part });
                  }
                }

                // Update the message in state
                set((s) => ({
                  messages: s.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, parts: [...accumulatedParts] }
                      : m,
                  ),
                }));
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Finalize with metadata
        const duration = Date.now() - startTime;
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  meta: {
                    model: settings.model,
                    provider: settings.provider,
                    latency: { duration, ttft },
                  },
                }
              : m,
          ),
          isStreaming: false,
          streamingMessageId: null,
          isDirty: true,
        }));

        get().appendHistoryEvent(
          "run",
          `ran ${settings.model ?? "completion"}`,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User cancelled
        } else {
          // Remove the failed assistant message
          set((s) => ({
            messages: s.messages.filter((m) => m.id !== assistantMsg.id),
          }));
          throw err;
        }
      } finally {
        set({ isStreaming: false, streamingMessageId: null });
        abortController = null;
      }
    },

    stopCompletion() {
      abortController?.abort();
      set({ isStreaming: false, streamingMessageId: null });
    },

    // --- Timeline ---

    peekEvent(id: string) {
      const { messages, settings, peekingEventId, historyEvents } = get();
      if (peekingEventId) return; // Already peeking

      const event = historyEvents.find((e) => e.id === id);
      if (!event) return;

      // Cache current state
      set({
        peekingEventId: id,
        cachedState: { messages: [...messages], settings: { ...settings } },
      });

      // Resolve messages from snapshot
      // Messages are in the same .echo file, referenced by ID
      const snapshotMessages = event.snapshot.message_ids
        .map((mid) => messages.find((m) => m.id === mid))
        .filter((m): m is EchoMessage => m != null);

      set({
        messages: snapshotMessages,
        settings: event.snapshot.settings ?? settings,
      });
    },

    restoreFromPeek() {
      const { cachedState } = get();
      if (!cachedState) return;

      set({
        messages: cachedState.messages,
        settings: cachedState.settings,
        peekingEventId: null,
        cachedState: null,
      });
    },

    revertToEvent(id: string) {
      const { historyEvents } = get();
      const event = historyEvents.find((e) => e.id === id);
      if (!event) return;

      // If peeking, clear peek state
      set({
        peekingEventId: null,
        cachedState: null,
        currentEventId: id,
        isDirty: true,
      });

      // The messages are already set from peek, or we need to resolve them
      const allMessages = get().cachedState?.messages ?? get().messages;
      const snapshotMessages = event.snapshot.message_ids
        .map((mid) => allMessages.find((m) => m.id === mid))
        .filter((m): m is EchoMessage => m != null);

      set({
        messages: snapshotMessages,
        settings: event.snapshot.settings ?? get().settings,
      });

      get().appendHistoryEvent("revision", `reverted to ${id}`);
    },

    appendHistoryEvent(type: "revision" | "run", summary?: string) {
      const { messages, settings, currentEventId, filePath } = get();

      const event: EchoHistoryEvent = {
        kind: "event",
        id: nanoid(8),
        type,
        created_at: new Date().toISOString(),
        snapshot: {
          message_ids: messages.map((m) => m.id),
          settings,
        },
        parent: currentEventId ?? undefined,
        summary,
      };

      set((s) => ({
        historyEvents: [...s.historyEvents, event],
        currentEventId: event.id,
      }));

      // Persist to sidecar (fire-and-forget)
      if (filePath) {
        const filename = filePath.split("/").pop() ?? filePath;
        fetch(`/api/files/${encodeURIComponent(filename)}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }).catch(() => {
          // Ignore persistence errors
        });
      }
    },
  }));
}
