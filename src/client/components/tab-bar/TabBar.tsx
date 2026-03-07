import { useStore } from "zustand";
import { useWorkspaceStore } from "../../lib/store-context";

export function TabBar() {
  const store = useWorkspaceStore();
  const { openTabs, activeFile, setActiveFile, closeTab } = useStore(store);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex h-8 shrink-0 items-end border-b border-border bg-bg-1">
      {openTabs.map((tab) => {
        const isActive = tab === activeFile;
        return (
          <div
            key={tab}
            onClick={() => setActiveFile(tab)}
            className={`group flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-3 text-[12px] transition-colors ${
              isActive
                ? "bg-bg-1-1 text-text-normal"
                : "text-text-desc hover:bg-bg-1-2 hover:text-text-secondary"
            }`}
          >
            <span className="max-w-[120px] truncate">
              {tab.replace(/\.echo$/, "")}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab);
              }}
              className={`flex size-4 items-center justify-center rounded-sm transition-colors hover:bg-bg-4 ${
                isActive
                  ? "text-text-desc"
                  : "text-transparent group-hover:text-text-desc"
              }`}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
