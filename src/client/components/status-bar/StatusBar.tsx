import { useStore } from "zustand";
import { useThreadStore, useWorkspaceStore } from "../../lib/store-context";

export function StatusBar() {
  const threadStore = useThreadStore();
  const workspaceStore = useWorkspaceStore();
  const activeFile = useStore(workspaceStore, (s) => s.activeFile);
  const { settings, messages, isDirty, isStreaming } = useStore(threadStore);

  const messageCount = messages.filter((m) => m.role !== "system").length;

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
          <span>
            {messageCount} message{messageCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {settings.model && (
          <span>{settings.model}</span>
        )}
        {isStreaming && (
          <span className="text-primary">streaming...</span>
        )}
      </div>
    </div>
  );
}
