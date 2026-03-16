import { useMemo, useCallback, memo } from "react";
import { useStore } from "zustand";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useThreadStore } from "../../lib/store-context";
import { MessageEditor, isHiddenToolMessage } from "./MessageEditor";
import type { EchoMessage } from "~/core/echo/types";

interface MessageListProps {
  messages: EchoMessage[];
  isReadonly: boolean;
  isStreaming: boolean;
}

/** Pre-compute tool result mappings for an assistant message */
function computeToolResultMessages(
  msg: EchoMessage,
  allMessages: EchoMessage[],
  msgIndex: number,
): Map<string, { msg: EchoMessage; partIndex: number }> | null {
  const toolCalls = msg.parts.filter((p) => p.type === "tool_call");
  if (msg.role !== "assistant" || toolCalls.length === 0) return null;

  const results = new Map<string, { msg: EchoMessage; partIndex: number }>();
  for (let i = msgIndex + 1; i < allMessages.length; i++) {
    const m = allMessages[i];
    if (m.role !== "tool") break;
    for (let pi = 0; pi < m.parts.length; pi++) {
      const p = m.parts[pi];
      if (p.type === "tool_result" && p.tool_call_id) {
        results.set(p.tool_call_id, { msg: m, partIndex: pi });
      }
    }
  }
  return results;
}

export function MessageList({
  messages,
  isReadonly,
  isStreaming,
}: MessageListProps) {
  const store = useThreadStore();
  const addMessage = useStore(store, (s) => s.addMessage);
  const insertMessageBefore = useStore(store, (s) => s.insertMessageBefore);
  const reorderMessages = useStore(store, (s) => s.reorderMessages);
  const streamingMessageId = useStore(store, (s) => s.streamingMessageId);

  // Pre-compute all derived data in a single pass
  const precomputed = useMemo(() => {
    const items: {
      msg: EchoMessage;
      originalIndex: number;
      cumulativeTokens: number;
      toolResultMessages: Map<string, { msg: EchoMessage; partIndex: number }> | null;
      isHidden: boolean;
    }[] = [];

    let runningTokens = 0;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;

      // Accumulate token estimate
      const charCount = msg.parts
        .filter((p) => p.type === "text" || p.type === "thinking")
        .reduce((sum, p) => sum + (p as { text: string }).text.length, 0);
      runningTokens += Math.ceil(charCount / 4);

      const hidden = isHiddenToolMessage(msg, messages);

      if (!hidden) {
        items.push({
          msg,
          originalIndex: i,
          cumulativeTokens: runningTokens,
          toolResultMessages: computeToolResultMessages(msg, messages, i),
          isHidden: hidden,
        });
      }
    }

    return items;
  }, [messages]);

  const isDragDisabled = isReadonly || isStreaming;

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const fromVisible = result.source.index;
    const toVisible = result.destination.index;
    if (fromVisible === toVisible) return;
    const fromOriginal = precomputed[fromVisible]!.originalIndex;
    const toOriginal = precomputed[toVisible]!.originalIndex;
    reorderMessages(fromOriginal, toOriginal);
  }, [precomputed, reorderMessages]);

  const handleAddMessage = useCallback(() => addMessage("user"), [addMessage]);

  return (
    <div className="min-w-0 flex-1 px-4 py-3">
      {/* Section label */}
      <div className="mb-2 flex items-center gap-2">
        <span className="font-serif text-[11px] text-text-desc">
          Messages
        </span>
        <span className="font-mono text-[11px] text-text-placeholder">
          {messages.length}
        </span>
      </div>

      {/* Message cards with insertion lines */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="message-list">
          {(provided) => (
            <div
              className="flex flex-col gap-3"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {precomputed.map(({ msg, originalIndex, cumulativeTokens, toolResultMessages }, visibleIndex) => (
                <Draggable
                  key={msg.id}
                  draggableId={msg.id}
                  index={visibleIndex}
                  isDragDisabled={isDragDisabled}
                >
                  {(draggableProvided, snapshot) => (
                    <div
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                      className="relative"
                      style={{
                        ...draggableProvided.draggableProps.style,
                        ...(snapshot.isDropAnimating ? { transitionDuration: '0.001s' } : {}),
                      }}
                    >
                      {/* Insertion line before each message */}
                      {!isReadonly && !isStreaming && (
                        <MemoInsertionLine
                          messageId={msg.id}
                          insertMessageBefore={insertMessageBefore}
                        />
                      )}
                      <MessageEditor
                        message={msg}
                        index={originalIndex}
                        cumulativeTokens={cumulativeTokens}
                        toolResultMessages={toolResultMessages}
                        isReadonly={isReadonly || isStreaming}
                        isStreaming={isStreaming && msg.id === streamingMessageId}
                        dragHandleProps={draggableProvided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add message button */}
      {!isReadonly && !isStreaming && (
        <button
          onClick={handleAddMessage}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-border py-2 text-[12px] text-text-desc transition-colors hover:border-bg-5 hover:text-text-secondary"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Add message
        </button>
      )}
    </div>
  );
}

/* --- Insertion line between messages --- */

const MemoInsertionLine = memo(function InsertionLine({
  messageId,
  insertMessageBefore,
}: {
  messageId: string;
  insertMessageBefore: (beforeId: string, role: "user") => void;
}) {
  const handleClick = useCallback(
    () => insertMessageBefore(messageId, "user"),
    [messageId, insertMessageBefore],
  );

  return (
    <div className="absolute -top-3 left-0 z-10 h-3 w-full opacity-0 transition-opacity hover:opacity-100">
      <div className="absolute inset-0 flex items-center">
        <div className="h-px w-full border-t border-dashed border-border" />
        <button
          onClick={handleClick}
          title="Insert new message here"
          className="absolute right-2 z-10 flex size-5 items-center justify-center rounded-full border border-border bg-bg-1 text-text-desc shadow-sm transition-colors hover:bg-bg-2 hover:text-text-secondary"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
});
