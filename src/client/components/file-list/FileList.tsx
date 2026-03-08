import { useState } from "react";
import type { FileEntry } from "../../stores/workspace-store";

interface FileListProps {
  files: FileEntry[];
  activeFile: string | null;
  onSelect: (path: string) => void;
  onCreate: (filename: string) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
  isLoading: boolean;
}

export function FileList({
  files,
  activeFile,
  onSelect,
  onCreate,
  onDelete,
  isLoading,
}: FileListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const filename = newName.trim();
    if (!filename) return;
    const name = filename.endsWith(".echo") ? filename : `${filename}.echo`;
    await onCreate(name);
    setNewName("");
    setIsCreating(false);
  };

  return (
    <aside className="flex w-full shrink-0 flex-col bg-bg-1">
      {/* Section header */}
      <div className="flex h-9 items-center justify-between px-3">
        <span className="font-serif text-[11px] text-text-desc">
          Explorer
        </span>
        <button
          onClick={() => setIsCreating(true)}
          className="flex size-5 items-center justify-center rounded text-text-desc transition-colors hover:bg-bg-4 hover:text-text-secondary"
          title="New file"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-1">
        {isCreating && (
          <div className="px-2 py-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewName("");
                }
              }}
              onBlur={() => {
                if (!newName.trim()) {
                  setIsCreating(false);
                  setNewName("");
                }
              }}
              placeholder="filename.echo"
              className="w-full rounded-sm border border-primary bg-bg-2 px-2 py-[3px] text-[12px] text-text-normal outline-none placeholder:text-text-placeholder"
              autoFocus
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-text-desc">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="131 131 250 250"
              width="16"
              height="16"
            >
              <style>{`
                @keyframes es-spin-cw {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                @keyframes es-spin-ccw {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(-360deg); }
                }
                .es-loading-outer {
                  transform-origin: 256px 256px;
                  animation: es-spin-cw 4s linear infinite;
                }
                .es-loading-inner {
                  transform-origin: 256px 256px;
                  animation: es-spin-ccw 3s linear infinite;
                }
              `}</style>
              <g className="es-loading-outer">
                <rect x="139.3" y="139.3" width="233.3" height="233.3" rx="36.7" ry="36.7" fill="#BB4B03" />
                <rect x="168" y="168" width="176" height="176" rx="25" ry="25" fill="#F2E2C1" />
              </g>
              <g className="es-loading-inner">
                <rect x="198" y="198" width="116" height="116" rx="18.3" ry="18.3" fill="#BB4B03" />
                <rect x="226.3" y="226.3" width="59.3" height="59.3" rx="9.3" ry="9.3" fill="#F2E2C1" />
              </g>
            </svg>
            Loading...
          </div>
        ) : files.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-text-desc">
            No .echo files
          </div>
        ) : (
          files.map((file) => (
            <button
              key={file.name}
              onClick={() => onSelect(file.name)}
              className={`group flex w-full items-center justify-between rounded-sm px-2 py-[5px] text-left text-[12px] transition-colors ${
                activeFile === file.name
                  ? "bg-primary/15 text-text-normal"
                  : "text-text-secondary hover:bg-bg-1-2"
              }`}
            >
              <span className="truncate">{file.name.replace(/\.echo$/, "")}</span>
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.name);
                }}
                className="hidden shrink-0 pl-1 text-text-desc transition-colors hover:text-destructive group-hover:block"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
