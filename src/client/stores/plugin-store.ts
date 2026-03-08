import { createStore } from "zustand";
import type { EchoRendererPlugin } from "~/core/plugins/types";

export interface PluginEntry {
  plugin: EchoRendererPlugin;
  enabled: boolean;
}

export interface PluginState {
  plugins: PluginEntry[];
}

export interface PluginActions {
  registerPlugin(plugin: EchoRendererPlugin): void;
  setEnabled(name: string, enabled: boolean): void;
  getEnabledPlugins(): EchoRendererPlugin[];
}

export type PluginStore = PluginState & PluginActions;

export function createPluginStore() {
  return createStore<PluginStore>((set, get) => ({
    plugins: [],

    registerPlugin(plugin) {
      set((s) => {
        if (s.plugins.some((p) => p.plugin.name === plugin.name)) return s;
        return { plugins: [...s.plugins, { plugin, enabled: true }] };
      });
    },

    setEnabled(name, enabled) {
      set((s) => ({
        plugins: s.plugins.map((p) =>
          p.plugin.name === name ? { ...p, enabled } : p
        ),
      }));
    },

    getEnabledPlugins() {
      return get()
        .plugins.filter((p) => p.enabled)
        .map((p) => p.plugin);
    },
  }));
}
