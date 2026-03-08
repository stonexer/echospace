import { useRef, useEffect, useState } from "react";
import { useStore } from "zustand";
import { usePluginStore } from "../../lib/store-context";
import { getTheme, setTheme, type Theme } from "../../lib/theme";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const pluginStore = usePluginStore();
  const { plugins, setEnabled } = useStore(pluginStore);
  const panelRef = useRef<HTMLDivElement>(null);
  const [currentTheme, setCurrentTheme] = useState<Theme>(getTheme);

  const handleThemeChange = (theme: Theme) => {
    setTheme(theme);
    setCurrentTheme(theme);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer so the opening click doesn't immediately close the panel
    const id = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handler);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 bottom-full mb-1 w-56 rounded border border-border bg-bg-1 shadow-panel"
    >
      <div className="border-b border-border px-3 py-2">
        <span className="font-serif text-[11px] italic text-text-desc">
          Settings
        </span>
      </div>
      <div className="border-b border-border px-3 py-2">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-placeholder">
          Theme
        </div>
        <div className="grid grid-cols-2 gap-1">
          {([
            ["retro", "Retro Light"],
            ["dusk", "Dusk Warmer"],
            ["ember", "Ember Dark"],
            ["slate", "Slate Dark"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleThemeChange(key)}
              className={`rounded px-2 py-1 text-[12px] font-medium transition-colors ${
                currentTheme === key
                  ? "bg-primary/15 text-primary"
                  : "bg-bg-2 text-text-desc hover:text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-placeholder">
          Plugins
        </div>
        {plugins.length === 0 ? (
          <div className="text-[11px] text-text-desc">No plugins installed</div>
        ) : (
          <div className="flex flex-col gap-1">
            {plugins.map((entry) => (
              <label
                key={entry.plugin.name}
                className="flex cursor-pointer items-center justify-between py-0.5 text-[12px] text-text-secondary"
              >
                <span>
                  {entry.plugin.name}{" "}
                  <span className="text-[10px] text-text-desc">
                    v{entry.plugin.version}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(e) =>
                    setEnabled(entry.plugin.name, e.target.checked)
                  }
                  className="accent-primary"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
