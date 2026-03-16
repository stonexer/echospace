import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useThreadStore } from '../../lib/store-context';
import { ConfigPanel } from '../config-panel/ConfigPanel';
import { MessageList } from './MessageList';
import { toast } from 'sonner';

const AUTO_SAVE_DELAY = 600;

export function ThreadEditor() {
  const store = useThreadStore();

  // Fine-grained selectors — only re-render when the specific field changes
  const messages = useStore(store, (s) => s.messages);
  const isStreaming = useStore(store, (s) => s.isStreaming);
  const peekingEventId = useStore(store, (s) => s.peekingEventId);
  const historyEvents = useStore(store, (s) => s.historyEvents);
  const currentEventId = useStore(store, (s) => s.currentEventId);
  const isDirty = useStore(store, (s) => s.isDirty);
  const filePath = useStore(store, (s) => s.filePath);
  const settings = useStore(store, (s) => s.settings);

  // Actions (stable references from zustand)
  const runCompletion = useStore(store, (s) => s.runCompletion);
  const stopCompletion = useStore(store, (s) => s.stopCompletion);
  const saveFile = useStore(store, (s) => s.saveFile);
  const peekEvent = useStore(store, (s) => s.peekEvent);
  const restoreFromPeek = useStore(store, (s) => s.restoreFromPeek);
  const revertToEvent = useStore(store, (s) => s.revertToEvent);
  const toggleHighlight = useStore(store, (s) => s.toggleHighlight);

  // Auto-scroll timeline to latest event
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
    }
  }, [historyEvents.length, currentEventId]);

  // Auto-save when dirty
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || !filePath) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      saveFile().catch(() => {});
    }, AUTO_SAVE_DELAY);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [isDirty, filePath, messages, settings, saveFile]);

  const isReadonly = peekingEventId != null;
  const systemMessage = useMemo(
    () => messages.find((m) => m.role === 'system'),
    [messages],
  );
  const chatMessages = useMemo(
    () => messages.filter((m) => m.role !== 'system'),
    [messages],
  );

  const handleRun = useCallback(async () => {
    try {
      await runCompletion();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [runCompletion]);

  const handleToggleHighlight = useCallback(() => {
    if (currentEventId) toggleHighlight(currentEventId);
  }, [currentEventId, toggleHighlight]);

  const currentEventHighlighted = useMemo(
    () => historyEvents.find((e) => e.id === currentEventId)?.highlighted,
    [historyEvents, currentEventId],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar: Timeline left, actions right */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        {/* Timeline dots */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-serif text-[11px] text-text-desc">
            Timeline
          </span>
          <div
            ref={timelineRef}
            className="flex max-w-[240px] items-center overflow-x-auto scrollbar-none"
            onMouseLeave={() => restoreFromPeek()}
          >
            {historyEvents.map((event) => {
              const isCurrent = event.id === currentEventId;
              const isPeeking = event.id === peekingEventId;
              const isRun = event.type === 'run';
              const isHighlighted = event.highlighted;
              return (
                <button
                  key={event.id}
                  onClick={() => revertToEvent(event.id)}
                  onMouseEnter={() => peekEvent(event.id)}
                  title={event.summary ?? `${event.type} — ${event.created_at}`}
                  className="group flex shrink-0 items-center justify-center p-[3px]"
                >
                  <span className={`block shrink-0 rounded-full transition-all ${
                    isCurrent
                      ? 'size-[11px] bg-primary'
                      : isPeeking
                        ? 'size-[10px] bg-primary/50'
                        : isHighlighted
                          ? 'size-[11px] bg-amber-500 group-hover:bg-amber-400'
                          : isRun
                            ? 'size-[9px] bg-[var(--success)]/60 group-hover:bg-[var(--success)]'
                            : 'size-[9px] bg-bg-5 group-hover:bg-text-desc'
                  }`} />
                </button>
              );
            })}
          </div>
          {peekingEventId && (
            <span className="shrink-0 text-[11px] italic text-text-desc">
              previewing
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {currentEventId && (
            <button
              onClick={handleToggleHighlight}
              title="Highlight current version"
              className={`flex h-7 items-center justify-center gap-1 rounded px-2 text-[12px] font-medium transition-colors ${
                currentEventHighlighted
                  ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25'
                  : 'bg-bg-3 text-text-desc hover:bg-bg-4 hover:text-text-secondary'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 0.5l1.3 2.9 3.2.5-2.3 2.2.5 3.2L5 7.6 2.3 9.3l.5-3.2L.5 3.9l3.2-.5z" />
              </svg>
              Star
            </button>
          )}
          {isStreaming ? (
            <button
              onClick={stopCompletion}
              className="flex h-7 w-20 items-center justify-center gap-1.5 rounded bg-destructive text-[12px] font-medium text-white transition-colors hover:bg-destructive/90"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="currentColor"
              >
                <rect x="2" y="2" width="6" height="6" rx="1" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!settings.provider || !settings.model}
              className="flex h-7 w-20 items-center justify-center gap-1.5 rounded bg-primary text-[12px] font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-30"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="currentColor"
              >
                <path d="M2.5 1.5l6 3.5-6 3.5V1.5z" />
              </svg>
              Run
            </button>
          )}
        </div>
      </header>

      {/* Two-panel layout: config left, messages right */}
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={42} minSize={28} maxSize={55}>
          <ConfigPanel systemMessage={systemMessage} isReadonly={isReadonly} />
        </Panel>

        <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/40 active:bg-primary/60" />

        <Panel defaultSize={58} minSize={35}>
          <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden bg-bg-1-1">
            <MessageList
              messages={chatMessages}
              isReadonly={isReadonly}
              isStreaming={isStreaming}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
