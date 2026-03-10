import { useMemo } from "react";
import { useStore } from "zustand";
import { useThreadStore, useWorkspaceStore } from "../../lib/store-context";

export function StatusBar() {
  const threadStore = useThreadStore();
  const workspaceStore = useWorkspaceStore();
  const activeFile = useStore(workspaceStore, (s) => s.activeFile);
  const model = useStore(threadStore, (s) => s.settings.model);
  const messages = useStore(threadStore, (s) => s.messages);
  const isDirty = useStore(threadStore, (s) => s.isDirty);
  const isStreaming = useStore(threadStore, (s) => s.isStreaming);

  const messageCount = useMemo(
    () => messages.filter((m) => m.role !== "system").length,
    [messages],
  );

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-bg-1 px-3 text-[11px] text-text-desc">
      <div className="flex items-center gap-3">
        {activeFile && (
          <span className="text-text-secondary">
            {activeFile}
            {isDirty && <span className="ml-1 text-primary">*</span>}
          </span>
        )}
        {activeFile && (
          <span className="font-mono">
            {messageCount} message{messageCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {model && (
          <span>{model}</span>
        )}
        {isStreaming && (
          <span className="text-primary">streaming...</span>
        )}
      </div>
    </div>
  );
}
