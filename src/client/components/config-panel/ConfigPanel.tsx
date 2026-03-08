import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useThreadStore } from '../../lib/store-context';
import { Combobox } from '../ui/Combobox';
import type { EchoMessage, EchoToolDefinition } from '~/core/echo/types';

interface ProviderInfo {
  name: string;
  type: string;
  models: string[];
}

interface ConfigPanelProps {
  systemMessage: EchoMessage | undefined;
  isReadonly: boolean;
}

export function ConfigPanel({ systemMessage, isReadonly }: ConfigPanelProps) {
  const store = useThreadStore();
  const { settings, updateSettings, addMessage, updateMessage } =
    useStore(store);

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch providers
  useEffect(() => {
    fetch('/api/config/providers')
      .then((r) => r.json())
      .then((data) => {
        setProviders(data.providers ?? []);
      })
      .catch(() => {});
  }, []);

  // Auto-select provider/model whenever providers are available but none is set
  useEffect(() => {
    if (providers.length === 0) return;

    if (
      !settings.provider ||
      !providers.find((p) => p.name === settings.provider)
    ) {
      const first = providers[0]!;
      updateSettings({ provider: first.name, model: first.models[0] ?? '' });
    } else if (!settings.model) {
      const p = providers.find((p) => p.name === settings.provider);
      if (p && p.models.length > 0) {
        updateSettings({ model: p.models[0] });
      }
    }
  }, [providers, settings.provider, settings.model, updateSettings]);

  // Auto-select first model when provider changes
  const handleProviderChange = useCallback(
    (name: string) => {
      const p = providers.find((p) => p.name === name);
      const firstModel = p?.models[0] ?? '';
      updateSettings({ provider: name, model: firstModel });
    },
    [providers, updateSettings]
  );

  const currentProvider = providers.find((p) => p.name === settings.provider);
  const models = currentProvider?.models ?? [];
  const singleProvider = providers.length === 1;

  const systemText =
    systemMessage?.parts.find((p) => p.type === 'text')?.text ?? '';

  const handleSystemChange = useCallback(
    (value: string) => {
      if (isReadonly) return;
      if (systemMessage) {
        updateMessage(systemMessage.id, [{ type: 'text', text: value }]);
      } else {
        addMessage('system', value);
      }
    },
    [systemMessage, isReadonly, updateMessage, addMessage]
  );

  // JSON Schema handling
  const schemaText = settings.json_schema
    ? JSON.stringify(settings.json_schema.schema, null, 2)
    : '{\n  "type": "object",\n  "properties": {},\n  "required": [],\n  "additionalProperties": false\n}';

  const schemaName = settings.json_schema?.name ?? 'response';
  const schemaStrict = settings.json_schema?.strict ?? true;

  const handleSchemaChange = useCallback(
    (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        updateSettings({
          json_schema: {
            name: schemaName,
            schema: parsed,
            strict: schemaStrict
          }
        });
      } catch {
        // Invalid JSON — don't update
      }
    },
    [schemaName, schemaStrict, updateSettings]
  );

  return (
    <div className="flex h-full flex-col px-3">
      {/* === Model Section === */}
      <Section
        title="Model"
        extra={
          <button
            onClick={() => setShowModelSettings(!showModelSettings)}
            className="flex size-5 items-center justify-center rounded text-text-desc transition-colors hover:bg-bg-4 hover:text-text-secondary"
            title="Model settings"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            >
              <path d="M5.5 2.5h-3a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1v-3" />
              <path d="M12.5 1.5l-6 6M9 1.5h3.5V5" />
            </svg>
          </button>
        }
      >
        <div className="flex flex-col gap-1.5">
          {/* Model selector row */}
          <div className="flex items-center gap-2">
            {/* Show provider selector only if multiple providers */}
            {!singleProvider && (
              <Combobox
                value={settings.provider ?? ''}
                options={providers.map((p) => p.name)}
                placeholder="Provider"
                onChange={handleProviderChange}
              />
            )}
            <Combobox
              value={settings.model ?? ''}
              options={models}
              placeholder="Select model"
              onChange={(v) => updateSettings({ model: v })}
              className="flex-1"
            />
          </div>

          {/* Inline params display */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 px-0.5 font-mono text-[11px] leading-[16px]">
            <span className="text-text-desc">
              response_format:{' '}
              <span className="text-[var(--success)]">
                {settings.response_format ?? 'text'}
              </span>
            </span>
            <span className="text-text-desc">
              temp:{' '}
              <span className="text-primary">
                {settings.temperature ?? 0.7}
              </span>
            </span>
            <span className="text-text-desc">
              max_tokens:{' '}
              <span className="text-primary">
                {settings.max_tokens ?? 4096}
              </span>
            </span>
          </div>
        </div>

        {/* Expanded settings */}
        {showModelSettings && (
          <div className="mt-2 flex flex-col gap-2 rounded border border-border bg-bg-1-1 p-2.5">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="mb-1 text-[10px] text-text-placeholder">
                  Temperature
                </div>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature ?? 0.7}
                  onChange={(e) =>
                    updateSettings({ temperature: parseFloat(e.target.value) })
                  }
                  className="h-6 w-full rounded border border-border bg-bg-1 px-2 text-[12px] text-text-secondary outline-none focus:border-primary"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] text-text-placeholder">
                  Max Tokens
                </div>
                <input
                  type="number"
                  min={1}
                  step={256}
                  value={settings.max_tokens ?? 4096}
                  onChange={(e) =>
                    updateSettings({ max_tokens: parseInt(e.target.value, 10) })
                  }
                  className="h-6 w-full rounded border border-border bg-bg-1 px-2 text-[12px] text-text-secondary outline-none focus:border-primary"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] text-text-placeholder">
                  Format
                </div>
                <select
                  value={settings.response_format ?? 'text'}
                  onChange={(e) => {
                    const fmt = e.target.value as
                      | 'text'
                      | 'json_object'
                      | 'json_schema';
                    updateSettings({ response_format: fmt });
                    // Initialize default schema when switching to json_schema
                    if (fmt === 'json_schema' && !settings.json_schema) {
                      updateSettings({
                        json_schema: {
                          name: 'response',
                          schema: {
                            type: 'object',
                            properties: {},
                            required: [],
                            additionalProperties: false
                          },
                          strict: true
                        }
                      });
                    }
                  }}
                  className="h-6 w-full rounded border border-border bg-bg-1 px-1.5 text-[12px] text-text-secondary outline-none focus:border-primary"
                >
                  <option value="text">text</option>
                  <option value="json_object">json</option>
                  <option value="json_schema">schema</option>
                </select>
              </div>
            </div>

            {/* JSON Schema editor — shown when format is json_schema */}
            {settings.response_format === 'json_schema' && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="mb-1 text-[10px] text-text-placeholder">
                      Schema Name
                    </div>
                    <input
                      type="text"
                      value={schemaName}
                      onChange={(e) =>
                        updateSettings({
                          json_schema: {
                            ...settings.json_schema!,
                            name: e.target.value
                          }
                        })
                      }
                      className="h-6 w-full rounded border border-border bg-bg-1 px-2 text-[12px] text-text-secondary outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] text-text-placeholder">
                      Strict
                    </div>
                    <button
                      onClick={() =>
                        updateSettings({
                          json_schema: {
                            ...settings.json_schema!,
                            strict: !schemaStrict
                          }
                        })
                      }
                      className={`h-6 rounded border px-2 text-[11px] font-medium transition-colors ${
                        schemaStrict
                          ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]'
                          : 'border-border bg-bg-1 text-text-desc'
                      }`}
                    >
                      {schemaStrict ? 'on' : 'off'}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] text-text-placeholder">
                    JSON Schema
                  </div>
                  <textarea
                    defaultValue={schemaText}
                    onBlur={(e) => handleSchemaChange(e.target.value)}
                    spellCheck={false}
                    rows={8}
                    className="w-full resize-y rounded border border-border bg-bg-1 px-2.5 py-2 font-mono text-[11px] leading-[16px] text-text-secondary outline-none transition-colors focus:border-primary"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* === Tools Section === */}
      <ToolsSection
        tools={settings.tools ?? []}
        onUpdate={(tools) => updateSettings({ tools })}
      />

      {/* === System Prompt === */}
      <div className="flex min-h-0 flex-1 flex-col pt-2.5 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-serif text-[11px] italic text-text-desc">
            System prompt
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={systemText}
          onChange={(e) => handleSystemChange(e.target.value)}
          placeholder="Enter a system prompt here"
          readOnly={isReadonly}
          className="flex-1 resize-none rounded border border-border bg-bg-1-1 px-3 py-2 font-mono text-[12px] leading-[18px] text-text-normal outline-none transition-colors placeholder:text-text-placeholder focus:border-bg-5"
        />
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function Section({
  title,
  extra,
  children
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-serif text-[11px] italic text-text-desc">
          {title}
        </span>
        {extra}
      </div>
      {children}
    </div>
  );
}

/* --- Tools Section --- */

function ToolsSection({
  tools,
  onUpdate
}: {
  tools: EchoToolDefinition[];
  onUpdate: (tools: EchoToolDefinition[]) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const addTool = () => {
    const newTool: EchoToolDefinition = {
      name: '',
      description: '',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      }
    };
    onUpdate([...tools, newTool]);
    setExpandedIndex(tools.length);
  };

  const updateTool = (index: number, updates: Partial<EchoToolDefinition>) => {
    const updated = tools.map((t, i) =>
      i === index ? { ...t, ...updates } : t
    );
    onUpdate(updated);
  };

  const removeTool = (index: number) => {
    onUpdate(tools.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex != null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  return (
    <Section
      title="Tools"
      extra={
        <button
          onClick={addTool}
          className="flex items-center gap-1 text-[11px] text-text-desc transition-colors hover:text-text-secondary"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M5 2v6M2 5h6"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Add tool
        </button>
      }
    >
      {tools.length === 0 ? (
        <div className="py-1 text-[12px] text-text-placeholder">
          No tools configured
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {tools.map((tool, i) => (
            <ToolItem
              key={i}
              tool={tool}
              isExpanded={expandedIndex === i}
              onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              onUpdate={(updates) => updateTool(i, updates)}
              onRemove={() => removeTool(i)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function ToolItem({
  tool,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove
}: {
  tool: EchoToolDefinition;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<EchoToolDefinition>) => void;
  onRemove: () => void;
}) {
  const paramsText = JSON.stringify(tool.parameters, null, 2);

  const handleParamsBlur = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      onUpdate({ parameters: parsed });
    } catch {
      // Invalid JSON — don't update
    }
  };

  return (
    <div className="rounded border border-border bg-bg-1-1">
      {/* Header row */}
      <div
        className="group flex cursor-pointer items-center gap-1.5 px-2 py-1.5"
        onClick={onToggle}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="currentColor"
          className={`shrink-0 text-text-desc transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M2 1l4 3-4 3V1z" />
        </svg>
        <span className="flex-1 truncate font-mono text-[12px] text-text-secondary">
          {tool.name || 'untitled'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex size-4 items-center justify-center rounded-sm text-transparent transition-colors hover:bg-bg-4 group-hover:text-text-desc"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1.5 1.5l5 5M6.5 1.5l-5 5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="flex flex-col gap-2 border-t border-border px-2 py-2">
          <div>
            <div className="mb-1 text-[10px] text-text-placeholder">Name</div>
            <input
              type="text"
              value={tool.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="get_weather"
              spellCheck={false}
              className="h-6 w-full rounded border border-border bg-bg-1 px-2 font-mono text-[12px] text-text-secondary outline-none focus:border-primary"
            />
          </div>
          <div>
            <div className="mb-1 text-[10px] text-text-placeholder">
              Description
            </div>
            <input
              type="text"
              value={tool.description ?? ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Get current weather for a location"
              className="h-6 w-full rounded border border-border bg-bg-1 px-2 text-[12px] text-text-secondary outline-none focus:border-primary"
            />
          </div>
          <div>
            <div className="mb-1 text-[10px] text-text-placeholder">
              Parameters (JSON Schema)
            </div>
            <textarea
              defaultValue={paramsText}
              onBlur={(e) => handleParamsBlur(e.target.value)}
              spellCheck={false}
              rows={6}
              className="w-full resize-y rounded border border-border bg-bg-1 px-2.5 py-2 font-mono text-[11px] leading-[16px] text-text-secondary outline-none transition-colors focus:border-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}
