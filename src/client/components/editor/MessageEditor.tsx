import { useCallback, useRef, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useThreadStore } from "../../lib/store-context";
import type { EchoMessage, EchoRole, ToolCallPart } from "~/core/echo/types";

interface MessageEditorProps {
  message: EchoMessage;
  index: number;
  allMessages: EchoMessage[];
  isReadonly: boolean;
  isStreaming: boolean;
}

const ROLE_STYLES: Record<EchoRole, string> = {
  system: "bg-[rgba(120,90,150,0.10)] text-[#7a5a96]",
  user: "bg-primary/10 text-primary",
  assistant: "bg-[rgba(90,126,69,0.10)] text-[#4a7040]",
  tool: "bg-[rgba(178,130,50,0.10)] text-[#9a7030]",
};

const ROLE_CYCLE: EchoRole[] = ["user", "assistant", "tool"];

export function MessageEditor({
  message,
  index,
  allMessages,
  isReadonly,
  isStreaming,
}: MessageEditorProps) {
  const store = useThreadStore();
  const { updateMessage, updateMessageRole, removeMessage, runCompletion, addImageToMessage, addToolResultMessage } =
    useStore(store);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const text =
    message.parts.find((p) => p.type === "text")?.text ?? "";

  const thinkingText = message.parts
    .filter((p) => p.type === "thinking")
    .map((p) => p.text)
    .join("");

  const toolCalls = message.parts.filter((p) => p.type === "tool_call");
  const toolResults = message.parts.filter((p) => p.type === "tool_result");
  const images = message.parts.filter((p) => p.type === "image");

  // For assistant messages: find tool result messages that follow this message
  // and match by tool_call id, so we can render them inline
  const toolResultMessages = message.role === "assistant" && toolCalls.length > 0
    ? (() => {
        const myIdx = allMessages.findIndex((m) => m.id === message.id);
        const results = new Map<string, { msg: EchoMessage; partIndex: number }>();
        // Scan forward for tool messages with matching tool_result parts
        for (let i = myIdx + 1; i < allMessages.length; i++) {
          const m = allMessages[i];
          if (m.role !== "tool") break;
          for (let pi = 0; pi < m.parts.length; pi++) {
            const p = m.parts[pi];
            if (p.type === "tool_result" && p.id) {
              results.set(p.id, { msg: m, partIndex: pi });
            }
          }
        }
        return results;
      })()
    : null;

  // Hide this tool message if all its results are rendered inline in the previous assistant
  const isInlinedToolMessage = message.role === "tool" && toolResults.length > 0 && (() => {
    const myIdx = allMessages.findIndex((m) => m.id === message.id);
    if (myIdx <= 0) return false;
    const prev = allMessages[myIdx - 1];
    // Check if previous message (or a preceding assistant) has tool_calls that reference our tool_result ids
    // Walk backwards to find the assistant message
    for (let i = myIdx - 1; i >= 0; i--) {
      const m = allMessages[i];
      if (m.role === "assistant") {
        const prevToolCallIds = new Set(
          m.parts.filter((p): p is ToolCallPart => p.type === "tool_call" && !!p.id).map((p) => p.id)
        );
        return toolResults.every((tr) => prevToolCallIds.has(tr.id));
      }
      if (m.role !== "tool") break;
    }
    return false;
  })();

  if (isInlinedToolMessage && !text) return null;

  const tokenEstimate = Math.ceil(text.length / 4);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el && !collapsed) {
      el.style.height = "auto";
      el.style.height = `${Math.max(36, el.scrollHeight)}px`;
    }
  }, [text, collapsed]);

  const handleTextChange = useCallback(
    (value: string) => {
      if (isReadonly) return;
      const otherParts = message.parts.filter((p) => p.type !== "text");
      updateMessage(message.id, [
        { type: "text", text: value },
        ...otherParts,
      ]);
    },
    [message, isReadonly, updateMessage],
  );

  const handleRoleCycle = useCallback(() => {
    if (isReadonly) return;
    const currentIdx = ROLE_CYCLE.indexOf(message.role);
    const nextRole = ROLE_CYCLE[(currentIdx + 1) % ROLE_CYCLE.length]!;
    updateMessageRole(message.id, nextRole);
  }, [message, isReadonly, updateMessageRole]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey && e.key === "Enter") {
        e.preventDefault();
        runCompletion();
      }
    },
    [runCompletion],
  );

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] ?? "";
          addImageToMessage(message.id, base64, file.type);
        };
        reader.readAsDataURL(file);
      }
      e.target.value = "";
    },
    [message.id, addImageToMessage],
  );

  const handleRemoveImage = useCallback(
    (imgIndex: number) => {
      const newParts = message.parts.filter((p, i) => {
        if (p.type !== "image") return true;
        const imageIdx = message.parts
          .slice(0, i + 1)
          .filter((pp) => pp.type === "image").length - 1;
        return imageIdx !== imgIndex;
      });
      updateMessage(message.id, newParts);
    },
    [message, updateMessage],
  );

  // Collapsed preview text
  const previewText = text.replace(/\n/g, " ").slice(0, 80);

  const latency = message.meta?.latency;
  const usage = message.meta?.usage;

  return (
    <div
      className={`group relative rounded border transition-colors ${
        isStreaming
          ? "border-primary/40 bg-bg-1-2 shadow-[0_0_12px_rgba(163,98,58,0.08)]"
          : "border-border bg-bg-1 hover:border-bg-5"
      }`}
    >
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag handle */}
      <div
        className={`absolute top-[7px] -left-[1px] opacity-0 transition-opacity ${
          !isReadonly ? "max-md:opacity-100 md:group-hover:opacity-100" : "pointer-events-none"
        }`}
      >
        <DragHandle />
      </div>

      {/* Header */}
      <div className="flex items-center px-3 py-[6px]">
        <div className="flex shrink-0 items-center gap-2">
          {/* Role badge with icon */}
          <button
            onClick={handleRoleCycle}
            disabled={isReadonly}
            title="Switch message role"
            className={`flex items-center gap-1 rounded-sm px-1.5 py-[1px] text-[11px] font-medium ${ROLE_STYLES[message.role]} ${!isReadonly ? "cursor-pointer transition-opacity hover:opacity-80" : ""}`}
          >
            <RoleIcon role={message.role} />
            {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
          </button>

          {/* Token counter */}
          <span className="font-mono text-[10px] text-text-placeholder" title="Tokens in this message / cumulative">
            {tokenEstimate}/{tokenEstimate}
          </span>

          {/* Latency / usage inline */}
          {latency?.duration != null && (
            <span className="text-[10px] text-text-desc">
              {(latency.duration / 1000).toFixed(1)}s
            </span>
          )}
          {usage && (
            <span className="text-[10px] text-text-desc">
              {usage.input_tokens ?? 0} → {usage.output_tokens ?? 0}
            </span>
          )}
        </div>

        {/* Collapsed preview — clickable to expand */}
        <div
          className="h-4 min-w-0 flex-1 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div
            className={`flex h-4 w-full items-center overflow-hidden px-2 text-[11px] text-text-desc transition-all ${
              collapsed ? "opacity-100" : "translate-y-1 opacity-0"
            }`}
          >
            {images.length > 0
              ? `[${images.length} image${images.length > 1 ? "s" : ""}]`
              : previewText}
          </div>
        </div>

        {/* Action buttons (right side) */}
        <div className="flex shrink-0 items-center gap-1.5 pl-2">
          {/* Hover-reveal actions */}
          <div className={`flex items-center gap-1.5 transition-opacity ${
            isReadonly ? "pointer-events-none opacity-0" : "max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}>
            {/* Add image */}
            <button
              onClick={handleImageUpload}
              title="Add images"
              className="flex size-5 items-center justify-center rounded-sm text-text-desc transition-colors hover:bg-bg-4 hover:text-text-secondary"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
                <circle cx="4.5" cy="5.5" r="1" />
                <path d="M1.5 9.5l3-3 2 2 2.5-2.5 3.5 3.5" />
                <path d="M10 2.5v-1M10 1.5h1.5" />
              </svg>
            </button>

            {/* Run from this message */}
            <button
              onClick={() => runCompletion()}
              title="Run from this message"
              className="flex size-5 items-center justify-center rounded-sm text-text-desc transition-colors hover:bg-bg-4 hover:text-text-secondary"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M5.5 4.5l4 2.5-4 2.5V4.5z" fill="currentColor" stroke="none" />
              </svg>
            </button>

            {/* Remove message */}
            <button
              onClick={() => removeMessage(message.id)}
              title="Remove this message"
              className="flex size-5 items-center justify-center rounded-sm text-text-desc transition-colors hover:bg-bg-4 hover:text-destructive"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M4.5 7h5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Collapse toggle (always visible when collapsed, hover otherwise) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand this message" : "Collapse this message"}
            className={`flex size-5 items-center justify-center rounded-sm text-text-desc transition-all hover:bg-bg-4 hover:text-text-secondary ${
              collapsed ? "opacity-100" : "max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
            >
              <path d="M3 4.5l3 3 3-3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Thinking content */}
      {thinkingText && !collapsed && (
        <div className="mx-3 mb-2">
          <div className="border-l-2 border-border px-3 py-1 text-[12px] leading-[18px] whitespace-pre-wrap text-text-desc">
            {thinkingText}
          </div>
        </div>
      )}

      {/* Image thumbnails */}
      {images.length > 0 && !collapsed && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          {images.map((img, i) => {
            const src = img.base64
              ? `data:${img.media_type ?? "image/png"};base64,${img.base64}`
              : img.url ?? "";
            return (
              <div key={i} className="group/img relative shrink-0">
                <img
                  src={src}
                  alt=""
                  className="size-[80px] rounded border border-border object-cover"
                />
                {!isReadonly && (
                  <button
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-bg-1 text-text-desc opacity-0 shadow transition-opacity hover:text-destructive group-hover/img:opacity-100"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Text content — hide for tool messages that only have tool_result parts */}
      {!(message.role === "tool" && toolResults.length > 0 && !text) && (
        <div
          className={`transition-all ${
            collapsed ? "h-0 overflow-hidden opacity-0" : "min-h-[36px]"
          }`}
        >
          <div className="px-3 pb-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              readOnly={isReadonly || isStreaming}
              placeholder={
                message.role === "user"
                  ? "Enter a user message here"
                  : message.role === "tool"
                    ? "Enter tool result text here"
                    : "Enter an assistant message here"
              }
              rows={1}
              className={`w-full resize-none bg-transparent font-mono text-[12px] leading-[18px] text-text-normal outline-none placeholder:text-text-placeholder ${
                isStreaming ? "opacity-90" : ""
              }`}
            />
          </div>
        </div>
      )}

      {/* Tool calls */}
      {toolCalls.length > 0 && !collapsed && (
        <div className="border-t border-border px-3 py-2">
          {toolCalls.map((tc, i) => {
            const inlineResult = tc.id ? toolResultMessages?.get(tc.id) : null;
            const resultOutput = inlineResult
              ? (() => {
                  const p = inlineResult.msg.parts[inlineResult.partIndex];
                  return p?.type === "tool_result"
                    ? (typeof p.output === "string" ? p.output : JSON.stringify(p.output, null, 2))
                    : "";
                })()
              : null;

            return (
              <div key={i} className="mb-1 rounded border border-border bg-bg-2 px-2.5 py-1.5">
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#7a5a96" strokeWidth="1.1" strokeLinecap="round">
                    <rect x="1" y="1" width="10" height="10" rx="1.5" />
                    <path d="M4 6l1.5 1.5L8 5" />
                  </svg>
                  <span className="font-mono text-[11px] font-medium text-[#7a5a96]">
                    {tc.name}
                  </span>
                  <div className="flex-1" />
                  {!isReadonly && tc.id && !inlineResult && (
                    <button
                      onClick={() => addToolResultMessage(message.id, tc.id, tc.name)}
                      className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      + Result
                    </button>
                  )}
                </div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-[16px] text-text-desc">
                  {typeof tc.input === "string"
                    ? tc.input
                    : JSON.stringify(tc.input, null, 2)}
                </pre>
                {/* Inline tool result */}
                {inlineResult && (
                  <div className="mt-1.5 border-t border-border/60 pt-1.5">
                    <div className="mb-1 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#9a7030" strokeWidth="1" strokeLinecap="round">
                        <path d="M1 5h3l1-2 2 4 1-2h2" />
                      </svg>
                      <span className="text-[10px] font-medium text-[#9a7030]">Result</span>
                    </div>
                    {!isReadonly ? (
                      <textarea
                        value={resultOutput ?? ""}
                        onChange={(e) => {
                          const newParts = inlineResult.msg.parts.map((p, pi) =>
                            pi === inlineResult.partIndex && p.type === "tool_result"
                              ? { ...p, output: e.target.value }
                              : p,
                          );
                          updateMessage(inlineResult.msg.id, newParts);
                        }}
                        placeholder="Enter tool result output..."
                        className="w-full resize-none bg-transparent font-mono text-[11px] leading-[16px] text-text-desc outline-none placeholder:text-text-placeholder"
                        rows={2}
                      />
                    ) : (
                      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-[16px] text-text-desc">
                        {resultOutput}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tool results (only shown for standalone tool messages not inlined above) */}
      {toolResults.length > 0 && !isInlinedToolMessage && !collapsed && (
        <div className="border-t border-border px-3 py-2">
          {toolResults.map((tr, i) => (
            <div
              key={i}
              className={`mb-1 rounded border px-2.5 py-1.5 ${
                tr.is_error
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-bg-2"
              }`}
            >
              <div className="mb-1 flex items-center gap-1">
                <span className="font-mono text-[10px] text-text-placeholder">
                  tool_use_id: {tr.id}
                </span>
              </div>
              {!isReadonly ? (
                <textarea
                  value={
                    typeof tr.output === "string"
                      ? tr.output
                      : JSON.stringify(tr.output, null, 2)
                  }
                  onChange={(e) => {
                    const newParts = message.parts.map((p, pi) => {
                      if (p.type !== "tool_result") return p;
                      const trIdx = message.parts
                        .slice(0, pi + 1)
                        .filter((pp) => pp.type === "tool_result").length - 1;
                      if (trIdx !== i) return p;
                      return { ...p, output: e.target.value };
                    });
                    updateMessage(message.id, newParts);
                  }}
                  placeholder="Enter tool result output..."
                  className="w-full resize-none bg-transparent font-mono text-[11px] leading-[16px] text-text-desc outline-none placeholder:text-text-placeholder"
                  rows={3}
                />
              ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-[16px] text-text-desc">
                  {typeof tr.output === "string"
                    ? tr.output
                    : JSON.stringify(tr.output, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Sub-components --- */

function RoleIcon({ role }: { role: EchoRole }) {
  if (role === "user") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <circle cx="6" cy="4" r="2" />
        <path d="M2 10.5c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" />
      </svg>
    );
  }
  if (role === "assistant") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <rect x="2" y="3" width="8" height="6" rx="2" />
        <circle cx="4.5" cy="6" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="7.5" cy="6" r="0.7" fill="currentColor" stroke="none" />
        <path d="M4 2v1M8 2v1" />
      </svg>
    );
  }
  if (role === "tool") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M7 2L5 10M3.5 3.5L1 6l2.5 2.5M8.5 3.5L11 6l-2.5 2.5" />
      </svg>
    );
  }
  return null;
}

function DragHandle() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" fill="currentColor" className="text-text-placeholder">
      <circle cx="1" cy="1" r="0.7" />
      <circle cx="4" cy="1" r="0.7" />
      <circle cx="1" cy="4.5" r="0.7" />
      <circle cx="4" cy="4.5" r="0.7" />
      <circle cx="1" cy="8" r="0.7" />
      <circle cx="4" cy="8" r="0.7" />
    </svg>
  );
}
