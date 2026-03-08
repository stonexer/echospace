import { createContext, useContext } from "react";
import type { StoreApi } from "zustand";
import type { ThreadStore } from "../stores/thread-store";
import type { WorkspaceStore } from "../stores/workspace-store";
import type { PluginStore } from "../stores/plugin-store";

interface StoreContextValue {
  workspaceStore: StoreApi<WorkspaceStore>;
  threadStore: StoreApi<ThreadStore>;
  pluginStore: StoreApi<PluginStore>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStores() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreContext not found");
  return ctx;
}

export function useThreadStore() {
  return useStores().threadStore;
}

export function useWorkspaceStore() {
  return useStores().workspaceStore;
}

export function usePluginStore() {
  return useStores().pluginStore;
}
