import { createStore } from "zustand";

export interface FileEntry {
  name: string;
  path: string;
  modified_at: string;
  size: number;
}

export interface WorkspaceState {
  files: FileEntry[];
  activeFile: string | null;
  openTabs: string[];
  isLoading: boolean;
}

export interface WorkspaceActions {
  loadFiles(): Promise<void>;
  setActiveFile(path: string | null): void;
  openTab(path: string): void;
  closeTab(path: string): void;
  createFile(filename: string): Promise<void>;
  deleteFile(filename: string): Promise<void>;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

export function createWorkspaceStore() {
  return createStore<WorkspaceStore>((set, get) => ({
    files: [],
    activeFile: null,
    openTabs: [],
    isLoading: false,

    async loadFiles() {
      set({ isLoading: true });
      try {
        const res = await fetch("/api/files");
        const data = await res.json();
        set({ files: data.files ?? [], isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    setActiveFile(path: string | null) {
      if (path && !get().openTabs.includes(path)) {
        set({ openTabs: [...get().openTabs, path] });
      }
      set({ activeFile: path });
    },

    openTab(path: string) {
      if (!get().openTabs.includes(path)) {
        set({ openTabs: [...get().openTabs, path] });
      }
      set({ activeFile: path });
    },

    closeTab(path: string) {
      const { openTabs, activeFile } = get();
      const newTabs = openTabs.filter((t) => t !== path);
      const newActive =
        activeFile === path
          ? newTabs[Math.min(openTabs.indexOf(path), newTabs.length - 1)] ?? null
          : activeFile;
      set({ openTabs: newTabs, activeFile: newActive });
    },

    async createFile(filename: string) {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          conversation: {
            meta: {
              kind: "meta",
              v: 1,
              id: crypto.randomUUID().slice(0, 8),
              title: filename.replace(/\.echo$/, ""),
              created_at: new Date().toISOString(),
            },
            messages: [],
          },
        }),
      });

      if (res.ok) {
        await get().loadFiles();
        set({ activeFile: filename });
      }
    },

    async deleteFile(filename: string) {
      await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const { activeFile } = get();
      if (activeFile === filename) {
        set({ activeFile: null });
      }
      await get().loadFiles();
    },
  }));
}
