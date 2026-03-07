import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useThreadStore } from "../../lib/store-context";
import { toast } from "sonner";

interface ProviderInfo {
  name: string;
  type: string;
  models: string[];
}

export function Toolbar() {
  const store = useThreadStore();
  const { settings, updateSettings, isStreaming, runCompletion, stopCompletion } =
    useStore(store);

  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    fetch("/api/config/providers")
      .then((r) => r.json())
      .then((data) => setProviders(data.providers ?? []))
      .catch(() => {});
  }, []);

  const currentProvider = providers.find((p) => p.name === settings.provider);
  const models = currentProvider?.models ?? [];

  const handleRun = useCallback(async () => {
    try {
      await runCompletion();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [runCompletion]);

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-bg-1 px-3">
      {/* Provider */}
      <select
        value={settings.provider ?? ""}
        onChange={(e) => updateSettings({ provider: e.target.value })}
        className="h-6 rounded-sm border border-border bg-bg-2 px-2 text-[12px] text-text-secondary outline-none transition-colors hover:border-bg-5 focus:border-primary"
      >
        <option value="">Provider</option>
        {providers.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Model */}
      <select
        value={settings.model ?? ""}
        onChange={(e) => updateSettings({ model: e.target.value })}
        className="h-6 rounded-sm border border-border bg-bg-2 px-2 text-[12px] text-text-secondary outline-none transition-colors hover:border-bg-5 focus:border-primary"
      >
        <option value="">Model</option>
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* Divider */}
      <div className="mx-1 h-4 w-px bg-border" />

      {/* Temperature */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-text-desc">Temp</span>
        <input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={settings.temperature ?? 0.7}
          onChange={(e) =>
            updateSettings({ temperature: parseFloat(e.target.value) })
          }
          className="h-6 w-12 rounded-sm border border-border bg-bg-2 px-1.5 text-center text-[12px] text-text-secondary outline-none transition-colors hover:border-bg-5 focus:border-primary"
        />
      </div>

      {/* Max tokens */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-text-desc">Max</span>
        <input
          type="number"
          min={1}
          step={256}
          value={settings.max_tokens ?? 4096}
          onChange={(e) =>
            updateSettings({ max_tokens: parseInt(e.target.value, 10) })
          }
          className="h-6 w-16 rounded-sm border border-border bg-bg-2 px-1.5 text-center text-[12px] text-text-secondary outline-none transition-colors hover:border-bg-5 focus:border-primary"
        />
      </div>

      <div className="flex-1" />

      {/* Run / Stop */}
      {isStreaming ? (
        <button
          onClick={stopCompletion}
          className="h-6 rounded-sm bg-destructive/90 px-3 text-[12px] font-medium text-white transition-colors hover:bg-destructive"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={handleRun}
          disabled={!settings.provider || !settings.model}
          className="h-6 rounded-sm bg-primary px-3 text-[12px] font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-30"
        >
          Run
        </button>
      )}
    </div>
  );
}
