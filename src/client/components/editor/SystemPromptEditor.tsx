import { useCallback, useRef, useEffect } from "react";
import { useStore } from "zustand";
import { useThreadStore } from "../../lib/store-context";
import type { EchoMessage } from "~/core/echo/types";

interface SystemPromptEditorProps {
  message: EchoMessage | undefined;
  isReadonly: boolean;
}

export function SystemPromptEditor({
  message,
  isReadonly,
}: SystemPromptEditorProps) {
  const store = useThreadStore();
  const { addMessage, updateMessage } = useStore(store);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const text =
    message?.parts.find((p) => p.type === "text")?.text ?? "";

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(60, el.scrollHeight)}px`;
    }
  }, [text]);

  const handleChange = useCallback(
    (value: string) => {
      if (isReadonly) return;
      if (message) {
        updateMessage(message.id, [{ type: "text", text: value }]);
      } else {
        addMessage("system", value);
      }
    },
    [message, isReadonly, updateMessage, addMessage],
  );

  return (
    <div className="border-b border-border px-4 py-3">
      {/* Section label */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-desc">
          System Prompt
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter system prompt..."
        readOnly={isReadonly}
        rows={3}
        className="w-full resize-none rounded border border-border bg-bg-2 px-3 py-2 font-mono text-[12px] leading-[18px] text-text-normal outline-none transition-colors placeholder:text-text-placeholder focus:border-bg-5"
      />
    </div>
  );
}
