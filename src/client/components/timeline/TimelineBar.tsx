import { useStore } from "zustand";
import { useThreadStore } from "../../lib/store-context";
import type { EchoHistoryEvent } from "~/core/history/types";

interface TimelineBarProps {
  events: EchoHistoryEvent[];
  currentEventId: string | null;
  peekingEventId: string | null;
}

export function TimelineBar({
  events,
  currentEventId,
  peekingEventId,
}: TimelineBarProps) {
  const store = useThreadStore();
  const peekEvent = useStore(store, (s) => s.peekEvent);
  const restoreFromPeek = useStore(store, (s) => s.restoreFromPeek);
  const revertToEvent = useStore(store, (s) => s.revertToEvent);

  return (
    <div className="flex items-center gap-2 border-t border-border bg-bg-1 px-4 py-1.5">
      <span className="shrink-0 font-serif text-[11px] text-text-desc">
        Timeline
      </span>

      {/* Dots */}
      <div className="flex items-center gap-[3px]">
        {events.map((event) => {
          const isCurrent = event.id === currentEventId;
          const isPeeking = event.id === peekingEventId;
          const isRun = event.type === "run";

          return (
            <button
              key={event.id}
              onClick={() => revertToEvent(event.id)}
              onMouseEnter={() => peekEvent(event.id)}
              onMouseLeave={() => restoreFromPeek()}
              title={event.summary ?? `${event.type} — ${event.created_at}`}
              className={`size-[7px] shrink-0 rounded-full transition-all ${
                isCurrent
                  ? "bg-primary scale-[1.4]"
                  : isPeeking
                    ? "bg-text-normal scale-[1.6]"
                    : isRun
                      ? "bg-[var(--success)]/60 hover:bg-[var(--success)]"
                      : "bg-bg-5 hover:bg-text-desc"
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
    </div>
  );
}
