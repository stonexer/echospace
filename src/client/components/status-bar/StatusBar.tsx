import { useState } from "react";
import { useStore } from "zustand";
import { useThreadStore, useWorkspaceStore } from "../../lib/store-context";
import { SettingsPanel } from "../settings/SettingsPanel";

export function StatusBar() {
  const threadStore = useThreadStore();
  const workspaceStore = useWorkspaceStore();
  const activeFile = useStore(workspaceStore, (s) => s.activeFile);
  const { settings, messages, isDirty, isStreaming } = useStore(threadStore);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <span className="font-mono">
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
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            title="Settings"
            className="flex size-4 items-center justify-center rounded-sm text-text-desc transition-colors hover:text-text-secondary"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
              <circle cx="6" cy="6" r="2" />
              <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.3 2.3l1 1M8.7 8.7l1 1M9.7 2.3l-1 1M3.3 8.7l-1 1" />
            </svg>
          </button>
          {settingsOpen && (
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
}
