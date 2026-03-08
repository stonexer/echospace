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

export function MessageList({
  messages,
  isReadonly,
  isStreaming,
}: MessageListProps) {
  const store = useThreadStore();
  const { addMessage, insertMessageBefore, reorderMessages, streamingMessageId } = useStore(store);

  // Build visible items with mapping back to original indices
  const visibleItems: { msg: EchoMessage; originalIndex: number }[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (!isHiddenToolMessage(messages[i]!, messages)) {
      visibleItems.push({ msg: messages[i]!, originalIndex: i });
    }
  }

  const isDragDisabled = isReadonly || isStreaming;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const fromVisible = result.source.index;
    const toVisible = result.destination.index;
    if (fromVisible === toVisible) return;
    const fromOriginal = visibleItems[fromVisible]!.originalIndex;
    const toOriginal = visibleItems[toVisible]!.originalIndex;
    reorderMessages(fromOriginal, toOriginal);
  };

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
              {visibleItems.map(({ msg, originalIndex }, visibleIndex) => (
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
                        <InsertionLine
                          onInsertBefore={() => insertMessageBefore(msg.id, "user")}
                        />
                      )}
                      <MessageEditor
                        message={msg}
                        index={originalIndex}
                        allMessages={messages}
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
          onClick={() => addMessage("user")}
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

function InsertionLine({ onInsertBefore }: { onInsertBefore: () => void }) {
  return (
    <div className="absolute -top-3 left-0 z-10 h-3 w-full opacity-0 transition-opacity hover:opacity-100">
      <div className="absolute inset-0 flex items-center">
        <div className="h-px w-full border-t border-dashed border-border" />
        <button
          onClick={onInsertBefore}
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
}
