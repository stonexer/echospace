import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useThreadStore } from '../../lib/store-context';
import { ConfigPanel } from '../config-panel/ConfigPanel';
import { MessageList } from './MessageList';
import { toast } from 'sonner';

const AUTO_SAVE_DELAY = 600;

export function ThreadEditor() {
  const store = useThreadStore();
  const {
    messages,
    isStreaming,
    peekingEventId,
    historyEvents,
    currentEventId,
    runCompletion,
    stopCompletion,
    saveFile,
    isDirty,
    filePath,
    settings,
    peekEvent,
    restoreFromPeek,
    revertToEvent
  } = useStore(store);

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
  const systemMessage = messages.find((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');

  const handleRun = useCallback(async () => {
    try {
      await runCompletion();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [runCompletion]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar: Timeline left, actions right */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        {/* Timeline dots (or fallback label) */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {historyEvents.length > 0 ? (
            <>
              <span className="shrink-0 font-serif text-[11px] italic text-text-desc">
                Timeline
              </span>
              <div ref={timelineRef} className="flex min-w-0 flex-1 flex-wrap items-center gap-[3px]">
                {historyEvents.map((event) => {
                  const isCurrent = event.id === currentEventId;
                  const isPeeking = event.id === peekingEventId;
                  const isRun = event.type === 'run';
                  return (
                    <button
                      key={event.id}
                      onClick={() => revertToEvent(event.id)}
                      onMouseEnter={() => peekEvent(event.id)}
                      onMouseLeave={() => restoreFromPeek()}
                      title={
                        event.summary ?? `${event.type} — ${event.created_at}`
                      }
                      className={`size-[7px] shrink-0 rounded-full transition-all ${
                        isCurrent
                          ? 'bg-text-normal scale-[1.4]'
                          : isPeeking
                            ? 'bg-primary scale-[1.6]'
                            : isRun
                              ? 'bg-[#5a7e45]/60 hover:bg-[#5a7e45]'
                              : 'bg-bg-5 hover:bg-text-desc'
                      }`}
                    />
                  );
                })}
              </div>
              {peekingEventId && (
                <span className="shrink-0 text-[11px] italic text-text-desc">
                  previewing
                </span>
              )}
            </>
          ) : (
            <span className="font-serif text-[11px] italic text-text-desc">
              Playground
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
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
